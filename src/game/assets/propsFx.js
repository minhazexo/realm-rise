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

  single(scene, 'menu_cloud', 260, 100, (ctx) => {
    const puff = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(210,220,235,${a})`);
      g.addColorStop(0.5, `rgba(190,205,225,${a * 0.5})`);
      g.addColorStop(1, 'rgba(180,195,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    [
      [70, 55, 42], [125, 42, 36],
      [180, 52, 40], [100, 68, 28],
      [155, 65, 24], [50, 48, 22],
    ].forEach(([x, y, r]) => puff(x, y, r, 0.75));
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

  hillLayer('menu_hills_far', '#252d3c', 140);
  hillLayer('menu_hills_mid', '#1c2432', 100);
  hillLayer('menu_hills_near', '#141b26', 70);

  // ── Castle silhouette (richer detail) ─────────────────────────────────

  single(scene, 'menu_castle', 380, 280, (ctx, w, h) => {
    const base = '#101820';
    const mid = '#161e28';
    const accent = '#1a2430';

    const tower = (x, tw, th, roofH = 28) => {
      // body with slight gradient feel via layered rects
      ctx.fillStyle = base;
      ctx.fillRect(x, h - th, tw, th);
      ctx.fillStyle = mid;
      ctx.fillRect(x + 2, h - th, 3, th);
      // roof
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.moveTo(x - 5, h - th);
      ctx.lineTo(x + tw / 2, h - th - roofH);
      ctx.lineTo(x + tw + 5, h - th);
      ctx.closePath();
      ctx.fill();
      // battlements
      for (let b = 0; b < tw; b += 11) {
        ctx.fillRect(x + b, h - th - 9, 7, 9);
      }
      // small flag pole on tall towers
      if (th > 150) {
        ctx.fillStyle = '#2a3340';
        ctx.fillRect(x + tw / 2 - 1, h - th - roofH - 18, 2, 18);
        ctx.fillStyle = 'rgba(200,60,50,0.9)';
        ctx.beginPath();
        ctx.moveTo(x + tw / 2 + 1, h - th - roofH - 18);
        ctx.lineTo(x + tw / 2 + 14, h - th - roofH - 12);
        ctx.lineTo(x + tw / 2 + 1, h - th - roofH - 6);
        ctx.closePath();
        ctx.fill();
      }
    };

    // keep (center tall)
    tower(150, 72, 185, 34);
    // side towers
    tower(28, 58, 138, 26);
    tower(290, 58, 142, 26);
    // smaller corner turrets
    tower(100, 36, 105, 18);
    tower(240, 36, 110, 18);

    // curtain walls
    ctx.fillStyle = base;
    ctx.fillRect(70, h - 92, 240, 68);
    ctx.fillStyle = accent;
    for (let b = 70; b < 310; b += 15) {
      ctx.fillRect(b, h - 102, 9, 11);
    }

    // gatehouse
    ctx.fillStyle = mid;
    ctx.fillRect(168, h - 78, 40, 50);
    ctx.fillStyle = '#0a1018';
    ctx.beginPath();
    ctx.moveTo(172, h - 28);
    ctx.quadraticCurveTo(188, h - 58, 204, h - 28);
    ctx.lineTo(204, h - 28);
    ctx.closePath();
    ctx.fill();

    // glowing windows
    const windows = [
      [42, h - 112], [48, h - 95],
      [168, h - 155], [178, h - 155], [188, h - 130], [168, h - 110],
      [308, h - 116], [314, h - 98],
      [110, h - 88], [250, h - 90],
    ];
    windows.forEach(([x, y], i) => {
      const a = 0.7 + (i % 3) * 0.1;
      ctx.fillStyle = `rgba(255, 200, 100, ${a})`;
      ctx.fillRect(x, y, 7, 10);
      // soft glow
      ctx.fillStyle = `rgba(255, 180, 80, 0.15)`;
      ctx.fillRect(x - 2, y - 1, 11, 12);
    });
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
