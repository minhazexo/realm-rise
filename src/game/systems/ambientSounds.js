// ─────────────────────────────────────────────────────────────────────────────
// Ambient sound layer: procedural biome-specific environmental audio.
// Each biome has 2–3 layered voices (noise, oscillators) that crossfade
// when the player moves between biomes. Zero external assets.
// ─────────────────────────────────────────────────────────────────────────────
let ctxRef = null;
let ambientGain = null;
let activeNodes = [];
let currentBiome = null;
let fadeInterval = null;

/** Called once when AudioSystem initialises. */
export function initAmbient(audioCtx, master) {
  ctxRef = audioCtx;
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(master);
}

/** Set ambient volume (0–1). Called when user changes settings. */
export function setAmbientVolume(v) {
  if (ambientGain) ambientGain.gain.value = v;
}

/* ── Noise buffer helper ──────────────────────────────────────────────────── */

function makeNoise(dur = 2) {
  const len = Math.floor(ctxRef.sampleRate * dur);
  const buf = ctxRef.createBuffer(1, len, ctxRef.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Create a looping filtered-noise voice. Returns { src, gain, filter }. */
function loopNoise({ filterType = 'lowpass', freq = 400, q = 1, peak = 0.08, detune = 0, pan = 0 }) {
  const buf = makeNoise(4);
  const src = ctxRef.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filt = ctxRef.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = freq;
  filt.Q.value = q;
  if (detune) filt.detune.value = detune;
  const g = ctxRef.createGain();
  g.gain.value = peak;
  let out = g;
  if (pan && ctxRef.createStereoPanner) {
    const p = ctxRef.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    out = p;
  }
  src.connect(filt).connect(out).connect(ambientGain);
  src.start();
  return { src, gain: g, filter: filt };
}

/** Create a looping oscillator voice. Returns { osc, gain }. */
function loopTone({ freq = 220, type = 'sine', peak = 0.04, lfo, pan = 0 }) {
  const osc = ctxRef.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctxRef.createGain();
  g.gain.value = peak;
  if (lfo) {
    const lfoOsc = ctxRef.createOscillator();
    const lfoGain = ctxRef.createGain();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.value = lfo.rate;
    lfoGain.gain.value = lfo.depth;
    lfoOsc.connect(lfoGain).connect(osc.frequency);
    lfoOsc.start();
    g._lfo = lfoOsc;
  }
  let out = g;
  if (pan && ctxRef.createStereoPanner) {
    const p = ctxRef.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    out = p;
  }
  osc.connect(out).connect(ambientGain);
  osc.start();
  return { osc, gain: g };
}

/* ── Biome voice configurations ───────────────────────────────────────────── */

const BIOME_VOICES = {
  plains: (ctx) => [
    // Gentle wind — low filtered noise with slow modulation
    { ...loopNoise({ filterType: 'lowpass', freq: 350, q: 0.7, peak: 0.06 }),
      mod: { rate: 0.08, depth: 120, target: 'frequency' } },
    // Distant bird chirps — high sine tones, panned right
    { ...loopTone({ freq: 2400, type: 'sine', peak: 0.015, pan: 0.35,
      lfo: { rate: 0.3, depth: 800 } }),
      chirp: true },
    // Faint breeze counter-voice, panned left for width
    { ...loopNoise({ filterType: 'lowpass', freq: 500, q: 0.6, peak: 0.035, pan: -0.3 }),
      mod: { rate: 0.12, depth: 160, target: 'frequency' } }
  ],

  forest: (ctx) => [
    // Leaf rustle — mid-range noise with bandpass
    { ...loopNoise({ filterType: 'bandpass', freq: 2200, q: 0.5, peak: 0.05 }),
      mod: { rate: 0.15, depth: 600, target: 'frequency' } },
    // Deep forest drone — low hum
    { ...loopTone({ freq: 85, type: 'sine', peak: 0.03 }),
      mod: { rate: 0.05, depth: 8, target: 'gain' } },
    // Birdsong — high tones, panned right
    { ...loopTone({ freq: 3100, type: 'sine', peak: 0.012, pan: 0.4,
      lfo: { rate: 0.2, depth: 400 } }),
      chirp: true },
    // Distant birdsong counter-voice, panned left
    { ...loopTone({ freq: 2600, type: 'sine', peak: 0.009, pan: -0.4,
      lfo: { rate: 0.25, depth: 350 } }),
      chirp: true }
  ],

  riverlands: (ctx) => [
    // Flowing water — broad noise
    { ...loopNoise({ filterType: 'lowpass', freq: 800, q: 0.3, peak: 0.07 }),
      mod: { rate: 0.2, depth: 300, target: 'frequency' } },
    // Stream murmur — mid filtered noise, panned right for a sense of flow
    { ...loopNoise({ filterType: 'bandpass', freq: 1600, q: 1.2, peak: 0.04, pan: 0.3 }),
      mod: { rate: 0.35, depth: 500, target: 'frequency' } },
    // Gentle water drip tones
    { ...loopTone({ freq: 600, type: 'sine', peak: 0.01, pan: -0.2,
      lfo: { rate: 0.5, depth: 200 } }) }
  ],

  swamp: (ctx) => [
    // Bubbling mud — low noise with slow modulation
    { ...loopNoise({ filterType: 'lowpass', freq: 200, q: 2, peak: 0.05 }),
      mod: { rate: 0.06, depth: 80, target: 'frequency' } },
    // Soft low drone — warm triangle (was harsh sawtooth)
    { ...loopTone({ freq: 73, type: 'triangle', peak: 0.016 }),
      mod: { rate: 0.03, depth: 4, target: 'gain' } },
    // Frog croak approximation — pulsing sine, panned right
    { ...loopTone({ freq: 180, type: 'sine', peak: 0.012, pan: 0.35,
      lfo: { rate: 1.2, depth: 60 } }) },
    // Moth/hover hum — panned left
    { ...loopTone({ freq: 1400, type: 'sine', peak: 0.006, pan: -0.35,
      lfo: { rate: 0.8, depth: 200 } }) }
  ],

  mountains: (ctx) => [
    // Howling wind — high noise with steep bandpass
    { ...loopNoise({ filterType: 'bandpass', freq: 1800, q: 1.5, peak: 0.06 }),
      mod: { rate: 0.1, depth: 800, target: 'frequency' } },
    // Deep rumble — sub-bass tone
    { ...loopTone({ freq: 45, type: 'sine', peak: 0.035 }),
      mod: { rate: 0.04, depth: 6, target: 'gain' } },
    // Whistling wind — narrow high tone, panned right
    { ...loopTone({ freq: 880, type: 'sine', peak: 0.012, pan: 0.3,
      lfo: { rate: 0.15, depth: 300 } }) },
    // Second whistling voice, panned left
    { ...loopTone({ freq: 940, type: 'sine', peak: 0.009, pan: -0.35,
      lfo: { rate: 0.18, depth: 280 } }) }
  ],

  desert: (ctx) => [
    // Hot wind — low rumble with slow sweep
    { ...loopNoise({ filterType: 'lowpass', freq: 250, q: 0.4, peak: 0.05 }),
      mod: { rate: 0.04, depth: 100, target: 'frequency' } },
    // Heat shimmer — high-pitched thin tone
    { ...loopTone({ freq: 4200, type: 'sine', peak: 0.008, pan: 0.2,
      lfo: { rate: 0.1, depth: 1000 } }) },
    // Sand drift — bandpass noise panned left
    { ...loopNoise({ filterType: 'bandpass', freq: 1200, q: 1, peak: 0.025, pan: -0.3 }),
      mod: { rate: 0.06, depth: 400, target: 'frequency' } }
  ],

  frozen: (ctx) => [
    // Cold wind — high-pass noise, sharp
    { ...loopNoise({ filterType: 'highpass', freq: 1200, q: 0.6, peak: 0.055 }),
      mod: { rate: 0.12, depth: 600, target: 'frequency' } },
    // Ice crackle — narrow band noise bursts
    { ...loopNoise({ filterType: 'bandpass', freq: 4000, q: 3, peak: 0.025, pan: 0.3 }),
      mod: { rate: 0.08, depth: 1200, target: 'frequency' } },
    // Eerie high drone
    { ...loopTone({ freq: 1050, type: 'sine', peak: 0.01, pan: -0.2,
      lfo: { rate: 0.06, depth: 150 } }) }
  ],

  volcanic: (ctx) => [
    // Deep rumble — very low oscillator (soft triangle, was harsh sawtooth)
    { ...loopTone({ freq: 38, type: 'triangle', peak: 0.03 }),
      mod: { rate: 0.07, depth: 5, target: 'gain' } },
    // Ember crackle — high filtered noise, panned right
    { ...loopNoise({ filterType: 'highpass', freq: 3000, q: 2, peak: 0.03, pan: 0.3 }),
      mod: { rate: 0.2, depth: 1500, target: 'frequency' } },
    // Lava hiss — mid noise, panned left
    { ...loopNoise({ filterType: 'bandpass', freq: 900, q: 1, peak: 0.035, pan: -0.3 }),
      mod: { rate: 0.1, depth: 400, target: 'frequency' } }
  ]
};

/* ── LFO modulation + chirp timers ─────────────────────────────────────────── */

const mods = [];
const chirpTimers = [];

function startModulation(nodes) {
  // Start LFO modulations for gain and filter frequency wobble
  for (const n of nodes) {
    if (n.mod) {
      const t = ctxRef.currentTime;
      const osc = ctxRef.createOscillator();
      const g = ctxRef.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.mod.rate;
      g.gain.value = n.mod.depth;
      const target = n.mod.target === 'frequency' ? n.filter?.frequency : n.gain?.gain;
      if (target) {
        osc.connect(g).connect(target);
        osc.start();
        mods.push(osc);
      }
    }
    // Chirp effect: periodically pulse the gain of high tones
    if (n.chirp) {
      const id = setInterval(() => {
        if (!n.gain || !ctxRef) return;
        const t = ctxRef.currentTime;
        const base = 0.008;
        const peak = 0.025;
        n.gain.gain.cancelScheduledValues(t);
        n.gain.gain.setValueAtTime(base, t);
        n.gain.gain.linearRampToValueAtTime(peak, t + 0.04);
        n.gain.gain.linearRampToValueAtTime(base, t + 0.12);
      }, 2000 + Math.random() * 4000);
      chirpTimers.push(id);
    }
  }
}

function stopAll() {
  for (const n of activeNodes) {
    try { n.src?.stop(); } catch { /* */ }
    try { n.osc?.stop(); } catch { /* */ }
    try { n._lfo?.stop(); } catch { /* */ }
  }
  for (const m of mods) try { m.stop(); } catch { /* */ }
  for (const t of chirpTimers) clearInterval(t);
  mods.length = 0;
  chirpTimers.length = 0;
  activeNodes.length = 0;
}

/* ── Crossfade transition ──────────────────────────────────────────────────── */

const CROSSFADE_SEC = 2.5;

function fadeOutThen(fadeDur, cb) {
  if (!ctxRef || !ambientGain) return;
  const t = ctxRef.currentTime;
  ambientGain.gain.cancelScheduledValues(t);
  ambientGain.gain.setValueAtTime(ambientGain.gain.value, t);
  ambientGain.gain.linearRampToValueAtTime(0, t + fadeDur);
  setTimeout(() => {
    stopAll();
    cb();
    // Fade in
    const t2 = ctxRef.currentTime;
    ambientGain.gain.cancelScheduledValues(t2);
    ambientGain.gain.setValueAtTime(0, t2);
    ambientGain.gain.linearRampToValueAtTime(1, t2 + CROSSFADE_SEC);
  }, fadeDur * 1000);
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/**
 * Called every few seconds with the player's current biome id.
 * If biome changed, crossfades ambient sounds.
 */
export function updateAmbient(biomeId) {
  if (!ctxRef || !ambientGain) return;
  if (biomeId === currentBiome) return;
  if (!BIOME_VOICES[biomeId]) {
    // Unknown biome — fade out
    fadeOutThen(CROSSFADE_SEC, () => {});
    currentBiome = biomeId;
    return;
  }
  const prev = currentBiome;
  currentBiome = biomeId;

  if (!prev) {
    // First time — just start
    const nodes = BIOME_VOICES[biomeId](ctxRef);
    activeNodes = nodes;
    startModulation(nodes);
    const t = ctxRef.currentTime;
    ambientGain.gain.cancelScheduledValues(t);
    ambientGain.gain.setValueAtTime(0, t);
    ambientGain.gain.linearRampToValueAtTime(1, t + CROSSFADE_SEC);
  } else {
    // Crossfade from old to new
    fadeOutThen(CROSSFADE_SEC * 0.6, () => {
      const nodes = BIOME_VOICES[biomeId](ctxRef);
      activeNodes = nodes;
      startModulation(nodes);
    });
  }
}

/** Stop all ambient (e.g. on game pause / menu). */
export function stopAmbient() {
  fadeOutThen(CROSSFADE_SEC * 0.4, () => {});
  currentBiome = null;
}
