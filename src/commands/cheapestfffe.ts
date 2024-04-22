import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { binaryLocateSymbol } from '../utils/items';
import { colorFromRarity, formatCollectionName } from '../utils/crew';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import CONFIG from '../utils/config';
import { loadFullProfile, toTimestamp, userFromMessage } from '../utils/profile';
import { BAD_COST, IDemand, getNeededItems } from '../utils/equipment';

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
	fuse?: number,
	skirmish?: boolean,
	min_rarity?: number,
	max_rarity?: number
) {
	min_rarity ??= 1;
	max_rarity ??= 5;

	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let user = await userFromMessage(message);
	let profile = user?.profiles[0] ? loadFullProfile(user.profiles[0].dbid) : null;
	if (!user || !profile) {
		sendAndCache(message, "Sorry, I couldn't find an associated profile for your user.")
		return;
	}

	let crew = DCData.getBotCrew().filter(f => f.max_rarity <= max_rarity && f.max_rarity >= min_rarity);
	let profileCrew = profile.player.character.crew;
	let profileItems = profile.player.character.items;
	const needs = {} as { [key: string]: { demands: IDemand[], craftCost: number } };
	const sources = {} as { [key: string]: Definitions.ItemSource[] };

	let candidatesForImmortalisation = profileCrew.filter((c: any) => {
		if (c.level >= 90) {			
			if (c.equipment.length === 4) return false;
			let needed = getNeededItems(c.symbol, 90, c.level, skirmish);
			if (!needed || needed.demands.every(d => d.avgChronCost <= BAD_COST) || needed.craftCost <= BAD_COST) {
				return false;
			}
			needs[c.symbol] = needed;
		}
		else {
			let needed = getNeededItems(c.symbol, c.level, undefined, skirmish);
			if (!needed || needed.demands.every(d => d.avgChronCost <= BAD_COST) || needed.craftCost <= BAD_COST) {
				return false;
			}
			needs[c.symbol] = needed;
		}
		
		let findcrew = binaryLocateSymbol(c.symbol, crew);

		if (!fuse) {		
			if (c.rarity === findcrew?.max_rarity) {
				c.max_rarity = findcrew?.max_rarity;
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

		if (c.rarity === (findcrew?.max_rarity ?? 0) - fnum) {
			c.max_rarity = findcrew?.max_rarity;
			return true;
		}
		else {
			return false;
		}
	});

	candidatesForImmortalisation = candidatesForImmortalisation.map((c: any) => {
		//let needed = c.level >= 90 ? getNeededItems(c.symbol, 90, c.level, skirmish) : getNeededItems(c.symbol, c.level, undefined, skirmish);
		let needed = needs[c.symbol];
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
	}).sort((a: any, b: any) => {
		let r = 0;		
		if (skirmish) {
			sources[a.symbol] ??= needs[a.symbol].demands.map(d => d.equipment.item_sources ?? []).flat();
			sources[b.symbol] ??= needs[b.symbol].demands.map(d => d.equipment.item_sources ?? []).flat();

			let needa = sources[a.symbol];
			let ac = needa.length;
			let as = needa.filter(f => f.type === 2).length;

			let needb = sources[b.symbol];
			let bc = needb.length;
			let bs = needb.filter(f => f.type === 2).length;

			if (ac && bc) {
				if (as && bs) {
					ac = as / ac;
					bc = bs / bc;
					r = bc - ac;
				}			
				else if (as) {
					r = -1;
				}
				else if (bs) {
					r = 1;
				}
			}
		}
		//if (!r) r = (b.rarity/b.max_rarity) - (a.rarity/a.max_rarity);
		if (!r) r = a.requiredChronCost - b.requiredChronCost;
		return r;
	});


	const embeds = candidatesForImmortalisation.slice(0, 5).map((can: any) => {
		
		const matched = binaryLocateSymbol(can.symbol, crew) as Definitions.BotCrew | undefined;
		
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
					name: 'Rarity',
					value: '⭐'.repeat(can.rarity) + '🌑'.repeat(matched.max_rarity - can.rarity),
					inline: false
				},
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
					name: `${matched.name} is in the following collections: `,
					value: !matched?.collections?.length ? 'No Collections' : matched?.collections?.map(c => formatCollectionName(c))?.join(", ") ?? '',
					inline: true
				}
			)
			//.setFooter({ text: `${matched.name} is in ${matched.collections.length === 0 ? 'no collections' : `the following collections: ${matched.collections.join(', ')}`}` });
	});

	let skirmtext =  skirmish ? '[Skirmish Mode] ' : '';

	if (fuse) {
		sendAndCache(message, 
			`${skirmtext}Cheapest candidates for immortalisation that need ${fuse} fuse${fuse === 1 ? '' : 's'} for **${user.profiles[0].captainName}**'s roster (last updated ${toTimestamp(profile.lastModified ?? user.profiles[0].lastUpdate)})`, 
			{ embeds }
		   );
	}
	else {
		sendAndCache(message, 
			`${skirmtext}Cheapest candidates for immortalisation for **${user.profiles[0].captainName}**'s roster (last updated ${toTimestamp(profile.lastModified ?? user.profiles[0].lastUpdate)})`, 
			{ embeds }
		   );
	}
}

