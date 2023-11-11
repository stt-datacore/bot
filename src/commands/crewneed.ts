import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { colorFromRarity } from '../utils/crew';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import { userFromMessage, loadFullProfile } from '../utils/profile';
import { getNeededItems } from '../utils/equipment';
import CONFIG from '../utils/config';

async function asyncHandler(message: Message, searchString: string, level: number, all: boolean, base: boolean, item: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	// if searchString is "favorite" load that from the profile; if "all" use all crew

	let results: Definitions.BotCrew[] | undefined = undefined;

	let loadSpecial = 0;
	if (searchString == 'favorite') {
		loadSpecial = 1;
	} else if (searchString == 'all') {
		loadSpecial = 2;
	} else {
		results = DCData.searchCrew(searchString);
	}

	if (results === undefined && loadSpecial === 0) {
		sendAndCache(message, `Sorry, I couldn't find a crew matching '${searchString}'`, { ephemeral: true});
	} else if (results && results.length > 1) {
		sendAndCache(
			message,
			`There are ${results.length} crew matching that: ${results.map((crew) => crew.name).join(', ')}. Which one did you mean?`,
			{ ephemeral: true}
		);
	} else {
		if (loadSpecial > 0) {
			sendAndCache(message, `NYI`);
		} else if (results === undefined) {
			// TODO: error!
		} else {
			let crew = results[0];

			let embed = new EmbedBuilder()
				.setTitle(`${crew.name} equipment breakdown`)
				.setThumbnail(`${CONFIG.ASSETS_URL}${crew.imageUrlPortrait}`)
				.setColor(colorFromRarity(crew.max_rarity))
				.setURL(`${CONFIG.DATACORE_URL}crew/${crew.symbol}/`);

            let plainTextHeader = `${crew.name} equipment breakdown\n`;

			let pcrew = undefined;
			let items: any[] = [];
			if (!base) {
				let user = await userFromMessage(message);
				// TODO: multiple profiles
				if (user && user.profiles.length > 0) {
					let profileData = await loadFullProfile(user.profiles[0]);
					if (profileData) {
						pcrew = profileData.playerData.player.character.crew.find((c: any) => c.symbol === crew.symbol);
						const captainName = profileData.playerData.player.character.display_name;
						// load items owned by player
						items = profileData.playerData.player.character.items;

						if (pcrew) {
                            if (level === 0) {
                                level = pcrew.level;
                            }

							embed = embed.addFields({
								name: captainName,
								value: `Data is customized for [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0]}), you own a level ${level} ${crew.name}.`
							});
                            
                            plainTextHeader += `${captainName}, data is customized for your profile: you own a level ${level} ${crew.name}.\n`;
						} else {
							embed = embed.addFields({
								name: captainName,
								value: `According to [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0]}), you don't own an unfrozen ${crew.name}; make sure your profile is up-to-date on ${CONFIG.DATACORE_URL}.`
							});
                            
                            plainTextHeader += `${captainName}, according to your profile, you don't own an unfrozen ${crew.name}; make sure your profile is up-to-date on ${CONFIG.DATACORE_URL}.\n`;
						}
					}
				}
			}

			// add equipment breakdown
			let neededItems = getNeededItems(crew.symbol, level);

			let data = neededItems ? neededItems.demands.map((demand) => {
				let item = items.find((i: any) => i.symbol === demand.symbol);
				return {
					name: demand.factionOnly ? `${demand.equipment.name} - Faction` : demand.equipment.name,
					factionOnly: demand.factionOnly,
					rarity: demand.equipment.rarity,
					need: demand.count,
					have: item ? item.quantity : 0,
					symbol: demand.symbol,
					avgChronCost: demand.avgChronCost,
				};
			}) : [];

			if (!all && items.length > 0) {
				// Eliminate needs already owned by player
				data = data.filter((item) => item.need >= item.have);
			}
            
			if (item.length > 0) {
				// Filter to specific item specified in command
				data = data.filter((entry) => entry.name.toLowerCase().includes(item.toLowerCase()));
			}

			let requiredChronCost = Math.round(data.reduce((totalCost, item) => {
				if (item.have >= item.need) {
					return totalCost;
				}
				return totalCost + ((item.need - item.have) * item.avgChronCost);
			}, 0));

			let requiredFactionItems = data.reduce((totalItems, item) => {
				if (!item.factionOnly) {
					return totalItems;
				}
				return totalItems + (item.need - item.have);
			}, 0);

			const formatItemList = (list: any[]) =>
				list
					.map(
						(item) =>
							`[${item.rarity}* ${item.name}](${CONFIG.DATACORE_URL}item_info?symbol=${item.symbol}) (need ${item.need}, have ${item.have})`
					)
					.join(', ');

			const padSpaces = (input: string, len: number) => {
				if (input.length > len) {
					return input.substr(0, len);
				}

				return input.padEnd(len, ' ');
			};

			let breakdown = formatItemList(data);

			let MessageEmbedFits = true;
			// TODO: there must be a smarter way to break these down
			if (breakdown.length < 2) {
                embed = embed.addFields({ name: 'Breakdown', value: `Failed to load data, please see [the website](${CONFIG.DATACORE_URL}crew/${crew.symbol}/).` });
            } else if (breakdown.length < 1024) {
                embed = embed.addFields({ name: 'Breakdown', value: breakdown });
            } else if (breakdown.length < 1800) {
				embed = embed.addFields({ name: 'Breakdown (1 / 2)', value: formatItemList(data.slice(0, data.length / 2)) });
				embed = embed.addFields({ name: 'Breakdown (2 / 2)', value: formatItemList(data.slice(data.length / 2, data.length)) });
			} else if (breakdown.length < 2700) {
				embed = embed.addFields({ name: 'Breakdown (1 / 3)', value: formatItemList(data.slice(0, data.length / 3)) });
				embed = embed.addFields({ name: 'Breakdown (2 / 3)', value: formatItemList(data.slice((1 * data.length) / 3, (2 * data.length) / 3)) });
				embed = embed.addFields({ name: 'Breakdown (3 / 3)', value: formatItemList(data.slice((2 * data.length) / 3, data.length)) });
			} else if (breakdown.length < 3600) {
				embed = embed.addFields({ name: 'Breakdown (1 / 4)', value: formatItemList(data.slice(0, data.length / 4)) });
				embed = embed.addFields({ name: 'Breakdown (2 / 4)', value: formatItemList(data.slice((1 * data.length) / 4, (2 * data.length) / 4)) });
				embed = embed.addFields({ name: 'Breakdown (3 / 4)', value: formatItemList(data.slice((2 * data.length) / 4, (3 * data.length) / 4)) });
				embed = embed.addFields({ name: 'Breakdown (4 / 4)', value: formatItemList(data.slice((3 * data.length) / 4, data.length)) });
			} else if (breakdown.length < 4500) {
				embed = embed.addFields({ name: 'Breakdown (1 / 5)', value: formatItemList(data.slice(0, data.length / 5)) });
				embed = embed.addFields({ name: 'Breakdown (2 / 5)', value: formatItemList(data.slice((1 * data.length) / 5, (2 * data.length) / 5)) });
				embed = embed.addFields({ name: 'Breakdown (3 / 5)', value: formatItemList(data.slice((2 * data.length) / 5, (3 * data.length) / 5)) });
                embed = embed.addFields({ name: 'Breakdown (4 / 5)', value: formatItemList(data.slice((3 * data.length) / 5, (4 * data.length) / 5)) });
                embed = embed.addFields({ name: 'Breakdown (5 / 5)', value: formatItemList(data.slice((4 * data.length) / 5, data.length)) });
			} else {
				// Nothing fits, fallback to a plain text output
				MessageEmbedFits = false;

				let parts = [];
                let currentPart = plainTextHeader;
                currentPart += '| Item                                     | Need | Have |\n';
				currentPart += '+------------------------------------------+------+------+\n';

				data.forEach((item) => {
					let line = `| ${padSpaces(`${item.rarity}* ${item.name}`, 40)} | ${padSpaces(item.need.toString(), 4)} | ${padSpaces(item.have.toString(), 4)} |\n`;
					if (currentPart.length + line.length > 1990) {
						parts.push(currentPart);
						currentPart = `${crew.name} equipment breakdown (part ${parts.length + 1})\n` + line;
					} else {
						currentPart += line;
					}
                });

                currentPart += `Estimated Cost: ${neededItems ? neededItems.craftCost : 'N/A'} credits, ${requiredChronCost} chrons, ${requiredFactionItems} faction items`;

				parts.push(currentPart);

				parts.forEach((msg) => {
					sendAndCache(message, '`' + msg.trim() + '`');
				});
			}

			if (MessageEmbedFits) {
				embed = embed.addFields({
					name: 'Estimated Cost',
					value:`${neededItems ? neededItems.craftCost : 'N/A'} credits, ${requiredChronCost} ${getEmoteOrString(message, 'chrons', 'chrons')}, ${requiredFactionItems} faction items`,
					inline: true
				});

				sendAndCache(message, '', {embeds: [embed]});
			}
		}
	}
}

