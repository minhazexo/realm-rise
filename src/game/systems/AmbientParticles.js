// ─────────────────────────────────────────────────────────────────────────────
// AmbientParticles (spec §63 — "fireflies, falling leaves, environmental
// animation"):
//
// On top of EnvSystem's fireflies + weather emitters, this module adds
// biomes-tied "atmosphere particles" that float through the world:
//
//   * Pollen / dust motes — float lazily in lit areas during day
//   * Birds — silhouettes that fly across the sky occasionally
//   * Mist — slow drifting rolls in valleys at dawn / dusk
//
// All emitters follow the player (scrollFactor=0) so the player never
// outruns them. Throttled via the same particleMultiplier used by other
// particle systems so a single quality knob scales everything.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { biomeAt } from '../world/worldGen.js';
import { particleMultiplier } from './SettingsSystem.js';

let _lastSpawnBirdAt = 0;
let _birdEmitter = null;
let _pollenEmitter = null;
let _mistEmitter = null;

function ensureBird(scene) {
  if (_birdEmitter || !scene.textures.exists('menu_bird_f1')) return null;
  _birdEmitter = scene.add.particles(0, 0, 'menu_bird_f1', {
    x: { min: -200, max: scene.scale.width + 200 },
    y: { min: -40, max: scene.scale.height * 0.3 },
    lifespan: 8000,
    speedX: { min: 30, max: 60 },
    speedY: { min: -2, max: 2 },
    quantity: 1,
    frequency: 4000,
    scale: 0.8,
    alpha: 0.7
  }).setDepth(3000).setScrollFactor(0);
  return _birdEmitter;
}

function ensurePollen(scene, biome) {
  if (_pollenEmitter) return _pollenEmitter;
  if (!scene.textures.exists('pt_spark')) return null;
  _pollenEmitter = scene.add.particles(0, 0, 'pt_spark', {
    x: { min: 0, max: scene.scale.width },
    y: { min: 0, max: scene.scale.height },
    lifespan: { min: 4000, max: 8000 },
    speedX: { min: -8, max: 8 },
    speedY: { min: -12, max: -3 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 0.5, end: 0 },
    quantity: 1,
    frequency: biome === 'desert' || biome === 'frozen' ? 1500 : 400,
    tint: biome === 'desert' ? 0xf5e0b0 : biome === 'frozen' ? 0xe8f0ff : 0xfff0b8
  }).setDepth(3600).setScrollFactor(0).setBlendMode('ADD');
  return _pollenEmitter;
}

function ensureMist(scene) {
  if (_mistEmitter) return _mistEmitter;
  if (!scene.textures.exists('pt_smoke')) return null;
  _mistEmitter = scene.add.particles(0, 0, 'pt_smoke', {
    x: { min: -200, max: scene.scale.width + 200 },
    y: { min: scene.scale.height * 0.6, max: scene.scale.height * 1.1 },
    lifespan: 14000,
    speedX: { min: 8, max: 18 },
    speedY: { min: -2, max: -1 },
    scale: { start: 0.5, end: 1.6 },
    alpha: { start: 0.18, end: 0 },
    quantity: 1,
    frequency: 1200,
    tint: 0xb0c4d8
  }).setDepth(3550).setScrollFactor(0).setBlendMode('NORMAL');
  return _mistEmitter;
}

/**
 * Update ambient particle emitters. Call from WorldScene.update each frame.
 * Cheap: per-frame work is O(1), emitters themselves run on Phaser's
 * internal scheduler.
 */
export function updateAmbientParticles(scene, time, dt) {
  const mult = particleMultiplier();
  if (mult === 0) {
    // Quality = off. Tear down any active emitters.
    _birdEmitter?.destroy(); _birdEmitter = null;
    _pollenEmitter?.destroy(); _pollenEmitter = null;
    _mistEmitter?.destroy(); _mistEmitter = null;
    return;
  }

  const S = GameState.s;
  if (!S) return;
  const isNight = S.world.timeOfDay > 0.78 || S.world.timeOfDay < 0.24;

  // 1. Pollen / dust motes (day only, always on except in extreme biomes)
  const biome = biomeAt(scene.player?.sprite?.x || 0, scene.player?.sprite?.y || 0);
  const wantPollen = !isNight && mult > 0.35 && biome !== 'frozen';
  if (wantPollen) ensurePollen(scene, biome);
  else if (_pollenEmitter) {
    _pollenEmitter.destroy(); _pollenEmitter = null;
  }

  // 2. Mist rolls (dawn / dusk over rivers & valleys)
  const t = S.world.timeOfDay;
  const twilight = (t > 0.20 && t < 0.32) || (t > 0.74 && t < 0.82);
  const wantMist = mult > 0.35 && twilight && biome !== 'desert';
  if (wantMist) ensureMist(scene);
  else if (_mistEmitter) { _mistEmitter.destroy(); _mistEmitter = null; }

  // 3. Birds — sparse silhouettes that drift across the sky (day only).
  if (!isNight && mult > 0.5 && time - _lastSpawnBirdAt > 9000 && scene.textures.exists('menu_bird_f1')) {
    ensureBird(scene);
    if (_birdEmitter) {
      _birdEmitter.explode(scene.scale.width + 100,
        20 + Math.random() * scene.scale.height * 0.25,
        Math.max(1, Math.round(mult * 3)));
      _lastSpawnBirdAt = time;
    }
  }
}

/** Tear down everything on scene shutdown. */
export function destroyAmbientParticles() {
  _birdEmitter?.destroy(); _birdEmitter = null;
  _pollenEmitter?.destroy(); _pollenEmitter = null;
  _mistEmitter?.destroy(); _mistEmitter = null;
}