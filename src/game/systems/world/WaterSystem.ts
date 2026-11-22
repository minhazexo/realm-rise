// ─────────────────────────────────────────────────────────────────────────────
// Animated water overlay: wave lines, shore foam, water sparkles.
//
// Renders on a transparent canvas that sits above the chunk ground layer.
// Uses sine waves for flowing animation, noise-based foam patterns, and
// sparkle particles for light reflection.
//
// Throttled to every 3 frames for performance (30 Hz visual update).
// ─────────────────────────────────────────────────────────────────────────────
import { elevationAt, RIVER_LEVEL } from '../../world/worldGen.ts';
import { WORLD_CONFIG } from '../../core/Constants.ts';
import { renderScale } from '../../core/VisualProfile.ts';

// ── Constants ───────────────────────────────────────────────────────────────

/** How many game frames between water redraws (lower = smoother, costlier). */
const REDRAW_INTERVAL = 3;
/** Extra world-space padding around the actual camera view. */
const WATER_VIEW_PADDING = 48;
/** Grid step for water sampling (px). Larger = cheaper but coarser. */
const SAMPLE_STEP = 24;
/** Wave line spacing (px). */
const WAVE_SPACING = 18;/** Foam sample step (px). */
const FOAM_STEP = 16;
/** Foam sample step while the camera is moving fast (cheap pass). */
const FOAM_STEP_FAST = 32;

// ── Colour palette ──────────────────────────────────────────────────────────

const CLEAR_WATER  = 'rgba(120,190,230,';
const MURKY_WATER  = 'rgba(90,130,80,';
const FOAM_COLOR   = 'rgba(255,255,255,';
const SPARKLE_COLOR = 'rgba(255,255,255,';

/** Sky-tinted RGB triple reflected by the water wash. */
export interface SkyColor {
  r: number;
  g: number;
  b: number;
}

// Sky-tinted water reflection (overlaid with low alpha) so the water
// picks up the colour of the sky/sun above. Set by EnvSystem via setSkyColor.
let _skyColor: SkyColor = { r: 160, g: 200, b: 240 };
export function setSkyColor(r: number, g: number, b: number): void { _skyColor = { r, g, b }; }
// Sun position (world-space). Used to compute sun glint sparkle clusters.
let _sunPos: { x: number; y: number } | null = null;
export function setSunPosition(x: number, y: number): void { _sunPos = { x, y }; }

// Reference the shared world tunables so the overlay stays in sync with them.
void WORLD_CONFIG;

// ── WaterSystem class ───────────────────────────────────────────────────────

