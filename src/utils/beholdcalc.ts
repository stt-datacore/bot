import { Message, Embed, EmbedBuilder } from 'discord.js';

import { DCData } from '../data/DCData';
import { formatStatLine, formatCrewCoolRanks, colorFromRarity, formatTrait, actionAbilityoString, isRecent } from './crew';
import { loadProfile, loadProfileRoster, userFromMessage, applyCrewBuffs, loadFullProfile, toTimestamp, ProfileEntry } from './profile';
import { sendAndCache } from './discord';
import CONFIG from './config';
import { PlayerData } from '../datacore/player';
import { Schematics, Ship } from '../datacore/ship';
import { shipSum } from './ships';
import { binaryLocateCrew, binaryLocateId, binaryLocateSymbol } from './items';
import { CrewMember } from '../datacore/crew';
import { handleShipBehold } from './beholdships';
import { Profile } from 'src/models/Profile';

export function isValidBehold(data: any, threshold: number = 10) {
	let scores = [data?.crew1?.score ?? 0, data?.crew2?.score ?? 0, data?.crew3?.score ?? 0];
	let crew = [data?.crew1, data?.crew2, data?.crew3];
	if (crew?.some(c => c?.symbol === 'behold_title')) {
		return false;
	}

	if (!data.top || (data.top.symbol != 'behold_title' && threshold > 1) || data.top.score < threshold) {
		if (!scores.every(e => e >= threshold)) return false;
	}

	if (!scores.every(e => e >= threshold)) return false;

	if (data.error) {
		if (data.error === "Top row doesn't look like a behold title") {
			if (!scores.every(e => e >= threshold)) return false;
			else {
				delete data.error;
			}
		}
		else {
			return false;
		}
	}

	if (data.closebuttons > 0) {
		// If we found something that looks like a close button, but other heuristics rank high, ignore it
		if ((data.crew1.score + data.crew2.score + data.crew3.score + data.top.score) / 4 < threshold * 3.5) {
			return false;
		}
	}

	return true;
}

export function isPossibleBehold(data: any, threshold: number = 10) {
	let scores = [data?.crew1?.score ?? 0, data?.crew2?.score ?? 0, data?.crew3?.score ?? 0];

	// If the image analysis found the correct top, but maybe the crew detection failed.
	// Conversely, crew analysis can succeed while the top can fail.
	if (!data.top || (data.top.symbol != 'behold_title' && threshold > 1) || data.top.score < threshold) {
		return scores.every(e => e >= threshold);
	}

	return true;
}

export function formatCrewField(message: Message, crew: Definitions.BotCrew, stars: number, custom: string, collections: string[]) {
	let reply = '';
	if (crew.bigbook_tier) {
		reply += `Big Book **tier ${crew.bigbook_tier}** ([link](https://www.bigbook.app/crew/${crew.symbol})), `;
	}
	if (crew.cab_ov) {
		reply += `CAB **grade ${crew.cab_ov_grade} (rank #${crew.cab_ov_rank}, rating: ${crew.cab_ov})**, `;
	}

	reply += `Voyage #${crew.ranks.voyRank}, Gauntlet #${crew.ranks.gauntletRank}, ${crew.events || 0} event${
		crew.events !== 1 ? 's' : ''
	}, ${crew.collections.length} collection${crew.collections.length !== 1 ? 's' : ''}`;

	let coolRanks = formatCrewCoolRanks(crew, true);
	if (coolRanks) {
		reply += `\n*${coolRanks}*`;
	}

	reply += '\n' + formatStatLine(message, crew, stars + 1);

	if (custom) {
		reply += `\n\n**${custom}**`;
	}

	return reply;
}

interface CrewFromBehold {
	crew: Definitions.BotCrew;
	stars: number;
}

