import { ApplicationCommandOptionType, Message } from 'discord.js';
import yargs from 'yargs';

import { calculateBehold, isValidBehold } from '../utils/beholdcalc';
import { AnalysisResult, analyzeImage } from '../utils/imageanalysis';
import { sendAndCache } from '../utils/discord';

import { Logger } from '../utils';
import { Definitions } from 'src/utils/definitions';

async function asyncHandler(message: Message, url: string, threshold: number, base: boolean) {
	let data: AnalysisResult | undefined = undefined;

	try {
		data = await analyzeImage(url);
	}
	catch (err: any) {
		console.log(err);
		try {
			sendAndCache(message, `Sorry, the behold engine did not understand this submission.`);
		}
		catch { }
		return;
	}

	if (data) {
		Logger.info(`Behold command`, {
			id: message.id,
			analysisResult: data
		});
		if (data.beholdResult && isValidBehold(data.beholdResult, threshold)) {
			await calculateBehold(message, data.beholdResult, true, base);
		} else {
			sendAndCache(message,
				`Sorry, that doesn't appear to be a valid behold; try lowering the threshold with the -t option if you think it should be recognizable. (${data
					.beholdResult!.error || ''})`
			);
		}
	} else {
		sendAndCache(message, `Sorry, I wasn't able to recognize a behold from '${url}'`);
	}
}

class Behold implements Definitions.Command {
	name = 'behold';
	command = 'behold <url>';
	aliases = [];
	describe = 'Analyzes a behold screenshot and returns crew details if identified';
	options = [
		{
			name: 'url',
			type: ApplicationCommandOptionType.String,
			description: 'address of a png or jpg image',
			required: true,
		},
		{
			name: 'threshold',
			type: ApplicationCommandOptionType.Integer,
			description: 'lower the threshold for crew detection; the lower it is, the higher the chance for false positives',
			required: false,
		},
		{
			name: 'base',
			type: ApplicationCommandOptionType.Boolean,
			description: 'ignore user profile if available',
			required: false,
		},
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('url', {
				describe: 'address of a png or jpg image'
			})
			.option('threshold', {
				alias: 't',
				desc: 'lower the threshold for crew detection; the lower it is, the higher the chance for false positives',
				default: 10,
				type: 'number'
			})
			.option('base', {
				alias: 'b',
				desc: 'ignore user profile if available',
				type: 'boolean'
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let url = <string>args.url;
		let threshold = <number>args.threshold;

		args.promisedResult = asyncHandler(message, url, threshold, args.base ? (args.base as boolean) : false);
	}
}

export let BeholdCommand = new Behold();
