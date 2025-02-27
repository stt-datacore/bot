import { Message } from 'discord.js';
import yargs from 'yargs';

import { sendAndCache } from '../utils/discord';
import { Definitions } from '../utils/definitions';


async function asyncHandler(
	message: Message,
) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	sendAndCache(message, `Pong!`, {ephemeral: true});
}

class Ping implements Definitions.Command {
	name = 'ping';
	command = 'ping';
	aliases = [];
	describe = 'Check if the bot is up';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp;
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		args.promisedResult = asyncHandler(message);
	}
}

export let PingCommand = new Ping();
