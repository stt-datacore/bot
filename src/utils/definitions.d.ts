import { CrewMember } from 'src/datacore/crew';

declare type CommandModule = import('yargs').CommandModule;

declare namespace Definitions {

	export interface IDilemmaChoice {
		text: string;
		reward: string[];
	}

	export interface IDilemma {
		title: string;
		choiceA: IDilemmaChoice;
		choiceB: IDilemmaChoice;
		choiceC?: IDilemmaChoice;
	}

	export interface Command extends CommandModule {
		name: string;
		options?: any;
	}

	export interface GuildConfigCommand {
		command: string;
		aliases?: string[];
		channelsDisabled?: string[];
		messageDisabled?: string;
	}

	export interface GuildCustomCommand {
		command: string;
		reply: string;
		asReply?: boolean;
	}

	export interface GuildConfig {
		overrideDefaultPrefixes?: boolean;
		prefixes?: string[];
		ignoreUnknownCommandForPrefix?: string;
		commands?: GuildConfigCommand[];
		customs?: GuildCustomCommand[];
		fleetids?: string[];
	}

	export type SkillName =
		| 'command_skill'
		| 'science_skill'
		| 'security_skill'
		| 'engineering_skill'
		| 'diplomacy_skill'
		| 'medicine_skill';

	export interface Skill {
		core: number;
		range_min: number;
		range_max: number;
	}

	export type Skills = { [key in SkillName]?: Skill };

	export interface BuffConfigEntry {
		multiplier: number;
		percent_increase: number;
	}

	// We actually know the index strings, but we need more flexibility
	export type BuffConfig = { [index: string]: BuffConfigEntry };

	export interface CrewActionChargePhase {
		charge_time: number;
		ability_amount?: number;
		bonus_amount?: number;
		duration?: number;
		cooldown?: number;
	}

	export interface CrewActionAbility {
		amount: number;
		condition: number;
		type: number;
	}

	export interface CrewAction {
		ability?: CrewActionAbility;
		bonus_amount: number;
		bonus_type: number;
		charge_phases?: CrewActionChargePhase[];
		cooldown: number;
		crew: number;
		duration: number;
		icon: {
			file: string;
		};
		initial_cooldown: number;
		limit?: number;
		name: string;
		penalty?: {
			type: number;
			amount: number;
		};
		special: boolean;
		symbol: string;
	}

	export interface EquipmentSlot {
		level: number;
		symbol: string
	}

	export interface ShipScores {
		overall: number,
		arena: number,
		fbb: number,
		kind: 'offense' | 'defense' | 'ship',
		divisions: {
			fbb: {
				1?: number,
				2?: number,
				3?: number,
				4?: number,
				5?: number,
				6?: number
			},
			arena: {
				1?: number,
				2?: number,
				3?: number
			}
		}
	}

	export interface RankScoring {
		am_seating: number;
		collections: number;
		gauntlet: number;
		main_cast: number;
		overall_grade: string;
		overall_rank: number;
		overall: number;
		tuvix: number;
		potential_cols: number;
		quipment: number;
		rarity_overall: number;
		ship: ShipScores;
		shuttle: number;
		skill_rarity: number;
		tertiary_rarity: number;
		trait: number;
		velocity: number;
		crit: number;
		voyage: number;
	}

