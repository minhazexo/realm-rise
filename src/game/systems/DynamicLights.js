// ─────────────────────────────────────────────────────────────────────────────
// DynamicLights (spec §63 — "atmospheric lighting"):
//
// Adds Phaser point-light style glow around torches and campfires. Real
// Phaser 4 lights require the WebGL lights pipeline; for a lightweight
// cross-renderer solution we overlay a soft radial-gradient sprite on
// top of every light-emitting entity (campfire, torch, fire spell).
//
// Each light is a pre-baked radial-gradient texture that fades to
// transparent. We attach/detach lights by reading the settlement's
// buildings list and the player's equipped-offhand torch.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';

const TEX_KEY = 'fx_light_v2';
let _ready = false;

/** Bake a softer, bigger radial gradient than the existing fx_light. */
export function ensureDynamicLightTexture(scene) {
  if (_ready) return;
  if (scene.textures.exists(TEX_KEY)) { _ready = true; return; }
  const size = 256;
  // Generate canvas locally to avoid a Node test-side 'document' error.
  if (typeof document === 'undefined') { _ready = true; return; }
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  g.addColorStop(0.00, 'rgba(255,210,120,0.95)');
  g.addColorStop(0.18, 'rgba(255,180,80,0.55)');
  g.addColorStop(0.42, 'rgba(255,140,60,0.22)');
  g.addColorStop(0.75, 'rgba(255,110,40,0.06)');
  g.addColorStop(1.00, 'rgba(255,90,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(TEX_KEY, c);
  _ready = true;
}

/**
 * Attach dynamic lights to the scene based on current game state.
 * Called from WorldScene.update on a slow cadence (~every 30 frames).
 */
export function refreshDynamicLights(scene) {
  ensureDynamicLightTexture(scene);
  if (!scene._dynLights) scene._dynLights = new Map();

  const wanted = collectWantedLights();

  // Remove lights that no longer exist
  for (const [key, light] of scene._dynLights) {
    if (!wanted.has(key)) {
      light.sprite.destroy();
      scene._dynLights.delete(key);
    }
  }

  // Add / update active lights
  for (const [key, def] of wanted) {
    let entry = scene._dynLights.get(key);
    if (!entry) {
      const tex = scene.textures.exists(TEX_KEY) ? TEX_KEY : 'fx_light';
      const sprite = scene.add.image(def.x, def.y, tex)
        .setBlendMode('ADD')
        .setDepth(3850)
        .setScrollFactor(1)
        .setScale(def.scale);
      entry = { sprite, def };
      scene._dynLights.set(key, entry);
    } else {
      entry.sprite.setPosition(def.x, def.y);
      entry.sprite.setScale(def.scale);
      entry.def = def;
    }
  }
}

/** Compute which dynamic lights should exist right now. */
function collectWantedLights() {
  const out = new Map();
  const S = GameState.s;
  if (!S) return out;

  // 1. Campfires / hearths in the settlement
  if (S.settlement?.buildings) {
    for (const b of S.settlement.buildings) {
      if (!b.complete) continue;
      const isFire = b.key === 'campfire' || b.key === 'hearth' || b.key === 'forge';
      if (!isFire) continue;
      const k = `bld:${b.uid}`;
      out.set(k, { x: b.x, y: b.y - 8, scale: b.key === 'forge' ? 2.4 : 1.8, kind: 'fire' });
    }
  }

  // 2. Player's equipped torch (off-hand or charm slot)
  const offhandId = S.player.equipment?.offhand?.id;
  if (offhandId && /torch/i.test(offhandId)) {
    const p = GameState._playerWorldXY;
    if (p) {
      out.set('player:torch', { x: p.x, y: p.y - 4, scale: 1.4, kind: 'torch' });
    }
  }

  return out;
}

/** Helper: world position update channel for player-following lights. */
GameState._playerWorldXY = GameState._playerWorldXY || { x: 0, y: 0 };
Bus.on('player-pos', (xy) => {
  if (xy && typeof xy.x === 'number') {
    GameState._playerWorldXY.x = xy.x;
    GameState._playerWorldXY.y = xy.y;
  }
});