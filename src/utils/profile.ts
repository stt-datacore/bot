import fs from 'fs';
import fetch from 'node-fetch';
import { CommandInteraction, GuildMember, Message } from 'discord.js';

import CONFIG from './config';
import { DCData } from '../data/DCData';
import { Profile } from '../models/Profile';
import { UserRole, User } from '../models/User';
import { executeGetRequest } from './sttapi';
import { Logger } from '../utils';
import { stripPlayerData } from './playerutils';
import { discordUserFromMessage } from './discord';
import { PlayerCrew, PlayerData, StoredImmortal } from 'src/datacore/player';
import { CrewMember } from 'src/datacore/crew';

export interface ProfileCrewEntry {
	id: number;
	rarity?: number;
}

export interface ProfileEntry {
	captainName: string;
	crew: ProfileCrewEntry[];
	lastUpdate: Date;
	buffConfig: Definitions.BuffConfig;
	userId?: number;
	metadata?: {
		open_collection_ids: null | number[];
	}
}

export interface ProfileRosterEntry {
	crew: Definitions.BotCrew;
	skills: Definitions.Skills;
	rarity: number;
	voyageScore: number;
	gauntletScore: number;
}

export async function loadProfile(dbid: string): Promise<ProfileEntry | undefined> {
	let profileDB = await Profile.findOne({ where: { dbid: `${dbid}` } });

	if (!profileDB) {
		return undefined;
	}

	let profile: any = profileDB.get({ plain: true });

	let crew: ProfileCrewEntry[] = profile.shortCrewList.c_stored_immortals
		.concat(profile.shortCrewList.stored_immortals.map((im: any) => im.id))
		.map((id: number) => ({ id, rarity: undefined }));

	profile.shortCrewList.crew.forEach((entry: ProfileCrewEntry) => {
		if (!crew.find(e => e.id === entry.id)) {
			crew.push(entry);
		}
	});

	return {
		captainName: profile.captainName,
		crew,
		lastUpdate: profile.lastUpdate,
		buffConfig: profile.buffConfig,
		userId: profile.userId,
		metadata: profile.metadata
	};
}

export function applyCrewBuffs(
	skills: Definitions.Skills,
	buffConfig: Definitions.BuffConfig,
	zeroInit: boolean = true
) {
	const getMultiplier = (skill: Definitions.SkillName, stat: 'core' | 'range_min' | 'range_max') => {
		if (!buffConfig) {
			return 1;
		}

		let config = buffConfig[`${skill}_${stat}`];
		if (config) {
			return config.multiplier + config.percent_increase;
		} else {
			return 1;
		}
	};

	let withBuffs: Definitions.Skills = {};

	let skill: Definitions.SkillName;
	if (zeroInit) {
		for (skill in CONFIG.SKILLS) {
			withBuffs[skill] = { core: 0, range_min: 0, range_max: 0 };
		}
	}

	// Apply buffs
	for (skill in skills) {
		let sk = skills[skill]!;
		withBuffs[skill] = {
			core: Math.round(sk.core * getMultiplier(skill, 'core')),
			range_min: Math.round(sk.range_min * getMultiplier(skill, 'range_min')),
			range_max: Math.round(sk.range_max * getMultiplier(skill, 'range_max'))
		};
	}

	return withBuffs;
}

function defaultBuffConfig() {
	let cfg: Definitions.BuffConfig = {};

	for (let skill in CONFIG.SKILLS) {
		cfg[`${skill}_core`] = { multiplier: 1.15, percent_increase: 0 };
		cfg[`${skill}_range_min`] = { multiplier: 1.13, percent_increase: 0 };
		cfg[`${skill}_range_max`] = { multiplier: 1.13, percent_increase: 0 };
	}

	return cfg;
}

