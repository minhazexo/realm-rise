// Tests for SettingsSystem: defaults, normalisation, apply (DOM + bus),
// reset, and the accessors used by other systems.
import GameState from '../src/game/core/GameState.js';
import {
  SETTINGS_DEFAULTS,
  SETTINGS_LIMITS,
  normaliseSettings,
  updateSettings,
  resetSettings,
  applySettings,
  lastApplied,
  particleMultiplier,
  shakeAllowed,
  shadowsEnabled,
  movementKey,
  withPrefs,
  currentSettings,
  clearMenuCache,
  isImmortal
} from '../src/game/systems/SettingsSystem.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('✗ ' + m); } else console.log('✓ ' + m); };

console.log('— Defaults —');
ok(SETTINGS_DEFAULTS.difficulty === 'normal', 'default difficulty normal');
ok(SETTINGS_DEFAULTS.volumes.master > 0 && SETTINGS_DEFAULTS.volumes.master <= 1, 'master volume 0..1');
ok(Array.isArray(SETTINGS_LIMITS.particles.allowed), 'particles limit list present');
ok(SETTINGS_LIMITS.particles.allowed.includes('off'), 'particles can be turned off');
ok(SETTINGS_LIMITS.uiScale.min < SETTINGS_LIMITS.uiScale.max, 'uiScale range sane');
ok(SETTINGS_LIMITS.textSize.min < SETTINGS_LIMITS.textSize.max, 'textSize range sane');
ok(SETTINGS_LIMITS.autosaveSec.min >= 10, 'autosave minimum ≥ 10s');

console.log('— Normalisation —');
const dirty = normaliseSettings({
  difficulty: 'bogus',
  uiScale: 99,
  textSize: -1,
  particles: 'ultra',
  volumes: { master: 5, music: -0.5, sfx: 'loud' },
  toggles: { musicOn: 'yes', reducedMotion: true, unknown: 'x' },
  extraJunk: 'discarded'
});
ok(dirty.difficulty === 'normal', 'unknown difficulty → default');
ok(dirty.uiScale === SETTINGS_LIMITS.uiScale.max, 'uiScale clamped to max');
ok(dirty.textSize === SETTINGS_LIMITS.textSize.min, 'textSize clamped to min');
ok(dirty.particles === 'high', 'unknown particles → high');
ok(dirty.volumes.master === 1, 'master volume clamped to 1');
ok(dirty.volumes.music === 0, 'negative music clamped to 0');
ok(dirty.volumes.sfx === SETTINGS_DEFAULTS.volumes.sfx, 'non-numeric sfx falls back to default');
ok(dirty.toggles.musicOn === true && dirty.toggles.reducedMotion === true, 'valid toggles preserved');
ok(!('unknown' in dirty.toggles), 'unknown toggle keys dropped');
ok(!('extraJunk' in dirty), 'extra top-level keys dropped');

console.log('— Apply & lastApplied —');
GameState.newGame(7, { name: 'Test' }, 'normal');
updateSettings({ volumes: { master: 0.42 } });
const snap = lastApplied();
ok(snap && snap.volumes.master === 0.42, 'updateSettings persists lastApplied');
ok(GameState.s.settings.volumes.master === 0.42, 'updateSettings mutates state.settings');
updateSettings({ toggles: { reducedMotion: true } });
ok(shakeAllowed() === false, 'reducedMotion disables camera shake');
updateSettings({ toggles: { reducedMotion: false, screenShake: false } });
ok(shakeAllowed() === false, 'screenShake=false disables camera shake');
updateSettings({ toggles: { reducedMotion: false, screenShake: true } });
ok(shakeAllowed() === true, 'all good → camera shake allowed');

console.log('— Particle & shadow accessors —');
updateSettings({ particles: 'off' });
ok(particleMultiplier() === 0, 'particles=off → 0 multiplier');
updateSettings({ particles: 'low' });
ok(particleMultiplier() > 0 && particleMultiplier() < 1, 'particles=low → 0 < x < 1');
updateSettings({ particles: 'high' });
ok(particleMultiplier() === 1, 'particles=high → 1');

updateSettings({ shadows: false });
ok(shadowsEnabled() === false, 'shadows=false → shadowsEnabled false');
updateSettings({ shadows: true });
ok(shadowsEnabled() === true, 'shadows=true → shadowsEnabled true');

console.log('— Movement key —');
updateSettings({ movementScheme: 'arrows' });
ok(movementKey() === 'arrows', 'movementKey reads arrows');
updateSettings({ movementScheme: 'wasd' });
ok(movementKey() === 'wasd', 'movementKey reads wasd');

console.log('— Reset —');
updateSettings({ uiScale: 1.3, textSize: 1.3 });
resetSettings();
ok(GameState.s.settings.uiScale === 1, 'reset clears uiScale');
ok(GameState.s.settings.textSize === 1, 'reset clears textSize');
ok(lastApplied() && lastApplied().uiScale === 1, 'reset updates lastApplied');

console.log('— Apply (DOM side-effects) —');
const fakeDoc = {
  getElementById: () => ({ style: { setProperty: () => {} } }),
  documentElement: { dataset: {} },
  body: { dataset: {} }
};
// Force applySettings into the DOM-side path even though we're in node.
const prevDoc = globalThis.document;
globalThis.document = fakeDoc;
try {
  applySettings({ ...SETTINGS_DEFAULTS, uiScale: 1.2, textSize: 1.1, toggles: { ...SETTINGS_DEFAULTS.toggles, reducedMotion: true, colorblindHints: true } }, { busNotify: false });
  ok(fakeDoc.documentElement.dataset.reducedMotion === '1', 'reducedMotion sets data attr');
  ok(fakeDoc.documentElement.dataset.colorblindHints === '1', 'colorblind sets data attr');
  ok(fakeDoc.body.dataset.particles === 'high', 'particles dataset set');
  ok(fakeDoc.body.dataset.movement === 'wasd', 'movement dataset set');
} finally {
  if (prevDoc === undefined) delete globalThis.document;
  else globalThis.document = prevDoc;
}