class CrewNeed implements Definitions.Command {
	name = 'crewneed';
	command = 'crewneed <crew...>';
	aliases = ['need'];
	describe = 'Shows a breakdown of items needed to craft equipment for a crew';
	options = [
		{
			name: 'crew',
			type: ApplicationCommandOptionType.String,
			description: 'name of crew or part of the name',
			required: true,
		},
		{
			name: 'level',
			type: ApplicationCommandOptionType.Integer,
			description: 'starting level',
			required: false,
		},
		{
			name: 'item',
			type: ApplicationCommandOptionType.String,
			description: 'filter to specific items',
			required: false,
		},
		{
			name: 'all',
			type: ApplicationCommandOptionType.Boolean,
			description: 'expand the entire recipe (including owned items)',
			required: false,
		},
		{
			name: 'base',
			type: ApplicationCommandOptionType.Boolean,
			description: 'return common stats (not adjusted for your profile)',
			required: false,
		}
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('crew', {
				describe: 'name of crew or part of the name',
			})
			.option('level', {
				alias: 'l',
				desc: 'starting level',
				type: 'number',
				default: 0,
			})
			.option('item', {
				desc: 'filter to specific items',
				type: 'string',
			})
			.option('all', {
				alias: 'a',
				desc: 'expand the entire recipe tree (including owned items)',
				type: 'boolean',
			})
			.option('base', {
				alias: 'b',
				desc: 'return common stats (not adjusted for your profile)',
				type: 'boolean',
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let searchString = typeof(args.crew) === 'string' ? args.crew : (<string[]>args.crew).join(' ');
		let level = args.level ? (args.level as number) : 0;
		let all = args.all ? (args.all as boolean) : false;
		let base = args.base ? (args.base as boolean) : false;
		let item = args.item ? (args.item as string) : '';

		args.promisedResult = asyncHandler(message, searchString, level, all, base, item);
	}
}

export let CrewNeedCommand = new CrewNeed();
