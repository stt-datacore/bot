import { Message, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';
import {
	userFromMessage, loadFullProfile
} from '../utils/profile';
import CONFIG from '../utils/config';
import { sendAndCache } from '../utils/discord';

import { PlayerData } from '../datacore/player';
import { Profile } from '../models/Profile';

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
		return;
	} else {
		if (profileName) {
			let profiles = [] as PlayerData[];
			let profs = [] as Profile[];
			for (let uprof of user.profiles) {
				let profile = loadFullProfile(uprof.dbid);
				if (profile) {
					profiles.push(profile);
					profs.push(uprof);
				}

			}
			
			let text = profileName.toLowerCase().trim();			
			let pf = profiles.find(p => p.player.character.display_name.toLowerCase().trim().includes(text as string));
            if (!pf) {
                pf = profiles.find(p => p.player.dbid.toString() === profileName.toString());
            }
			if (pf) {
				let captainName = pf.player.character.display_name;
				let newDefault = profs.find(p => p.captainName === captainName);
				if (!newDefault) {
					sendAndCache(
						message,
						`Sorry, couldn't find what you were looking for.`
					);
					return;
				}

				newDefault.sttAccessToken = "default";
				newDefault.save();
				profs.forEach((prof) => {
					if (prof.captainName !== newDefault?.captainName) {
						prof.sttAccessToken = "";
						prof.save();
					}
				})
				
				sendAndCache(
					message,
					`Your default profile has been updated to '${captainName}'.`
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
	aliases = ['use'];
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

		let verb = (args.profile as string) ?? (args.profilename as string);
		args.promisedResult = asyncHandler(message, guildConfig, verb);
	}
}

export let SetDefaultCommand = new SetDefaultProfile();
