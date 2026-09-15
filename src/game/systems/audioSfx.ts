// Procedural SFX synthesis (WebAudio). Pure function table — no assets.
// A shared FX send (delay + reverb) adds space and richness to impacts and
// ambient bursts without needing any audio files.

/**
 * AudioContext plus the game's direct SFX bus (`_sfxGain`), which every
 * sfx voice connects to. AudioSystem owns the graph; audioSfx only reads it.
 */
export type SfxAudioContext = AudioContext & { _sfxGain: GainNode };

let ctxRef: SfxAudioContext | null = null;
export const setCtx = (c: SfxAudioContext): void => { ctxRef = c; };

// ── Shared effects bus (feedback delay + Schroeder reverb) ──────────────
let fxSend: GainNode | null = null;   // post-envelope gain into the wet chain
let delayNode: DelayNode | null = null;
let reverbNode: ConvolverNode | null = null;
void reverbNode;

function ensureFxSend(): void {
  const ctx = ctxRef;
  if (!ctx || fxSend) return;
  fxSend = ctx.createGain();
  fxSend.gain.value = 0.5;

  // Feedback delay ~145ms with a lowpass darkening the tail
  delayNode = ctx.createDelay(1.5);
  delayNode.delayTime.value = 0.145;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2600;
  delayNode.connect(tone);
  tone.connect(fb);
  fb.connect(delayNode);

  // Simple Schroeder-style reverb using a short silent-IR convolution
  const dur = 1.2;
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * dur);
  const ir = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // decaying noise with a touch of low-pass smoothing
      const n = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      last = 0.7 * last + 0.3 * n;
      d[i] = last;
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;

  // wet mix: dry→(delay→reverb)→fxSend with modest amplitude
  const dry = ctx.createGain();
  dry.gain.value = 0.55;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  const wet2 = ctx.createGain();
  wet2.gain.value = 0.6;
  fxSend.connect(dry);
  fxSend.connect(delayNode);
  delayNode.connect(wet2);
  wet2.connect(conv);
  wet2.connect(wet);
  conv.connect(wet);
  dry.connect(wet);
  wet.connect(fxSend);       // slight self-feed for a livelier tail
  fxSend.connect(ctx._sfxGain);
}

/** Route a node into both the direct SFX channel and a small amount of FX. */
function route(node: AudioNode, wetAmount = 0): void {
  const ctx = ctxRef;
  if (!ctx) return;
  node.connect(ctx._sfxGain);
  if (wetAmount > 0 && fxSend) {
    const g = ctx.createGain();
    g.gain.value = wetAmount;
    node.connect(g);
    g.connect(fxSend);
  }
  ensureFxSend();
}

function env(node: GainNode, t0: number, attack: number, peak: number, release: number, sustain: number = peak): void {
  const end = t0 + attack + release;
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.linearRampToValueAtTime(Math.max(0.0001, sustain), t0 + attack);
  // small sustain plateau then exponential release for a natural tail
  node.gain.setValueAtTime(Math.max(0.0001, sustain), t0 + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, end);
}

interface ToneOpts {
  freq?: number;
  type?: OscillatorType;
  dur?: number;
  attack?: number;
  release?: number;
  peak?: number;
  slideTo?: number;
  delay?: number;
  wet?: number;
  pan?: number;
}

function tone({ freq = 440, type = 'sine', dur = 0.15, attack = 0.006, release = 0.05, peak = 0.5, slideTo, delay = 0, wet = 0, pan = 0 }: ToneOpts): void {
  const ctx = ctxRef;
  if (!ctx) return;
  ensureFxSend();
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  env(g, t0, attack, peak, release);
  let out: AudioNode = g;
  if (pan) {
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; g.connect(p); out = p; }
  }
  osc.connect(g);
  route(out, wet);
  osc.start(t0);
  osc.stop(t0 + dur + attack + release + 0.05);
}

interface NoiseOpts {
  dur?: number;
  peak?: number;
  filterFreq?: number;
  delay?: number;
  type?: BiquadFilterType;
  q?: number;
  attack?: number;
  release?: number;
  wet?: number;
  slide?: number;
}

