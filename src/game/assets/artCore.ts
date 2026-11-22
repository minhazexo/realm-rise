/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Art Core — foundational canvas helpers, texture registration, and drawing
// primitives used by every asset module in this project.
//
// Exports:
//   Constants   — CH_FRAME_W/H, QUAD_W/H, DIR_ROWS, OUTLINE, O
//   Canvas      — makeCanvas, makeSheetPaint (art-scale authoring)
//   Registration— registerFrames, registerImage, single
//   Drawing     — rr, circ, ell, tri
//   Painterly   — linearGrad, radialGrad, softBlob, featherShadow, rgba
//   Color       — shade
//   Random      — seededRandom, resetRandom
// ─────────────────────────────────────────────────────────────────────────────
import type * as Phaser from 'phaser';
import { artScale, contourWidth } from '../core/VisualProfile.ts';

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

/** Off-screen canvas together with its 2-D context and authoring scale. */
export interface CanvasPair {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Texels per native pixel: 1 in the pixel style, `VISUAL_PROFILE.artScale` when painterly. */
  scale: number;
}

/**
 * Create an off-screen `<canvas>` and return it together with its 2-D context.
 * @param w  Canvas width in pixels.
 * @param h  Canvas height in pixels.
 */
export function makeCanvas(w: number, h: number): CanvasPair {
  const scale: number = artScaleFactor();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  // Draw in native coordinates: every caller paints the same numbers it always
  // did, onto a canvas with `scale`× the texels (docs/ART-DIRECTION.md §Source
  // resolution). Registration trims the frame back to the native display size.
  if (scale !== 1) ctx.scale(scale, scale);
  return { canvas, ctx, scale };
}

/**
 * Authoring scale for the current profile, as a sane integer.
 * `artScale()` is 1 in the pixel style, 2 (or more) when painterly — matching
 * the camera's ~2× zoom so one art texel lands on about one screen pixel.
 */
function artScaleFactor(): number {
  return Math.max(1, Math.round(artScale()));
}

/**
 * Make a frame **sample** a `w*scale × h*scale` region while it stays `w × h`.
 *
 * The frame's cut region is the authored (bigger) area, so its UVs and the
 * texels the GPU reads are the high-resolution ones. What every game object
 * sizes itself from is `frame.realWidth` — which Phaser derives from the trim's
 * `sourceSize` — so the trim is declared at *native* size. Net effect: props,
 * characters and terrain carry `scale`² more texels with absolutely no change
 * to sprite sizes, bodies, anchors or display sizes.
 */
export function displayAtNativeSize(
  frame: Phaser.Textures.Frame | null,
  w: number,
  h: number,
  scale: number,
): void {
  if (!frame || scale === 1) return;
  frame.setTrim(w, h, 0, 0, w, h);
}

// ── Sheet authoring (docs/ART-DIRECTION.md §Source resolution) ──────────────

/**
 * A sprite-sheet authoring surface.
 *
 * `ctx` is in **native** sheet coordinates: draw with the same numbers as
 * before. The canvas behind it is `scale`× bigger, and `registerFrames` trims
 * each frame back to its native size, so the sheet carries `scale`² more texels
 * (real detail and clean sub-pixel strokes) with no downstream change at all.
 */
export interface SheetPaint {
  /** The painted sheet — `w*scale × h*scale` texels. */
  canvas: HTMLCanvasElement;
  /** Context to draw into, in native sheet coordinates. */
  ctx: CanvasRenderingContext2D;
  /** Authoring scale actually used (1 = the pixel profile). */
  scale: number;
}

/**
 * Create an authoring surface for a sprite sheet of native size `w × h`.
 * Deterministic: the same draws always resolve to the same texels.
 */
