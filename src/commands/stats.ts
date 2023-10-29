import { Message, MessageEmbed } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import {
	formatCrewCoolRanks,
	getBonusType,
	actionAbilityoString,
	chargePhasesToString,
	colorFromRarity,
	formatStatLine
} from '../utils/crew';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import { loadProfile, userFromMessage, applyCrewBuffs } from '../utils/profile';
import CONFIG from '../utils/config';

function getDifficulty(chronCostRank: number): string {
	let percentage = Math.round(100 - (chronCostRank * 100) / DCData.totalCrew());

	if (percentage < 11) {
		return `Super Easy (${percentage}%)`;
	}

	if (percentage < 22) {
		return `Very Easy (${percentage}%)`;
	}

	if (percentage < 33) {
		return `Easy (${percentage}%)`;
	}

	if (percentage < 44) {
		return `Below Average (${percentage}%)`;
	}

	if (percentage < 55) {
		return `Average (${percentage}%)`;
	}

	if (percentage < 66) {
		return `Above Average (${percentage}%)`;
	}

	if (percentage < 77) {
		return `Difficult (${percentage}%)`;
	}

	if (percentage < 88) {
		return `Hard (${percentage}%)`;
	}

	return `Insane (${percentage}%)`;
}

async function asyncHandler(message: Message, searchString: string, raritySearch: number, extended: boolean, base: boolean) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let results = DCData.searchCrew(searchString);
	if (results === undefined) {
		sendAndCache(message, `Sorry, I couldn't find a crew matching '${searchString}'`);
	} else if (results.length > 1) {
		sendAndCache(
			message,
			`There are ${results.length} crew matching that: ${results.map(crew => crew.name).join(', ')}. Which one did you mean?`
		);
	} else {
		let crew = results[0];

		if (raritySearch <= 0 || raritySearch >= crew.max_rarity) {
			raritySearch = 1;
		}

		let embed = new MessageEmbed()
			.setTitle(crew.name)
			.setThumbnail(`${CONFIG.ASSETS_URL}${crew.imageUrlPortrait}`)
			.setColor(colorFromRarity(crew.max_rarity))
			.setURL(`${CONFIG.DATACORE_URL}crew/${crew.symbol}/`);

		if (extended && crew.nicknames && crew.nicknames.length > 0) {
			embed = embed.addField('Also known as', `${crew.nicknames.map((n) => `${n.cleverThing}${n.creator ? ` (coined by _${n.creator}_)` : ''}`).join(', ')}`);
		}

		embed = embed.addField('Traits', `${crew.traits_named.join(', ')}*, ${crew.traits_hidden.join(', ')}*`);

		if (!base) {
			let user = await userFromMessage(message);
			if (user && user.profiles.length > 0) {
				// Apply personalization

				// TODO: multiple profiles
				let profile = await loadProfile(user.profiles[0].dbid);
				if (profile) {
					crew = JSON.parse(JSON.stringify(crew));
					crew.base_skills = applyCrewBuffs(crew.base_skills, profile.buffConfig, false);
					crew.skill_data.forEach((sd: any) => {
						sd.base_skills = applyCrewBuffs(sd.base_skills, profile!.buffConfig, false);
					});

					embed = embed.addField(
						user.profiles[0].captainName,
						`Data is customized for [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0].dbid})'s buffs`
					);
				}
			}
		}

		embed = embed
			.addField('Stats', formatStatLine(message, crew, raritySearch))
			.addField('Voyage Rank', `${crew.ranks.voyRank} of ${DCData.totalCrew()}`, true)
			.addField('Voyage Triplet', crew.ranks.voyTriplet ? `#${crew.ranks.voyTriplet.rank} ${crew.ranks.voyTriplet.name.replace(/ /g, '')}` : 'N/A', true)
			.addField('Gauntlet Rank', `${crew.ranks.gauntletRank} of ${DCData.totalCrew()}`, true)
			.addField(
				'Estimated Cost',
				`${crew.totalChronCost} ${getEmoteOrString(message, 'chrons', 'chrons')}, ${crew.factionOnlyTotal} faction`,
				true
			)
			.addField('Difficulty', getDifficulty(crew.ranks.chronCostRank), true)
			.setFooter(formatCrewCoolRanks(crew));

		if (crew.bigbook_tier && crew.events) {
			embed = embed
				.addField('Events', crew.events, true)
				.addField('Big Book Tier ', crew.bigbook_tier === -1 ? '¯\\_(ツ)_/¯' : `[${crew.bigbook_tier}](https://www.bigbook.app/crew/${crew.symbol})`, true);
		}

		if (crew.cab_ov) {
			embed = embed.addField('CAB Rating', `[${crew.cab_ov}](https://sttpowerratings.com/)`, true);
		}

		if (crew.collections && crew.collections.length > 0) {
			embed = embed.addField(
				'Collections',
				crew.collections.map((c: string) => `[${c}](${CONFIG.DATACORE_URL}collections/#${encodeURIComponent(c)}/)`).join(', ')
			);
		}

		if (extended) {
			let bonusType = getBonusType(crew.action.bonus_type);
			let shipAbilities = `+${crew.action.bonus_amount} ${getEmoteOrString(message, bonusType, bonusType)} | **Initialize:** ${
				crew.action.initial_cooldown
			}s | **Duration:** ${crew.action.duration}s | **Cooldown:** ${crew.action.cooldown}s`;

			if (crew.action.ability) {
				shipAbilities += `\n**Bonus Ability: **${actionAbilityoString(crew.action.ability)}`;
			}

			if (crew.action.charge_phases && crew.action.charge_phases.length > 0) {
				let cps = chargePhasesToString(crew.action);
				for (let i = 0; i < cps.length; i++) {
					shipAbilities += `**Charge Phase ${i + 1}:** ${cps[i]}`;
				}
			}

			if (crew.action.limit) {
				shipAbilities += `\n**Uses:** ${crew.action.limit}`;
			}

			embed = embed.addField('Ship Abilities', shipAbilities);
		}

		if (extended && crew.markdownContent && crew.markdownContent.length < 980) {
			embed = embed.addField('Big Book note', crew.markdownContent);
		}

		sendAndCache(message, '', {embeds: [embed]});

		if (extended && crew.markdownContent && crew.markdownContent.length >= 980) {
			if (crew.markdownContent.length < 2048) {
				let embed = new MessageEmbed()
					.setTitle(`Big Book note for ${crew.name}`)
					.setColor(colorFromRarity(crew.max_rarity))
					.setURL(`${CONFIG.DATACORE_URL}crew/${crew.symbol}/`)
					.setDescription(crew.markdownContent);

				sendAndCache(message, '', { embeds: [embed], isFollowUp: true });
			} else {
				// The Big Book text is simply too long, it may need to be broken down into different messages (perhaps at paragraph breaks)
				sendAndCache(message, crew.markdownContent, { isFollowUp: true });
			}
		}
	}
}

