// ─────────────────────────────────────────────────────────────────────────────
// Animated water overlay: wave lines, shore foam, water sparkles.
//
// Renders on a transparent canvas that sits above the chunk ground layer.
// Uses sine waves for flowing animation, noise-based foam patterns, and
// sparkle particles for light reflection.
//
// Throttled to every 3 frames for performance (30 Hz visual update).
// ─────────────────────────────────────────────────────────────────────────────
import { elevationAt, RIVER_LEVEL } from '../world/worldGen.js';
import { WORLD_CONFIG } from '../core/Constants.js';

// ── Constants ───────────────────────────────────────────────────────────────

/** How many game frames between water redraws (lower = smoother, costlier). */
const REDRAW_INTERVAL = 3;
/** World-space pixel radius around the camera to draw water effects. */
const WATER_VIEW_RADIUS = 420;
/** Grid step for water sampling (px). Larger = cheaper but coarser. */
const SAMPLE_STEP = 24;
/** Wave line spacing (px). */
const WAVE_SPACING = 18;
/** Foam sample step (px). */
const FOAM_STEP = 16;

// ── Colour palette ──────────────────────────────────────────────────────────

const CLEAR_WATER  = 'rgba(120,190,230,';
const MURKY_WATER  = 'rgba(90,130,80,';
const FOAM_COLOR   = 'rgba(255,255,255,';
const SPARKLE_COLOR = 'rgba(255,255,255,';
// Sky-tinted water reflection (overlaid with low alpha) so the water
// picks up the colour of the sky/sun above. Set by EnvSystem via setSkyColor.
let _skyColor = { r: 160, g: 200, b: 240 };
export function setSkyColor(r, g, b) { _skyColor = { r, g, b }; }
// Sun position (world-space). Used to compute sun glint sparkle clusters.
let _sunPos = null;
export function setSunPosition(x, y) { _sunPos = { x, y }; }

// ── WaterSystem class ───────────────────────────────────────────────────────

export default class WaterSystem {
  constructor(scene) {
    this.scene = scene;
    this.canvas = null;
    this.ctx = null;
    this.frameCount = 0;
    this.time = 0;
  }

  /**
   * Create the overlay canvas (called once from WorldScene.create).
   */
  create() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:10;';
    // Insert into the game container so it moves with the canvas
    const gameCanvas = this.scene.game.canvas;
    if (gameCanvas?.parentElement) {
      gameCanvas.parentElement.style.position = 'relative';
      gameCanvas.parentElement.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');

    // Handle resize
    this.scene.scale.on('resize', (size) => {
      this.canvas.width = size.width;
      this.canvas.height = size.height;
    });
  }

