import { Message } from 'discord.js';
import winston from 'winston';
require('winston-daily-rotate-file');

import yargs from 'yargs';

// Why this? Because regular yargs is a singleton and we need a fresh instance on each invocation to clear the stack
const Yargs = require('yargs/yargs');

import { Commands } from './commands';
import { sendAndCache } from './utils/discord';

require('dotenv').config();

export let Logger = winston.createLogger({
	level: 'verbose',
	transports: [
		new (winston.transports as any).DailyRotateFile({ dirname: process.env.LOG_PATH ? `${process.env.LOG_PATH}/botlogs` : './logs' }),
		new winston.transports.Console({ format: winston.format.simple() }),
		new winston.transports.File({
			filename: process.env.LOG_PATH ? `${process.env.LOG_PATH}/botlogs/error.log` : './logs/error.log',
			level: 'error',
		}),
	],
});

export function parseCommandInput(input: string): readonly string[] {
	let command = input.replace(/“/g, '"').replace(/”/g, '"').replace(/’/g, "'").trim();

	let args = command.split(/("[^"]*"|'[^']*'|[\S]+)+/g);
	if (args === undefined || args.length === 0) {
		return [];
	}

	args = args.map((arg) => arg.replace(/"/g, '').replace(/'/g, '').trim()).filter((arg) => arg);

	if (args[0] === 'help') {
		args[0] = '--help';
	}

	return args;
}

interface ParseResults {
	lastError: string | undefined;
	conOutput: string | undefined;
}

export function prepareArgParser(
	prefix: string,
	message: Message,
	parsedInput: readonly string[],
	guildConfig: Definitions.GuildConfig
): ParseResults {
	// Prepare the argument parser with defaults and all commands
	let argParser = <yargs.Argv>new Yargs();
	argParser = argParser.version(false).exitProcess(false);

	Commands.forEach((cmd) => {
		let cmdConfig = guildConfig && guildConfig.commands ? guildConfig.commands.find((c: any) => c.command === cmd.name) : undefined;
		if (cmdConfig && cmdConfig.channelsDisabled && cmdConfig.channelsDisabled.indexOf(message.channel.id) >= 0) {
			// construct a simple command that returns the messageDisabled string if invoked
			if (cmdConfig.messageDisabled) {
				argParser = argParser.command(
					cmd.command!,
					false,
					(yp: yargs.Argv) => yp,
					() => {
						message.reply(cmdConfig!.messageDisabled!);
					}
				);
			}
		} else {
			if (cmdConfig && cmdConfig.aliases) {
				// TODO: per-guild aliases accumulate over time, find a way to create a fresh instance instead; the shallow thing below doesn't work
				/*let cmdShallowCopy = Object.assign({}, cmd);
				cmdShallowCopy.aliases = (cmd.aliases as string[]).concat(cmdConfig.aliases);
				argParser = argParser.command(cmdShallowCopy);*/
				cmd.aliases = (cmd.aliases as string[]).concat(cmdConfig.aliases);
				cmd.aliases = [...new Set(cmd.aliases)];
			}
			argParser = argParser.command(cmd);
		}
	});

	if (guildConfig.customs && guildConfig.customs.length > 0) {
		for (let custom of guildConfig.customs) {
			argParser = argParser.command(
				custom.command,
				false,
				(yp: yargs.Argv) => yp,
				() => {
					sendAndCache(message, custom.reply, { asReply: custom.asReply });
				}
			);
		}
	}

	const startTime = Date.now();

	let lastError = undefined;
	let conOutput = undefined;
	argParser
		.strict(true)
		.showHelpOnFail(false, 'Specify --help for available options')
		.demandCommand(1, 1, 'You forgot the command name')
		.scriptName(prefix)
		//.wrap(null)
		.wrap(80) // TODO: find a better wrap number that looks ok on mobile and desktops
		.fail((msg, err) => {
			lastError = msg;
			argParser.exit(1, err);
		})
		.parse(parsedInput, { message, guildConfig, ArgParser: argParser }, async (err, argv, output) => {
			// Hack to get around parse not waiting for promises
			if (argv.promisedResult) {
				await (argv.promisedResult as Promise<void>).catch((e: Error) => {
					err = e;
				});
			}

			if (err) {
				Logger.error('Error during command execution', { error: err.message, callstack: err.stack });
			}

			Logger.verbose('Message processed', { id: message.id, msElapsed: Date.now() - startTime });

			conOutput = output.trim();
		});

	return { lastError, conOutput };
}

const urlRegex = /\b(https?:\/\/\S*\b)/g;

export function getUrl(message: Message): string | undefined {
	let url = undefined;
	if (message.attachments.size > 0) {
		if (message.attachments?.first()?.width! > 700) {
			url = message.attachments?.first()?.url;
		}
	}

	if (message.embeds.length > 0) {
		if (message.embeds[0].image && message.embeds[0]?.image?.width! > 700) {
			url = message.embeds[0].image.url;
		}
	}

	const urls = message.content.match(urlRegex);
	if (urls) {
		url = urls[0];
	}

	return url;
}

// Escape string for use in Javascript regex
export function escapeRegExp(strings: string[]) {
	return strings.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // $& means the whole matched string
}

export function getOnlyAlpha(value: string) {
	let re = new RegExp(/[A-Za-z]/);
	let str = [] as string[];
	for (let ch of value) {
		if (re.test(ch)) str.push(ch);
	}
	return str.join("");
}