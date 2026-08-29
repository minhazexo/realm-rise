// Default persistent-state factory. Everything that survives save/load starts here.
import { VERSION, MAX_PLAYER_LEVEL, INVENTORY_BASE_SLOTS, DIFFICULTY, AUTOSAVE_INTERVAL_SEC } from './Constants.js';

export function createStateDefaults(seed) {
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
      difficulty: 'normal',
      volumes: { master: 0.8, music: 0.55, sfx: 0.85 },
      toggles: { musicOn: true, sfxOn: true, screenShake: true, reducedMotion: false },
      uiScale: 1,
      textSize: 1,
      particles: 'high',
      shadows: true,
      autosave: true,
      autosaveSec: AUTOSAVE_INTERVAL_SEC,
      movementScheme: 'wasd'
    }
  };
}

export const STARTER_KIT = () => [
  { id: 'traveler_garb', qty: 1, eq: 'chest' },
  { id: 'boots_worn', qty: 1, eq: 'boots' },
  { id: 'cap_cloth', qty: 1, eq: 'helmet' },
  { id: 'axe_stone', qty: 1, eq: 'weapon' },
  { id: 'torch', qty: 2 },
  { id: 'berries', qty: 5 },
  { id: 'waterskin', qty: 3 },
  { id: 'founders_kit', qty: 1 }
];
