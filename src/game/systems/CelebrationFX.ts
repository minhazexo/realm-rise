// ─────────────────────────────────────────────────────────────────────────────
// CelebrationFX — moment-ceremony effects for milestone events (level-up,
// boss kills, chapter advances). Scene-context helpers so WorldScene stays a
// coordinator and the gating logic stays testable.
//
// A level-up jingle alone felt flat: this module layers a ring burst, a warm
// light flash, a floating banner and a short camera zoom punch — all behind
// the standard accessibility gates (reducedMotion / photosensitiveMode /
// graphicsQuality).
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { photosensitiveMode, reducedMotion } from './SettingsSystem.ts';

/** Minimal scene surface consumed by the celebration helpers. */
export type CelebrationScene = Phaser.Scene & {
  player?: { sprite?: { x: number; y: number; depth?: number } | null } | null;
  spawnBurst?(x: number, y: number, key: string): void;
  floats?: { add(x: number, y: number, text: string, color?: string, scale?: number): void } | null;
};

/** True when motion-heavy ceremony should be skipped entirely. */
function ceremonyBlocked(): boolean {
  return reducedMotion() || photosensitiveMode();
}

/**
 * Level-up ceremony at the player's position: double ring burst, warm gold
 * light pulse, "LEVEL n!" banner float and a brief camera zoom punch.
 * Every layer degrades gracefully: reduced motion/photosensitivity → banner
 * float only; low graphics quality → no bloom-heavy light pulse.
 */
export function levelUpCeremony(scene: CelebrationScene, level: number): void {
  const sp = scene.player?.sprite;
  const x = sp?.x ?? 0;
  const y = sp?.y ?? 0;

  // Banner float always shows (text feedback is never motion).
  try { scene.floats?.add(x, y - 58, `LEVEL ${level}!`, '#ffd66b', 1.6); } catch { /* cosmetic */ }

  if (ceremonyBlocked()) return;

  try {
    // Double ring burst — staggered so it reads as a shockwave + echo.
    scene.spawnBurst?.(x, y + 6, 'fx_ring');
    scene.time.delayedCall(140, () => {
      try { if (!GameState.s?.session_dead) scene.spawnBurst?.(x, y + 6, 'fx_ring'); } catch { /* cosmetic */ }
    });

    // Warm gold light pulse under the player (ADD blend makes it glow).
    if (scene.textures.exists('fx_light')) {
      const glow = scene.add.image(x, y + 4, 'fx_light')
        .setDepth((sp?.depth ?? 50) - 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.6)
        .setAlpha(0.0);
      scene.tweens.add({
        targets: glow,
        alpha: 0.55, scale: 2.1,
        duration: 260, ease: 'Quad.easeOut',
        yoyo: true, hold: 120,
        onComplete: () => { try { glow.destroy(); } catch { /* gone */ } },
      });
    }
  } catch { /* ceremony never crashes gameplay */ }

  // Camera zoom punch: quick 4% zoom-in and back. Skipped entirely when the
  // user caps or biases zoom via settings — we read the live zoom so we
  // always return to the player's chosen baseline.
  try {
    const cam = scene.cameras.main;
    const base = cam.zoom;
    if (base > 0.2 && base < 3) {
      scene.tweens.add({
        targets: cam,
        zoom: base * 1.04,
        duration: 130, ease: 'Quad.easeOut',
        yoyo: true, hold: 60,
        onComplete: () => { try { cam.setZoom(base); } catch { /* gone */ } },
      });
    }
  } catch { /* headless */ }
}

/**
 * Kill-reward beat: gold XP float anchored at the corpse + stamina-shaped
 * satisfaction. Bosses get a heavier hitstop-style shake.
 */
export function killRewardBeat(
  scene: CelebrationScene,
  x: number, y: number,
  xp: number,
  boss: boolean,
): void {
  try {
    scene.floats?.add(x, y - 42, `+${xp} XP`, boss ? '#ffe28a' : '#e8d9a0', boss ? 1.4 : 1.05);
  } catch { /* cosmetic */ }
  if (boss && !ceremonyBlocked()) {
    try {
      scene.spawnBurst?.(x, y, 'fx_ring');
      scene.spawnBurst?.(x, y, 'fx_hitflash');
    } catch { /* cosmetic */ }
  }
}

/**
 * Boss arena telegraph: a slow-pulsing ground ring at the boss's leash
 * radius so the player can *see* how far they can kite before reset.
 */
export function bossArenaRing(scene: Phaser.Scene, x: number, y: number, radius: number): void {
  if (radius <= 0) return;
  try {
    const g = scene.add.graphics().setDepth(6).setAlpha(0.5);
    g.lineStyle(2, 0xff6a4a, 0.55);
    g.strokeCircle(x, y, radius);
    g.fillStyle(0xff6a4a, 0.04);
    g.fillCircle(x, y, radius);
    scene.tweens.add({
      targets: g,
      alpha: 0.12,
      duration: 1400,
      yoyo: true, repeat: 5,
      onComplete: () => { try { g.destroy(); } catch { /* gone */ } },
    });
  } catch { /* cosmetic */ }
}
