/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Map terrain — the ground of the one map, and nothing else.
//
// Split out of `world/mapRender.ts` (structure size budget): the sampler, the
// flat cell pass, hill shading, the coastline and the fog frontier. `mapRender`
// owns the marker/label language and composes a frame on top of this; this
// module never knows what a marker is.
//
// Every colour here comes from the same sources the world itself is painted
// from (`worldGen` elevation, `biomeTable` palettes, `chunkPainter`'s water
// ramp), which is what makes the map agree with the ground under your feet.
//
// Phaser-free and DOM-free apart from the 2D context it is handed, so node
// tests can run it against a stub context.
// ─────────────────────────────────────────────────────────────────────────────
import { biomeAt, elevationAt, RIVER_LEVEL } from './worldGen.ts';
import { BIOMES } from './biomeTable.ts';
import type { BiomeEntry } from './biomeTable.ts';

/** Must match chunkPainter DEEP_WATER. */
const DEEP_WATER = 0.055;
/** Must match the foam-edge band in chunkPainter. */
const SHORE_BAND = 0.015;

// Chunk-painter water ramp endpoints (5. Water bodies).
const WATER_BLUE_SHALLOW = '#5590b0';
const WATER_BLUE_DEEP = '#2a4d6e';
const WATER_MURKY_SHALLOW = '#5a7a5e';
const WATER_MURKY_DEEP = '#2a3d2e';
const SHORE_SAND = '#cdbf84';
const SHORE_MUD = '#8c7d55';

/** Frame chrome colours — one palette so both views look like the same map. */
const CHROME = {
  coast: 'rgba(236,226,190,0.5)',
  cliff: 'rgba(12,16,24,0.34)',
  lit: 'rgba(255,250,232,0.16)',
  frontier: 'rgba(232,201,75,0.30)'
} as const;

// ── Colour helpers ──────────────────────────────────────────────────────────

/** Shade a #rrggbb hex by ±amt (clamped per channel). */
export function shadeHex(hex: string, amt: number): string {
  const n = parseInt(String(hex).slice(1), 16);
  if (!Number.isFinite(n)) return hex;
  const c = (v: number): number => Math.max(0, Math.min(255, v + amt));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Linear blend between two #rrggbb colors (t in 0..1). */
export function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(String(a).slice(1), 16);
  const pb = parseInt(String(b).slice(1), 16);
  if (!Number.isFinite(pa) || !Number.isFinite(pb)) return a;
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * k));
  const g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * k));
  const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * k));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/**
 * Terrain color from an ALREADY-SAMPLED elevation and biome. The sampler below
 * uses this so one cell costs one `elevationAt` + one `biomeAt`; calling
 * `terrainColorAt` per cell would sample the world twice for every square.
 */
export function terrainColorFor(e: number, biome: BiomeEntry): string {
  const waterThreshold = RIVER_LEVEL - DEEP_WATER;
  if (e < waterThreshold) {
    const depth = Math.min(1, (waterThreshold - e) / 0.15);
    return biome.murkyWater
      ? lerpHex(WATER_MURKY_SHALLOW, WATER_MURKY_DEEP, depth)
      : lerpHex(WATER_BLUE_SHALLOW, WATER_BLUE_DEEP, depth);
  }
  if (e < RIVER_LEVEL + SHORE_BAND) return biome.murkyWater ? SHORE_MUD : SHORE_SAND;
  if (e > 0.62) return shadeHex(biome.grass, 14);
  if (e < 0.38) return shadeHex(biome.grass, -12);
  return biome.grass;
}

/**
 * Terrain color for a world coordinate, using the same sources as the chunk
 * painter: biome grass, the blue/murky water ramp, the shore fringe, and a
 * gentle elevation lift/sink so hills read on small maps.
 */
export function terrainColorAt(wx: number, wy: number): string {
  return terrainColorFor(elevationAt(wx, wy), (BIOMES[biomeAt(wx, wy)] || BIOMES.plains) as BiomeEntry);
}

