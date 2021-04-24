import { Message, RichEmbed } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { formatSources, formatRecipe } from '../utils/items';
import { colorFromRarity } from '../utils/crew';
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
			return false;
		}
		if (c.rarity === crew.find((d) => d.symbol === c.symbol)?.max_rarity) {
			return true;
		}
		return false;
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


	sendAndCache(message, `Cheapest candidates for immortalisation for **${user.profiles[0].captainName}**'s roster (last updated ${user.profiles[0].lastUpdate.toDateString()})`);

	candidatesForImmortalisation.slice(0, 5).forEach((can: any) => {
		const matched = crew.find((crew) => crew.symbol === can.symbol);
		if (!matched) {
			return;
		}
		let embed = new RichEmbed()
			.setTitle(`${matched.name} (Level ${can.level})`)
			.setDescription(`Missing item costs:`)
			.setThumbnail(`${CONFIG.ASSETS_URL}${matched.imageUrlPortrait}`)
			.setColor(colorFromRarity(matched.max_rarity))
			.addField(getEmoteOrString(message, 'chrons', 'Chrons'), Math.round(can.requiredChronCost), true)
			.addField(getEmoteOrString(message, 'shuttle', 'Faction'), `${can.requiredFactionItems} items`, true)
			.addField(getEmoteOrString(message, 'credits', 'Credits'), can.craftCost, true)
			.setFooter(`${matched.name} is in ${matched.collections.length === 0 ? 'no collections' : `the following collections: ${matched.collections.join(', ')}`}`);
		sendAndCache(message, embed);
	});;

}

class CheapestFFFE implements Definitions.Command {
	name = 'cheapestfffe';
	command = 'cheapestfffe';
	aliases = [];
	describe = 'Shows FF crew on your roster who are cheapest to FE';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp;
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		args.promisedResult = asyncHandler(message);
	}
}

export let CheapestFFFECommand = new CheapestFFFE();
