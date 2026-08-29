// Buildings part A: survival, residential, resource and production structures.
// produce rates = units per worker per minute at 100% happiness.

export const BUILDINGS_A = {
  campfire: {
    key: 'campfire', label: 'Campfire', cat: 'survival', footprint: [1, 1],
    cost: { wood: 5, flint: 2 }, buildSec: 4, maxTier: 1,
    station: 'campfire', warmth: 120, lightRadius: 190,
    effects: { cookUnlock: true },
    desc: 'Warmth, light and cooked food. Nights get cold.'
  },
  tent: {
    key: 'tent', label: 'Travel Tent', cat: 'survival', footprint: [1, 1],
    cost: { fiber: 8, wood: 6 }, buildSec: 5, maxTier: 1,
    effects: { housing: 1, sleepHere: true },
    desc: 'One bedroll under canvas. Sleep until dawn when no foes are near.'
  },
  hut: {
    key: 'hut', label: 'Hut', cat: 'residential', footprint: [2, 2],
    cost: { wood: 14, fiber: 6 }, buildSec: 7, maxTier: 2,
    tierCosts: [null, { clay: 30, stone: 25 }],
    effects: { housing: 2 },
    desc: 'Simple shelter. Two citizens call it home.'
  },
  house: {
    key: 'house', label: 'Cottage House', cat: 'residential', footprint: [2, 2],
    cost: { wood: 45, clay: 30, stone: 35 }, requiresStage: 2, buildSec: 10, maxTier: 1,
    effects: { housing: 4, happiness: 2 },
    desc: 'A proper home that keeps families content.'
  },
  storage_chest: {
    key: 'storage', label: 'Storehouse Chest', cat: 'resource', footprint: [1, 1],
    cost: { wood: 10, fiber: 4 }, buildSec: 4, maxTier: 1,
    effects: { storageSlots: 10 },
    desc: '+10 inventory slots anywhere within your realm borders.'
  },
  farm: {
    key: 'farm', label: 'Farm Plot', cat: 'resource', footprint: [2, 2],
    cost: { wood: 12, fiber: 10 }, requiresStage: 1, buildSec: 9, maxTier: 2,
    tierCosts: [null, { hardwood: 20, herbs: 25 }],
    jobs: 'farmer',
    produce: { food: 2.4 }, tierProduceBonus: { food: 1.6 },
    desc: 'Grain and greens. Citizens without farms eat stores dry fast.'
  },
  woodcutter: {
    key: 'woodcutter', label: "Woodcutter's Lodge", cat: 'resource', footprint: [2, 2],
    cost: { wood: 18, stone: 8 }, requiresStage: 1, buildSec: 9, maxTier: 2,
    tierCosts: [null, { hardwood: 15, iron_ingot: 6 }],
    jobs: 'woodcutter',
    produce: { wood: 2.2 }, tierProduceBonus: { wood: 1.5 },
    desc: 'Lumber flows to the stockpile even while you explore.'
  },
  mine: {
    key: 'mine', label: 'Mine Shaft', cat: 'resource', footprint: [2, 2],
    cost: { wood: 20, stone: 15 }, requiresStage: 1, buildSec: 11, maxTier: 2,
    tierCosts: [null, { iron_ingot: 16, coal: 20 }],
    jobs: 'miner',
    produce: { stone: 1.8, iron_ore: 0.9, coal: 0.7 },
    yieldMultNearMountain: 1.75,
    desc: 'Digs stone and ore. Sited near mountains it strikes rich veins.'
  },
  forge: {
    key: 'blacksmith', label: 'Blacksmith Forge', cat: 'production', footprint: [2, 2],
    cost: { stone: 40, wood: 25, iron_ore: 15 }, requiresStage: 2, buildSec: 13, maxTier: 2,
    tierCosts: [null, { coal: 60, steel_ingot: 10 }],
    station: 'forge',
    effects: { smeltOre: true },
    desc: 'Smelts ore into ingots and lets you repair gear cheaply.'
  },
  tannery: {
    key: 'tannery', label: 'Tannery', cat: 'production', footprint: [2, 2],
    cost: { wood: 24, fiber: 20 }, requiresStage: 2, buildSec: 10, maxTier: 1,
    station: 'tannery',
    effects: { tanHide: true },
    desc: 'Turns raw hides into leather for crafting.'
  },
  kitchen: {
    key: 'kitchen', label: 'Village Kitchen', cat: 'production', footprint: [2, 2],
    cost: { wood: 30, stone: 20, clay: 15 }, requiresStage: 2, buildSec: 11, maxTier: 1,
    station: 'kitchen',
    effects: { cookAdvanced: true },
    desc: 'Unlocks bread, stews and morale-raising meals.'
  },
  workshop: {
    key: 'workshop', label: 'Workshop', cat: 'production', footprint: [2, 2],
    cost: { wood: 50, stone: 30, hardwood: 10 }, requiresStage: 2, buildSec: 14, maxTier: 2,
    tierCosts: [null, { steel_ingot: 25 }],
    station: 'workshop',
    effects: { advancedCrafting: true },
    buildAura: 0.2,
    desc: 'Master tools unlock master crafts. Speeds nearby construction.'
  }
};
