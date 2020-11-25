import { Message } from 'discord.js';
import yargs from 'yargs';
import { userFromMessage, clearUser } from '../utils/profile';
import { sendAndCache } from '../utils/discord';

async function asyncHandler(message: Message) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let user = await userFromMessage(message);

	if (!user || user.profiles.length === 0) {
		sendAndCache(message, ` Your user was never associated with a profile (DBID) so you're all good`, true);
	} else {
		let dbids = await clearUser(user);
		sendAndCache(message, ` Profiles (DBIDs ${dbids.join(', ')}) were dis-associated from your user, all good.`, true);
	}
}

class ResetProfile implements Definitions.Command {
	name = 'resetprofile';
	command = 'resetprofile';
	aliases = [];
	describe = 'Remove any associations between your discord user and any profiles (DBIDs)';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp;
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;

		args.promisedResult = asyncHandler(message);
	}
}

export let ResetProfileCommand = new ResetProfile();
