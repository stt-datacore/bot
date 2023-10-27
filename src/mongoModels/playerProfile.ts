import { ObjectId } from "mongodb";
import { PlayerData } from "../datacore/player";

export class PlayerProfile {
    constructor(public dbid: number, 
        public dbidHash: string,
        public playerData: PlayerData, 
        public timeStamp: Date, 
        public captainName: string,
        public buffConfig: any,
        public shortCrewList: any,
        public fleet: number = 0, 
        public squadron: number = 0,
        public sttAccessToken?: string,
        public id?: ObjectId) {
    }    
}


