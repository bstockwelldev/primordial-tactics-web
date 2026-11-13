export type DinosaurSpeciesId =
  | 'velociraptor'
  | 'triceratops'
  | 'pteranodon'
  | 'ankylosaurus'
  | 'dilophosaurus';

export type EvolutionBranchId =
  | 'deinonychus'
  | 'ghost_raptor'
  | 'styracosaurus'
  | 'titan_trike'
  | 'quetzalcoatlus'
  | 'storm_skimmer'
  | 'doedicurus'
  | 'bastion_ankylosaur'
  | 'apex_carno'
  | 'acid_dilopho';

export type UnitClass =
  | 'Blade'
  | 'Skewer'
  | 'Crush'
  | 'Hulk'
  | 'Human'
  | 'Striker'
  | 'Tank'
  | 'Scout'
  | 'Siege'
  | 'Controller';

export interface MagitekAugment {
  id: string;
  name: string;
  slot: 'weapon' | 'carapace' | 'neural' | 'reactor';
  statBonus: { hp?: number; attack?: number; defense?: number; speed?: number };
  unlockedAbilityId?: string;
  magitekCost: number;
  description: string;
  iconName: string;
}

export interface IslandSector {
  id: string;
  islandId: 'primoris' | 'caldera' | 'tempest' | 'magitek_core';
  islandName: string;
  sectorName: string;
  liberated: boolean;
  threatLevel: number;
  enemySquad: Array<{
    name: string;
    speciesId?: DinosaurSpeciesId;
    level: number;
    unitClass: UnitClass;
  }>;
  rewards: { amber: number; titanite: number; magitekCores: number; wood: number };
  loreLog: string;
}

export interface Ability {
  id: string;
  name: string;
  apCost: number;
  cooldown: number;
  currentCooldown?: number;
  range: number;
  areaOfEffect?: number;
  targetType: 'enemy' | 'ally' | 'self' | 'tile';
  damageMultiplier?: number;
  torporDamage?: number;
  healAmount?: number;
  effect?: 'bleed' | 'stun' | 'blind' | 'shield' | 'charge' | 'knockback';
  description: string;
  iconName: string;
}

export interface EvolutionNode {
  id: EvolutionBranchId;
  name: string;
  description: string;
  requiredLevel: number;
  requiredAmber: number;
  statMultipliers: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
  bonusAbility: Ability;
}

export interface SpeciesDefinition {
  id: DinosaurSpeciesId;
  name: string;
  unitClass: UnitClass;
  description: string;
  imageUrl?: string;
  baseHp: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number; // movement range in tiles
  baseTorporMax: number;
  diet: 'Carnivore' | 'Herbivore' | 'Piscivore';
  tamingFood: string;
  innateAbilities: Ability[];
  evolutionBranches: EvolutionNode[];
}

export interface TamedDino {
  instanceId: string;
  speciesId: DinosaurSpeciesId;
  customName: string;
  level: number;
  xp: number;
  currentHp: number;
  maxHp: number;
  currentTorpor: number;
  maxTorpor: number;
  attack: number;
  defense: number;
  speed: number;
  evolution?: EvolutionBranchId;
  equippedAbilities: string[]; // Ability IDs (up to 3)
  equippedAugments?: string[]; // Magitek Augment IDs
  assignedSlot?: number;
  imageUrl?: string;
}

export interface UnitEntity {
  id: string;
  isPlayer: boolean;
  ownerId: string;
  /** Pass & play: which human (slot 0 or 1) commands this unit. Absent in solo matches, meaning slot 0. */
  controller?: 0 | 1;
  name: string;
  speciesId?: DinosaurSpeciesId;
  unitClass: UnitClass;
  imageUrl?: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  torpor: number;
  maxTorpor: number;
  ap: number;
  maxAp: number;
  attack: number;
  defense: number;
  speed: number;
  abilities: Ability[];
  statusEffects: Array<{
    type: 'bleed' | 'stun' | 'blind' | 'shield';
    duration: number;
    value?: number;
  }>;
  avatarIcon: string;
}

export type TileType = 'grass' | 'water' | 'rock' | 'mud' | 'foliage' | 'bones';

export interface GridTile {
  x: number;
  y: number;
  type: TileType;
  walkable: boolean;
  defenseBonus?: number;
}

export interface BattleActionLog {
  id: string;
  turn: number;
  actorName: string;
  actionName: string;
  targetName?: string;
  damage?: number;
  torpor?: number;
  effectApplied?: string;
  text: string;
  timestamp: string;
}

export interface PrehistoricResources {
  wood: number;
  flint: number;
  fiber: number;
  iron: number;
  primalMeat: number;
  amber: number;
  titanite: number;
  magitekCores: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'survival' | 'taming' | 'equipment' | 'alchemy' | 'magitek';
  description: string;
  cost: Partial<PrehistoricResources>;
  craftTimeSeconds: number;
  resultType: string;
  quantity: number;
}

export interface BaseBuilding {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  costNextLevel: Partial<PrehistoricResources>;
  perks: string[];
  icon: string;
}

export interface ArenaRoomState {
  roomId: string;
  name: string;
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  status: 'waiting' | 'in_progress' | 'completed';
  activeTurnPlayerId: string;
  turnNumber: number;
  turnTimeLeft: number;
  gridWidth: number;
  gridHeight: number;
  units: UnitEntity[];
  actionLogs: BattleActionLog[];
  winnerId?: string;
}

