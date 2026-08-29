// ─────────────────────────────────────────────────────────────────────────────
// AudioSystem (spec §44): procedural WebAudio. SFX from audioSfx.js library +
// a small generative ambient music engine with mood crossfades. No assets.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';
import { SFX_LIBRARY, setCtx } from './audioSfx.js';
import { initAmbient, setAmbientVolume, stopAmbient, updateAmbient as _updateAmbient } from './ambientSounds.js';

let ctx = null;
let masterGain, musicGain, comp, limiter;
let currentMood = null;
let started = false;

function createAudioContext() {
  // Reuse a single AudioContext across HMR / hot-reloads. Without this, every
  // hot update created a NEW context whose generative music loop kept playing —
  // stacking "zombie" contexts that all droned at once (the persistent sound).
  const stash = (typeof window !== 'undefined') && window.__RISE_AUDIO__;
  if (stash && stash.ctx) {
    ctx = stash.ctx;
    masterGain = stash.masterGain;
    musicGain = stash.musicGain;
    comp = stash.comp;
    limiter = stash.limiter;
    ctx._sfxGain = stash.sfxGain;
    setCtx(ctx);
    started = true;
    applyVolumes();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  musicGain = ctx.createGain();
  ctx._sfxGain = ctx.createGain();
  // Master bus: sfx + music → gentle glue compressor → brickwall limiter → out.
  // This keeps overlapping sounds from clipping and adds fullness (spec §44).
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 20;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.16;
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 2;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;

  ctx._sfxGain.connect(masterGain);
  musicGain.connect(masterGain);
  masterGain.connect(comp);
  comp.connect(limiter);
  limiter.connect(ctx.destination);
  setCtx(ctx);
  initAmbient(ctx, masterGain);
  applyVolumes();
  started = true;
  if (typeof window !== 'undefined') {
    window.__RISE_AUDIO__ = { ctx, masterGain, musicGain, comp, limiter, sfxGain: ctx._sfxGain };
  }
}

/** Defer AudioContext creation until first user gesture (Chrome autoplay policy). */
export function initAudio() {
  if (started) return true;
  const tryStartMenu = () => {
    if (!started) return;
    if (ctx?.state === 'suspended') {
      ctx.resume().then(() => setMenuMood()).catch(() => setTimeout(tryStartMenu, 400));
    } else {
      setMenuMood();
    }
  };
  const unlock = () => {
    try {
      if (!started) createAudioContext();
      tryStartMenu();
    } catch { /* no audio available */ }
    document.removeEventListener('click', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
    // retry once shortly after — covers the edge where resume() is still pending
    setTimeout(tryStartMenu, 500);
  };
  document.addEventListener('click', unlock, { once: false });
  document.addEventListener('keydown', unlock, { once: false });
  document.addEventListener('touchstart', unlock, { once: false });
  return true; // audio will init on first gesture
}

export function resumeAudio() {
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

export function applyVolumes() {
  if (!masterGain) return;
  const v = GameState.s?.settings.volumes || { master: 0.8, music: 0.55, sfx: 0.85 };
  const t = GameState.s?.settings.toggles || {};
  masterGain.gain.value = v.master * (t.musicOn === false && t.sfxOn === false ? 0 : 1);
  musicGain.gain.value = t.musicOn === false ? 0 : v.music * 0.5;
  ctx._sfxGain.gain.value = t.sfxOn === false ? 0 : v.sfx;
  setAmbientVolume(t.musicOn === false ? 0 : (v.music || 0.55) * 0.35);
}

export function playSfx(name) {
  if (!started || GameState.s?.settings.toggles?.sfxOn === false) return;
  try {
    SFX_LIBRARY[name]?.();
  } catch {
    /* never crash on audio */
  }
}
export const hasSfx = (name) => !!SFX_LIBRARY[name];

/* ── Generative mood music ─────────────────────────────────────────────── */
/** Apply a semitone offset to a frequency. */
const semiToHz = (freq, semi) => freq * Math.pow(2, semi / 12);

function drumTick(t0) {
  const len = Math.floor(ctx.sampleRate * 0.08);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 5));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.frequency.value = 140;
  const g = ctx.createGain();
  g.gain.value = 0.5;
  src.connect(filt).connect(g).connect(musicGain);
  src.start(t0);
}

/* ── Menu ambient music engine ────────────────────────────────────────────
   A gentle, spacious and soothing generative piece: warm add9 pads swelling
   in slowly, a soft low bass, and sparse high "sparkle" notes. Crossfades
   each pad into the next so the result feels continuous and calming. */

// lush pad voice with slow attack, dual detuned oscillators (chorus), and a
// slow release so consecutive chords melt into one another.
// `at` is seconds offset from ctx.currentTime (for bar scheduling).
function padVoice(rootHz, semi, dur, peak, at = 0) {
  const t0 = ctx.currentTime + at;
  const freq = semiToHz(rootHz, semi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + Math.min(2.2, dur * 0.45));
  g.gain.setValueAtTime(peak, t0 + dur * 0.72);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 1.8);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = freq;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 1.004; // gentle detune for width
  const osc3 = ctx.createOscillator();
  osc3.type = 'triangle';
  osc3.frequency.value = freq * 0.5;   // soft low sub-overtone for warmth
  osc3.detune.value = -6;

  const gain2 = ctx.createGain();
  gain2.gain.value = 0.5;
  const gain3 = ctx.createGain();
  gain3.gain.value = 0.22;

  osc1.connect(g);
  osc2.connect(gain2).connect(g);
  osc3.connect(gain3).connect(g);

  if (musicReverb) {
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    g.connect(wet).connect(musicReverb);
  }
  g.connect(musicGain);

  osc1.start(t0); osc2.start(t0); osc3.start(t0);
  osc1.stop(t0 + dur + 2.2); osc2.stop(t0 + dur + 2.2); osc3.stop(t0 + dur + 2.2);
}

