// ─────────────────────────────────────────────────────────────────────────────
// Structure props 1/3 — survival props, housing, and tiered Town Hall.
//
// Draws: campfire, tent, storage chest, huts (t1/t2), house,
//        townhall tiers 1-5 with escalating detail.
//
// Exports the shared `structure()` helper used by other props modules.
// ─────────────────────────────────────────────────────────────────────────────
import { single, rr, circ, ell, tri, O, shade } from './artCore.js';

// ── Shared structure helper ─────────────────────────────────────────────────

/**
 * Draw a generic building with wall, door, and roof.
 *
 * Used by hut, house, townhall, workshop, etc. across all props modules.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w  Canvas width.
 * @param {number} h  Canvas height.
 * @param {Object}  opts
 * @param {string}  [opts.wallC='#93683e']   Wall fill colour.
 * @param {string}  [opts.roofC='#7a4e31']   Roof fill colour.
 * @param {string}  [opts.trim='#6b4a2c']    Door / trim colour.
 * @param {number}  [opts.wide=1]            Width multiplier (>1 = wider building).
 * @param {number}  [opts.tier=0]            Upgrade tier (0 = basic … 4 = endgame).
 *   - Tier ≥ 2: stone texture lines on walls.
 *   - Tier ≥ 3: gold chimney / banner.
 * @param {string}  [opts.roof='gable']      'gable' (triangle) or 'flat' (rect).
 */
