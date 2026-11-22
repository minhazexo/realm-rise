/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// chunkFog — atmospheric perspective for the chunk ground painter.
//
// Extracted from chunkPainter (structure size budget, docs/STRUCTURE.md). The
// horizon haze is a self-contained concern: time-of-day + weather + biome
// driven colour, plus a distance ramp the streaming layer bakes into each
// chunk texture. chunkPainter re-exports this public surface so existing
// importers keep working unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { isGoldenAt, isNightAt } from '../core/Constants.ts';

// ── Atmospheric fog ─────────────────────────────────────────────────────────
// World-space distance (in chunks) at which the chunk starts fading into
// the biome's "fog colour". This gives a sense of depth — distant terrain
// melts into the horizon haze instead of tiling forever.
const FOG_START_CHUNKS = 5;
const FOG_END_CHUNKS   = 9;

/** Atmosphere state consumed by {@link setAtmosphereState}. */
export interface AtmosphereState {
  timeOfDay?: number;
  weather?: string;
}

/**
 * Atmospheric perspective: lerp the chunk canvas toward a biome-tinted
 * haze colour based on distance from the camera. Closer chunks are
 * unmodified; distant chunks fade smoothly into the horizon colour so the
 * world has real depth instead of tiling to infinity.
 *
 * Called from WorldScene after each chunk is drawn onto the layer.
 * Cheap: a single multiplicative compositing pass per active chunk per
 * resize event (not per frame).
 *
 * @param canvas  Chunk canvas produced by getChunkCanvas().
 * @param dx  World-space distance from camera centre to chunk centre (px).
 * @param dy  Unused — keep for symmetry with future 2D-distance fog.
 */
export function applyFogToChunk(canvas: HTMLCanvasElement, dx: number, dy: number): void {
  // Kept as a compatibility shim. Fog is now baked into the scene-local
  // Phaser texture, never the shared procedural canvas. Mutating the cached
  // canvas made fog permanent and caused stale weather/time tints.
  void canvas;
  void dx;
  void dy;
}

export interface FogBakeParams {
  color: string;
  alpha: number;
}

/** Return the fog parameters for a chunk without mutating its base canvas. */
export function getFogBakeParams(dx: number, dy: number, size: number): FogBakeParams {
  if (!shouldApplyFog() || size <= 0) return { color: '#000000', alpha: 0 };
  const distChunks = Math.hypot(dx, dy) / size;
  const t = Math.max(0, Math.min(1,
    (distChunks - FOG_START_CHUNKS) / (FOG_END_CHUNKS - FOG_START_CHUNKS),
  ));
  return { color: getFogBakeColor(), alpha: t * 0.45 };
}

/**
 * Baked-chunk fog colour, quantized to the bucket centre. getFogColor()
 * reads the live clock (right for the per-frame horizon), but chunks baked
 * at different moments inside one 2-game-hour bucket would otherwise carry
 * visibly different tints side by side. Quantizing keeps every chunk in a
 * bucket identical; bucket transitions sweep via the fog-refresh queue.
 */
export function getFogBakeColor(): string {
  const bucket = Math.floor(_fogTimeOfDay * FOG_BUCKETS_PER_DAY);
  const center = (bucket + 0.5) / FOG_BUCKETS_PER_DAY;
  return fogColorAt(center, _fogWeather);
}

// Module-level toggle (the settings system drives this).
let _fogEnabled = true;
export function setFogEnabled(on: boolean): void { _fogEnabled = on; }
function shouldApplyFog(): boolean { return _fogEnabled; }

// Track whether the fog params changed enough to invalidate the cache.
// We re-bake fog only when timeOfDay or weather crosses a threshold.
let _fogSnapshot = '';
let _fogDirty = true;
export function isFogDirty(): boolean { return _fogDirty; }
export function clearFogDirty(): void { _fogDirty = false; }
/** Current fog snapshot key (bucket:weather) — lets the scene restart a
 * stale in-flight sweep when a second flip lands mid-sweep. */
export function fogSnapshot(): string { return _fogSnapshot; }

// Time-of-day + weather tint for the horizon haze. Updated each frame
// from WorldScene via setAtmosphereState().
let _fogBaseColor = '#a9b8c8';
let _fogTimeOfDay = 0.5;
let _fogWeather = 'clear';
const FOG_BUCKETS_PER_DAY = 12;
const _fogBiomeTints: Record<string, string> = {
  plains:   '#8aa872',
  forest:   '#6c8862',
  swamp:    '#586e54',
  mountains:'#8e929b',
  desert:   '#c2a575',
  frozen:   '#c4d0db',
  volcanic: '#7e5a4a',
};
export function setAtmosphereState({ timeOfDay, weather }: AtmosphereState): void {
  if (typeof timeOfDay === 'number') _fogTimeOfDay = timeOfDay;
  if (weather) _fogWeather = weather;
  // Bucket time-of-day — re-bake fog only at bucket change.
  const bucket = Math.floor(_fogTimeOfDay * FOG_BUCKETS_PER_DAY) + ':' + _fogWeather;
  if (bucket !== _fogSnapshot) {
    _fogSnapshot = bucket;
    _fogDirty = true;
    // NOTE: no cache.clear() here — that caused a full rebake hitch every
    // bucket change. Existing chunks are re-baked lazily through the
    // fog-refresh queue (bounded per-frame budget in WorldScene), so a
    // bucket/storm flip sweeps in well under a second with no hitch.
  }
}
export function setFogBiomeTint(biomeId: string, color: string): void {
  if (biomeId && color) _fogBiomeTints[biomeId] = color;
}

/**
 * Compute the current fog colour based on time-of-day + weather + the
 * last-set biome tint. Called per-frame in WorldScene so the horizon
 * matches the sky.
 */
export function getFogColor(): string {
  return fogColorAt(_fogTimeOfDay, _fogWeather);
}

/** Shared fog-colour ramp used by the live horizon and baked chunks. */
function fogColorAt(t: number, weather: string): string {
  const isNight = isNightAt(t);
  const golden = isGoldenAt(t);
  const biomeBase = _fogBiomeTints[_lastFogBiome] || '#a9b8c8';
  const r0 = parseInt(biomeBase.slice(1, 3), 16);
  const g0 = parseInt(biomeBase.slice(3, 5), 16);
  const b0 = parseInt(biomeBase.slice(5, 7), 16);
  let r = r0, g = g0, b = b0;
  if (isNight) {
    r = Math.round(r0 * 0.4 + 18);
    g = Math.round(g0 * 0.4 + 22);
    b = Math.round(b0 * 0.6 + 60);
  } else if (golden && t < 0.5) {
    r = Math.round(r0 * 0.7 + 200);
    g = Math.round(g0 * 0.7 + 130);
    b = Math.round(b0 * 0.7 + 90);
  } else if (golden) {
    r = Math.round(r0 * 0.7 + 200);
    g = Math.round(g0 * 0.7 + 100);
    b = Math.round(b0 * 0.7 + 60);
  }
  if (weather === 'storm') { r = Math.round(r * 0.6); g = Math.round(g * 0.65); b = Math.round(b * 0.75); }
  if (weather === 'fog' || weather === 'drizzle') {
    r = Math.round(r * 0.85 + 140);
    g = Math.round(g * 0.85 + 140);
    b = Math.round(b * 0.85 + 150);
  }
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
let _lastFogBiome = 'plains';
export function setLastFogBiome(id: string): void { if (id) _lastFogBiome = id; }
