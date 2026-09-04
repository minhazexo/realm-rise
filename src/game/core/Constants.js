// ─────────────────────────────────────────────────────────────────────────────
// Central tunables. All balance values live here (spec §79 / §80).
// ─────────────────────────────────────────────────────────────────────────────

export const VERSION = '1.0.0';

export const PLAYER_CONFIG = {
  baseMaxHp: 90,
  hpPerLevel: 4,
  baseMaxStamina: 100,
  moveSpeed: 168,
  sprintMult: 1.52,
  accel: 1250,
  friction: 1400,
  staminaRegenPerSec: 11,
  staminaRegenDelaySec: 0.8,
  walkAnimFps: 8,
  // Combat
  lightAttackStamina: 9,
  heavyAttackStamina: 20,
  attackArcDeg: 104,
  attackRange: 52,
  knockbackForce: 210,
  iFramesOnDodgeSec: 0.42,
  dodgeSpeed: 430,
  dodgeStamina: 21,
  blockDamageReduction: 0.62,
  blockStaminaPerHit: 12,
  // Survival drains per second (scaled by difficulty + environment)
  hungerDrain: 0.015,
  thirstDrain: 0.019,
  starveHpData: 0.6,
  regenWhenFedAbove: 62, // hp/s regeneration only above this food level
  regenPerSec: 1.4,
  critBaseChance: 0.04
};

export const STATS_CONFIG = {
  strength: { key: 'strength', label: 'Might', desc: '+ melee damage, carry power', perPoint: 1 },
  defense: { key: 'defense', label: 'Vitality', desc: '+ max health, toughness', perPoint: 1 },
  agility: { key: 'agility', label: 'Agility', desc: '+ speed, critical chance, attack recovery', perPoint: 1 },
  intellect: { key: 'intellect', label: 'Intellect', desc: '+ ranged damage, experience gain', perPoint: 1 },
  willpower: { key: 'willpower', label: 'Charisma', desc: '+ leadership, better trade, recruits', perPoint: 1 }
};

export const PROFESSIONS = ['woodcutting', 'mining', 'survival', 'combat', 'crafting'];

export const XP_CONFIG = {
  kill: 14,
  boss: 220,
  discoverPoi: 65,
  questStep: 40,
  craftItem: 6,
  gatherHit: 2
};

/** XP required to advance FROM the given level. Curve tuned so early levels fly, late ones grind gently. */
export const xpForLevel = (level) => Math.round(58 + Math.pow(level, 1.62) * 17);
export const MAX_PLAYER_LEVEL = 50;

export const WORLD_CONFIG = {
  tileSize: 32,
  chunkTiles: 16, // 512 px chunks
  get chunkSize() {
    return this.tileSize * this.chunkTiles;
  },
  activeChunkRadius: 3,
  worldHalfExtent: 16384, // ± half world in px; beyond that = deep void mountains
  spawn: { x: 0, y: 260 }
};

export const DAYNIGHT_CONFIG = {
  cycleSeconds: 520, // full day
  startAt: 0.32, // morning
  enemyNightBuff: 1.35, // night damage multiplier for hostile creatures
  nightDetectionMult: 0.75
};

export const WEATHER_CONFIG = {
  changeEveryMin: 150,
  changeEveryMax: 340
};

export const DIFFICULTY = Object.freeze({
  story: { label: 'Story', enemyDmg: 0.65, enemySpd: 0.92, aggro: 0.85, loot: 1.3, drain: 0.65, threatScale: 0.8, desc: 'Relaxed survival, forgiving foes.' },
  normal: { label: 'Normal', enemyDmg: 1, enemySpd: 1, aggro: 1, loot: 1, drain: 1, threatScale: 1, desc: 'The intended experience.' },
  hard: { label: 'Hard', enemyDmg: 1.35, enemySpd: 1.06, aggro: 1.15, loot: 0.88, drain: 1.3, threatScale: 1.22, desc: 'A dangerous realm for veterans.' },
  legendary: { label: 'Legendary', enemyDmg: 1.7, enemySpd: 1.12, aggro: 1.3, loot: 0.75, drain: 1.55, threatScale: 1.45, desc: 'Brutal. Death is expensive.' }
});

export const GATHER_CONFIG = {
  ticksPerNode: 3, // hits before node breaks
  tickTime: 0.55,
  tickXp: 2, // XP per finished gather (Phase E: single source of truth)
  yieldBonusPerProfessionLevel: 0.07,
  toolTierSpeeds: [1, 1.25, 1.5, 1.8], // none/st iron/steel handled per tool def
  regrowTimeMin: 130,
  regrowTimeVar: 90
};

export const SETTLEMENT_CONFIG = {
  claimRadius: 1100, // radius around town hall considered home territory
  stageNames: ['Wanderer’s Camp', 'Homestead', 'Village', 'Town', 'City', 'Kingdom', 'Empire'],
  // Requirements to REACH next stage index (all must pass).
  stages: [
    null, // stage 0 camp start after founding
    { buildings: { townhall: 1 }, citizens: 2, desc: 'Raise a Town Hall and shelter two souls.' },
    { buildings: { hut: 4, farm: 1, storage: 1 }, citizens: 5, desc: 'Four huts, a farm and a storehouse for five people.' },
    { buildings: { townhall: 2, market: 1, watchtower: 1, hut: 6 }, citizens: 9, happiness: 55, desc: 'A thriving market town guarded by a watchtower.' },
    { buildings: { townhall: 3, barracks: 1, blacksmith: 1, temple: 1 }, citizens: 14, defense: 60, desc: 'Barracks, forge and faith. A true city rises.' },
    { territory: 5, militaryPower: 160, citizens: 20, happiness: 60, desc: 'Control five territories and command a real army.' },
    { territory: 9, militaryPower: 320, chapterCompleted: 7, desc: 'Unite the realm beneath your banner.' }
  ],
  productionTickSec: 4
};

export const BUILD_RADIUS_FROM_HALL = [420, 720, 1080, 1400, 1700, 2000, 2300];

export const MILITARY_CONFIG = {
  types: {
    militia: { power: 3, wage: 1, cost: { gold: 40 } },
    swordsman: { power: 7, wage: 2, cost: { gold: 90, iron_ingot: 2 }, reqBuilding: 'barracks' },
    archer: { power: 6, wage: 2, cost: { gold: 80, wood: 6, feathers: 3 }, reqBuilding: 'archery_range' },
    cavalry: { power: 13, wage: 4, cost: { gold: 200, steel_ingot: 2 }, reqBuilding: 'stable' },
    knight: { power: 22, wage: 7, cost: { gold: 450, steel_ingot: 4, royal_rep: 1 }, reqBuilding: 'fortress' }
  },
  moraleFromHappiness: (h) => 0.7 + h / 166
};

// Phase E balance: sellMult 0.38 → 0.45. The old spread (~2.6:1 against the
// player before biome/faction mods) made merchant selling feel punishing
// next to bandit gold drops (6–45) and market taxes; 0.45 keeps trading
// profitable without out-earning combat loot or daily tariffs.
export const TRADE_SPREAD = { buyMult: 1, sellMult: 0.45 };

export const AUTOSAVE_INTERVAL_SEC = 100;

export const INVENTORY_BASE_SLOTS = 48;
export const SLOTS_PER_STORAGE = 10;
