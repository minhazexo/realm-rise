// ─────────────────────────────────────────────────────────────────────────────
// Interactable node registry: which prop texture, tool, yields each node uses.
//
// Every gatherable / interactable world object (trees, rocks, bushes, …) is
// keyed by a node type string.  The node definition controls:
//   - Visuals: texture key, optional tint, empty-state texture
//   - Gameplay: required tool, minimum tool tier, yield range, XP per hit
//   - Collision: solid hitbox dimensions
//   - Profession: which skill gains XP from gathering
//
// Node types are spawned by the chunk painter / world spawner using weighted
// rolls from each biome's resource table (see biomeTable.js → rollNodeType).
// ─────────────────────────────────────────────────────────────────────────────
import { BIOMES } from './biomeTable.js';

/**
 * @typedef {Object} NodeTypeDef
 * @property {string}       tex         Texture key registered by the asset builder.
 * @property {string|null}  emptyTex    Texture key for depleted state (e.g. berry bush).
 * @property {string|null}  tool        Required tool category: 'axe' | 'pick' | null (hand).
 * @property {string}       yRes        Yield resource item ID.
 * @property {[number, number]} yieldBase  [min, max] base yield per gather.
 * @property {[number, number]} solid     Hitbox [width, height] for collision.
 * @property {string}       prof        Profession that gains XP.
 * @property {number}       xpPerHit    XP awarded per gathering tick.
 * @property {number}       [minToolTier=0]  Minimum tool tier required (0 = any).
 * @property {number}       [tint]      Hex tint applied to the texture (e.g. 0xdfe3ea).
 * @property {number}       [hurtOnTouch]  Damage dealt when touched without protection.
 * @property {string}       [hardMinProf]  Minimum profession level for hardwood, etc.
 */

// ── Node type registry ──────────────────────────────────────────────────────

/** @type {Record<string, NodeTypeDef>} */
export const NODE_TYPES = {
  // ── Trees ────────────────────────────────────────────────────────────────

  tree_oak: {
    tex: 'tree_oak', tool: 'axe', yRes: 'wood',
    yieldBase: [3, 5], solid: [10, 8],
    prof: 'woodcutting', xpPerHit: 3,
  },
  tree_pine: {
    tex: 'tree_pine', tool: 'axe', yRes: 'hardwood',
    hardMinProf: 3, yieldBase: [2, 4], solid: [10, 8],
    prof: 'woodcutting', xpPerHit: 4,
  },
  dead_tree: {
    tex: 'dead_tree', tool: 'axe', yRes: 'wood',
    yieldBase: [2, 3], solid: [10, 6],
    prof: 'woodcutting', xpPerHit: 2,
  },

  // ── Cactus ───────────────────────────────────────────────────────────────

  cactus: {
    tex: 'cactus', tool: null, yRes: 'fiber',
    yieldBase: [2, 4], hurtOnTouch: 4, solid: [8, 6],
    prof: 'survival', xpPerHit: 2,
  },

  // ── Stone / ore nodes ────────────────────────────────────────────────────

  rock_small: {
    tex: 'rock_small', tool: 'pick', yRes: 'stone',
    yieldBase: [2, 4], solid: [13, 9],
    prof: 'mining', xpPerHit: 2,
  },
  ore_stone: {
    tex: 'rock_small', tool: 'pick', yRes: 'stone',
    yieldBase: [4, 6], solid: [13, 9],
    prof: 'mining', xpPerHit: 3, tint: 0xdfe3ea,
  },
  ore_flint: {
    tex: 'rock_small', tool: 'pick', yRes: 'flint',
    yieldBase: [2, 4], solid: [13, 9],
    prof: 'mining', xpPerHit: 3, tint: 0xcfd6e0,
  },
  ore_iron: {
    tex: 'rock_iron', tool: 'pick', yRes: 'iron_ore',
    yieldBase: [2, 4], minToolTier: 1, solid: [14, 10],
    prof: 'mining', xpPerHit: 5,
  },
  ore_coal: {
    tex: 'rock_coal', tool: 'pick', yRes: 'coal',
    yieldBase: [2, 4], minToolTier: 1, solid: [14, 10],
    prof: 'mining', xpPerHit: 4,
  },
  ore_silver: {
    tex: 'rock_silver', tool: 'pick', yRes: 'silver',
    yieldBase: [1, 2], minToolTier: 2, solid: [14, 10],
    prof: 'mining', xpPerHit: 8,
  },
  gold_vein: {
    tex: 'rock_gold', tool: 'pick', yRes: 'gold_nugget',
    yieldBase: [1, 2], minToolTier: 2, solid: [14, 10],
    prof: 'mining', xpPerHit: 9,
  },
  crystal_node: {
    tex: 'crystal_node', tool: 'pick', yRes: 'crystal',
    yieldBase: [1, 2], minToolTier: 2, solid: [12, 9],
    prof: 'mining', xpPerHit: 9,
  },
  moonstone_node: {
    tex: 'moonstone_node', tool: 'pick', yRes: 'moonstone',
    yieldBase: [1, 1], minToolTier: 3, solid: [12, 9],
    prof: 'mining', xpPerHit: 14,
  },
  ice_shard: {
    tex: 'rock_silver', tint: 0xbfe0ff, tool: 'pick', yRes: 'crystal',
    yieldBase: [1, 2], minToolTier: 1, solid: [12, 9],
    prof: 'survival', xpPerHit: 5,
  },

  // ── Flora / foraging ─────────────────────────────────────────────────────

  berry: {
    tex: 'berry_bush', emptyTex: 'berry_bush_empty', tool: null,
    yRes: 'berries', yieldBase: [2, 4],
    prof: 'survival', xpPerHit: 2,
  },
  mushroom: {
    tex: 'mushroom_patch', tool: null, yRes: 'mushrooms',
    yieldBase: [1, 3],
    prof: 'survival', xpPerHit: 2,
  },
  herb: {
    tex: 'herb_plant', tool: null, yRes: 'herbs',
    yieldBase: [1, 3],
    prof: 'survival', xpPerHit: 2,
  },
  fiber: {
    tex: 'reed_tuft', tool: null, yRes: 'fiber',
    yieldBase: [2, 4],
    prof: 'survival', xpPerHit: 1,
  },
  reed: {
    tex: 'reed_tuft', tool: null, yRes: 'fiber',
    yieldBase: [2, 3],
    prof: 'survival', xpPerHit: 1,
  },

  // ── Clay ─────────────────────────────────────────────────────────────────

  clay_node: {
    tex: 'rock_small', tint: 0xc98d64, tool: null, yRes: 'clay',
    yieldBase: [2, 4], solid: [12, 8],
    prof: 'mining', xpPerHit: 2,
  },
};

