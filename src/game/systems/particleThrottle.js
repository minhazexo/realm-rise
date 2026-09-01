// ─────────────────────────────────────────────────────────────────────────────
// Particle throttle: respects the user's `particles` setting.
//   off  → no emitters at all (return null from create)
//   low  → 35% of intended count, frequency x2.5
//   med  → 70% of intended count
//   high → unchanged
//
// Use as a tiny adapter for any particle-emitter creation site:
//   const emitters = throttleEmitter(scene, x, y, 'pt_firefly', { quantity: 4 });
//   if (emitters) scene.add.existing(emitters);
//
// Or scale an existing config in-place:
//   const cfg = throttleConfig({ frequency: 200, quantity: 4 });
// ─────────────────────────────────────────────────────────────────────────────
import { particleMultiplier } from './SettingsSystem.js';

/** Returns true if any particles are allowed at all under the current setting. */
export function particlesAllowed() {
  return particleMultiplier() > 0;
}

/**
 * Scale a particle-emitter config object so quantity/frequency stay playable
 * but less GPU/CPU is spent when the player picked a lower quality preset.
 * Mutates and returns the same object for ergonomic chaining.
 */
export function throttleConfig(cfg = {}) {
  const mult = particleMultiplier();
  if (mult === 0) return null; // caller treats null as "skip emit entirely"
  if (mult === 1) return cfg;
  if (cfg.quantity != null) cfg.quantity = Math.max(1, Math.round(cfg.quantity * mult));
  if (cfg.frequency != null) cfg.frequency = Math.round(cfg.frequency * (1 + (1 - mult) * 1.5));
  return cfg;
}

/**
 * Convenience helper: returns a scaled config, or null if particles are off.
 * Pass the result directly to `scene.add.particles(...)`.
 */
export function particleConfig(cfg) { return throttleConfig(cfg); }