import { Message } from 'discord.js';
import yargs from 'yargs';
import { loadProfile, createUserFromMessage, associateUser } from '../utils/profile';
import { sendAndCache } from '../utils/discord';
import CONFIG from '../utils/config';

async function asyncHandler(message: Message, dbid: string, access_token?: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise(resolve => setImmediate(() => resolve()));

	let user = await createUserFromMessage(message);
	let result = await associateUser(user, dbid, access_token);
	if (result.error) {
		sendAndCache(message, `Error: ${result.error}`);
	} else {
		let profile = await loadProfile(dbid);
		if (!profile) {
			sendAndCache(
				message,
				`Sorry, I couldn't find a profile for DBID '${dbid}'. Make sure you uploaded the profile for the correct account at ${CONFIG.DATACORE_URL}voyage.`
			);
		} else {
			sendAndCache(
				message,
				` I associated you with the captain profile '${profile.captainName}'. Remember to regularly update your profile online for accurate results!`,
				true
			);
		}
	}
}

class Associate implements Definitions.Command {
	name = 'associate';
	command = 'associate <dbid> [test]';
	aliases = [];
	describe = 'Associate your discord user with a previously uploaded profile DBID';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('dbid', {
				describe: 'your DBID',
				type: 'string'
			})
			.positional('test', {
				describe: 'UNUSED',
				type: 'string'
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;

		args.promisedResult = asyncHandler(
			message,
			args.dbid as string,
			args.test ? (args.test as string) : undefined
		);
	}
}

export let AssociateCommand = new Associate();
