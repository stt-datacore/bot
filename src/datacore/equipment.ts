import { Icon } from "./game-elements"
import { PlayerCrew, PlayerEquipmentItem } from "./player"

export interface EquipmentCommon extends PlayerEquipmentItem {
  symbol: string
  type: number
  name: string
  flavor: string
  rarity: number
  short_name?: string
  imageUrl: string
  bonuses?: EquipmentBonuses
  quantity?: number;
  needed?: number;
  factionOnly?: boolean;
  demandCrew?: string[];
}

export interface EquipmentItem extends EquipmentCommon {
  symbol: string
  type: number
  name: string
  flavor: string
  rarity: number
  short_name?: string
  imageUrl: string
  bonuses?: EquipmentBonuses
  quantity?: number;
  needed?: number;
  factionOnly?: boolean;

  item_sources: EquipmentItemSource[]
  recipe?: EquipmentRecipe

  empty?: boolean;
  isReward?: boolean;

}

export interface EquipmentItemSource {
  type: number
  name: string
  energy_quotient: number
  chance_grade: number
  dispute?: number
  mastery?: number
  mission_symbol?: string
  cost?: number
  avg_cost?: number
  cadet_mission?: string;
  cadet_symbol?: string;
}

export interface EquipmentRecipe {
  incomplete: boolean
  craftCost: number
  list: EquipmentIngredient[]
}

export interface EquipmentIngredient {
  count: number
  factionOnly: boolean
  symbol: string
}

export interface EquipmentBonuses {
    [key: string]: number;
}