function recommendations(crew: CrewFromBehold[], openCols?: string[]) {
	const ff = (c: CrewFromBehold) => {
		return c.stars == c.crew.max_rarity;
	}

	const cols = (c: CrewFromBehold) => {
		return c.crew.collections.filter(f => openCols?.includes(f)).length || 0;
	}

	let best = crew.sort((a, b) => a.crew.bigbook_tier - b.crew.bigbook_tier);
	let bestCab = [...crew].sort((a, b) => parseFloat(b.crew.cab_ov) - parseFloat(a.crew.cab_ov));
	let starBest = crew.filter(c => c.stars > 0 && c.stars < c.crew.max_rarity);
	let bestCrew: Definitions.BotCrew = best[0].crew;

	if (starBest.length > 0) {
		starBest = starBest.sort((a, b) => a.crew.bigbook_tier - b.crew.bigbook_tier);
	}

	let colBest = openCols?.length && best.length ? best.filter(c => !ff(c)).sort((a, b) => cols(b) - cols(a)) : null;

	let title = '';

	const weightBest = (starBest: CrewFromBehold, colBest: CrewFromBehold) => {
		let ac = cols(starBest);
		let bc = cols(colBest);
		let as = starBest.stars;
		let bs = colBest.stars;
		if (bc === 0) return starBest;
		if (ac === 0) return colBest;
		ac = ac / bc;
		if (as === 0 || bs === 0) return ac > 1 ? starBest : colBest;
		as = as / bs;
		if (as / ac > 1) return starBest;
		return colBest;
	}

	const printPickCols = (colBest: CrewFromBehold[], actualBest?: CrewFromBehold) => {
		let bc = cols(colBest[0]);
		starBest.sort((a, b) => b.stars - a.stars);
		if (colBest.length > 2 && colBest.every(c => cols(c) === bc)) {
			if (starBest.length) {
				title = `Pick ${starBest[0].crew.name} for collections`;
				bestCrew = starBest[0].crew;
			}
			else {
				title = `Pick anyone for collections`
			}
		}
		else if (colBest.length > 1 && colBest.every(c => cols(c) === bc)) {
			let sbc = starBest.filter(f => colBest.includes(f));
			if (sbc.length >= 2 && sbc.every(sd => sbc.every(se => sd.stars === se.stars))) {
				title = `Pick ${colBest[0].crew.name} or ${colBest[1].crew.name} for collections`;
				bestCrew = colBest[0].crew;
			}
			else {
				let sbc = weightBest(starBest[0], colBest[0]);
				title = `Pick ${sbc.crew.name} for collections`;
				bestCrew = sbc.crew;
				// title = `Pick ${starBest[0].crew.name} for collections`;
				// bestCrew = starBest[0].crew;
			}
		}
		else {
			if (starBest.length > 0) {
				starBest.sort((a, b) => b.stars - a.stars);
				let sbc = weightBest(starBest[0], colBest[0]);
				title = `Pick ${sbc.crew.name} for collections`;
				bestCrew = sbc.crew;
			}
			else {
				title = `Pick ${colBest[0].crew.name} for collections`;
				bestCrew = colBest[0].crew;
			}
		}
		if (actualBest && actualBest.crew !== bestCrew) {
			title += `, but ${actualBest.crew.name} is the best crew in this behold`
		}
	}

	if (best[0].crew.bigbook_tier >= 7) {
		if (starBest.length > 1 && colBest?.length) {
			printPickCols(colBest);
		} else if (starBest.length > 0) {
			title = `Add a star to ${starBest[0].crew.name}`;
			bestCrew = starBest[0].crew;
		} else {
			title = `Pick ${best[0].crew.name} if you have room`;
			bestCrew = best[0].crew;
		}
	} else if (starBest.length > 0 && starBest[0].crew != best[0].crew && !ff(best[0])) {
		if (starBest[0].crew.bigbook_tier > 5) {
			title = `${best[0].crew.name} is your best bet; star up ${starBest[0].crew.name} if you don't have any slots to spare`;
		} else {
			title = `Add a star to ${starBest[0].crew.name} or pick ${best[0].crew.name} if you have room`;
			bestCrew = starBest[0].crew;
		}
	} else if (best.find((c,i)=> i != 0 && c.crew.bigbook_tier == best[0].crew.bigbook_tier && !ff(c)) && !ff(best[0])) {
		// There's an equally good option, neither FF
		let equals = best.filter((c,i) => i != 0 && c.crew.bigbook_tier == best[0].crew.bigbook_tier && !ff(c));
		if (equals.length == 2) {
			title = `Pick anyone`
		} else {
			title = `Pick ${best[0].crew.name} or ${equals[0].crew.name}`;
		}
	} else if (starBest.length > 0 && ff(best[0])) {
		if (best[1].crew.bigbook_tier < 3 && !ff(best[1])) {
			title = `${best[1].crew.name} is your best bet, unless you want to start another ${best[0].crew.name}`;
			bestCrew = best[1].crew;
		} else {
			if (colBest?.length && cols(colBest[0])) {
				printPickCols(colBest, best[0]);
			}
			else {
				title = `Pick ${starBest[0].crew.name} if you don't want dupes, but ${best[0].crew.name} is the best crew in this behold`;
			}
			//title = `It may be worth starting another ${best[0].crew.name}, pick ${starBest[0].crew.name} if you don't want dupes`;
		}
	} else {
		if (colBest?.length && cols(colBest[0]) && !(isRecent(best[0].crew)) && (best[0].crew.bigbook_tier > 4 || best[0].crew.max_rarity === best[0].stars)) {
			printPickCols(colBest, best[0]);
		}
		else {
			title = `${best[0].crew.name} is your best bet`
		}
	}

	let suffix = ".";
	if (Math.abs(best[0].crew.bigbook_tier - best[1].crew.bigbook_tier) <= 1 &&
		Math.abs(best[0].crew.bigbook_tier - best[2].crew.bigbook_tier) <= 1 &&
		Math.abs(best[1].crew.bigbook_tier - best[2].crew.bigbook_tier) <= 1) {
		suffix = " but check their links as tiers are similar."
	}
	title += suffix;
	if (best[0] !== bestCab[0]) {
		if (title.includes('collections')) {
			title = `${title}\n\nBig Book Recommendation: ${best[0].crew.name}\nCAB Ratings recommendation: ${bestCab[0].crew.name}`
		}
		else {
			title = `Big Book recommendation: ${title}\nCAB Ratings recommendation: ${bestCab[0].crew.name}`
		}
	}

	return {
		best: bestCrew,
		description: title
	};
}