function noiseBurst({ dur = 0.12, peak = 0.35, filterFreq = 1200, delay = 0, type = 'lowpass', q = 1, attack = 0.003, release = 0.04, wet = 0, slide = 0 }: NoiseOpts): void {
  const ctx = ctxRef;
  if (!ctx) return;
  ensureFxSend();
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(filterFreq, t0);
  if (slide) filt.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
  filt.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, attack, peak, release);
  src.connect(filt);
  filt.connect(g);
  route(g, wet);
  src.start(t0);
}

interface ChimOpts {
  base?: number;
  partials?: number;
  dur?: number;
  peak?: number;
  delay?: number;
  wet?: number;
}

/** Short metallic chime for UI/coin pickups. */
function chim({ base = 660, partials = 2, dur = 0.1, peak = 0.2, delay = 0, wet = 0 }: ChimOpts): void {
  for (let i = 0; i < partials; i++) {
    tone({ freq: base * (2 + i * 2), type: 'sine', dur, attack: 0.003, release: 0.06, peak: peak / (i + 1), delay, wet });
  }
  tone({ freq: base, type: 'sine', dur, attack: 0.003, release: 0.08, peak, delay, wet });
}

export const SFX_LIBRARY: Record<string, () => void> = {
  ui_click: () => tone({ freq: 780, type: 'triangle', dur: 0.045, attack: 0.002, release: 0.03, peak: 0.18 }),
  ui_open: () => {
    tone({ freq: 420, type: 'triangle', dur: 0.09, peak: 0.2, release: 0.05, wet: 0.12 });
    tone({ freq: 660, type: 'triangle', dur: 0.1, peak: 0.16, delay: 0.05, release: 0.07, wet: 0.14 });
  },
  chop: () => {
    noiseBurst({ dur: 0.06, peak: 0.32, filterFreq: 1100, type: 'bandpass', q: 1.2, release: 0.03 });
    noiseBurst({ dur: 0.12, peak: 0.22, filterFreq: 500, type: 'lowpass', release: 0.06, delay: 0.02 });
    tone({ freq: 150, type: 'square', dur: 0.09, peak: 0.2, slideTo: 64, release: 0.05, wet: 0.1 });
  },
  mine: () => {
    noiseBurst({ dur: 0.05, peak: 0.4, filterFreq: 3000, type: 'highpass', release: 0.03 });
    tone({ freq: 260, type: 'sawtooth', dur: 0.06, peak: 0.2, slideTo: 120, release: 0.04 });
    noiseBurst({ dur: 0.1, peak: 0.2, filterFreq: 700, type: 'bandpass', q: 1.5, delay: 0.02 });
  },
  pickup: () => {
    chim({ base: 460, partials: 3, dur: 0.09, peak: 0.16, wet: 0.1 });
    tone({ freq: 880, type: 'triangle', dur: 0.1, peak: 0.12, delay: 0.06, release: 0.08 });
  },
  sword: () => {
    noiseBurst({ dur: 0.1, peak: 0.3, filterFreq: 3200, type: 'highpass', release: 0.06, slide: 5000 });
    tone({ freq: 320, slideTo: 90, dur: 0.12, peak: 0.22, type: 'sawtooth', release: 0.05, wet: 0.08 });
  },
  hit_flesh: () => {
    noiseBurst({ dur: 0.12, peak: 0.42, filterFreq: 500, type: 'lowpass', release: 0.06 });
    tone({ freq: 100, type: 'square', dur: 0.12, peak: 0.3, slideTo: 50, release: 0.06, wet: 0.1 });
  },
  player_hurt: () => {
    tone({ freq: 220, slideTo: 95, dur: 0.2, peak: 0.32, type: 'square', release: 0.12, wet: 0.12 });
    noiseBurst({ dur: 0.15, peak: 0.22, filterFreq: 700, type: 'lowpass', release: 0.08 });
  },
  dodge: () => noiseBurst({ dur: 0.16, peak: 0.16, filterFreq: 2000, type: 'bandpass', q: 1.4, release: 0.08 }),
  levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, peak: 0.26, delay: i * 0.09, release: 0.14, wet: 0.2 })),
  coin: () => {
    chim({ base: 990, partials: 3, dur: 0.06, peak: 0.14, wet: 0.12 });
    chim({ base: 1485, partials: 2, dur: 0.1, peak: 0.11, delay: 0.055, wet: 0.14 });
  },
  craft_done: () => {
    tone({ freq: 320, dur: 0.1, peak: 0.2, release: 0.06, wet: 0.1 });
    tone({ freq: 480, dur: 0.14, peak: 0.18, delay: 0.08, release: 0.1, wet: 0.12 });
    tone({ freq: 640, dur: 0.18, peak: 0.14, delay: 0.16, release: 0.16, wet: 0.14 });
  },
  build_thud: () => {
    noiseBurst({ dur: 0.14, peak: 0.4, filterFreq: 400, type: 'lowpass', release: 0.1 });
    tone({ freq: 90, type: 'square', dur: 0.14, peak: 0.28, slideTo: 42, release: 0.1, wet: 0.14 });
    noiseBurst({ dur: 0.08, peak: 0.16, filterFreq: 1500, type: 'bandpass', delay: 0.05 });
  },
  boss_roar: () => {
    tone({ freq: 95, type: 'sawtooth', dur: 0.8, peak: 0.4, slideTo: 40, release: 0.4, wet: 0.3, pan: -0.1 });
    noiseBurst({ dur: 0.8, peak: 0.26, filterFreq: 320, type: 'lowpass', release: 0.4, wet: 0.25 });
    tone({ freq: 160, type: 'sawtooth', dur: 0.5, peak: 0.22, slideTo: 70, delay: 0.1, release: 0.3, wet: 0.3, pan: 0.1 });
  },
  wolf_growl: () => {
    noiseBurst({ dur: 0.38, peak: 0.26, filterFreq: 300, type: 'lowpass', release: 0.3 });
    tone({ freq: 150, slideTo: 85, dur: 0.38, peak: 0.2, type: 'sawtooth', release: 0.3, wet: 0.14 });
  },
  danger_sting: () => tone({ freq: 320, type: 'triangle', dur: 0.4, peak: 0.3, slideTo: 140, release: 0.25, wet: 0.2 }),
  arrow_shot: () => {
    noiseBurst({ dur: 0.08, peak: 0.26, filterFreq: 3000, type: 'highpass', release: 0.05 });
    noiseBurst({ dur: 0.2, peak: 0.1, filterFreq: 1800, type: 'bandpass', release: 0.12, delay: 0.02 });
  },
  rain_amb: () => noiseBurst({ dur: 0.5, peak: 0.05, filterFreq: 1600, type: 'bandpass', release: 0.4, wet: 0.3 }),
  thunder: () => {
    noiseBurst({ dur: 1.5, peak: 0.42, filterFreq: 200, type: 'lowpass', release: 1.1, wet: 0.4 });
    tone({ freq: 60, type: 'sawtooth', dur: 1.3, peak: 0.24, slideTo: 28, release: 1.1, wet: 0.4 });
    noiseBurst({ dur: 0.9, peak: 0.2, filterFreq: 700, type: 'bandpass', release: 0.7, delay: 0.15 });
  },
  achievement: () => [784, 1046, 1318].forEach((f, i) => tone({ freq: f, dur: 0.36, peak: 0.24, delay: i * 0.12, release: 0.2, wet: 0.2, type: 'triangle' })),
  quest_complete: () => [440, 554, 659, 880].forEach((f, i) => tone({ freq: f, dur: 0.28, peak: 0.22, delay: i * 0.08, release: 0.18, wet: 0.2, type: 'triangle' })),
  footstep_grass: () => noiseBurst({ dur: 0.05, peak: 0.06, filterFreq: 600, type: 'lowpass', release: 0.035 }),
  death: () => [220, 185, 147, 110].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.5, peak: 0.24, delay: i * 0.18, release: 0.3, wet: 0.2 }))
};
