import { Message, RichEmbed } from 'discord.js';
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
import { sendAndCache, deleteOldReplies } from '../utils/discord';
import { DCData } from '../data/DCData';
import { FACTIONS } from '../utils/factions';

require('dotenv').config();

const MAX_CREW = 10;

function eventCrewFormat(entry: ProfileRosterEntry, profileData: any): string {
	let pcrew = profileData.player.character.crew.find((crew: any) => crew.symbol === entry.crew.symbol);

	if (!pcrew) {
		return `**${entry.crew.name}** (🥶)`;
	} else {
		if (entry.rarity === entry.crew.max_rarity && pcrew.level === 100 && pcrew.equipment.length === 4) {
			return `**${entry.crew.name}** (FF/FE)`;
		} else {
			return `**${entry.crew.name}** (L${pcrew.level} ${entry.rarity}/${entry.crew.max_rarity})`;
		}
	}
}

async function asyncHandler(message: Message, guildConfig?: Definitions.GuildConfig, verb?: string, text?: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise((resolve) => setImmediate(() => resolve()));

	let user = await userFromMessage(message);

	if (!user || !user.profiles || user.profiles.length < 1) {
		sendAndCache(
			message,
			`You don't currently have a profile set up. Upload your profile at ${CONFIG.DATACORE_URL}voyage and use the **associate** command to link it.`
		);
	} else {
		let defaultReply = true;
		if (verb && verb.toLowerCase() === 'refresh') {
			let profile = user.profiles[0];
			if (profile.sttAccessToken) {
				let playerData = await refreshProfile(profile.sttAccessToken);
				if (playerData && !playerData.error) {
					let replicator_uses_left = playerData.player.replicator_limit - playerData.player.replicator_uses_today;
					let cadet_tickets_remaining = playerData.player.character.cadet_tickets.current;

					let items_below_limit = playerData.player.character.item_limit - playerData.player.character.items.length;

					let unused_shuttles = playerData.player.character.shuttle_bays - playerData.player.character.shuttle_adventures.length;

					let no_voyage_running = playerData.player.character.voyage.length === 0;

					let recommendations = [' your profile was succesfully refreshed; wait a few minutes for things to load and refresh everywhere'];

					if (replicator_uses_left > 0) {
						recommendations.push(`You have ${replicator_uses_left} replicator uses left for today`);
					}

					if (cadet_tickets_remaining > 0) {
						recommendations.push(`You have ${cadet_tickets_remaining} cadet tickets unused today`);
					}

					if (items_below_limit < 100) {
						recommendations.push(`You have ${playerData.player.character.items.length} items; use or throw out a few`);
					}

					if (unused_shuttles > 0) {
						recommendations.push(`You have ${unused_shuttles} shuttles currently unused`);
					}

					if (no_voyage_running) {
						recommendations.push("You don't have a voyage running; send one out to collect rewards");
					}

					message.reply(recommendations.join('. '));
				} else {
					message.reply(` your profile could not be refreshed; contact the bot owner for help (${playerData ? playerData.error : ''})`);
				}
				defaultReply = false;
			}
		}

		if (verb && verb.toLowerCase() === 'fleet') {
			if (guildConfig && guildConfig.fleetids && guildConfig.fleetids.length > 0) {
				for (let fleetId of guildConfig.fleetids) {
					let fleet = await loadFleet(fleetId);

					let imageUrl = 'icons_icon_faction_starfleet.png';
					if (FACTIONS[fleet.nicon_index]) {
						imageUrl = FACTIONS[fleet.nicon_index].icon;
					}

					let members: string[] = fleet.members.map((member: any) =>
						member.last_update ? `[${member.display_name}](${CONFIG.DATACORE_URL}/profile?dbid=${member.dbid})` : member.display_name
					);

					let memberFields = [''];
					members.forEach((line) => {
						if (memberFields[memberFields.length - 1].length + line.length < 1020) {
							if (memberFields[memberFields.length - 1].length === 0) {
								memberFields[memberFields.length - 1] = line;
							} else {
								memberFields[memberFields.length - 1] += ', ' + line;
							}
						} else {
							memberFields.push(line);
						}
					});

					let embed = new RichEmbed()
						.setTitle(fleet.name)
						.setURL(`${CONFIG.DATACORE_URL}fleet_info/?fleetid=${fleetId}`)
						.setThumbnail(`${CONFIG.ASSETS_URL}${imageUrl}`)
						.setColor('DARK_GREEN')
						.addField('Starbase level', fleet.nstarbase_level, true)
						.addField('Created', new Date(fleet.created).toLocaleDateString(), true)
						.addField('Size', `${fleet.cursize} / ${fleet.maxsize}`, true);

					if (fleet.motd) {
						embed = embed.addField('MOTD', fleet.motd);
					}

					embed = embed
						.addField(fleet.leaderboard[0].event_name, `Rank ${fleet.leaderboard[0].fleet_rank}`, true)
						.addField(fleet.leaderboard[1].event_name, `Rank ${fleet.leaderboard[1].fleet_rank}`, true)
						.addField(fleet.leaderboard[2].event_name, `Rank ${fleet.leaderboard[2].fleet_rank}`, true)
						.addField('Member list', memberFields[0]);

					if (memberFields.length > 0) {
						embed = embed.addField('Member list (continued)', memberFields[1]);
					}

					sendAndCache(message, embed);
				}
			} else {
				message.reply(' this command only works in fleet discord servers!');
			}

			defaultReply = false;
		}

		let eventReply = verb && verb.toLowerCase().trim() === 'event';

		if (defaultReply) {
			for (let profile of user.profiles) {
				let profileData = loadFullProfile(profile.dbid);
				if (profileData) {
					let embed = new RichEmbed().setTitle(profile.captainName).setColor('DARK_GREEN');

					if (eventReply) {
						embed = embed
							.addField('Last update', profile.lastUpdate.toDateString(), true)
							.addField('Stats', `VIP${profileData.player.vip_level}; Level ${profileData.player.character.level}`, true);
					} else {
						embed = embed
							.setURL(`${CONFIG.DATACORE_URL}profile/?dbid=${profile.dbid}`)
							.addField('Last update', profile.lastUpdate.toDateString())
							.addField('VIP', profileData.player.vip_level, true)
							.addField('Level', profileData.player.character.level, true);
					}

					embed = embed.addField('Shuttles', profileData.player.character.shuttle_bays, true);

					if (profileData.player.character.crew_avatar && profileData.player.character.crew_avatar.portrait) {
						embed = embed.setThumbnail(`${CONFIG.DATACORE_URL}media/assets/${profileData.player.character.crew_avatar.portrait}`);
					}

					if (eventReply) {
						let event = DCData.getUpcomingEvents().slice(-1)[0];
						if (event.endDate < new Date()) {
							// TODO: No data for upcoming event, error out
						}

						let profile = await loadProfile(user.profiles[0].dbid);
						let roster = loadProfileRoster(profile);

						let highbonus = roster.filter((entry) => event.highbonus.includes(entry.crew.symbol));
						let smallbonus = roster.filter((entry) =>
							event.smallbonus.traits.some((trait) => entry.crew.traits_named.includes(trait) || entry.crew.traits_hidden.includes(trait))
						);

						smallbonus.sort((a, b) => b.voyageScore - a.voyageScore);

						// Remove from smallbonus the highbonus crew
						smallbonus = smallbonus.filter((entry) => !highbonus.includes(entry));

						let reply = `Event ending on *${event.endDate.toDateString()}*\n\nHigh bonus crew: ${
							highbonus.length === 0 ? 'NONE' : highbonus.map((entry) => eventCrewFormat(entry, profileData)).join(', ')
						}\n\n`;
						reply += `Small bonus crew: ${
							smallbonus.length === 0
								? 'NONE'
								: smallbonus
										.slice(0, MAX_CREW)
										.map((entry) => eventCrewFormat(entry, profileData))
										.join(', ')
						}${smallbonus.length > MAX_CREW ? ` and ${smallbonus.length - MAX_CREW} more` : ''}\n`;

						//embed = embed.addField('Total crew', roster.length, true);
						embed = embed.addField(`**${event.name}** (${event.type})`, reply); // ending on *${event.endDate.toDateString()}*
					}

					if (text) {
						embed = embed.addField('Other details', text);

						// TODO: save this for the fleet admiral's report view
						// userId, eventId, eventGoals, ? eventCrew
					}

					if (!eventReply && profileData.player.fleet && profileData.player.fleet.id) {
						embed = embed.addField(
							'Fleet',
							`[${profileData.player.fleet.slabel}](${CONFIG.DATACORE_URL}fleet_info?fleetid=${profileData.player.fleet.id})`
						);
					}

					if (eventReply) {
						await deleteOldReplies(message, profile.captainName);
					}

					sendAndCache(message, embed);
				}
			}
		}
	}
}

class Profile implements Definitions.Command {
	name = 'profile';
	command = 'profile [verb] [text...]';
	aliases = [];
	describe = 'Display a summary of your associated profile';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('verb', {
				describe: 'additional profile actions',
				choices: ['refresh', 'fleet', 'event'],
				type: 'string',
			})
			.positional('text', {
				describe: 'free text you want to include in your event posts',
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let guildConfig = args.guildConfig ? (args.guildConfig as Definitions.GuildConfig) : undefined;

		let verb = args.verb ? (args.verb as string) : undefined;
		let text = args.text ? (args.text as string[]).join(' ') : undefined;

		args.promisedResult = asyncHandler(message, guildConfig, verb, text);
	}
}

export let ProfileCommand = new Profile();
