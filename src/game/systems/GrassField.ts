// ─────────────────────────────────────────────────────────────────────────────
// GrassField — realistic grass overlay (spec: "make the grass more realistic").
//
// Three layers of life for near-zero cost, all built on ONE shared canvas:
//
//   1. Procedural blades — a 160×64 canvas tile with 150 individually drawn
//      two-tone blades (dark green base → yellow-green tip, 3 green casts,
//      slight S-bend) is painted once and stamped over the ground through
//      tileSprite slabs. Positions are uniform-random (a step grid bands into
//      visible stripes — caught on screenshot) and every blade is drawn at 9
//      wrapped copies so slabs tile seamlessly with no clipped edges. Slight
//      translucency keeps the chunk painter's baked tufts visible beneath.
//
//   2. Wind — every slab's `tilePositionX` is a phase-offset sine of a shared
//      clock (one blit moves all blades in that slab; animating the texture
//      offset, not thousands of objects). Amplitude follows weather
//      (storm 9px … heat 2px) and time of day (golden hour sways harder;
//      night barely whispers). Reduced motion freezes the field; particles
//      'off' removes the overlay entirely.
//
//   3. Trample — the slab under the player flattens (tileScaleY 0.86 + alpha
//      dip = compressed blades) and springs back over ~0.45s after they step
//      away. A dt-lerped per-slab progress value, deliberately tween-free so
//      wind/trample can never fight over the same properties.
//
// Coverage — the invariant is "every visible pixel is inside some live slab":
//   slabs live on a WORLD-anchored 160×64 lattice (camera-relative keys drift
//   with the camera and once spawned 3,855 duplicates). Each 0.25s refresh:
//   hide slabs whose centre left the keep-window, REVIVE parked ones back
//   inside it, then enqueue gaps (≤8 tileSprite builds/frame — sized to
//   out-drain one refresh's worth of new cells). The keep-window extends
//   half a tile beyond the view edge so slab bodies always reach the screen
//   edge, plus 24px hysteresis so boundary slabs don't flip on 1px moves.
//   Parked tiles are capped (240) — oldest destroyed on a long trek.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { WORLD_CONFIG } from '../core/Constants.ts';
import { biomeAt, isWaterAt } from '../world/worldGen.ts';
import { reducedMotion } from './SettingsSystem.ts';

const TILE_W = 160;
const TILE_H = 64;
/** Slabs hide/revive only past the view edge plus half a tile (bodies must reach the screen edge)… */
const HIDE_BEYOND = 24;      // …plus this hysteresis so edge slabs don't flip.
const EDGE_X = TILE_W / 2 + HIDE_BEYOND;
const EDGE_Y = TILE_H / 2 + HIDE_BEYOND;
/** Blade margin: blades may start this far outside the canvas (wrap copies cover it). */
const OVERLAP = 22;
/** Blades painted per tile canvas. */
const BLADES_PER_TILE = 150;
/** Shared texture key. */
const TEX_KEY = 'grass_blades_tile';
/** Coverage refresh cadence (seconds). */
const REFRESH_EVERY = 0.25;
/** Slab builds per frame (out-drains ~90 queued cells within one refresh). */
const BUILDS_PER_FRAME = 8;
/** Trample radius around the player (px) and flatten/spring durations (s). */
const TRAMPLE_R = 26;
const TRAMPLE_IN = 0.13;
const TRAMPLE_OUT = 0.45;
/** Parked (hidden) tile pool cap. */
const HIDDEN_CAP = 240;
/** Non-green biomes: no overlay. */
const BARREN = ['frozen', 'desert', 'mountains', 'volcanic'];
/**
 * Water sampling for a slab: 5 points (centre + 4 at 70% half-extent).
 * ≥3 water → no grass (a lake is not a meadow); 1–2 water → shoreline
 * slab, faded so blades thin out toward the water instead of stopping
 * on a hard grid line.
 */
function waterScore(sx: number, sy: number): number {
  const dx = TILE_W * 0.35, dy = TILE_H * 0.35;
  const pts: Array<[number, number]> = [
    [sx, sy],
    [sx - dx, sy - dy], [sx + dx, sy - dy],
    [sx - dx, sy + dy], [sx + dx, sy + dy]
  ];
  let wet = 0;
  for (const [x, y] of pts) if (isWaterAt(x, y)) wet++;
  return wet;
}

