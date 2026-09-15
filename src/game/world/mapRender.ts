/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Shared map renderer — the single visual language for the minimap (Phaser
// scene canvas) and the main world map (React MapPanel canvas).
//
// Before this module the minimap used its own hardcoded palette that did not
// match the chunk painter, so the two maps disagreed about what the world
// looks like. Every color here is sampled from the same sources the chunk
// painter uses (BIOMES grass + the same water ramp), so both maps stay in
// sync with the ground the player walks on.
//
// Phaser-free and DOM-light: only needs a 2D canvas context, so it runs in
// the Phaser scene, in React, and in node tests (with a stub context).
// ─────────────────────────────────────────────────────────────────────────────
import { biomeAt, elevationAt, RIVER_LEVEL } from './worldGen.ts';
import { BIOMES } from './biomeTable.ts';
import type { BiomeEntry } from './biomeTable.ts';

/** Must match chunkPainter.js DEEP_WATER. */
const DEEP_WATER = 0.055;
/** Must match the foam-edge band in chunkPainter.js. */
const SHORE_BAND = 0.015;

// Chunk-painter water ramp endpoints (5. Water bodies).
const WATER_BLUE_SHALLOW = '#5590b0';
const WATER_BLUE_DEEP = '#2a4d6e';
const WATER_MURKY_SHALLOW = '#5a7a5e';
const WATER_MURKY_DEEP = '#2a3d2e';
const SHORE_SAND = '#cdbf84';
const SHORE_MUD = '#8c7d55';

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
 * Terrain color for a world coordinate, using the same sources as the chunk
 * painter: biome grass, the blue/murky water ramp, the shore fringe, and a
 * gentle elevation lift/sink so hills read on small maps.
 */
export function terrainColorAt(wx: number, wy: number): string {
  const e = elevationAt(wx, wy);
  const biome: BiomeEntry = (BIOMES[biomeAt(wx, wy)] || BIOMES.plains) as BiomeEntry;
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

/** Options for {@link drawMapTerrain}. */
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

/**
 * Paint the terrain layer onto a 2D context. Both maps call this so they can
 * never drift apart again.
 */
export function drawMapTerrain(ctx: CanvasRenderingContext2D, opts: DrawMapTerrainOpts): void {
  const { centerX, centerY, viewRadius, w, h } = opts;
  const cell = opts.cell || 15;
  const chunkSize = opts.chunkSize || 512;
  const dimAmt = opts.dimAmt == null ? -38 : opts.dimAmt;
  const shimmer = opts.shimmer || 0;
  const explored = opts.explored || null;
  for (let my = 0; my < h; my += cell) {
    for (let mx = 0; mx < w; mx += cell) {
      const wx = centerX + (mx / w - 0.5) * viewRadius * 2;
      const wy = centerY + (my / h - 0.5) * viewRadius * 2;
      let col: string;
      try {
        col = terrainColorAt(wx, wy);
      } catch {
        col = '#333844';
      }
      if (explored && dimAmt) {
        try {
          if (!isExplored(explored, wx, wy, chunkSize)) col = shadeHex(col, dimAmt);
        } catch { /* ignore */ }
      }
      ctx.fillStyle = col;
      ctx.fillRect(mx, my, cell, cell);
      if (shimmer > 0) {
        try {
          if (elevationAt(wx, wy) < RIVER_LEVEL - DEEP_WATER) {
            ctx.fillStyle = `rgba(180,220,255,${shimmer})`;
            ctx.fillRect(mx + cell / 2 - 1, my + cell / 2 - 1, 2, 2);
          }
        } catch { /* ignore */ }
      }
    }
  }
}

/** Minimal POI shape consumed by {@link poiStyle}. */
export interface PoiStyleInput {
  boss?: unknown;
  npc?: unknown;
  kind?: string;
}

/** Shared POI shape language result. */
export interface PoiStyle {
  shape: 'boss' | 'camp' | 'dot';
  color: string;
}

/**
 * Shared POI shape language. Returns { shape, color } where shape is one of
 * 'boss' (ringed diamond) | 'camp' (triangle) | 'dot' (circle).
 */
export function poiStyle(poi: PoiStyleInput | null | undefined, owned: unknown): PoiStyle {
  if (owned) return { shape: 'dot', color: '#ffd66b' };
  if (poi?.boss) return { shape: 'boss', color: '#ff6b5a' };
  // Friendly places first: an npc or 'friend' in the kind means safe,
  // even when the kind also mentions camp (e.g. Hunter's Rest).
  if (poi?.npc || /friend|shrine/i.test(poi?.kind || '')) return { shape: 'dot', color: '#7ae0ff' };
  if (/camp|den/i.test(poi?.kind || '')) return { shape: 'camp', color: '#ff9a4a' };
  return { shape: 'dot', color: '#c9a8ff' };
}

/** Map glyph classification. */
export type NodeGlyph = 'tree' | 'rock' | 'flora' | null;

/** Classify a gather node for map glyphs: 'tree' | 'rock' | 'flora' | null. */
export function nodeGlyph(type: string | null | undefined, tex: string | null | undefined): NodeGlyph {
  const t = `${type || ''} ${tex || ''}`;
  if (/tree|pine|oak|palm|cactus/i.test(t)) return 'tree';
  if (/rock|ore|stone|crystal|coal|gold|silver|iron|flint/i.test(t)) return 'rock';
  if (/herb|berry|mushroom|reed|flower|bush|clay|fiber/i.test(t)) return 'flora';
  return null;
}
