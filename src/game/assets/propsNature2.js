// ─────────────────────────────────────────────────────────────────────────────
// Nature props 2/2 — rocks / ore nodes, flora pickups, ruins, water accents.
//
// Draws: iron/gold/silver/coal rocks, crystal & moonstone nodes,
//        berry bushes (full + empty), herbs, mushrooms, reeds, lilypads,
//        ruined pillars/arches, ancient statue.
// ─────────────────────────────────────────────────────────────────────────────
import { makeCanvas, registerImage, circ, ell, rr, shade, single, O, seededRandom } from './artCore.js';

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Draw the polygonal base shape shared by all rock / ore sprites.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w    Canvas width.
 * @param {number} h    Canvas height.
 * @param {string} main Main rock colour.
 */
function rockBase(ctx, w, h, main) {
  // ground shadow
  ell(ctx, w / 2, h - 4, 18, 5.5, 'rgba(0,0,0,0.18)');
  // main rock body — more faceted with extra vertices
  ctx.beginPath();
  ctx.moveTo(7, h - 5);
  ctx.lineTo(3, h - 16);
  ctx.lineTo(6, h - 24);
  ctx.lineTo(14, h - 32);
  ctx.lineTo(w - 14, h - 30);
  ctx.lineTo(w - 8, h - 20);
  ctx.lineTo(w - 5, h - 12);
  ctx.lineTo(w - 8, h - 5);
  ctx.closePath();
  ctx.fillStyle = main;
  ctx.fill();
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // facet edges for 3D depth — multiple planes
  ctx.strokeStyle = shade(main, -25);
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(14, h - 30);
  ctx.lineTo(18, h - 18);
  ctx.lineTo(w - 8, h - 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, h - 24);
  ctx.lineTo(w / 2, h - 16);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // highlight edge (light from upper-left)
  ctx.strokeStyle = shade(main, 18);
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(6, h - 22);
  ctx.lineTo(14, h - 30);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // subtle crack texture
  ctx.strokeStyle = shade(main, -18);
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(w / 2 + 2, h - 26);
  ctx.lineTo(w / 2 - 1, h - 14);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Draw ore sparkles on a rock face.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w      Canvas width.
 * @param {number} h      Canvas height.
 * @param {string[]} colours  One or two sparkle colours.
 */
function sparkles(ctx, w, h, colours) {
  colours.forEach((c, i) => {
    // Diamond-shaped sparkles instead of squares
    const pts = [
      [w / 2 - 5 + i * 4, h - 25 + i * 3],
      [w / 2 + 5 - i * 2, h - 15],
      [w / 2 - 2 + i * 2, h - 20],
    ];
    pts.forEach(([x, y]) => {
      const sz = 2 + seededRandom() * 1.5;
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.7 + seededRandom() * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y - sz);
      ctx.lineTo(x + sz * 0.7, y);
      ctx.lineTo(x, y + sz);
      ctx.lineTo(x - sz * 0.7, y);
      ctx.closePath();
      ctx.fill();
      // inner bright core
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.4;
      ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      ctx.globalAlpha = 1;
    });
  });
}

// ── Rock / ore nodes ────────────────────────────────────────────────────────

/**
 * Build all rock and ore-node textures.
 * @param {Phaser.Scene} scene
 */
