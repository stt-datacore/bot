import fs from 'fs';
import { Client, Partials } from 'discord.js';

import { parseCommandInput, Logger, prepareArgParser, getUrl, escapeRegExp } from './utils';
import { MessageCache, sendAndCache } from './utils/discord';
import { DCData } from './data/DCData';
import { sequelize } from './sequelize';
import { runImageAnalysis } from './commands/imageanalysis';
import { Commands } from './commands';
import levenshtein from 'js-levenshtein';
import yargs from 'yargs';
import { Profile } from './models/Profile';
const Yargs = require('yargs/yargs');

require('dotenv').config();

const client = new Client({
	intents: ['Guilds', 
		'GuildMessages', 
		'MessageContent', 
		'GuildEmojisAndStickers', 
		'GuildMessageTyping', 
		'GuildIntegrations', 
		'GuildMessageReactions',	
		'DirectMessages',
		'DirectMessageReactions'	
		],
	partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.ThreadMember, Partials.User],
});

/*
For announcements (RSS from forum https://forum.disruptorbeam.com/stt/categories/starfleet-communications/feed.rss)
https://www.npmjs.com/package/rss-parser
https://github.com/rbren/rss-parser#readme
https://github.com/domchristie/turndown
https://github.com/synzen/Discord.RSS
*/

DCData.setup(process.env.DC_DATA_PATH!);
client.login(process.env.BOT_TOKEN);

// TODO: merge config default with guild specific options
const config = JSON.parse(fs.readFileSync(process.env.CONFIG_PATH!, 'utf8'));
const devGuilds = Object.keys(config.guilds).filter((id) => config.guilds[id].dev === true);

sequelize.sync().then(async () => {
	await Profile.sync({ alter: true });
	Logger.info('Database connection established');
});

client.on('ready', () => {
	Logger.info('Bot logged in', { bot_tag: client.user?.tag });
	const slashCommands = Commands.map((com) => (
		{
			name: com.name,
			description: com.describe || '',
			options: com.options ?? []
		}
	));
	if (process.env.NODE_ENV === 'production') {
		Logger.info(`Registering commands globally`);
		client?.application?.commands.set(slashCommands);
	} else {
		
		if (!!process.env.DEFAULT_GUILD) {
			const gid = process.env.DEFAULT_GUILD;
			Logger.info(`Registering commands for guild ${gid}`);
			client.guilds.cache.get(gid)?.commands.set(slashCommands);	
		}
		
		for (const gid of devGuilds) {
			Logger.info(`Registering commands for guild ${gid}`);
			client.guilds.cache.get(gid)?.commands.set(slashCommands);
		}
	}
});

client.on('interactionCreate', (interaction) => {
	  // If the interaction isn't a slash command, return
		if (!interaction.isCommand()) return;

		Commands.forEach((cmd) => {
			if (cmd.name === interaction.commandName) {
				let args = <any>{
					message: interaction,
				};
				interaction.options.data.forEach((op: any) => {
					args[op.name] = op.value;
				})
				cmd.handler(args);
			}
		});
});

client.on('messageDelete', (message) => {
	let replies: string[] | undefined = MessageCache.get(message.id);
	if (replies) {
		MessageCache.del(message.id);

		replies.forEach((reply) => {
			message.channel
				.messages.fetch(reply)
				.then((message) => {
					if (message) {
						message.delete();
					}
				})
				.catch(() => {
					// Don't care
				});
		});
	}
});

client.on('messageCreate', (message) => {
	if (message.author.id === client.user?.id) {
		return;
	}

	Logger.verbose('Message received', {
		id: message.id,
		author: { id: message.author.id, username: message.author.username },
		guild: message.guild ? message.guild.toString() : 'DM',
		channel: message.channel.toString(),
		content: message.content,
	});

	if (message.author.bot) {
		return;
	}

	if (config.devmode) {
		// a DM or a message from a guild not in devmode
		if (!message.guild || !config.devmode[message.guild.id]) {
			return;
		}
	}

	let prefixes = config.guilds.default.prefixes;

	let guildConfig = message.guild && config.guilds[message.guild.id] ? config.guilds[message.guild.id] : {};
	if (guildConfig.prefixes) {
		if (guildConfig.overrideDefaultPrefixes) {
			prefixes = escapeRegExp(guildConfig.prefixes);
		} else {
			prefixes = prefixes.concat(escapeRegExp(guildConfig.prefixes));
		}
	}

	if (config.guilds.default.mentionPrefix) {
		prefixes.push(`<@!?${client.user?.id}> `);
	}
	let prefixRegex = new RegExp(`^(${prefixes.join('|')})`);

	const prefix = message.content.match(prefixRegex);
	let usedPrefix = '';
	
	if (prefix === null) {
		// special case for attached images (for behold / voyage)
		let cmdConfig = guildConfig && guildConfig.commands ? guildConfig.commands.find((c: any) => c.command === 'imageAnalysis') : undefined;
		if (!cmdConfig || cmdConfig.channelsDisabled.indexOf(message.channel.toString()) < 0) {
			let url = getUrl(message);
			if (url) {
				runImageAnalysis(message, url, usedPrefix);
				return;
			}
		}

		if (message.guild) {
			// Message coming from a guild (not a DM)
			return;
		} else {
			// For DMs it's ok to skip prefix
		}
	} else {
		usedPrefix = prefix[0];
	}

	let parsedInput = parseCommandInput(message.content.slice(usedPrefix.length).trim());

	const { lastError, conOutput } = prepareArgParser(usedPrefix, message, parsedInput, guildConfig);

	if (conOutput) {
		if (conOutput.length > 1990) {
			sendAndCache(message, '```' + conOutput.substr(0,1987) + '...```');
		} else {
			sendAndCache(message, '```' + conOutput + '```');
		}
	}

	if (lastError) {
		if (guildConfig.ignoreUnknownCommandForPrefix === usedPrefix && lastError.startsWith('Unknown argument')) {
			// Do nothing
		} else {
			let scores = !!parsedInput?.length ? Commands.map(c => { return { score: levenshtein(c.name, parsedInput[0]), name: c.name }}).sort((a, b) => a.score - b.score) : [];
			if (scores?.length && scores[0].score <= 2) {
				sendAndCache(
					message,
					`Sorry, I couldn't do that! Did you mean '${scores[0].name}'?\n` +
					`Try '${usedPrefix} help' for a list of commands or '${usedPrefix} --help <command>' for command-specific help ('${lastError}')`
				);
			}
			else {
				sendAndCache(
					message,
					`Sorry, I couldn't do that! Try '${usedPrefix} help' for a list of commands or '${usedPrefix} --help <command>' for command-specific help ('${lastError}')`
				);	
			}
		}
	}
});
