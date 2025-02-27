import { ColorResolvable, Message } from 'discord.js';
import { getEmoteOrString } from './discord';
import CONFIG from './config';
import { PlayerCrew } from '../datacore/player';
import { Definitions } from './definitions';

export function formatTrait(value: string) {
	value = value.replace(/_/g, " ");
	let vm = "";
	let pch = ""
	for (let ch of value) {
		if (ch === " ") {
			vm += " ";
		}
		else if (pch === "" || pch === " ") {
			vm += ch.toUpperCase();
		}
		else {
			vm += ch.toLowerCase();
		}
		pch = ch;
	}

	return vm;
}

function formatSkill(skill: Definitions.Skill, useSpace: boolean, forGauntlet: boolean = false) {
	if (forGauntlet) {
		return `${useSpace ? ' ' : '^'}(${skill.range_min ?? 0}-${skill.range_max ?? 0})`;
	} else {
		return `${skill.core ?? 0}${useSpace ? ' ' : '^'}(${skill.range_min ?? 0}-${skill.range_max ?? 0})`;
	}
}

function formatCrewStatsInternal(skills: Definitions.Skills, useSpace: boolean, forGauntlet: boolean = false) {
	// TODO: apply buff config before sort

	let result: any[] = [];
	if (!!skills.command_skill && Object.values(skills.command_skill).some(v => !!v)) {
		result.push({
			val: skills.command_skill.core,
			text: `CMD ${formatSkill(skills.command_skill, useSpace, forGauntlet)}`
		});
	}

	if (!!skills.science_skill && Object.values(skills.science_skill).some(v => !!v)) {
		result.push({
			val: skills.science_skill.core,
			text: `SCI ${formatSkill(skills.science_skill, useSpace, forGauntlet)}`
		});
	}

	if (!!skills.security_skill && Object.values(skills.security_skill).some(v => !!v)) {
		result.push({
			val: skills.security_skill.core,
			text: `SEC ${formatSkill(skills.security_skill, useSpace, forGauntlet)}`
		});
	}

	if (!!skills.engineering_skill && Object.values(skills.engineering_skill).some(v => !!v)) {
		result.push({
			val: skills.engineering_skill.core,
			text: `ENG ${formatSkill(skills.engineering_skill, useSpace, forGauntlet)}`
		});
	}

	if (!!skills.diplomacy_skill && Object.values(skills.diplomacy_skill).some(v => !!v)) {
		result.push({
			val: skills.diplomacy_skill.core,
			text: `DIP ${formatSkill(skills.diplomacy_skill, useSpace, forGauntlet)}`
		});
	}

	if (!!skills.medicine_skill && Object.values(skills.medicine_skill).some(v => !!v)) {
		result.push({
			val: skills.medicine_skill.core,
			text: `MED ${formatSkill(skills.medicine_skill, useSpace, forGauntlet)}`
		});
	}

	return result.sort((a, b) => b.val - a.val).map(a => a.text);
}

function formatCrewStats(crew: Definitions.BotCrew | PlayerCrew | Definitions.Skills, useSpace: boolean, raritySearch: number = 0, forGauntlet: boolean = false) {
	if ("skill_data" in crew) {
		let data = crew.skill_data.find(c => c.rarity === raritySearch);
		if (data) {
			return formatCrewStatsInternal(data.base_skills, useSpace, forGauntlet);
		}
		return formatCrewStatsInternal(crew.base_skills, useSpace, forGauntlet);
	}
	else {
		return formatCrewStatsInternal(crew, useSpace, forGauntlet);
	}
}