  /**
   * Called every frame from WorldScene.update. Throttled internally.
   * @param {number} dt     Delta time in seconds.
   * @param {number} camX   Camera center world X.
   * @param {number} camY   Camera center world Y.
   * @param {boolean} isNight Whether it's night (affects water colour).
   * @param {string} weather  Current weather ('drizzle', 'storm', etc.).
   */
  update(dt, camX, camY, isNight, weather) {
    this.frameCount++;
    if (this.frameCount % REDRAW_INTERVAL !== 0) return;

    this.time += dt * REDRAW_INTERVAL; // compensate for throttled updates
    const ctx = this.ctx;
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // World-space bounds of the visible area
    const halfW = WATER_VIEW_RADIUS;
    const halfH = WATER_VIEW_RADIUS * (h / w);
    const worldLeft = camX - halfW;
    const worldTop = camY - halfH;
    const worldRight = camX + halfW;
    const worldBottom = camY + halfH;

    // Time-based animation offsets
    const t = this.time;
    const wavePhaseX = t * 1.2;
    const wavePhaseY = t * 0.8;
    const isMurky = false; // could be based on biome

    // ── 0. Sky-tinted base wash (cheap "reflection" of the sky above) ──
    // Renders a translucent sky-coloured wash over all water pixels.
    // Strength follows time-of-day: stronger at night (water reflects stars),
    // softer by day.
    const skyAlpha = isNight ? 0.18 : 0.10;
    ctx.fillStyle = `rgba(${_skyColor.r},${_skyColor.g},${_skyColor.b},${skyAlpha})`;
    ctx.fillRect(0, 0, w, h);

    // ── 1. Animated wave lines ────────────────────────────────────────
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    const waterAlpha = isNight ? 0.12 : 0.18;

    for (let wy = Math.floor(worldTop / WAVE_SPACING) * WAVE_SPACING; wy < worldBottom; wy += WAVE_SPACING) {
      let drawing = false;
      ctx.beginPath();
      for (let wx = Math.floor(worldLeft / SAMPLE_STEP) * SAMPLE_STEP; wx <= worldRight; wx += SAMPLE_STEP) {
        const e = elevationAt(wx, wy);
        if (e >= RIVER_LEVEL - 0.02) {
          if (drawing) { ctx.stroke(); ctx.beginPath(); drawing = false; }
          continue;
        }
        // Convert world coords to screen coords
        const sx = wx - worldLeft;
        const sy = wy - worldTop;
        // Sine wave displacement — flowing left-to-right
        const displacement = Math.sin(wx * 0.015 + wavePhaseX) * 3
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
      const dx = _sunPos.x - camX;
      const dy = _sunPos.y - camY;
      const dist = Math.hypot(dx, dy);
      // Reflection band runs roughly perpendicular to the sun direction.
      // We just scatter sparkles in a tight ring within 220px of the
      // sun's screen position.
      const ringR = Math.min(180, dist * 0.25);
      const glintCount = 12;
      for (let i = 0; i < glintCount; i++) {
        const a = (i / glintCount) * Math.PI * 2 + t * 0.4;
        const r = ringR * (0.6 + Math.sin(i * 1.7 + t * 2.1) * 0.4);
        const sx = w / 2 + dx + Math.cos(a) * r;
        const sy = h / 2 + dy + Math.sin(a) * r * 0.45; // squashed vertically
        if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
        // Only draw on water (cheap: sample elevation at the world point)
        const wx = camX + sx - w / 2;
        const wy = camY + sy - h / 2;
        if (elevationAt(wx, wy) >= RIVER_LEVEL - 0.02) continue;
        const twinkle = 0.4 + 0.6 * Math.sin(t * 4 + i * 1.3);
        const sz = 1.4 + Math.sin(t * 2 + i) * 1.0;
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

    // ── 2. Shore foam ────────────────────────────────────────────────
    ctx.lineWidth = 2;
    const foamAlpha = isNight ? 0.2 : 0.3;
    for (let wy = Math.floor(worldTop / FOAM_STEP) * FOAM_STEP; wy < worldBottom; wy += FOAM_STEP) {
      for (let wx = Math.floor(worldLeft / FOAM_STEP) * FOAM_STEP; wx <= worldRight; wx += FOAM_STEP) {
        const e = elevationAt(wx, wy);
        // Foam line: just at the shore edge
        if (e < RIVER_LEVEL - 0.01 && e > RIVER_LEVEL - 0.065) {
          const sx = wx - worldLeft;
          const sy = wy - worldTop;
          // Animated foam — pulsing alpha
          const pulse = 0.5 + 0.5 * Math.sin(wx * 0.04 + wy * 0.03 + t * 2.5);
          ctx.globalAlpha = foamAlpha * pulse;
          ctx.fillStyle = FOAM_COLOR + '0.6)';
          // Small foam dot
          const fr = 1.5 + Math.sin(wx * 0.1 + t * 1.8) * 0.8;
          ctx.beginPath();
          ctx.arc(sx, sy, fr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    // ── 3. Water sparkles (light reflections) ────────────────────────
    const sparkleAlpha = isNight ? 0.08 : 0.2;
    const sparkleCount = 20;
    for (let i = 0; i < sparkleCount; i++) {
      // Deterministic but shifting sparkle positions
      const hash = (i * 7919 + Math.floor(t * 0.3) * 1301) % 10000;
      const wx = worldLeft + (hash / 10000) * (worldRight - worldLeft);
      const wy = worldTop + ((hash * 3 + i * 37) % 10000) / 10000 * (worldBottom - worldTop);
      const e = elevationAt(wx, wy);
      if (e >= RIVER_LEVEL - 0.03) continue;

      const sx = wx - worldLeft;
      const sy = wy - worldTop;
      // Twinkle: alpha oscillates per-sparkle
      const twinkle = 0.3 + 0.7 * Math.sin(t * 3.5 + i * 2.1);
      ctx.globalAlpha = sparkleAlpha * twinkle;
      ctx.fillStyle = SPARKLE_COLOR;
      const sz = 1.5 + Math.sin(t * 2 + i * 1.7) * 0.8;
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
      const streakCount = weather === 'storm' ? 12 : 5;
      ctx.strokeStyle = 'rgba(200,220,255,0.2)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < streakCount; i++) {
        const hash2 = (i * 3571 + Math.floor(t * 8) * 997) % 10000;
        const wx = worldLeft + (hash2 / 10000) * (worldRight - worldLeft);
        const wy = worldTop + ((hash2 * 7 + i * 523) % 10000) / 10000 * (worldBottom - worldTop);
        const e = elevationAt(wx, wy);
        if (e >= RIVER_LEVEL - 0.02) continue;
        const sx = wx - worldLeft;
        const sy = wy - worldTop;
        const len = 4 + Math.sin(t * 5 + i) * 2;
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
  destroy() {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }
}