// ── Lookup helpers ──────────────────────────────────────────────────────────

/**
 * Get the node definition for a given type key.
 *
 * @param {string} type  Node type key (e.g. `'tree_oak'`).
 * @returns {NodeTypeDef|null} Definition object, or null if unknown.
 */
export const getNodeDef = (type) => NODE_TYPES[type] || null;

// ── Weighted random rolls ───────────────────────────────────────────────────

/**
 * Weighted node-type roll for a biome's resource table.
 *
 * Given a random value in [0, 1) and a biome ID, returns the node type
 * that "won" the weighted draw.
 *
 * @param {string} biomeId  Biome key (e.g. `'plains'`).
 * @param {number} rnd01    Random value in [0, 1).
 * @returns {string|null} Node type key, or null if the biome has no resources.
 */
export function rollNodeType(biomeId, rnd01) {
  const table = BIOMES[biomeId]?.resources;
  if (!table || !table.length) return null;

  // Sum all weights
  let total = 0;
  for (const r of table) total += r.weight;

  // Walk the cumulative distribution
  let v = rnd01 * total;
  for (const r of table) {
    v -= r.weight;
    if (v <= 0) return r.type;
  }

  // Floating-point edge case: return last entry
  return table[table.length - 1].type;
}

/**
 * Weighted enemy-key roll for a biome.
 *
 * @param {string} biomeId  Biome key (e.g. `'forest'`).
 * @param {number} rnd01    Random value in [0, 1).
 * @returns {string|null} Enemy key, or null if the biome has no enemies.
 */
export function rollEnemyKey(biomeId, rnd01) {
  const table = BIOMES[biomeId]?.enemies;
  if (!table || !table.length) return null;

  let total = 0;
  for (const e of table) total += e.w;

  let v = rnd01 * total;
  for (const e of table) {
    v -= e.w;
    if (v <= 0) return e.key;
  }

  return table[table.length - 1].key;
}
