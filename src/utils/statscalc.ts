import CONFIG from './config';
import { loadProfileRoster, ProfileEntry } from './profile';

interface StatsArrElement<T> {
	key: number;
	value: T;
}

type Criteria<T> = {
	name: string;
	calculate: (input: T) => number;
};

type Result<T> = {
	theInput: T;
	positions: {
		criteria: string;
		position: number;
	}[];
};

export class StatsHolder<T> {
	_arr: StatsArrElement<T>[];
	_limit: number;

	constructor(limit: number) {
		this._arr = [];
		this._limit = limit;
	}

	insert(key: number, value: T) {
		let inserted = false;
		for (let i = 0, len = this._arr.length; i < len; i++) {
			if (key > this._arr[i].key) {
				this._arr.splice(i, 0, { key, value });
				inserted = true;
				break;
			}
		}

		if (!inserted) {
			this._arr.push({ key, value });
		}

		if (this._arr.length > this._limit) {
			this._arr = this._arr.slice(0, this._limit);
		}
	}

	get(): StatsArrElement<T>[] {
		return this._arr;
	}
}

export function getTopInRoster(profile: ProfileEntry | undefined = undefined) {
	let result = {
		voyage: new StatsHolder<Definitions.BotCrew>(10),
		gauntlet: new StatsHolder<Definitions.BotCrew>(10)
	};

	let roster = loadProfileRoster(profile);

	for (let entry of roster) {
		result.voyage.insert(entry.voyageScore, entry.crew);
		result.gauntlet.insert(entry.gauntletScore, entry.crew);

		//TODO: rest of stats
	}

	return result;
}
