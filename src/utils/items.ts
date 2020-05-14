import { Message } from 'discord.js';
import { DCData } from '../data/DCData';
import { getEmoteOrString } from './discord';
import CONFIG from '../utils/config';

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
					recipe.push({
						cost: entry.avg_cost,
						text: `${formatQuestName(quest, !rich)}, ${formatMastery(entry.mastery)} ${formatType(
							entry.type
						)} **${entry.avg_cost.toFixed(2)} ${getEmoteOrString(message, 'chrons', 'chronitons')}**`
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
