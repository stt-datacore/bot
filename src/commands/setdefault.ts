import { Message, EmbedBuilder, ApplicationCommandOptionType, EmbedAssertions } from 'discord.js';
import yargs from 'yargs';
import {
	userFromMessage,
	refreshProfile,
	loadProfileRoster,
	loadProfile,
	ProfileRosterEntry,
	loadFleet,
	loadFullProfile,
} from '../utils/profile';
import CONFIG from '../utils/config';
import { sendAndCache, sendSplitText, deleteOldReplies } from '../utils/discord';
import { DCData } from '../data/DCData';
import { FACTIONS } from '../utils/factions';

import { configure } from 'as-table';
import { PlayerCrew, PlayerData } from '../datacore/player';
import { getProfile, mongoUpsertDiscordUser } from '../utils/mongoUser';
import { PlayerProfile } from 'src/mongoModels/playerProfile';

require('dotenv').config();

async function asyncHandler(message: Message, guildConfig?: Definitions.GuildConfig, profileName?: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let user = await userFromMessage(message);

	if (!user || !user.profiles || user.profiles.length < 1) {
		sendAndCache(
			message,
			`You don't currently have a profile set up. Upload your profile at ${CONFIG.DATACORE_URL}voyage and use the **associate** command to link it.`
		);
	} else {
		if (profileName) {
			let profiles = [] as PlayerProfile[];
			for (let dbid of user.profiles) {
				let profile = await getProfile(dbid);
				if (profile) profiles.push(profile);
			}
			
			let text = profileName.toLowerCase().trim();			
			let pf = profiles.find(p => p.playerData.player.character.display_name.toLowerCase().trim().includes(text as string));
            if (!pf) {
                pf = profiles.find(p => p.playerData.player.dbid.toString() === profileName.toString());
            }
			if (pf) {
				user.profiles = [pf.dbid].concat(user.profiles.filter(dbid => dbid !== pf?.dbid));

				await mongoUpsertDiscordUser(user);				
				sendAndCache(
					message,
					`Your default profile has been updated to '${pf.captainName}'.`
				);		

                return;
			}			
		}

        sendAndCache(
            message,
            `Sorry, couldn't find what you were looking for.`
        );		
	}
}

class SetDefaultProfile implements Definitions.Command {
	name = 'setdefault';
	command = 'setdefault <profile name>' 
	aliases = [];
	describe = 'Set your default player profile';
	options = [
		{
			name: 'profile',
			type: ApplicationCommandOptionType.String,
			description: 'Profile name or DBID',
			required: true
        }
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('profile', {
				describe: 'Profile name or DBID',
				type: 'string'
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let guildConfig = args.guildConfig ? (args.guildConfig as Definitions.GuildConfig) : undefined;

		let verb = args.profile ? (args.profile as string) : undefined;		
		args.promisedResult = asyncHandler(message, guildConfig, verb);
	}
}

export let SetDefaultCommand = new SetDefaultProfile();
