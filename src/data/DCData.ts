import fs from 'fs';
import path from 'path';
import { watch, FSWatcher } from 'chokidar';
import Fuse from 'fuse.js';
import { IEventData } from '../datacore/events';
import { getRecentEvents } from '../utils/events';
import { Schematics } from '../datacore/ship';
import { Mission, Quest } from '../datacore/missions';
import { binaryLocateName, binaryLocateSymbol, postProcessCadetItems } from '../utils/items';
import { PlayerData } from 'src/datacore/player';
import { Collection } from 'src/datacore/game-elements';

class DCDataClass {
	private _watcher?: FSWatcher;
	private _items: Definitions.Item[] = [];
	private _missions: Quest[] = [];
	private _dilemmas: any[] = [];
	private _collections: Collection[] = [];
	private _rawCrew: Definitions.BotCrew[] = [];
	private _rawCrewByName: Definitions.BotCrew[] = [];
	private _recentEvents: IEventData[] = [];
	private _allEvents: Definitions.EventInstance[] = [];
	private _schematics: Schematics[] = [];
	private _cadet: Mission[] = [];
	private _procCadet = false;
	private _refreshHour = 0;

	public setup(datacore_path: string): void {
		this._procCadet = false;
		// Set up a watcher to reload data on changes
		this._watcher = watch(datacore_path, { persistent: true, awaitWriteFinish: true });
		this._watcher.on('change', filePath => this._reloadData(filePath));
		// Initial read
		this._reloadData(path.join(datacore_path, 'items.json'));
		this._reloadData(path.join(datacore_path, 'quests.json'));
		this._reloadData(path.join(datacore_path, 'cadet_episodes.txt'));
		this._reloadData(path.join(datacore_path, 'dilemmas.json'));
		this._reloadData(path.join(datacore_path, 'crew.json'));
		this._reloadData(path.join(datacore_path, 'collections.json'));
		this._reloadData(path.join(datacore_path, 'ship_schematics.json'));
		this._reloadData(path.join(datacore_path, 'event_instances.json'));
	}

	private _reloadData(filePath: string) {
		if (filePath.endsWith('.json') || filePath.endsWith("cadet_episodes.txt")) {
			console.log(`File ${filePath} has been changed`);
			let parsedData = undefined;
			try {
				parsedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
			} catch (err) {
				console.error(err);
				return;
			}

			if (filePath.endsWith('items.json')) {
				this._procCadet = false;
				this._items = parsedData;
			} else if (filePath.endsWith('quests.json')) {
				this._missions = parsedData;
				this.organizeMissions(path.dirname(filePath));
			} else if (filePath.endsWith('collections.json')) {
				this._collections = parsedData;
			} else if (filePath.endsWith('dilemmas.json')) {
				this._dilemmas = parsedData;
			} else if (filePath.endsWith('ship_schematics.json')) {
				this._schematics = parsedData;
			} else if (filePath.endsWith('cadet_episodes.txt')) {
				this._procCadet = false;
				this._cadet = parsedData;
			} else if (filePath.endsWith('crew.json')) {
				this._rawCrew = parsedData;
				this._rawCrew.sort((a, b) =>
					a.symbol.localeCompare(b.symbol)
				);
				this._rawCrewByName = [ ... this._rawCrew ];
				this._rawCrewByName.sort((a, b) => (
					a.name.localeCompare(b.name)
				));

				// Add pseudo-traits for the skills (for search to work)
				this._rawCrew.forEach(crew => {
					crew.traits_pseudo = [];
					if (crew.base_skills.command_skill) crew.traits_pseudo.push('cmd');
					if (crew.base_skills.science_skill) crew.traits_pseudo.push('sci');
					if (crew.base_skills.security_skill) crew.traits_pseudo.push('sec');
					if (crew.base_skills.engineering_skill) crew.traits_pseudo.push('eng');
					if (crew.base_skills.diplomacy_skill) crew.traits_pseudo.push('dip');
					if (crew.base_skills.medicine_skill) crew.traits_pseudo.push('med');
				});
			} else if (filePath.endsWith('event_instances.json')) {
				this._allEvents = parsedData;
				this.refreshEvents();
			}

			if (this._cadet?.length && this._items?.length && !this._procCadet) {
				postProcessCadetItems(this._cadet, this._items);
				this._procCadet = true;
			}
		}
	}

