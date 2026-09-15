/// <reference lib="dom" />
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
import { WORLD_CONFIG } from '../core/Constants.ts';
import { elevationAt, moistureAt, isWaterAt, biomeAt, RIVER_LEVEL } from './worldGen.ts';
import { BIOMES } from './biomeTable.ts';
import type { BiomeEntry } from './biomeTable.ts';

// ── Constants ───────────────────────────────────────────────────────────────

/** Chunk side length in pixels. */
export const CHUNK_PX = (): number => WORLD_CONFIG.chunkSize;

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

// ── Atmospheric fog ─────────────────────────────────────────────────────────
// World-space distance (in chunks) at which the chunk starts fading into
// the biome's "fog colour". This gives a sense of depth — distant terrain
// melts into the horizon haze instead of tiling forever.
const FOG_START_CHUNKS = 5;
const FOG_END_CHUNKS   = 9;

// ── LRU cache ───────────────────────────────────────────────────────────────

/** Cache key = "cx,cy". */
const cache = new Map<string, HTMLCanvasElement>();

// ── Colour utilities ────────────────────────────────────────────────────────

/**
 * Scale a hex colour by a brightness factor.
 *
 * @param hex  Six-digit hex colour (e.g. `"#4a7c3a"`).
 * @param f    Multiplier: >1 = brighter, <1 = darker.
 * @returns Adjusted hex colour.
 */
function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v: number): number => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + ((cl(n >> 16) << 16) | (cl((n >> 8) & 255) << 8) | cl(n & 255))
    .toString(16).padStart(6, '0');
}

/**
 * Parse a hex colour into [r, g, b] components.
 */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Linearly interpolate between two hex colours.
 *
 * @param c1  Start colour.
 * @param c2  End colour.
 * @param t   Interpolation factor in [0, 1].
 * @returns CSS `rgb()` colour string.
 */
