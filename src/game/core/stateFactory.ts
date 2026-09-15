// Default persistent-state factory. Everything that survives save/load starts here.
import { VERSION, INVENTORY_BASE_SLOTS, AUTOSAVE_INTERVAL_SEC } from './Constants.ts';
import type { DifficultyKey } from './Constants.ts';
import { SETTINGS_DEFAULTS } from '../systems/SettingsSystem.ts';

export interface AppearanceState {
  skin: string;
  hairStyle: string;
  hairColor: string;
  outfitTier: number;
}

export interface PlayerAlloc {
  strength: number;
  defense: number;
  agility: number;
  intellect: number;
  willpower: number;
  [key: string]: number;
}

export interface ProfessionState {
  lv: number;
  xp: number;
}

export interface PlayerProfessions {
  woodcutting: ProfessionState;
  mining: ProfessionState;
  survival: ProfessionState;
  combat: ProfessionState;
  crafting: ProfessionState;
  [key: string]: ProfessionState;
}

export interface EquipmentInstance {
  ref: string;
  id: string;
  dur: number | null;
  [key: string]: any;
}

export interface EquipmentSlots {
  weapon: EquipmentInstance | null;
  offhand: EquipmentInstance | null;
  helmet: EquipmentInstance | null;
  chest: EquipmentInstance | null;
  gloves: EquipmentInstance | null;
  boots: EquipmentInstance | null;
  ring: EquipmentInstance | null;
  amulet: EquipmentInstance | null;
  [slot: string]: EquipmentInstance | null;
}

export interface PlayerState {
  name: string;
  gender: string;
  appearance: AppearanceState;
  personality: string; // bold | stoic | kind | clever
  level: number;
  xp: number;
  statPoints: number;
  skillPoints: number;
  alloc: PlayerAlloc;
  professions: PlayerProfessions;
  hp: number;
  stamina: number;
  hunger: number;
  thirst: number;
  coldExposure: number;
  gold: number;
  reputation: number;
  equipment: EquipmentSlots;
  skills: Record<string, any>;
  derived: Record<string, any> | null; // assembled by ProgressionSystem.recompute()
  /** NG+ heirloom boon id granted by LegacyStore.applyBoon (set post-creation). */
  heirloom?: string | null;
  [key: string]: any;
}

export interface InventoryEntry {
  id: string;
  qty: number;
  [key: string]: any;
}

export interface SettlementBuilding {
  uid: string;
  key: string;
  x: number;
  y: number;
  tier: number;
  hp: number;
  maxHp: number;
  builtProgress: number; // 0..1
  complete: boolean;
  builders: string[];
  [key: string]: any;
}

export interface SettlementCitizen {
  uid: string;
  name: string;
  role: string;
  job: string | null;
  skillLv: number;
  /** Optional: legacy/current citizens are created without it (nothing reads it). */
  happiness?: number;
  recruitedAt: number;
  [key: string]: any;
}

export interface SettlementMilitary {
  militia: number;
  swordsman: number;
  archer: number;
  cavalry: number;
  knight: number;
  [key: string]: number;
}

export interface SettlementState {
  founded: boolean;
  pos: { x: number; y: number } | null;
  stageIndex: number;
  buildings: SettlementBuilding[]; // { uid, key, x, y, tier, hp, maxHp, builtProgress(0..1), complete, builders[] }
  citizens: SettlementCitizen[]; // { uid, name, role, job, skillLv, happiness, recruitedAt }
  jobAssign: Record<string, string>; // buildingUid -> citizenUid
  military: SettlementMilitary;
  happiness: number;
  taxesToday: number;
  lastTaxStamp: number;
  overflow: InventoryEntry[]; // production deposited while player away: [{id, qty}]
  nextRaidAt: number | null;
  raidsSurvived: number;
  [key: string]: any;
}

export interface WorldState {
  discoveredPois: string[]; // poi ids
  poiStates: Record<string, any>; // id -> { looted, bossSlain, cleared, ... }
  exploredChunks: string[]; // ["cx,cy"]
  ownedCamps: string[]; // camp poi ids captured
  unlockedFastTravel: string[];
  activeWeather: string;
  weatherTimer: number;
  dayCount: number;
  timeOfDay: number;
  chapterEventsSeen: string[];
  [key: string]: any;
}

export interface QuestsState {
  chainIndex: number; // index into QUEST_ORDER
  stepIdx: Record<string, any>;
  progress: Record<string, number>; // `${qid}:${step}` -> count
  sideActive: string[];
  sideCompleted: string[];
  [key: string]: any;
}

export interface JournalEntry {
  key: string;
  title: string;
  body: string;
  [key: string]: any;
}

export interface StoryState {
  chapter: number;
  flags: Record<string, any>;
  journal: JournalEntry[]; // { key, title, body }
  [key: string]: any;
}

export interface FactionState {
  rel: number;
  status: string;
  allyRequestedByUs: boolean;
  alliedToUs: boolean;
  atWarWithUs: boolean;
  lastGiftStamp: number;
  [key: string]: any;
}

export interface StatsState {
  kills: number;
  crafted: number;
  nightsSurvived: number;
  [key: string]: number;
}

export interface GameSettings {
  difficulty: DifficultyKey;
  autosaveSec: number;
  [key: string]: any;
}

export interface MetaState {
  version: string;
  seed: number;
  createdAt: number;
  playSeconds: number;
  characterClassNote: string;
  [key: string]: any;
}

