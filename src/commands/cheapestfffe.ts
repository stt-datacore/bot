import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { formatSources, formatRecipe } from '../utils/items';
import { colorFromRarity, formatCollectionName } from '../utils/crew';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import CONFIG from '../utils/config';
import { loadFullProfile, userFromMessage } from '../utils/profile';
import { getNeededItems } from '../utils/equipment';

function bonusName(bonus: string) {
	let cfg = CONFIG.STATS_CONFIG[Number.parseInt(bonus)];
	if (cfg) {
		return `${CONFIG.SKILLS[cfg.skill as Definitions.SkillName]} ${cfg.stat}`;
	} else {
		return `*unknown (${bonus})*`;
	}
}

async function asyncHandler(
	message: Message,
	fuse?: string
) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let user = await userFromMessage(message);
	let profile = user?.profiles[0] ? loadFullProfile(user.profiles[0].dbid) : null;
	if (!user || !profile) {
		sendAndCache(message, "Sorry, I couldn't find an associated profile for your user.")
		return;
	}

	let crew = DCData.getBotCrew();
	let profileCrew = profile.player.character.crew;
	let profileItems = profile.player.character.items;
	let candidatesForImmortalisation = profileCrew.filter((c: any) => {
		if (c.level === 100) {
			// let needed = getNeededItems(c.symbol, c.level);
			// if (!needed) {
			// 	return false;
			// }
			// return true;
			return false;
		}
		
		let fuses = ['one', 'two', 'three', 'four', 'five'];

		if (!fuse) {		
			if (c.rarity === crew.find((d) => d.symbol === c.symbol)?.max_rarity) {
				return true;
			}
			else {
				return false;
			}
		}

		let fnum = 0;

		if (typeof fuse === 'number') {
			fnum = fuse;
		}
		else if (fuses.includes(fuse)) {			
			fnum = fuses.findIndex(f => f === fuse) + 1;
		}
		else {
			try {
				fnum = Number.parseInt(fuse);
			}
			catch {
				return false;
			}
		}

		if (c.rarity >= (crew.find((d) => d.symbol === c.symbol)?.max_rarity ?? 0) - fnum) {
			return true;
		}
		else {
			return false;
		}
	});

	candidatesForImmortalisation = candidatesForImmortalisation.map((c: any) => {
		let needed = getNeededItems(c.symbol, c.level);
		if (!needed) {
			return c;
		}
		let neededItems = needed.demands;
	
		let requiredChronCost = neededItems.reduce((totalCost, item) => {
			let have = profileItems.find((j: any) => j.symbol === item.symbol)?.quantity || 0;
			let need = item.count;
			if (have >= need) {
				return totalCost;
			}
			return totalCost + ((need - have) * item.avgChronCost);
		}, 0);
	
		let requiredFactionItems = neededItems.reduce((totalItems, item) => {
			let have = profileItems.find((j: any) => j.symbol === item.symbol)?.quantity || 0;
			let need = item.count;
			if (have >= need) {
				return totalItems;
			}
			if (!item.factionOnly) {
				return totalItems;
			}
			return totalItems + (need - have);
		}, 0);
		return {
			...c,
			requiredChronCost,
			requiredFactionItems,
			craftCost: needed.craftCost,
		}
	}).sort((a: any, b: any) => a.requiredChronCost - b.requiredChronCost);


	const embeds = candidatesForImmortalisation.slice(0, 5).map((can: any) => {
		
		const matched = crew.find((crew) => {
			return crew.symbol === can.symbol
		});
		
		if (!matched) {
			return;
		}

		return new EmbedBuilder()
			.setTitle(`${matched.name} (Level ${can.level})`)
			.setDescription(`Missing item costs:`)
			.setThumbnail(`${CONFIG.ASSETS_URL}${matched.imageUrlPortrait}`)
			.setColor(colorFromRarity(matched.max_rarity))
			.addFields(
				{
					name: getEmoteOrString(message, 'chrons', 'Chrons'),
					value: Math.round(can.requiredChronCost).toString(),
					inline: true
				},
				{
					name: getEmoteOrString(message, 'shuttle', 'Faction'),
					value:	`${can.requiredFactionItems} items`,
					inline: true
				},
				{
					name: getEmoteOrString(message, 'credits', 'Credits'),
					value: can.craftCost.toString(),
					inline: true
				},
				{
					name: `${matched.name} is in ${matched.collections.length === 0 ? 'no collections' : `the following collections: `}`,
					value: matched.collections.map(c => formatCollectionName(c)).join(", "),
					inline: true
				}
			)
			//.setFooter({ text: `${matched.name} is in ${matched.collections.length === 0 ? 'no collections' : `the following collections: ${matched.collections.join(', ')}`}` });
	});

	sendAndCache(message, 
				 `Cheapest candidates for immortalisation for **${user.profiles[0].captainName}**'s roster (last updated ${user.profiles[0].lastUpdate.toDateString()})`, 
				 { embeds }
				);
}

class CheapestFFFE implements Definitions.Command {
	name = 'cheapestfffe';
	command = 'cheapestfffe';
	aliases = [];
	describe = 'Shows FF crew on your roster who are cheapest to FE';
	options = [{
			name: 'fuseneed',
			type: ApplicationCommandOptionType.Integer,
			description: 'show crew with a maximum fuse need',
			required: false,
			default: 0,
			choices: [
				{ name: '1', value: 1 },
				{ name: '2', value: 2 },
				{ name: '3', value: 3 },
				{ name: '4', value: 4 },
				{ name: '5', value: 5 },
			]
		}]
	builder(yp: yargs.Argv): yargs.Argv {
		return yp.option('fuseneed', {
			alias: 'f',
			desc: 'show crew with a maximum fuse need'			
		});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let fuse = args.fuseneed as string | undefined;
		args.promisedResult = asyncHandler(message, fuse);
	}
}

export let CheapestFFFECommand = new CheapestFFFE();
