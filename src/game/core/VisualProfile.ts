// ─────────────────────────────────────────────────────────────────────────────
// Visual profile — the ONE switch that owns the game's rendering pipeline.
//
// The game is migrating from pixel art to a painterly/vector-flat look
// (see docs/ART-DIRECTION.md). This module is Phaser-free so tests and pure
// systems can read it, and it is the only place the style decision lives:
//
//   • the player-facing setting (Settings → Render style) is PUSHED here once,
//     at boot and on every toggle (`setRenderStyle`),
//   • the Phaser render flags come from `renderProfile()`,
//   • the art layer reads `artScale()` / `terrainScale()` / `contourWidth()` /
//     `lightFeather()` instead of re-deriving the style or re-typing numbers.
//
// tests/structure.mjs fails if an exported knob here has no consumer, so a
// declared-but-unread knob cannot come back.
// ─────────────────────────────────────────────────────────────────────────────

/** Rendering pipeline style. */
export type RenderStyle = 'pixel' | 'painterly';

/** Phaser render-pipeline flags for a style. */
export interface RenderConfig {
  /** Multisample the WebGL framebuffer (smooth edges). */
  antialias: boolean;
  /** Nearest-neighbour sampling + integer snapping (crisp pixels). */
  pixelArt: boolean;
  /** Round sprite positions to whole pixels. */
  roundPixels: boolean;
  /** Allow sub-pixel positioning. */
  subPixel: boolean;
  /** Generate mipmaps (smooth when the camera zooms out). */
  mipmap: boolean;
}

/** Depth plane a contour width applies to — ART-DIRECTION §6. */
export type ContourPlane = 'gameplay' | 'midground' | 'far';

export interface VisualProfile {
  /** Style used when nothing has been pushed from settings yet. */
  style: RenderStyle;
  /**
   * Authoring texels per world pixel for sprite, prop and icon art.
   *
   * The invariant: one art texel per **device** pixel at the largest zoom the
   * player can select (camZoom 2 × maxDpr 2 = 4 device px per world px), and
   * more texels than that below it. A sprite is then *downsampled* on screen
   * instead of upscaled, which is the whole difference between crisp and the
   * soft, magnified look this knob exists to prevent. Below the invariant the
   * art is stretched (fuzzy); far above it the texture memory is wasted.
   * Cost is quadratic in the value, so sprites/props are cheap to raise and the
   * ground (see `terrainScale`) is not.
   */
  artScale: number;
  /**
   * Authoring texels per world pixel for terrain (ground chunk canvases).
   *
   * Deliberately separate from `artScale` and much lower: a ground canvas is
   * CHUNK-sized and one is held per live chunk (plus the LRU of painted
   * canvases), so its cost is ~`liveChunks × chunkSize² × scale² × 4 B` — the
   * shipped radius puts that at ~100 MB per scale step (measured: 49 chunks =
   * 196 MB at 2). 2 texels per world pixel already lands within a texel of 1:1
   * on a 1.25× display at max zoom; a further step would buy ~half a texel per
   * pixel for a quarter of a gigabyte. See docs/ART-DIRECTION.md §Ground.
   */
  terrainScale: number;
  /**
   * devicePixelRatio cap for the canvas backing store (perf guard). Phaser 4
   * sizes the canvas in CSS px, so a display at DPR 1.25+ is served an upscaled
   * frame unless the game renders at device pixels — see `renderScale()`.
   */
  maxDpr: number;
  /** Contour stroke widths (px) by depth plane — ART-DIRECTION §6. */
  contour: Record<ContourPlane, number>;
  /** Feather strength for night-light holes — ART-DIRECTION §6. */
  lightFeather: number;
}

export const VISUAL_PROFILE: Readonly<VisualProfile> = Object.freeze({
  style: 'painterly' as RenderStyle,
  artScale: 4,
  terrainScale: 2,
  maxDpr: 2,
  contour: { gameplay: 2.4, midground: 1.4, far: 0 },
  lightFeather: 1.6
});

// ── Active style ────────────────────────────────────────────────────────────
// One mutable value, written only by setRenderStyle(). Everything else reads it.

let _style: RenderStyle = VISUAL_PROFILE.style;

/**
 * Push the player-facing style choice into the pipeline.
 * Unknown/absent values fall back to the built-in default (`painterly`).
 * @returns The style now active.
 */
export function setRenderStyle(style?: unknown): RenderStyle {
  _style = style === 'pixel' ? 'pixel' : 'painterly';
  return _style;
}

/**
 * Authoring scale for freshly painted art: how many texels each world pixel is
 * painted with. 1 in the pixel style (art stays exactly as authored); >1 in the
 * painterly style, which is what keeps sprites crisp where the camera's device
 * zoom would otherwise magnify 1× art.
 */
export function artScale(): number {
  return _style === 'painterly' ? VISUAL_PROFILE.artScale : 1;
}

/**
 * Authoring scale for terrain chunk canvases. Same rule as {@link artScale} but
 * a much smaller ceiling: ground canvases are chunk-sized and one is resident
 * per live chunk, so this knob is a memory decision, not a free quality win.
 */
export function terrainScale(): number {
  return _style === 'painterly' ? VISUAL_PROFILE.terrainScale : 1;
}

/**
 * How many device pixels each CSS pixel of the canvas is rendered with.
 * 1 on a normal display; 1.25/1.5/2 under OS scaling and HiDPI, capped by
 * `maxDpr`. Phaser 4 has no render-config knob for this (it sizes the canvas in
 * CSS px), so `main.ts` resizes the backing store to `CSS size × renderScale()`
 * and the camera zoom is scaled to match — same world on screen, real device
 * resolution instead of one upscaled frame. Safe under node (no `window`).
 */
export function renderScale(): number {
  const dpr: number = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1);
  return Math.max(1, Math.min(VISUAL_PROFILE.maxDpr, dpr));
}

/**
 * Contour stroke width (px) for a depth plane. `far` is 0: distant planes
 * carry no contour, only value shapes (ART-DIRECTION §6).
 */
export function contourWidth(plane: ContourPlane): number {
  return VISUAL_PROFILE.contour[plane];
}

/** Feather strength for night-light holes (1 = tight falloff, higher = softer). */
export function lightFeather(): number {
  return VISUAL_PROFILE.lightFeather;
}

/**
 * Phaser render flags for a style.
 * `painterly` = smooth filtering + mipmaps + sub-pixel; `pixel` = the original
 * nearest-neighbour crisp profile.
 */
export function renderProfile(style: RenderStyle = _style): RenderConfig {
  return style === 'painterly'
    ? { antialias: true, pixelArt: false, roundPixels: false, subPixel: true, mipmap: true }
    : { antialias: false, pixelArt: true, roundPixels: true, subPixel: false, mipmap: false };
}
