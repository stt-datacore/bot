import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import levenshtein from 'js-levenshtein';

function formatChoice(message: Message, choice: any): string {
	let result = choice.text + '\n' + choice.reward.join(', ');
	result = result.split(':honor:').join(getEmoteOrString(message, 'honor', 'honor'));
	result = result.split(':chrons:').join(getEmoteOrString(message, 'chrons', 'chrons'));
	return result;
}



async function asyncHandler(message: Message, searchString: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));
	
	let test_search = searchString.trim().toLowerCase().replace(/,/g, '').replace(/:/g, '').replace(/;/g, '');
	let dilemmas = DCData.getDilemmas();

	// let results = dilemmas.filter(
	// 	(dilemma: any) => dilemma.title.toLowerCase().replace(/,/g, '').replace(/:/g, '').replace(/;/g, '').indexOf(test_search) >= 0
	// );

	let intermediate = [] as { distance: number, dilemma: any }[];
	let results = [] as any[];

	dilemmas.forEach((dilemma: any, idx: number) => {
		let distance = levenshtein(test_search, dilemma.title.toLowerCase().trim());
		if (distance <= 5 && !results.some(r => r.title === dilemma.title)) {
			intermediate.push({ distance, dilemma });
		}
	});

	intermediate.sort((a, b) => {
		let r = a.distance - b.distance;
		if (!r) r = a.dilemma.title.localeCompare(b.dilemma.title);
		return r;
	});

	if (intermediate.some(i => i.distance === 0)) {
		results = intermediate.filter(i => i.distance === 0).map(i => i.dilemma);
	}
	else {
		results = intermediate.map(i => i.dilemma);
	}

	if ((results === undefined) || (results.length === 0)) {
		sendAndCache(message, `Sorry, I couldn't find a dilemma matching '${searchString}'`);
	} else {
		let embeds = [] as EmbedBuilder[];

		for (let dilemma of results) {
			let embed = new EmbedBuilder()
				.setTitle(dilemma.title)
				.setColor('DarkGreen')
				.addFields({ name: 'Choice A', value: formatChoice(message, dilemma.choiceA) })
				.addFields({ name: 'Choice B', value: formatChoice(message, dilemma.choiceB) });

			if (dilemma.choiceC != null) {
				embed = embed.addFields({ name: 'Choice C', value: formatChoice(message, dilemma.choiceC) });
			}

			embeds.push(embed);
		}

		await sendAndCache(message, '', {embeds: embeds});
	}
}

class Dilemma implements Definitions.Command {
	name = 'dilemma';
	command = 'dilemma <title...>';
	aliases = ['dd'];
	describe = 'Searches dilemmas with the given title';
	options = [
		{
			name: 'title',
			type: ApplicationCommandOptionType.String,
			description: "(part of) the dilemma's title",
			required: true
		}
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp.positional('title', {
			describe: "(part of) the dilemma's title"
		});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let searchString = typeof(args.title) === 'string' ? args.title : (<string[]>args.title).join(' ');

		args.promisedResult = asyncHandler(message, searchString);
	}
}

export let DilemmaCommand = new Dilemma();
