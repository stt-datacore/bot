
import { ObjectId } from "mongodb";
import { PlayerData } from "../datacore/player";
import { Chain, Solve, CrewTrial } from "../datacore/boss";

export interface IFBB_BossBattle_Document {
	bossBattleId: number;	// can also index ON fleetId AND bossId AND difficultyId
	fleetId: number;
	bossGroup: string;
	difficultyId: number;
	chainIndex: number;
	chain: Chain;
	description: string;
	roomCode: string;
	timeStamp: Date;
	id?: ObjectId;
};

export interface IFBB_Solve_Document {
	bossBattleId: number;
	chainIndex: number;
	solve: Solve;
	timeStamp: Date;
	id?: ObjectId;
};

export interface IFBB_Trial_Document {
	bossBattleId: number;
	chainIndex: number;
	trial: CrewTrial;
	timeStamp: Date;
	id?: ObjectId;
};


export class BossBattleDocument implements IFBB_BossBattle_Document {
    constructor(
        public bossBattleId: number,
        public fleetId: number,
        public bossGroup: string,
        public difficultyId: number,
        public chainIndex: number,
        public chain: Chain,
        public description: string,
        public roomCode: string,
        public timeStamp: Date = new Date(),
        public id?: ObjectId) {
    }        
}

export class SolveDocument implements IFBB_Solve_Document {
	constructor(
        public bossBattleId: number,
        public chainIndex: number,
        public solve: Solve,
        public timeStamp: Date = new Date(),
        public id?: ObjectId) {
    }
};

export class TrialDocument implements IFBB_Trial_Document {
    constructor(
        public bossBattleId: number,
        public chainIndex: number,
        public trial: CrewTrial,
        public timeStamp: Date = new Date(),
        public id?: ObjectId | undefined) {
    }
}
