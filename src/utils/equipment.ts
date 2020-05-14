// TODO: share this file with \datacore\src\utils\equipment.ts
import { DCData } from '../data/DCData';

export interface IDemand {
	count: number;
	symbol: string;
	equipment: Definitions.Item;
	factionOnly: boolean;
}

export function demandsPerSlot(es: any, items: Definitions.Item[], dupeChecker: Set<string>, demands: IDemand[]): number {
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
		});
	}

	return equipment.recipe.craftCost;
}

export function getNeededItems(crew_symbol: string, min_level: number, max_level: number = 100) {
	let crew = DCData.getRawCrew().find((c) => c.symbol === crew_symbol);

	// TODO: partially equipped bands (e.g. level 30 with the 2nd equipment slot filled)

	let demands: IDemand[] = [];
	let dupeChecker = new Set<string>();
	let craftCost = 0;

	crew.equipment_slots
		.filter((es: any) => es.level >= min_level && es.level <= max_level)
		.forEach((es: any) => {
			craftCost += demandsPerSlot(es, DCData.getItems(), dupeChecker, demands);
		});

	demands = demands.sort((a, b) => b.count - a.count);

	return { demands, craftCost };
}