export function formatCrewCoolRanks(crew: Definitions.BotCrew, orEmpty: boolean = false, separator: string = ', ') {
	// TODO: recalculate based on user's buffConfig

	let result = [] as string[];
	if (crew.ranks.voyRank <= 10) {
		result.push(`Voyage #${crew.ranks.voyRank} overall`);
	}

	if (crew.ranks.gauntletRank <= 10) {
		result.push(`Gauntlet #${crew.ranks.gauntletRank} overall`);
	}

	for (const rank in crew.ranks) {
		if (crew.ranks[rank] > 0 && crew.ranks[rank] <= 10) {
			if (rank.startsWith('V_')) {
				result.push(`Voyage #${crew.ranks[rank]} ${rank.substr(2).replace('_', '/')}`);
			} else if (rank.startsWith('G_')) {
				result.push(`Gauntlet #${crew.ranks[rank]} ${rank.substr(2).replace('_', '/')}`);
			} else if (rank.startsWith('B_')) {
				result.push(`Base #${crew.ranks[rank]} ${rank.substr(2).replace('_', '/')}`);
			}
		}
		if (rank === 'voyTriplet' && crew.ranks[rank]!.rank <= 10) {
			result.push(`Voyage #${crew.ranks[rank]!.rank} ${crew.ranks[rank]!.name.replace(/ /g, '')}`)
		}
	}

	if (result.length === 0) {
		if (orEmpty) {
			return '';
		} else {
			return 'No top 10 stats';
		}
	} else {
		return result.join(separator);
	}
}

export function formatSkillsStatsWithEmotes(
	message: Message,
	skills: Definitions.Skills,
	raritySearch: number = 0,
	forGauntlet: boolean = false
) {
	let formattedStats = formatCrewStats(skills, true, raritySearch, forGauntlet)
		.map(stat => stat.replace('^', ' '))
		.join(' ')
		.replace('SCI', getEmoteOrString(message, 'sci', 'SCI'))
		.replace('SEC', getEmoteOrString(message, 'sec', 'SEC'))
		.replace('ENG', getEmoteOrString(message, 'eng', 'ENG'))
		.replace('DIP', getEmoteOrString(message, 'dip', 'DIP'))
		.replace('CMD', getEmoteOrString(message, 'cmd', 'CMD'))
		.replace('MED', getEmoteOrString(message, 'med', 'MED'));

	return formattedStats;
}

export function formatCrewStatsWithEmotes(
	message: Message,
	crew: Definitions.BotCrew | PlayerCrew,
	raritySearch: number = 0,
	forGauntlet: boolean = false
) {
	let formattedStats = formatCrewStats(crew, true, raritySearch, forGauntlet)
		.map(stat => stat.replace('^', ' '))
		.join(' ')
		.replace('SCI', getEmoteOrString(message, 'sci', 'SCI'))
		.replace('SEC', getEmoteOrString(message, 'sec', 'SEC'))
		.replace('ENG', getEmoteOrString(message, 'eng', 'ENG'))
		.replace('DIP', getEmoteOrString(message, 'dip', 'DIP'))
		.replace('CMD', getEmoteOrString(message, 'cmd', 'CMD'))
		.replace('MED', getEmoteOrString(message, 'med', 'MED'));

	return formattedStats;
}

export function getBonusType(type: number): string {
	switch (type) {
		case 0:
			return 'attack';
		case 1:
			return 'evasion';
		case 2:
			return 'accuracy';
		case 3:
			return 'shield regen';
		default:
			return 'BUG';
	}
}

export function actionAbilityoString(ability: Definitions.CrewActionAbility): string {
	const conditionToString = (condition: number): string => {
		switch (condition) {
			case 0:
				return 'None';
			case 1:
				return 'Position';
			case 2:
				return 'Cloak';
			case 4:
				return 'Boarding';
			default:
				return 'BUG';
		}
	};

	let val = '';
	switch (ability.type) {
		case 0: {
			val = `Increase bonus boost by +${ability.amount}`;
			break;
		}
		case 1: {
			val = `Immediately deals ${ability.amount}% damage`;
			break;
		}
		case 2: {
			val = `Immediately repairs Hulls by ${ability.amount}%`;
			break;
		}
		case 3: {
			val = `Immediately repairs Shields by ${ability.amount}%`;
			break;
		}
		case 4: {
			val = `+${ability.amount} to Crit Rating`;
			break;
		}
		case 5: {
			val = `+${ability.amount} to Crit Bonus`;
			break;
		}
		case 6: {
			val = `Shield regeneration +${ability.amount}`;
			break;
		}
		case 7: {
			val = `+${ability.amount}% to Attack Speed`;
			break;
		}
		case 8: {
			val = `Increase boarding damage by ${ability.amount}%`;
			break;
		}
		default: {
			val = 'BUG';
			break;
		}
	}

	if (ability.condition && ability.condition > 0) {
		val += ` (Trigger: ${conditionToString(ability.condition)})`;
	}
	return val;
}

