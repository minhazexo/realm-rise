// ─────────────────────────────────────────────────────────────────────────────
// SettingsSystem (spec §59): the single source of truth for applying user
// preferences. React panels mutate state.settings; every consumer (audio,
// DOM, Phaser) reads through the helpers here so we never re-import modules
// at render time, never write to localStorage on every slider tick, and never
// forget to publish changes to live systems.
//
// Layering:
//   1. defaults      — code-defined fallbacks
//   2. user prefs    — localStorage, applied even when no save exists
//   3. game settings — current save file (overrides prefs when present)
//   applySettings()  — the only place DOM / bus side-effects happen
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { CH, Bus } from '../core/EventBus.js';
import { AUTOSAVE_INTERVAL_SEC } from '../core/Constants.js';

export const SETTINGS_VERSION = 1;

// Keys that live in the persistent save file (`state.settings`).
export const SAVE_SETTINGS_KEYS = [
  'difficulty',
  'volumes',
  'toggles',
  'keybinds',
  'uiScale',
  'textSize',
  'particles',
  'shadows',
  'autosave',
  'autosaveSec',
  'movementScheme',
  'graphicsQuality',
  'distanceFog',
  'fpsCap'
];

// Keys that also live in `rotr_prefs_v1` so they survive browser restarts
// even with no save. Defaults layer wins if a value is undefined.
const PREFS_KEY = 'rotr_prefs_v1';

/**
 * Default key bindings (Phaser KeyCodes names). WASD + arrows are always
 * active as movement fallbacks; these add the player's own alternatives.
 * Actions are bound exclusively to these codes.
 */
export const KEYBINDS_DEFAULT = Object.freeze({
  up: 'W', down: 'S', left: 'A', right: 'D',
  dodge: 'SPACE', sprint: 'SHIFT',
  gather: 'E', inventory: 'I', crafting: 'C', map: 'M',
  journal: 'J', kingdom: 'K', build: 'B', skills: 'P', pause: 'ESC',
});

/** Validate a single KeyCodes name (letters/digits/underscore, short). */
export function validKeyCodeName(name) {
  return typeof name === 'string' && /^[A-Z0-9_]{1,12}$/.test(name);
}

/** Code-defined defaults — also the schema every UI control binds to. */
export const SETTINGS_DEFAULTS = Object.freeze({
  difficulty: 'normal',
  volumes: { master: 0.8, music: 0.55, sfx: 0.85 },
  toggles: {
    musicOn: true,
    sfxOn: true,
    screenShake: true,
    reducedMotion: false,
    photosensitive: false,
    damageNumbers: true,
    hpBarsAbove: true,
    colorblindHints: false
  },
  uiScale: 1,           // 0.8 – 1.4
  textSize: 1,          // 0.85 – 1.4 (font-size multiplier)
  particles: 'high',    // 'off' | 'low' | 'med' | 'high'
  shadows: true,
  autosave: true,
  autosaveSec: AUTOSAVE_INTERVAL_SEC,  // 100s default
  movementScheme: 'wasd', // 'wasd' | 'arrows'
  /** Master graphics preset — drives PostFXSystem + fog + particles.
   *  'low' | 'med' | 'high' | 'ultra'. */
  graphicsQuality: 'med',
  /** FPS cap: 0 = display default (uncapped), else 30/60/120. */
  fpsCap: 0,
  /** Distance fog (atmospheric perspective) on chunk terrain. */
  distanceFog: true,
  /** TEST ONLY — when true, the player cannot die. Survival drains are paused
   *  and incoming damage is treated as 1 hp-tick of scratch damage. Never save
   *  this as true in a shipped release. */
  immortal: false,
  /** Player key bindings (KeyCodes names). See KEYBINDS_DEFAULT. */
  keybinds: { ...KEYBINDS_DEFAULT },
});