/** True when a world coordinate belongs to an explored chunk. */
export function isExplored(
  exploredSet: Set<string> | null | undefined,
  wx: number,
  wy: number,
  chunkSize: number,
): boolean {
  if (!exploredSet) return true;
  try {
    return exploredSet.has(`${Math.floor(wx / chunkSize)},${Math.floor(wy / chunkSize)}`);
  } catch {
    return true;
  }
}

/** Display name of the biome at a world coordinate (hover readouts, legends). */
export function biomeNameAt(wx: number, wy: number): string {
  try {
    const b: BiomeEntry = (BIOMES[biomeAt(wx, wy)] || BIOMES.plains) as BiomeEntry;
    return b.label || b.id || 'Wilderness';
  } catch {
    return 'Wilderness';
  }
}

// ── Sampling + painting ─────────────────────────────────────────────────────

/** Options for {@link drawMapTerrain} and the terrain grid behind it. */
export interface DrawMapTerrainOpts {
  /** World X at the canvas center. */
  centerX: number;
  /** World Y at the canvas center. */
  centerY: number;
  /** World px from center to edge. */
  viewRadius: number;
  /** Canvas logical width. */
  w: number;
  /** Canvas logical height. */
  h: number;
  /** Cell size in canvas px. */
  cell?: number;
  /** Explored chunk keys (null = all known). */
  explored?: Set<string> | null;
  chunkSize?: number;
  /** Fog-of-war darkening for unknown cells. */
  dimAmt?: number;
  /** 0..1 water sparkle alpha (animated maps). */
  shimmer?: number;
}

/** One sampled terrain grid — everything both the flat and the relief pass need. */
export interface TerrainGrid {
  cell: number;
  cols: number;
  rows: number;
  w: number;
  h: number;
  /** Per-cell fill colour (hex). */
  colors: string[];
  /** Per-cell elevation (0..1) for hill shading. */
  elev: Float32Array;
  /** 1 = water, 2 = shore, 0 = land. */
  water: Uint8Array;
  /** 1 = explored (or no fog at all). */
  known: Uint8Array;
  /** True when any cell is water (skip the coastline pass when dry). */
  hasWater: boolean;
}

/**
 * Sample the terrain once. Costs one elevation + one biome lookup per cell, so
 * every pass below reuses this instead of re-sampling the world.
 */
export function buildTerrainGrid(opts: DrawMapTerrainOpts): TerrainGrid {
  const { centerX, centerY, viewRadius, w, h } = opts;
  const cell = Math.max(2, Math.round(opts.cell || 15));
  const chunkSize = opts.chunkSize || 512;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const colors: string[] = new Array(cols * rows);
  const elev = new Float32Array(cols * rows);
  const water = new Uint8Array(cols * rows);
  const known = new Uint8Array(cols * rows);
  const waterThreshold = RIVER_LEVEL - DEEP_WATER;
  let hasWater = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = centerX + (c / cols - 0.5) * viewRadius * 2;
      const wy = centerY + (r / rows - 0.5) * viewRadius * 2;
      const i = r * cols + c;
      let e = 0.5;
      let col = '#333844';
      try {
        e = elevationAt(wx, wy);
        col = terrainColorFor(e, (BIOMES[biomeAt(wx, wy)] || BIOMES.plains) as BiomeEntry);
      } catch { /* keep the fallback */ }
      elev[i] = e;
      if (e < waterThreshold) { water[i] = 1; hasWater = true; }
      else if (e < RIVER_LEVEL + SHORE_BAND) water[i] = 2;
      let ok = 1;
      try {
        ok = isExplored(opts.explored, wx, wy, chunkSize) ? 1 : 0;
      } catch { ok = 1; }
      known[i] = ok;
      colors[i] = col;
    }
  }
  return { cell, cols, rows, w, h, colors, elev, water, known, hasWater };
}

/**
 * Paint the flat terrain cells. One `fillRect` per cell, hex fills only — the
 * contract `tests/smoke.mjs` pins down (a stub context with nothing but
 * `fillStyle` + `fillRect` must be able to run this).
 */