export function chargePhasesToString(action: Definitions.CrewAction): string[] {
	if (action.charge_phases && action.charge_phases.length > 0) {
		let cps: string[] = [];
		let charge_time = 0;
		action.charge_phases.forEach(cp => {
			charge_time += cp.charge_time;
			let phaseDescription = `After ${charge_time}s, `;

			if (cp.ability_amount) {
				phaseDescription += `+${cp.ability_amount} ${getBonusType(action.bonus_type)}`;
			}

			if (cp.bonus_amount) {
				phaseDescription += `+${cp.bonus_amount} to ${getBonusType(action.bonus_type)}`;
			}

			if (cp.duration) {
				phaseDescription += `, +${cp.duration}s duration`;
			}

			if (cp.cooldown) {
				phaseDescription += `, +${cp.cooldown}s cooldown`;
			}
			cps.push(phaseDescription);
		});

		return cps;
	} else {
		return [];
	}
}

export function colorFromRarity(rarity: number): ColorResolvable {
	switch (rarity) {
		case 1: // Common
			return [155, 155, 155];

		case 2: // Uncommon
			return [80, 170, 60];

		case 3: // Rare
			return [90, 170, 255];

		case 4: // Super Rare
			return [170, 45, 235];

		case 5: // Legendary
			return [253, 210, 106];

		default:
			return 'LightGrey';
	}
}

export function formatStatLine(message: Message, crew: Definitions.BotCrew | PlayerCrew, raritySearch: number) {
	if (raritySearch >= crew.max_rarity) {
		raritySearch = 1;
	}
	return (
		'⭐'.repeat(raritySearch) +
		'🌑'.repeat(crew.max_rarity - raritySearch) +
		' ' +
		formatCrewStatsWithEmotes(message, crew, raritySearch) +
		'\n' +
		'⭐'.repeat(crew.max_rarity) +
		' ' +
		formatCrewStatsWithEmotes(message, crew)
	);
}

export function formatCurrentStatLine(message: Message, crew: Definitions.BotCrew | PlayerCrew) {
	return (
		'⭐'.repeat(crew.max_rarity) +
		'\n' +
		formatCrewStatsWithEmotes(message, crew)
	);
}


export function formatCollectionName(collection: string, ocols?: string[] | null): string {
	if (ocols) {
		return `[${ocols.includes(collection) ? collection : `~~${collection}~~`}](${CONFIG.DATACORE_URL}collections?select=${encodeURIComponent(collection)})`;

	}
	else {
		return `[${collection}](${CONFIG.DATACORE_URL}collections?select=${encodeURIComponent(collection)})`;

	}
}

export function isRecent(crew: { date_added: Date | string; [key: string]: any }) {
	const now = new Date();
	const month = 1000 * 60 * 60 * 24 * 48;
	now.setTime(now.getTime() - month);
	if (typeof crew.date_added === 'string') {
		crew.date_added = new Date(crew.date_added);
	}
	return crew.date_added.getTime() >= now.getTime();
}

export function rankLinker(symbol: string, column: string, direction: string = 'ascending', search: string | undefined = undefined) {
	const linkState = {
		search: search ?? '',
		column: column,
		direction: direction ?? 'ascending',
		highlight: symbol ?? ''
	};
	const baseUrl = 'https://datacore.app/';
	let params = '';
	Object.entries(linkState).forEach(entry => {
		if (entry[1] !== '') {
			if (params !== '') params += '&';
			params += entry[0]+'='+encodeURI(entry[1]);
		}
	});
	const url = params !== '' ? baseUrl+'?'+params : baseUrl;
	return url;
};