export interface GameRootState {
  meta: MetaState;
  player: PlayerState;
  inventory: InventoryEntry[];
  inventorySlots: number;
  settlement: SettlementState;
  world: WorldState;
  quests: QuestsState;
  story: StoryState;
  factions: Record<string, FactionState>;
  achievements: Record<string, any>; // id -> timestamp
  stats: StatsState;
  settings: GameSettings;
  /** Set on death by combat code, cleared on respawn (not part of the save schema). */
  session_dead?: boolean;
  [key: string]: any;
}

/** Identity fields gathered by character creation. All optional — defaults apply. */
export interface CharOpts {
  name?: string;
  appearance?: Partial<AppearanceState>;
  gender?: string;
  personality?: string;
  heirloom?: string;
}

export interface StarterEntry {
  id: string;
  qty: number;
  eq?: string; // equipment slot to fill, if any
}

export function createStateDefaults(seed: number): GameRootState {
  return {
    meta: {
      version: VERSION,
      seed,
      createdAt: Date.now(),
      playSeconds: 0,
      characterClassNote: ''
    },

    player: {
      name: 'Stranger',
      gender: 'm',
      appearance: { skin: '#caa27c', hairStyle: 'short', hairColor: '#4a3222', outfitTier: 0 },
      personality: 'bold', // bold | stoic | kind | clever
      level: 1,
      xp: 0,
      statPoints: 0,
      skillPoints: 0,
      alloc: { strength: 0, defense: 0, agility: 0, intellect: 0, willpower: 0 },
      professions: {
        woodcutting: { lv: 0, xp: 0 },
        mining: { lv: 0, xp: 0 },
        survival: { lv: 0, xp: 0 },
        combat: { lv: 0, xp: 0 },
        crafting: { lv: 0, xp: 0 }
      },
      hp: 100,
      stamina: 100,
      hunger: 82,
      thirst: 78,
      coldExposure: 0,
      gold: 12,
      reputation: 0,
      equipment: {
        weapon: null, offhand: null, helmet: null, chest: null,
        gloves: null, boots: null, ring: null, amulet: null
      },
      skills: {},
      derived: null // assembled by ProgressionSystem.recompute()
    },

    inventory: [],
    inventorySlots: INVENTORY_BASE_SLOTS,

    settlement: {
      founded: false,
      pos: null,
      stageIndex: 0,
      buildings: [],        // { uid, key, x, y, tier, hp, maxHp, builtProgress(0..1), complete, builders[] }
      citizens: [],         // { uid, name, role, job, skillLv, happiness, recruitedAt }
      jobAssign: {},        // buildingUid -> citizenUid
      military: { militia: 0, swordsman: 0, archer: 0, cavalry: 0, knight: 0 },
      happiness: 62,
      taxesToday: 0,
      lastTaxStamp: -1,
      overflow: [],         // production deposited while player away: [{id, qty}]
      nextRaidAt: null,
      raidsSurvived: 0
    },

    world: {
      discoveredPois: [],   // poi ids
      poiStates: {},        // id -> { looted, bossSlain, cleared, ... }
      exploredChunks: [],   // ["cx,cy"]
      ownedCamps: [],       // camp poi ids captured
      unlockedFastTravel: [],
      activeWeather: 'clear',
      weatherTimer: 0,
      dayCount: 1,
      timeOfDay: 0.32,
      chapterEventsSeen: []
    },

    quests: {
      chainIndex: 0,        // index into QUEST_ORDER
      stepIdx: {},
      progress: {},         // `${qid}:${step}` -> count
      sideActive: [],
      sideCompleted: []
    },

    story: {
      chapter: 1,
      flags: {},
      journal: []           // { key, title, body }
    },

    factions: Object.fromEntries(
      Object.entries({ iron: -5, verdant: 8, league: 0, ashen: -45, ancient: 0 }).map(([k, base]) => [
        k, { rel: base, status: base <= -70 ? 'war' : base < -30 ? 'hostile' : base >= 75 ? 'allied' : base > 28 ? 'cordial' : 'neutral',
             allyRequestedByUs: false, alliedToUs: false, atWarWithUs: false, lastGiftStamp: 0 }
      ])
    ),

    achievements: {},       // id -> timestamp

    stats: { kills: 0, crafted: 0, nightsSurvived: 0 },

    settings: {
      // Schema owned by SettingsSystem.SAVE_SETTINGS_KEYS. New toggles added
      // there will appear here automatically.
      ...SETTINGS_DEFAULTS,
      // Difficulty still gets the legendary-friendly caps applied at boot.
      difficulty: 'normal',
      // AUTOSAVE_INTERVAL_SEC default is mirrored into SETTINGS_DEFAULTS.
      autosaveSec: AUTOSAVE_INTERVAL_SEC
    }
  };
}

export const STARTER_KIT = (): StarterEntry[] => [
  { id: 'traveler_garb', qty: 1, eq: 'chest' },
  { id: 'boots_worn', qty: 1, eq: 'boots' },
  { id: 'cap_cloth', qty: 1, eq: 'helmet' },
  { id: 'axe_stone', qty: 1, eq: 'weapon' },
  { id: 'torch', qty: 2 },
  { id: 'berries', qty: 5 },
  { id: 'waterskin', qty: 3 },
  { id: 'founders_kit', qty: 1 }
];