/** Wind amplitude (px of texture ripple) per weather id. */
const WEATHER_AMP: Record<string, number> = {
  clear: 3.5, drizzle: 5.5, storm: 9, snow: 4, fog: 3, heat: 2
};

/** Per-slab runtime state. */
interface Slab {
  tile: Phaser.GameObjects.TileSprite;
  sx: number;
  sy: number;
  phase: number;      // wind ripple phase offset
  trample: number;    // 0 = upright … 1 = fully flattened
  baseAlpha: number;  // 0.8 inland, faded on shoreline slabs
}

type GrassScene = Phaser.Scene & { player?: { sprite?: { x: number; y: number } } };

export default class GrassField {
  private scene: GrassScene;
  private slabs = new Map<string, Slab>();
  /** Slabs parked outside the keep-window (tile kept alive for revival). */
  private hidden = new Map<string, Slab>();
  private _t = 0;
  private _refreshAcc = 0;
  private _biome: string | null = null;
  private _weather = 'clear';
  /** Pending slab builds (world coords), drained BUILDS_PER_FRAME per frame. */
  private _buildQueue: Array<[number, number]> = [];

  constructor(scene: GrassScene) {
    this.scene = scene;
  }

  create(): void {
    this.buildTexture();
    const view = this.scene.cameras.main.worldView;
    this.enqueueWindow(view.x, view.y, view.width, view.height);
    this.flushBuildQueue(64); // initial paint is one generous flush
  }