export function makeSheetPaint(w: number, h: number): SheetPaint {
  const { canvas, ctx, scale } = makeCanvas(w, h);
  return { canvas, ctx, scale };
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
 * @param scale    Authoring scale of `canvas` (frames display at frameW × frameH).
 */
export function registerFrames(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  frameW: number,
  frameH: number,
  names: readonly string[],
  scale: number = artScaleFactor(),
): Phaser.Textures.Texture {
  let tex: Phaser.Textures.Texture | null = scene.textures.exists(key) ? scene.textures.get(key) : null;
  if (!tex || !tex.source || !tex.source[0]) {
    tex = scene.textures.addCanvas(key, canvas);
  } else {
    // REBUILD path (menus then the world build the same sheet, enemies rebuild
    // as variants appear). Two traps live here, both of which shipped once:
    //
    //   1. A canvas REMEMBERS its transform, and `makeCanvas` hands out a
    //      context already scaled by `scale`. Copying the fresh sheet through
    //      that context drew it magnified 4× into the top-left corner — every
    //      character and enemy became a giant unreadable blob (measured: a
    //      left-facing frame 98% solid paint instead of 50%). The transform is
    //      reset before the copy.
    //   2. The new sheet can be a different size than the first one (a render-
    //      style change alters `scale`). Copying a smaller sheet into the old
    //      canvas leaves stale texels, so the canvas is resized to match.
    const canvasTex = tex as Phaser.Textures.CanvasTexture;
    if (typeof canvasTex.getContext === 'function') {
      if (typeof canvasTex.setSize === 'function' && (canvasTex.width !== canvas.width || canvasTex.height !== canvas.height)) {
        canvasTex.setSize(canvas.width, canvas.height);
      }
      const ctx = canvasTex.getContext();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvasTex.width, canvasTex.height);
      ctx.drawImage(canvas, 0, 0);
      canvasTex.refresh();
    }
  }
  const texture = tex as Phaser.Textures.Texture;
  names.forEach((name, i) => {
    const cx = i % 3;
    const cy = Math.floor(i / 3);
    const x: number = cx * frameW * scale;
    const y: number = cy * frameH * scale;
    const w: number = frameW * scale;
    const h: number = frameH * scale;
    let frame: Phaser.Textures.Frame | null = texture.has(name) ? texture.get(name) : null;
    if (!frame) {
      frame = texture.add(name, 0, x, y, w, h);
    } else if (frame.cutX !== x || frame.cutY !== y || frame.cutWidth !== w || frame.cutHeight !== h) {
      // Re-cut on rebuild: stale rects from an earlier scale would sample the
      // wrong region of the sheet (or run off it).
      frame.setCutPosition(x, y);
      frame.setCutSize(w, h);
      frame.updateUVs();
    }
    displayAtNativeSize(frame, frameW, frameH, scale);
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
  // First build wins: no copy happens, so the canvas transform can never leak
  // into a texture here (unlike {@link registerFrames}, which rebuilds).
  if (scene.textures.exists(key)) return;
  const texture: Phaser.Textures.Texture | null = scene.textures.addCanvas(key, canvas);
  if (!texture) return;
  const scale: number = artScaleFactor();
  displayAtNativeSize(texture.get(), canvas.width / scale, canvas.height / scale, scale);
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
 * @param lw   Contour width (defaults to the midground plane — ART-DIRECTION §6).
 */
export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient | null,
  stroke: string | null = OUTLINE,
  lw: number = contourWidth('midground'),
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
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
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
  fill: string | CanvasGradient | null,
  stroke: string | null = OUTLINE,
  lw: number = contourWidth('midground'),
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
 * @param lw   Contour width for the stroke.
 */
export function ell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string | CanvasGradient | null,
  stroke: string | null = null,
  rot: number = 0,
  lw: number = 1.2,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
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

// ── Painterly primitives (docs/ART-DIRECTION.md) ────────────────────────────
// Vector/painterly helpers for the new art pass: smooth gradients, organic
// blobs and feathered contact shadows. All deterministic via seededRandom, so
// a rebuilt texture is byte-identical across loads (AI_RULES determinism rule).

/** Parse a `#rrggbb` colour into `[r, g, b]` (0-255). */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `rgba(...)` string from a hex colour and an alpha (0-1). */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Linear gradient between two canvas points.
 * @param stops  `[offset, colour]` pairs, e.g. `[[0, '#334422'], [1, '#88aa55']]`.
 */
export function linearGrad(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [off, col] of stops) g.addColorStop(off, col);
  return g;
}

/**
 * Radial gradient centred at `(x, y)`.
 * @param stops  `[offset, colour]` pairs.
 */
export function radialGrad(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r0: number, r1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [off, col] of stops) g.addColorStop(off, col);
  return g;
}

/** Options for {@link softBlob}. */
export interface BlobOpts {
  /** Lobe count — higher is rounder (min 5). */
  lobes?: number;
  /** Radius jitter 0-1 (0 = perfect ellipse). */
  wobble?: number;
  /** Rotation of the first lobe (radians). */
  rot?: number;
  /** Fill style (colour or gradient); `null` skips fill. */
  fill?: string | CanvasGradient | null;
  /** Contour colour; `null` skips the stroke. */
  stroke?: string | null;
  /** Contour width in px. */
  lineWidth?: number;
}

/**
 * Draw a smooth organic blob — the painterly replacement for a hard ellipse.
 * The outline is a closed quadratic curve through jittered points, so shapes
 * read as hand-painted rather than geometric.
 */
export function softBlob(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  opts: BlobOpts = {},
): void {
  const lobes: number = Math.max(5, opts.lobes ?? 9);
  const wobble: number = opts.wobble ?? 0.16;
  const rot: number = opts.rot ?? 0;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < lobes; i++) {
    const a: number = rot + (i / lobes) * Math.PI * 2;
    const j: number = 1 + (seededRandom() - 0.5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
  }
  const mid = (p: [number, number], q: [number, number]): [number, number] =>
    [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const start: [number, number] = mid(pts[lobes - 1]!, pts[0]!);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < lobes; i++) {
    const c: [number, number] = pts[i]!;
    const n: [number, number] = pts[(i + 1) % lobes]!;
    const m: [number, number] = mid(c, n);
    ctx.quadraticCurveTo(c[0], c[1], m[0], m[1]);
  }
  ctx.closePath();
  if (opts.fill) { ctx.fillStyle = opts.fill; ctx.fill(); }
  if (opts.stroke) {
    ctx.lineWidth = opts.lineWidth ?? contourWidth('midground');
    ctx.strokeStyle = opts.stroke;
    ctx.stroke();
  }
}

/**
 * Soft feathered contact shadow (radial-gradient ellipse). Grounds props and
 * characters without the hard ellipse the pixel pass used.
 */
export function featherShadow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  alpha: number = 0.22, color: string = '#000000',
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(0.5, rx), Math.max(0.5, ry));
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.62, rgba(color, alpha * 0.5));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
