// ─────────────────────────────────────────────────────────────────────────────
// ScreenOverlays — the single owner of every overlay that lives in SCREEN space
// (night mask, day/dusk grade, night darkening, sky glow, star field, sun/moon,
// vignettes, weather tints and the screen-space particle emitters).
//
// Why this module exists: Phaser applies the camera zoom to `scrollFactor(0)`
// objects too — scrollFactor removes parallax, not zoom. An overlay sized to the
// canvas therefore drew as a centred rectangle covering zoom×100 % of the
// viewport, which is what made night in the Whispering Forest a hard-edged dark
// box with bright terrain at its edges.
//
// Why a container instead of a second camera: the layer has to be zoom-immune
// without becoming a second thing every spawn must know about. A UI camera would
// need the world camera to ignore every overlay AND the UI camera to ignore
// every world object — one ignore entry per display-list object, re-applied as
// chunks, enemies, loot and floaters stream in (hundreds per minute). One
// container pinned to the camera midpoint with scale 1/zoom cancels the zoom by
// construction:
//
//   screen = zoom × (local + container − midpoint) + midpoint
//          = local + midpoint        // container = midpoint, container scale = 1/zoom
//
// so an overlay only ever sizes itself to the viewport and never touches zoom
// math. Call fitScreenLayer() once per frame — it no-ops unless the zoom or the
// canvas size changed — and fitScreenLayer(scene, true) on resize.
// ─────────────────────────────────────────────────────────────────────────────
// Type-only: this module never touches a Phaser value at runtime, which keeps it
// importable from the node test suites (they have no browser globals).
import type Phaser from 'phaser';

/** How an overlay is placed inside the screen layer. */
export type OverlayFit =
  /** Fill the viewport (optionally × scale); positioned by the object's origin. */
  | { mode: 'fill'; scale?: number }
  /** Intrinsic size, pinned so its origin lands on a screen point. */
  | { mode: 'pin'; at: (w: number, h: number) => [number, number] }
  /** Position only, no sizing — emitters and Graphics that draw in screen coords. */
  | { mode: 'anchor' };

/** Container transform that makes local space equal screen space at any zoom. */
export interface ScreenFit { x: number; y: number; scale: number }

/**
 * The container transform for a viewport of `width`×`height` at `zoom`.
 * A zoom that is missing, zero or negative is treated as 1 (never divide by it).
 */
export function screenFit(width: number, height: number, zoom: number): ScreenFit {
  const z: number = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return { x: width / 2, y: height / 2, scale: 1 / z };
}

/**
 * Local position for a `dw`×`dh` overlay that should fill the viewport, honouring
 * the object's origin (origin 0 → top-left of the viewport, 0.5 → centred).
 */
export function layerLocal(width: number, height: number, ox: number, oy: number, dw: number, dh: number): [number, number] {
  return [-width / 2 + ox * dw, -height / 2 + oy * dh];
}

/** Where a point of the overlay lands on screen (zoom cancels by construction). */
export function screenPoint(width: number, height: number, local: [number, number]): [number, number] {
  return [local[0] + width / 2, local[1] + height / 2];
}

interface Entry { obj: any; depth: number; fit: OverlayFit }
interface LayerState { layer: Phaser.GameObjects.Container; entries: Entry[]; zoom: number; w: number; h: number }

type OverlayScene = Phaser.Scene & { _screenOverlays?: LayerState };

/** Lowest depth of the overlay stack — no world object sits above it. */
const LAYER_DEPTH = 3900;

/**
 * Phaser 4 game objects have no `destroyed` flag — reading `.destroyed` is
 * always undefined, so `!obj.destroyed` would pass for a dead object forever.
 * Destruction does clear `active`, and nothing in the game calls setActive(),
 * so that is the reliable test (used for scene-restart and expired overlays).
 */
export function isDestroyed(obj: any): boolean {
  return !obj || obj.active === false;
}

/** Layer state, rebuilt if a scene restart destroyed the previous container. */
function state(scene: OverlayScene, create: boolean): LayerState | null {
  const cur: LayerState | undefined = scene._screenOverlays;
  if (cur && !isDestroyed(cur.layer)) return cur;
  if (!create) return null;
  // Headless scenes (node test doubles) have no display list to attach to.
  if (typeof scene.add?.container !== 'function') return null;
  scene._screenOverlays = {
    layer: scene.add.container(0, 0).setScrollFactor(0).setDepth(LAYER_DEPTH),
    entries: [], zoom: 0, w: 0, h: 0,
  };
  return scene._screenOverlays;
}

/** Place one overlay in the layer, in depth order, and fit it now. */
export function addScreenOverlay(scene: Phaser.Scene, obj: any, depth: number, fit: OverlayFit = { mode: 'fill' }): any {
  const st = state(scene as OverlayScene, true);
  if (!st) return obj;
  st.entries.push({ obj, depth, fit });
  st.layer.add(obj);
  applyFit(obj, fit, scene.scale.width, scene.scale.height);
  st.layer.sort('depth');
  fitScreenLayer(scene, true);
  return obj;
}

/** Re-place every overlay when the camera zoom or the canvas size changed. */
export function fitScreenLayer(scene: Phaser.Scene, force = false): void {
  const st = state(scene as OverlayScene, false);
  if (!st) return;

  // Drop overlays destroyed while registered (weather FX are torn down on a
  // weather change, lightning flashes end their own tween). This runs before
  // the zoom/size guard below — that guard early-returns on a stable camera,
  // so a dead entry would otherwise sit registered until the next zoom change.
  let removed = false;
  for (let i = st.entries.length - 1; i >= 0; i--) {
    const e: Entry | undefined = st.entries[i];
    if (e && isDestroyed(e.obj)) { st.entries.splice(i, 1); removed = true; }
  }
  if (removed) {
    st.layer.removeAll(false);
    for (const e of st.entries) st.layer.add(e.obj);
    st.layer.sort('depth');
  }

  const w: number = scene.scale.width;
  const h: number = scene.scale.height;
  const zoom: number = scene.cameras.main.zoom || 1;
  if (!force && st.zoom === zoom && st.w === w && st.h === h) return;
  st.zoom = zoom; st.w = w; st.h = h;

  const f = screenFit(w, h, zoom);
  st.layer.setPosition(f.x, f.y).setScale(f.scale);
  for (const e of st.entries) applyFit(e.obj, e.fit, w, h);
}

/** Size + position one overlay for the current viewport. */
function applyFit(obj: any, fit: OverlayFit, w: number, h: number): void {
  if (fit.mode === 'anchor') {
    obj.setPosition(-w / 2, -h / 2);
    return;
  }
  if (fit.mode === 'pin') {
    const at: [number, number] = fit.at(w, h);
    obj.setPosition(at[0] - w / 2, at[1] - h / 2);
    return;
  }
  const s: number = fit.scale ?? 1;
  const dw: number = w * s, dh: number = h * s;
  if (typeof obj.setDisplaySize === 'function') obj.setDisplaySize(dw, dh);
  else if (typeof obj.setSize === 'function') obj.setSize(dw, dh);
  const ox: number = typeof obj.originX === 'number' ? obj.originX : 0;
  const oy: number = typeof obj.originY === 'number' ? obj.originY : 0;
  const [lx, ly] = layerLocal(w, h, ox, oy, dw, dh);
  obj.setPosition(lx, ly);
}
