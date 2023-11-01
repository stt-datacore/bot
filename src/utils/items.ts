import { Message } from 'discord.js';
import { DCData } from '../data/DCData';
import { getEmoteOrString } from './discord';
import CONFIG from '../utils/config';
import { Skill } from '../datacore/crew';
import { EquipmentItem } from '../datacore/equipment';

export function formatRecipe(message: Message, item: Definitions.Item, rich: boolean = false) {
	if (!item.recipe || !item.recipe.list || item.recipe.list.length === 0) {
		return '';
	} else {
		let reply = `You can craft a ${'⭐'.repeat(item.rarity)}${item.name} for ${
			item.recipe.craftCost
		} ${getEmoteOrString(message, 'credits', 'credits')} using these items:\n`;

		let recipe: string[] = [];
		item.recipe.list.forEach((entry: any) => {
			let recipeItem = DCData.itemBySymbol(entry.symbol);
			let name = rich
				? `[${recipeItem.name}](${CONFIG.DATACORE_URL}item_info?symbol=${recipeItem.symbol})`
				: recipeItem.name;
			recipe.push(
				`${'⭐'.repeat(recipeItem.rarity)}${name} x ${entry.count}` + (entry.factionOnly ? ' (FACTION)' : '')
			);
		});
		if (rich) {
			reply += recipe.join('\n');
		} else {
			reply += recipe.join(', ');
		}

		return reply;
	}
}

export function formatSources(
	message: Message,
	item: Definitions.Item,
	adjustForKit: boolean,
	rich: boolean = false
): string {
	if (!item.item_sources || item.item_sources.length === 0) {
		console.log(item);
		return '';
	} else {
		let reply = `You can get a ${'⭐'.repeat(item.rarity)}${item.name} from these places:\n`;

		let recipe: any[] = [];
		item.item_sources.forEach((entry: any) => {
			if (entry.type == 1) {
				recipe.push({ cost: 999, text: `${entry.name}, ${formatType(entry.type)}` });
			} else {
				if (entry.mission_symbol && entry.avg_cost > 0) {
					let quest = DCData.questBySymbol(entry.mission_symbol);
					let avg_cost = entry.avg_cost * (adjustForKit ? 0.75 : 1)
					recipe.push({
						cost: avg_cost,
						text: `${formatQuestName(quest, !rich)}, ${formatMastery(entry.mastery)} ${formatType(
							entry.type
						)} **${avg_cost.toFixed(2)} ${getEmoteOrString(message, 'chrons', 'chronitons')}**`
					});
				}
			}
		});
		reply += recipe
			.sort((a, b) => a.cost - b.cost)
			.map(e => e.text)
			.join('\n');

		return reply;
	}
}

function formatType(type: number): string {
	if (type == 0) {
		return 'mission';
	} else if (type == 1) {
		return 'faction mission';
	} else if (type == 2) {
		return 'ship battle';
	} else {
		return '';
	}
}

function formatMastery(mastery: number): string {
	if (mastery == 0) {
		return 'Normal';
	} else if (mastery == 1) {
		return 'Elite';
	} else if (mastery == 2) {
		return 'Epic';
	} else {
		return '';
	}
}

function formatQuestName(quest: any, long: boolean): string {
	if (!long) {
		return quest.name;
	}

	if (quest.mission.episode > 0) {
		return `${quest.name} (EP ${quest.mission.episode} - ${quest.mission.episode_title})`;
	} else if (quest.mission.cadet) {
		return `${quest.name} (CADET ${quest.mission.episode_title})`;
	} else {
		return `${quest.name} (${quest.mission.episode_title})`;
	}
}


/**
 * Creates a formatted title (appelation) from the given text.
 * @param text The text to convert into a title
 * @returns 
 */
export function appelate(text: string) {
	let curr: string = "";
	let cpos = 0;

	const match = new RegExp(/[A-Za-z0-9]/);

	for (let ch of text) {
		if (match.test(ch)) {
			if (cpos++ === 0) {
				curr += ch.toUpperCase();
			}
			else {
				curr += ch.toLowerCase();
			}
		}
		else {
			cpos = 0;
			curr += ch == '_' ? " " : ch;
		}
	}

	return curr;
}


export interface ItemBonusInfo {
    bonusText: string[];
    bonuses: { [key: string]: Skill };
}

export function getItemBonuses(item: EquipmentItem): ItemBonusInfo {
    let bonusText = [] as string[];
    let bonuses = {} as { [key: string]: Skill };
    
    if (item.bonuses) {
        for (let [key, value] of Object.entries(item.bonuses)) {
            let bonus = CONFIG.STATS_CONFIG[Number.parseInt(key)];
            if (bonus) {
                bonusText.push(`+${value} ${bonus.symbol}`);	
                bonuses[bonus.skill] ??= {} as Skill;
				let stat = bonus.symbol.replace(`${bonus.skill}_`, '');
                (bonuses[bonus.skill] as any)[stat] = value;
                bonuses[bonus.skill].skill = bonus.skill;
            } else {
                // TODO: what kind of bonus is this?
            }
        }
    }

    return {
        bonusText,
        bonuses
    };
}