function lerpColor(c1: string, c2: string, t: number): string {
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
 * @param a  Coordinate component.
 * @param b  Coordinate component.
 * @returns Deterministic value in [0, 1).
 */
function rand(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}

// ── Canvas helpers ──────────────────────────────────────────────────────────

/**
 * Begin a circular arc path (used for rounded blobs).
 */
function roundBlob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
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
 * @param cx  Chunk X coordinate.
 * @param cy  Chunk Y coordinate.
 * @returns The painted ground canvas.
 */
export function getChunkCanvas(cx: number, cy: number): HTMLCanvasElement {
  const key = `${cx},${cy}`;
  let c: HTMLCanvasElement | undefined = cache.get(key);
  if (c) return c;

  const size: number = CHUNK_PX();
  c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const originX = cx * size;
  const originY = cy * size;
  const biome: BiomeEntry = (BIOMES[biomeAt(originX + size / 2, originY + size / 2)] || BIOMES.plains) as BiomeEntry;

  // ── 1. Base: flat fill + large-scale macro variation ───────────────
  // NOTE: the old radial vignette created a visible checkerboard when tiled.
  // A flat base with soft large blobs breaks tiling and reads better at 1080p.
  ctx.fillStyle = biome.grass;
  ctx.fillRect(0, 0, size, size);
  // Macro variation: large soft blobs in grassDark/accent for broad tonal sweep.
  for (let i = 0; i < 14; i++) {
    const mx = rand(originX + i * 101.3, originY + i * 57.7) * size;
    const my = rand(originY + i * 131.7, originX + i * 43.1) * size;
    const mr = 55 + rand(mx, my) * 80;
    // Alternate dark/accent/slightly-lighter for more tonal variety
    const tint = i % 3 === 0 ? biome.grassDark : i % 3 === 1 ? biome.accent : shadeHex(biome.grass, i % 2 ? 0.92 : 1.06);
    ctx.globalAlpha = 0.06 + rand(mx + 9, my + 3) * 0.07;
    ctx.fillStyle = tint;
    roundBlob(ctx, mx, my, mr);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── 1b. Biome edge blending (Phase B) ──────────────────────────────
  // Sample 8 points on a ring around the chunk; where a neighbor differs,
  // wash soft blobs of the neighbor's grass toward that edge. Cheap (8
  // biomeAt calls) and kills hard 512px biome seams without per-pixel cost.
  {
    const centerId = biomeAt(originX + size / 2, originY + size / 2);
    const ring: Array<readonly [number, number, number, number]> = [
      [0.5, -0.1, 0.5, 0.22], [0.5, 1.1, 0.5, 0.78],
      [-0.1, 0.5, 0.22, 0.5], [1.1, 0.5, 0.78, 0.5],
      [-0.1, -0.1, 0.2, 0.2], [1.1, -0.1, 0.8, 0.2],
      [-0.1, 1.1, 0.2, 0.8], [1.1, 1.1, 0.8, 0.8],
    ];
    ring.forEach(([sx, sy, ex, ey], ri) => {
      const nbId = biomeAt(originX + sx * size, originY + sy * size);
      const nb: BiomeEntry | undefined = BIOMES[nbId];
      if (nbId === centerId || !nb) return;
      for (let k = 0; k < 3; k++) {
        const jx = (rand(originX + ri * 17 + k * 31, originY + ri * 13) - 0.5) * 130;
        const jy = (rand(originX + ri * 19, originY + ri * 23 + k * 37) - 0.5) * 130;
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = k % 2 === 0 ? nb.grass : nb.grassDark;
        roundBlob(ctx, ex * size + jx, ey * size + jy, 55 + rand(jx, jy) * 45);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

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

  // ── 3. Fine-grain texture speckles + grass blades + dirt + slope ──
  // Doubled density vs before: old counts read as noise at 1080p.
  const speckleCount = Math.floor(SPECKLE_SCALE * biome.decoDensity * 2 + SPECKLE_BASE * 2);
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
      ctx.fillStyle = rand(px + 3, py + 3) > 0.5 ? biome.accent : shadeHex(biome.accent, 0.9);
    } else if (biome.rocky) {
      ctx.fillStyle = i % 3 === 0 ? '#666b73' : biome.accent;
    } else if (biome.ashen) {
      ctx.fillStyle = i % 4 === 0 ? '#d96b3c' : shadeHex(biome.grassDark, 0.92);
    } else {
      ctx.fillStyle = i % 5 === 0 ? biome.grassDark : biome.accent;
    }
    ctx.fillRect(px, py, s, s * (0.6 + rand(px + 4, py + 4) * 1.2));
  }
  ctx.globalAlpha = 1;

  // ── 3b. Grass tufts (green biomes only) ────────────────────────────
  // Tufts of 4 fanning strokes (added shadow base) with a dark base + light tip
  // read as volume while staying quiet enough not to drown out trees/characters.
  if (!biome.snowy && !biome.sandy && !biome.rocky && !biome.ashen) {
    ctx.lineCap = 'round';
    const tuftCount = Math.floor(70 * biome.decoDensity);
    for (let i = 0; i < tuftCount; i++) {
      const bx = rand(originX + i * 19.3, originY + i * 11.7) * size;
      const by = rand(originY + i * 23.1, originX + i * 5.9) * size;
      const e2 = elevationAt(originX + bx, originY + by);
      if (isWaterAt(originX + bx, originY + by) || e2 < RIVER_LEVEL - SHORE_EDGE) continue;
      const lean = (rand(bx + 2, by + 2) - 0.5) * 6;
      const tall = 3.5 + rand(bx, by) * 6;
      const strokes = [
        // shadow base (widest, darkest)
        { dx: 0, h: tall * 0.45, col: shadeHex(biome.grassDark, 0.78), w: 1.4, a: 0.22 },
        // outer left
        { dx: -1.8, h: tall * 0.72, col: shadeHex(biome.grassDark, 0.93), w: 1.1, a: 0.38 },
        // center main
        { dx: 0, h: tall, col: shadeHex(biome.accent, 1.12), w: 0.9, a: 0.33 },
        // outer right (highlight)
        { dx: 1.8, h: tall * 0.82, col: shadeHex(biome.accent, 1.25), w: 0.8, a: 0.26 },
      ];
      for (const st of strokes) {
        ctx.globalAlpha = st.a;
        ctx.strokeStyle = st.col;
        ctx.lineWidth = st.w;
        ctx.beginPath();
        ctx.moveTo(bx + st.dx, by);
        ctx.quadraticCurveTo(bx + st.dx + lean * 0.4, by - st.h * 0.55, bx + st.dx + lean, by - st.h);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // ── 3b2. Wildflower dots (plains / forest / riverlands only, sparse) ──
    // Tiny warm pops plus occasional pale blue to add color variation.
    if (!biome.murkyWater) {
      const petals: string[] = ['#f2e7c8', '#e8a8b8', '#f5d76e', '#b8d4f0', '#f7c6a0'];
      for (let i = 0; i < 26; i++) {
        const fx = rand(originX + i * 71.7, originY + i * 37.3) * size;
        const fy = rand(originY + i * 53.1, originX + i * 91.7) * size;
        if (isWaterAt(originX + fx, originY + fy)) continue;
        const sz = 1.3 + rand(fx + 3, fy + 3) * 1.2;
        ctx.globalAlpha = 0.55 + rand(fx + 1, fy + 1) * 0.3;
        ctx.fillStyle = petals[i % petals.length] ?? '#f2e7c8';
        ctx.fillRect(fx, fy, sz, sz);
        // green stem dot below each flower
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = biome.grassDark;
        ctx.fillRect(fx - 0.5, fy + sz, 2.5, 1.1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── 3c. Pebble scatter (all biomes) ────────────────────────────────
  for (let i = 0; i < 50; i++) {
    const px2 = rand(originX + i * 37.1, originY + i * 29.3) * size;
    const py2 = rand(originY + i * 41.7, originX + i * 13.9) * size;
    const e3 = elevationAt(originX + px2, originY + py2);
    if (isWaterAt(originX + px2, originY + py2) || e3 < RIVER_LEVEL - SHORE_EDGE) continue;
    const pr = 1.2 + rand(px2 + 5, py2 + 5) * 2.8;
    const pColor = biome.rocky ? '#6a6e76' : biome.sandy ? '#c4a880' : '#8a8878';
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.arc(px2, py2, pr, 0, Math.PI * 2);
    ctx.fill();
    // Specular highlight dot on upper-left of pebble
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = shadeHex(pColor, 1.45);
    ctx.beginPath();
    ctx.arc(px2 - pr * 0.3, py2 - pr * 0.3, pr * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── 3d. Dirt patches + slope shading ─────────────────────────────
  // Dirt patches give close-zoom readability; slope shade fakes AO on hills.
  for (let i = 0; i < 18; i++) {
    const dxp = rand(originX + i * 53.7, originY + i * 91.2) * size;
    const dyp = rand(originY + i * 67.3, originX + i * 29.8) * size;
    if (isWaterAt(originX + dxp, originY + dyp)) continue;
    ctx.globalAlpha = 0.08 + rand(dxp + 7, dyp + 7) * 0.09;
    ctx.fillStyle = biome.sandy ? shadeHex(biome.grassDark, 1.05) : '#7a6a4f';
    roundBlob(ctx, dxp, dyp, 6 + rand(dxp, dyp) * 22);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Slope: sample elevation gradient, darken downhill-facing texels subtly.
  for (let i = 0; i < 40; i++) {
    const sxp = rand(originX + i * 23.9, originY + i * 47.3) * size;
    const syp = rand(originY + i * 31.1, originX + i * 17.7) * size;
    const e0 = elevationAt(originX + sxp, originY + syp);
    const ex = elevationAt(originX + sxp + 6, originY + syp);
    const slope = Math.abs(ex - e0) * 40;
    if (slope > 0.35 && !isWaterAt(originX + sxp, originY + syp)) {
      ctx.globalAlpha = Math.min(0.16, slope * 0.12);
      ctx.fillStyle = '#000000';
      ctx.fillRect(sxp, syp, 3, 3);
    }
  }
  ctx.globalAlpha = 1;


  // ── 4. Biome-specific ground accents ─────────────────────────────────
  if (biome.sandy) {
    // Sand grain dithering: paired light/dark grains give a dry sparkle.
    for (let i = 0; i < 60; i++) {
      const gx = rand(originX + i * 13.1, originY + i * 77.7) * size;
      const gy = rand(originY + i * 29.9, originX + i * 41.3) * size;
      if (isWaterAt(originX + gx, originY + gy)) continue;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = i % 2 === 0 ? '#efe0b8' : shadeHex(biome.grassDark, 1.02);
      ctx.fillRect(gx, gy, 2, 1.4);
      ctx.fillRect(gx + 2, gy + 1, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
    // Sand dune ripple arcs — subtle curved lines across the chunk for desert feel
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 8; i++) {
      const rx = rand(originX + i * 117.3, originY + i * 53.9) * size;
      const ry = rand(originY + i * 79.1, originX + i * 43.7) * size;
      ctx.globalAlpha = 0.12 + rand(rx, ry) * 0.08;
      ctx.strokeStyle = i % 2 === 0 ? '#efe0b8' : shadeHex(biome.grassDark, 0.85);
      ctx.beginPath();
      ctx.arc(rx, ry, 25 + rand(rx + 3, ry + 3) * 40, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (biome.ashen) {
    // Ash cracks: dark jagged seams in the cooled crust.
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      let cx0 = rand(originX + i * 97.3, originY + i * 61.1) * size;
      let cy0 = rand(originY + i * 83.7, originX + i * 17.9) * size;
      if (isWaterAt(originX + cx0, originY + cy0)) continue;
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = '#241a16';
      ctx.beginPath();
      ctx.moveTo(cx0, cy0);
      for (let k = 0; k < 5; k++) {
        cx0 += (rand(cx0 + k * 3.1, cy0) - 0.5) * 24;
        cy0 += (rand(cx0, cy0 + k * 7.7) - 0.3) * 18;
        ctx.lineTo(cx0, cy0);
      }
      ctx.stroke();
      // faint ember glow along every third crack
      if (i % 3 === 0) {
        ctx.globalAlpha = 0.32;
        ctx.strokeStyle = '#e07840';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    ctx.globalAlpha = 1;
  }
  if (biome.emberSpecks) {
    // Draw embers as tiny glowing ovals instead of plain squares
    for (let i = 0; i < 40; i++) {
      const ex2 = rand(originX + i * 31, originY) * size;
      const ey2 = rand(originY + i * 43, originX) * size;
      ctx.globalAlpha = 0.35 + rand(i, 0) * 0.55;
      ctx.fillStyle = i % 3 === 0 ? '#f09040' : '#d96b3c';
      ctx.beginPath();
      ctx.ellipse(ex2, ey2, 1.5, 1.0, rand(i, 3) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (biome.rocky) {
    // Slate shards: elongated angled rectangles for mountain/rocky terrain
    for (let i = 0; i < 22; i++) {
      const slx = rand(originX + i * 67.3, originY + i * 43.9) * size;
      const sly = rand(originY + i * 51.7, originX + i * 29.3) * size;
      if (isWaterAt(originX + slx, originY + sly)) continue;
      const angle = rand(slx, sly) * Math.PI;
      const sl = 3 + rand(slx + 1, sly + 1) * 8;
      ctx.globalAlpha = 0.1 + rand(slx + 2, sly + 2) * 0.1;
      ctx.fillStyle = rand(slx + 5, sly + 5) > 0.5 ? '#606470' : '#747880';
      ctx.save();
      ctx.translate(slx, sly);
      ctx.rotate(angle);
      ctx.fillRect(-sl / 2, -0.8, sl, 1.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  if (biome.snowy) {
    // Snow drifts — large soft blobs
    ctx.fillStyle = 'rgba(240,245,250,0.3)';
    for (let i = 0; i < 14; i++) {
      const sx = rand(originX + i * 19, originY + i * 7) * size;
      const sy = rand(originY + i * 23, originX + i * 11) * size;
      roundBlob(ctx, sx, sy, 12 + rand(i, 5) * 24);
      ctx.fill();
    }
    // Snow crystal 4-point star glints on top of drifts
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 18; i++) {
      const gx2 = rand(originX + i * 37.3, originY + i * 61.7) * size;
      const gy2 = rand(originY + i * 71.1, originX + i * 29.9) * size;
      ctx.globalAlpha = 0.22 + rand(gx2, gy2) * 0.28;
      const gs = 1.5 + rand(gx2 + 1, gy2 + 1) * 2.5;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(gx2 - gs, gy2); ctx.lineTo(gx2 + gs, gy2);
      ctx.moveTo(gx2, gy2 - gs); ctx.lineTo(gx2, gy2 + gs);
      ctx.moveTo(gx2 - gs * 0.65, gy2 - gs * 0.65); ctx.lineTo(gx2 + gs * 0.65, gy2 + gs * 0.65);
      ctx.moveTo(gx2 + gs * 0.65, gy2 - gs * 0.65); ctx.lineTo(gx2 - gs * 0.65, gy2 + gs * 0.65);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
      } else if (e >= waterThreshold && e < RIVER_LEVEL + 0.015) {
        // ── 5b. Foam edge (Phase B): bright contour line where land meets
        // water. Only where an actual water cell is adjacent (avoids speckle).
        const adjWater =
          elevationAt(wx + 8, wy) < waterThreshold ||
          elevationAt(wx - 8, wy) < waterThreshold ||
          elevationAt(wx, wy + 8) < waterThreshold ||
          elevationAt(wx, wy - 8) < waterThreshold;
        if (adjWater) {
          ctx.globalAlpha = biome.murkyWater ? 0.22 : 0.38;
          ctx.strokeStyle = biome.murkyWater ? 'rgba(200,190,140,0.9)' : 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x + 4, y + 4, 5.5, Math.PI * 0.9, Math.PI * 1.6);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // ── Cache & LRU eviction ─────────────────────────────────────────────
  cache.set(key, c);
  if (cache.size > LRU_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  return c;
}

/** Atmosphere state consumed by {@link setAtmosphereState}. */
export interface AtmosphereState {
  timeOfDay?: number;
  weather?: string;
}

/**
 * Atmospheric perspective: lerp the chunk canvas toward a biome-tinted
 * haze colour based on distance from the camera. Closer chunks are
 * unmodified; distant chunks fade smoothly into the horizon colour so the
 * world has real depth instead of tiling to infinity.
 *
 * Called from WorldScene after each chunk is drawn onto the layer.
 * Cheap: a single multiplicative compositing pass per active chunk per
 * resize event (not per frame).
 *
 * @param canvas  Chunk canvas produced by getChunkCanvas().
 * @param dx  World-space distance from camera centre to chunk centre (px).
 * @param dy  Unused — keep for symmetry with future 2D-distance fog.
 */
export function applyFogToChunk(canvas: HTMLCanvasElement, dx: number, dy: number): void {
  if (!canvas) return;
  if (foggedForBucket.has(canvas)) return;
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Skip fog overlay if the user disabled it or performance is critical.
  if (!shouldApplyFog()) return;
  const distChunks = Math.abs(dx) / size;
  const t = Math.max(0, Math.min(1,
    (distChunks - FOG_START_CHUNKS) / (FOG_END_CHUNKS - FOG_START_CHUNKS),
  ));
  if (t <= 0) return;
  const fogColor = getFogColor();
  // Multiply-blend the fog over the chunk. This preserves the chunk's
  // texture detail while tinting toward the horizon colour.
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = t * 0.45; // up to 45% fog tint at the far edge
  ctx.fillStyle = fogColor;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  foggedForBucket.add(canvas);
}

// Module-level toggle (the settings system drives this).
let _fogEnabled = true;
export function setFogEnabled(on: boolean): void { _fogEnabled = on; }
function shouldApplyFog(): boolean { return _fogEnabled; }

// Track whether the fog params changed enough to invalidate the cache.
// We re-bake fog only when timeOfDay or weather crosses a threshold.
let _fogSnapshot = '';
let _fogDirty = true;
export function isFogDirty(): boolean { return _fogDirty; }
export function clearFogDirty(): void { _fogDirty = false; }

// Time-of-day + weather tint for the horizon haze. Updated each frame
// from WorldScene via setAtmosphereState().
let _fogBaseColor = '#a9b8c8';
let _fogTimeOfDay = 0.5;
let _fogWeather = 'clear';
const _fogBiomeTints: Record<string, string> = {
  plains:   '#8aa872',
  forest:   '#6c8862',
  swamp:    '#586e54',
  mountains:'#8e929b',
  desert:   '#c2a575',
  frozen:   '#c4d0db',
  volcanic: '#7e5a4a',
};
/** Tracks canvases already fogged for the current bucket (avoids double-darken). */
const foggedForBucket = new WeakSet<HTMLCanvasElement>();
export function setAtmosphereState({ timeOfDay, weather }: AtmosphereState): void {
  if (typeof timeOfDay === 'number') _fogTimeOfDay = timeOfDay;
  if (weather) _fogWeather = weather;
  // Bucket time-of-day to 12 buckets per day — re-bake fog only at bucket change.
  const bucket = Math.floor(_fogTimeOfDay * 12) + ':' + _fogWeather;
  if (bucket !== _fogSnapshot) {
    _fogSnapshot = bucket;
    _fogDirty = true;
    // NOTE: no longer cache.clear() — that caused a full rebake hitch every
    // bucket change. New chunks pick up the new fog; existing chunks keep
    // their baked fog until naturally evicted. Full day/night ground relight
    // is Phase B (see docs/improvements/01_GRAPHICS_GROUND_VIEW.md).
  }
}
export function setFogBiomeTint(biomeId: string, color: string): void {
  if (biomeId && color) _fogBiomeTints[biomeId] = color;
}

/**
 * Compute the current fog colour based on time-of-day + weather + the
 * last-set biome tint. Called per-frame in WorldScene so the horizon
 * matches the sky.
 */
export function getFogColor(): string {
  const t = _fogTimeOfDay;
  const isNight = t > 0.78 || t < 0.24;
  const biomeBase = _fogBiomeTints[_lastFogBiome] || '#a9b8c8';
  const r0 = parseInt(biomeBase.slice(1, 3), 16);
  const g0 = parseInt(biomeBase.slice(3, 5), 16);
  const b0 = parseInt(biomeBase.slice(5, 7), 16);
  let r = r0, g = g0, b = b0;
  if (isNight) {
    r = Math.round(r0 * 0.4 + 18);
    g = Math.round(g0 * 0.4 + 22);
    b = Math.round(b0 * 0.6 + 60);
  } else if (t > 0.22 && t < 0.32) {
    r = Math.round(r0 * 0.7 + 200);
    g = Math.round(g0 * 0.7 + 130);
    b = Math.round(b0 * 0.7 + 90);
  } else if (t > 0.74 && t < 0.82) {
    r = Math.round(r0 * 0.7 + 200);
    g = Math.round(g0 * 0.7 + 100);
    b = Math.round(b0 * 0.7 + 60);
  }
  if (_fogWeather === 'storm') { r = Math.round(r * 0.6); g = Math.round(g * 0.65); b = Math.round(b * 0.75); }
  if (_fogWeather === 'fog' || _fogWeather === 'drizzle') {
    r = Math.round(r * 0.85 + 140);
    g = Math.round(g * 0.85 + 140);
    b = Math.round(b * 0.85 + 150);
  }
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
let _lastFogBiome = 'plains';
export function setLastFogBiome(id: string): void { if (id) _lastFogBiome = id; }

// ── Cache management ────────────────────────────────────────────────────────

/**
 * Evict cached canvases that are far from the player.
 * Called periodically to free memory.
 *
 * @param pcx    Player chunk X.
 * @param pcy    Player chunk Y.
 * @param radius Keep chunks within this radius (chunks).
 */
export function evictFarChunks(pcx: number, pcy: number, radius: number): void {
  for (const key of [...cache.keys()]) {
    const parts = key.split(',').map(Number);
    const x = parts[0];
    const y = parts[1];
    if (x === undefined || y === undefined) continue;
    if (Math.abs(x - pcx) > radius + 1 || Math.abs(y - pcy) > radius + 1) {
      cache.delete(key);
    }
  }
}