	private organizeMissions(datacore_path: string) {
		console.log("Indexing missions and quests...");
		let missions = JSON.parse(fs.readFileSync(path.join(datacore_path, 'episodes.json'), 'utf-8')) as Mission[];
		let mhash = {} as { [key: string]: any[] };

		this._missions.forEach((quest) => {
			let id = (quest as any).mission.episode_title;
			mhash[id] ??= [];
			mhash[id].push(quest as any);
		});

		Object.entries(mhash).forEach(([episode, quests]) => {
			let tempquests = [] as any[];
			let fmission = missions.find(f => f.episode_title === episode || f.name === episode);
			if (fmission) {
				let miss_quests = fmission.quests.filter(q => q.quest_type !== 'NarrativeQuest');
				for (let quest of quests) {
					if (quest.quest_type !== 'NarrativeQuest') {
						quest.index = miss_quests.findIndex(f => f.id.toString() === quest.id.toString()) + 1;
						tempquests.push(quest);
					}
				}
				tempquests.sort((a, b) => a.index - b.index)
				if (tempquests.length > 1 && tempquests[0].mission.episode > 0) {
					tempquests[tempquests.length - 1].index = tempquests[tempquests.length - 2].index;
				}
			}
		});
		missions.length = 0;
	}

	public refreshEvents(profileData?: PlayerData) {
		this._recentEvents = getRecentEvents(this._rawCrew, this._allEvents, profileData);
		this._refreshHour = (new Date()).getHours();
	}

	public getEvents(profileData?: PlayerData) {
		if (this._refreshHour !== (new Date()).getHours()) {
			this.refreshEvents(profileData);
		}

		return this._recentEvents;
	}

	public shutdown() {
		if (this._watcher) {
			this._watcher.close();
		}
	}

	public getCollectionNamesFromIds(ids: number[]): string[] {
		return this._collections.filter(f => ids.includes(Number(f.id))).map(m => m.name);
	}

	public getBotCrew(): Definitions.BotCrew[] {
		return this._rawCrew.map((rc) => {
			if (typeof rc.date_added === 'string') {
				rc.date_added = new Date(rc.date_added);
			}
			return rc;
		});
	}

	public getCadet(): Mission[] {
		return this._cadet;
	}

	public getSchematics(): Schematics[] {
		return this._schematics;
	}

	public getItems(): Definitions.Item[] {
		return this._items;
	}

	public getDilemmas(): Definitions.IDilemma[] {
		return this._dilemmas;
	}

	public totalCrew(): number {
		return this._rawCrew.length;
	}

	public questBySymbol(symbol: string): any {
		return this._missions.find((q: any) => q.symbol === symbol) ?? this._cadet.find((q: any) => q.symbol === symbol);
	}

	public itemBySymbol(symbol: string): any {
		return this._items.find((i: any) => i.symbol === symbol);
	}

	public searchCrewWithTokens(tokens: string[]) {
		let skill_traits: string[] = [];
		let searchString = '';
		tokens.forEach(t => {
			if (
				t.toLowerCase() === 'cmd' ||
				t.toLowerCase() === 'sci' ||
				t.toLowerCase() === 'sec' ||
				t.toLowerCase() === 'eng' ||
				t.toLowerCase() === 'dip' ||
				t.toLowerCase() === 'med'
			) {
				skill_traits.push(t.toLowerCase());
			} else {
				searchString += ' ' + t;
			}
		});

		let crew = this._rawCrew;
		if (skill_traits.length > 0) {
			// Filter first by skills
			crew = crew.filter(c => skill_traits.every(sk => c.traits_pseudo.includes(sk)));
		}

		return this.searchCrewInternal(crew, searchString.trim(), true);
	}

	public searchCrew(searchString: string) {
		return this.searchCrewInternal(this._rawCrew, searchString, false);
	}

