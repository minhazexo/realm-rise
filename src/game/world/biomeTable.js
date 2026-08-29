// ─────────────────────────────────────────────────────────────────────────────
// Biome identity table (spec §4): visuals, resource mixes, fauna, ambience.
//
// Each biome defines:
//   Visuals      — grass/accent colours, terrain flags (rocky, snowy, etc.)
//   Resources    — weighted spawn table for resource nodes
//   Enemies      — weighted spawn table for hostile creatures
//   Ambient      — particle effects (leaf, butterfly)
//   Temperature  — bias shifted by world temperature field
//   Danger       — multiplier on enemy difficulty scaling
//
// Biome resolution order (in worldGen.js):
//   riverlands → mountains → desert → volcanic → frozen → swamp → forest → plains
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} BiomeEntry
 * @property {string}  id           Unique biome key.
 * @property {string}  label        Display name.
 * @property {string}  grass        Primary grass colour hex.
 * @property {string}  grassDark    Darker grass variant hex (vignette / blotches).
 * @property {string}  accent       Accent colour hex (foliage, highlights).
 * @property {number}  decoDensity  Decoration density multiplier (0-1).
 * @property {string}  musicMood    Music mood key for the audio system.
 * @property {Array<{type: string, weight: number}>} resources  Resource spawn table.
 * @property {Array<{key: string, w: number}>}       enemies   Enemy spawn table.
 * @property {string[]}            ambient     Particle effect keys.
 * @property {number}              tempBias    Temperature offset applied to tempAt().
 * @property {boolean} [waterEdge]     Near-water biome — draws shore transition.
 * @property {boolean} [murkyWater]    Water uses green-brown palette instead of blue.
 * @property {boolean} [rocky]         Rocky terrain — grey accent speckles.
 * @property {boolean} [sandy]         Sandy terrain — tan/gold speckles.
 * @property {boolean} [snowy]         Snow terrain — white speckles + snow drifts.
 * @property {boolean} [ashen]         Volcanic ashen — orange/grey speckles.
 * @property {boolean} [emberSpecks]   Glowing ember particles on ground.
 * @property {boolean} [heatWave]      Heat shimmer visual effect.
 * @property {boolean} [coldWave]      Frost / cold visual effect.
 * @property {number}  [dangerMult]    Enemy difficulty multiplier (default 1).
 */

