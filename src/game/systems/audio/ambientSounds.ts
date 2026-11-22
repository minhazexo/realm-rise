// ─────────────────────────────────────────────────────────────────────────────
// Ambient sound layer: procedural biome-specific environmental audio.
// Each biome has 2–3 layered voices (noise, oscillators) that crossfade
// when the player moves between biomes. Zero external assets.
// ─────────────────────────────────────────────────────────────────────────────
import type { SfxAudioContext } from './audioSfx.ts';

/** Slow modulation applied to a voice's filter frequency or gain. */
interface VoiceMod {
  rate: number;
  depth: number;
  target: 'frequency' | 'gain';
}

/** One layered ambient voice (noise buffer or oscillator). */
interface AmbientVoice {
  src?: AudioBufferSourceNode;
  osc?: OscillatorNode;
  gain?: GainNode;
  filter?: BiquadFilterNode;
  /** Detached LFO oscillator kept alive for teardown. */
  _lfo?: OscillatorNode;
  mod?: VoiceMod;
  chirp?: boolean;
}

let ctxRef: SfxAudioContext | null = null;
let ambientGain: GainNode | null = null;
let activeNodes: AmbientVoice[] = [];
let currentBiome: string | null = null;

/** Called once when AudioSystem initialises. */
export function initAmbient(audioCtx: SfxAudioContext, master: GainNode): void {
  ctxRef = audioCtx;
  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(master);
}

/** Set ambient volume (0–1). Called when user changes settings. */
export function setAmbientVolume(v: number): void {
  if (ambientGain) ambientGain.gain.value = v;
}

/* ── Noise buffer helper ──────────────────────────────────────────────────── */

function makeNoise(dur = 2): AudioBuffer {
  if (!ctxRef) throw new Error('[ambient] audio context not initialised');
  const len = Math.floor(ctxRef.sampleRate * dur);
  const buf = ctxRef.createBuffer(1, len, ctxRef.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Connect a node to the shared ambient bus (no-op before initAmbient). */
function connectAmbient(node: AudioNode): void {
  if (ambientGain) node.connect(ambientGain);
}

interface NoiseOpts {
  filterType?: BiquadFilterType;
  freq?: number;
  q?: number;
  peak?: number;
  detune?: number;
  pan?: number;
}

/** Create a looping filtered-noise voice. Returns { src, gain, filter }. */
function loopNoise({ filterType = 'lowpass', freq = 400, q = 1, peak = 0.08, detune = 0, pan = 0 }: NoiseOpts): AmbientVoice {
  const ctx = ctxRef;
  if (!ctx) return {};
  const buf = makeNoise(4);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = filterType;
  filt.frequency.value = freq;
  filt.Q.value = q;
  if (detune) filt.detune.value = detune;
  const g = ctx.createGain();
  g.gain.value = peak;
  let out: AudioNode = g;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    out = p;
  }
  src.connect(filt).connect(out);
  connectAmbient(out);
  src.start();
  return { src, gain: g, filter: filt };
}

interface ToneOpts {
  freq?: number;
  type?: OscillatorType;
  peak?: number;
  lfo?: { rate: number; depth: number };
  pan?: number;
}

/** Create a looping oscillator voice. Returns { osc, gain, _lfo? }. */
function loopTone({ freq = 220, type = 'sine', peak = 0.04, lfo, pan = 0 }: ToneOpts): AmbientVoice {
  const ctx = ctxRef;
  if (!ctx) return {};
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = peak;
  const voice: AmbientVoice = { osc, gain: g };
  if (lfo) {
    const lfoOsc = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.value = lfo.rate;
    lfoGain.gain.value = lfo.depth;
    lfoOsc.connect(lfoGain).connect(osc.frequency);
    lfoOsc.start();
    voice._lfo = lfoOsc;
  }
  let out: AudioNode = g;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    out = p;
  }
  osc.connect(out);
  connectAmbient(out);
  osc.start();
  return voice;
}

/* ── Biome voice configurations ───────────────────────────────────────────── */

type VoiceFactory = () => AmbientVoice[];

const BIOME_VOICES: Record<string, VoiceFactory> = {
  plains: () => [
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

  forest: () => [
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

  riverlands: () => [
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

  swamp: () => [
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

  mountains: () => [
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

  desert: () => [
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

  frozen: () => [
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

  volcanic: () => [
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

const mods: OscillatorNode[] = [];
const chirpTimers: ReturnType<typeof setInterval>[] = [];

function startModulation(nodes: AmbientVoice[]): void {
  // Start LFO modulations for gain and filter frequency wobble
  for (const n of nodes) {
    if (n.mod && ctxRef) {
      const ctx = ctxRef;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.mod.rate;
      g.gain.value = n.mod.depth;
      const target: AudioParam | undefined = n.mod.target === 'frequency' ? n.filter?.frequency : n.gain?.gain;
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

function stopAll(): void {
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

function fadeOutThen(fadeDur: number, cb: () => void): void {
  const ctx = ctxRef;
  const bus = ambientGain;
  if (!ctx || !bus) return;
  const t = ctx.currentTime;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(0, t + fadeDur);
  setTimeout(() => {
    stopAll();
    cb();
    // Fade in
    const ctx2 = ctxRef;
    const bus2 = ambientGain;
    if (!ctx2 || !bus2) return;
    const t2 = ctx2.currentTime;
    bus2.gain.cancelScheduledValues(t2);
    bus2.gain.setValueAtTime(0, t2);
    bus2.gain.linearRampToValueAtTime(1, t2 + CROSSFADE_SEC);
  }, fadeDur * 1000);
}

/* ── Public API ────────────────────────────────────────────────────────────── */

/**
 * Called every few seconds with the player's current biome id.
 * If biome changed, crossfades ambient sounds.
 */
export function updateAmbient(biomeId: string): void {
  const ctx = ctxRef;
  const bus = ambientGain;
  if (!ctx || !bus) return;
  if (biomeId === currentBiome) return;
  const factory = BIOME_VOICES[biomeId];
  if (!factory) {
    // Unknown biome — fade out
    fadeOutThen(CROSSFADE_SEC, () => {});
    currentBiome = biomeId;
    return;
  }
  const prev = currentBiome;
  currentBiome = biomeId;

  if (!prev) {
    // First time — just start
    const nodes = factory();
    activeNodes = nodes;
    startModulation(nodes);
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + CROSSFADE_SEC);
  } else {
    // Crossfade from old to new
    fadeOutThen(CROSSFADE_SEC * 0.6, () => {
      const nodes = factory();
      activeNodes = nodes;
      startModulation(nodes);
    });
  }
}

/** Stop all ambient (e.g. on game pause / menu). */
export function stopAmbient(): void {
  fadeOutThen(CROSSFADE_SEC * 0.4, () => {});
  currentBiome = null;
}