class CheapestFFFE implements Definitions.Command {
	name = 'cheapestfffe';
	command = 'cheapestfffe [fuseneed] [skirmish]';
	aliases = [];
	describe = 'Shows FF crew on your roster who are cheapest to FE';
	options = [{
			name: 'fuseneed',
			type: ApplicationCommandOptionType.Integer,
			description: 'show crew with the specified needed fuses',
			required: false,
			default: 0,
			choices: [
				{ name: '1', value: 1 },
				{ name: '2', value: 2 },
				{ name: '3', value: 3 },
				{ name: '4', value: 4 },
				{ name: '5', value: 5 },
			]
		},
		{
			name: 'skirmish',
			type: ApplicationCommandOptionType.Boolean,
			description: 'optimize for skirmish (ship battles and faction missions, only)',
			required: false,
			default: false
		},
		{
			name: 'max_rarity',
			type: ApplicationCommandOptionType.Integer,
			description: 'display crew up to this rarity',
			required: false,
			default: 5,
			choices: [
				{ name: '1', value: 1 },
				{ name: '2', value: 2 },
				{ name: '3', value: 3 },
				{ name: '4', value: 4 },
				{ name: '5', value: 5 },
			]
		},
		{
			name: 'min_rarity',
			type: ApplicationCommandOptionType.Number,
			description: 'display crew down to this rarity',
			required: false,
			default: 1,
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
			desc: 'show crew with the specified needed fuses',
			type: 'number'
		}).option('skirmish', {
			alias: 's',
			desc: 'optimize for skirmish (ship battles and faction missions, only)',
			type: 'boolean'
		}).option('max_rarity', {
			alias: 'max',
			desc: 'display crew up to this rarity',
			type: 'number'
		}).option('min_rarity', {
			alias: 'min',
			desc: 'display crew down to this rarity',
			type: 'number'
		});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let fuse = args.fuseneed as number;
		let skirmish = false;
		
		let max = 5;
		let min = 1;

		if (typeof args.skirmish === 'string') {
			skirmish = args.skirmish.trim().toLowerCase() === 'true';
		}
		else if (typeof args.skirmish === 'boolean') {
			skirmish = args.skirmish;
		}

		if (typeof args.max_rarity === 'string') {
			max = Number(args.max_rarity);
		}
		else {
			max = args.max_rarity as number;
		}
		
		if (typeof args.min_rarity === 'string') {
			min = Number(args.min_rarity);
		}
		else {
			min = args.min_rarity as number;
		}
		
		args.promisedResult = asyncHandler(message, fuse, skirmish, min, max);
	}
}

export let CheapestFFFECommand = new CheapestFFFE();
