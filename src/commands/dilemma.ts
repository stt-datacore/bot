import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import levenshtein from 'js-levenshtein';
import { colorFromRarity } from '../utils/crew';
import CONFIG from '../utils/config';

function formatChoice(message: Message, choice: any): string {
	let result = choice.text + '\n' + choice.reward.join(', ');
	result = result.split(':honor:').join(getEmoteOrString(message, 'honor', 'honor'));
	result = result.split(':chrons:').join(getEmoteOrString(message, 'chrons', 'chrons'));
	result = result.split(':merits:').join(getEmoteOrString(message, 'merits', 'merits'));
	return result;
}

function getChoiceRarity(choice: any) {
	if (choice.reward.some((r: string) => r.includes("100 :honor:"))) return 5;
	else if (choice.reward.some((r: string) => r.includes("60 :honor:"))) return 4;
	else return 3;
}

async function asyncHandler(message: Message, searchString: string) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));
	
	let test_search = searchString.trim().toLowerCase().replace(/,/g, '').replace(/:/g, '').replace(/;/g, '').replace(/'/g, '');
	let dilemmas = DCData.getDilemmas();

	let intermediate = [] as { distance: number, dilemma: any }[];
	let results = [] as any[];

	results = dilemmas.filter(
		(dilemma: any) => dilemma.title.toLowerCase().replace(/,/g, '').replace(/:/g, '').replace(/;/g, '').replace(/'/g, '').indexOf(test_search) >= 0
	);

	if (!results.length) {
		dilemmas.forEach((dilemma: any, idx: number) => {
			let distance = levenshtein(test_search, dilemma.title.toLowerCase().trim());
			if (distance <= 5 && !results.some(r => r.title === dilemma.title)) {
				intermediate.push({ distance, dilemma });
			}
		});
	
		if (intermediate.length) {
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
		}
	
	}

	if ((results === undefined) || (results.length === 0)) {
		sendAndCache(message, `Sorry, I couldn't find a dilemma matching '${searchString}'`);
	} else {
		let rex = new RegExp(/.*\*\*(.+)\*\*.*/);
		let embeds = [] as EmbedBuilder[];
		let botCrew = DCData.getBotCrew().filter(crew => crew.obtained === 'Voyage');
		let legend = [] as string[];
		results = JSON.parse(JSON.stringify(results));
		
		for (let dilemma of results) {			
			let crewurl = undefined as string | undefined;
			let dil = 0;
			[dilemma.choiceA, dilemma.choiceB, dilemma.choiceC ?? null].forEach((choice) => {
				if (choice) {
					let i = 0;
					for (let s of choice.reward) {
						if (s.includes('4') && s.includes(':star:')) {
							legend.push(dil === 0 ? 'A' : (dil === 1 ? 'B' : 'C'));
						}
						else if (rex.test(s)) {
							let result = rex.exec(s);
							if (result && result.length) {
								let crewname = result[1];
								let crew = botCrew.find(crew => crew.name === crewname);
								if (crew) {
									if (!crewurl) crewurl = crew.imageUrlPortrait;
									choice.reward[i] = choice.reward[i].replace(crew.name, `[${crew.name}](${CONFIG.DATACORE_URL}crew/${crew.symbol})`)
								}
							}
						}
						i++;
					}
				}
				dil++;
			});
			
			let r = getChoiceRarity(dilemma.choiceA);
			let r2 = getChoiceRarity(dilemma.choiceB);
			let r3 = dilemma.choiceC ? getChoiceRarity(dilemma.choiceC) : 0;
			if (r2 > r) r = r2;
			if (r3 > r) r = r3;
			if (crewurl && r < 4) r = 4;
			let embed = new EmbedBuilder()
				.setTitle(dilemma.title)
				.setColor(colorFromRarity(r))
				.addFields({ name: 'Choice A', value: formatChoice(message, dilemma.choiceA) })
				.addFields({ name: 'Choice B', value: formatChoice(message, dilemma.choiceB) });
			if (crewurl) {
				embed = embed.setThumbnail(CONFIG.ASSETS_URL+crewurl)
			}
			if (dilemma.choiceC != null) {
				embed = embed.addFields({ name: 'Choice C', value: formatChoice(message, dilemma.choiceC) });
			}
			if (r === 5 && legend.length) {
				let featured = botCrew.filter(crew => crew.max_rarity === 5).sort((a, b) => (b.date_added as Date).getTime() - (a.date_added as Date).getTime());
				if (featured?.length) {
					embed = embed.addFields({ name: `Chance of Legendary Behold (Choice ${legend.length === 3 ? 'A, B or C' : legend.join(" or ")})`, value: featured.map(f => `**[${f.name}](${CONFIG.DATACORE_URL}crew/${f.symbol})**`).join(", ") })
					if (!crewurl) {
						embed = embed.setThumbnail(CONFIG.ASSETS_URL+featured[0].imageUrlPortrait);
					}
				}
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
