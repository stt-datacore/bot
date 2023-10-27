import { ObjectId } from "mongodb";
import { PlayerData } from "../datacore/player";

import { PlayerProfile } from "./playerProfile";

export enum UserRole {
    NORMAL = 'normal',
    DISCORDONLY = 'discordonly',
    STTLOGIN = 'sttlogin',
    BOOKEDITOR = 'bookeditor',
    ADMIN = 'admin'
}

export interface IMongoUser {
    discordUserName: string,
    discordUserDiscriminator: string,
    discordUserId: string,
    profiles: number[],
    userRole: UserRole,
    creationDate?: Date,
    avatar?: string,
    id?: ObjectId
}

export class User implements IMongoUser {
    constructor(        
        public discordUserName: string,
        public discordUserDiscriminator: string,
        public discordUserId: string,
        public profiles: number[],
        public userRole: UserRole = UserRole.NORMAL,
        public creationDate: Date = new Date(),
        public avatar?: string,
        public id?: ObjectId) {
    }    
}