export function paintTerrainGrid(ctx: CanvasRenderingContext2D, grid: TerrainGrid, opts: DrawMapTerrainOpts): void {
  const dim = opts.dimAmt == null ? -38 : opts.dimAmt;
  const shimmer = opts.shimmer || 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const i = r * grid.cols + c;
      ctx.fillStyle = grid.known[i] || !dim ? grid.colors[i]! : shadeHex(grid.colors[i]!, dim);
      ctx.fillRect(c * grid.cell, r * grid.cell, grid.cell, grid.cell);
      if (shimmer > 0 && grid.water[i] === 1) {
        ctx.fillStyle = `rgba(180,220,255,${shimmer})`;
        ctx.fillRect(c * grid.cell + grid.cell / 2 - 1, r * grid.cell + grid.cell / 2 - 1, 2, 2);
      }
    }
  }
}

/**
 * Relief pass: slope shading + a drawn coastline. Both are derived from the
 * grid that has already been sampled (no extra world sampling), which is what
 * makes the map readable — a flat field of squares reads as a spreadsheet,
 * shaded hills and a stroked shoreline read as a map.
 */
export function paintTerrainRelief(ctx: CanvasRenderingContext2D, grid: TerrainGrid, lit = true): void {
  const { cols, rows, cell, elev, water, colors, known } = grid;
  // 1. Slope shading, light from the north-west (same direction as the world's
  //    hillshade in chunkPainter, so both maps agree on where the sun is).
  if (lit) {
    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        const i = r * cols + c;
        const nw = elev[i - cols - 1]!, se = elev[i]!;
        const slope = se - nw;
        if (Math.abs(slope) < 0.004) continue;
        const a = Math.min(0.2, Math.abs(slope) * 2.2);
        ctx.fillStyle = slope > 0 ? CHROME.cliff : CHROME.lit;
        ctx.globalAlpha = a;
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
    ctx.globalAlpha = 1;
  }
  // 2. Coastline: sand fringe stroked on the land side of every shore cell.
  if (!grid.hasWater) return;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = CHROME.coast;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (water[i] !== 2) continue;
      const x = c * cell, y = r * cell;
      const up = r > 0 ? water[i - cols] : 1;
      const down = r < rows - 1 ? water[i + cols] : 1;
      const left = c > 0 ? water[i - 1] : 1;
      const right = c < cols - 1 ? water[i + 1] : 1;
      if (up === 1) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (down === 1) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
      if (left === 1) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      if (right === 1) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // 3. Water: a whisper of depth so lakes do not read as flat holes.
  ctx.globalAlpha = 0.12;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (water[i] !== 1 || !known[i]) continue;
      const deep = elev[i]! < RIVER_LEVEL - DEEP_WATER * 2;
      if (!deep) continue;
      ctx.fillStyle = colors[i]!;
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  }
  ctx.globalAlpha = 1;
}

/** Fog frontier: a warm line where explored ground meets the unknown. */
export function paintFogFrontier(ctx: CanvasRenderingContext2D, grid: TerrainGrid): void {
  const { cols, rows, cell, known } = grid;
  let any = false;
  ctx.strokeStyle = CHROME.frontier;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!known[i]) continue;
      const x = c * cell, y = r * cell;
      const up = r > 0 ? known[i - cols] : 1;
      const down = r < rows - 1 ? known[i + cols] : 1;
      const left = c > 0 ? known[i - 1] : 1;
      const right = c < cols - 1 ? known[i + 1] : 1;
      if (up === 0 || down === 0 || left === 0 || right === 0) any = true;
      if (up === 0) { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (down === 0) { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
      if (left === 0) { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      if (right === 0) { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
    }
  }
  if (any) ctx.stroke();
}

/**
 * Colored terrain for a view — kept for callers that only want the ground
 * (and for `tests/smoke.mjs`, which pins the one-fill-per-cell contract).
 */
export function drawMapTerrain(ctx: CanvasRenderingContext2D, opts: DrawMapTerrainOpts): void {
  paintTerrainGrid(ctx, buildTerrainGrid(opts), opts);
}
