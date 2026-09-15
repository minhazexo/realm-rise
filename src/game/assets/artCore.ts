/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Art Core — foundational canvas helpers, texture registration, and drawing
// primitives used by every asset module in this project.
//
// Exports:
//   Constants   — CH_FRAME_W/H, QUAD_W/H, DIR_ROWS, OUTLINE, O
//   Canvas      — makeCanvas
//   Registration— registerFrames, registerImage, single
//   Drawing     — rr, circ, ell, tri
//   Color       — shade
//   Random      — seededRandom, resetRandom
// ─────────────────────────────────────────────────────────────────────────────
import type * as Phaser from 'phaser';

// ── Character sheet dimensions ──────────────────────────────────────────────
/** Width of a single humanoid animation frame (px). */
export const CH_FRAME_W: number = 26;
/** Height of a single humanoid animation frame (px). */
export const CH_FRAME_H: number = 34;
/** Width of a single quadruped animation frame (px). */
export const QUAD_W: number = 44;
/** Height of a single quadruped animation frame (px). */
export const QUAD_H: number = 30;
/** Direction rows in sheet order: down → left → right → up. */
export const DIR_ROWS = ['down', 'left', 'right', 'up'] as const;

/** Sheet direction row. */
export type DirRow = (typeof DIR_ROWS)[number];

// ── Shared outline / stroke color ───────────────────────────────────────────
/** Dark outline used across nearly all procedural sprites. */
export const OUTLINE: string = '#241d17';
/** Alias kept for brevity in draw callbacks. */
export const O: string = OUTLINE;

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
// Replaces Math.random() in procedural art so assets are identical across
// builds and page reloads.  Seed is re-set before each asset batch via
// resetRandom().

/** Internal PRNG state. */
let _seed: number = 0xDEAD_BEEF;

/**
 * Mulberry32 — fast, deterministic 32-bit PRNG.
 * Returns a float in [0, 1).
 */
function _mulberry32(): number {
  _seed |= 0;
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Return a seeded pseudo-random float in [0, 1).
 * Use instead of Math.random() to guarantee deterministic output.
 */
export function seededRandom(): number {
  return _mulberry32();
}

/**
 * Reset the PRNG seed so the next batch of assets is reproducible.
 * @param seed — seed value.
 */
export function resetRandom(seed: number = 0xDEADBEEF): void {
  _seed = seed | 0;
}

// ── Canvas factory ──────────────────────────────────────────────────────────

/** Off-screen canvas together with its 2-D context. */
export interface CanvasPair {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/**
 * Create an off-screen `<canvas>` and return it together with its 2-D context.
 * @param w  Canvas width in pixels.
 * @param h  Canvas height in pixels.
 */
export function makeCanvas(w: number, h: number): CanvasPair {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  return { canvas, ctx };
}

// ── Texture registration ────────────────────────────────────────────────────

/**
 * Register a canvas as a **multi-named-frame** texture.
 *
 * Frames are laid out row-major with **3 columns**.  Each frame is addressed
 * by a human-readable name (e.g. `"down_0"`, `"up_2"`).
 *
 * @param scene    The scene that owns the texture manager.
 * @param key      Unique texture key.
 * @param canvas Source canvas.
 * @param frameW   Width of each sub-frame.
 * @param frameH   Height of each sub-frame.
 * @param names    Frame names in index order.
 */
export function registerFrames(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  frameW: number,
  frameH: number,
  names: readonly string[],
): Phaser.Textures.Texture {
  let tex: Phaser.Textures.Texture | null = scene.textures.exists(key) ? scene.textures.get(key) : null;
  if (!tex || !tex.source || !tex.source[0]) {
    tex = scene.textures.addCanvas(key, canvas);
  } else {
    const canvasTex = tex as Phaser.Textures.CanvasTexture;
    if (typeof canvasTex.getContext === 'function') {
      const ctx = canvasTex.getContext();
      ctx.clearRect(0, 0, canvasTex.width, canvasTex.height);
      ctx.drawImage(canvas, 0, 0);
      canvasTex.refresh();
    }
  }
  const texture = tex as Phaser.Textures.Texture;
  names.forEach((name, i) => {
    if (!texture.has(name)) {
      const cx = i % 3;
      const cy = Math.floor(i / 3);
      texture.add(name, 0, cx * frameW, cy * frameH, frameW, frameH);
    }
  });
  return texture;
}

/**
 * Register a **single-frame** image texture from a canvas.
 * No-op if the key already exists.
 *
 * @param scene  The scene that owns the texture manager.
 * @param key    Unique texture key.
 * @param canvas Source canvas.
 */
export function registerImage(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
}

// ── Drawing primitives ──────────────────────────────────────────────────────

/**
 * Draw a **rounded rectangle** (or plain rect when `r ≤ 0`).
 *
 * @param ctx
 * @param x       Left edge.
 * @param y       Top edge.
 * @param w       Width.
 * @param h       Height.
 * @param r       Corner radius (clamped to half the smallest side).
 * @param fill    Fill style — pass `null` to skip fill.
 * @param stroke Stroke style — pass `null` to skip stroke.
 */
export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | null,
  stroke: string | null = OUTLINE,
): void {
  r = Math.min(r ?? 0, w / 2, h / 2);
  ctx.beginPath();
  if (r > 0) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 1.4; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/**
 * Draw a **circle**.
 *
 * @param ctx
 * @param x  Centre X.
 * @param y  Centre Y.
 * @param r  Radius (minimum 0.5).
 * @param fill    Fill style.
 * @param stroke Stroke style.
 * @param lw Line width for the stroke.
 */
export function circ(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string | null,
  stroke: string | null = OUTLINE,
  lw: number = 1.4,
): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/**
 * Draw an **ellipse** with optional rotation.
 *
 * @param ctx
 * @param x   Centre X.
 * @param y   Centre Y.
 * @param rx  Horizontal radius (minimum 0.5).
 * @param ry  Vertical radius   (minimum 0.5).
 * @param fill    Fill style.
 * @param stroke Stroke style.
 * @param rot  Rotation in radians.
 */
export function ell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | null,
  stroke: string | null = null,
  rot: number = 0,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 1.2; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/**
 * Draw an **equilateral triangle** pointing down.
 *
 * @param ctx
 * @param x  Left corner X.
 * @param y  Top (apex) Y.
 * @param s  Side length.
 * @param fill  Fill style.
 * @param stroke Stroke style.
 */
export function tri(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  fill: string = '#000',
  stroke: string = OUTLINE,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s);
  ctx.lineTo(x + s / 2, y);
  ctx.lineTo(x + s, y + s);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// ── Color utility ───────────────────────────────────────────────────────────

/**
 * Lighten or darken a hex colour by a signed integer offset.
 *
 * @param hex  Six-digit hex colour, e.g. `"#4a7c3a"`.
 * @param amt  Positive = lighter, negative = darker (0-255 per channel).
 * @returns Adjusted hex colour.
 */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v: number): number => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + amt);
  const g = cl(((n >> 8) & 255) + amt);
  const b = cl((n & 255) + amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** Drawing callback invoked with a fresh canvas context. */
export type DrawCallback = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * Convenience helper: create + register a **single-frame** canvas texture.
 *
 * @param scene  The scene that owns the texture manager.
 * @param key    Unique texture key.
 * @param w      Canvas width.
 * @param h      Canvas height.
 * @param draw   Drawing callback invoked immediately with a fresh context.
 */
export function single(scene: Phaser.Scene, key: string, w: number, h: number, draw: DrawCallback): void {
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx, w, h);
  registerImage(scene, key, canvas);
}
