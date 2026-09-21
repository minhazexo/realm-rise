// ─────────────────────────────────────────────────────────────────────────────
// NightLights (Phase C): real 2D darkness-with-holes night lighting.
//
// Renders a low-res fullscreen mask (480×270, scaled up — soft by nature):
// dark blue fill at night with radial holes punched (destination-out) at
// every dynamic light (campfire / forge / torch) plus a sight radius around
// the player. Torch vs no-torch reads completely differently at night.
//
// Coordinates with EnvSystem: when the mask is active WorldScene sets
// `env.useLightMask = true`, which caps the flat darkLayer at 0.25 so the
// two darkness sources compose instead of double-darkening.
//
// Cadence: WorldScene calls updateMask() every 4th frame; skipped entirely
// by day (image hidden) and when document/canvas is unavailable (tests).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { collectWantedLights } from './DynamicLights.ts';

const TEX_KEY = 'night_mask';
/** Mask canvas is half the game-canvas size (capped) — uniform downscale, so light holes stay circular at any aspect ratio. The old fixed 480×270 was stretched 0.92× horizontally but 2.9× vertically on portrait canvases, squaring light holes into tall ellipses. */
const MASK_SCALE = 0.5;
const MASK_MAX_W = 512;

/** Minimal scene surface consumed by the night mask. */
export type NightScene = Phaser.Scene & {
  player?: { sprite?: { x: number; y: number } | null } | null;
  _nightMaskImg?: Phaser.GameObjects.Image | null;
};

/** Night amount 0 (day) → 1 (deep night) from timeOfDay. */
function nightAmount(t: number): number {
  const DAWN = 0.24, DUSK = 0.78;
  if (t >= DAWN && t <= DUSK) {
    const mid = (DAWN + DUSK) / 2, half = (DUSK - DAWN) / 2;
    const smoothDay: number = Math.max(0, 1 - Math.abs(t - mid) / half);
    return Math.max(0, 1 - smoothDay * 1.6);
  }
  return 1;
}

function maskDims(scene: NightScene): { w: number; h: number } {
  const w: number = scene.scale.width || 480;
  const mw: number = Math.min(Math.max(160, Math.round(w * MASK_SCALE)), MASK_MAX_W);
  const mh: number = Math.max(120, Math.round(mw * (scene.scale.height || 320) / w));
  return { w: mw, h: mh };
}

function ensureMask(scene: NightScene): Phaser.Textures.CanvasTexture | null {
  const { w, h } = maskDims(scene);
  if (scene.textures.exists(TEX_KEY)) {
    const tex = scene.textures.get(TEX_KEY) as Phaser.Textures.CanvasTexture;
    // Window resized? Rebuild the canvas so the aspect stays exact.
    if (tex.width !== w || tex.height !== h) {
      scene.textures.remove(TEX_KEY);
    } else {
      return tex;
    }
  }
  if (typeof document === 'undefined') return null;
  const tex: Phaser.Textures.CanvasTexture | null = scene.textures.createCanvas(TEX_KEY, w, h);
  if (!tex) return null;
  if (!scene._nightMaskImg) {
    scene._nightMaskImg = scene.add.image(0, 0, TEX_KEY)
      .setOrigin(0)
      .setDepth(3960)
      .setScrollFactor(0)
      .setVisible(false);
  }
  return tex;
}

/**
 * Redraw the night mask. Call every few frames from WorldScene.update.
 * No-ops by day, without a player sprite, or outside a canvas environment.
 */
export function updateNightMask(scene: NightScene): void {
  const S = GameState.s;
  const player = scene.player?.sprite;
  if (!S || !player) return;
  const t: number = S.world?.timeOfDay;
  if (typeof t !== 'number') return;
  const night: number = nightAmount(t);
  const tex: Phaser.Textures.CanvasTexture | null = ensureMask(scene);
  if (!tex || !scene._nightMaskImg) return;

  const w: number = scene.scale.width, h: number = scene.scale.height;
  const img: Phaser.GameObjects.Image = scene._nightMaskImg;
  if (night <= 0.02) {
    img.setVisible(false);
    return;
  }
  img.setVisible(true);
  // The mask texture is a uniform downscale of the game canvas, so a plain
  // displaySize covers the view exactly at any camera zoom.
  img.setDisplaySize(w, h);

  const ctx: CanvasRenderingContext2D = tex.getContext();
  const cam: Phaser.Cameras.Scene2D.Camera = scene.cameras.main;
  const viewX: number = cam.worldView?.x ?? cam.scrollX;
  const viewY: number = cam.worldView?.y ?? cam.scrollY;
  const sx: number = tex.width / w, sy: number = tex.height / h;
  const toMask = (wx: number, wy: number): [number, number] => [(wx - viewX) * sx, (wy - viewY) * sy];

  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, tex.width, tex.height);
  ctx.fillStyle = `rgba(6,10,24,${(0.78 * night).toFixed(3)})`;
  ctx.fillRect(0, 0, tex.width, tex.height);

  // Punch holes: destination-out radial gradients (soft falloff).
  ctx.globalCompositeOperation = 'destination-out';
  const hole = (mx: number, my: number, r: number): void => {
    if (r <= 0) return;
    const g: CanvasGradient = ctx.createRadialGradient(mx, my, r * 0.15, mx, my, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Player sight radius — smaller without a torch (torch matters at night).
  // Scaled to the view: a fixed 190px radius swallowed 86% of a narrow
  // viewport, so night read as a flat wash with no lit pool at all.
  const hasTorch: boolean = /torch/i.test(S.player.equipment?.offhand?.id || '');
  const viewSpan: number = Math.hypot(cam.worldView.width, cam.worldView.height);
  const sightWorld: number = Math.max(130, viewSpan * (hasTorch ? 0.42 : 0.3));
  const [pmx, pmy] = toMask(player.x, player.y);
  hole(pmx, pmy, sightWorld * sx);

  // Dynamic lights (campfires / forges / torch glow).
  try {
    for (const [, def] of collectWantedLights()) {
      const [mx, my] = toMask(def.x, def.y);
      // Cull far off-screen lights.
      if (mx < -120 || my < -120 || mx > tex.width + 120 || my > tex.height + 120) continue;
      hole(mx, my, (def.scale || 1.5) * 70 * sx);
    }
  } catch { /* lights unavailable — sight hole still applies */ }

  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
}

/** Hide the mask (scene shutdown / sleep). */
export function hideNightMask(scene: NightScene): void {
  scene._nightMaskImg?.setVisible(false);
}
