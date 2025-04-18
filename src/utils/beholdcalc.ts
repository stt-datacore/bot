import { Message, EmbedBuilder } from 'discord.js';

import { DCData } from '../data/DCData';
import { formatStatLine, formatCrewCoolRanks, colorFromRarity, isRecent } from './crew';
import { loadProfile, loadProfileRoster, userFromMessage, applyCrewBuffs, toTimestamp } from './profile';
import { sendAndCache } from './discord';
import CONFIG from './config';
import { binaryLocateCrew } from './items';
import { handleShipBehold } from './beholdships';
import { Definitions } from './definitions';

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

	reply += `\n([DataCore Link](${CONFIG.DATACORE_URL}crew/${crew.symbol}))\n`;

	if (crew.ranks.scores) {
		reply += `DataScore **grade ${crew.ranks.scores.overall_grade} (rank #${crew.ranks.scores.overall_rank}, rating: ${crew.ranks.scores.overall})**, `;
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

const grades = (() => {
	const strs = [] as string[]
	const bg = ['A', 'B', 'C', 'D', 'F'];
	for (let g of bg) {
		strs.push(`${g}+`);
		strs.push(`${g}`);
		strs.push(`${g}-`);
	}
	return strs;
})();

function getGradeIdx(crew: Definitions.BotCrew) {
	let r = 0;
	if (crew.ranks.scores) {
		r = grades.indexOf(crew.ranks.scores.overall_grade);
	}
	else {
		r = grades.indexOf(crew.cab_ov_grade);
	}
	return r;
}

function compGradeIdx(a: CrewFromBehold, b: CrewFromBehold) {
	return getGradeIdx(a.crew) - getGradeIdx(b.crew);
}

function sortBest(crew: CrewFromBehold[]) {
	return crew.sort((a, b) => {
		let r = compGradeIdx(a, b);
		if (r == 0 && a.crew.ranks.scores && b.crew.ranks.scores) r = b.crew.ranks.scores.overall - a.crew.ranks.scores.overall;
		else if (r == 0) r = Number(b.crew.cab_ov) - Number(a.crew.cab_ov);
		return r;
	});
}

function recommendations(crew: CrewFromBehold[], openCols?: string[]) {
	const ff = (c: CrewFromBehold) => {
		return c.stars == c.crew.max_rarity;
	}

	const cols = (c: CrewFromBehold) => {
		return c?.crew?.collections?.filter(f => openCols?.includes(f))?.length || 0;
	}

	let best = sortBest(crew);
	let bestCab = [...crew].sort((a, b) => Number(b.crew.cab_ov) - Number(a.crew.cab_ov));
	let starBest = crew.filter(c => c.stars > 0 && c.stars < c.crew.max_rarity);
	//let bestCrew: Definitions.BotCrew = best[0].crew;

	if (starBest.length > 0) {
		starBest = sortBest(starBest);
	}

	let colBest = openCols?.length && best.length ? best.filter(c => !ff(c)).sort((a, b) => cols(b) - cols(a)) : null;

	const result = {
		best: best[0].crew,
		cabBest: null as Definitions.BotCrew | null,
		starBest: null as Definitions.BotCrew | null,
		colBest: null as Definitions.BotCrew | null,
	}

	if (best?.length) result.best = best[0].crew;
	if (starBest?.length && starBest[0].crew !== result.best) result.starBest = starBest[0].crew;
	if (bestCab?.length && bestCab[0].crew !== result.best) result.cabBest = bestCab[0].crew;
	if (colBest?.length && colBest[0].crew !== result.best && colBest[0].crew !== result.starBest) result.colBest = colBest[0].crew;

	return result;

	// let title = '';

	// const weightBest = (starBest: CrewFromBehold, colBest: CrewFromBehold) => {
	// 	if (!starBest && colBest) return colBest;
	// 	if (starBest && !colBest) return starBest;
	// 	let ac = starBest ? cols(starBest) : 1;
	// 	let bc = colBest ? cols(colBest) : 1;
	// 	let as = starBest?.stars ?? 1;
	// 	let bs = colBest?.stars ?? 1;
	// 	if (bc === 0 && starBest) return starBest;
	// 	if (ac === 0 && colBest) return colBest;
	// 	ac = ac / bc;
	// 	if (as === 0 || bs === 0) return ac > 1 ? starBest : colBest;
	// 	as = as / bs;
	// 	if (as / ac > 1) return starBest;
	// 	return colBest;
	// }

	// const printPickCols = (colBest: CrewFromBehold[], actualBest?: CrewFromBehold) => {
	// 	let bc = cols(colBest[0]);
	// 	starBest.sort((a, b) => b.stars - a.stars);
	// 	if (colBest.length > 2 && colBest.every(c => cols(c) === bc)) {
	// 		if (starBest.length) {
	// 			title = `Add a star to ${starBest[0].crew.name}`;
	// 			bestCrew = starBest[0].crew;
	// 		}
	// 		else {
	// 			title = `Pick anyone`
	// 		}
	// 	}
	// 	else if (colBest.length > 1 && colBest.every(c => cols(c) === bc)) {
	// 		let sbc = starBest.filter(f => colBest.includes(f));
	// 		if (sbc.length >= 2 && sbc.every(sd => sbc.every(se => sd.stars === se.stars))) {
	// 			title = `Pick ${colBest[0].crew.name} or ${colBest[1].crew.name}`;
	// 			bestCrew = colBest[0].crew;
	// 		}
	// 		else {
	// 			let sbc = weightBest(starBest[0], colBest[0]);
	// 			title = `Pick ${sbc.crew.name} for collections`;
	// 			bestCrew = sbc.crew;
	// 			// title = `Pick ${starBest[0].crew.name} for collections`;
	// 			// bestCrew = starBest[0].crew;
	// 		}
	// 	}
	// 	else {
	// 		if (starBest.length > 0) {
	// 			starBest.sort((a, b) => b.stars - a.stars);
	// 			let sbc = weightBest(starBest[0], colBest[0]);
	// 			if (sbc.stars > 0 && sbc.stars < sbc.crew.max_rarity) {
	// 				title = `Add a star to ${sbc.crew.name}`;
	// 				bestCrew = sbc.crew;
	// 			}
	// 			else {
	// 				title = `Pick ${colBest[0].crew.name} for collections`;
	// 				bestCrew = colBest[0].crew;
	// 			}
	// 		}
	// 		else {
	// 			title = `Pick ${colBest[0].crew.name} for collections`;
	// 			bestCrew = colBest[0].crew;
	// 		}
	// 	}
	// }

	// const lower = 11.2;
	// const medium = 8;
	// const high = 14;

	// if (parseFloat(best[0].crew.cab_ov) <= lower) {
	// 	if (starBest.length > 1 && colBest?.length) {
	// 		printPickCols(colBest);
	// 	} else if (starBest.length > 0) {
	// 		title = `Add a star to ${starBest[0].crew.name}`;
	// 		bestCrew = starBest[0].crew;
	// 	} else {
	// 		if (best[0].stars === 0)
	// 			title = `Pick ${best[0].crew.name} if you have room`;
	// 		else
	// 			title = `Pick ${best[0].crew.name}`;
	// 		bestCrew = best[0].crew;
	// 	}
	// } else if (starBest.length > 0 && starBest[0].crew != best[0].crew && !ff(best[0])) {
	// 	if (parseFloat(starBest[0].crew.cab_ov) < medium) {
	// 		title = `${best[0].crew.name} is your best bet; star up ${starBest[0].crew.name} if you don't have any slots to spare`;
	// 	} else {
	// 		if (best[0].stars === 0)
	// 			title = `Add a star to ${starBest[0].crew.name} or pick ${best[0].crew.name} if you have room`;
	// 		else
	// 			title = `Pick ${starBest[0].crew.name} or ${best[0].crew.name}`;
	// 		bestCrew = starBest[0].crew;
	// 	}
	// } else if (best.find((c,i)=> i != 0 && parseFloat(c.crew.cab_ov) == parseFloat(crew[0].crew.cab_ov) && !ff(c)) && !ff(best[0])) {
	// 	// There's an equally good option, neither FF
	// 	let equals = best.filter((c,i) => i != 0 && parseFloat(c.crew.cab_ov) == parseFloat(crew[0].crew.cab_ov) && !ff(c));
	// 	if (equals.length == 2) {
	// 		title = `Pick anyone`
	// 	} else {
	// 		title = `Pick ${best[0].crew.name} or ${equals[0].crew.name}`;
	// 	}
	// } else if (starBest.length > 0 && ff(best[0])) {
	// 	if (parseFloat(crew[1].crew.cab_ov) < 3 && !ff(best[1])) {
	// 		title = `${best[1].crew.name} is your best bet, unless you want to start another ${best[0].crew.name}`;
	// 		bestCrew = best[1].crew;
	// 	} else {
	// 		if (colBest?.length && cols(colBest[0])) {
	// 			printPickCols(colBest, best[0]);
	// 		}
	// 		else {
	// 			if (best[0].stars === best[0].crew.max_rarity)
	// 				title = `Pick ${starBest[0].crew.name} if you don't want dupes, or start another ${best[0].crew.name}`;
	// 			else
	// 				title = `${best[0].crew.name} is your best bet`;
	// 		}
	// 		//title = `It may be worth starting another ${best[0].crew.name}, pick ${starBest[0].crew.name} if you don't want dupes`;
	// 	}
	// } else {
	// 	if (colBest?.length && cols(colBest[0]) && !(isRecent(best[0].crew)) && (parseFloat(crew[0].crew.cab_ov) < high || best[0].crew.max_rarity === best[0].stars)) {
	// 		printPickCols(colBest, best[0]);
	// 	}
	// 	else {
	// 		title = `${best[0].crew.name} is your best bet`
	// 	}
	// }

	// let suffix = ".";
	// if (Math.abs(parseFloat(crew[1].crew.cab_ov) - parseFloat(crew[0].crew.cab_ov)) <= 1 &&
	// 	Math.abs(parseFloat(crew[2].crew.cab_ov) - parseFloat(crew[0].crew.cab_ov)) <= 1 &&
	// 	Math.abs(parseFloat(crew[2].crew.cab_ov) - parseFloat(crew[1].crew.cab_ov)) <= 1) {
	// 	suffix = ", but check their links as ranks are similar."
	// }

	// title += suffix;
	// // if (best[0] !== bestCab[0]) {
	// // 	if (title.includes('collections')) {
	// // 		title = `${title}\n\nBig Book Recommendation: ${best[0].crew.name}\nCAB Ratings recommendation: ${bestCab[0].crew.name}`
	// // 	}
	// // 	else {
	// // 		title = `Big Book recommendation: ${title}\nCAB Ratings recommendation: ${bestCab[0].crew.name}`
	// // 	}
	// // }

	// return {
	// 	best: bestCrew,
	// 	description: title
	// };
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
	const userdata = { name: null as string | null, value: null as string | null };
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
				userdata.name = user.profiles[0].captainName;
				userdata.value = `Stats and stars are computed from [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0].dbid})'s buffs and crew roster. (Last updated: ${toTimestamp(profile.lastUpdate)})`;
			}
		}
	}

	const workCrew = [
		{ crew: crew1, stars: beholdResult.crew1.stars },
		{ crew: crew2, stars: beholdResult.crew2.stars },
		{ crew: crew3, stars: beholdResult.crew3.stars }
	];

	const { best, starBest, cabBest, colBest } = recommendations(workCrew, open_cols || undefined);

	let crewurl = '';
	if (starBest && starBest !== best) {
		if (workCrew.every(wc => (wc.crew == starBest) || (wc.stars == wc.crew.max_rarity))) {
			embed = embed
			.addFields({
				name: 'Best Non-Dupe',
				value: starBest.name,
				inline: true
			});
			crewurl = starBest.imageUrlPortrait;
		}
		else {
			embed = embed
			.addFields({
				name: 'Best To Star Up',
				value: starBest.name,
				inline: true
			});
			crewurl = starBest.imageUrlPortrait;
		}
	}

	if (colBest && !starBest) {
		embed = embed
		.addFields({
			name: 'Best For Collections',
			value: colBest.name,
			inline: true
		});
		crewurl = colBest.imageUrlPortrait;
	}

	if (best) {
		embed = embed
		.addFields({
			name: 'Best Crew',
			value: `${best.name}`,
			inline: true
		});
		if (!crewurl || workCrew.find(f => f.crew === best)?.stars !== best.max_rarity) crewurl = best.imageUrlPortrait;
	}

	if (colBest && starBest) {
		embed = embed
		.addFields({
			name: 'Best For Collections',
			value: colBest.name,
			inline: true
		});
	}

	if (cabBest) {
		embed = embed
		.addFields({
			name: 'CAB Best',
			value: cabBest.name,
			inline: true
		});
	}

	if (userdata.name && userdata.value) {
		embed = embed.addFields({
			name: userdata.name,
			value: userdata.value
		});
	}

	embed = embed
		.setThumbnail(`${CONFIG.ASSETS_URL}${crewurl}`)
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