function formatCollections(collections: any[], open_cols?: string[] | null) {
	if (!collections?.length) return "None";
	if (open_cols) {
		return collections.map(c => `[${open_cols.includes(c) ? c : '~~' + c + '~~'}](${CONFIG.DATACORE_URL}collections?select=${encodeURIComponent(c)})`).join(', ') + "";
	}
	else {
		return collections.map(c => `[${c}](${CONFIG.DATACORE_URL}collections?select=${encodeURIComponent(c)})`).join(', ') + "";
	}
}

function applyCrew(increw: Definitions.BotCrew, buffConfig: Definitions.BuffConfig): Definitions.BotCrew {
	let crew: Definitions.BotCrew = JSON.parse(JSON.stringify(increw));
	crew.base_skills = applyCrewBuffs(crew.base_skills, buffConfig, false);
	crew.skill_data.forEach(sd => {
		sd.base_skills = applyCrewBuffs(sd.base_skills, buffConfig, false);
	});

	return crew;
}

export async function calculateBehold(message: Message, beholdResult: any, fromCommand: boolean, base: boolean) {

	let results = [beholdResult.crew1, beholdResult.crew2, beholdResult.crew3];

	if (results.every(r => r.symbol.startsWith("model_"))) {
		return handleShipBehold(message, beholdResult, fromCommand, base);
	}

	let _bc = DCData.getBotCrew();

	let crew1 = binaryLocateCrew(beholdResult.crew1.symbol, _bc);
	let crew2 = binaryLocateCrew(beholdResult.crew2.symbol, _bc);
	let crew3 = binaryLocateCrew(beholdResult.crew3.symbol, _bc);

	// let crew1 = _bc.find(f => f.symbol === beholdResult.crew1.symbol);
	// let crew2 = _bc.find(f => f.symbol === beholdResult.crew2.symbol);
	// let crew3 = _bc.find(f => f.symbol === beholdResult.crew3.symbol);

	if (!crew1 || !crew2 || !crew3) {
		if (fromCommand) {
			sendAndCache(message, `Sorry, if that was a valid behold I wasn't able to find the crew.`);
		}

		return false;
	}

	if ([crew1, crew2, crew3].some(crew => !crew || crew.max_rarity < 4)) {
		// Not a behold, or couldn't find the crew
		if (fromCommand) {
			sendAndCache(
				message,
				`Sorry, if that was a valid behold I wasn't able to find the correct crew (${crew1.name}, ${crew2.name}, ${crew3.name}).`
			);
		}

		return false;
	}

	let embed = new EmbedBuilder()
		.setTitle('Detailed comparison')
		.setColor(colorFromRarity(crew1.max_rarity))
		.setURL(`${CONFIG.DATACORE_URL}behold/?crew=${crew1.symbol}&crew=${crew2.symbol}&crew=${crew3.symbol}`);

	let customranks = ['', '', ''];

	let isStale = undefined as boolean | undefined;
	let days = 0;
	let open_cols = null as string[] | null;
	if (!base) {
		let user = await userFromMessage(message);
		if (user && user.profiles.length > 0) {
			// Apply personalization
			let profile = await loadProfile(user.profiles[0].dbid);
			let open_collection_ids = profile?.metadata?.open_collection_ids || DCData.getCollections().map(m => Number(m.id));
			open_cols = open_collection_ids ? DCData.getCollectionNamesFromIds(open_collection_ids) : null;

			if (profile) {
				days = Math.round(((new Date()).getTime() - profile.lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
				if (days > 7) isStale = true;

				profile.crew.sort((a, b) => a.id - b.id);

				crew1 = applyCrew(crew1, profile.buffConfig);
				crew2 = applyCrew(crew2, profile.buffConfig);
				crew3 = applyCrew(crew3, profile.buffConfig);

				const bcrew = [crew1, crew2, crew3];

				let found = [1, 1, 1];
				let i = 0;

				for (let bc of bcrew) {
					let filter = profile.crew.filter(crew => bc.archetype_id === crew.id);
					if (filter?.length) {
						if (filter.length > 1) {
							filter.sort((a, b) => {
								if (a.rarity !== undefined && b.rarity !== undefined) {
									return a.rarity - b.rarity;
								}
								else if (a.rarity !== undefined) {
									return -1;
								}
								else if (b.rarity !== undefined) {
									return 1;
								}
								else {
									return 0;
								}
							});
						}

						let entry = filter[0];
						beholdResult["crew" + (i + 1).toString()].stars = entry.rarity ?? bc.max_rarity;

						if (entry.rarity !== undefined && entry.rarity < bc.max_rarity) {
							found[i] = entry.rarity + 1;
						}
					}

					i++;
					if (i >= 3) break;
				}

				for (let i = 0; i < 3; i++) {
					if (found[i] === 1) {
						profile.crew.push({ id: bcrew[i].archetype_id, rarity: 1 });
					}
				}

				let roster = loadProfileRoster(profile);

				roster = roster.sort((a, b) => b.voyageScore - a.voyageScore);
				let voyranks = bcrew.map(crew => roster.findIndex(e => e.crew.archetype_id === crew.archetype_id));

				roster = roster.sort((a, b) => b.gauntletScore - a.gauntletScore);
				let gauntletranks = bcrew.map(crew => roster.findIndex(e => e.crew.archetype_id === crew.archetype_id));

				for (let i = 0; i < 3; i++) {
					customranks[i] = `For your roster (at ${found[i]} stars FE), ${bcrew[i].name} would be Voyage #${voyranks[i] +
						1}, Gauntlet #${gauntletranks[i] + 1}`;
				}

				embed = embed.addFields({
					name: user.profiles[0].captainName,
					value: `Stats and stars are computed from [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0].dbid})'s buffs and crew roster. (Last updated: ${toTimestamp(profile.lastUpdate)})`
				});
			}
		}
	}

	const { best, description } = recommendations([
		{ crew: crew1, stars: beholdResult.crew1.stars },
		{ crew: crew2, stars: beholdResult.crew2.stars },
		{ crew: crew3, stars: beholdResult.crew3.stars }
	], open_cols || undefined);


	embed = embed
		.setThumbnail(`${CONFIG.ASSETS_URL}${best.imageUrlPortrait}`)
		.setDescription(description)
		.addFields({ name: crew1.name, value: formatCrewField(message, crew1, beholdResult.crew1.stars, customranks[0], crew1.collections)})
		.addFields({ name: "Collections", value: formatCollections(crew1.collections, open_cols)})
		.addFields({ name: crew2.name, value: formatCrewField(message, crew2, beholdResult.crew2.stars, customranks[1], crew2.collections)})
		.addFields({ name: "Collections", value: formatCollections(crew2.collections, open_cols)})
		.addFields({ name: crew3.name, value: formatCrewField(message, crew3, beholdResult.crew3.stars, customranks[2], crew3.collections)})
		.addFields({ name: "Collections", value: formatCollections(crew3.collections, open_cols)})

		embed = embed.setFooter({
			text: customranks[0]
				? 'Make sure to re-upload your profile frequently to get accurate custom recommendations'
				: `Upload your profile to get custom recommendations`
		});

		// if (isStale) {
		// 	embed = embed.setFooter({
		// 		text: `**Your profile data is ${days} old!** Make sure to re-upload your profile frequently to get accurate custom recommendations`
		// 	});

		// }
		// else {
		// 	embed = embed.setFooter({
		// 		text: customranks[0]
		// 			? 'Make sure to re-upload your profile frequently to get accurate custom recommendations'
		// 			: `Upload your profile to get custom recommendations`
		// 	});
		// }

	sendAndCache(message, '', {embeds: [embed]});

	return true;
}