/** Allowed ranges / sets, used by the panel for clamping and validation. */
export const SETTINGS_LIMITS = Object.freeze({
  uiScale:   { min: 0.8, max: 1.4, step: 0.05 },
  textSize:  { min: 0.85, max: 1.4, step: 0.05 },
  autosaveSec: { min: 30, max: 600, step: 10 },
  particles: { allowed: ['off', 'low', 'med', 'high'] },
  fpsCap: { allowed: [0, 30, 60, 120] },
  movementScheme: { allowed: ['wasd', 'arrows'] },
  difficulty: { allowed: ['story', 'normal', 'hard', 'legendary'] },
  graphicsQuality: { allowed: ['low', 'med', 'high', 'ultra'] }
});

/* ── Validation ─────────────────────────────────────────────────────────── */

/** Top-level scalar (non-nested) settings keys. Anything outside this list
 *  is treated as a nested object (volumes, toggles) or a future generic
 *  field. If you add a new boolean/string/number setting, add it here too. */
const SCALAR_KEYS = [
  'difficulty', 'uiScale', 'textSize', 'particles', 'shadows',
  'autosave', 'autosaveSec', 'movementScheme', 'graphicsQuality',
  'distanceFog', 'immortal', 'fpsCap'
];

/**
 * Normalise a settings object against the defaults. Strips unknown keys,
 * clamps out-of-range values, fills missing fields. Returns a NEW object so
 * callers can mutate safely.
 */
export function normaliseSettings(input) {
  const out = deepClone(SETTINGS_DEFAULTS);
  if (!input || typeof input !== 'object') return out;
  for (const k of SCALAR_KEYS) {
    if (input[k] === undefined) continue;
    out[k] = clampScalar(k, input[k]);
  }
  if (input.volumes && typeof input.volumes === 'object') {
    for (const vk of ['master', 'music', 'sfx']) {
      const v = Number(input.volumes[vk]);
      if (Number.isFinite(v)) out.volumes[vk] = Math.max(0, Math.min(1, v));
    }
  }
  if (input.toggles && typeof input.toggles === 'object') {
    for (const tk of Object.keys(SETTINGS_DEFAULTS.toggles)) {
      if (typeof input.toggles[tk] === 'boolean') out.toggles[tk] = input.toggles[tk];
    }
  }
  if (input.keybinds && typeof input.keybinds === 'object') {
    for (const bk of Object.keys(KEYBINDS_DEFAULT)) {
      if (validKeyCodeName(input.keybinds[bk])) out.keybinds[bk] = input.keybinds[bk];
    }
  }
  return out;
}

/* ── Apply: the only place side-effects happen ───────────────────────────── */

let _installed = false;
let _lastApplied = null;

/**
 * Apply the given (normalised) settings to the DOM, audio bus, and game bus.
 * Safe to call repeatedly and before any state exists.
 *
 * @param {object} settings - already-normalised settings object
 * @param {object} [opts]
 * @param {boolean} [opts.busNotify=true] - emit CH.SETTINGS / 'refresh-ui'
 * @param {boolean} [opts.persistPrefs=true] - mirror to localStorage prefs
 * @param {boolean} [opts.audio=true] - reapply audio bus gain values
 */
export function applySettings(settings, opts = {}) {
  const { busNotify = true, persistPrefs: shouldPersist = true, audio = true } = opts;
  const s = normaliseSettings(settings);
  _lastApplied = s;

  // ── DOM side-effects ────────────────────────────────────────────────
  if (typeof document !== 'undefined') {
    const root = document.getElementById('root') || document.body;
    root.style.setProperty('--ui-scale', String(s.uiScale));
    root.style.setProperty('--text-scale', String(s.textSize));
    // Reduced motion: set on <html> so global CSS can opt out of keyframes.
    document.documentElement.dataset.reducedMotion = s.toggles.reducedMotion ? '1' : '0';
    document.documentElement.dataset.colorblindHints = s.toggles.colorblindHints ? '1' : '0';
    document.documentElement.dataset.photosensitive = s.toggles.photosensitive ? '1' : '0';
    // Body-level class for quality presets (toggled consumers can read this).
    document.body.dataset.particles = s.particles;
    document.body.dataset.movement = s.movementScheme;
  }

  // ── Audio bus side-effects ──────────────────────────────────────────
  if (audio) {
    import('./AudioSystem.js').then((a) => {
      try { a.applyVolumes(); } catch (err) { console.warn('[settings] applyVolumes failed', err); }
    }).catch(() => { /* audio module not yet loaded */ });
  }

  // ── Persistence ─────────────────────────────────────────────────────
  if (shouldPersist) persistPrefs(s);

  // ── Bus notify (React + Phaser listeners) ───────────────────────────
  if (busNotify && typeof Bus !== 'undefined') {
    Bus.emit(CH.SETTINGS);
    Bus.emit('settings-applied', s);
    Bus.emit('refresh-ui');
  }
  return s;
}

