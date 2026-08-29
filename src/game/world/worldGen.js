// ─────────────────────────────────────────────────────────────────────────────
// Deterministic world generation (spec §69).
//
// Same seed ⇒ same world forever.
//
// Noise fields:
//   elevation  → mountain ridges, river valleys, plains plateaus
//   moisture   → forest density, desert dryness, swamp wetness
//   temperature→ latitude gradient + local variation (cold N, hot SE)
//
// Biome resolution:
//   elevation < RIVER_LEVEL → riverlands
//   high elevation + ridge noise → mountains
//   then temperature × moisture → desert / volcanic / frozen / swamp / forest / plains
//
// Rivers carve lakes below RIVER_LEVEL; POIs (ruins, camps, shrines) are
// placed deterministically via seeded RNG so only per-node depletion state
// needs saving — never raw layouts.
// ─────────────────────────────────────────────────────────────────────────────
import { fbm, valueNoise, mulberry32 } from '../../utils/math.js';
import { BIOMES } from './biomeTable.js';

// ── World seed ──────────────────────────────────────────────────────────────

/** @type {number} Current world seed (unsigned 32-bit). */
let WORLD_SEED = 1;

/**
 * Set the world seed and invalidate the POI cache.
 * @param {number} seed
 */
export function setWorldSeed(seed) {
  if (seed !== WORLD_SEED) {
    WORLD_SEED = seed >>> 0 || 1;
    poiCache = null;
    poiCacheSeed = null;
  }
}

/** @returns {number} Current world seed. */
const S = () => WORLD_SEED;

// ── Noise field parameters ──────────────────────────────────────────────────
// Scale values control feature size — smaller = larger features.
// Seeded offsets (e.g. ^ 0x9e37) decorrelate each field so they don't align.

/** Elevation noise frequency (px⁻¹). ~0.001 → ~870 px features. */
const ELEV_FREQ_X = 0.00115;
const ELEV_FREQ_Y = 0.00095;
const ELEV_OCTAVES = 4;

/** Moisture noise frequency. Slightly smaller scale for tighter wet/dry bands. */
const MOIST_FREQ_X = 0.0019;
const MOIST_FREQ_Y = 0.0021;
const MOIST_OCTAVES = 3;

/** Temperature noise frequency. */
const TEMP_FREQ_X = 0.0011;
const TEMP_FREQ_Y = 0.0012;

/** Mountain ridge noise frequency. Sharper features. */
const RIDGE_FREQ = 0.003;
const RIDGE_OCTAVES = 3;

/** Latitude temperature gradient — world Y extent for 1 full cycle. */
const LATITUDE_SCALE = 9000;

// ── Elevation ───────────────────────────────────────────────────────────────

/**
 * Water table level — elevation values below this become river / lake tiles.
 * @type {number}
 */
export const RIVER_LEVEL = 0.34;

/**
 * Large-scale elevation in [0, 1].
 * Water (rivers, lakes) sits below {@link RIVER_LEVEL}.
 *
 * @param {number} wx  World X in pixels.
 * @param {number} wy  World Y in pixels.
 * @returns {number} Elevation value in [0, 1).
 */
export function elevationAt(wx, wy) {
  return fbm(wx * ELEV_FREQ_X, wy * ELEV_FREQ_Y, S() ^ 0x9e37, ELEV_OCTAVES);
}

// ── Moisture ────────────────────────────────────────────────────────────────

/**
 * Moisture field in [0, 1].
 * High values → forests, swamps; low → deserts, plains.
 *
 * @param {number} wx  World X in pixels.
 * @param {number} wy  World Y in pixels.
 * @returns {number} Moisture value in [0, 1).
 */
export function moistureAt(wx, wy) {
  return fbm(wx * MOIST_FREQ_X + 500, wy * MOIST_FREQ_Y - 320, S() ^ 0x51f2, MOIST_OCTAVES);
}

// ── Temperature ─────────────────────────────────────────────────────────────

/**
 * Temperature field — cold toward the north edge (−Y), hot south-east.
 * Combines latitude gradient with local noise variation.
 *
 * @param {number} wx  World X in pixels.
 * @param {number} wy  World Y in pixels.
 * @returns {number} Approximate temperature in [-1, 1] range.
 */
export function tempAt(wx, wy) {
  const lat = Math.max(-1, Math.min(1, (-wy) / LATITUDE_SCALE));
  const local = valueNoise(wx * TEMP_FREQ_X + 90, wy * TEMP_FREQ_Y - 60, S() ^ 0x77aa);
  return lat * 0.75 + local * 0.45 - 0.2;
}

