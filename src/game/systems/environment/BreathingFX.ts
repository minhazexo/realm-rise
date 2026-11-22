// ─────────────────────────────────────────────────────────────────────────────
// BreathingFX — one shared idle-breathing helper for all characters.
//
// Previously duplicated in Player.updateWalkAnim and Enemy.syncAnim with
// different conventions (public vs private accumulator, different gates).
// One helper now owns the policy: reduced motion off, sine oscillation,
// caller supplies the baseline scale and amplitude. Called per-frame from
// both entities' idle branches.
// ─────────────────────────────────────────────────────────────────────────────
import { reducedMotion } from './SettingsSystem.ts';

/**
 * Apply idle breathing to a sprite's scaleY around `baseScale`.
 *
 * @param acc      Caller-owned phase accumulator — advance it here so the
 *                 phase survives pauses (hitstop, panel-open) naturally.
 * @param dt       Frame delta (seconds).
 * @param base     Baseline scale (player: 1, enemy: its def scale).
 * @param rateHz   Breaths per second (big creatures breathe slower).
 * @param ampPct   Amplitude as a fraction of base (default 1.2%).
 * @returns true when breathing was applied (caller may skip other transforms).
 */
export function applyBreathing(
  sprite: { setScale: (x: number, y: number) => unknown },
  acc: { value: number },
  dt: number,
  base: number,
  rateHz: number,
  ampPct = 0.012,
): boolean {
  if (reducedMotion()) return false;
  acc.value += dt;
  const breathe = Math.sin(acc.value * Math.PI * 2 * rateHz);
  sprite.setScale(base, base + breathe * ampPct * base);
  return true;
}
