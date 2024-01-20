// TODO: share this file with \datacore\src\utils\equipment.ts
import { DCData } from '../data/DCData';

export const BAD_COST = -1;

export interface IDemand {
	count: number;
	symbol: string;
	equipment: Definitions.Item;
	factionOnly: boolean;
	avgChronCost: number;
}

function bestChronCost(item: Definitions.Item, skirmish?: boolean) {
	let bestCost = 0;

	if (!item.factionOnly) {
		let bestMissions = item.item_sources.filter((s) => (!skirmish || s.type !== 0) && s.avg_cost && s.avg_cost >= 1).sort((a, b) => (a.avg_cost || 9999) - (b.avg_cost || 9999));
		if (bestMissions.length > 0) {
			if (!skirmish || bestMissions.some(m => m.type === 2)) {
				bestCost = bestMissions[0].avg_cost || 0;
			}
		}
	}

	if (!bestCost && skirmish) return BAD_COST;
	return bestCost;
}


export function demandsPerSlot(es: any, items: Definitions.Item[], dupeChecker: Set<string>, demands: IDemand[], skirmish?: boolean): number {
	let equipment = items.find((item) => item.symbol === es.symbol);
	if (!equipment) {
		return 0;
	}

	if (!equipment.recipe) {

		if (dupeChecker.has(equipment.symbol)) {
			demands.find((d) => d.symbol === equipment!.symbol)!.count += 1;
		} else {
			dupeChecker.add(equipment.symbol);
			demands.push({
				count: 1,
				symbol: equipment.symbol,
				equipment: equipment,
				factionOnly: equipment.factionOnly,
				avgChronCost: bestChronCost(equipment, skirmish),
			});
		}
				
		return 0;
	}

	for (let iter of equipment.recipe.list) {		
		let recipeEquipment = items.find((item) => item.symbol === iter.symbol);
		if (!recipeEquipment) {
			continue;
		}

		if (dupeChecker.has(iter.symbol)) {
			demands.find((d) => d.symbol === iter.symbol)!.count += iter.count;
			continue;
		}

		if (recipeEquipment.item_sources.length === 0) {
			console.error(`Oops: equipment with no recipe and no sources: `, recipeEquipment);
		}

		dupeChecker.add(iter.symbol);

		demands.push({
			count: iter.count,
			symbol: iter.symbol,
			equipment: recipeEquipment,
			factionOnly: iter.factionOnly,
			avgChronCost: bestChronCost(recipeEquipment, skirmish),
		});
	}

	return equipment.recipe.craftCost;
}

export function getNeededItems(crew_symbol: string, min_level: number, max_level: number = 100, skirmish?: boolean) {
	let crew = DCData.getBotCrew().find((c) => c.symbol === crew_symbol);

	if (!crew) {
		return undefined;
	}

	// TODO: partially equipped bands (e.g. level 30 with the 2nd equipment slot filled)

	let demands: IDemand[] = [];
	let dupeChecker = new Set<string>();
	let craftCost = 0;

	crew.equipment_slots
		.filter((es: any) => es.level >= min_level && es.level <= max_level)
		.forEach((es: any) => {
			craftCost += demandsPerSlot(es, DCData.getItems(), dupeChecker, demands, skirmish);
		});

	demands = demands.sort((a, b) => b.count - a.count);

	return { demands, craftCost };
}
