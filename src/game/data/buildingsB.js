// Buildings part B: military, defense, government and special structures.

export const BUILDINGS_B = {
  townhall: {
    key: 'townhall', label: 'Town Hall', cat: 'government', footprint: [3, 3], blocks: true,
    cost: { wood: 40, stone: 20 }, unique: true,
    buildSec: 12, maxTier: 5,
    tierLabels: ['Timber Hall', 'Stone Keep', 'Fortified Manor', 'Grand Keep', 'Royal Citadel'],
    tierCosts: [
      null,
      { wood: 120, stone: 90 },
      { wood: 200, stone: 220, iron_ingot: 30 },
      { steel_ingot: 40, stone: 400, hardwood: 60, gold_nugget: 10 },
      { moonstone: 6, steel_ingot: 120, royal_artifact: 2, hardwood: 150 }
    ],
    effects: {},
    tierDefense: [8, 18, 34, 55, 80],
    desc: 'The heart of your realm. Upgrading it elevates the whole settlement.'
  },
  watchtower: {
    key: 'watchtower', label: 'Watchtower', cat: 'military', footprint: [1, 1],
    cost: { wood: 30, stone: 20 }, requiresStage: 1, buildSec: 12, maxTier: 2,
    tierCosts: [null, { steel_ingot: 20, stone: 60 }],
    effects: {}, defenseByTier: [10, 26], towerAttack: { range: 420, dmg: [9, 22], cdSec: 1.6 },
    desc: 'Sentries scan the horizon and shoot raiders on sight.'
  },
  barracks: {
    key: 'barracks', label: 'Barracks', cat: 'military', footprint: [3, 2],
    cost: { wood: 70, stone: 45, iron_ingot: 10 }, requiresStage: 2, buildSec: 16, maxTier: 1,
    effects: { defense: 18, recruit: ['militia', 'swordsman'] },
    desc: 'Houses professional troops; unlocks recruitment of soldiers.'
  },
  archery_range: {
    key: 'archery_range', label: 'Archery Range', cat: 'military', footprint: [3, 2],
    cost: { wood: 60, feathers: 10, iron_ingot: 8 }, requiresStage: 2, buildSec: 13, maxTier: 1,
    effects: { defense: 8, recruit: ['archer'] },
    desc: 'Trains citizen archers who defend the walls.'
  },
  stable: {
    key: 'stable', label: 'Stable', cat: 'military', footprint: [3, 2],
    cost: { wood: 80, stone: 40, fiber: 40 }, requiresStage: 3, buildSec: 15, maxTier: 1,
    effects: { defense: 10, recruit: ['cavalry'], travelSpeedBonus: 0.08 },
    desc: 'Swift horses for couriers and lances alike.'
  },
  fortress: {
    key: 'fortress', label: 'Stone Fortress', cat: 'military', footprint: [3, 3], blocks: true,
    cost: { stone: 300, steel_ingot: 50, hardwood: 40 }, requiresStage: 4, buildSec: 26, maxTier: 1,
    effects: { defense: 45, recruit: ['knight'] },
    desc: 'An unbreakable anchor of your border defenses.'
  },
  wall: {
    key: 'wall', label: 'Palisade Wall', cat: 'defense', footprint: [1, 1],
    cost: { wood: 8, stone: 6 }, requiresStage: 2, buildSec: 3, maxTier: 2, blocks: true,
    tierCosts: [null, { stone: 30 }], hpByTier: [160, 420],
    effects: { defense: 2 },
    desc: 'Raiders must break through this segment. Repair after sieges.'
  },
  gate: {
    key: 'gate', label: 'Reinforced Gate', cat: 'defense', footprint: [1, 1],
    cost: { wood: 22, iron_ingot: 6 }, requiresStage: 2, buildSec: 6, maxTier: 1, blocks: true,
    hp: 300,
    effects: { defense: 4 },
    desc: 'Citizens pass freely; raiders batter it down instead.'
  },
  market: {
    key: 'market', label: 'Market Stalls', cat: 'special', footprint: [2, 2],
    cost: { wood: 40, fiber: 30, gold_nugget: 4 }, requiresStage: 2, buildSec: 12, maxTier: 2,
    tierCosts: [null, { silver: 10, hardwood: 30 }],
    taxPerDay: [6, 16], tradePriceBonus: [0.05, 0.12],
    effects: {},
    desc: 'Caravans pay tariffs here daily — honest gold for the treasury.'
  },
  temple: {
    key: 'temple', label: 'Shrine-Temple', cat: 'special', footprint: [2, 2],
    cost: { stone: 60, hardwood: 30, crystal: 3 }, requiresStage: 3, buildSec: 16, maxTier: 1,
    effects: { happiness: 8, healAura: true },
    desc: 'Faith mends bodies and spirits inside your walls.'
  },
  library: {
    key: 'library', label: 'Library', cat: 'special', footprint: [2, 2],
    cost: { wood: 70, stone: 50, ancient_relic: 1 }, requiresStage: 3, buildSec: 18, maxTier: 1,
    effects: { xpAura: 0.08 },
    desc: 'Scholars translate relics; residents learn faster.'
  }
};