class Stats implements Definitions.Command {
	name = 'stats';
	command = 'stats <crew...>';
	aliases = ['estats'];
	describe = 'Displays stats for given crew';
	options = [
		{
			name: 'crew',
			type: 'STRING',
			description: 'name of crew or part of the name',
			required: true,
		},
		{
			name: 'extended',
			type: 'BOOLEAN',
			description: 'return extended information',
			required: false,
		},
		{
			name: 'stars',
			type: 'INTEGER',
			description: 'number of stars (fuse level) for which to display stats',
			required: false,
		},
		{
			name: 'base',
			type: 'BOOLEAN',
			description: 'return base stats (not adjusted for your profile)',
			required: false,
		}
	]
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('crew', {
				describe: 'name of crew or part of the name'
			})
			.option('stars', {
				alias: 's',
				desc: 'number of stars (fuse level) for which to display stats',
				type: 'number'
			})
			.option('base', {
				alias: 'b',
				desc: 'return base stats (not adjusted for your profile)',
				type: 'boolean'
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let extended = args['_'] ? args['_'][0] !== 'stats' : (args.extended as boolean ?? false);
		let searchString = typeof(args.crew) === 'string' ? args.crew : (<string[]>args.crew).join(' ');
		let raritySearch = args.stars ? (args.stars as number) : 0;

		args.promisedResult = asyncHandler(message, searchString, raritySearch, extended, args.base ? (args.base as boolean) : false);
	}
}

export let StatsCommand = new Stats();