// soft low bass swell (supports `at` offset)
function bassVoice(rootHz, semi, dur, at = 0) {
  const t0 = ctx.currentTime + at;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.13, t0 + 0.9);
  g.gain.setValueAtTime(0.13, t0 + dur * 0.55);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 1.2);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = semiToHz(rootHz, semi);
  osc.connect(g).connect(musicGain);
  osc.start(t0); osc.stop(t0 + dur + 1.6);
}

// gentle "kalimba / music-box" note: bright but soft, quick decay, pleasant timbre
function pluck(rootHz, semi, at, vel) {
  const t0 = ctx.currentTime + at;
  const freq = semiToHz(rootHz, semi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vel, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.7);

  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = freq;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;            // soft octave partial (music-box shine)
  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = freq * 2.995;        // detuned 3rd harmonic shimmer
  const g2 = ctx.createGain(); g2.gain.value = 0.45;
  const g3 = ctx.createGain(); g3.gain.value = 0.16;
  osc1.connect(g);
  osc2.connect(g2).connect(g);
  osc3.connect(g3).connect(g);
  if (musicReverb) {
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    g.connect(wet).connect(musicReverb);
  }
  g.connect(musicGain);
  osc1.start(t0); osc2.start(t0); osc3.start(t0);
  osc1.stop(t0 + 2); osc2.stop(t0 + 2); osc3.stop(t0 + 2);
}

// a shared, light reverb so the menu blooms — created lazily
let musicReverb = null;
export function ensureMusicReverb() {
  if (musicReverb || !ctx) return;
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * 2.6);
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const n = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      last = 0.6 * last + 0.4 * n;
      d[i] = last * 0.7;
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  conv.connect(musicGain);
  musicReverb = conv; // destinations connect to musicGain via send
}

// ── Soothing generative music for every mood ─────────────────────────────
// One warm engine (evolving pads + soft bass + sparse harp melody) used by all
// moods. Each mood is just a chord progression, tempo and mood colour — no more
// harsh drones. Semitone offsets are relative to each mood's `root` frequency.
//
// Each mood config: { root, bar (sec/bar), pluckVel, padPeak,
//   bars: [{ chord:[semis], bass: semi }],  melody:[{ at, semi, vel }],
//   drums?, pulseBass? }