export default class WaterSystem {
  scene: Phaser.Scene;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  frameCount = 0;
  time = 0;
  /** Last camera position where the foam pass used the fine grid. */
  private _lastFoamCell = { x: NaN, y: NaN };
  private _resizeHandler: ((size: { width: number; height: number }) => void) | null = null;
  /** Cached coarse water mask: 0=land, 1=water, 2=shore. Rebuilt only when
   * the camera crosses a 64px cell — hot passes read the mask, never fbm. */
  private _mask: Uint8Array | null = null;
  private _maskCell = { x: NaN, y: NaN };
  private _maskLeft = 0;
  private _maskTop = 0;
  private _maskCols = 0;
  private _maskRows = 0;
  private _hasWater = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.canvas = null;
    this.ctx = null;
    this.frameCount = 0;
    this.time = 0;
  }

  /**
   * Create the overlay canvas (called once from WorldScene.create).
   */
  create(): void {
    const w: number = this.scene.scale.width;
    const h: number = this.scene.scale.height;
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    // The backing store is DEVICE pixels (scale.width is the game canvas's
    // backing size), so the element also needs its CSS size pinned — a canvas
    // with no CSS size lays out at its intrinsic size, which at DPR 1.25+ made
    // this overlay 1.25× the game canvas and slid every wave, foam line and
    // sparkle out of register with the water they belong to.
    canvas.width = w;
    canvas.height = h;
    canvas.style.cssText = `position:absolute;top:0;left:0;pointer-events:none;z-index:10;width:${Math.round(w / renderScale())}px;height:${Math.round(h / renderScale())}px;`;
    this.canvas = canvas;
    // Insert into the game container so it moves with the canvas
    const gameCanvas: HTMLCanvasElement | undefined = this.scene.game.canvas;
    if (gameCanvas?.parentElement) {
      gameCanvas.parentElement.style.position = 'relative';
      gameCanvas.parentElement.appendChild(canvas);
    }
    this.ctx = canvas.getContext('2d');

    // Handle resize (tracked so destroy can unsubscribe — otherwise every
    // Continue piles another listener + canvas wash).
    this._resizeHandler = (size: { width: number; height: number }) => {
      if (this.canvas) {
        this.canvas.width = size.width;
        this.canvas.height = size.height;
        const s: number = renderScale();
        this.canvas.style.width = `${Math.round(size.width / s)}px`;
        this.canvas.style.height = `${Math.round(size.height / s)}px`;
      }
    };
    this.scene.scale.on('resize', this._resizeHandler);
  }

  /**
   * Rebuild the coarse water/shore mask. Only called when the camera
   * crosses a 64px cell — all per-frame passes below read this instead
   * of calling elevationAt (4-octave fbm) thousands of times per redraw.
   */
  private rebuildMask(worldLeft: number, worldTop: number, worldRight: number, worldBottom: number): void {
    const STEP = 32;
    const cols = Math.max(1, Math.ceil((worldRight - worldLeft) / STEP) + 1);
    const rows = Math.max(1, Math.ceil((worldBottom - worldTop) / STEP) + 1);
    const mask = new Uint8Array(cols * rows);
    let hasWater = false;
    for (let r = 0; r < rows; r++) {
      const wy = worldTop + r * STEP;
      for (let c = 0; c < cols; c++) {
        const wx = worldLeft + c * STEP;
        if (elevationAt(wx, wy) < RIVER_LEVEL - 0.02) {
          mask[r * cols + c] = 1;
          hasWater = true;
        }
      }
    }
    // Mark shore: water cells with a land neighbour within 1 cell.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (mask[r * cols + c] !== 1) continue;
        let shore = false;
        for (let dr = -1; dr <= 1 && !shore; dr++) {
          for (let dc = -1; dc <= 1 && !shore; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
            if (mask[nr * cols + nc] === 0) shore = true;
          }
        }
        if (shore) mask[r * cols + c] = 2;
      }
    }
    this._mask = mask;
    this._maskCols = cols;
    this._maskRows = rows;
    this._maskLeft = worldLeft;
    this._maskTop = worldTop;
    this._hasWater = hasWater;
  }

  /** Mask lookup: 0=land, 1=water, 2=shore. Out of bounds → land. */
  private maskAt(wx: number, wy: number): number {
    const m = this._mask;
    if (!m) return 0;
    const STEP = 32;
    const c = Math.floor((wx - this._maskLeft) / STEP);
    const r = Math.floor((wy - this._maskTop) / STEP);
    if (c < 0 || r < 0 || c >= this._maskCols || r >= this._maskRows) return 0;
    return m[r * this._maskCols + c] ?? 0;
  }

  /**
   * Called every frame from WorldScene.update. Throttled internally.
   * @param dt     Delta time in seconds.
   * @param camX   Camera center world X.
   * @param camY   Camera center world Y.
   * @param isNight Whether it's night (affects water colour).
   * @param weather  Current weather ('drizzle', 'storm', etc.).
   */
  update(dt: number, camX: number, camY: number, isNight: boolean, weather: string): void {
    this.frameCount++;
    if (this.frameCount % REDRAW_INTERVAL !== 0) return;

    this.time += dt * REDRAW_INTERVAL; // compensate for throttled updates
    const ctx: CanvasRenderingContext2D | null = this.ctx;
    const canvas: HTMLCanvasElement | null = this.canvas;
    if (!ctx || !canvas) return;

    const w: number = canvas.width;
    const h: number = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Derive the effect bounds from the real camera view. The old fixed
    // 420px radius was only correct around one zoom level and left the water
    // flow/light pass under-filled at wide/zoomed-out views.
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const halfW: number = view?.width ? view.width * 0.5 + WATER_VIEW_PADDING : w * 0.5;
    const halfH: number = view?.height ? view.height * 0.5 + WATER_VIEW_PADDING : h * 0.5;
    const worldLeft: number = camX - halfW;
    const worldTop: number = camY - halfH;
    const worldRight: number = camX + halfW;
    const worldBottom: number = camY + halfH;
    const worldW: number = worldRight - worldLeft;
    const worldH: number = worldBottom - worldTop;

    // World -> screen conversion must respect camera zoom. This keeps flow
    // lines and reflected light evenly spaced when the player zooms in/out.
    const screenX = (wx: number): number => (wx - camX) * (w / Math.max(1, view?.width || worldW)) + w * 0.5;
    const screenY = (wy: number): number => (wy - camY) * (h / Math.max(1, view?.height || worldH)) + h * 0.5;

    // Time-based animation offsets
    const t: number = this.time;
    const wavePhaseX: number = t * 1.2;
    const wavePhaseY: number = t * 0.8;
    const isMurky = false; // could be based on biome

    // ── 0. Sky-tinted base wash (cheap "reflection" of the sky above) ──
    // Only when water is actually in view — it used to veil the whole
    // screen (a fullscreen haze on dry land reads as flare/unclearness).
    // Strength is restrained: it stacks with skyGlow + grade + weather.
    const skyAlpha: number = isNight ? 0.12 : 0.06;

    // Rebuild the coarse mask only when the camera crosses a cell; every
    // pass below reads the mask (zero fbm calls per frame otherwise).
    // A full 16px-grid foam pass was ~2,700 elevationAt (4-octave fbm) calls
    // × 20 redraws/s — the #1 CPU hotspot in the performance audit.
    const maskCellX: number = Math.round(camX / 64);
    const maskCellY: number = Math.round(camY / 64);
    if (!this._mask || maskCellX !== this._maskCell.x || maskCellY !== this._maskCell.y) {
      this._maskCell.x = maskCellX;
      this._maskCell.y = maskCellY;
      this.rebuildMask(worldLeft, worldTop, worldRight, worldBottom);
    }
    // No water in view → paint nothing (skip the fullscreen wash too).
    if (!this._hasWater) return;
    ctx.fillStyle = `rgba(${_skyColor.r},${_skyColor.g},${_skyColor.b},${skyAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── 1. Animated wave lines ────────────────────────────────────────
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    const waterAlpha: number = isNight ? 0.12 : 0.18;

    for (let wy = Math.floor(worldTop / WAVE_SPACING) * WAVE_SPACING; wy < worldBottom; wy += WAVE_SPACING) {
      let drawing = false;
      ctx.beginPath();
      for (let wx = Math.floor(worldLeft / SAMPLE_STEP) * SAMPLE_STEP; wx <= worldRight; wx += SAMPLE_STEP) {
        if (this.maskAt(wx, wy) === 0) {
          if (drawing) { ctx.stroke(); ctx.beginPath(); drawing = false; }
          continue;
        }
        // Convert world coords to screen coords
        const sx: number = screenX(wx);
        const sy: number = screenY(wy);
        // Sine wave displacement — flowing left-to-right
        const displacement: number = Math.sin(wx * 0.015 + wavePhaseX) * 3
          + Math.sin(wy * 0.02 + wavePhaseY) * 2
          + Math.sin((wx + wy) * 0.008 + t * 0.5) * 1.5;

        if (!drawing) {
          ctx.strokeStyle = (isMurky ? MURKY_WATER : CLEAR_WATER) + waterAlpha + ')';
          ctx.moveTo(sx, sy + displacement);
          drawing = true;
        } else {
          ctx.lineTo(sx, sy + displacement);
        }
      }
      if (drawing) ctx.stroke();
    }

    // ── 1b. Sun glint: bright cluster of sparkles near the sun reflection
    // point on water. Only visible during the day. Creates the iconic
    // "shimmering path of light" effect.
    if (!isNight && _sunPos) {
      const dx: number = _sunPos.x - camX;
      const dy: number = _sunPos.y - camY;
      const dist: number = Math.hypot(dx, dy);
      // Reflection band runs roughly perpendicular to the sun direction.
      // We just scatter sparkles in a tight ring within 220px of the
      // sun's screen position.
      const ringR: number = Math.min(180, dist * 0.25);
      const glintCount = 12;
      for (let i = 0; i < glintCount; i++) {
        const a: number = (i / glintCount) * Math.PI * 2 + t * 0.4;
        const r: number = ringR * (0.6 + Math.sin(i * 1.7 + t * 2.1) * 0.4);
      const sx: number = screenX(_sunPos.x) + Math.cos(a) * r;
      const sy: number = screenY(_sunPos.y) + Math.sin(a) * r * 0.45; // squashed vertically
        if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
        // Only draw on water (mask lookup — no fbm in the hot loop).
        const gwx: number = camX + (sx - w / 2) * (Math.max(1, view?.width || worldW) / w);
        const gwy: number = camY + (sy - h / 2) * (Math.max(1, view?.height || worldH) / h);
        if (this.maskAt(gwx, gwy) === 0) continue;
        const twinkle: number = 0.4 + 0.6 * Math.sin(t * 4 + i * 1.3);
        const sz: number = 1.4 + Math.sin(t * 2 + i) * 1.0;
        ctx.globalAlpha = 0.32 * twinkle;
        ctx.fillStyle = SPARKLE_COLOR;
        ctx.beginPath();
        ctx.moveTo(sx, sy - sz);
        ctx.lineTo(sx + sz * 0.6, sy);
        ctx.lineTo(sx, sy + sz);
        ctx.lineTo(sx - sz * 0.6, sy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── 2. Shore foam ────────────────────────────────────────────────────
    // Reads the cached shore mask (mask==2) instead of sampling elevationAt
    // per dot. The old pass called 4-octave fbm at every 16px grid point
    // (~2,700 noise calls × 20 redraws/s). Animation (pulse/radius) is still
    // per-frame — only the shore classification is cached.
    ctx.lineWidth = 2;
    const foamAlpha: number = isNight ? 0.2 : 0.3;
    const camCellX: number = Math.round(camX / 64);
    const camCellY: number = Math.round(camY / 64);
    const fineThisFrame: boolean = camCellX !== this._lastFoamCell.x || camCellY !== this._lastFoamCell.y;
    if (fineThisFrame) { this._lastFoamCell.x = camCellX; this._lastFoamCell.y = camCellY; }
    const step: number = fineThisFrame ? FOAM_STEP : FOAM_STEP_FAST;
    for (let wy = Math.floor(worldTop / step) * step; wy < worldBottom; wy += step) {
      for (let wx = Math.floor(worldLeft / step) * step; wx <= worldRight; wx += step) {
        // Foam line: coarse mask gates (cheap), then a precise elevation
        // check confirms the exact shore band — the 32px mask alone
        // quantized foam into blocky steps on slow pans. Only shore
        // candidates pay for fbm, not the whole grid.
        if (this.maskAt(wx, wy) !== 2) continue;
        const e: number = elevationAt(wx, wy);
        if (e >= RIVER_LEVEL - 0.01 || e <= RIVER_LEVEL - 0.065) continue;
          const sx: number = screenX(wx);
          const sy: number = screenY(wy);
          // Animated foam — pulsing alpha
          const pulse: number = 0.5 + 0.5 * Math.sin(wx * 0.04 + wy * 0.03 + t * 2.5);
          ctx.globalAlpha = foamAlpha * pulse;
          ctx.fillStyle = FOAM_COLOR + '0.6)';
          // Small foam dot
          const fr: number = 1.5 + Math.sin(wx * 0.1 + t * 1.8) * 0.8;
          ctx.beginPath();
          ctx.arc(sx, sy, fr, 0, Math.PI * 2);
          ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ── 3. Water sparkles (light reflections) ────────────────────────
    const sparkleAlpha: number = isNight ? 0.08 : 0.2;
    const sparkleCount = 20;
    for (let i = 0; i < sparkleCount; i++) {
      // Deterministic but shifting sparkle positions
      const hash: number = (i * 7919 + Math.floor(t * 0.3) * 1301) % 10000;
      const wx: number = worldLeft + (hash / 10000) * (worldRight - worldLeft);
      const wy: number = worldTop + ((hash * 3 + i * 37) % 10000) / 10000 * (worldBottom - worldTop);
      if (this.maskAt(wx, wy) === 0) continue;

      const sx: number = screenX(wx);
      const sy: number = screenY(wy);
      // Twinkle: alpha oscillates per-sparkle
      const twinkle: number = 0.3 + 0.7 * Math.sin(t * 3.5 + i * 2.1);
      ctx.globalAlpha = sparkleAlpha * twinkle;
      ctx.fillStyle = SPARKLE_COLOR;
      const sz: number = 1.5 + Math.sin(t * 2 + i * 1.7) * 0.8;
      // Diamond sparkle shape
      ctx.beginPath();
      ctx.moveTo(sx, sy - sz);
      ctx.lineTo(sx + sz * 0.6, sy);
      ctx.lineTo(sx, sy + sz);
      ctx.lineTo(sx - sz * 0.6, sy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── 4. Storm rain streaks on water surface ───────────────────────
    if (weather === 'drizzle' || weather === 'storm') {
      const streakCount: number = weather === 'storm' ? 12 : 5;
      ctx.strokeStyle = 'rgba(200,220,255,0.2)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < streakCount; i++) {
        const hash2: number = (i * 3571 + Math.floor(t * 8) * 997) % 10000;
        const wx: number = worldLeft + (hash2 / 10000) * (worldRight - worldLeft);
        const wy: number = worldTop + ((hash2 * 7 + i * 523) % 10000) / 10000 * (worldBottom - worldTop);
        if (this.maskAt(wx, wy) === 0) continue;
        const sx: number = screenX(wx);
        const sy: number = screenY(wy);
        const len: number = 4 + Math.sin(t * 5 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 1, sy + len);
        ctx.stroke();
      }
    }
  }

  /**
   * Clean up (called on scene shutdown).
   */
  destroy(): void {
    try {
      const scale = this.scene.scale as unknown as { off?: (ev: string, fn: unknown) => void };
      if (scale.off && this._resizeHandler) scale.off('resize', this._resizeHandler);
    } catch { /* ignore */ }
    this._resizeHandler = null;
    const canvas: HTMLCanvasElement | null = this.canvas;
    if (canvas?.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
