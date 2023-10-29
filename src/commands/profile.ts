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
	toTimestamp,
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

const MAX_CREW = 10;

function eventCrewFormat(entry: Definitions.BotCrew, profileData: any): string {
	let pcrew = profileData.player.character.crew.find((crew: PlayerCrew) => crew.symbol === entry.symbol);

	if (!pcrew || (pcrew.immortal && pcrew.immortal > 0)) {
		return `**${entry.name}** (🥶)`;
	} else {
		if (pcrew.rarity === entry.max_rarity && pcrew.level === 100 && pcrew.equipment.length === 4) {
			return `**${entry.name}** (FF/FE)`;
		} else {
			return `**${entry.name}** (L${pcrew.level} ${pcrew.rarity}/${entry.max_rarity})`;
		}
	}
}

async function asyncHandler(message: Message, guildConfig?: Definitions.GuildConfig, verb?: string, text?: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let user = await userFromMessage(message);

	if (!user || !user.profiles || user.profiles.length < 1) {
		sendAndCache(
			message,
			`You don't currently have a profile set up. Upload your profile at ${CONFIG.DATACORE_URL}voyage and use the **associate** command to link it.`
		);
	} else {
		let defaultReply = true;
		if (verb && verb.toLowerCase() === 'refresh') {
			let profile = await getProfile(user.profiles[0]);
			if (profile?.sttAccessToken) {
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
			} else {
				message.reply(` your profile is not set up for automatic refreshes; manually re-upload the profile on the website`);
			}

			defaultReply = false;
		}

		if (verb && (verb.toLowerCase() === 'fleet' || verb.toLowerCase() === 'daily')) {
			if (guildConfig && guildConfig.fleetids && guildConfig.fleetids.length > 0) {
				for (let fleetId of guildConfig.fleetids) {
					let fleet = await loadFleet(fleetId);

					if (verb.toLowerCase() === 'daily') {
						let textMessage = '```\n';
						textMessage += `${fleet.name} 🧿 Starbase level ${fleet.nstarbase_level} 🧿 Created ${new Date(fleet.created).toLocaleDateString()} 🧿 Size ${fleet.cursize} / ${fleet.maxsize}\n`;
						textMessage += `${fleet.leaderboard[0].event_name}: rank ${fleet.leaderboard[0].fleet_rank} 🏆 ${fleet.leaderboard[1].event_name}: rank ${fleet.leaderboard[1].fleet_rank} 🏆 ${fleet.leaderboard[2].event_name}: rank ${fleet.leaderboard[2].fleet_rank}\n`;

						let memberList = fleet.members.sort((a: any, b: any) => (a.daily_activity - b.daily_activity) || (b.last_active - a.last_active)).map((m: any) => ({
							name: (m.last_active > (3600 * 24)) ? `${m.display_name} (INACTIVE)` : m.display_name,
							level: m.level,
							event_rank: m.event_rank,
							daily_activity: (m.daily_activity > 82) ? `${m.daily_activity}` : `${m.daily_activity} 👋`
						}));
						textMessage += configure({ maxTotalWidth: 100, delimiter: ' | ' })(memberList);

						textMessage += '\n```';

						sendSplitText(message, textMessage);
					} else {
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

						let embed = new EmbedBuilder()
							.setTitle(fleet.name)
							.setURL(`${CONFIG.DATACORE_URL}fleet_info/?fleetid=${fleetId}`)
							.setThumbnail(`${CONFIG.ASSETS_URL}${imageUrl}`)
							.setColor('DarkGreen')
							.addFields({ name: 'Starbase level', value: fleet.nstarbase_level.toString(), inline: true })
							.addFields({ name: 'Created', value: new Date(fleet.created).toLocaleDateString(), inline: true })
							.addFields({ name: 'Size', value: `${fleet.cursize} / ${fleet.maxsize}`, inline: true });

						if (fleet.motd) {
							embed = embed.addFields({ name: 'MOTD', value: fleet.motd });;
						}

						embed = embed
							.addFields({ name: fleet.leaderboard[0].event_name, value: `Rank ${fleet.leaderboard[0].fleet_rank}`, inline: true })
							.addFields({ name: fleet.leaderboard[1].event_name, value: `Rank ${fleet.leaderboard[1].fleet_rank}`, inline: true })
							.addFields({ name: fleet.leaderboard[2].event_name, value: `Rank ${fleet.leaderboard[2].fleet_rank}`, inline: true })
							.addFields({ name: 'Member list', value: memberFields[0] });

						if (memberFields.length > 0) {
							embed = embed.addFields({ name: 'Member list (continued)', value: memberFields[1] });;
						}

						sendAndCache(message, '', {embeds: [embed]});
					}
				}
			} else {
				message.reply(' this command only works in fleet discord servers!');
			}

			defaultReply = false;
		}

		let eventReply = verb && verb.toLowerCase().trim() === 'event';

		if (defaultReply) {
			try {
				
				let embeds = [] as EmbedBuilder[];
				
				for (let profileID of user.profiles) {
					let profileStore = await loadFullProfile(profileID);
					if (profileStore) {
						let profileData = profileStore.playerData;
						let captainName = profileData.player.character.display_name;
						let lastModified = profileStore.timeStamp;

						let embed = new EmbedBuilder().setTitle(captainName).setColor('DarkGreen');
	
						if (eventReply) {
							embed = embed
								.addFields(
									{ name: 'Last update', value: toTimestamp(lastModified), inline: true },
									{ name: 'Stats', value: `VIP${profileData.player.vip_level}; Level ${profileData.player.character.level}`, inline: true }
								);
						} else {
							embed = embed
								.setURL(`${CONFIG.DATACORE_URL}profile?dbid=${profileID}`)
								.addFields(
									{ name: 'Last update', value: toTimestamp(lastModified) },
									{ name: 'VIP', value: profileData.player.vip_level.toString(), inline: true },
									{ name: 'Level', value: profileData.player.character.level.toString(), inline: true }
								);
							}
	
						embed = embed.addFields({ name: 'Shuttles', value: profileData.player.character.shuttle_bays.toString(), inline: true });
	
						if (profileData.player.character.crew_avatar && profileData.player.character.crew_avatar?.portrait?.file) {
							embed = embed.setThumbnail(`${CONFIG.ASSETS_URL}${profileData.player.character.crew_avatar.portrait.file}`);
						}
	
						if (eventReply) {
							let event = DCData.getEvents()[0];
							let allCrew = DCData.getBotCrew();

							if (event.startDate && event.startDate < new Date()) {
								// TODO: No data for upcoming event, error out
							}
	
							let profile = await loadProfile(user.profiles[0]);
							let roster = loadProfileRoster(profile);
	
							let highbonus = (profileData as PlayerData).player.character.crew.filter((entry) => event.featured.includes(entry.symbol)).map(crew1 => allCrew.find(crew2 => crew2.symbol === crew1.symbol));
							let smallbonus = (profileData as PlayerData).player.character.crew.filter((entry) => 							
								event.bonus.includes(entry.symbol)
							).map(crew1 => allCrew.find(crew2 => crew2.symbol === crew1.symbol));
	
							smallbonus.sort((a, b) => (a?.ranks.voyRank ?? 0) - (b?.ranks.voyRank ?? 0));
	
							// Remove from smallbonus the highbonus crew
							smallbonus = smallbonus.filter((entry) => !highbonus.includes(entry));
							event.endDate ??= new Date();
							let reply = `Event ending on *${toTimestamp(event.endDate)}*\n\nHigh bonus crew: ${
								highbonus.length === 0 ? 'NONE' : highbonus.map((entry) => entry ? eventCrewFormat(entry, profileData) : '').join(', ')
							}\n\n`;
							reply += `Small bonus crew: ${
								smallbonus.length === 0
									? 'NONE'
									: smallbonus
											.slice(0, MAX_CREW)
											.map((entry) => entry ? eventCrewFormat(entry, profileData) : '') 
											.join(', ')
							}${smallbonus.length > MAX_CREW ? ` and ${smallbonus.length - MAX_CREW} more` : ''}\n`;

							embed = embed.addFields({name: `**${event.name}** (${event.type})`, value: reply });
						}
	
						if (text) {
							embed = embed.addFields({ name: 'Other details', value: text });
						}
	
						if (!eventReply && profileData.player.fleet && profileData.player.fleet.id) {
							embed = embed.addFields({
								name: 'Fleet',
								value: `[${profileData.player.fleet.slabel}](${CONFIG.DATACORE_URL}fleet_info?fleetid=${profileData.player.fleet.id})`
							});
						}
	
						// if (eventReply) {
						// 	await deleteOldReplies(message, captainName);
						// }
	
						embeds.push(embed);
					}
				}

				sendAndCache(message, '', { embeds });
			}
			catch (err: any) {
				console.log(err);
				message.reply("Sorry, we ran into an error and couldn't process your request. Try again later.");
			}
		}
	}
}

class Profile implements Definitions.Command {
	name = 'profile';
	command = 'profile [verb] [text...]';
	aliases = [];
	describe = 'Display a summary of your associated profile';
	options = [
		{
			name: 'verb',
			type: ApplicationCommandOptionType.String,
			description: 'additional profile actions',
			required: false,
			choices: [
				{ name: 'Fleet', value: 'fleet' },
				{ name: 'Daily', value: 'daily' },
				{ name: 'Event', value: 'event' }
			]
		}
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('verb', {
				describe: 'additional profile actions',
				choices: ['refresh', 'fleet', 'daily', 'event'],
				type: 'string',
			})
			.positional('text', {
				describe: 'text or additional input'
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