const MOOD_CFG = {
  // Main menu — C major lullaby, slow & sparse (the good one you liked).
  menu: {
    root: 261.63, bar: 3.8, pluckVel: 0.26, padPeak: 0.075,
    bars: [
      { chord: [0, 4, 7, 12], bass: -12 },   // C
      { chord: [-3, 0, 4, 9], bass: -15 },   // Am7
      { chord: [-5, -2, 2, 5], bass: -17 },  // F
      { chord: [-2, 2, 7, 11], bass: -14 },  // G
    ],
    melody: [
      { at: 0.45, semi: 4, vel: 1.0 }, { at: 1.55, semi: 7, vel: 0.78 }, { at: 2.70, semi: 9, vel: 0.85 },
      { at: 4.25, semi: 12, vel: 1.0 }, { at: 5.35, semi: 9, vel: 0.78 }, { at: 6.50, semi: 7, vel: 0.82 },
      { at: 8.05, semi: 5, vel: 1.0 }, { at: 9.20, semi: 9, vel: 0.80 }, { at: 10.35, semi: 12, vel: 0.88 },
      { at: 11.85, semi: 11, vel: 1.0 }, { at: 12.95, semi: 9, vel: 0.78 }, { at: 14.10, semi: 7, vel: 0.92 },
    ],
  },

  // Exploring — gentle wandering A-minor, hopeful.
  explore: {
    root: 220, bar: 3.6, pluckVel: 0.2, padPeak: 0.07,
    bars: [
      { chord: [0, 3, 7, 12], bass: -12 },   // Am
      { chord: [-4, 0, 5, 8], bass: -16 },   // F
      { chord: [3, 7, 10, 15], bass: -9 },   // C
      { chord: [-2, 2, 7, 10], bass: -14 },  // G
    ],
    melody: [
      { at: 0.5, semi: 7, vel: 0.9 }, { at: 1.8, semi: 12, vel: 0.7 }, { at: 2.9, semi: 10, vel: 0.8 },
      { at: 4.1, semi: 8, vel: 0.9 }, { at: 5.4, semi: 5, vel: 0.7 }, { at: 6.5, semi: 0, vel: 0.8 },
      { at: 7.7, semi: 3, vel: 0.9 }, { at: 9.0, semi: 7, vel: 0.7 }, { at: 10.1, semi: 10, vel: 0.85 },
      { at: 11.3, semi: 5, vel: 0.9 }, { at: 12.6, semi: 7, vel: 0.7 }, { at: 13.7, semi: 2, vel: 0.8 },
    ],
  },

  // Daytime — bright, warm, uplifting C major.
  day: {
    root: 261.63, bar: 3.3, pluckVel: 0.22, padPeak: 0.075,
    bars: [
      { chord: [0, 4, 7, 12], bass: -12 },   // C
      { chord: [-5, -1, 2, 7], bass: -5 },   // G
      { chord: [-3, 0, 4, 9], bass: -3 },    // Am
      { chord: [-7, -3, 0, 5], bass: -7 },   // F
    ],
    melody: [
      { at: 0.4, semi: 7, vel: 0.95 }, { at: 1.5, semi: 12, vel: 0.75 }, { at: 2.5, semi: 11, vel: 0.8 },
      { at: 3.7, semi: 9, vel: 0.95 }, { at: 4.8, semi: 7, vel: 0.75 }, { at: 5.8, semi: 11, vel: 0.8 },
      { at: 7.0, semi: 12, vel: 0.95 }, { at: 8.1, semi: 9, vel: 0.75 }, { at: 9.1, semi: 7, vel: 0.8 },
      { at: 10.3, semi: 5, vel: 0.95 }, { at: 11.4, semi: 9, vel: 0.75 }, { at: 12.4, semi: 4, vel: 0.85 },
    ],
  },

  // Night — calm, mysterious, very slow and low.
  night: {
    root: 220, bar: 4.4, pluckVel: 0.16, padPeak: 0.07,
    bars: [
      { chord: [0, 3, 7], bass: -12 },       // Am
      { chord: [-5, -2, 2], bass: -5 },      // Em
      { chord: [-4, 0, 5], bass: -4 },       // F
      { chord: [3, 7, 10], bass: -9 },       // C
    ],
    melody: [
      { at: 0.8, semi: 7, vel: 0.8 }, { at: 2.6, semi: 3, vel: 0.65 },
      { at: 5.2, semi: 2, vel: 0.8 }, { at: 7.0, semi: 5, vel: 0.65 },
      { at: 9.6, semi: 0, vel: 0.8 }, { at: 11.4, semi: 5, vel: 0.65 },
      { at: 14.0, semi: 3, vel: 0.8 }, { at: 15.8, semi: 7, vel: 0.7 },
    ],
  },

  // Kingdom / settlement — majestic yet warm.
  kingdom: {
    root: 261.63, bar: 3.0, pluckVel: 0.22, padPeak: 0.08,
    bars: [
      { chord: [0, 4, 7, 12], bass: -12 },   // C
      { chord: [-7, -3, 0, 5], bass: -7 },   // F
      { chord: [-5, -1, 2, 7], bass: -5 },   // G
      { chord: [0, 4, 7, 12], bass: -12 },   // C
    ],
    melody: [
      { at: 0.4, semi: 7, vel: 0.9 }, { at: 1.5, semi: 12, vel: 0.75 }, { at: 2.4, semi: 11, vel: 0.8 },
      { at: 3.4, semi: 5, vel: 0.9 }, { at: 4.5, semi: 9, vel: 0.75 }, { at: 5.4, semi: 12, vel: 0.8 },
      { at: 6.4, semi: 7, vel: 0.9 }, { at: 7.5, semi: 11, vel: 0.75 }, { at: 8.4, semi: 7, vel: 0.8 },
      { at: 9.4, semi: 12, vel: 0.9 }, { at: 10.5, semi: 7, vel: 0.75 }, { at: 11.4, semi: 4, vel: 0.85 },
    ],
  },

  // Combat — tense and driving, but musical (not a harsh drone). Drums + pulse bass.
  combat: {
    root: 146.83, bar: 2.0, pluckVel: 0.2, padPeak: 0.06, drums: true, pulseBass: true,
    bars: [
      { chord: [0, 3, 7], bass: -12 },       // Dm
      { chord: [-4, 0, 3], bass: -16 },      // Bb
      { chord: [-2, 2, 5], bass: -14 },      // C
      { chord: [0, 3, 7], bass: -12 },       // Dm
    ],
    melody: [
      { at: 0.5, semi: 7, vel: 0.8 }, { at: 1.0, semi: 3, vel: 0.6 },
      { at: 2.5, semi: 3, vel: 0.8 }, { at: 3.0, semi: 0, vel: 0.6 },
      { at: 4.5, semi: 5, vel: 0.8 }, { at: 5.0, semi: 2, vel: 0.6 },
      { at: 6.5, semi: 7, vel: 0.8 }, { at: 7.0, semi: 3, vel: 0.6 },
    ],
  },

  // Boss — epic, dark, low. Drums + pulse bass, slow menace.
  boss: {
    root: 130.81, bar: 1.9, pluckVel: 0.22, padPeak: 0.06, drums: true, pulseBass: true,
    bars: [
      { chord: [0, 3, 7], bass: -12 },       // Cm
      { chord: [-4, 0, 3], bass: -16 },      // Ab
      { chord: [-5, -1, 2], bass: -5 },      // G
      { chord: [0, 3, 7], bass: -12 },       // Cm
    ],
    melody: [
      { at: 0.4, semi: 7, vel: 0.85 }, { at: 0.9, semi: 3, vel: 0.6 },
      { at: 2.3, semi: 3, vel: 0.85 }, { at: 2.8, semi: -1, vel: 0.6 },
      { at: 4.2, semi: 2, vel: 0.85 }, { at: 4.7, semi: -1, vel: 0.6 },
      { at: 6.1, semi: 7, vel: 0.85 }, { at: 6.6, semi: 3, vel: 0.6 },
    ],
  },
};