// ── Biome resolution ────────────────────────────────────────────────────────
// Priority order (highest to lowest):
//   1. Riverlands — below RIVER_LEVEL
//   2. Mountains  — high elevation + sharp ridge noise
//   3. Desert     — hot + dry
//   4. Volcanic   — hot + moderate moisture + ridge
//   5. Frozen     — cold
//   6. Swamp      — wet + mild + low elevation
//   7. Forest     — moderate-high moisture
//   8. Plains     — default fallback

/** Mountain threshold: elevation must exceed this AND ridge must be high. */
const MOUNTAIN_ELEV = 0.78;
/** Mountain ridge threshold. */
const MOUNTAIN_RIDGE = 0.55;
/** Desert: temperature + moisture thresholds. */
const DESERT_TEMP = 0.52;
const DESERT_MOIST = 0.42;
/** Volcanic: temperature + moisture + ridge thresholds. */
const VOLCANIC_TEMP = 0.62;
const VOLCANIC_RIDGE = 0.45;
/** Frozen: temperature threshold. */
const FROZEN_TEMP = -0.28;
/** Swamp: moisture + temperature + elevation thresholds. */
const SWAMP_MOIST = 0.68;
const SWAMP_TEMP = 0.05;
const SWAMP_ELEV = 0.52;
/** Forest: moisture threshold. */
const FOREST_MOIST = 0.55;

/**
 * Resolve which biome owns a world coordinate (px).
 *
 * Pure function — output depends only on (wx, wy) and the world seed.
 *
 * @param {number} wx  World X in pixels.
 * @param {number} wy  World Y in pixels.
 * @returns {string} Biome key (e.g. `'plains'`, `'forest'`, `'mountains'`).
 */
export function biomeAt(wx, wy) {
  const e = elevationAt(wx, wy);

  // 1. Water → riverlands
  if (e < RIVER_LEVEL) return 'riverlands';

  const m = moistureAt(wx, wy);
  const t = tempAt(wx, wy);

  // 2. Mountains: high sharp ridges
  const ridge = fbm(wx * RIDGE_FREQ, wy * RIDGE_FREQ, S() ^ 0x3333, RIDGE_OCTAVES);
  if (e > MOUNTAIN_ELEV && ridge > MOUNTAIN_RIDGE) return 'mountains';

  // 3. Desert: hot + dry
  if (t > DESERT_TEMP && m < DESERT_MOIST) return 'desert';

  // 4. Volcanic: hot + moderate moisture + ridge terrain
  if (t > VOLCANIC_TEMP && m >= DESERT_MOIST && ridge > VOLCANIC_RIDGE) return 'volcanic';

  // 5. Frozen: cold
  if (t < FROZEN_TEMP) return 'frozen';

  // 6. Swamp: very wet, mild, low ground
  if (m > SWAMP_MOIST && t > SWAMP_TEMP && e < SWAMP_ELEV) return 'swamp';

  // 7. Forest: wet enough
  if (m > FOREST_MOIST) return 'forest';

  // 8. Plains: default
  return 'plains';
}

// ── Water test ──────────────────────────────────────────────────────────────

/**
 * True if the coordinate is deep water (below river level minus a small margin).
 *
 * @param {number} wx  World X in pixels.
 * @param {number} wy  World Y in pixels.
 * @returns {boolean}
 */
export function isWaterAt(wx, wy) {
  return elevationAt(wx, wy) < RIVER_LEVEL - 0.06;
}

// ── Points of Interest ──────────────────────────────────────────────────────

let poiCache = null;
let poiCacheSeed = null;

// Named POI constants for clarity in placement logic.
/** Minimum radius from origin for ring-of-ruins placement. */
const RUIN_MIN_DIST = 2600;
/** Maximum additional random spread for ring-of-ruins. */
const RUIN_SPREAD = 2600;
/** Number of ruin POIs in the ring. */
const RUIN_COUNT = 6;
/** Minimum radius for bandit camp placement. */
const CAMP_MIN_DIST = 1800;
/** Maximum additional random spread for bandit camps. */
const CAMP_SPREAD = 6800;
/** Total bandit camps including the king's camp. */
const CAMP_COUNT = 18;
/** Minimum radius for shrine placement. */
const SHRINE_MIN_DIST = 1200;
/** Maximum additional random spread for shrines. */
const SHRINE_SPREAD = 7000;
/** Number of shrines. */
const SHRINE_COUNT = 8;

/**
 * Generate all points of interest deterministically from the world seed.
 *
 * Returns a cached array (invalidated on seed change) containing:
 *   - Named story anchors (fixed positions for pacing)
 *   - Ring of ruins (6, evenly spaced with jitter)
 *   - Bandit camps (17 scattered + 1 king's camp)
 *   - Shrines (8, scattered)
 *
 * @returns {Array<Object>} POI descriptors.
 */
