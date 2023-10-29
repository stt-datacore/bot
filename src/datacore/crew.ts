import { ShipBonus, ShipAction as ShipAction } from "./ship";
import { Icon } from "./game-elements"

export interface CrossFuseTarget {
  symbol: string;
  name?: string;
}

/**
 * The is the crew roster model from crew.json
 * 
 * This is the model for the master list of all crew in STT.
 * PlayerCrew derives from this and CompactCrew.
 */
export interface CrewMember {
  symbol: string
  name: string
  short_name: string
  flavor: string
  archetype_id: number
  max_rarity: number
  equipment_slots: EquipmentSlot[]
  voice_over?: string
  traits: string[]
  traits_hidden: string[]
  base_skills: BaseSkills
  ship_battle: ShipBonus
  action: ShipAction;
  cross_fuse_targets: CrossFuseTarget | [];
  skill_data: SkillData[]
  intermediate_skill_data: IntermediateSkillData[]
  is_craftable: boolean
  imageUrlPortrait: string
  imageUrlFullBody: string
  series?: string
  traits_named: string[]
  collections: string[]
  nicknames: Nickname[]
  cab_ov: string
  cab_ov_rank: number
  cab_ov_grade: string
  totalChronCost: number
  factionOnlyTotal: number
  craftCost: number
  ranks: Ranks
  bigbook_tier: number
  events: number
  in_portal: boolean
  date_added: Date
  obtained: string
  markdownContent: string
  unique_polestar_combos?: string[][]
  constellation?: CrewConstellation
  kwipment?: any[]
  q_bits?: number

  /** Used internally, not part of incoming data */
  pickerId?: number;
  pairs?: Skill[][];  
}

export interface EquipmentSlot {
  level: number
  symbol: string
  imageUrl?: string;
}

export enum BaseSkillFields {
  SecuritySkill = 'security_skill',
  CommandSkill = 'command_skill',
  DiplomacySkill = 'diplomacy_skill',
  MedicineSkill = 'medicine_skill',
  ScienceSkill = 'science_skill',
  EngineeringSkill = 'engineering_skill',
}

export interface BaseSkills {
  security_skill?: Skill
  command_skill?: Skill
  diplomacy_skill?: Skill
  medicine_skill?: Skill
  science_skill?: Skill
  engineering_skill?: Skill
}


export interface Skill {
  core: number
  range_min: number
  range_max: number
  skill?: string;
}

export interface ComputedSkill {
  core: number;
  min: number;
  max: number;
  skill?: string;
}

export interface SkillsSummary {
	key: string;
	skills: string[];
	total: number;
	owned: number;
	ownedPct: number;
	average: number;
	best: {
		score: number;
		name: string;
	},
	tenAverage: number;
	maxPct: number;
};

export interface ComputedBuff {
  core: number
  min: number
  max: number
  skill?: string;
}

export interface SkillData {
  rarity: number
  base_skills: BaseSkills
}

export interface IntermediateSkillData extends SkillData {
  level: number
  action: ShipAction
  ship_battle: ShipBonus
}

export interface Nickname {
  actualName: string
  cleverThing: string
  creator?: string
}

export interface Ranks {
  voyRank: number
  gauntletRank: number
  chronCostRank: number
  B_SEC?: number
  A_SEC?: number
  V_CMD_SEC?: number
  G_CMD_SEC?: number
  V_SCI_SEC?: number
  G_SCI_SEC?: number
  V_SEC_ENG?: number
  G_SEC_ENG?: number
  V_SEC_DIP?: number
  G_SEC_DIP?: number
  V_SEC_MED?: number
  G_SEC_MED?: number
  B_CMD?: number
  A_CMD?: number
  V_CMD_SCI?: number
  G_CMD_SCI?: number
  V_CMD_ENG?: number
  G_CMD_ENG?: number
  V_CMD_DIP?: number
  G_CMD_DIP?: number
  V_CMD_MED?: number
  G_CMD_MED?: number
  B_DIP?: number
  A_DIP?: number
  voyTriplet?: VoyTriplet
  V_SCI_DIP?: number
  G_SCI_DIP?: number
  V_ENG_DIP?: number
  G_ENG_DIP?: number
  V_DIP_MED?: number
  G_DIP_MED?: number
  B_MED?: number
  A_MED?: number
  V_SCI_MED?: number
  G_SCI_MED?: number
  V_ENG_MED?: number
  G_ENG_MED?: number
  B_SCI?: number
  A_SCI?: number
  V_SCI_ENG?: number
  G_SCI_ENG?: number
  B_ENG?: number
  A_ENG?: number
}

export interface VoyTriplet {
  name: string
  rank: number
}

export interface CrewConstellation {
  id: number
  symbol: string
  name: string
  short_name: string
  flavor: string
  icon: Icon
  keystones: number[]
  type: string
  crew_archetype_id: number
}

export interface RewardsGridNeed {
	symbol: string;
	quantity: number;
}