/** Schedule one full phrase for a mood, then loop. */
function moodPhraseStep(mood) {
  const cfg = MOOD_CFG[mood];
  if (!cfg) return;
  const root = cfg.root;
  const bar = cfg.bar;
  const nbars = cfg.bars.length;
  const phraseLen = nbars * bar;

  for (let b = 0; b < nbars; b++) {
    const at = b * bar;
    const bc = cfg.bars[b];
    for (const semi of bc.chord) padVoice(root, semi, bar + 1.4, cfg.padPeak, at);
    if (cfg.pulseBass) {
      // driving eighth-note bass pulse for combat/boss
      const beats = 4;
      for (let k = 0; k < beats; k++) bassVoice(root, bc.bass, bar / beats * 0.9, at + k * (bar / beats));
    } else {
      bassVoice(root, bc.bass, bar + 0.8, at);
    }
    if (cfg.drums) {
      const beats = 4;
      for (let k = 0; k < beats; k++) drumTick(ctx.currentTime + at + k * (bar / beats));
    }
  }
  if (cfg.melody) for (const n of cfg.melody) pluck(root, n.semi, n.at, cfg.pluckVel * n.vel);

  moodTimer = setTimeout(() => moodPhraseStep(mood), phraseLen * 1000);
}

let moodTimer = null;

export function stopMusic() {
  currentMood = null;
  if (moodTimer) { clearTimeout(moodTimer); moodTimer = null; }
}

// Generative background music is DISABLED per user request. Set to true to
// re-enable the soothing music engine. SFX and ambient are unaffected.
const MUSIC_ENABLED = false;

/** Start (or crossfade to) any mood's soothing generative music. */
export function setMood(mood) {
  if (!MUSIC_ENABLED) { stopMusic(); return; }
  if (!started || !MOOD_CFG[mood] || mood === currentMood) return;
  if (ctx?.state === 'suspended') {
    ctx.resume().then(() => setMood(mood)).catch(() => {});
    return;
  }
  stopMusic();
  if (mood === 'menu') stopAmbient();
  currentMood = mood;
  ensureMusicReverb();
  moodPhraseStep(mood);
}

