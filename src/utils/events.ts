
import { DCData } from '../data/DCData';
import { IEventData } from '../datacore/events';
import { Content, GameEvent, PlayerData, Shuttle } from '../datacore/player';
import fs from 'fs';

export function getEventData(activeEvent: GameEvent, allCrew: Definitions.BotCrew[]): IEventData | undefined {
	const result = {} as IEventData;
	result.symbol = activeEvent.symbol;
	result.name = activeEvent.name;
	result.description = activeEvent.description;
	result.bonus_text = activeEvent.bonus_text;
	result.content_types = activeEvent.content_types;
	result.seconds_to_start = activeEvent.seconds_to_start;
	result.seconds_to_end = activeEvent.seconds_to_end;

	const typemap = {
		"gather": "Galaxy",
		"skirmish": "Skirmish",
		"shuttles": "Faction"
	} as { [key: string]: string };

	const types = activeEvent.content_types.map(c => typemap[c]);
	result.type = [ ...new Set(types)].join("/");

	if (types.includes("Skirmish")) {
		let rex = new RegExp(/.+Using (.+), (.+), or (.+) will provide a hull.+/);
		let matches = rex.exec(activeEvent.rules);
		if (matches) {
			let ships = [matches[1], matches[2], matches[3]];
			for (let i in ships) {
				ships[i] = ships[i].replace("the ", "").replace(" ship", "");
			}
			let schematics = DCData.getSchematics().filter(f => f.ship.name && ships.includes(f.ship.name));
			result.ships = schematics;
		}
	}
	// We can get event image more definitively by fetching from events/instance_id.json rather than player data
	result.image = activeEvent.phases[0].splash_image.file.slice(1).replace(/\//g, '_') + '.png';

	result.featured = [];
	result.bonus = [];

	// Content is active phase of started event or first phase of unstarted event
	//	This may not catch all bonus crew in hybrids, e.g. "dirty" shuttles while in phase 2 skirmish
	const activePhase = (Array.isArray(activeEvent.content) ? activeEvent.content[activeEvent.content.length-1] : activeEvent.content) as Content;

	if (!activePhase) return result;

	if (activePhase.content_type === 'shuttles' && activePhase.shuttles) {
		activePhase.shuttles.forEach((shuttle: Shuttle) => {
			for (let symbol in shuttle.crew_bonuses) {
				if (!result.bonus.includes(symbol)) {
					result.bonus.push(symbol);
					if (shuttle.crew_bonuses[symbol] === 3) result.featured.push(symbol);
				}
			}
		});
	}
	else if (activePhase.content_type === 'gather' && activePhase.crew_bonuses) {
		for (let symbol in activePhase.crew_bonuses) {
			if (!result.bonus.includes(symbol)) {
				result.bonus.push(symbol);
				if (activePhase.crew_bonuses[symbol] === 10) result.featured.push(symbol);
			}
		}
	}
	else if (activePhase.content_type === 'skirmish') {
		if (activePhase.bonus_crew) {
			for (let i = 0; i < activePhase.bonus_crew.length; i++) {
				let symbol = activePhase.bonus_crew[i];
				if (!result.bonus.includes(symbol)) {
					result.bonus.push(symbol);
					result.featured.push(symbol);
				}
			}
		}
		// Skirmish uses activePhase.bonus_traits to identify smaller bonus event crew
		if (activePhase.bonus_traits) {
			activePhase.bonus_traits.forEach(trait => {
				const perfectTraits = allCrew.filter(crew => crew.traits.includes(trait) || crew.traits_hidden.includes(trait));
				perfectTraits.forEach(crew => {
					if (!result.bonus.includes(crew.symbol)) {
						result.bonus.push(crew.symbol);
					}
				});
			});
		}
	}

	// Guess featured crew when not explicitly listed in event data (e.g. pre-start skirmish or hybrid w/ phase 1 skirmish)
	if (result.bonus.length === 0) {
		const { bonus, featured } = guessBonusCrew(activeEvent, allCrew);
		result.bonus = bonus;
		result.featured = featured;
		result.bonusGuessed = true;
	}

	return result;
}

// Current event here refers to an ongoing event, or the next event if none is ongoing
function guessCurrentEventId(allEvents: Definitions.EventInstance[]): number {
	const easternTime = new Date((new Date()).toLocaleString('en-US', { timeZone: 'America/New_York' }));
	const estDay = easternTime.getDay(), estHour = easternTime.getHours();

	// Use penultimate event instance if current time is:
	//	>= Wednesday Noon ET (approx time when game data is updated with next week's event)
	//		and < Monday Noon ET (when event ends)
	// Otherwise use ultimate event
	//	Note: DataCore autosyncs events at ~1PM ET every day, so there might be some lag on Wednesday
	const currentIndex = ((estDay === 3 && estHour >= 12) || estDay > 3 || estDay === 0 || (estDay === 1 && estHour < 12)) ? 2 : 1; // start < 24*60*60 ? 2 : 1;
	return allEvents[allEvents.length-currentIndex].instance_id;
}

// Get seconds to event start, end from current time
function getCurrentStartEndTimes(): { start: number, end: number, startTime: Date, endTime: Date } {

	const currentTime = new Date();
	const easternTime = new Date((new Date()).toLocaleString('en-US', { timeZone: 'America/New_York' }));

	const currHour = currentTime.getHours();
	const estDay = easternTime.getDay(), estHour = easternTime.getHours();

	const tzdiff = (currHour < estHour) ? ((24 - estHour) + currHour) : (currHour - estHour);

	// Event "week" starts and ends on Monday at Noon ET
	let eventDay = [6, 0, 1, 2, 3, 4, 5][estDay];
	eventDay = estHour < 12 ? (eventDay-1 < 0 ? 6 : eventDay-1) : eventDay;

	// Event end time is Monday Noon ET (Event Day "7", 0:00:00)
	let endTime = new Date();
	endTime.setDate(endTime.getDate()+(6-eventDay));
	endTime.setHours(12 + tzdiff, 0, 0, 0);	// Noon ET is 16/15:00:00 UTC

	if (endTime.getDay() === 0) {
		endTime.setDate(endTime.getDate()+1);
	}

	// Event start time is Thursday Noon ET (Event Day 3, 0:00:00)
	//	aka exactly 4 days before endTime
	let startTime = new Date(endTime.getTime());
	startTime.setDate(startTime.getDate()-4);

	let start = 0;
	let diff = endTime.getTime() - easternTime.getTime();
	const end = Math.floor((diff)/1000);

	// Event hasn't started yet
	if (eventDay < 3) {
		diff = startTime.getTime() - easternTime.getTime();
		start = Math.floor((diff)/1000);
	}

	return { start, end, startTime, endTime };
}

export function getRecentEvents(allCrew: Definitions.BotCrew[], allEvents: Definitions.EventInstance[], profileData?: PlayerData): IEventData[] {
	const recentEvents = [] as IEventData[];

	if (profileData?.player.character.events?.length) {
		profileData?.player.character.events.forEach((event) => {
			let pevent = getEventData(event, allCrew);
			if (pevent) {
				recentEvents.push(pevent);
			}
		})
	}
	const { start, end, startTime, endTime } = getCurrentStartEndTimes();
	const currentEventId = guessCurrentEventId(allEvents);

	let index = 1;
	while (recentEvents.length < 2) {
		const eventId = allEvents[allEvents.length-index].instance_id;
		const eventFile = process.env.DC_DATA_PATH! + 'events/'+eventId+'.json';
		if (!fs.existsSync(eventFile)) {
			console.log(`Event file '${eventFile}' not found! Aborting recent event mapping.`);
			break;
		}

		const response = fs.readFileSync(eventFile, 'utf8');
		const json = JSON.parse(response);
		const eventData = getEventData(json, allCrew) as IEventData;
		if (eventId === currentEventId) {
			eventData.seconds_to_start = start;
			eventData.seconds_to_end = end;
            eventData.startDate = startTime;
			eventData.endDate = endTime;
			// Assume in phase 2 of ongoing event
			if (eventData.content_types.length === 2 && end < 2*24*60*60) {
				eventData.content_types = [eventData.content_types[1]];
			}
		}
        else {
            eventData.startDate = new Date(startTime.getTime() + (1000 * 24 * 60 * 60 * 7));
			eventData.endDate = new Date(endTime.getTime() + (1000 * 24 * 60 * 60 * 7));
        }
		// if ("discovered" in json) {
		// 	let d = new Date(json['discovered']);
		// 	if ((new Date()).getTime() - d.getTime() < (7 * 24 * 60 * 60 * 1000) && d.getDay() < 4) {
		// 		recentEvents.push(eventData);
		// 		index++;
		// 		if (eventId === currentEventId) break;
		// 		continue;
		// 	}
		// }
		recentEvents.unshift(eventData);
		index++;
		if (eventId === currentEventId) break;
	}

	return recentEvents;
}

function guessBonusCrew(activeEvent: GameEvent, allCrew: Definitions.BotCrew[]): { bonus: string[], featured: string[] } {
	const bonus = [] as string[];
	const featured = [] as string[];

	// Guess bonus crew from bonus_text
	//	bonus_text seems to be reliably available, but might be inconsistently written
	if (activeEvent.bonus_text !== '') {
		const words = activeEvent.bonus_text.replace('Crew Bonus: ', '').replace(' crew', '').replace(/\sor\s/, ',').split(',').filter(word => word !== '');
		words.forEach(trait => {
			// Search for exact name first
			const testName = trait.trim();
			const perfectName = allCrew.find(crew => crew.name === testName);
			if (perfectName) {
				featured.push(perfectName.symbol);
				if (!bonus.includes(perfectName.symbol))
					bonus.push(perfectName.symbol);
			}
			// Otherwise search for matching trait
			else {
				const testTrait = testName.replace(/[\.\s'’]/g, '').toLowerCase();
				const perfectTraits = allCrew.filter(crew => crew.traits.includes(testTrait) || crew.traits_hidden.includes(testTrait));
				if (perfectTraits.length > 0) {
					perfectTraits.forEach(crew => {
						if (!bonus.includes(crew.symbol))
							bonus.push(crew.symbol);
					});
				}
				// Otherwise try matching last name only (e.g. J. Archer should be Archer)
				else {
					if (/\s/.test(testName)) {
						const imperfectTrait = testName.replace(/^.+\s/, '').toLowerCase();
						const imperfectTraits = allCrew.filter(crew => crew.traits.includes(imperfectTrait) || crew.traits_hidden.includes(imperfectTrait));
						imperfectTraits.forEach(crew => {
							if (!bonus.includes(crew.symbol))
								bonus.push(crew.symbol);
						});
					}
				}
			}
			// Identify featured from matching featured_crew
			//	These usually include the event's legendary ranked reward, so check against the bonus crew we identified above
			activeEvent.featured_crew.forEach(crew => {
				if (bonus.includes(crew.symbol)) {
					if (!featured.includes(crew.symbol))
						featured.push(crew.symbol);
				}
			});
		});
	}

	return { bonus, featured };
}
