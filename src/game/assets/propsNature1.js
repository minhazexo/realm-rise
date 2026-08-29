// ─────────────────────────────────────────────────────────────────────────────
// Nature props 1/2 — trees & plants
//
// Draws: oak tree, pine tree, dead tree, cactus, tree stump.
// Features bark texture, leaf detail clusters, and ground shadows.
// ─────────────────────────────────────────────────────────────────────────────
import {
  makeCanvas, registerImage, circ, ell, rr, shade, seededRandom, resetRandom, O,
} from './artCore.js';

// ── Re-use artCore.single but allow local fallback ──────────────────────────
import { single as artSingle } from './artCore.js';

/**
 * Wrapper around artCore.single that resets the PRNG seed first, ensuring
 * deterministic output for nature props.
 */
function single(scene, key, w, h, draw) {
  resetRandom(0x5A17_0EED); // nature seed
  artSingle(scene, key, w, h, draw);
}

// ── Detail helpers ──────────────────────────────────────────────────────────

/**
 * Draw vertical bark texture lines on a rectangular area.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x      Left edge of bark region.
 * @param {number} y      Top edge of bark region.
 * @param {number} w      Width of bark region.
 * @param {number} h      Height of bark region.
 * @param {string} color  Base bark colour.
 */
function barkDetail(ctx, x, y, w, h, color) {
  ctx.strokeStyle = shade(color, -20);
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 4; i++) {
    const lx = x + 2 + (i % 3) * (w / 3);
    ctx.beginPath();
    ctx.moveTo(lx, y + 2);
    ctx.lineTo(lx + (i % 2 ? 1 : -1), y + h - 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw small semi-random leaf clusters on a canopy.
 * Uses `seededRandom()` instead of `Math.random()` for determinism.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx     Centre X of the canopy.
 * @param {number} cy     Centre Y of the canopy.
 * @param {number} radius Approximate radius of the cluster.
 * @param {string} color  Base leaf colour.
 */
function leafDetail(ctx, cx, cy, radius, color) {
  const leafCount = Math.floor(radius * 1.2);
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2;
    const dist = radius * 0.4 + seededRandom() * radius * 0.5;
    const lx = cx + Math.cos(angle) * dist;
    const ly = cy + Math.sin(angle) * dist;
    const lr = 1.5 + seededRandom() * 2.5;
    ctx.fillStyle = seededRandom() > 0.5 ? shade(color, 15) : shade(color, -12);
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Asset builders ──────────────────────────────────────────────────────────

/**
 * Build all nature-prop tree textures (oak, pine, dead, cactus, stump).
 * @param {Phaser.Scene} scene
 * @returns {true}
 */
export function buildNatureProps(scene) {  // ── Oak Tree (high detail) ──────────────────────────────────────────────
  single(scene, 'tree_oak', 72, 86, (ctx, w, h) => {
    // ground shadow — elliptical, slightly offset for light direction
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 5, h - 3, 24, 8, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // trunk with gradient shading (light from upper-left)
    const TRUNK = '#6b4527';
    const trunkX = w / 2 - 6, trunkY = h - 30, trunkW = 12, trunkH = 28;
    // trunk body
    rr(ctx, trunkX, trunkY, trunkW, trunkH, 3, TRUNK, O);
    // left-side highlight (light source)
    ctx.fillStyle = shade(TRUNK, 18);
    ctx.globalAlpha = 0.35;
    rr(ctx, trunkX + 1, trunkY + 2, 4, trunkH - 4, 2, shade(TRUNK, 18), null);
    ctx.globalAlpha = 1;
    // right-side shadow
    ctx.fillStyle = shade(TRUNK, -20);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(trunkX + trunkW - 3, trunkY + 4, 3, trunkH - 8);
    ctx.globalAlpha = 1;
    // bark texture lines
    barkDetail(ctx, trunkX, trunkY, trunkW, trunkH, TRUNK);
    // moss patch near base
    ctx.fillStyle = '#5a8a42';
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(trunkX + 3, trunkY + trunkH - 6, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // canopy layers — deeper shadows for 3D feel, light from upper-left
    const C1 = '#4a7c3a';
    // deep shadow blobs (back layer)
    circ(ctx, w / 2 - 14, h - 42, 16, shade(C1, -28));
    circ(ctx, w / 2 + 15, h - 44, 15, shade(C1, -18));
    circ(ctx, w / 2 - 5, h - 48, 13, shade(C1, -10));
    // mid-layer canopy blobs
    circ(ctx, w / 2 + 5, h - 38, 14, shade(C1, -6));
    circ(ctx, w / 2 - 8, h - 50, 11, shade(C1, 4));
    // main canopy crown
    circ(ctx, w / 2, h - 56, 18, C1, O, 1.8);
    circ(ctx, w / 2 - 10, h - 34, 12, C1, O, 1.5);
    circ(ctx, w / 2 + 9, h - 36, 11, shade(C1, 10), O, 1.3);
    // sunlit highlight (upper-left)
    circ(ctx, w / 2 - 6, h - 59, 7, shade(C1, 34), null);
    circ(ctx, w / 2 - 2, h - 55, 5, shade(C1, 22), null);
    // leaf detail clusters
    leafDetail(ctx, w / 2, h - 52, 16, C1);
    leafDetail(ctx, w / 2 - 10, h - 40, 10, C1);
    leafDetail(ctx, w / 2 + 10, h - 42, 10, C1);
    // light sparkles on top leaves
    ctx.fillStyle = shade(C1, 38);
    [
      [-8, -62], [7, -58], [-15, -48], [12, -50], [0, -66],
      [-3, -60], [14, -54],
    ].forEach(([dx, dy]) => {
      const sz = 1.5 + seededRandom() * 1.2;
      ctx.beginPath(); ctx.arc(w / 2 + dx, h + dy, sz, 0, Math.PI * 2); ctx.fill();
    });
  });

  // ── Pine Tree (high detail) ─────────────────────────────────────────────
  single(scene, 'tree_pine', 56, 92, (ctx, w, h) => {
    // ground shadow — elongated for tall tree
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 4, h - 3, 18, 6, 0.08, 0, Math.PI * 2);
    ctx.fill();

    // trunk with gradient shading
    const TRUNK = '#5a3d22';
    rr(ctx, w / 2 - 5, h - 22, 10, 20, 2, TRUNK, O);
    // left highlight
    ctx.fillStyle = shade(TRUNK, 16);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(w / 2 - 4, h - 20, 3, 16);
    ctx.globalAlpha = 1;
    barkDetail(ctx, w / 2 - 5, h - 22, 10, 20, TRUNK);

    // layered pine fronds with shadow depth + needle detail
    const layers = [
      { color: '#2d5a36', yOff: -80, w: 24 },
      { color: '#376840', yOff: -62, w: 28 },
      { color: '#41764a', yOff: -44, w: 32 },
      { color: '#4d8456', yOff: -26, w: 36 },
    ];
    layers.forEach(({ color, yOff, w: lw }, li) => {
      // deep shadow side
      ctx.fillStyle = shade(color, -18);
      ctx.beginPath();
      ctx.moveTo(w / 2, h + yOff - 4);
      ctx.lineTo(w / 2 + lw, h + yOff + 28);
      ctx.lineTo(w / 2 + 2, h + yOff + 28);
      ctx.closePath();
      ctx.fill();
      // main frond
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(w / 2, h + yOff - 4);
      ctx.lineTo(w / 2 + lw - 2, h + yOff + 26);
      ctx.lineTo(w / 2 - lw + 2, h + yOff + 26);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = O;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // highlight edge (upper-left light)
      ctx.strokeStyle = shade(color, 22);
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 1, h + yOff - 2);
      ctx.lineTo(w / 2 - lw + 4, h + yOff + 24);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // needle texture lines on lower fronds
      if (li >= 2) {
        ctx.strokeStyle = shade(color, -8);
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.25;
        for (let n = 0; n < 5; n++) {
          const nx = w / 2 - lw + 6 + n * (lw * 2 - 8) / 4;
          ctx.beginPath();
          ctx.moveTo(nx, h + yOff + 22);
          ctx.lineTo(nx + (seededRandom() - 0.5) * 4, h + yOff + 8);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    });
  });

  // ── Dead Tree ───────────────────────────────────────────────────────────
  single(scene, 'dead_tree', 54, 76, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 3, 15, 5, 0.05, 0, Math.PI * 2);
    ctx.fill();

    const TRUNK = '#4c4438';
    // Main trunk — thicker with gradient
    ctx.strokeStyle = TRUNK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 6);
    ctx.lineTo(w / 2 - 2, h - 42);
    ctx.stroke();
    // trunk highlight (left side)
    ctx.strokeStyle = shade(TRUNK, 12);
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 3, h - 8);
    ctx.lineTo(w / 2 - 5, h - 40);
    ctx.stroke();
    ctx.globalAlpha = 1;
    barkDetail(ctx, w / 2 - 5, h - 42, 10, 38, TRUNK);
    // crack textures on trunk
    ctx.strokeStyle = shade(TRUNK, -15);
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.4;
    [[-1, -10, 0, -26], [2, -14, 1, -30]].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(w / 2 + x1, h + y1);
      ctx.lineTo(w / 2 + x2, h + y2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Branch stubs with taper and broken ends
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = shade(TRUNK, -8);
    [
      [-1, -32, -15, -50],
      [0, -36, 13, -54],
      [-1, -38, 4, -66],
    ].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(w / 2 + x1, h + y1);
      ctx.quadraticCurveTo(w / 2 + x2 * 0.5, h + y1 - 8, w / 2 + x2, h + y2);
      ctx.stroke();
      // broken branch tip — small circle
      ctx.fillStyle = shade(TRUNK, -12);
      ctx.beginPath();
      ctx.arc(w / 2 + x2, h + y2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
    // small hanging moss/lichen
    ctx.strokeStyle = '#6a7a52';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 10, h - 48);
    ctx.quadraticCurveTo(w / 2 - 12, h - 42, w / 2 - 10, h - 38);
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // ── Cactus ──────────────────────────────────────────────────────────────
  single(scene, 'cactus', 40, 62, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 3, 12, 4.5, 0.05, 0, Math.PI * 2);
    ctx.fill();

    const GREEN = '#5f8a4e';
    // main trunk with gradient shading
    rr(ctx, w / 2 - 6, h - 48, 12, 46, 5, GREEN, O);
    // left highlight (light source)
    ctx.fillStyle = shade(GREEN, 22);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(w / 2 - 4, h - 46, 3, 42);
    ctx.globalAlpha = 1;
    // right shadow
    ctx.fillStyle = shade(GREEN, -18);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(w / 2 + 3, h - 44, 3, 38);
    ctx.globalAlpha = 1;
    // vertical ridge lines
    ctx.strokeStyle = shade(GREEN, -10);
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.3;
    [-2, 0, 2].forEach((dx) => {
      ctx.beginPath();
      ctx.moveTo(w / 2 + dx, h - 44);
      ctx.lineTo(w / 2 + dx, h - 6);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    // spines (small dots along edges)
    ctx.fillStyle = '#c8c4a0';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      const sy = h - 44 + i * 5;
      ctx.fillRect(w / 2 - 7, sy, 1.2, 1.2);
      ctx.fillRect(w / 2 + 6, sy, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;

    // arms: [left, top, width, height, radius]
    [
      [w / 2 - 17, h - 32, 10, 8, 3],
      [w / 2 - 15, h - 40, 7, 12, 3],
      [w / 2 + 7, h - 26, 9, 7, 3],
      [w / 2 + 9, h - 36, 7, 11, 3],
    ].forEach(([ax, ay, aw, ah, ar]) => {
      rr(ctx, ax, ay, aw, ah, ar, GREEN, O);
      // arm highlight
      ctx.fillStyle = shade(GREEN, 16);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(ax + 1, ay + 1, 2, ah - 2);
      ctx.globalAlpha = 1;
    });
  });

  // Tree stump (for depleted trees)
  drawTreeStump(scene);

  return true;
}

/**
 * Draw a small tree stump texture for depleted resource nodes.
 * @param {Phaser.Scene} scene
 */
export function drawTreeStump(scene) {
  const { canvas, ctx } = makeCanvas(24, 20);
  const bark = '#6b5b42';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(12, 17, 10, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stump body
  rr(ctx, 5, 2, 14, 15, 3, bark, O);

  // Ring detail on top
  ctx.strokeStyle = shade(bark, -15);
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.arc(12, 4, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(12, 4, 3, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;

  // Wood color highlight on top
  ctx.fillStyle = shade(bark, 20);
  ctx.globalAlpha = 0.3;
  ctx.fillRect(7, 1.5, 10, 3);
  ctx.globalAlpha = 1;

  // Bark detail
  barkDetail(ctx, 6, 5, 12, 10, bark);
  registerImage(scene, 'tree_stump', canvas);
}
