import fs from 'fs';
import fetch from 'node-fetch';
import { CommandInteraction, GuildMember, Message } from 'discord.js';
import { User as MongoUser, UserRole } from '../mongoModels/mongoUser';
import CONFIG from './config';
import { DCData } from '../data/DCData';

import { executeGetRequest } from './sttapi';
import { Logger } from '../utils';
import { stripPlayerData } from './playerutils';
import { discordUserFromMessage } from './discord';
import { deleteProfile, deleteUser, getProfile, mongoGetUserByDiscordId, mongoUpsertDiscordUser } from './mongoUser';
import { PlayerProfile } from '../mongoModels/playerProfile';

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
}

export interface ProfileRosterEntry {
	crew: Definitions.BotCrew;
	skills: Definitions.Skills;
	rarity: number;
	voyageScore: number;
	gauntletScore: number;
}

export async function loadProfile(dbid: string | number): Promise<ProfileEntry | undefined> {
	let profile = await getProfile(dbid);

	if (!profile) {
		return undefined;
	}

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
		lastUpdate: profile.timeStamp,
		buffConfig: profile.buffConfig,
		userId: profile.dbid
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
	return await mongoGetUserByDiscordId(id);
	//return await User.findOne({ where: { discordUserId: `${id}` }, include: [Profile] });
}

export async function createUserFromMessage(message: Message) {
	let userDB = await userFromMessage(message);

	if (!userDB) {
		userDB = await mongoUpsertDiscordUser({
			discordUserName: message.member?.user.username ?? '',
			discordUserDiscriminator: message.member?.user.discriminator ?? '',
			discordUserId: message.member?.id ?? '',
			profiles: [],
			userRole: UserRole.DISCORDONLY
		});
	} else if (message.member) {
		userDB.discordUserName = message.member.user.username;
		userDB.discordUserDiscriminator = message.member.user.discriminator;
		userDB = await mongoUpsertDiscordUser(userDB);
	}

	return userDB;
}

export async function associateUser(userDB: MongoUser, dbid: string, access_token?: string) {
	if (access_token) {
		let result = await refreshProfile(access_token);
		if (!result) {
			return {
				error: `An error occured; make sure all parameters are correct (no quotes or extra characters)`
			};
		}
	}

	let profile = await getProfile(Number.parseInt(dbid));

	if (!profile) {
		return {
			error: `DBID not found. Make sure you uploaded the profile for the correct account at ${CONFIG.DATACORE_URL}playertools `
		};
	}

	if (userDB.profiles?.includes(Number.parseInt(dbid))) {
		return {
			error: `DBID ${dbid} is already associated with ${userDB.discordUserName}. If you believe this is incorrect, contact the bot administrator to resolve the issue.`
		};
	}

	userDB.profiles ??= [];
	userDB.profiles.push(Number.parseInt(dbid));

	await mongoUpsertDiscordUser(userDB);
	return { profile };
}

export async function clearUser(userDB: MongoUser) {
	let dbids = [];
	for (let profileDB of userDB.profiles) {
		dbids.push(profileDB);	
	}

	userDB.profiles = [];
	await mongoUpsertDiscordUser(userDB);

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

export async function loadFullProfile(dbid: string | number): Promise<PlayerProfile | null> {
	if (typeof dbid === 'string') {
		return await getProfile(Number.parseInt(dbid));
	}
	else {
		return await getProfile(dbid);
	}
	
}