import { Message } from 'discord.js';
import { DCData } from '../data/DCData';
import { getEmoteOrString } from './discord';
import CONFIG from '../utils/config';
import { IId, IName, ISymbol, Skill } from '../datacore/crew';
import { EquipmentItem, EquipmentItemSource } from '../datacore/equipment';
import { Mission } from '../datacore/missions';

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
					if (quest.mission.cadet) {
						recipe.push({
							cost: avg_cost,
							text: `${formatQuestName(quest, !rich)}, ${formatMastery(entry.mastery)} ${formatType(
								entry.type
							)} **${avg_cost.toFixed(2)}**`
						});	
					}
					else {
						recipe.push({
							cost: avg_cost,
							text: `${formatQuestName(quest, !rich)}, ${formatMastery(entry.mastery)} ${formatType(
								entry.type
							)} **${avg_cost.toFixed(2)} ${getEmoteOrString(message, 'chrons', 'chronitons')}**`
						});	
					}
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
	} else if (type == 4) {
		return 'cadet mission';
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
		return `(EP **${quest.mission.episode}** - ${quest.mission.episode_title}) -> ${quest.index ? `(**${quest.index}**) ` : ''}${quest.name}`;
	} else if (quest.mission.cadet) {
		return `(CADET **${quest.mission.episode_title}**) -> ${quest.index ? `(**${quest.index}**) ` : ''}${quest.name}`;
	} else {
		return `(${quest.mission.episode_title}) -> ${quest.index ? `(**${quest.index}**) ` : ''}${quest.name}`;
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



export function postProcessCadetItems(missions: Mission[], items: (Definitions.Item | EquipmentItem)[]): void {
	const cadetforitem = missions.filter(f => f.cadet);
	console.log("Finding cadet mission farm sources for items ...");

	if (cadetforitem?.length) {
		for(const item of items) {
			for (let ep of cadetforitem) {
				let quests = ep.quests.filter(q => q.quest_type === 'ConflictQuest' && q.mastery_levels?.some(ml => ml.rewards?.some(r => r.potential_rewards?.some(px => px.symbol === item.symbol))));
				if (quests?.length) {
					for (let quest of quests) {
						if (quest.mastery_levels?.length) {
							let x = 0;
							for (let ml of quest.mastery_levels) {
								if (ml.rewards?.some(r => r.potential_rewards?.some(pr => pr.symbol === item.symbol))) {
									let mx = ml.rewards.map(r => r.potential_rewards?.length).reduce((prev, curr) => Math.max(prev ?? 0, curr ?? 0)) ?? 0;
									mx = (1/mx) * 1.80;
									let qitem = {
										type: 4,
										mastery: x,
										name: quest.name,
										energy_quotient: 1,
										chance_grade: 5 * mx,
										mission_symbol: quest.symbol,
										cost: 1,
										avg_cost: 1/mx,
										cadet_mission: ep.episode_title,
										cadet_symbol: ep.symbol
									} as EquipmentItemSource;
									if (!item.item_sources.find(f => f.mission_symbol === quest.symbol)) {
										item.item_sources.push(qitem);
									}
								}
								x++;
							}
						}
					}
				}
			}
		}
	}

	console.log("Done with cadet missions.");
}

export function binaryLocateString(search: string, items: any[], prop: string, ci: boolean): any {
	let lo = 0, hi = items.length - 1;
	if (ci) search = search.toLowerCase();

	while (true)
	{
		if (lo > hi) break;

		let p = Math.floor((hi + lo) / 2);
		let elem = items[p];
		let c: number;

		if (ci) {
			c = search.localeCompare(items[p][prop].toLowerCase());
		}
		else {
			c = search.localeCompare(items[p][prop]);
		}

		if (c == 0)
		{
			return elem;
		}
		else if (c < 0)
		{
			hi = p - 1;
		}
		else
		{
			lo = p + 1;
		}
	}

	return undefined;
}

export function binaryLocateNumber(search: number, items: any[], prop: string): number {
	let lo = 0, hi = items.length - 1;

	while (true)
	{
		if (lo > hi) break;

		let p = Math.floor((hi + lo) / 2);
		let elem = items[p];

		let c = search - items[p][prop];

		if (c == 0)
		{
			return elem;
		}
		else if (c < 0)
		{
			hi = p - 1;
		}
		else
		{
			lo = p + 1;
		}
	}

	return -1;
}


export function binaryLocateSymbol<T extends ISymbol>(symbol: string, source: T[]) {
	return binaryLocateString(symbol, source, "symbol", false) as T | undefined;
}

export function binaryLocateCrew<T extends Definitions.BotCrew>(symbol: string, source: T[]): Definitions.BotCrew | undefined {
	return binaryLocateString(symbol, source, "symbol", false) as Definitions.BotCrew | undefined;	
}

export function binaryLocateName<T extends IName>(symbol: string, source: T[]) {
	return binaryLocateString(symbol, source, "name", true) as T | undefined;
}

export function binaryLocateId<T extends IId>(id: number, source: T[]) {
	return binaryLocateNumber(id, source, "symbol");
}

export function binaryLocateArchetypeId(id: number, source: any[]) {
	return binaryLocateNumber(id, source, "archetype_id");
}