export function loadProfileRoster(profile: ProfileEntry | undefined = undefined): ProfileRosterEntry[] {
	let buffConfig: Definitions.BuffConfig = profile ? profile.buffConfig : defaultBuffConfig();

	let results: ProfileRosterEntry[] = [];

	for (let crew of DCData.getBotCrew()) {
		// for personalization, get the skills at specific rarity
		let skills: Definitions.Skills;
		let rarity = crew.max_rarity;
		if (profile) {
			let owned = profile.crew.find(c => c.id === crew.archetype_id);
			if (owned) {
				if (!owned.rarity || owned.rarity >= crew.max_rarity) {
					skills = applyCrewBuffs(crew.base_skills, buffConfig);
				} else {
					rarity = owned!.rarity;
					skills = applyCrewBuffs(crew.skill_data.find(sd => sd.rarity === rarity)!.base_skills, buffConfig);
				}
			} else {
				// Player doesn't have this crew
				continue;
			}
		} else {
			skills = applyCrewBuffs(crew.base_skills, buffConfig);
		}

		let gauntletScore = 0;
		let voyageScore = 0;
		let skill: Definitions.SkillName;
		for (skill in CONFIG.SKILLS) {
			let sk = skills[skill]!;
			gauntletScore += (sk.range_min + sk.range_max) / 2;
			voyageScore += sk.core + (sk.range_min + sk.range_max) / 2;
		}

		results.push({
			crew,
			skills,
			rarity,
			voyageScore,
			gauntletScore
		});
	}

	return results;
}

export async function userFromMessage(message: Message | CommandInteraction) {
	let id = discordUserFromMessage(message)!.id;
	console.log(`Discord Id: ${id}`);
	let result = await User.findOne({ where: { discordUserId: `${id}` }, include: [Profile] });
	if (result?.profiles?.length) {
		let newProfs = [] as Profile[];
		for (let profile of result.profiles) {
			if (profile.sttAccessToken === 'default') {
				newProfs.push(profile);
			}
		}
		for (let profile of result.profiles) {
			if (profile.sttAccessToken !== 'default') {
				newProfs.push(profile);
			}
		}
		result.profiles = newProfs;
	}

	return result;
}

export async function createUserFromMessage(message: Message) {
	let userDB = await userFromMessage(message);

	if (!userDB) {
		let id = discordUserFromMessage(message)?.id;
		if (!id) {
			return null;
		}
		userDB = await User.create({
			discordUserName: message.member?.user.username,
			discordUserDiscriminator: message.member?.user.discriminator,
			discordUserId: id,
			userRole: UserRole.DISCORDONLY
		});
	} else if (message.member) {
		userDB.discordUserName = message.member.user.username;
		userDB.discordUserDiscriminator = message.member.user.discriminator;
		await userDB.save();
	}

	return userDB;
}

export async function associateUser(userDB: User, dbid: string, access_token?: string) {
	if (access_token) {
		let result = await refreshProfile(access_token);
		if (!result) {
			return {
				error: `An error occured; make sure all parameters are correct (no quotes or extra characters)`
			};
		}
	}

	let profileDB = await Profile.findOne({ where: { dbid: `${dbid}` }, include: [User] });
	if (!profileDB) {
		return {
			error: `DBID not found. Make sure you uploaded the profile for the correct account at ${CONFIG.DATACORE_URL} `
		};
	}

	if (profileDB.user && profileDB.user.id !== userDB.id) {
		return {
			error: `DBID ${dbid} is already associated with ${profileDB.user.discordUserName}. If you believe this is incorrect, contact the bot administrator to resolve the issue.`
		};
	}

	profileDB.userId = userDB.id;
	// if (access_token) {
	// 	profileDB.sttAccessToken = access_token;
	// }
	await profileDB.save();

	return { profile: profileDB };
}

export async function clearUser(userDB: User) {
	let dbids = [];
	for (let profileDB of userDB.profiles) {
		dbids.push(profileDB.dbid);
	}

	await userDB.$set('profiles', []);

	return dbids;
}