/**
 * Idempotent install: subscribes to CH.SETTINGS so any change to
 * GameState.s.settings re-applies (audio, DOM). Called once from createGame.
 */
export function installSettingsSystem() {
  if (_installed) return;
  _installed = true;
  Bus.on(CH.SETTINGS, () => {
    const s = GameState.s?.settings;
    if (s) applySettings(s);
  });
}

/* ── Mutators (single entry points from React) ─────────────────────────── */

// Module-level cache used when no game state exists yet (main menu before
// newGame). This lets the settings panel work fully from the main menu
// without polluting GameState. When a save loads, withPrefs() will merge
// browser prefs over the save's settings.
let _menuCache = null;

/** Read the current settings, falling back to a menu cache if no save is loaded. */
export function currentSettings() {
  if (GameState.s?.settings) return GameState.s.settings;
  if (_menuCache) return _menuCache;
  _menuCache = deepClone(SETTINGS_DEFAULTS);
  return _menuCache;
}

/**
 * Merge `patch` into the live settings, then re-apply. The mutator is given
 * a deep-cloned settings object so the patcher can mutate freely.
 *
 * Safe to call from the main menu before a save exists: the patch lands in
 * a transient module-level cache that is also persisted to browser prefs.
 * When a save later loads, withPrefs() picks up those prefs.
 */
export function updateSettings(patch) {
  let cur;
  if (GameState.s?.settings) {
    cur = GameState.s.settings;
  } else {
    if (!_menuCache) _menuCache = deepClone(SETTINGS_DEFAULTS);
    cur = _menuCache;
  }
  const merged = { ...cur, ...patch };
  if (patch.volumes) merged.volumes = { ...cur.volumes, ...patch.volumes };
  if (patch.toggles) merged.toggles = { ...cur.toggles, ...patch.toggles };
  if (patch.keybinds) merged.keybinds = { ...cur.keybinds, ...patch.keybinds };
  const normalised = normaliseSettings(merged);
  if (GameState.s) GameState.s.settings = normalised;
  _menuCache = normalised;
  applySettings(normalised);
  return normalised;
}

/** Replace all settings with the canonical defaults (and re-apply). */
export function resetSettings() {
  const fresh = deepClone(SETTINGS_DEFAULTS);
  if (GameState.s) GameState.s.settings = fresh;
  _menuCache = fresh;
  applySettings(fresh);
  return fresh;
}

/** Used by main.js after a save loads: drop the menu cache so we read from
 *  the save's settings going forward. */
export function clearMenuCache() { _menuCache = null; }

/** Merge browser-level prefs (uiScale, textSize, volumes, reducedMotion) over
 *  the supplied base settings. Used at boot before a save is loaded, and
 *  again on newGame/load to overlay prefs on the freshly-restored settings. */
export function withPrefs(settings) {
  const prefs = loadPrefs();
  const merged = deepClone(settings || SETTINGS_DEFAULTS);
  // Menu-time cache wins over save defaults: if the player tweaked something
  // at the main menu, that's what they want to carry into the run.
  if (_menuCache) {
    merged.uiScale = _menuCache.uiScale ?? merged.uiScale;
    merged.textSize = _menuCache.textSize ?? merged.textSize;
    merged.volumes = { ...merged.volumes, ..._menuCache.volumes };
    merged.toggles = { ...merged.toggles, ..._menuCache.toggles };
    merged.particles = _menuCache.particles ?? merged.particles;
    merged.shadows = _menuCache.shadows ?? merged.shadows;
    merged.uiScale = _menuCache.uiScale;
  }
  if (prefs.uiScale != null)  merged.uiScale  = prefs.uiScale;
  if (prefs.textSize != null) merged.textSize = prefs.textSize;
  if (prefs.volumes) merged.volumes = { ...merged.volumes, ...prefs.volumes };
  if (prefs.toggles) merged.toggles = { ...merged.toggles, ...prefs.toggles };
  return normaliseSettings(merged);
}