/** @type {Record<string, BiomeEntry>} */
export const BIOMES = {
  // ── Temperate biomes ────────────────────────────────────────────────────

  /** Sunlit Plains — the default biome; gentle terrain, balanced resources. */
  plains: {
    id: 'plains', label: 'Sunlit Plains',
    grass: '#7fa653', grassDark: '#6e9448', accent: '#a8bf68',
    decoDensity: 0.16, musicMood: 'day',
    resources: [
      { type: 'berry', weight: 5 },
      { type: 'herb', weight: 3 },
      { type: 'tree_oak', weight: 3 },
      { type: 'rock_small', weight: 4 },
      { type: 'reed', weight: 2 },
    ],
    enemies: [
      { key: 'boar', w: 6 },
      { key: 'bandit_scout', w: 4 },
      { key: 'wolf', w: 4 },
    ],
    ambient: ['butterfly'],
    tempBias: 0,
  },

  /** The Deepwood — dense forest with abundant wood, mushrooms, and wolves. */
  forest: {
    id: 'forest', label: 'The Deepwood',
    grass: '#5d8f46', grassDark: '#527d3d', accent: '#71a052',
    decoDensity: 0.3, musicMood: 'explore',
    resources: [
      { type: 'tree_oak', weight: 10 },
      { type: 'tree_pine', weight: 5 },
      { type: 'berry', weight: 4 },
      { type: 'mushroom', weight: 4 },
      { type: 'herb', weight: 3 },
      { type: 'rock_small', weight: 2 },
      { type: 'fiber', weight: 4 },
    ],
    enemies: [
      { key: 'wolf', w: 8 },
      { key: 'boar', w: 4 },
      { key: 'goblin', w: 3 },
      { key: 'bandit_scout', w: 3 },
    ],
    ambient: ['leaf', 'butterfly'],
    tempBias: 0,
  },

  // ── Water-adjacent biomes ─────────────────────────────────────────────

  /** Riverlands — shoreline biome with reeds, clay, and murky water. */
  riverlands: {
    id: 'riverlands', label: 'Riverlands',
    grass: '#6ea857', grassDark: '#619b4c', accent: '#86bd63',
    waterEdge: true, decoDensity: 0.2,
    resources: [
      { type: 'reed', weight: 8 },
      { type: 'tree_pine', weight: 3 },
      { type: 'berry', weight: 3 },
      { type: 'clay_node', weight: 4 },
      { type: 'rock_small', weight: 2 },
    ],
    enemies: [
      { key: 'boar', w: 5 },
      { key: 'swamp_beast', w: 3 },
      { key: 'bandit_archer', w: 3 },
    ],
    ambient: ['butterfly'],
    tempBias: -0.05,
  },

  /** Murkfen Swamp — wet, dark, herbal-rich, dangerous beasts. */
  swamp: {
    id: 'swamp', label: 'Murkfen Swamp',
    grass: '#557a48', grassDark: '#49683e', accent: '#6b9256',
    murkyWater: true, decoDensity: 0.22,
    resources: [
      { type: 'herb', weight: 8 },
      { type: 'mushroom', weight: 6 },
      { type: 'dead_tree', weight: 5 },
      { type: 'reed', weight: 6 },
      { type: 'clay_node', weight: 3 },
    ],
    enemies: [
      { key: 'swamp_beast', w: 9 },
      { key: 'goblin', w: 5 },
    ],
    dangerMult: 1.25,
    ambient: [],
    tempBias: 0,
  },

  // ── Extreme biomes ────────────────────────────────────────────────────

  /** Grayfang Mountains — high elevation, ore-rich, dangerous wildlife. */
  mountains: {
    id: 'mountains', label: 'Grayfang Mountains',
    grass: '#8c8f95', grassDark: '#7d8085', accent: '#9ba0a8',
    rocky: true, decoDensity: 0.18,
    resources: [
      { type: 'rock_small', weight: 9 },
      { type: 'ore_stone', weight: 8 },
      { type: 'ore_iron', weight: 7 },
      { type: 'ore_coal', weight: 5 },
      { type: 'ore_silver', weight: 3 },
      { type: 'tree_pine', weight: 2 },
    ],
    enemies: [
      { key: 'bear', w: 6 },
      { key: 'dire_wolf', w: 5 },
      { key: 'goblin', w: 4 },
    ],
    dangerMult: 1.35,
    ambient: [],
    tempBias: -0.3,
  },

  /** Ashen Dunes — hot, dry, cactus and flint; bandit territory. */
  desert: {
    id: 'desert', label: 'Ashen Dunes',
    grass: '#d5b26a', grassDark: '#c7a25c', accent: '#e0c07a',
    sandy: true, decoDensity: 0.08,
    resources: [
      { type: 'cactus', weight: 7 },
      { type: 'rock_small', weight: 6 },
      { type: 'ore_flint', weight: 5 },
      { type: 'clay_node', weight: 2 },
    ],
    enemies: [
      { key: 'bandit_scout', w: 7 },
      { key: 'bandit_brute', w: 4 },
    ],
    heatWave: true, dangerMult: 1.2,
    ambient: [],
    tempBias: 0.55,
  },

  /** Frozen North — ice shards, moonstone, dire wolves. Coldest biome. */
  frozen: {
    id: 'frozen', label: 'Frozen North',
    grass: '#dfe7ee', grassDark: '#cfdbe4', accent: '#eef4f9',
    snowy: true, decoDensity: 0.14,
    resources: [
      { type: 'ice_shard', weight: 7 },
      { type: 'tree_pine', weight: 5 },
      { type: 'ore_silver', weight: 3 },
      { type: 'moonstone_node', weight: 3 },
    ],
    enemies: [
      { key: 'dire_wolf', w: 8 },
      { key: 'bear', w: 5 },
    ],
    coldWave: true, dangerMult: 1.45,
    ambient: [],
    tempBias: -0.75,
  },

  /** Emberwaste — volcanic ash, coal, iron, crystal; most dangerous biome. */
  volcanic: {
    id: 'volcanic', label: 'Emberwaste',
    grass: '#5c4a42', grassDark: '#503f38', accent: '#7a5346',
    ashen: true, emberSpecks: true, decoDensity: 0.1,
    resources: [
      { type: 'ore_coal', weight: 9 },
      { type: 'ore_iron', weight: 5 },
      { type: 'crystal_node', weight: 5 },
      { type: 'rock_small', weight: 4 },
    ],
    enemies: [
      { key: 'bandit_brute', w: 6 },
      { key: 'skeleton', w: 6 },
      { key: 'dire_wolf', w: 5 },
    ],
    dangerMult: 1.6,
    ambient: [],
    tempBias: 0.7,
  },
};
