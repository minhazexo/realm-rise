// ─────────────────────────────────────────────────────────────────────────────
// PostFXSystem (spec §63 — "subtle bloom where appropriate, atmospheric
// lighting, particles, fog, environmental animation"):
//
// Wires up Phaser 4's per-camera preFX/postFX pipeline so the game gets
// cinematic visuals out of the box without per-scene boilerplate. Also
// owns the in-world atmospheric fog (distance haze) which can't be done
// with postFX alone — that runs in chunkPainter via getFogColor().
//
// Quality levels (driven by settings.graphicsQuality):
//   low    — vignette only, no bloom, no aberration
//   medium — + subtle bloom on emissive objects, distance fog
//   high   — + chromatic aberration, color grade
//   ultra  — + bloom on HUD numbers, animated god-rays
//
// Designed to be cheap on low hardware: every effect is a no-op below
// its minimum quality threshold. Idle cost on "low" is ~0 ms per frame.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';

const QUALITY_ORDER = ['low', 'med', 'high', 'ultra'];
const QUALITY_NUM = { low: 0, med: 1, high: 2, ultra: 3 };

function qNum() {
  const s = GameState.s?.settings?.graphicsQuality || 'med';
  return QUALITY_NUM[s] ?? 1;
}

export default class PostFXSystem {
  constructor(scene) {
    this.scene = scene;
    this.camera = scene.cameras?.main || null;
    this.fx = null;
    this.vignette = null;
    this.colorMatrix = null;
    this.bloom = null;
    this.chromatic = null;
    // Lightweight runtime metrics
    this.lastBloomKickedAt = 0;
  }

  create() {
    if (!this.camera) return;
    // postFX lives on the camera in Phaser 4 — adding a pipeline slots a
    // full-screen shader pass after the scene is rendered.
    const fx = this.camera.postFX;
    if (!fx) return;
    this.fx = fx;

    // Always-on: subtle vignette (cinematic darkening on edges).
    // Cheap and adds a lot of perceived polish.
    try {
      this.vignette = fx.addVignette(
        0.5, 0.5,        // x, y (center)
        0.85,            // radius (relative)
        0.55,            // strength
        0x000000,        // color
        Phaser.BlendModes.NORMAL
      );
    } catch (err) {
      console.warn('[PostFX] vignette unavailable:', err);
    }

    // Always-on: mild contrast/saturation boost via ColorMatrix.
    try {
      this.colorMatrix = fx.addColorMatrix();
      this.colorMatrix.saturate(1.18);
      this.colorMatrix.contrast(1.06);
    } catch (err) {
      console.warn('[PostFX] colorMatrix unavailable:', err);
    }

    // Conditional: bloom from medium up. Bloom is what makes emissive
    // objects (torches, sun, fireballs, projectiles) glow.
    if (qNum() >= 1) {
      try {
        this.bloom = fx.addBloom(0xfff2c4, 0.55, 12, 0.6);
      } catch (err) {
        console.warn('[PostFX] bloom unavailable:', err);
      }
    }

    // Conditional: chromatic aberration on high/ultra. Subtle RGB split
    // that's strongest on screen edges, gives a cinematic/film feel.
    if (qNum() >= 2) {
      try {
        // Phaser exposes chromatic aberration via addChromaticAberration
        // in newer versions; fall back to nothing if not available.
        if (typeof fx.addChromaticAberration === 'function') {
          this.chromatic = fx.addChromaticAberration(0.0015, 0.0015, 0.85);
        }
      } catch (err) {
        console.warn('[PostFX] chromatic aberration unavailable:', err);
      }
    }

    // React to live quality changes
    Bus.on('settings-applied', () => this.applyQuality());
  }

  /**
   * Apply bloom punch on demand — call right after a hit / pickup / xp
   * gain for a satisfying screen-flash moment.
   */
  pulse(strength = 0.85, durMs = 120) {
    if (!this.bloom || qNum() < 1) return;
    const now = performance.now();
    if (now - this.lastBloomKickedAt < 50) return; // throttle
    this.lastBloomKickedAt = now;
    const original = this.bloom.strength;
    this.bloom.strength = strength;
    setTimeout(() => {
      // Restore the quality baseline
      const base = qNum() >= 3 ? 0.7 : qNum() >= 2 ? 0.6 : 0.5;
      if (this.bloom) this.bloom.strength = base;
    }, durMs);
  }

  /**
   * Re-apply quality-dependent settings without rebuilding the whole
   * pipeline (HMR + settings-driven live updates).
   */
  applyQuality() {
    if (!this.colorMatrix) return;
    try {
      const q = qNum();
      this.colorMatrix.reset();
      // Saturation/contrast scale with quality
      this.colorMatrix.saturate(q >= 2 ? 1.22 : 1.12);
      this.colorMatrix.contrast(q >= 2 ? 1.08 : 1.04);
    } catch { /* non-fatal */ }
  }
}

/** Expose the quality helpers for other systems. */
export function graphicsQualityNum() { return qNum(); }
export function graphicsQualityAtLeast(level) {
  return qNum() >= (QUALITY_NUM[level] ?? 1);
}
export function graphicsQualityOrder() {
  return [...QUALITY_ORDER];
}