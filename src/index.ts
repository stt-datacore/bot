import fs from 'fs';
import { Client } from 'discord.js';

import { parseCommandInput, Logger, prepareArgParser, getUrl, escapeRegExp } from './utils';
import { MessageCache, sendAndCache } from './utils/discord';
import { DCData } from './data/DCData';
import { sequelize } from './sequelize';
import { runImageAnalysis } from './commands/imageanalysis';

require('dotenv').config();

const client = new Client();

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

sequelize.sync().then(() => {
	Logger.info('Database connection established');
});

client.on('ready', () => {
	Logger.info('Bot logged in', { bot_tag: client.user.tag });
});

client.on('messageDelete', (message) => {
	let replies: string[] | undefined = MessageCache.get(message.id);
	if (replies) {
		MessageCache.del(message.id);

		replies.forEach((reply) => {
			message.channel
				.fetchMessage(reply)
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

client.on('message', (message) => {
	if (message.author.id === client.user.id) {
		return;
	}

	Logger.info('Message received', {
		id: message.id,
		author: { id: message.author.id, username: message.author.username },
		guild: message.guild ? message.guild.toString() : 'DM',
		channel: message.channel.toString(),
		content: message.content,
	});

	if (message.author.bot) {
		return;
	}

	if (config.devmode && !config.devmode[message.guild.id]) {
		return;
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
		prefixes.push(`<@!?${client.user.id}> `);
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
			sendAndCache(
				message,
				`Sorry, I couldn't do that! Try '${usedPrefix} help' for a list of commands or '${usedPrefix} --help <command>' for command-specific help ('${lastError}')`
			);
		}
	}
});
