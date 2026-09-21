// Tests for AmbientParticles: world-anchored emitters, quality gating,
// reduced-motion teardown, and the bird burst argument fix.
import GameState from '../src/game/core/GameState.ts';
import { updateSettings } from '../src/game/systems/SettingsSystem.ts';
import { setWorldSeed, biomeAt } from '../src/game/world/worldGen.ts';
import { updateAmbientParticles, destroyAmbientParticles } from '../src/game/systems/AmbientParticles.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('✗ ' + m); } else console.log('✓ ' + m); };

// ── Fake scene: records emitter creation/teardown without Phaser ────────────
const created = [];
const destroyed = [];
let explodeArgs = null;
function makeEmitter() {
  const em = {
    setDepth() { return em; }, setScrollFactor(value) { em.scrollFactor = value; return em; },
    setBlendMode() { return em; }, setAlpha() { return em; },
    explode(...args) { explodeArgs = args; },
    destroy() { destroyed.push(em); }
  };
  return em;
}
function makeScene(px, py) {
  return {
    player: { sprite: { x: px, y: py } },
    scale: { width: 800, height: 600 },
    textures: { exists: () => true },
    cameras: { main: { worldView: { x: 0, y: 0, width: 800, height: 600 } } },
    add: { particles: (_x, _y, key, cfg) => { const em = makeEmitter(); created.push({ key, cfg, em }); return em; } }
  };
}

console.log('— AmbientParticles —');
GameState.newGame(42, { name: 'Ambient' }, 'normal');
ok(typeof GameState.s === 'object' && GameState.s !== null, 'game state exists in node');
setWorldSeed(42);

// Find a forest tile for the leaf tests (deterministic for a fixed seed).
let forest = null;
outer: for (let x = -24000; x <= 24000; x += 512) {
  for (let y = -24000; y <= 24000; y += 512) {
    if (biomeAt(x, y) === 'forest') { forest = { x, y }; break outer; }
  }
}
ok(!!forest, 'a forest biome exists on the seed-42 map');

updateSettings({ particles: 'high', toggles: { reducedMotion: false } });

// 1. Day pollen is world-anchored (onEmit camera bounds + scrollFactor 1).
const plainsScene = makeScene(0, 260);
updateAmbientParticles(plainsScene, 0, 16);
const pollen = created.find((c) => c.key === 'pt_spark');
ok(!!pollen, 'pollen emitter created on plains by day');
ok(pollen && typeof pollen.cfg.x?.onEmit === 'function', 'pollen x/y sample camera bounds on emit');
ok(pollen?.em.scrollFactor === 1, 'pollen stays anchored in world space');

// 2. Wooded biome gets the falling-leaf emitter with a particle cap.
if (forest) {
  const forestScene = makeScene(forest.x, forest.y);
  updateAmbientParticles(forestScene, 0, 16);
  const leaves = created.find((c) => c.key === 'pt_leaf');
  ok(!!leaves, 'leaf emitter created in forest');
  ok(leaves && leaves.cfg.maxParticles === Math.ceil(16 * 1), 'leaf emitter honours maxParticles cap');
  ok(leaves && typeof leaves.cfg.y?.onEmit === 'function', 'leaf spawn follows camera worldView');
}

// 3. Bird emitter is explode-only (no auto flow) with a hard particle cap.
updateAmbientParticles(plainsScene, 9500, 16);
const bird = created.find((c) => c.key === 'menu_bird_f1');
ok(!!bird && bird.cfg.frequency === -1, 'bird emitter is explode-only (frequency -1)');
ok(!!bird && bird.cfg.maxParticles === 6, 'bird emitter caps alive particles');
ok(explodeArgs !== null && explodeArgs[0] <= 3 && explodeArgs[1] === -30,
  'bird burst passes (count, x, y) — not width-as-count');

// 4. Reduced motion tears everything down; re-enable rebuilds.
destroyed.length = 0;
updateSettings({ toggles: { reducedMotion: true } });
updateAmbientParticles(plainsScene, 10000, 16);
ok(destroyed.length >= 2, 'reducedMotion tears down pollen + bird emitters');
created.length = 0;
updateSettings({ toggles: { reducedMotion: false } });
updateAmbientParticles(plainsScene, 11000, 16);
ok(created.some((c) => c.key === 'pt_spark'), 'ambient emitters rebuild after reduced motion off');

// 5. particles=off kills everything and nothing new spawns.
destroyed.length = 0;
updateSettings({ particles: 'off' });
updateAmbientParticles(plainsScene, 11000, 16);
ok(destroyed.length >= 1, 'particles=off destroys active emitters');
const before = created.length;
updateAmbientParticles(plainsScene, 12000, 16);
ok(created.length === before, 'particles=off creates no new emitters');

// 6. Cleanup helper resets module state without throwing.
destroyAmbientParticles();
ok(true, 'destroyAmbientParticles safe to call');

console.log(fails === 0 ? '✅ AMBIENT PASS — atmosphere emitters verified.' : `❌ AMBIENT FAIL — ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
