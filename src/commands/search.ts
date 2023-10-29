import { Message } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { formatCrewStatsWithEmotes } from '../utils/crew';
import { sendAndCache } from '../utils/discord';

class Search implements Definitions.Command {
	name = 'search';
	command = 'search <term...>';
	aliases = [];
	describe = 'Searches crew by name and/or traits';
	options = [
		{
			name: 'term',
			type: 'STRING',
			description: 'name of crew, trait or skill or part of the name',
			required: true,
		},
		{
			name: 'stars',
			type: 'INTEGER',
			description: 'limit the search to crew with this number of stars (fuse level)',
			required: false,
		}
	]
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('term', {
				describe: 'name of crew, trait or skill or part of the name'
			})
			.option('stars', {
				alias: 's',
				desc: 'limit the search to crew with this number of stars (fuse level)',
				type: 'number'
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let term = typeof(args.term) === 'string' ? args.term.split(' ') : args.term;
		let results = DCData.searchCrewWithTokens(<string[]>term);
		if (args.stars && results) {
			results = results.filter(crew => crew.max_rarity === (args.stars as number));
		}

		if (!results || results.length === 0) {
			sendAndCache(message, `Sorry, I couldn't find any crew matching '${(<string[]>term).join(' ')}'`);
		} else {
			let reply = `Here are the ${(results.length > 10) ? 'first 10' : results.length} crew matching '${(<string[]>term).join(' ')}':\n`;

			results.slice(0, 10).forEach(crew => {
				let statLine = `${'⭐'.repeat(crew.max_rarity)} **${crew.name}** ${formatCrewStatsWithEmotes(message, crew)}`;
				reply += statLine + '\n';
			});

			sendAndCache(message, reply);
		}
	}
}

export let SearchCommand = new Search();
