// ─────────────────────────────────────────────────────────────────────────────
// Structure props 2/3 — production, resource, and military buildings.
//
// Draws: farm (3 stages), woodcutter lodge, mine entrance,
//        workshop stations (forge/kitchen/tannery/workshop),
//        watchtowers (t1/t2), barracks, archery range, stable, fortress.
// ─────────────────────────────────────────────────────────────────────────────
import { single, rr, circ, ell, tri, O } from './artCore.js';
import { structure } from './propsStructures1.js';

// ── Farm drawing helper ─────────────────────────────────────────────────────

/**
 * Draw a farm plot at a given growth stage.
 *
 * Stage 1: tilled soil only.
 * Stage 2: soil + green sprouts.
 * Stage 3: soil + tall stalks + wheat heads.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w      Canvas width.
 * @param {number} h      Canvas height.
 * @param {number} stage  1 | 2 | 3
 */
function farmDraw(ctx, w, h, stage) {
  // ground shadow
  ell(ctx, w / 2, h - 5, 30, 9, 'rgba(0,0,0,0.14)');
  // soil bed
  rr(ctx, 4, h - 34, w - 8, 30, 3, '#6b4527', O);
  // furrow lines
  ctx.fillStyle = '#5c4023';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(6, h - 32 + i * 8, w - 12, 2.4);
  }
  // sprouts (stage ≥ 2)
  if (stage >= 2) {
    ctx.fillStyle = '#5fa05c';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillRect(12 + c * 11, h - 30 + r * 8, 2.6, stage === 3 ? 6 : 3);
      }
    }
  }
  // wheat heads (stage 3)
  if (stage >= 3) {
    ctx.fillStyle = '#d8b74a';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.beginPath();
        ctx.arc(13 + c * 11, h - 34 + r * 8, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ── Asset builders ──────────────────────────────────────────────────────────

/**
 * Build production, resource, and military building textures.
 * @param {Phaser.Scene} scene
 */
export function buildStructureProps2(scene) {
  // ── Farm (3 growth stages) ────────────────────────────────────────────
  [1, 2, 3].forEach((s) =>
    single(scene, `farm_stage${s}`, 64, 44, (ctx, w, h) => farmDraw(ctx, w, h, s))
  );

  // ── Woodcutter Lodge ──────────────────────────────────────────────────
  single(scene, 'woodcutter_lodge', 64, 64, (ctx, w, h) => {
    structure(ctx, w, h, { wallC: '#6b4527', roofC: '#55895b', roof: 'flat' });
    // stacked logs beside the building
    circ(ctx, w - 14, h - 22, 7, '#6b4527', O, 1.2);
    circ(ctx, w - 17, h - 28, 7, '#7c5632', O, 1.2);
  });

  // ── Mine Entrance ─────────────────────────────────────────────────────
  single(scene, 'mine_entrance', 68, 58, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 26, 7, 'rgba(0,0,0,0.2)');
    // hillside
    ctx.fillStyle = '#5a5045';
    ctx.beginPath();
    ctx.moveTo(6, h - 4);
    ctx.quadraticCurveTo(w / 2, -2, w - 6, h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.6; ctx.stroke();
    // dark tunnel opening
    rr(ctx, w / 2 - 12, h - 30, 24, 26, 10, '#211d18', O);
    // support beams
    rr(ctx, 6, h - 44, 8, 42, 1, '#8a6540', O);
    rr(ctx, w - 14, h - 44, 8, 42, 1, '#8a6540', O);
    rr(ctx, 8, h - 40, w - 16, 7, 1, '#8a6540', O);
  });

  // ── Workshop Stations ─────────────────────────────────────────────────
  // [key, accent/sign colour]
  [
    ['forge', '#e05a4e'],
    ['kitchen', '#e8983f'],
    ['tannery', '#a67f52'],
    ['workshop', '#7ea4e0'],
  ].forEach(([key, sign]) => {
    single(scene, `stn_${key}`, 66, 70, (ctx, w, h) => {
      structure(ctx, w, h, {
        wallC: '#93683e',
        roofC: '#7a4e31',
        roof: key === 'kitchen' ? 'flat' : 'gable',
      });
      // chimney
      rr(ctx, 6, h - 66, 14, 16, 2, '#7c5632', O);
      // counter / work surface
      rr(ctx, w - 20, h - 24, 13, 12, 2, '#dcd3bd', O);
      // coloured sign
      ctx.fillStyle = sign;
      ctx.fillRect(w - 17, h - 21, 7, 6);
    });
  });

  // ── Watchtower Tier 1 (wood) ──────────────────────────────────────────
  single(scene, 'watchtower_t1', 46, 92, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 15, 6, 'rgba(0,0,0,0.18)');
    rr(ctx, w / 2 - 7, h - 64, 14, 62, 2, '#8a6540', O);
    rr(ctx, w / 2 - 13, h - 76, 26, 14, 3, '#93683e', O);
    tri(ctx, w / 2 - 15, h - 88, 30, '#7a3434', O);
  });

  // ── Watchtower Tier 2 (stone) ─────────────────────────────────────────
  single(scene, 'watchtower_t2', 50, 100, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 16, 6, 'rgba(0,0,0,0.18)');
    rr(ctx, w / 2 - 9, h - 74, 18, 72, 2, '#8d95a0', O);
    // stone lines
    ctx.strokeStyle = 'rgba(40,44,52,0.4)';
    for (let y = h - 66; y < h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(w / 2 - 7, y); ctx.lineTo(w / 2 + 7, y);
      ctx.stroke();
    }
    // platform
    rr(ctx, w / 2 - 15, h - 86, 30, 15, 3, '#69707c', O);
    tri(ctx, w / 2 - 17, h - 100, 34, '#39404d', O);
    // pennant
    ctx.fillStyle = '#e8c94b';
    ctx.fillRect(w / 2 - 1, h - 116, 2, 16);
  });

  // ── Barracks ──────────────────────────────────────────────────────────
  single(scene, 'barracks', 82, 74, (ctx, w, h) => {
    structure(ctx, w, h, { wallC: '#8d95a0', roofC: '#5f7a94', roof: 'flat', tier: 2 });
    // banner pole
    ctx.fillStyle = '#c9a24b';
    ctx.fillRect(12, h - 34, 3, 18);
    ctx.fillRect(15, h - 34, 10, 7);
  });

  // ── Archery Range ─────────────────────────────────────────────────────
  single(scene, 'archery_range', 80, 66, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 34, 6, 'rgba(0,0,0,0.16)');
    // side posts
    rr(ctx, 8, h - 40, 10, 38, 2, '#8a6540', O);
    rr(ctx, w - 20, h - 40, 10, 38, 2, '#8a6540', O);
    // crossbar
    rr(ctx, 14, h - 34, w - 30, 9, 2, '#a67f52', O);
    // target
    circ(ctx, w / 2, h - 30, 8, '#ddd3bd', O, 1.4);
    circ(ctx, w / 2, h - 30, 4.5, '#e05a4e', null);
  });

  // ── Stable ────────────────────────────────────────────────────────────
  single(scene, 'stable', 84, 70, (ctx, w, h) => {
    structure(ctx, w, h, { wallC: '#a67f52', roofC: '#7c5632', roof: 'flat', wide: 1.1 });
    // stall opening
    rr(ctx, w - 26, h - 34, 17, 22, 2, '#6b4527', O);
    ctx.fillStyle = '#c9a24b';
    ctx.fillRect(w - 26, h - 34, 17, 2);
  });

  // ── Fortress ──────────────────────────────────────────────────────────
  single(scene, 'fortress', 104, 104, (ctx, w, h) => {
    ell(ctx, w / 2, h - 5, 44, 9, 'rgba(0,0,0,0.2)');
    rr(ctx, 8, h - 78, w - 16, 74, 3, '#69707c', O);
    // stone lines
    ctx.strokeStyle = 'rgba(40,44,52,0.5)';
    for (let y = h - 70; y < h - 6; y += 9) {
      ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w - 10, y); ctx.stroke();
    }
    // battlements along top
    for (let x = 8; x < w - 10; x += 16) {
      rr(ctx, x, h - 86, 10, 9, 1, '#69707c', O);
    }
    // two corner turrets
    [18, w - 33].forEach((tx) => {
      rr(ctx, tx, h - 100, 15, 24, 2, '#5a6470', O);
      tri(ctx, tx - 3, h - 112, 21, '#39404d', O);
    });
  });
}
