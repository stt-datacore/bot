import { Message } from 'discord.js';
import yargs from 'yargs';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';

import { DCData } from '../data/DCData';
import { formatCrewStatsWithEmotes } from '../utils/crew';
import { sendAndCache } from '../utils/discord';

import CONFIG from '../utils/config';
import { Logger } from '../utils';

interface WithMatchingTrait {
	crew: Definitions.BotCrew;
	matched: string[];
}

function hasTrait(crew: Definitions.BotCrew, search: string) {
	return crew.traits_named.find((t: string) => t.toLowerCase().indexOf(search.trim().toLowerCase()) >= 0);
}

let GauntletCache = new NodeCache({ stdTTL: 600 });

async function loadGauntlet(): Promise<any> {
	let gauntletCached = GauntletCache.get('G');
	if (gauntletCached) {
		return gauntletCached;
	}

	try {
		let response = await fetch(`${CONFIG.DATACORE_URL}api/gauntlet_info`);
		if (response.ok) {
			let reply = await response.json();

			GauntletCache.set('G', reply, Math.min(reply.seconds_to_join, 600));

			return reply;
		}
	} catch (err) {
		Logger.error('Error while loading gauntlet info', err);
		return undefined;
	}
}

async function asyncHandler(message: Message) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let gstatus = await loadGauntlet();

	if (!gstatus || !gstatus.contest_data || !gstatus.contest_data.traits) {
		sendAndCache(message, `Something went wrong loading current gauntlet status.`);
		return;
	}

	const hasTraits = (crew: any) => {
		let matched: string[] = [];
		if (crew.traits.includes(gstatus.contest_data.traits[0])) {
			matched.push(gstatus.contest_data.traits[0]);
		}
		if (crew.traits.includes(gstatus.contest_data.traits[1])) {
			matched.push(gstatus.contest_data.traits[1]);
		}
		if (crew.traits.includes(gstatus.contest_data.traits[2])) {
			matched.push(gstatus.contest_data.traits[2]);
		}

		return { crew, matched };
	};

	const relativeValue = (crew: any) => {
		let total = 0;
		Object.keys(crew.base_skills).forEach((skill) => {
			if (crew.base_skills[skill] && crew.base_skills[skill].range_max) {
				total += crew.base_skills[skill].range_max;
			}
		});

		return total;
	};

	let results = DCData.getBotCrew()
		.filter((crew) => crew.max_rarity > 3)
		.map((crew) => hasTraits(crew))
		.filter((entry) => entry.matched.length > 1)
		.sort((a, b) => b.matched.length * relativeValue(b.crew) - a.matched.length * relativeValue(a.crew));

	if (!results || results.length === 0) {
		sendAndCache(message, `Something went wrong finding crew for current gauntlet.`);
	} else {
		let reply = `**Featured skill: ${
			CONFIG.SKILLS[gstatus.contest_data.featured_skill as Definitions.SkillName]
		}. Traits: ${gstatus.contest_data.traits.join(', ')} (${results.length} total)**\n_45% or better 4 and 5 star crew:_\n`;

		results.slice(0, 10).forEach((entry) => {
			let statLine = `${'⭐'.repeat(entry.crew.max_rarity)} **${entry.crew.name}** [${entry.matched.join(
				', '
			)}] ${formatCrewStatsWithEmotes(message, entry.crew)}`;
			reply += statLine + '\n';
		});

		sendAndCache(message, reply);
	}
}

class Gauntlet implements Definitions.Command {
	name = 'gauntlet';
	command = 'gauntlet [trait1] [trait2] [trait3]';
	aliases = [];
	describe = 'Searches crew to use in gauntlet that have at least 2 of the 3 given traits';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('trait1', {
				describe: '(part of) the name of the first trait (enclose in quotes if it includes spaces)',
				type: 'string',
			})
			.positional('trait2', {
				describe: '(part of) the name of the second trait (enclose in quotes if it includes spaces)',
				type: 'string',
			})
			.positional('trait3', {
				describe: '(part of) the name of the third trait (enclose in quotes if it includes spaces)',
				type: 'string',
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;

		if (args.trait1 && args.trait2 && args.trait3) {
			let realTraitNames: string[] = [];
			let results: WithMatchingTrait[] = [];
			DCData.getBotCrew().forEach((crew) => {
				let matched: string[] = [];

				let matchedTrait: string | undefined;
				matchedTrait = hasTrait(crew, args.trait1 as string);
				if (matchedTrait) matched.push(matchedTrait);
				matchedTrait = hasTrait(crew, args.trait2 as string);
				if (matchedTrait) matched.push(matchedTrait);
				matchedTrait = hasTrait(crew, args.trait3 as string);
				if (matchedTrait) matched.push(matchedTrait);

				if (matched.length > 1) {
					results.push({ crew, matched });
				}

				realTraitNames = realTraitNames.concat(matched);
			});

			realTraitNames = [...new Set(realTraitNames)];

			if (!results || results.length === 0) {
				sendAndCache(message, `Sorry, I couldn't find any crew matching the given traits`);
			} else {
				let reply = `**Traits: ${realTraitNames.join(', ')} (${results.length} total)**\n_45% or better 4 and 5 star crew:_\n`;

				results.slice(0, 10).forEach((entry) => {
					let statLine = `${'⭐'.repeat(entry.crew.max_rarity)} **${entry.crew.name}** [${entry.matched.join(
						', '
					)}] ${formatCrewStatsWithEmotes(message, entry.crew)}`;
					reply += statLine + '\n';
				});

				sendAndCache(message, reply);
			}
		} else {
			args.promisedResult = asyncHandler(message);
		}
	}
}

export let GauntletCommand = new Gauntlet();
