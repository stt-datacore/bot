import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';

import { DCData, POST_BIGBOOK_EPOCH } from '../data/DCData';
import {
	formatCrewCoolRanks,
	getBonusType,
	actionAbilityoString,
	chargePhasesToString,
	colorFromRarity,
	formatStatLine
} from '../utils/crew';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import { loadProfile, userFromMessage, applyCrewBuffs, toTimestamp } from '../utils/profile';
import CONFIG from '../utils/config';
import { Definitions } from 'src/utils/definitions';

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

function addAuthorNotes(crew: Definitions.BotCrew, embed: EmbedBuilder) {
	if (crew?.markdownInfo?.author && crew?.markdownInfo?.modified) {
		embed = embed.addFields({
			name: "Note Author",
			value: crew.markdownInfo.author,
			inline: true
		},
		{
			name: "Note Date",
			value: toTimestamp(new Date(crew.markdownInfo.modified), 'd'),
			inline: true
		});
	}
	return embed;
}

async function asyncHandler(message: Message, searchString: string, raritySearch: number, extended: boolean, base: boolean) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));
	let open_collection_ids = null as number[] | null;
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

		let embed = new EmbedBuilder()
			.setTitle(crew.name)
			.setThumbnail(`${CONFIG.ASSETS_URL}${crew.imageUrlPortrait}`)
			.setColor(colorFromRarity(crew.max_rarity))
			.setURL(`${CONFIG.DATACORE_URL}crew/${crew.symbol}/`);

		if (extended && crew.nicknames && crew.nicknames.length > 0 && crew.nicknames[0].cleverThing && crew.nicknames[0].creator) {
			embed = embed.addFields({ name: 'Also known as', value: `${crew.nicknames.map((n) => `${n.cleverThing}${n.creator ? ` (coined by _${n.creator}_)` : ''}`).join(', ')}` });
		}

		embed = embed.addFields({ name: 'Traits', value: `${crew.traits_named.join(', ')}*, ${crew.traits_hidden.join(', ')}*` });

		if (!base) {
			let user = await userFromMessage(message);
			if (user && user.profiles.length > 0) {
				// Apply personalization

				// TODO: multiple profiles
				let profile = await loadProfile(user.profiles[0].dbid);
				if (profile) {
					open_collection_ids = profile.metadata?.open_collection_ids ?? null;
					crew = JSON.parse(JSON.stringify(crew));
					crew.base_skills = applyCrewBuffs(crew.base_skills, profile.buffConfig, false);
					crew.skill_data.forEach((sd: any) => {
						sd.base_skills = applyCrewBuffs(sd.base_skills, profile!.buffConfig, false);
					});

					embed = embed.addFields({
						name: user.profiles[0].captainName,
						value: `Data is customized for [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0].dbid})'s buffs`
					});
				}
			}
		}

		embed = embed
			.addFields({ name: 'Stats', value: formatStatLine(message, crew, raritySearch) })
			.addFields({ name: 'Voyage Rank', value: `${crew.ranks.voyRank} of ${DCData.totalCrew()}`, inline: true })
			.addFields({ name: 'Voyage Triplet', value: crew.ranks.voyTriplet ? `#${crew.ranks.voyTriplet.rank} ${crew.ranks.voyTriplet.name.replace(/ /g, '')}` : 'N/A', inline: true })
			.addFields({ name: 'Gauntlet Rank', value: `${crew.ranks.gauntletRank} of ${DCData.totalCrew()}`, inline: true })
			.addFields({
				name: 'Estimated Cost',
				value: `${crew.totalChronCost} ${getEmoteOrString(message, 'chrons', 'chrons')}, ${crew.factionOnlyTotal} faction`,
				inline: true
			})
			.addFields({ name: 'Difficulty', value: getDifficulty(crew.ranks.chronCostRank), inline: true })
			.setFooter({ text: formatCrewCoolRanks(crew) });

		if (typeof crew.date_added === 'string') crew.date_added = new Date(crew.date_added);

		if (extended && crew.obtained && crew.date_added) {
			embed = embed
				.addFields({ name: 'Date Added', value: crew.date_added.toDateString(), inline: true })
				.addFields({ name: 'Obtained', value: crew.obtained.replace("Event/Pack/Giveaway", "Event, Pack, or Giveaway"), inline: true })
				.addFields({ name: 'In Portal', value: crew.in_portal ? "Yes" : "No", inline: true })
		}

		if (crew.bigbook_tier) {
			if (crew.bigbook_tier == -1 && crew.date_added.getTime() > POST_BIGBOOK_EPOCH.getTime()) {
				embed = embed
					.addFields({ name: 'Big Book Tier ', value: 'N/A', inline: true });
			}
			else {
				embed = embed
					.addFields({ name: 'Big Book Tier ', value: crew.bigbook_tier === -1 ? '¯\\_(ツ)_/¯' : `${crew.bigbook_tier}`, inline: true });
			}
		}

		if (crew.cab_ov) {
			embed = embed.addFields({ name: 'CAB Grade', value: `[${crew.cab_ov_grade}](https://cabtools.app/)`, inline: true });
			embed = embed.addFields({ name: 'CAB Rating', value: `[${crew.cab_ov}](https://cabtools.app/)`, inline: true });
			embed = embed.addFields({ name: 'CAB Rank', value: `[${crew.cab_ov_rank}](https://cabtools.app/)`, inline: true });
		}

		if (crew.collections && crew.collections.length > 0) {
			if (open_collection_ids) {
				let ocols = DCData.getCollectionNamesFromIds(open_collection_ids);
				embed = embed.addFields({
					name: 'Collections',
					value: crew.collections.map((c: string) => `[${ocols.includes(c) ? c : '~~' + c + '~~'}](${CONFIG.DATACORE_URL}collections/#${encodeURIComponent(c)}/)`).join(', ')
				});
			}
			else {
				embed = embed.addFields({
					name: 'Collections',
					value: crew.collections.map((c: string) => `[${c}](${CONFIG.DATACORE_URL}collections/#${encodeURIComponent(c)}/)`).join(', ')
				});
			}
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

			embed = embed.addFields({ name: 'Ship Abilities', value: shipAbilities });
		}

		let mdContent = crew.markdownContent;
		//mdContent += `\n\n[More at Bigbook.app](https://www.bigbook.app/crew/${crew.symbol})`;

		if (extended && mdContent && mdContent.length < 980) {
			embed = embed.addFields({ name: 'Big Book note', value: mdContent });
			embed = addAuthorNotes(crew, embed);
		}

		await sendAndCache(message, '', {embeds: [embed]});

		if (extended && mdContent && mdContent.length >= 980) {
			if (mdContent.length < 2000) {
				let embed = new EmbedBuilder()
					.setTitle(`Big Book note for ${crew.name}`)
					.setColor(colorFromRarity(crew.max_rarity))
					//.setURL(`https://www.bigbook.app/crew/${crew.symbol}/`)
					.setDescription(mdContent)
				embed = addAuthorNotes(crew, embed);
				await sendAndCache(message, '', { embeds: [embed], isFollowUp: true });
			} else {
				// The Big Book text is simply too long, it may need to be broken down into different messages (perhaps at paragraph breaks)
				let markdownChunks = mdContent.split('\n');
				let space = false;
				if (markdownChunks.length === 1) {
					markdownChunks = mdContent.split(" ");
					space = true;
				}

				let markdown = "";
				let n = 0;
				let p = 1;
				let embeds = [] as EmbedBuilder[];

				while (markdownChunks.length) {
					let c = markdownChunks.length;
					let i = 0;
					for (i = 0; i < c; i++) {
						if ((n + markdownChunks[i].length + 4) >= 1998) break;
						n += markdownChunks[i].length;
						if (markdown.length) {
							if (space) markdown += " ";
							else markdown += "\n";
							n++;
						}
						markdown += markdownChunks[i];
					}

					if (!markdown?.length) break;

					let embed = new EmbedBuilder()
						.setTitle(`Big Book note for ${crew.name}, Part ${p++}`)
						.setColor(colorFromRarity(crew.max_rarity))
						//.setURL(`https://www.bigbook.app/crew/${crew.symbol}/`)
						.setDescription(markdown);
					embeds.push(embed);

					markdownChunks.splice(0, i);
					markdown = "";
					n = 0;
				}

				if (embeds.length === 1) {
					embeds[0] = embeds[0].setTitle(`Big Book note for ${crew.name}`);
				}
				if (embeds.length > 0) {
					embeds[embeds.length - 1] = addAuthorNotes(crew, embeds[embeds.length - 1])
				}
				for (let embed of embeds) {
					await sendAndCache(message, '', { embeds: [embed], isFollowUp: true });
				}
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
			type: ApplicationCommandOptionType.String,
			description: 'name of crew or part of the name',
			required: true,
		},
		{
			name: 'extended',
			type: ApplicationCommandOptionType.Boolean,
			description: 'return extended information',
			required: false,
		},
		{
			name: 'stars',
			type: ApplicationCommandOptionType.Integer,
			description: 'number of stars (fuse level) for which to display stats',
			required: false,
		},
		{
			name: 'base',
			type: ApplicationCommandOptionType.Boolean,
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
