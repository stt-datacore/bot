import { Message } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { formatCrewStatsWithEmotes } from '../utils/crew';
import { sendAndCache } from '../utils/discord';

const SKILL_FIELD_NAMES: { [key: string]: Definitions.SkillName } = {
	sci: 'science_skill',
	sec: 'security_skill',
	eng: 'engineering_skill',
	dip: 'diplomacy_skill',
	cmd: 'command_skill',
	med: 'medicine_skill'
};

function calcValue(type: string, crew: Definitions.BotCrew, skill: string): number {
	let sk = crew.base_skills[SKILL_FIELD_NAMES[skill]];
	if (!sk) {
		return 0;
	}

	if (type === 'base') {
		return sk.core;
	} else if (type === 'gauntlet') {
		return (sk.range_min + sk.range_max) / 2;
	} else if (type === 'avg' || type === 'voyage') {
		return sk.core + (sk.range_min + sk.range_max) / 2;
	} else {
		return 0;
	}
}

async function asyncHandler(message: Message, type: string, skill: string, secondskill: string, stars: number) {
	// TODO: personalized if user is registered
	let data = DCData.getBotCrew()
		.filter(crew => crew.max_rarity <= stars)
		.map(crew => ({ crew, val: calcValue(type, crew, skill) + calcValue(type, crew, secondskill) }));

	let bestcrew = data
		.sort((a, b) => b.val - a.val)
		.slice(0, 10)
		.map(e => e.crew);

	let reply = '';
	bestcrew.forEach(crew => {
		let statLine = `${'⭐'.repeat(crew.max_rarity)} **${crew.name}** ${formatCrewStatsWithEmotes(message, crew)}`;
		reply += statLine + '\n';
	});

	sendAndCache(message, reply);
}

class Best implements Definitions.Command {
	name = 'best';
	command = 'best <type> <skill> [secondskill]';
	aliases = [];
	describe = 'Searches top crew according to base, gauntlet or average (voyages) skill rating';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('type', {
				describe: 'type of search to do',
				choices: ['base', 'gauntlet', 'avg', 'voyage'],
				type: 'string'
			})
			.positional('skill', {
				describe: 'skill to search',
				choices: ['sci', 'sec', 'eng', 'dip', 'cmd', 'med'],
				type: 'string'
			})
			.positional('secondskill', {
				describe: '(optional) second skill to search',
				choices: ['sci', 'sec', 'eng', 'dip', 'cmd', 'med', ''],
				default: '',
				type: 'string'
			})
			.option('stars', {
				alias: 's',
				desc: 'limit the search to given number of stars or below',
				type: 'number',
				default: 5
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let type = args.type as string;
		let skill = args.skill as string;
		let secondskill = args.secondskill as string;
		let raritySearch = args.stars ? (args.stars as number) : 5;

		if (raritySearch < 0 || raritySearch > 5) {
			sendAndCache(message, `The stars setting must be a number between 0 and 5 (got ${raritySearch})`);
		} else {
			args.promisedResult = asyncHandler(message, type, skill, secondskill, raritySearch);
		}
	}
}

export let BestCommand = new Best();