	export interface BotCrewRanks {
		[key: string]: any;
		voyRank: number;
		gauntletRank: number;
		chronCostRank: number;
		traitRank: number;
		scores: RankScoring;
		B_SEC?: number;
		A_SEC?: number;
		V_CMD_SEC?: number;
		G_CMD_SEC?: number;
		V_SCI_SEC?: number;
		G_SCI_SEC?: number;
		V_SEC_ENG?: number;
		G_SEC_ENG?: number;
		V_SEC_DIP?: number;
		G_SEC_DIP?: number;
		V_SEC_MED?: number;
		G_SEC_MED?: number;
		B_CMD?: number;
		A_CMD?: number;
		V_CMD_SCI?: number;
		G_CMD_SCI?: number;
		V_CMD_ENG?: number;
		G_CMD_ENG?: number;
		V_CMD_DIP?: number;
		G_CMD_DIP?: number;
		V_CMD_MED?: number;
		G_CMD_MED?: number;
		B_DIP?: number;
		A_DIP?: number;
		voyTriplet?: VoyTriplet;
		V_SCI_DIP?: number;
		G_SCI_DIP?: number;
		V_ENG_DIP?: number;
		G_ENG_DIP?: number;
		V_DIP_MED?: number;
		G_DIP_MED?: number;
		B_MED?: number;
		A_MED?: number;
		V_SCI_MED?: number;
		G_SCI_MED?: number;
		V_ENG_MED?: number;
		G_ENG_MED?: number;
		B_SCI?: number;
		A_SCI?: number;
		V_SCI_ENG?: number;
		G_SCI_ENG?: number;
		B_ENG?: number;
		A_ENG?: number;
	}

	export interface BotCrew extends CrewMember {
		archetype_id: number;
		symbol: string;
		name: string;
		short_name: string;
		traits_named: string[];
		traits_hidden: string[];
		imageUrlPortrait: string;
		collections: string[];
		totalChronCost: number;
		factionOnlyTotal: number;
		craftCost: number;
		max_rarity: number;
		bigbook_tier: number;
		cab_ov: string;
		cab_ov_rank: string;
		cab_ov_grade: string;
		events: number;
		ranks: BotCrewRanks;
		base_skills: Skills;
		skill_data: { rarity: number; base_skills: Skills }[];
		in_portal: boolean;
		markdownContent: string;
		markdownInfo: {
			author: string;
			modified: Date;
		}
		action: CrewAction;
		equipment_slots: EquipmentSlot[];
		nicknames?: {
			cleverThing: string;
			creator?: string;
		}[];
		date_added: Date | string;
		obtained?: string;
		// Added by the loading code
		traits_pseudo: string[];
		traits: string[];
		traits_hidden: string[];
		traits_named?: string[];
	}

	export interface RecipeItem {
		count: number;
		factionOnly: boolean;
		symbol: string;
	}

	export interface Recipe {
		incomplete: boolean;
		craftCost: number;
		list: RecipeItem[];
	}

	export interface ItemSource {
		type: number;
		name: string;
		energy_quotient: number;
		chance_grade: number;
		dispute?: number;
		mastery?: number;
		mission_symbol?: string;
		cost?: number;
		avg_cost?: number;
	}

	export interface Item {
		symbol: string;
		type: number;
		name: string;
		flavor: string;
		rarity: number;
		recipe: Recipe;
		item_sources: ItemSource[];
		bonuses: { [key: string]: number };
		imageUrl: string;
		factionOnly: boolean;


		duration?: number;
		max_rarity_requirement?: number;
		traits_requirement_operator?: string; // "and" | "or" | "not" | "xor";
		traits_requirement?: string[];
		kwipment?: boolean;
		kwipment_id?: number | string;
	}

	export interface UpcomingEvent {
		name: string;
		type: string;
		dates: string;
		startDate: Date;
		endDate: Date;
		highbonus: string[];
		smallbonus: {
			traits: string[];
		};
	}

	export interface EventInstance {
		instance_id: number
		fixed_instance_id: number
		event_id: number
		event_name: string
		image: string
		event_details?: boolean
	  }


	export interface EventDetails {
		id: number
		symbol: string
		name: string
		description: string
		rules: string
		bonus_text: string
		rewards_teaser: string
		shop_layout: string
		featured_crew: BotCrew[]
		threshold_rewards: Item[]
		ranked_brackets: any[]
		squadron_ranked_brackets: any[]
		content: any[]
		instance_id: number
		status: number
		seconds_to_start: number
		content_types: string[]
		seconds_to_end: number
		phases: any[]
		quest: any[]
		bonus?: string[];
		featured?: string[];
		image?: string;
	  }
}
