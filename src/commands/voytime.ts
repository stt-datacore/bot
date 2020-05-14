import { Message } from 'discord.js';
import yargs from 'yargs';

import { voyCalc, formatVoyageReply } from '../utils/voyage';
import { sendAndCache } from '../utils/discord';

class VoyTime implements Definitions.Command {
	name = 'voytime';
	command = 'voytime <primary> <secondary> <skill3> <skill4> <skill5> <skill6> [antimmatter]';
	aliases = [];
	describe = 'Estimates the length of a voyage';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('primary', {
				describe: 'value of the primary skill',
				type: 'number'
			})
			.positional('secondary', {
				describe: 'value of the secondary skill',
				type: 'number'
			})
			.positional('skill3', {
				describe: 'value of a tertiary skill',
				type: 'number'
			})
			.positional('skill4', {
				describe: 'value of a tertiary skill',
				type: 'number'
			})
			.positional('skill5', {
				describe: 'value of a tertiary skill',
				type: 'number'
			})
			.positional('skill6', {
				describe: 'value of a tertiary skill',
				type: 'number'
			})
			.positional('antimmatter', {
				describe: 'the antimatter (including bonuses) at start of voyage',
				type: 'number',
				default: 2500
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;

		let results = voyCalc(
			args.primary as number,
			args.secondary as number,
			args.skill3 as number,
			args.skill4 as number,
			args.skill5 as number,
			args.skill6 as number,
			args.antimmatter as number
		);

		sendAndCache(
			message,
			formatVoyageReply(message, results)
		);
	}
}

export let VoyTimeCommand = new VoyTime();