export function structure(ctx, w, h, opts) {
  const {
    wallC  = '#93683e',
    roofC  = '#7a4e31',
    trim   = '#6b4a2c',
    wide   = 1,
    tier   = 0,
    roof   = 'gable',
  } = opts;

  const bx   = w / 2;            // building centre X
  const by   = h - 8;            // ground line Y
  const halfW = (w / 2 - 6) * wide;
  const wallH = 26;

  // ground shadow
  ell(ctx, bx, h - 4, halfW + 4, 6, 'rgba(0,0,0,0.18)');

  // wall
  rr(ctx, bx - halfW, by - wallH, halfW * 2, wallH, 2, tier >= 2 ? '#8d95a0' : wallC, O);

  // stone texture lines (tier ≥ 2)
  if (tier >= 2) {
    ctx.strokeStyle = 'rgba(40,44,52,0.45)';
    ctx.lineWidth = 1;
    for (let y = by - wallH + 7; y < by; y += 7) {
      ctx.beginPath();
      ctx.moveTo(bx - halfW + 2, y);
      ctx.lineTo(bx + halfW - 2, y);
      ctx.stroke();
    }
  }

  // door
  rr(ctx, bx - 5, by - 13, 10, 13, 2, trim, O);

  // chimney / banner (tier ≥ 3)
  if (tier >= 3) {
    ctx.fillStyle = '#c9a24b';
    ctx.fillRect(bx + 5, by - 22, 12, 9);
    ctx.fillRect(bx + 11, by - 26, 2, 26);
  }

  // roof
  ctx.fillStyle = roofC;
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.6;
  if (roof === 'gable') {
    ctx.beginPath();
    ctx.moveTo(bx - halfW - 5, by - wallH + 2);
    ctx.lineTo(bx, by - wallH - 20);
    ctx.lineTo(bx + halfW + 5, by - wallH + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    rr(ctx, bx - halfW - 4, by - wallH - 14, halfW * 2 + 8, 15, 3, roofC, O);
  }
}

// ── Asset builders ──────────────────────────────────────────────────────────

/**
 * Build survival props, housing, and tiered Town Hall textures.
 * @param {Phaser.Scene} scene
 */
export function buildStructureProps1(scene) {
  // ── Campfire ──────────────────────────────────────────────────────────
  single(scene, 'campfire', 34, 30, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 12, 4, 'rgba(0,0,0,0.15)');
    // logs: [offsetX, offsetY]
    [[-8, -6], [8, -4], [-5, -1], [6, -8]].forEach(([dx, dy]) =>
      rr(ctx, w / 2 + dx, h + dy, 12, 4, 2, '#6b4527', O)
    );
    // flame layers
    circ(ctx, w / 2, h - 8, 5, '#f4a63c', null);
    circ(ctx, w / 2, h - 10, 3, '#ffd66b', null);
  });

  // ── Tent ──────────────────────────────────────────────────────────────
  single(scene, 'tent', 46, 40, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 16, 5, 'rgba(0,0,0,0.16)');
    // outer canvas
    ctx.beginPath();
    ctx.moveTo(w / 2, 6);
    ctx.lineTo(w / 2 + 19, h - 8);
    ctx.lineTo(w / 2 - 19, h - 8);
    ctx.closePath();
    ctx.fillStyle = '#a67f52'; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.6; ctx.stroke();
    // inner flap
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w / 2 + 8, h - 8);
    ctx.lineTo(w / 2 - 8, h - 8);
    ctx.closePath();
    ctx.fillStyle = '#8a6540'; ctx.fill();
  });

  // ── Storage Chest ─────────────────────────────────────────────────────
  single(scene, 'storage_chest', 30, 28, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 11, 4, 'rgba(0,0,0,0.16)');
    rr(ctx, 4, h - 18, w - 8, 15, 2, '#937249', O); // body
    rr(ctx, 4, h - 23, w - 8, 6, 2, '#a67f52', O);   // lid
    // clasp
    ctx.fillStyle = '#c9a24b';
    ctx.fillRect(w / 2 - 2, h - 21, 4, 7);
    ctx.strokeStyle = O; ctx.strokeRect(w / 2 - 2, h - 21, 4, 7);
  });

  // ── Housing ───────────────────────────────────────────────────────────
  single(scene, 'hut_t1', 58, 62, (ctx, w, h) =>
    structure(ctx, w, h, { roof: 'gable' })
  );
  single(scene, 'hut_t2', 60, 66, (ctx, w, h) =>
    structure(ctx, w, h, { roofC: '#8d95a0', roof: 'gable', tier: 1 })
  );
  single(scene, 'house', 64, 70, (ctx, w, h) =>
    structure(ctx, w, h, { wallC: '#b08d55', roofC: '#7a3434', roof: 'gable', tier: 1 })
  );

  // ── Tiered Town Hall (5 tiers of escalating grandeur) ─────────────────
  const hallPals = [
    { wallC: '#93683e', roofC: '#7a4e31' },           // t1: wooden
    { wallC: '#8d95a0', roofC: '#7290ad', tier: 2 },   // t2: stone
    { wallC: '#8d95a0', roofC: '#5f7a94', tier: 3 },   // t3: stone + banner
    { wallC: '#797f88', roofC: '#4c5668', tier: 3 },   // t4: dark stone
    { wallC: '#69707c', roofC: '#39404d', tier: 4 },   // t5: fortress
  ];

  hallPals.forEach((pal, i) => {
    single(scene, `townhall_t${i + 1}`, 96 + i * 6, 92 + i * 6, (ctx, w, h) => {
      structure(ctx, w, h, {
        ...pal,
        roof: i === 0 ? 'gable' : 'flat',
        wide: 1 + i * 0.06,
        trim: '#c9a24b',
      });

      // corner towers
      const towers = Math.min(2, Math.ceil((i + 1) / 2));
      for (let t = 0; t < towers; t++) {
        const tx = t === 0 ? 10 : w - 16;
        rr(ctx, tx, h - 54 - i * 4, 13, 48 + i * 4, 2, pal.wallC, O);
        tri(ctx, tx - 3, h - 66 - i * 4, 19, pal.roofC, O);
        // pennant
        ctx.fillStyle = i >= 2 ? '#e8c94b' : '#e05050';
        ctx.fillRect(tx + 5, h - 72 - i * 4, 1.6, 8);
      }

      // tier 5: central golden spire
      if (i === 4) {
        ctx.fillStyle = '#e8c94b';
        ctx.fillRect(w / 2 - 2, h - 108, 4, 18);
        circ(ctx, w / 2, h - 110, 5, '#e8c94b', O, 1.2);
      }
    });
  });
}
