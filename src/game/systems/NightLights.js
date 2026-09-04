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
import GameState from '../core/GameState.js';
import { collectWantedLights } from './DynamicLights.js';

const TEX_KEY = 'night_mask';
const MASK_W = 480;
const MASK_H = 270;

/** Night amount 0 (day) → 1 (deep night) from timeOfDay. */
function nightAmount(t) {
  const DAWN = 0.24, DUSK = 0.78;
  if (t >= DAWN && t <= DUSK) {
    const mid = (DAWN + DUSK) / 2, half = (DUSK - DAWN) / 2;
    const smoothDay = Math.max(0, 1 - Math.abs(t - mid) / half);
    return Math.max(0, 1 - smoothDay * 1.6);
  }
  return 1;
}

function ensureMask(scene) {
  if (scene.textures.exists(TEX_KEY)) return scene.textures.get(TEX_KEY);
  if (typeof document === 'undefined') return null;
  const tex = scene.textures.createCanvas(TEX_KEY, MASK_W, MASK_H);
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
export function updateNightMask(scene) {
  const S = GameState.s;
  const player = scene.player?.sprite;
  if (!S || !player) return;
  const t = S.world?.timeOfDay;
  if (typeof t !== 'number') return;
  const night = nightAmount(t);
  const tex = ensureMask(scene);
  if (!tex || !scene._nightMaskImg) return;

  const w = scene.scale.width, h = scene.scale.height;
  const img = scene._nightMaskImg;
  img.setDisplaySize(w, h);
  if (night <= 0.02) {
    img.setVisible(false);
    return;
  }
  img.setVisible(true);

  const ctx = tex.getContext();
  const cam = scene.cameras.main;
  const viewX = cam.worldView?.x ?? cam.scrollX;
  const viewY = cam.worldView?.y ?? cam.scrollY;
  const sx = MASK_W / w, sy = MASK_H / h;
  const toMask = (wx, wy) => [(wx - viewX) * sx, (wy - viewY) * sy];

  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, MASK_W, MASK_H);
  ctx.fillStyle = `rgba(6,10,24,${(0.72 * night).toFixed(3)})`;
  ctx.fillRect(0, 0, MASK_W, MASK_H);

  // Punch holes: destination-out radial gradients (soft falloff).
  ctx.globalCompositeOperation = 'destination-out';
  const hole = (mx, my, r) => {
    if (r <= 0) return;
    const g = ctx.createRadialGradient(mx, my, r * 0.15, mx, my, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // Player sight radius — smaller without a torch (torch matters at night).
  const hasTorch = /torch/i.test(S.player.equipment?.offhand?.id || '');
  const sightWorld = hasTorch ? 300 : 190;
  const [pmx, pmy] = toMask(player.x, player.y);
  hole(pmx, pmy, sightWorld * sx);

  // Dynamic lights (campfires / forges / torch glow).
  try {
    for (const [, def] of collectWantedLights()) {
      const [mx, my] = toMask(def.x, def.y);
      // Cull far off-screen lights.
      if (mx < -120 || my < -120 || mx > MASK_W + 120 || my > MASK_H + 120) continue;
      hole(mx, my, (def.scale || 1.5) * 70 * sx);
    }
  } catch { /* lights unavailable — sight hole still applies */ }

  ctx.globalCompositeOperation = 'source-over';
  tex.refresh();
}

/** Hide the mask (scene shutdown / sleep). */
export function hideNightMask(scene) {
  scene._nightMaskImg?.setVisible(false);
}