  /**
   * Paint the shared blade tile once per session.
   *
   * Visual spec (learned from the first live screenshot): blades are GREEN
   * two-tone strokes (dark base → yellow-green tip) — white highlights read
   * as dead stalks. Positions are uniform-random across the whole tile (a
   * step grid bands into visible stripes), and every blade is drawn at 9
   * wrapped copies so the tile seams perfectly with no clipped edges.
   */
  private buildTexture(): void {
    if (this.scene.textures.exists(TEX_KEY)) return;
    const canvas = document.createElement('canvas');
    canvas.width = TILE_W;
    canvas.height = TILE_H;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.lineCap = 'round';

    for (let i = 0; i < BLADES_PER_TILE; i++) {
      const bx = Math.random() * (TILE_W + OVERLAP * 2) - OVERLAP;
      const by = Math.random() * TILE_H;
      const h = 6 + Math.random() * 10;            // blade length (px)
      const w = 1.6 + Math.random() * 1.4;         // blade width (px)
      const lean = (Math.random() - 0.5) * 10;     // tip drift (px)
      const sCurve = (Math.random() - 0.5) * 6;    // slight S-bend
      // Three green casts so the field never reads as one flat hue.
      const family = Math.random();
      const [base, tip]: [string, string] = family < 0.4
        ? ['rgba(30,58,26,0.55)', 'rgba(64,104,44,0.5)']    // deep grass
        : family < 0.75
          ? ['rgba(40,74,32,0.5)', 'rgba(88,132,56,0.45)']  // classic
          : ['rgba(52,88,38,0.45)', 'rgba(120,150,64,0.38)']; // sunlit
      for (const dx of [-TILE_W, 0, TILE_W]) {
        for (const dy of [-TILE_H, 0, TILE_H]) {
          const x = bx + dx, y = by + dy;
          // Skip copies whose blade bbox misses the canvas entirely.
          if (x + Math.max(6, lean + 2) < 0 || x - 2 > TILE_W) continue;
          if (y < -h || y - h > TILE_H + h) continue;
          // Body: thick dark stroke from root to 60% length.
          ctx.strokeStyle = base;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + lean * 0.3 + sCurve, y - h * 0.35, x + lean * 0.7, y - h * 0.6);
          ctx.stroke();
          // Tip: thinner lighter stroke continues to the blade end.
          ctx.strokeStyle = tip;
          ctx.lineWidth = w * 0.55;
          ctx.beginPath();
          ctx.moveTo(x + lean * 0.7, y - h * 0.6);
          ctx.quadraticCurveTo(x + lean * 0.9, y - h * 0.8, x + lean + sCurve * 0.5, y - h);
          ctx.stroke();
        }
      }
    }
    this.scene.textures.addCanvas(TEX_KEY, canvas);
  }

  /**
   * Enqueue every lattice cell overlapping the given world rect expanded by
   * the keep-window edge. The grid is anchored to WORLD coordinates (snapped
   * to the tile lattice), NOT to the live camera — camera drift would produce
   * fractional keys that never match, and every refresh would spawn duplicate
   * slabs (observed live: 3,855 slabs after a few seconds).
   */
  private enqueueWindow(wx: number, wy: number, ww: number, wh: number): void {
    const x0 = Math.floor((wx - EDGE_X) / TILE_W) * TILE_W;
    const y0 = Math.floor((wy - EDGE_Y) / TILE_H) * TILE_H;
    for (let sy = y0; sy < wy + wh + EDGE_Y; sy += TILE_H) {
      for (let sx = x0; sx < wx + ww + EDGE_X; sx += TILE_W) {
        this._buildQueue.push([sx + TILE_W / 2, sy + TILE_H / 2]);
      }
    }
  }

  /** Spawn one slab centred at (sx, sy) — or revive a parked one. */
  private spawnSlab(sx: number, sy: number): void {
    const key = `${sx},${sy}`;
    if (this.slabs.has(key)) return; // already covered
    // Grass never grows in water: skip wet cells outright, fade shore cells.
    const wet = waterScore(sx, sy);
    if (wet >= 3) {
      const stale = this.hidden.get(key);
      if (stale) { stale.tile.destroy(); this.hidden.delete(key); }
      return;
    }
    const hid = this.hidden.get(key);
    if (hid) {
      this.hidden.delete(key);
      this.revive(hid);
      this.slabs.set(key, hid);
      return;
    }
    const baseAlpha = wet > 0 ? 0.8 - 0.28 * wet : 0.8;
    const tile = this.scene.add.tileSprite(sx, sy, TILE_W, TILE_H, TEX_KEY)
      .setOrigin(0.5)
      // Just above the ground images (depth −worldHalf*2), below everything else.
      .setDepth(-WORLD_CONFIG.worldHalfExtent * 2 + 1)
      .setAlpha(baseAlpha);
    this.slabs.set(key, {
      tile, sx, sy,
      phase: (sx * 0.017 + sy * 0.031) % (Math.PI * 2), // spatially coherent phase
      trample: 0,
      baseAlpha
    });
  }

  /** Build queued slabs, capped per call so streaming never hitches. */
  private flushBuildQueue(max: number): void {
    while (max-- > 0 && this._buildQueue.length) {
      const [sx, sy] = this._buildQueue.shift()!;
      this.spawnSlab(sx, sy);
    }
  }

  /**
   * Per-frame tick: wind ripple, coverage recycling, trample.
   * Call from WorldScene.update with the frame delta in seconds.
   */
  update(dt: number): void {
    const S = GameState.s;
    if (!S) return;
    this._t += dt;
    const reduced = reducedMotion();
    if (this.particleMult() === 0) return;

    // ── Biome gate ──────────────────────────────────────────────────────
    const p = this.scene.player?.sprite;
    const px = p?.x ?? 0, py = p?.y ?? 0;
    const biome = biomeAt(px, py);
    if (biome !== this._biome) {
      this._biome = biome;
      this.applyBiomeVisibility(BARREN.includes(biome));
    }
    if (BARREN.includes(this._biome ?? '')) return;

    // ── Wind amplitude: weather × time-of-day ──────────────────────────
    const tod = S.world.timeOfDay;
    const golden = (tod > 0.22 && tod < 0.32) || (tod > 0.72 && tod < 0.82);
    const night = tod > 0.78 || tod < 0.24;
    const todAmp = night ? 1.8 : golden ? 4.5 : 3.5;
    const amp = ((WEATHER_AMP[this._weather] ?? 3.5) + todAmp) * 0.5;

    // ── Wind ripple (deterministic sine, one blit per slab) ────────────
    if (!reduced) {
      const phase = this._t * 1.15;
      for (const { tile, phase: ph } of this.slabs.values()) {
        if (!tile.visible) continue;
        tile.tilePositionX = Math.sin(phase + ph) * amp;
      }
    }

    // ── Coverage recycling + rebuilds (slow cadence) ───────────────────
    this._refreshAcc += dt;
    if (this._refreshAcc >= REFRESH_EVERY) {
      this._refreshAcc = 0;
      this.refreshCoverage();
    }
    this.flushBuildQueue(BUILDS_PER_FRAME);

    // ── Trample ─────────────────────────────────────────────────────────
    this.updateTrample(px, py, dt);
  }

  /** Show/hide the whole overlay when the biome changes. */
  private applyBiomeVisibility(barren: boolean): void {
    if (barren) {
      for (const [key, slab] of this.slabs) {
        slab.tile.setVisible(false);
        this.hidden.set(key, slab);
        this.slabs.delete(key);
      }
    } else {
      // Return to lush: re-enqueue the window (revival happens in spawnSlab).
      const view = this.scene.cameras.main.worldView;
      this.enqueueWindow(view.x, view.y, view.width, view.height);
      this.flushBuildQueue(64); // biome change is rare — one generous flush
    }
  }

  /**
   * Coverage pass — the invariant is "every visible pixel is inside some
   * live slab". Hide slabs past the keep-window, REVIVE parked ones back
   * inside it (a prior version skipped revival: walking back over old ground
   * left permanent gaps), then enqueue gaps.
   */
  private refreshCoverage(): void {
    const view = this.scene.cameras.main.worldView;
    const mx = view.width / 2 + EDGE_X;
    const my = view.height / 2 + EDGE_Y;
    const cx = view.centerX, cy = view.centerY;

    // Revive parked slabs back inside the keep-window.
    for (const [key, slab] of this.hidden) {
      if (Math.abs(slab.sx - cx) <= mx && Math.abs(slab.sy - cy) <= my) {
        this.hidden.delete(key);
        this.revive(slab);
        this.slabs.set(key, slab);
      }
    }
    // Hide live slabs outside the keep-window (park for revival).
    for (const [key, slab] of this.slabs) {
      const out = Math.abs(slab.sx - cx) > mx || Math.abs(slab.sy - cy) > my;
      if (out && slab.tile.visible) {
        slab.tile.setVisible(false);
        if (this.hidden.size > HIDDEN_CAP) {
          // Destroy the oldest parked tile so a long trek can't accumulate.
          const oldest = this.hidden.keys().next().value;
          if (oldest !== undefined) {
            const old = this.hidden.get(oldest);
            if (old) old.tile.destroy();
            this.hidden.delete(oldest);
          }
        }
        this.hidden.set(key, slab);
        this.slabs.delete(key);
      }
    }
    // Enqueue gaps inside the window (drops entries already covered and
    // anything outside the window — e.g. queue backlog from a fast walk).
    this.enqueueWindow(view.x, view.y, view.width, view.height);
    this._buildQueue = this._buildQueue.filter(([qx, qy]) => {
      const key = `${qx},${qy}`;
      if (Math.abs(qx - cx) > mx || Math.abs(qy - cy) > my) return false;
      return !this.slabs.has(key);
    });
  }

  /** Restore a parked slab to service. */
  private revive(slab: Slab): void {
    slab.tile.setVisible(true).setAlpha(slab.baseAlpha).setTileScale(1, 1);
    slab.trample = 0;
  }

  /**
   * Flatten the slab under the player; spring back when they step away.
   * Deterministic dt-scaled lerp (no tweens) so wind/trample never fight
   * over the same properties, and the speed is frame-rate independent.
   */
  private updateTrample(px: number, py: number, dt: number): void {
    for (const slab of this.slabs.values()) {
      const near = Math.abs(slab.sx - px) < TILE_W / 2 + TRAMPLE_R &&
                   Math.abs(slab.sy - py) < TILE_H / 2 + TRAMPLE_R;
      const want = near ? 1 : 0;
      if (slab.trample === want) continue;
      const step = dt / (near ? TRAMPLE_IN : TRAMPLE_OUT);
      slab.trample = want > slab.trample
        ? Math.min(1, slab.trample + step)
        : Math.max(0, slab.trample - step);
      const k = slab.trample;
      slab.tile.setTileScale(1, 1 - 0.14 * k);
      slab.tile.setAlpha(slab.baseAlpha - 0.18 * k);
    }
  }

  /** Weather hook — WorldScene calls this on weather-changed. */
  setWeather(w: string): void {
    this._weather = w;
  }

  private particleMult(): number {
    const map: Record<string, number> = { off: 0, low: 0.35, med: 0.7, high: 1 };
    const p = GameState.s?.settings?.particles || 'high';
    return map[p] ?? 1;
  }

  /** Tear down all objects (scene shutdown). */
  destroy(): void {
    for (const slab of this.slabs.values()) slab.tile.destroy();
    for (const slab of this.hidden.values()) slab.tile.destroy();
    this.slabs.clear();
    this.hidden.clear();
    this._buildQueue = [];
  }
}
