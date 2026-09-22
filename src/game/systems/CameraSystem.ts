// ─────────────────────────────────────────────────────────────────────────────
// CameraSystem — the world camera's zoom policy: the player's camZoom setting
// is the anchor, combat biases it ~4% wider, and ONE ease glides between them.
//
// The scene surface is deliberately just a camera and there is no Phaser
// import, so this policy is unit-testable in node (tests/settings.mjs) —
// unlike InputSystem, which needs Phaser's KeyCodes. Input wiring (wheel,
// +/-, Z/X, HUD buttons) still lives there and calls straight into here.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { CH } from '../core/EventBus.ts';
import { getSetting, updateSettings } from './SettingsSystem.ts';

/** Just what the zoom policy touches on the scene. */
export interface ZoomScene {
  cameras: { main: { zoom?: number; setZoom(z: number): void } };
}

/**
 * Ease rate, in "gap closed per second": 6 → ~0.5 s to glide 95% of the way.
 * Frame-rate independent because the step is exponential in dt, so the camera
 * curves smoothly instead of stepping (the old fixed 8% applied only every
 * 20th frame = 3 visible jumps/second — the steppy auto-zoom after CONTINUE).
 */
const ZOOM_EASE_PER_SEC = 6;

/** Ease the camera toward this frame's zoom target. Returns the zoom applied. */
export function applyCamZoom(scene: ZoomScene, dtMs: number = 16.67): number {
  const raw = Number(getSetting('camZoom') ?? 1);
  const base = Math.max(0.6, Math.min(2, Number.isFinite(raw) ? raw : 1));
  // Combat bias: zoom out ~4% during combat so melee arcs and incoming
  // enemies stay in frame. The player's chosen baseline is always the anchor —
  // combat only biases it.
  const combat = GameState.session.inCombat === true;
  const target = combat ? base * 0.96 : base;
  const cur = scene.cameras.main.zoom || base;
  const gap = target - cur;
  const next = cur + gap * (1 - Math.exp(-(Math.max(0, dtMs) / 1000) * ZOOM_EASE_PER_SEC));
  const z = Math.abs(next - target) < 0.001 ? target : next; // snap the last sliver
  try { scene.cameras.main.setZoom(z); } catch { /* headless */ }
  return z;
}

/** Wheel / +/- / Z/X / HUD buttons step the SETTING; the ease does the rest. */
export function nudgeCamZoom(scene: ZoomScene, dir: number): void {
  const cur = Number(getSetting('camZoom') ?? 1) || 1;
  const next = Math.round((Math.max(0.6, Math.min(2, cur + (dir > 0 ? 0.15 : -0.15)))) * 100) / 100;
  try { updateSettings({ camZoom: next }); }
  catch {
    try {
      GameState.s.settings.camZoom = next;
      applyCamZoom(scene);
      GameState.notify(CH.SETTINGS);
    } catch { /* ignore */ }
  }
}
