// ─────────────────────────────────────────────────────────────────────────────
// Rise of the Realm — Math / RNG utilities (pure, testable)
// TS pilot module: strict types, zero runtime deps.
// ─────────────────────────────────────────────────────────────────────────────

export const TAU: number = Math.PI * 2;

export type Rng = () => number;

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt(dist2(ax, ay, bx, by));

export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export const angleDiff = (a: number, b: number): number => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export const formatNum = (n: number): string => {
  n = Math.round(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'k';
  return String(n);
};

// ── Deterministic RNG ────────────────────────────────────────────────────────

/** Fast 32-bit PRNG. Returns [0, 1). */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Deterministic hash of an integer coordinate pair → [0,1). Used for per-cell world layout. */
export const hash2 = (x: number, y: number, seed = 0): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const randomSeed = (): number => (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;

export const pickFrom = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)] as T;

export const weightedPick = <T>(rng: Rng, pairs: ReadonlyArray<readonly [T, number]>): T => {
  let total = 0;
  for (const p of pairs) total += p[1];
  let r = rng() * total;
  for (const p of pairs) {
    r -= p[1];
    if (r <= 0) return p[0];
  }
  return pairs[pairs.length - 1]![0];
};

// ── Value noise (smooth, seedable, tileable enough for our world scale) ─────

function noise2(ix: number, iy: number, seed: number): number {
  return hash2(ix, iy, seed);
}

/** Smooth 2D value noise at arbitrary coordinates. */
export function valueNoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);
  const n00 = noise2(ix, iy, seed);
  const n10 = noise2(ix + 1, iy, seed);
  const n01 = noise2(ix, iy + 1, seed);
  const n11 = noise2(ix + 1, iy + 1, seed);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

/** Fractal brownian motion built on valueNoise. Returns [0, 1). */
export function fbm(x: number, y: number, seed = 0, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ridged variant — great for mountain ridges. */
export function ridged(x: number, y: number, seed = 0, octaves = 3): number {
  let amp = 0.6;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq, seed + i * 7717) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.55;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Very small object pool for float texts / particles entities. */
export class Pool<T> {
  private factory: () => T;
  private reset: (obj: T, ...args: unknown[]) => void;
  private free: T[] = [];
  activeCount = 0;
  constructor(factory: () => T, reset: (obj: T, ...args: unknown[]) => void = () => {}) {
    this.factory = factory;
    this.reset = reset;
  }
  obtain(...args: unknown[]): T {
    const obj = this.free.pop() ?? this.factory();
    this.reset(obj, ...args);
    this.activeCount++;
    return obj;
  }
  release(obj: T): void {
    this.activeCount--;
    this.free.push(obj);
  }
}