export function buildRockProps(scene) {
  single(scene, 'rock_small', 34, 36, (ctx, w, h) => rockBase(ctx, w, h, '#8a8f97'));
  single(scene, 'rock_iron', 36, 38, (ctx, w, h) => {
    rockBase(ctx, w, h, '#7e7568');
    sparkles(ctx, w, h, ['#b0654f', '#d08a6b']);
  });
  single(scene, 'rock_gold', 34, 36, (ctx, w, h) => {
    rockBase(ctx, w, h, '#7e7258');
    sparkles(ctx, w, h, ['#ffd66b', '#e8c94b']);
  });
  single(scene, 'rock_silver', 34, 36, (ctx, w, h) => {
    rockBase(ctx, w, h, '#797f88');
    sparkles(ctx, w, h, ['#dfe4ea', '#c9ced6']);
  });
  single(scene, 'rock_coal', 34, 36, (ctx, w, h) => {
    rockBase(ctx, w, h, '#4a4c54');
    sparkles(ctx, w, h, ['#202126', '#33343a']);
  });

  single(scene, 'crystal_node', 34, 44, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 14, 5, 'rgba(0,0,0,0.18)');
    // Three crystal shards with glow: [colour, offsetX, offsetY, height]
    [
      ['#7be0c3', 0, -16, 20],
      ['#57c4ab', -9, -10, 14],
      ['#9bead6', 9, -11, 15],
    ].forEach(([c, dx, dy, ch]) => {
      // glow behind crystal
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(w / 2 + dx, h - 8 + dy - ch / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // crystal body
      ctx.beginPath();
      ctx.moveTo(w / 2 + dx, h - 7 + dy + 14);
      ctx.lineTo(w / 2 + dx - 5, h - 8 + dy);
      ctx.lineTo(w / 2 + dx, h - 8 + dy - ch);
      ctx.lineTo(w / 2 + dx + 5, h - 8 + dy);
      ctx.closePath();
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = O;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // inner facet line
      ctx.strokeStyle = shade(c, 20);
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(w / 2 + dx, h - 7 + dy + 14);
      ctx.lineTo(w / 2 + dx, h - 8 + dy - ch);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // sparkle at crystal tips
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(w / 2, h - 8 - 16 - 16, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  single(scene, 'moonstone_node', 32, 40, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 13, 4.5, 'rgba(0,0,0,0.18)');
    // outer glow
    ctx.fillStyle = '#b9c7ff';
    ctx.globalAlpha = 0.12;
    ctx.beginPath(); ctx.arc(w / 2, h - 18, 14, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // main moonstone orb
    circ(ctx, w / 2, h - 18, 11, '#b9c7ff', O, 1.5);
    // inner highlight crescent
    circ(ctx, w / 2 - 2, h - 20, 5, '#d8e4ff', null);
    // bright specular dot
    circ(ctx, w / 2 - 3, h - 22, 2, '#eef4ff', null);
    // subtle radial glow lines
    ctx.strokeStyle = 'rgba(185,199,255,0.3)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * 10, h - 18 + Math.sin(a) * 10);
      ctx.lineTo(w / 2 + Math.cos(a) * 14, h - 18 + Math.sin(a) * 14);
      ctx.stroke();
    }
  });
}

// ── Flora pickups ───────────────────────────────────────────────────────────

/**
 * Build flora / foraging pickup textures.
 * @param {Phaser.Scene} scene
 */
export function buildFloraProps(scene) {
  // Berry bush (full)
  single(scene, 'berry_bush', 42, 36, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 15, 4.5, 'rgba(0,0,0,0.14)');
    circ(ctx, w / 2 - 8, h - 14, 11, '#4a7c3a', O, 1.4);
    circ(ctx, w / 2 + 8, h - 15, 10, '#55895b', O, 1.4);
    // berry dots: [offsetX, offsetY]
    [
      [-10, -10], [-2, -6], [4, -12],
      [11, -9], [-6, -18], [8, -19],
    ].forEach(([dx, dy]) => {
      circ(ctx, w / 2 + dx, h + dy, 2.4, '#a04258', O, 0.9);
    });
  });

  // Berry bush (depleted)
  single(scene, 'berry_bush_empty', 42, 36, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 15, 4.5, 'rgba(0,0,0,0.14)');
    circ(ctx, w / 2 - 8, h - 14, 11, '#59724c', O, 1.4);
    circ(ctx, w / 2 + 8, h - 15, 10, '#618055', O, 1.4);
  });

  // Herb plant
  single(scene, 'herb_plant', 30, 30, (ctx, w, h) => {
    ctx.strokeStyle = '#5fa05c';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    // Three stems: [offsetX, endY offset]
    [[-6, -12], [0, -17], [6, -13]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(w / 2, h - 5);
      ctx.quadraticCurveTo(w / 2 + dx * 0.35, h - 5 + dy * 0.55, w / 2 + dx, h + dy);
      ctx.stroke();
    });
    circ(ctx, w / 2, h - 19, 3, '#8fd08a', O, 0.9);
  });

  // Mushroom patch
  single(scene, 'mushroom_patch', 30, 26, (ctx, w, h) => {
    // [x, y, capRadius]
    [[8, 16, 5.5], [21, 19, 4.5]].forEach(([x, y, r]) => {
      rr(ctx, x - 1.5, y, 3, 6, 1.4, '#ded6bd', O);
      ctx.fillStyle = '#c47b57';
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = O;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });

  // Reed tuft
  single(scene, 'reed_tuft', 26, 34, (ctx, w, h) => {
    ctx.strokeStyle = '#7fa663';
    ctx.lineWidth = 2;
    // [offsetX, bend amount]
    [[-6, 0], [-2, -1], [3, 1], [7, -1]].forEach(([dx, bend]) => {
      ctx.beginPath();
      ctx.moveTo(w / 2, h - 3);
      ctx.quadraticCurveTo(w / 2 + dx + bend * 3, h - 16, w / 2 + dx, h - 26);
      ctx.stroke();
    });
  });

  // Lily pad
  single(scene, 'lilypad', 26, 18, (ctx, w, h) =>
    ell(ctx, w / 2, h / 2, 10, 6, '#4d7a44', O)
  );
}

// ── Ruins ───────────────────────────────────────────────────────────────────

/**
 * Build ruined / ancient structure textures.
 * @param {Phaser.Scene} scene
 */
export function buildRuinsProps(scene) {
  single(scene, 'ruin_pillar', 26, 66, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 12, 4.5, 'rgba(0,0,0,0.16)');
    rr(ctx, w / 2 - 7, h - 52, 14, 48, 2, '#7d8590', O);
    rr(ctx, w / 2 - 9, h - 58, 18, 7, 2, '#8d95a0', O);
    // vertical crack
    ctx.strokeStyle = O;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 4, h - 50);
    ctx.lineTo(w / 2 - 2, h - 8);
    ctx.stroke();
  });

  single(scene, 'ruin_arch', 90, 74, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 36, 6, 'rgba(0,0,0,0.15)');
    // pillars
    rr(ctx, 8, h - 58, 16, 54, 2, '#8d95a0', O);
    rr(ctx, w - 24, h - 58, 16, 54, 2, '#8d95a0', O);
    // arch
    ctx.beginPath();
    ctx.arc(w / 2, h - 52, w / 2 - 18, Math.PI, Math.PI * 2);
    ctx.strokeStyle = O;
    ctx.lineWidth = 9;
    ctx.stroke();
    // teal rune accent
    ctx.strokeStyle = '#5ad0c0';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(w / 2, h - 52, w / 2 - 18, Math.PI * 1.2, Math.PI * 1.65);
    ctx.stroke();
  });

  single(scene, 'ancient_statue', 44, 64, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 16, 5, 'rgba(0,0,0,0.16)');
    rr(ctx, w / 2 - 13, h - 16, 26, 12, 2, '#69707c', O);
    rr(ctx, w / 2 - 7, h - 44, 14, 30, 5, '#7d8590', O);
    circ(ctx, w / 2, h - 49, 8, '#8d95a0', O, 1.4);
    // glowing eye
    circ(ctx, w / 2, h - 51, 3, null, '#5ad0c0');
  });
}