export async function refreshProfile(access_token: string): Promise<any> {
	try {
		let playerData = await executeGetRequest('player', access_token);

		if (playerData) {
			let strippedPlayerData = stripPlayerData(DCData.getItems(), JSON.parse(JSON.stringify(playerData)));

			let jsonBody = JSON.stringify({
				dbid: strippedPlayerData.player.dbid,
				player_data: strippedPlayerData
			});

			await fetch(`${CONFIG.DATACORE_URL}api/post_profile`, {
				method: 'post',
				headers: {
					'Content-Type': 'application/json'
				},
				body: jsonBody
			});

			Logger.info('Refreshed player profile', { dbid: strippedPlayerData.player.dbid, display_name: playerData.player.character.display_name });
			return playerData;
		} else {
			Logger.info('Failed to refresh player profile');
			return undefined;
		}
	} catch (err) {
		Logger.error('Error while refreshing player profile', err);

		if ((err as Error).message.indexOf('invalid_token') > 0) {
			return {
				error: 'Invalid token, you need to associate again'
			};
		}

		return undefined;
	}
}

export async function loadFleet(fleet_id: string): Promise<any> {
	try {
		let response = await fetch(`${CONFIG.DATACORE_URL}api/fleet_info?fleetid=${fleet_id}`);
		if (response.ok) {
			return await response.json();
		}
	} catch (err) {
		Logger.error('Error while loading fleet info', err);
		return undefined;
	}
}

export async function getDbidFromDiscord(username: string, discriminator: string) : Promise<any>{
	try {
		let response = await fetch(`${CONFIG.DATACORE_URL}api/get_dbid_from_discord?username=${username}&discriminator=${discriminator}`);
		if (response.ok) {
			let data = await response.json();
			if (data && data.dbid) {
				return data.dbid;
			}
			Logger.error('No DBID returned while fetching DBID');
			return undefined;
		}
	} catch (err) {
		Logger.error('Error while fetching DBID', err);
		return undefined;
	}
}

export async function loadRemoteProfile(dbid: string): Promise<any> {
	try {
		let response = await fetch(`${CONFIG.DATACORE_URL}profiles/${dbid}`);
		if (response.ok) {
			let profileData = await response.json();
			if (profileData && profileData.player.dbid.toString() === dbid) {
				return profileData;
			}
			return undefined;
		}
	} catch (err) {
		Logger.error('Error while loading profile from Datacore', err);
		return undefined;
	}
}

export function loadFullProfile(dbid: string): any {
	let profileData = JSON.parse(fs.readFileSync(process.env.PROFILE_DATA_PATH + dbid, 'utf8')) as PlayerData;
	if (profileData && profileData.player.dbid.toString() === dbid) {
		let stat = fs.statSync(process.env.PROFILE_DATA_PATH + dbid);
		if (stat?.mtime) {
			profileData.lastModified = stat.mtime;
		}
		let frozen = DCData.getBotCrew().filter(f => profileData.player.character.stored_immortals?.some((si: StoredImmortal) => si.id === f.archetype_id) || profileData.player.character.c_stored_immortals?.includes(f.archetype_id));
		if (frozen?.length) {
			frozen.forEach((item: Definitions.BotCrew) => {
				profileData.player.character.crew.push({
					...item,
					skills: item.base_skills,
					rarity: item.max_rarity,
					level: 100,
					immortal: 1,
					equipment: [1, 2, 3, 4]
				} as any as PlayerCrew)
			});
		}
		return profileData;
	}

	return undefined;
}

export function toTimestamp(date: Date, format: 'd' | 'D' | 'f' | 'F' | 't' | 'T' | 'R' | undefined = 'D') {
	let n = Math.round(date.getTime() / 1000);
	if (format) {
		return `<t:${n}:${format}>`;
	}
	else {
		return `<t:${n}>`;
	}
}