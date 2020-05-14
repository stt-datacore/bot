// Code adapted from https://codepen.io/somnivore/pen/Nabyzw
import { Message } from 'discord.js';
import { getEmoteOrString } from './discord';

const maxExtends = 100;
const maxNum20hourSims = 100;

function randomInt(min: number, max: number) {
	return Math.min(max, min + Math.floor(Math.random() * (max - min + 1)));
}

export interface VoyageResult {
	extends: {
		result: number;
		safeResult: number;
		saferResult: number;
		lastDil: number;
		dilChance: number;
		refillCostResult: number;
	}[];

	n20hrdil: number;
	n20hrrefills: number;
}

export function voyCalc(
	ps: number,
	ss: number,
	o1: number,
	o2: number,
	o3: number,
	o4: number,
	startAm: number,
	numExtends: number = 2,
	currentAm: number = 0,
	elapsedHours: number = 0
): VoyageResult {
	if (Math.min(ps, ss, o1, o2, o3, o4, startAm) == 0) {
		// error
	}

	// constants (algorithm configuration)
	const secondsPerTick = 20;
	const secondsInMinute = 60;
	const minutesInHour = 60;
	const hazardTick = 4;
	const rewardTick = 7;
	const hazardAsRewardTick = 28;
	const ticksPerMinute = secondsInMinute / secondsPerTick;
	const ticksPerHour = ticksPerMinute * minutesInHour;
	const amPerActivity = 1;
	const hoursBetweenDilemmas = 2;
	const ticksBetweenDilemmas = hoursBetweenDilemmas * minutesInHour * ticksPerMinute;
	const hazSkillPerHour = 1260;
	const hazSkillPerTick = hazSkillPerHour / ticksPerHour; // 7
	const hazAmPass = 5;
	const hazAmFail = 30;
	const psChance = 0.35;
	const ssChance = 0.25;
	const osChance = 0.1;
	const dilPerMin = 5;

	// more input
	let ship = currentAm;
	if (ship == 0) {
		ship = startAm;
	}

	let numSims = 5000;

	let num20hourSims = Math.min(maxNum20hourSims, numSims);

	// % Proficiency <i>(this might slightly refine estimates in some cases but most users can ignore this. It's the % of your average proficiency roll relative to your average total roll - increase if using gauntlet crew)
	let hazSkillVariance = 20 / 100;
	let skills = [ps, ss, o1, o2, o3, o4];

	let elapsedHazSkill = elapsedHours * hazSkillPerHour;

	let maxSkill = Math.max(ps, ss, o1, o2, o3, o4);
	maxSkill = Math.max(0, maxSkill - elapsedHazSkill);

	let results: number[][] = [];
	let resultsRefillCostTotal = [];
	for (let iExtend = 0; iExtend <= numExtends; ++iExtend) {
		results.push([]);
		results[iExtend].length = numSims;
		resultsRefillCostTotal.push(0);
	}

	let results20hrCostTotal = 0;
	let results20hrRefillsTotal = 0;

	for (let iSim = 0; iSim < numSims; iSim++) {
		let tick = Math.floor(elapsedHours * ticksPerHour);
		let am = ship;
		let refillCostTotal = 0;
		let extend = 0;

		while (0 < 1) {
			++tick;
			// sanity escape:
			if (tick == 10000) break;

			// hazard && not dilemma
			if (tick % hazardTick == 0 && tick % hazardAsRewardTick != 0 && tick % ticksBetweenDilemmas != 0) {
				let hazDiff = tick * hazSkillPerTick;

				// pick the skill
				let skillPickRoll = Math.random();
				let skill;
				if (skillPickRoll < psChance) {
					skill = ps;
				} else if (skillPickRoll < psChance + ssChance) {
					skill = ss;
				} else {
					skill = skills[2 + randomInt(0, 3)];
				}

				// check (roll if necessary)
				let skillVar = hazSkillVariance * skill;
				let skillMin = skill - skillVar;
				if (hazDiff < skillMin) {
					// automatic success
					am += hazAmPass;
				} else {
					let skillMax = skill + skillVar;
					if (hazDiff >= skillMax) {
						// automatic fail
						am -= hazAmFail;
					} else {
						// roll for it
						let skillRoll = skillMin + Math.random() * (skillMax - skillMin);
						//test.text += minSkill + "-" + maxSkill + "=" + skillRoll + " "
						if (skillRoll >= hazDiff) {
							am += hazAmPass;
						} else {
							am -= hazAmFail;
						}
					}
				}
			} else if (tick % rewardTick != 0 && tick % hazardAsRewardTick != 0 && tick % ticksBetweenDilemmas != 0) {
				am -= amPerActivity;
			}

			if (am <= 0) {
				// system failure
				if (extend == maxExtends) break;

				let voyTime = tick / ticksPerHour;
				let refillCost = Math.ceil((voyTime * 60) / dilPerMin);

				if (extend <= numExtends) {
					results[extend][iSim] = tick / ticksPerHour;
					if (extend > 0) {
						resultsRefillCostTotal[extend] += refillCostTotal;
					}
				}

				am = startAm;
				refillCostTotal += refillCost;
				extend++;

				if (voyTime > 20) {
					results20hrCostTotal += refillCostTotal;
					results20hrRefillsTotal += extend;
					break;
				}

				if (extend > numExtends && iSim >= num20hourSims) {
					break;
				}
			} // system failure
		} // foreach tick
	} // foreach sim

	let finalResult = {
		extends: <any[]>[],
		n20hrdil: 0,
		n20hrrefills: 0
	};

	// calculate and display results
	for (let extend = 0; extend <= numExtends; ++extend) {
		let exResults = results[extend];

		exResults.sort(function(a, b) {
			return a - b;
		});
		let voyTime = exResults[Math.floor(exResults.length / 2)];

		// compute other results
		let safeTime = exResults[Math.floor(exResults.length / 10)];
		let saferTime = exResults[Math.floor(exResults.length / 100)];
		let safestTime = exResults[0];

		// compute last dilemma chance
		let lastDilemma = 0;
		let lastDilemmaFails = 0;
		for (let i = 0; i < exResults.length; i++) {
			let dilemma = Math.floor(exResults[i] / hoursBetweenDilemmas);
			if (dilemma > lastDilemma) {
				lastDilemma = dilemma;
				lastDilemmaFails = Math.max(0, i);
			}
		}

		let dilChance = Math.round((100 * (exResults.length - lastDilemmaFails)) / exResults.length);
		// HACK: if there is a tiny chance of the next dilemma, assume 100% chance of the previous one instead
		if (dilChance == 0) {
			lastDilemma--;
			dilChance = 100;
		}

		finalResult.extends.push({
			result: voyTime,
			safeResult: safeTime,
			saferResult: saferTime,
			lastDil: lastDilemma * hoursBetweenDilemmas,
			dilChance: dilChance,
			refillCostResult: extend > 0 ? Math.ceil(resultsRefillCostTotal[extend] / numSims) : 0
		});

		// the threshold here is just a guess
		if (maxSkill / hazSkillPerHour > voyTime) {
			let tp = Math.floor(voyTime * hazSkillPerHour);
			if (currentAm == 0) {
				//setWarning(extend, "Your highest skill is too high by about " + Math.floor(maxSkill - voyTime*hazSkillPerHour) + ". To maximize voyage time, redistribute more like this: " + tp + "/" + tp + "/" + tp/4 + "/" + tp/4 + "/" + tp/4 + "/" + tp/4 + ".");
			}
		}
	} // foreach extend

	finalResult.n20hrdil = Math.ceil(results20hrCostTotal / num20hourSims);
	finalResult.n20hrrefills = Math.round(results20hrRefillsTotal / num20hourSims);

	return finalResult;
}

export function formatTime(duration: number): string {
	let hours = Math.floor(duration);
	let minutes = Math.floor((duration - hours) * 60);

	return `${hours}h ${minutes}m`;
}

export function formatVoyageReply(message: Message, results: VoyageResult): string {
	return `Estimated voyage length of **${formatTime(
		(results.extends[0].result*3 + results.extends[0].safeResult) / 4
	)}** (99% worst case ${formatTime(results.extends[0].saferResult)}). ${
		results.extends[0].dilChance
	}% chance to reach the ${results.extends[0].lastDil}hr dilemma; refill with ${
		results.extends[1].refillCostResult
	} ${getEmoteOrString(message, 'dil', 'dil')} for a ${results.extends[1].dilChance}% chance to reach the ${
		results.extends[1].lastDil
	}hr dilemma.`;
}