/** Menu music entry point (kept for MenuScene / initAudio callers). */
export function setMenuMood() {
  setMood('menu');
}

/** Back-compat no-op alias — menu music now stops via stopMusic(). */
export function stopMenuMusic() {
  stopMusic();
}

/** Wire global sound triggers once (called alongside initAudio). */
export function installAudioBus() {
  Bus.on('level-up', () => playSfx('levelup'));
  Bus.on('quest-completed', () => playSfx('quest_complete'));
  Bus.on('chapter-advance', () => playSfx('achievement'));
  Bus.on('achievement-unlocked', () => playSfx('achievement'));
  Bus.on('boss-intro', () => { playSfx('boss_roar'); setMood('boss'); });
  Bus.on('boss-defeated', () => setMood(GameState.session.timePhase || 'explore'));
  Bus.on('player-death', () => playSfx('death'));
}

/** Fully silence + tear down every sound this app produces (music, ambient, sfx). */
export function stopAllAudio() {
  try { stopMusic(); } catch { /* */ }
  try { stopAmbient(); } catch { /* */ }
  // Operate on the GLOBAL stashed context so this works even if this module was
  // duplicated by HMR (a newer module instance with a different local `ctx`).
  const stash = (typeof window !== 'undefined') && window.__RISE_AUDIO__;
  const gc = (stash && stash.masterGain) || masterGain;
  const cc = (stash && stash.ctx) || ctx;
  try { if (gc) gc.gain.value = 0; } catch { /* */ }
  try { cc && cc.suspend && cc.suspend(); } catch { /* */ }
}

// Console diagnostics so the exact sound source can be identified instantly.
// In the browser console type:  riseAudio.music(false)  → stop just the music
//                               riseAudio.ambient(false) → stop just the ambient
//                               riseAudio.silence()      → kill everything
//                               riseAudio.close()        → hard-close the context
if (typeof window !== 'undefined') {
  window.riseAudio = {
    music(on = true) { const s = window.__RISE_AUDIO__; const mg = (s && s.musicGain) || musicGain; if (mg) mg.gain.value = on ? 0.28 : 0; return `music ${on ? 'on' : 'OFF'}`; },
    ambient(on = true) { setAmbientVolume(on ? 0.19 : 0); return `ambient ${on ? 'on' : 'OFF'}`; },
    silence() { stopAllAudio(); return 'all audio silenced'; },
    async close() { stopAllAudio(); const s = window.__RISE_AUDIO__; try { await (s?.ctx || ctx)?.close?.(); } catch { /* */ } return 'AudioContext CLOSED — sound must stop now; if not, it is another tab/server.'; },
    state() { const s = window.__RISE_AUDIO__; return { mood: currentMood, started, localCtxState: ctx?.state, stashCtxState: s?.ctx?.state, sameCtx: (s?.ctx === ctx), sampleRate: ctx?.sampleRate }; },
  };
}

// Ambient biome soundscape (wind/drones) is also DISABLED per user request.
const AMBIENT_ENABLED = false;
export function updateAmbient(biomeId) {
  if (!AMBIENT_ENABLED) { try { stopAmbient(); } catch { /* */ } return; }
  return _updateAmbient(biomeId);
}

// ── HMR safety ──────────────────────────────────────────────────────────────
// The generative music is a self-scheduling setTimeout loop. Without teardown,
// a hot-reload leaves the OLD loop (and OLD AudioContext) droning forever, so
// music edits were never actually heard (the persistent "same sound"). Here we
// stop the old loop on dispose and resume the current mood with the fresh code.
if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.mood = currentMood;
    data.wasStarted = started;
    try { stopMusic(); } catch { /* */ }
    try { stopAmbient(); } catch { /* */ }
    if (musicReverb) { try { musicReverb.disconnect(); } catch { /* */ } musicReverb = null; }
  });
  if (import.meta.hot.data && import.meta.hot.data.wasStarted) {
    const prevMood = import.meta.hot.data.mood || 'menu';
    setTimeout(() => {
      try {
        createAudioContext();               // reuses the single stashed context
        if (ctx?.state === 'suspended') ctx.resume().then(() => setMood(prevMood)).catch(() => {});
        else setMood(prevMood);
      } catch { /* */ }
    }, 0);
  }
  import.meta.hot.accept();
}

