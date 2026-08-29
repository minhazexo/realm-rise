// ─────────────────────────────────────────────────────────────────────────────
// Chunk ground painter: one canvas per 512 px chunk, procedurally painted
// from noise fields; LRU-cached.  Also exposes collision sampling for builders.
//
// Pipeline per chunk:
//   1. Radial vignette gradient (base grass colour)
//   2. Moisture blotches (organic blobs from moisture field)
//   3. Fine-grain texture speckles (hundreds of tiny dots for ground feel)
//   4. Biome-specific accents (embers, snow drifts, etc.)
//   5. Water bodies carved by elevation field (shore + deep water)
//
// The painter uses a hash-based PRNG (`rand()`) — NOT Math.random() —
// so chunk canvases are fully deterministic given the world seed.
// ─────────────────────────────────────────────────────────────────────────────
import { WORLD_CONFIG } from '../core/Constants.js';
import { elevationAt, moistureAt, isWaterAt, biomeAt, RIVER_LEVEL } from './worldGen.js';
import { BIOMES } from './biomeTable.js';

// ── Constants ───────────────────────────────────────────────────────────────

/** Chunk side length in pixels. */
export const CHUNK_PX = () => WORLD_CONFIG.chunkSize;

/** Moisture blotch grid step size (px). */
const BLOTCH_STEP = 48;
/** Moisture threshold for accent-colour blotches. */
const BLOTCH_ACCENT_MIN = 0.58;
/** Moisture threshold for dark-colour blotches. */
const BLOTCH_DARK_MAX = 0.36;

/** Number of texture speckles scaled by biome decoDensity. */
const SPECKLE_BASE = 40;
const SPECKLE_SCALE = 200;

/** LRU cache cap — maximum chunk canvases kept in memory. */
const LRU_MAX = 140;

/** Shoreline depth threshold for sandy fringe. */
const SHORE_FRINGE = 0.075;
/** Deep water depth threshold (below RIVER_LEVEL - 0.055). */
const DEEP_WATER = 0.055;
/** Shore edge for sandy fringe detection. */
const SHORE_EDGE = 0.02;

// ── LRU cache ───────────────────────────────────────────────────────────────

/** @type {Map<string, HTMLCanvasElement>} Cache key = "cx,cy". */
const cache = new Map();

// ── Colour utilities ────────────────────────────────────────────────────────

/**
 * Scale a hex colour by a brightness factor.
 *
 * @param {string} hex  Six-digit hex colour (e.g. `"#4a7c3a"`).
 * @param {number} f    Multiplier: >1 = brighter, <1 = darker.
 * @returns {string} Adjusted hex colour.
 */
function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + ((cl(n >> 16) << 16) | (cl((n >> 8) & 255) << 8) | cl(n & 255))
    .toString(16).padStart(6, '0');
}

/**
 * Parse a hex colour into [r, g, b] components.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Linearly interpolate between two hex colours.
 *
 * @param {string} c1  Start colour.
 * @param {string} c2  End colour.
 * @param {number} t   Interpolation factor in [0, 1].
 * @returns {string} CSS `rgb()` colour string.
 */
function lerpColor(c1, c2, t) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// ── Hash-based PRNG ─────────────────────────────────────────────────────────

/**
 * Stable pseudo-random in [0, 1) from integer-ish coordinates.
 *
 * This is a pure hash function — NOT sequential — so chunks can be
 * painted in any order with identical results.
 *
 * @param {number} a  Coordinate component.
 * @param {number} b  Coordinate component.
 * @returns {number} Deterministic value in [0, 1).
 */
function rand(a, b) {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}

// ── Canvas helpers ──────────────────────────────────────────────────────────

/**
 * Begin a circular arc path (used for rounded blobs).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  Centre X.
 * @param {number} y  Centre Y.
 * @param {number} r  Radius.
 */
