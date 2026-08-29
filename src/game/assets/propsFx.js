// ─────────────────────────────────────────────────────────────────────────────
// FX particles, projectiles, lighting, weather sprites + menu backdrop pieces.
//
// Textures produced:
//   Particles — pt_spark, pt_leaf, pt_rain, pt_snow, pt_smoke, pt_firefly
//   Combat    — fx_shadow, fx_light, fx_slash1/2/3, fx_hitflash, fx_ring
//   Projectiles — proj_arrow, proj_fireball
//   Menu      — menu_cloud, menu_hills_*, menu_castle, menu_bird_f1/f2
//
// All hills use seededRandom() for reproducible silhouettes.
// ─────────────────────────────────────────────────────────────────────────────
import { single, circ, ell, rr, shade, seededRandom, resetRandom } from './artCore.js';

// ── Particles & combat FX ───────────────────────────────────────────────────

/**
 * Build all FX, projectile, particle, and menu backdrop textures.
 * @param {Phaser.Scene} scene
 */
export function buildFxProps(scene) {
  // ── Shadows & lighting ────────────────────────────────────────────────

  /** Ground shadow ellipse (used under entities). */
  single(scene, 'fx_shadow', 32, 16, (_ctx, w, h) =>
    ell(_ctx, w / 2, h / 2, 13, 6, 'rgba(0,0,0,0.25)', null)
  );

  /** Radial torch / campfire light (additively blended). */
  single(scene, 'fx_light', 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,220,150,0.85)');
    g.addColorStop(0.45, 'rgba(255,190,110,0.28)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // ── Melee slash arcs (3 sizes) ────────────────────────────────────────

  single(scene, 'fx_slash1', 48, 48, (ctx) => crescent(ctx, 46));
  single(scene, 'fx_slash2', 62, 62, (ctx) => crescent(ctx, 58));
  single(scene, 'fx_slash3', 80, 80, (ctx) => crescent(ctx, 74));

  // ── Projectiles ───────────────────────────────────────────────────────

  /** Arrow projectile (horizontal, facing right). */
  single(scene, 'proj_arrow', 22, 7, (ctx, w, h) => {
    const midY = h / 2;
    // shaft
    ctx.fillStyle = '#caa96b';
    ctx.fillRect(3, midY - 1, w - 10, 2);
    // metal tip
    ctx.beginPath();
    ctx.moveTo(w - 1, midY);
    ctx.lineTo(w - 8, midY - 2.6);
    ctx.lineTo(w - 8, midY + 2.6);
    ctx.closePath();
    ctx.fill();
    // fletching
    ctx.fillStyle = '#e5e0d2';
    ctx.beginPath();
    ctx.moveTo(3, midY);
    ctx.lineTo(8, midY - 3);
    ctx.lineTo(8, midY + 3);
    ctx.closePath();
    ctx.fill();
  });

  /** Fireball projectile (radial glow). */
  single(scene, 'proj_fireball', 18, 18, (ctx, w, h) => {
    const g = ctx.createRadialGradient(9, 9, 2, 9, 9, 9);
    g.addColorStop(0, '#fff2c9');
    g.addColorStop(0.5, '#ffae4d');
    g.addColorStop(1, 'rgba(230,80,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // ── Particle sprites ──────────────────────────────────────────────────

  /** Spark (diamond). */
  single(scene, 'pt_spark', 12, 12, (ctx) => {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(6, 1); ctx.lineTo(9, 6);
    ctx.lineTo(6, 11); ctx.lineTo(3, 6);
    ctx.closePath();
    ctx.fill();
  });

  /** Leaf (tilted ellipse). */
  single(scene, 'pt_leaf', 14, 10, (ctx) => {
    ell(ctx, 7, 5, 6, 3, '#79a04f', null, -0.5);
  });

  /** Raindrop (thin rounded rect). */
  single(scene, 'pt_rain', 4, 16, (ctx) => {
    rr(ctx, 1.4, 2, 1.6, 11, 1, 'rgba(170,205,255,0.75)', null);
  });

  /** Snowflake (small circle). */
  single(scene, 'pt_snow', 10, 10, (ctx) =>
    circ(ctx, 5, 5, 2.6, '#ffffff', null)
  );

  /** Smoke puff (soft radial gradient). */
  single(scene, 'pt_smoke', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 2, 12, 12, 12);
    g.addColorStop(0, 'rgba(180,175,165,0.55)');
    g.addColorStop(1, 'rgba(160,155,145,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
  });

  /** Firefly (warm radial glow). */
  single(scene, 'pt_firefly', 12, 12, (ctx) => {
    const g = ctx.createRadialGradient(6, 6, 1, 6, 6, 6);
    g.addColorStop(0, 'rgba(215,255,120,1)');
    g.addColorStop(1, 'rgba(190,240,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 12, 12);
  });

  // ── Hit / impact FX ───────────────────────────────────────────────────

  /** White flash on hit. */
  single(scene, 'fx_hitflash', 26, 26, (ctx) =>
    circ(ctx, 13, 13, 11, 'rgba(255,245,220,0.9)', null)
  );

  /** Impact ring expansion. */
  single(scene, 'fx_ring', 64, 64, (ctx) => {
    ctx.strokeStyle = 'rgba(255,236,190,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// ── Slash helper ────────────────────────────────────────────────────────────

/**
 * Draw a glowing crescent arc (melee slash visual).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} r  Overall diameter hint.
 */
function crescent(ctx, r) {
  const cx = r / 2;
  const cy = r / 2;
  // bright core
  ctx.strokeStyle = 'rgba(255,250,235,0.98)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, -Math.PI * 0.35, Math.PI * 0.4);
  ctx.stroke();
  // soft glow
  ctx.strokeStyle = 'rgba(255,210,140,0.5)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, -Math.PI * 0.33, Math.PI * 0.38);
  ctx.stroke();
}

// ── Menu backdrop ───────────────────────────────────────────────────────────

/**
 * Build cinematic main-menu backdrop layers.
 *
 * These are the drifting parallax elements used by MenuBackgroundScene.
 * (React canvas paints its own gradient backdrop separately.)
 *
 * @param {Phaser.Scene} scene
 */
export function buildMenuProps(scene) {
  resetRandom(0x0E7B_4C00); // reproducible menu backdrop

  // ── Cloud ─────────────────────────────────────────────────────────────

  single(scene, 'menu_cloud', 220, 90, (ctx) => {
    /** Render a single soft cloud puff. */
    const puff = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, `rgba(226,232,240,${a})`);
      g.addColorStop(1, 'rgba(226,232,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // [x, y, radius]
    [
      [60, 52, 38], [110, 44, 30],
      [160, 50, 34], [92, 62, 26],
    ].forEach(([x, y, r]) => puff(x, y, r, 0.85));
  });

  // ── Hill silhouettes (3 depth layers) ─────────────────────────────────

  /**
   * Generate a procedural hill silhouette with seeded randomness.
   * @param {string} key    Texture key.
   * @param {string} color  Fill colour.
   * @param {number} peakH  Maximum hill height above the baseline.
   */
  const hillLayer = (key, color, peakH) =>
    single(scene, key, 960, 300, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      let x = 0;
      while (x < w) {
        const px = x + 70 + seededRandom() * 90;
        const py = h - 40 - seededRandom() * peakH;
        ctx.lineTo(px, py);
        x = px;
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });

  hillLayer('menu_hills_far', '#2a3140', 130);
  hillLayer('menu_hills_mid', '#222a37', 90);
  hillLayer('menu_hills_near', '#181f29', 60);

  // ── Castle silhouette ─────────────────────────────────────────────────

  single(scene, 'menu_castle', 340, 260, (ctx, w, h) => {
    ctx.fillStyle = '#131a24';

    /**
     * Draw a single castle tower.
     * @param {number} x   Left edge.
     * @param {number} tw  Tower width.
     * @param {number} th  Tower height.
     */
    const tower = (x, tw, th) => {
      ctx.fillRect(x, h - th, tw, th);
      // pointed roof
      ctx.beginPath();
      ctx.moveTo(x - 4, h - th);
      ctx.lineTo(x + tw / 2, h - th - 26);
      ctx.lineTo(x + tw + 4, h - th);
      ctx.closePath();
      ctx.fill();
      // battlements
      for (let b = 0; b < tw; b += 12) {
        ctx.fillRect(x + b, h - th - 8, 7, 8);
      }
    };

    tower(20, 54, 130);
    tower(140, 66, 168);
    tower(264, 54, 130);

    // curtain wall
    ctx.fillRect(60, h - 84, 214, 60);
    for (let b = 60; b < 274; b += 16) {
      ctx.fillRect(b, h - 94, 9, 10);
    }

    // lit windows: [x, y]
    ctx.fillStyle = 'rgba(240,180,90,0.85)';
    [
      [36, h - 108], [166, h - 132],
      [176, h - 100], [290, h - 104],
    ].forEach(([x, y]) => ctx.fillRect(x, y, 8, 11));
  });

  // ── Bird animation frames ─────────────────────────────────────────────

  single(scene, 'menu_bird_f1', 20, 12, (ctx) => birdWing(ctx, -1));
  single(scene, 'menu_bird_f2', 20, 12, (ctx) => birdWing(ctx, 1));
}

// ── Bird helper ─────────────────────────────────────────────────────────────

/**
 * Draw a single wing-stroke frame for an animated bird silhouette.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} dir  -1 = wings up, +1 = wings down.
 */
function birdWing(ctx, dir) {
  ctx.strokeStyle = 'rgba(20,26,34,0.95)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(2, 6);
  ctx.quadraticCurveTo(10, 6 + dir * 5, 18, 6);
  ctx.stroke();
}
