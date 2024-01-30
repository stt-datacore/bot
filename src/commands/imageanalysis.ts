import { Message } from 'discord.js';

import { analyzeImage, getVoyParams } from '../utils/imageanalysis';
import { calculateBehold, isValidBehold, isPossibleBehold } from '../utils/beholdcalc';
import { voyCalc, formatVoyageReply } from '../utils/voyage';
import { sendAndCache } from '../utils/discord';

import { Logger } from '../utils';

export async function runImageAnalysis(message: Message, url: string, usedPrefix: string) {
	let data = await analyzeImage(url);
	if (data) {
		Logger.info(`Image analysis`, {
			id: message.id,
			author: { id: message.author.id, username: message.author.username },
			guild: message.guild ? message.guild.toString() : 'DM',
			channel: message.channel.toString(),
			analysisResult: data,
		});

		// Might be something usable in here
		if (data.voyResult && data.voyResult.valid) {
			let params = getVoyParams(data.voyResult);
			let results = voyCalc(params[0], params[1], params[2], params[3], params[4], params[5], data.voyResult.antimatter);

			sendAndCache(
				message,
				`${formatVoyageReply(
					message,
					results
				)}\nIf I got the numbers wrong, fix them and rerun the command with \`${usedPrefix} voytime ${params.join(' ')} ${
					data.voyResult.antimatter
				}\``
			);
		} else if (data.beholdResult && isPossibleBehold(data.beholdResult, 5)) {
			if (isValidBehold(data.beholdResult, 5)) {
				await calculateBehold(message, data.beholdResult, false, false);
			} else{
				sendAndCache(
					message,
					"Sorry, the image appears to be a behold, but the crew or ships cannot be identified. " +
					"This can be caused by lighting effects or background fuzzyness in the game, but there are some limitations related to low-height crew. " +
					"Please try submitting another screenshot."
				);
			}
		}
	}
}
