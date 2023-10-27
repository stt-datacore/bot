import fs from 'fs';
import { ApplicationCommandOptionType, Message } from 'discord.js';
import yargs from 'yargs';
import { loadProfile, createUserFromMessage, associateUser, getDbidFromDiscord, loadRemoteProfile } from '../utils/profile';
import { discordUserFromMessage, sendAndCache } from '../utils/discord';
import { User as MongoUser } from '../mongoModels/mongoUser';
import CONFIG from '../utils/config';
import { getProfile, postOrPutProfile } from '../utils/mongoUser';

async function asyncHandler(message: Message, dbid: string, devpull: boolean, access_token?: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let user = await createUserFromMessage(message);
	if (!user) {
		sendAndCache(
			message,
			`Sorry, having trouble creating users, right now (database down?)`
		);
	}

	if (devpull || process.env.DEV_PULL_ALWAYS?.toString() === '1'){
		if (process.env.NODE_ENV === 'production') {
			sendAndCache(message, `This is a dev-only command.`, {asReply: true, ephemeral: true});
			return;
		}
		dbid = await downloadProfile(message, dbid);
		if (!dbid)
			return;
	}

	let result = await associateUser(user as MongoUser, dbid, access_token);
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
				{asReply: true}
			);
		}
	}
}

async function downloadProfile(message: Message, dbid: string) {
	let author = discordUserFromMessage(message);
	if (isNaN(Number(dbid)))
		dbid = await getDbidFromDiscord(author!.username, author!.discriminator);
		if (!dbid) {
			sendAndCache(message, `Sorry, I couldn't find a DBID associated with your Discord username ${author?.username}#${author?.discriminator}. Please manually enter your DBID.`)
			throw(`Unable to find a DBID for Discord username ${author?.username}#${author?.discriminator}`);
		}
	let player_data = await loadRemoteProfile(dbid);
	fs.writeFileSync(process.env.PROFILE_DATA_PATH + dbid, JSON.stringify(player_data, undefined, 4), 'utf8');
	
	let captainName = player_data.player.character.display_name;

	let shortCrewList = {
		crew: player_data.player.character.crew.map((crew: any) => ({ id: crew.archetype_id, rarity: crew.rarity })),
		c_stored_immortals: player_data.player.character.c_stored_immortals,
		stored_immortals: player_data.player.character.stored_immortals
	};

	await postOrPutProfile(Number.parseInt(dbid), player_data);

	return dbid;
}

class Associate implements Definitions.Command {
	name = 'associate';
	command = 'associate <dbid> [test]';
	aliases = [];
	describe = 'Associate your discord user with a previously uploaded profile DBID';
	options = [
		{
			name: 'dbid',
			type: ApplicationCommandOptionType.String,
			description: 'your DBID',
			required: true
		}
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('dbid', {
				describe: 'your DBID',
				type: 'string'
			})
			.positional('test', {
				describe: 'UNUSED',
				type: 'string'
			})
			.option('dev', {
				desc: '(DEV ONLY) Pull your profile from the Datacore.app.',
				type: 'boolean',
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;

		args.promisedResult = asyncHandler(
			message,
			args.dbid as string,
			args.dev as boolean,
			args.test ? (args.test as string) : undefined,
		);
	}
}

export let AssociateCommand = new Associate();