/** Read what was last applied (useful for HUD display + tests). */
export function lastApplied() { return _lastApplied ? deepClone(_lastApplied) : null; }

/* ── Live accessors used by other systems ───────────────────────────────── */

/** Cheap read of a single setting, falling back to default. */
export function getSetting(key) {
  const live = GameState.s?.settings?.[key];
  if (live !== undefined) return live;
  return SETTINGS_DEFAULTS[key];
}

/** Is screen shake currently disabled by user preference? */
export function screenShakeEnabled() {
  const s = GameState.s?.settings;
  return !s || s.toggles?.screenShake !== false;
}

/** Should we apply extra camera shake at all this frame? Respects reducedMotion. */
export function shakeAllowed() {
  const s = GameState.s?.settings;
  if (!s) return true;
  if (s.toggles?.screenShake === false) return false;
  if (s.toggles?.reducedMotion === true) return false;
  if (s.toggles?.photosensitive === true) return false;
  return true;
}

/**
 * Phase C photosensitivity mode: kills fullscreen flashes, chromatic
 * aberration, bloom pulses and shake. Target-only hit tints stay (they
 * carry hit-confirm information without strobing the screen).
 */
export function photosensitiveMode() {
  const s = GameState.s?.settings;
  if (!s) return false;
  return s.toggles?.photosensitive === true;
}

/** Particle quality multiplier (0 = off). */
export function particleMultiplier() {
  const map = { off: 0, low: 0.35, med: 0.7, high: 1 };
  const p = GameState.s?.settings?.particles || 'high';
  return map[p] ?? 1;
}

/** Are ground shadows enabled? */
export function shadowsEnabled() {
  const s = GameState.s?.settings;
  if (!s) return true;
  return s.shadows !== false;
}

/** Resolve movement key set for the current scheme (always falls back). */
export function movementKey() {
  return GameState.s?.settings?.movementScheme || 'wasd';
}

/** Test-only god mode. When true the player cannot die — damage is clamped to
 *  a single hp-tick of scratch damage and survival drains are skipped. */
export function isImmortal() {
  return GameState.s?.settings?.immortal === true;
}
function clampScalar(key, raw) {
  const lim = SETTINGS_LIMITS[key];
  if (!lim) return raw;
  if (lim.allowed) return lim.allowed.includes(raw) ? raw : SETTINGS_DEFAULTS[key];
  if (lim.min != null && lim.max != null) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return SETTINGS_DEFAULTS[key];
    return Math.max(lim.min, Math.min(lim.max, n));
  }
  return raw;
}

function deepClone(o) {
  if (o == null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(deepClone);
  const out = {};
  for (const k of Object.keys(o)) out[k] = deepClone(o[k]);
  return out;
}

/* ── Browser-level prefs (no save required) ─────────────────────────────── */

function loadPrefs() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

let prefsSaveTimer = null;
/** Persist a small subset of settings that should survive without a save. */
export function persistPrefs(settings) {
  if (typeof localStorage === 'undefined') return;
  if (prefsSaveTimer) clearTimeout(prefsSaveTimer);
  prefsSaveTimer = setTimeout(() => {
    try {
      const subset = {
        uiScale: settings.uiScale,
        textSize: settings.textSize,
        volumes: settings.volumes,
        toggles: {
          musicOn: settings.toggles.musicOn,
          sfxOn: settings.toggles.sfxOn,
          reducedMotion: settings.toggles.reducedMotion
        }
      };
      localStorage.setItem(PREFS_KEY, JSON.stringify({ v: SETTINGS_VERSION, ...subset }));
    } catch { /* quota */ }
  }, 250);
}