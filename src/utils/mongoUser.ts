import { WithId } from "mongodb";
import { collections } from "../mongo";
import { IMongoUser, User } from "../mongoModels/mongoUser";
import { PlayerProfile } from "../mongoModels/playerProfile";
import { PlayerData } from "../datacore/player";
import { createHash } from "crypto";
import { IBuffStat } from "../datacore/worker";

function calculateBuffConfig(playerData: any): { [index: string]: IBuffStat } {
	const skills = ['command_skill', 'science_skill', 'security_skill', 'engineering_skill', 'diplomacy_skill', 'medicine_skill'];
	const buffs = ['core', 'range_min', 'range_max'];

	const buffConfig: { [index: string]: IBuffStat } = {};

	for (let skill of skills) {
		for (let buff of buffs) {
			buffConfig[`${skill}_${buff}`] = {
				multiplier: 1,
				percent_increase: 0
			};
		}
	}

	for (let buff of playerData.character.crew_collection_buffs.concat(playerData.character.starbase_buffs)) {
		if (buffConfig[buff.stat]) {
			if (buff.operator === 'percent_increase') {
				buffConfig[buff.stat].percent_increase += buff.value;
			} else if (buff.operator === 'multiplier') {
				buffConfig[buff.stat].multiplier = buff.value;
			} else {
				console.warn(`Unknown buff operator '${buff.operator}' for '${buff.stat}'.`);
			}
		}
	}

	return buffConfig;
}


export function createProfileObject(dbid: string, player_data: any, lastUpdate: Date) {
	if (!player_data || !player_data.player || !player_data.player.character || player_data.player.dbid.toString() !== dbid) {
		throw new Error('Invalid player_data!');
	}

	let captainName = player_data.player.character.display_name;

	let shortCrewList = {
		crew: player_data.player.character.crew.map((crew: any) => ({ id: crew.archetype_id, rarity: crew.rarity })),
		c_stored_immortals: player_data.player.character.c_stored_immortals,
		stored_immortals: player_data.player.character.stored_immortals
	};

	return { dbid, buffConfig: calculateBuffConfig(player_data.player), shortCrewList, captainName, lastUpdate };
}

export async function getProfile(dbid: number | string) {
    let res: PlayerProfile | null = null;

    if (typeof dbid === 'string') {
        dbid = Number.parseInt(dbid);
    }

    if (collections.profiles) {
        res = (await collections.profiles.findOne<WithId<PlayerProfile>>({ dbid: dbid })) as PlayerProfile;    
    }

    return res;
}


export async function postOrPutProfile(dbid: number, player_data: PlayerData, timeStamp: Date = new Date()) {    
    if (collections.profiles) {        
        let res = (await collections.profiles.findOne<WithId<PlayerProfile>>({ dbid: dbid })) as PlayerProfile;	
        
        let fleet = player_data.player.fleet?.id ?? 0;
        let squadron = player_data.player.squad?.id ?? 0;
        let profile = createProfileObject(dbid.toString(), player_data, timeStamp);
        let dbidHash = createHash('sha3-256').update(dbid.toString()).digest('hex');
        
        if (!res) {
            res = new PlayerProfile(dbid, dbidHash, player_data, timeStamp, profile.captainName, profile.buffConfig, profile.shortCrewList, fleet, squadron);
            let insres = await collections.profiles?.insertOne(res);            
            return !!(insres?.insertedId) ? dbidHash : 400;
        } else {            
            res.playerData = player_data;
            res.dbidHash = dbidHash;
            res.timeStamp = timeStamp;
            res.captainName = profile.captainName;
            res.buffConfig = profile.buffConfig;
            res.shortCrewList = profile.shortCrewList;
            res.fleet = fleet;
            res.squadron = squadron;          
            res.timeStamp = new Date();  
            let updres = await collections.profiles.updateOne(
                { dbid },
                { $set: res }
            );
            
            return !!(updres?.modifiedCount) ? dbidHash : 400;
        }    
    }

    return 500;
}

export async function deleteProfile(dbid: number) {
    if (collections.profiles) {
        await collections.profiles.deleteMany({ dbid: dbid });
    }
}

export async function deleteUser(discordId: string) {
    if (collections.users) {
        await collections.users.deleteMany({ discordUserId: discordId });
    }
}

export async function mongoGetUserByDiscordId(discordId: string) {

    if (collections.users) {
        let result = await collections.users.findOne<User>({ discordUserId: discordId });
        if (result) {
            return result;
        }
    }

    return undefined;
}

export async function mongoUpsertDiscordUser(user: IMongoUser) {

    if (collections.users) {
        
        if (!user.creationDate) user.creationDate = new Date();
        user.profiles ??= [];
        let test = await mongoGetUserByDiscordId(user.discordUserId);
        
        if (test) {
            await deleteUser(user.discordUserId);
        }

        let result = await collections.users.insertOne(user);

        if (result && result.insertedId) {
            if (result.insertedId) {
                return { ...user, id: result.insertedId } as User;
            }
            else {
                return mongoGetUserByDiscordId(user.discordUserId);
            }
        }
    }
    
    return undefined;
}