export function allPois() {
  if (poiCache && poiCacheSeed === S()) return poiCache;

  const rng = mulberry32(S() ^ 0xa11ce);
  const spots = [];

  /** Helper: add a POI with defaults. */
  const push = (o) => spots.push({ discovered: false, looted: false, ...o });

  // ── Named story anchors (fixed distances from origin for pacing §62) ──
  push({
    id: 'wolf_den', x: -1750, y: 420,
    kind: 'den', tag: 'wolf_den', label: 'Growling Hollow',
    boss: 'alpha_wolf', danger: 2,
  });
  push({
    id: 'elara_camp', x: 520, y: -880,
    kind: 'camp_friend', label: "Hunter's Rest",
    npc: 'elara', danger: 1,
  });
  push({
    id: 'tam_crash', x: 1150, y: 720,
    kind: 'rescue', label: 'Scattered Wreckage',
    npc: 'tam', danger: 1,
  });

  // ── Ring of ruins (kind 'ruins' counts for reachCount quests) ───────
  for (let i = 0; i < RUIN_COUNT; i++) {
    const ang = (i / RUIN_COUNT) * Math.PI * 2 + rng() * 0.4;
    const dist = RUIN_MIN_DIST + rng() * RUIN_SPREAD;
    push({
      id: `ruins_${i}`,
      x: Math.round(Math.cos(ang) * dist),
      y: Math.round(Math.sin(ang) * dist),
      kind: 'ruins',
      tag: i === 0 ? 'great_ruins' : undefined,
      label: i === 0 ? 'The Great Ruins' : 'Whispering Ruins',
      boss: i === 0 ? 'ancient_guardian' : undefined,
      chestTier: i === 0 ? 'ancient_chest' : 'iron_chest',
      danger: 3 + i,
    });
  }

  // ── Bandit camps = capturable territory ──────────────────────────────
  for (let i = 0; i < CAMP_COUNT - 1; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = CAMP_MIN_DIST + rng() * CAMP_SPREAD;
    push({
      id: `bcamp_${i}`,
      x: Math.round(Math.cos(ang) * dist),
      y: Math.round(Math.sin(ang) * dist),
      kind: 'bandit_camp',
      label: 'Ragged Banner Camp',
      chestTier: i % 4 === 0 ? 'royal_chest' : 'wooden_chest',
      danger: 2 + Math.floor(dist / 2200),
      boss: i === 8 ? 'bandit_king' : undefined,
      tag: i === 8 ? 'bandit_king_camp' : undefined,
    });
  }

  // ── Shrines (lore + blessing wells) ──────────────────────────────────
  for (let i = 0; i < SHRINE_COUNT; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = SHRINE_MIN_DIST + rng() * SHRINE_SPREAD;
    push({
      id: `shrine_${i}`,
      x: Math.round(Math.cos(ang) * dist),
      y: Math.round(Math.sin(ang) * dist),
      kind: 'shrine',
      label: 'Ancient Shrine',
      danger: 1,
    });
  }

  poiCache = spots;
  poiCacheSeed = S();
  return spots;
}

/** Total number of bandit-camp POIs (including the king's camp). */
export const TERRITORY_TARGET = 18;

// ── Treasure maps ───────────────────────────────────────────────────────────

/**
 * Generate a deterministic treasure-cache coordinate near a given point.
 * Used when a `treasure_map` item is consumed.
 *
 * @param {number} nearX  Anchor world X.
 * @param {number} nearY  Anchor world Y.
 * @returns {{ x: number, y: number }} Deterministic cache position nearby.
 */
export function treasureCacheSpot(nearX, nearY) {
  const rng = mulberry32(((nearX | 0) * 31 + (nearY | 0) * 17) ^ S());
  const ang = rng() * Math.PI * 2;
  const d = 400 + rng() * 500;
  return {
    x: Math.round(nearX + Math.cos(ang) * d),
    y: Math.round(nearY + Math.sin(ang) * d),
  };
}

// ── Exploration guidance ────────────────────────────────────────────────────

/**
 * Find the nearest undiscovered POI to a given position.
 * Used for curiosity guidance (spec §36).
 *
 * @param {number} x  Player world X.
 * @param {number} y  Player world Y.
 * @param {string[]} [excludeIds=[]]  POI IDs to skip (already tracked, etc.).
 * @returns {Object|null} Nearest undiscovered POI, or null if all discovered.
 */
export function nearestUnknownPoi(x, y, excludeIds = []) {
  let best = null;
  let bestD = Infinity;
  for (const p of allPois()) {
    if (p.discovered || excludeIds.includes(p.id)) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