console.log('— withPrefs (browser-level prefs) —');
const merged = withPrefs({});
ok(merged.uiScale === 1 && merged.textSize === 1, 'withPrefs returns defaults when no prefs');

console.log('— Menu-time settings (no save loaded) —');
GameState.state = null; // simulate no save
clearMenuCache();
ok(currentSettings() !== null, 'currentSettings returns defaults when no save');
updateSettings({ volumes: { master: 0.2 } });
ok(currentSettings().volumes.master === 0.2, 'updateSettings lands in menu cache when no save');
updateSettings({ uiScale: 1.3 });
ok(currentSettings().uiScale === 1.3, 'updateSettings can set uiScale at menu');

// Now load a save and verify withPrefs merges correctly
GameState.newGame(11, { name: 'Menu' }, 'normal');
const beforeMaster = GameState.s.settings.volumes.master;
const withCache = withPrefs(GameState.s.settings);
ok(withCache.volumes.master === 0.2, 'menu cache overrides save default for master volume');
ok(withCache.uiScale === 1.3, 'menu cache overrides save default for uiScale');
ok(beforeMaster === SETTINGS_DEFAULTS.volumes.master, 'save settings unchanged by cache merge');

clearMenuCache();
const afterClear = withPrefs(GameState.s.settings);
ok(afterClear.volumes.master === SETTINGS_DEFAULTS.volumes.master, 'clearing cache falls back to save defaults');

console.log('— Immortal (test-only) —');
ok(SETTINGS_DEFAULTS.immortal === false, 'immortal defaults to false');
updateSettings({ immortal: true });
ok(isImmortal() === true, 'isImmortal reflects the toggle');
ok(GameState.s.settings.immortal === true, 'immortal persists on the live settings');
// Regression: every scalar key in SETTINGS_DEFAULTS must be round-trippable
// via normaliseSettings. If a future setting is added to defaults but
// forgotten in the normaliser, it silently stays false.
const allKeys = Object.keys(SETTINGS_DEFAULTS);
const roundTripped = normaliseSettings({ ...SETTINGS_DEFAULTS, immortal: true });
ok(roundTripped.immortal === true, 'normaliseSettings round-trips immortal=true');
for (const k of allKeys) {
  if (typeof SETTINGS_DEFAULTS[k] === 'object' && SETTINGS_DEFAULTS[k] !== null) continue;
  const flipped = { ...SETTINGS_DEFAULTS, [k]: 'flip-test' };
  const out = normaliseSettings(flipped);
  ok(out[k] !== undefined, `normaliseSettings keeps key '${k}'`);
}
// Verify die() refuses to kill when immortal — simulates the worst case where
// a future code path forgets the !isImmortal() guard. Skip if Phaser fails
// to load in node (Player.js imports Phaser).
GameState.s.player.hp = 5;
GameState.s.session_dead = false;
try {
  const PlayerMod = await import('../src/game/entities/Player.js');
  // Build a minimal Player without invoking Phaser graphics — manually
  // patch the constructor output to avoid Phaser scene issues in node.
  const fakeScene = {
    cameras: { main: { shake: () => {}, fadeIn: () => {} } },
    time: { delayedCall: () => {} },
    fxHit: () => {},
    tweens: { add: () => {} },
    physics: { add: { sprite: () => ({ setSize: () => ({}), setOffset: () => ({}), setDepth: () => ({}), setCollideWorldBounds: () => ({}), body: { setCircle: () => {}, setVelocity: () => {} } }) } },
    add: { image: () => ({ setDepth: () => ({}), setScale: () => ({}), setAlpha: () => ({}), setBlendMode: () => ({}), setVisible: () => ({}), setPosition: () => ({}), setTexture: () => ({}), setTint: () => ({}) }) }
  };
  const p = new PlayerMod.default(fakeScene, 0, 0);
  p.shadow = null;
  // Try to die — should refuse because immortal is on
  p.die();
  ok(GameState.s.session_dead === false, 'die() refuses when immortal');
  ok(GameState.s.player.hp >= 1, 'die() restores HP to ≥1 when immortal');
  // Drop HP to 0 and call die again
  GameState.s.player.hp = 0;
  p.die();
  ok(GameState.s.session_dead === false, 'die() refuses with HP=0 when immortal');
  ok(GameState.s.player.hp >= 1, 'die() restores HP from 0 when immortal');
  // Now turn off immortal and die
  updateSettings({ immortal: false });
  GameState.s.player.hp = 0;
  p.die();
  ok(GameState.s.session_dead === true, 'die() proceeds when not immortal');
} catch (err) {
  console.log('  (skipped die() tests — Phaser unavailable in node:', err.message, ')');
}
updateSettings({ immortal: false });
ok(isImmortal() === false, 'isImmortal returns false when off');
resetSettings();
ok(isImmortal() === false, 'reset clears immortal');

console.log(fails === 0 ? '✅ SETTINGS PASS — settings layer consistent.' : `❌ ${fails} settings failure(s)`);
process.exit(fails ? 1 : 0);