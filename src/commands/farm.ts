import { Message, MessageEmbed } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { formatSources, formatRecipe } from '../utils/items';
import { colorFromRarity } from '../utils/crew';
import { sendAndCache } from '../utils/discord';
import CONFIG from '../utils/config';

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
	searchString: string,
	raritySearch: number,
	extended: boolean,
	adjustForKit: boolean
) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let results = DCData.searchItems(searchString, raritySearch);

	if (results === undefined) {
		sendAndCache(message, `Sorry, I couldn't find an item matching '${searchString}'`);
	} else if (results.length > 1) {
		sendAndCache(message, `There are ${results.length} items matching that. Which one did you mean?`);
		results.forEach((item) => {
			let shortSymbol = item.symbol.replace(/_quality.*/, '');
			let embed = new MessageEmbed()
				.setTitle(item.name)
				.setDescription(`\`${shortSymbol}\``)
				.setThumbnail(`${CONFIG.ASSETS_URL}${item.imageUrl}`)
				.setColor(colorFromRarity(item.rarity))
				.setURL(`${CONFIG.DATACORE_URL}item_info?symbol=${item.symbol}`);
			sendAndCache(message, embed);
		});
	} else {
		let item = results[0];

		if (extended) {
			// TODO: crew that equips it, recipes it's part of, etc.
			let embed = new MessageEmbed()
				.setTitle(item.name)
				.setThumbnail(`${CONFIG.ASSETS_URL}${item.imageUrl}`)
				.setColor(colorFromRarity(item.rarity))
				.setURL(`${CONFIG.DATACORE_URL}item_info?symbol=${item.symbol}`);

			if (item.bonuses) {
				let bonuses = Object.keys(item.bonuses).map(bonus => `${bonusName(bonus)} +${item.bonuses[bonus]}`);
				embed = embed.addField('Bonuses', bonuses.join(', '));
			}

			let laterRecipe = '';
			let laterSources = '';

			if (!item.item_sources || item.item_sources.length === 0) {
				laterRecipe = formatRecipe(message, item, true);
				if (laterRecipe.length < 1000) {
					embed = embed.addField('Recipe', laterRecipe);
					laterRecipe = '';
				}
			} else {
				laterSources = formatSources(message, item, adjustForKit, true);
				if (laterSources.length < 1000) {
					embed = embed.addField('Sources', laterSources);
					laterSources = '';
				}
			}

			let crew_levels: any[] = [];
			DCData.getBotCrew().forEach(crew => {
				crew.equipment_slots.forEach((es: any) => {
					if (es.symbol === item.symbol) {
						crew_levels.push({
							crew: crew,
							level: es.level
						});
					}
				});
			});

			if (crew_levels.length > 0) {
				let equip = crew_levels
					.slice(0, 10)
					.map((cl: any) => `[${cl.crew.name}](${CONFIG.DATACORE_URL}crew/${cl.crew.symbol}/) at level ${cl.level}`)
					.join('\n');

				if (crew_levels.length > 10) {
					equip += `\nand ${crew_levels.length - 10} more (see site for details)`;
				}

				embed = embed.addField('Equippable by this crew', equip);
			}

			if (embed.fields && embed.fields.length > 0) {
				sendAndCache(message, embed);
			}

			if (laterSources.length > 0) {
				if (laterSources.length < 1024) {
					let embed = new MessageEmbed()
						.setTitle(`Item sources for ${item.name}`)
						.setThumbnail(`${CONFIG.ASSETS_URL}${item.imageUrl}`)
						.setColor(colorFromRarity(item.rarity))
						.setURL(`${CONFIG.DATACORE_URL}item_info?symbol=${item.symbol}`)
						.setDescription(laterSources);

					// TODO: cache only holds the last one (for deletion)
					sendAndCache(message, embed);
				} else {
					// The text is simply too long, it may need to be broken down into different messages (perhaps at paragraph breaks)
					sendAndCache(message, laterSources);
				}
			}

			if (laterRecipe.length > 0) {
				if (laterRecipe.length < 2048) {
					let embed = new MessageEmbed()
						.setTitle(`Recipe for ${item.name}`)
						.setThumbnail(`${CONFIG.ASSETS_URL}${item.imageUrl}`)
						.setColor(colorFromRarity(item.rarity))
						.setURL(`${CONFIG.DATACORE_URL}item_info?symbol=${item.symbol}`)
						.setDescription(laterRecipe);

					// TODO: cache only holds the last one (for deletion)
					sendAndCache(message, embed);
				} else {
					// The text is simply too long, it may need to be broken down into different messages (perhaps at paragraph breaks)
					sendAndCache(message, laterRecipe);
				}
			}
		} else {
			let reply = '';
			if (!item.item_sources || item.item_sources.length === 0) {
				reply = formatRecipe(message, item);
			} else {
				reply = formatSources(message, item, adjustForKit);
			}
			sendAndCache(message, reply);
		}
	}
}

class Farm implements Definitions.Command {
	name = 'farm';
	command = 'farm <rarity> <name..>';
	aliases = ['item'];
	describe = 'Searches drop rates and/or recipes for items';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('rarity', {
				describe: 'rarity (0-5)',
				type: 'number',
				default: 0
			})
			.positional('name', {
				describe: "(part of the) item's name"
			})
			.option('kit', {
				alias: 'k',
				desc: 'adjust the chroniton cost for a supply kit',
				type: 'boolean'
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let extended = args['_'][0] === 'item';
		let searchString = (<string[]>args.name).join(' ');
		let raritySearch = args.rarity ? (args.rarity as number) : 0;
		let adjustForKit = !!args.kit;

		if (raritySearch < 0 || raritySearch > 5) {
			sendAndCache(message, `The rarity must be a number between 0 and 5 (got ${raritySearch})`);
		}

		args.promisedResult = asyncHandler(message, searchString, raritySearch, extended, adjustForKit);
	}
}

export let FarmCommand = new Farm();
