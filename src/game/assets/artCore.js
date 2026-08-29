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

// ── Character sheet dimensions ──────────────────────────────────────────────
/** @type {number} Width of a single humanoid animation frame (px). */
export const CH_FRAME_W = 26;
/** @type {number} Height of a single humanoid animation frame (px). */
export const CH_FRAME_H = 34;
/** @type {number} Width of a single quadruped animation frame (px). */
export const QUAD_W = 44;
/** @type {number} Height of a single quadruped animation frame (px). */
export const QUAD_H = 30;
/** @type {string[]} Direction rows in sheet order: down → left → right → up. */
export const DIR_ROWS = ['down', 'left', 'right', 'up'];

// ── Shared outline / stroke color ───────────────────────────────────────────
/** Dark outline used across nearly all procedural sprites. */
export const OUTLINE = '#241d17';
/** Alias kept for brevity in draw callbacks. */
export const O = OUTLINE;

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
// Replaces Math.random() in procedural art so assets are identical across
// builds and page reloads.  Seed is re-set before each asset batch via
// resetRandom().

/** @type {number} Internal PRNG state. */
let _seed = 0xDEAD_BEEF;

/**
 * Mulberry32 — fast, deterministic 32-bit PRNG.
 * Returns a float in [0, 1).
 * @returns {number}
 */
function _mulberry32() {
  _seed |= 0;
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Return a seeded pseudo-random float in [0, 1).
 * Use instead of Math.random() to guarantee deterministic output.
 * @returns {number}
 */
export function seededRandom() {
  return _mulberry32();
}

/**
 * Reset the PRNG seed so the next batch of assets is reproducible.
 * @param {number} [seed=0xDEADBEEF] — seed value.
 */
export function resetRandom(seed = 0xDEADBEEF) {
  _seed = seed | 0;
}

// ── Canvas factory ──────────────────────────────────────────────────────────

/**
 * Create an off-screen `<canvas>` and return it together with its 2-D context.
 * @param {number} w  Canvas width in pixels.
 * @param {number} h  Canvas height in pixels.
 * @returns {{ canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D }}
 */
export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

// ── Texture registration ────────────────────────────────────────────────────

/**
 * Register a canvas as a **multi-named-frame** texture.
 *
 * Frames are laid out row-major with **3 columns**.  Each frame is addressed
 * by a human-readable name (e.g. `"down_0"`, `"up_2"`).
 *
 * @param {Phaser.Scene} scene    The scene that owns the texture manager.
 * @param {string}       key      Unique texture key.
 * @param {HTMLCanvasElement} canvas Source canvas.
 * @param {number}       frameW   Width of each sub-frame.
 * @param {number}       frameH   Height of each sub-frame.
 * @param {string[]}     names    Frame names in index order.
 * @returns {Phaser.Textures.Texture}
 */
export function registerFrames(scene, key, canvas, frameW, frameH, names) {
  let tex = scene.textures.exists(key) ? scene.textures.get(key) : null;
  if (!tex || !tex.source || !tex.source[0]) tex = scene.textures.addCanvas(key, canvas);
  names.forEach((name, i) => {
    if (!tex.has(name)) {
      const cx = i % 3;
      const cy = Math.floor(i / 3);
      tex.add(name, 0, cx * frameW, cy * frameH, frameW, frameH);
    }
  });
  return tex;
}

/**
 * Register a **single-frame** image texture from a canvas.
 * No-op if the key already exists.
 *
 * @param {Phaser.Scene} scene  The scene that owns the texture manager.
 * @param {string}       key    Unique texture key.
 * @param {HTMLCanvasElement} canvas Source canvas.
 */
export function registerImage(scene, key, canvas) {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, canvas);
}

// ── Drawing primitives ──────────────────────────────────────────────────────

/**
 * Draw a **rounded rectangle** (or plain rect when `r ≤ 0`).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x       Left edge.
 * @param {number} y       Top edge.
 * @param {number} w       Width.
 * @param {number} h       Height.
 * @param {number} r       Corner radius (clamped to half the smallest side).
 * @param {string|null} fill    Fill style — pass `null` to skip fill.
 * @param {string|null} [stroke=OUTLINE] Stroke style — pass `null` to skip stroke.
 */
export function rr(ctx, x, y, w, h, r, fill, stroke = OUTLINE) {
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
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  Centre X.
 * @param {number} y  Centre Y.
 * @param {number} r  Radius (minimum 0.5).
 * @param {string|null} fill    Fill style.
 * @param {string|null} [stroke=OUTLINE] Stroke style.
 * @param {number}     [lw=1.4] Line width for the stroke.
 */
export function circ(ctx, x, y, r, fill, stroke = OUTLINE, lw = 1.4) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/**
 * Draw an **ellipse** with optional rotation.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x   Centre X.
 * @param {number} y   Centre Y.
 * @param {number} rx  Horizontal radius (minimum 0.5).
 * @param {number} ry  Vertical radius   (minimum 0.5).
 * @param {string|null} fill    Fill style.
 * @param {string|null} [stroke=null] Stroke style.
 * @param {number}     [rot=0]  Rotation in radians.
 */
export function ell(ctx, x, y, rx, ry, fill, stroke = null, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = 1.2; ctx.strokeStyle = stroke; ctx.stroke(); }
}

/**
 * Draw an **equilateral triangle** pointing down.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  Left corner X.
 * @param {number} y  Top (apex) Y.
 * @param {number} s  Side length.
 * @param {string} [fill='#000']  Fill style.
 * @param {string} [stroke=OUTLINE] Stroke style.
 */
export function tri(ctx, x, y, s, fill = '#000', stroke = OUTLINE) {
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
 * @param {string} hex  Six-digit hex colour, e.g. `"#4a7c3a"`.
 * @param {number} amt  Positive = lighter, negative = darker (0-255 per channel).
 * @returns {string} Adjusted hex colour.
 */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + amt);
  const g = cl(((n >> 8) & 255) + amt);
  const b = cl((n & 255) + amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/**
 * Convenience helper: create + register a **single-frame** canvas texture.
 *
 * @param {Phaser.Scene} scene  The scene that owns the texture manager.
 * @param {string}       key    Unique texture key.
 * @param {number}       w      Canvas width.
 * @param {number}       h      Canvas height.
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} draw
 *   Drawing callback invoked immediately with a fresh context.
 */
export function single(scene, key, w, h, draw) {
  const { canvas, ctx } = makeCanvas(w, h);
  draw(ctx, w, h);
  registerImage(scene, key, canvas);
}