function roundBlob(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

// ── Main chunk painter ──────────────────────────────────────────────────────

/**
 * Paint (or fetch cached) ground canvas for chunk coordinates.
 *
 * The canvas is generated once per chunk and cached in an LRU map.
 * Eviction happens when the cache exceeds {@link LRU_MAX} entries.
 *
 * @param {number} cx  Chunk X coordinate.
 * @param {number} cy  Chunk Y coordinate.
 * @returns {HTMLCanvasElement} The painted ground canvas.
 */
export function getChunkCanvas(cx, cy) {
  const key = `${cx},${cy}`;
  let c = cache.get(key);
  if (c) return c;

  const size = CHUNK_PX();
  c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const originX = cx * size;
  const originY = cy * size;
  const biome = BIOMES[biomeAt(originX + size / 2, originY + size / 2)] || BIOMES.plains;

  // ── 1. Base gradient: subtle radial vignette for depth ───────────────
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.1,
    size / 2, size / 2, size * 0.7,
  );
  grad.addColorStop(0, biome.grass);
  grad.addColorStop(1, biome.grassDark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // ── 2. Moisture blotches (soft organic shapes) ───────────────────────
  for (let y = 0; y < size; y += BLOTCH_STEP) {
    for (let x = 0; x < size; x += BLOTCH_STEP) {
      const m = moistureAt(originX + x, originY + y);
      const rx = rand(originX + x, originY + y);
      const ry = rand(originX + x + 77, originY + y + 33);
      if (m > BLOTCH_ACCENT_MIN) {
        ctx.globalAlpha = 0.25 + (m - BLOTCH_ACCENT_MIN) * 1.2;
        ctx.fillStyle = biome.accent;
        roundBlob(ctx, x + rx * 28, y + ry * 28, 22 + m * 20);
        ctx.fill();
      } else if (m < BLOTCH_DARK_MAX) {
        ctx.globalAlpha = 0.2 + (BLOTCH_DARK_MAX - m) * 1.5;
        ctx.fillStyle = biome.grassDark;
        roundBlob(ctx, x + rx * 30, y + ry * 30, 18 + (1 - m) * 18);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // ── 3. Fine-grain texture speckles + grass blades ──────────────────
  const speckleCount = Math.floor(SPECKLE_SCALE * biome.decoDensity + SPECKLE_BASE);
  for (let i = 0; i < speckleCount; i++) {
    const px = rand(originX + i * 13.7, originY + i * 7.3) * size;
    const py = rand(originY + i * 17.9, originX + i * 3.1) * size;
    const e = elevationAt(originX + px, originY + py);
    if (isWaterAt(originX + px, originY + py)) continue;
    if (e < RIVER_LEVEL - SHORE_EDGE) continue;

    const s = 1 + rand(px, py) * 2.5;
    ctx.globalAlpha = 0.15 + rand(px + 1, py + 1) * 0.3;

    if (biome.snowy) {
      ctx.fillStyle = rand(px + 2, py + 2) > 0.5 ? '#f4f8fb' : '#e8eef5';
    } else if (biome.sandy) {
      ctx.fillStyle = rand(px + 3, py + 3) > 0.5 ? biome.accent : shadeHex(biome.accent, 12);
    } else if (biome.rocky) {
      ctx.fillStyle = i % 3 === 0 ? '#666b73' : biome.accent;
    } else if (biome.ashen) {
      ctx.fillStyle = i % 4 === 0 ? '#d96b3c' : shadeHex(biome.grassDark, -8);
    } else {
      ctx.fillStyle = i % 5 === 0 ? biome.grassDark : biome.accent;
    }
    ctx.fillRect(px, py, s, s * (0.6 + rand(px + 4, py + 4) * 1.2));
  }
  ctx.globalAlpha = 1;

  // ── 3b. Grass blade textures (green biomes only) ───────────────────
  if (!biome.snowy && !biome.sandy && !biome.rocky && !biome.ashen) {
    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    const bladeCount = Math.floor(40 * biome.decoDensity);
    for (let i = 0; i < bladeCount; i++) {
      const bx = rand(originX + i * 19.3, originY + i * 11.7) * size;
      const by = rand(originY + i * 23.1, originX + i * 5.9) * size;
      const e2 = elevationAt(originX + bx, originY + by);
      if (isWaterAt(originX + bx, originY + by) || e2 < RIVER_LEVEL - SHORE_EDGE) continue;
      const bladeH = 3 + rand(bx, by) * 4;
      const lean = (rand(bx + 2, by + 2) - 0.5) * 3;
      ctx.globalAlpha = 0.2 + rand(bx + 3, by + 3) * 0.2;
      ctx.strokeStyle = rand(bx + 4, by + 4) > 0.5 ? shadeHex(biome.accent, 1.15) : shadeHex(biome.grassDark, 0.95);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + lean * 0.5, by - bladeH * 0.5, bx + lean, by - bladeH);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ── 3c. Pebble scatter (all biomes) ────────────────────────────────
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 15; i++) {
    const px2 = rand(originX + i * 37.1, originY + i * 29.3) * size;
    const py2 = rand(originY + i * 41.7, originX + i * 13.9) * size;
    const e3 = elevationAt(originX + px2, originY + py2);
    if (isWaterAt(originX + px2, originY + py2) || e3 < RIVER_LEVEL - SHORE_EDGE) continue;
    const pr = 1.2 + rand(px2 + 5, py2 + 5) * 1.8;
    ctx.fillStyle = biome.rocky ? '#6a6e76' : biome.sandy ? '#c4a880' : '#8a8878';
    ctx.beginPath();
    ctx.arc(px2, py2, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── 4. Biome-specific ground accents ─────────────────────────────────
  if (biome.emberSpecks) {
    ctx.fillStyle = '#d96b3c';
    for (let i = 0; i < 30; i++) {
      ctx.globalAlpha = 0.4 + rand(i, 0) * 0.5;
      ctx.fillRect(
        rand(originX + i * 31, originY) * size,
        rand(originY + i * 43, originX) * size,
        2, 2,
      );
    }
    ctx.globalAlpha = 1;
  }
  if (biome.snowy) {
    ctx.fillStyle = 'rgba(240,245,250,0.3)';
    for (let i = 0; i < 12; i++) {
      const sx = rand(originX + i * 19, originY + i * 7) * size;
      const sy = rand(originY + i * 23, originX + i * 11) * size;
      roundBlob(ctx, sx, sy, 14 + rand(i, 5) * 20);
      ctx.fill();
    }
  }

  // ── 5. Water bodies (rivers / lakes carved by elevation field) ───────
  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x += 8) {
      const wx = originX + x;
      const wy = originY + y;
      const e = elevationAt(wx, wy);
      const waterThreshold = RIVER_LEVEL - DEEP_WATER;

      if (e < waterThreshold) {
        const shoreDist = waterThreshold - e;
        const isShore = e > RIVER_LEVEL - SHORE_FRINGE;

        if (isShore) {
          // Shoreline: sandy / muddy fringe
          ctx.fillStyle = biome.murkyWater
            ? 'rgba(140,125,85,0.7)'
            : 'rgba(205,191,132,0.7)';
          roundBlob(ctx, x + 4, y + 4, 8);
          ctx.fill();
        } else {
          // Deep water
          const depth = Math.min(1, shoreDist / 0.15);
          ctx.fillStyle = biome.murkyWater
            ? lerpColor('#5a7a5e', '#2a3d2e', depth)
            : lerpColor('#5590b0', '#2a4d6e', depth);
          roundBlob(ctx, x + 4, y + 4, 7);
          ctx.fill();

          // Water ripple highlights (non-murky only)
          if (!biome.murkyWater && rand(wx, wy) > 0.82 && depth > 0.2) {
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 0.8;
            // ripple arc
            ctx.beginPath();
            ctx.arc(x + 4, y + 4, 3 + rand(wx + 1, wy) * 2, Math.PI * 1.1, Math.PI * 1.5);
            ctx.stroke();
            // secondary smaller ripple
            if (rand(wx + 2, wy + 2) > 0.5) {
              ctx.globalAlpha = 0.12;
              ctx.beginPath();
              ctx.arc(x + 4, y + 4, 5 + rand(wx + 3, wy) * 2, Math.PI * 0.8, Math.PI * 1.2);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }
  }

  // ── Cache & LRU eviction ─────────────────────────────────────────────
  cache.set(key, c);
  if (cache.size > LRU_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  return c;
}

// ── Cache management ────────────────────────────────────────────────────────

/**
 * Evict cached canvases that are far from the player.
 * Called periodically to free memory.
 *
 * @param {number} pcx    Player chunk X.
 * @param {number} pcy    Player chunk Y.
 * @param {number} radius Keep chunks within this radius (chunks).
 */
export function evictFarChunks(pcx, pcy, radius) {
  for (const key of [...cache.keys()]) {
    const [x, y] = key.split(',').map(Number);
    if (Math.abs(x - pcx) > radius + 1 || Math.abs(y - pcy) > radius + 1) {
      cache.delete(key);
    }
  }
}