	public searchCrewInternal(
		crew: Definitions.BotCrew[],
		searchString: string,
		includeTraits: boolean
	) {
		let options = {
			shouldSort: true,
			tokenize: true,
			matchAllTokens: !includeTraits,
			includeScore: true,
			threshold: includeTraits ? 0.25 : 0.4,
			location: 0,
			distance: 100,
			maxPatternLength: 32,
			minMatchCharLength: 3,
			keys: [
				{
					name: 'name',
					weight: includeTraits ? 0.4: 0.7
				},
				{
					name: 'short_name',
					weight: includeTraits ? 0.1: 0.3
				},
				{
					name: 'nicknames.cleverThing',
					weight: includeTraits ? 0.4: 0.7
				}
			]
		};

		if (includeTraits) {
			options.keys.push({
				name: 'traits_named',
				weight: 0.2
			});
			options.keys.push({
				name: 'traits_hidden',
				weight: 0.1
			});
			options.keys.push({
				name: 'traits_pseudo',
				weight: 0.2
			});
		}

		// Try a plain substring search first in case we get an exact match
		if (!includeTraits) {
			let found: Definitions.BotCrew[];

			let fcrew = binaryLocateName(searchString, this._rawCrewByName);

			if (!fcrew) {
				fcrew = binaryLocateSymbol(searchString, this._rawCrew);
			}

			if (fcrew) {
				found = [fcrew as Definitions.BotCrew];
			}
			else {
				found = crew.filter(
					c =>
						c.name.toLowerCase() === searchString.toLowerCase() ||
						c.name
							.replace(/"/g, '')
							.replace(/'/g, '')
							.replace(/“/g, '')
							.replace(/’/g, '')
							.toLowerCase() === searchString.toLowerCase()
				);
			}

			if (found && found.length === 1) {
				return [found[0]];
			}

			found = crew.filter(c => c.name.toLowerCase().indexOf(searchString.toLowerCase()) >= 0);

			if (found && found.length === 1) {
				return [found[0]];
			}

			// To match legacy behavior also try a substring search with only the beginnings of the words matching
			// e.g. "comm toma" should match "Commander Tomalak"
			if (searchString.indexOf(' ') > 0) {
				let searchTerms = searchString
					.trim()
					.toLowerCase()
					.split(' ');
				let found = crew.filter(
					c => c.name.indexOf(' ') > 0 && searchTerms.every(term => c.name.toLowerCase().indexOf(term) >= 0)
				);
				if (found && found.length === 1) {
					return [found[0]];
				}
			}

			// Try substring match on nicknames
			found = crew.filter(c => c.nicknames?.some(n => n.cleverThing.toLowerCase().indexOf(searchString.toLowerCase()) >= 0));
			if (found && found.length === 1) {
				return [found[0]];
			}
		}

		const fuse = new Fuse(crew, options);
		const results = fuse.search(searchString);

		//console.log(results.map((i: any) => ({ score: i.score, name: i.item.name, traits_pseudo: i.item.traits_pseudo })));

		// No matches
		if (results.length === 0) {
			return undefined;
		}

		// A single result
		if (results.length === 1) {
			return [results[0].item];
		}

		// An exact match
		if (results[0].score && (results[0].score < 0.01)) {
			return results.filter(r => r.score && (r.score! < 0.01)).map(r => r.item);
		}

		// Multiple results, none are exact
		return results.map(r => r.item);
	}

	public searchItems(searchString: string, rarity: number): Definitions.Item[] | undefined {
		if (!this._procCadet) {
			postProcessCadetItems(this._cadet, this._items);
		}

		let options = {
			shouldSort: true,
			tokenize: true,
			matchAllTokens: true,
			includeScore: true,
			threshold: 0.3,
			location: 0,
			distance: 100,
			maxPatternLength: 32,
			minMatchCharLength: 3,
			keys: ['name']
		};

		// Try a plain search on name in case we get an exact match
		let foundByName = this._items.filter(
			item => item.name.toLowerCase() === searchString.toLowerCase() && item.rarity === rarity
		);
		if (foundByName && foundByName.length === 1) {
			return foundByName;
		}

		// Try a plain substring search on symbol in case we get an exact match
		let foundBySymbol = this._items.filter(
			item => item.symbol.toLowerCase().includes(searchString.toLowerCase()) && item.rarity === rarity
		);
		if (foundBySymbol && foundBySymbol.length === 1) {
			return foundBySymbol;
		}

		const fuse = new Fuse(
			this._items.filter((i: any) => i.rarity === rarity),
			options
		);
		const results = fuse.search(searchString) as any[];

		// No matches
		if (results.length === 0) {
			return undefined;
		}

		// A single result
		if (results.length === 1) {
			return [results[0].item];
		}

		return results.map(r => r.item);
	}
}

export let DCData = new DCDataClass();
