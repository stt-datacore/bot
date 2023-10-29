import { BossBattlesRoot } from "./boss";
import { BaseSkills, Skill } from "./crew";
import { PlayerCollection, PlayerCrew, PlayerData } from "./player";
import { Ship } from "./ship";

import { EquipmentCommon, EquipmentItem } from "./equipment";


/* TODO: move IBuffStat, calculateBuffConfig to crewutils.ts (currently not used by voyage calculator) */
export interface IBuffStat {
	multiplier: number;
	percent_increase: number;
}

export interface BuffStatTable {
	[key: string]: IBuffStat;
}

export interface GameWorkerOptionsList {
    key: number;
    value: number;
    text: string;
}
export interface VoyageStatsConfig {
    others?: number[];
    numSims: number;
    startAm: number;
    currentAm: number;
    elapsedSeconds: number;
    variance: number;
    ps?: Skill;
    ss?: Skill;
}

export interface GameWorkerOptions {
    strategy?: string;
    searchDepth?: number;
    extendsTarget?: number;
}

export interface CalculatorProps {
    playerData: PlayerData;
    allCrew: PlayerCrew[];
}

export interface AllData extends CalculatorProps {
    allShips?: Ship[];
    playerShips?: Ship[];
    useInVoyage?: boolean;
    bossData?: BossBattlesRoot;
    buffConfig?: BuffStatTable;
}

export interface VoyageConsideration {
    ship: Ship;
    score: number;
    traited: boolean;
    bestIndex: number;
    archetype_id: number;
}

export interface Calculation {
    id: string;
    requestId: string;
    name: string;
    calcState: number;
    result?: CalcResult;
    trackState?: number;
    confidenceState?: number;
}

export interface CalcResult {
    estimate: Estimate;
    entries: CalcResultEntry[];
    aggregates: Aggregates;
    startAM: number;
}

export interface Estimate {
    refills: Refill[];
    dilhr20: number;
    refillshr20: number;
    final: boolean;
    deterministic?: boolean;
    antimatter?: number;
}

export interface Refill {
    all: number[];
    result: number;
    safeResult: number;
    saferResult: number;
    moonshotResult: number;
    lastDil: number;
    dilChance: number;
    refillCostResult: number;
}

export interface CalcResultEntry {
    slotId: number;
    choice: PlayerCrew;
    hasTrait: boolean | number;
}

export interface Aggregates {
    command_skill: AggregateSkill;
    science_skill: AggregateSkill;
    security_skill: AggregateSkill;
    engineering_skill: AggregateSkill;
    diplomacy_skill: AggregateSkill;
    medicine_skill: AggregateSkill;
}

export interface AggregateSkill extends Skill {
    skill: string;
}

export interface CalcConfig {
    estimate: number;
    minimum: number;
    moonshot: number;
    antimatter: number;
    dilemma: {
        hour: number;
        chance: number;
    };
    refills?: Refill[];
    confidence?: number;
}

export interface JohnJayBest {
    key: string;
    crew: JJBestCrewEntry[];
    traits: number[];
    skills: BaseSkills;
    estimate: Estimate;
}

export interface JJBestCrewEntry {
    id: number;
    name: string;
    score: number;
}

export interface ExportCrew {
    id: number;
    name: string;
    traitBitMask: number;
    max_rarity: number;
    skillData: number[];
}

export interface EquipmentWorkerConfig {
    items: EquipmentItem[];
    playerData: PlayerData;
    addNeeded?: boolean;
}

export interface EquipmentWorkerResults {
    items: (EquipmentCommon | EquipmentItem)[];    
}
