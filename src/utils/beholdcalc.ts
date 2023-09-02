import { Message, Embed, EmbedBuilder } from 'discord.js';

import { DCData } from '../data/DCData';
import { formatStatLine, formatCrewCoolRanks, colorFromRarity } from './crew';
import { loadProfile, loadProfileRoster, userFromMessage, applyCrewBuffs } from './profile';
import { sendAndCache } from './discord';
import CONFIG from './config';

export function isValidBehold(data: any, threshold: number = 10) {
	if (!data.top || (data.top.symbol != 'behold_title' && threshold > 1) || data.top.score < threshold) {
		return false;
	}

	if (!data.crew1 || data.crew1.score < threshold) {
		return false;
	}

	if (!data.crew2 || data.crew2.score < threshold) {
		return false;
	}

	if (!data.crew3 || data.crew3.score < threshold) {
		return false;
	}

	if (data.error) {
		return false;
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
	//If the image analysis found the correct top, but maybe the crew detection failed.
	if (!data.top || (data.top.symbol != 'behold_title' && threshold > 1) || data.top.score < threshold) {
		return false;
	}

	return true;
}

export function formatCrewField(message: Message, crew: Definitions.BotCrew, stars: number, custom: string) {
	let reply = '';
	if (crew.bigbook_tier) {
		reply += `Big Book **tier ${crew.bigbook_tier}** ([link](https://www.bigbook.app/crew/${crew.symbol})), `;
	}
	if (crew.cab_ov) {
		reply += `CAB **rating ${crew.cab_ov} (rank #${crew.cab_ov_rank})**, `;
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

function recommendations(crew: CrewFromBehold[]) {
	const ff = (c: CrewFromBehold) => {
		return c.stars == c.crew.max_rarity;
	}

	let best = crew.sort((a, b) => a.crew.bigbook_tier - b.crew.bigbook_tier);
	let bestCab = [...crew].sort((a, b) => parseFloat(b.crew.cab_ov) - parseFloat(a.crew.cab_ov));
	let starBest = crew.filter(c => c.stars > 0 && c.stars < c.crew.max_rarity);

	if (starBest.length > 0) {
		starBest = starBest.sort((a, b) => a.crew.bigbook_tier - b.crew.bigbook_tier);
	}

	let title = '';
	if (best[0].crew.bigbook_tier > 8) {
		if (starBest.length > 0) {
			title = `Add a star to ${starBest[0].crew.name}`;
		} else {
			title = `Pick ${best[0].crew.name} if you have room`;
		}
	} else if (starBest.length > 0 && starBest[0].crew != best[0].crew && !ff(best[0])) {
		if (starBest[0].crew.bigbook_tier > 5) {
			title = `${best[0].crew.name} is your best bet; star up ${starBest[0].crew.name} if you don't have any slots to spare`;
		} else {
			title = `Add a star to ${starBest[0].crew.name} or pick ${best[0].crew.name} if you have room`;
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
		if (best[1].crew.bigbook_tier < 6 && !ff(best[1])) {
			title = `${best[1].crew.name} is your best bet, unless you want to start another ${best[0].crew.name}`;
		} else {
			title = `It may be worth starting another ${best[0].crew.name}, pick ${starBest[0].crew.name} if you don't want dupes`;
		}
	} else {
		title = `${best[0].crew.name} is your best bet`;
	}

	let suffix = ".";
	if (Math.abs(best[0].crew.bigbook_tier - best[1].crew.bigbook_tier) <= 1 &&
		Math.abs(best[0].crew.bigbook_tier - best[2].crew.bigbook_tier) <= 1 &&
		Math.abs(best[1].crew.bigbook_tier - best[2].crew.bigbook_tier) <= 1) {
		suffix = " but check their links as tiers are similar."
	}
	title += suffix;
	if (best[0] !== bestCab[0]) {
		title = `Big Book recommendation: ${title}
CAB Ratings recommendation: ${bestCab[0].crew.name}`
	}

	return {
		best: best[0].crew,
		description: title
	};
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
	let crew1 = DCData.getBotCrew().find((c: any) => c.symbol === beholdResult.crew1.symbol);
	let crew2 = DCData.getBotCrew().find((c: any) => c.symbol === beholdResult.crew2.symbol);
	let crew3 = DCData.getBotCrew().find((c: any) => c.symbol === beholdResult.crew3.symbol);

	if (!crew1 || !crew2 || !crew3) {
		if (fromCommand) {
			sendAndCache(message, `Sorry, if that was a valid behold I wasn't able to find the crew.`);
		}

		return false;
	}

	if (crew1.max_rarity != crew2.max_rarity || crew2.max_rarity != crew3.max_rarity) {
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
	if (!base) {
		let user = await userFromMessage(message);
		if (user && user.profiles.length > 0) {
			// Apply personalization

			// TODO: multiple profiles
			let profile = await loadProfile(user.profiles[0].dbid);
			if (profile) {
				crew1 = applyCrew(crew1, profile.buffConfig);
				crew2 = applyCrew(crew2, profile.buffConfig);
				crew3 = applyCrew(crew3, profile.buffConfig);

				let bcrew = [crew1, crew2, crew3];

				let found = [1, 1, 1];
				for (let entry of profile.crew) {
					for (let i = 0; i < 3; i++) {
						if (entry.id === bcrew[i].archetype_id && entry.rarity && entry.rarity < bcrew[i].max_rarity) {
							entry.rarity++;
							found[i] = entry.rarity;
						}
					}
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
					value: `Stats are customized for [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0].dbid})'s buffs`
				});
			}
		}
	}

	const { best, description } = recommendations([
		{ crew: crew1, stars: beholdResult.crew1.stars },
		{ crew: crew2, stars: beholdResult.crew2.stars },
		{ crew: crew3, stars: beholdResult.crew3.stars }
	]);

	embed = embed
		.setThumbnail(`${CONFIG.ASSETS_URL}${best.imageUrlPortrait}`)
		.setDescription(description)		
		.addFields({ name: crew1.name, value: formatCrewField(message, crew1, beholdResult.crew1.stars, customranks[0])})
		.addFields({ name: crew2.name, value: formatCrewField(message, crew2, beholdResult.crew2.stars, customranks[1])})
		.addFields({ name: crew3.name, value: formatCrewField(message, crew3, beholdResult.crew3.stars, customranks[2])})
		.setFooter({
			text: customranks[0]
				? 'Make sure to re-upload your profile frequently to get accurate custom recommendations'
				: `Upload your profile to get custom recommendations`
		});

	sendAndCache(message, '', {embeds: [embed]});

	return true;
}
