// ─────────────────────────────────────────────────────────────────────────────
// Icon drawers part B — resources, food, consumables & special items.
//
// Each drawer receives (ctx, c) where c is the item's primary colour.
// They compose shared primitives from iconPrims.js and artCore.js.
// All coordinates are relative to a 26×26 cell.
// ─────────────────────────────────────────────────────────────────────────────
import { rr, circ } from './artCore.js';
import {
  O, diamond, polyRock, sparkles2,
  blobShape as blob,
  bowlAndSteam, hexGrid, tri2, headTri, handle,
} from './iconPrims.js';

export const SHAPES_B = {
  /**
   * Generic blob (base material / hide).
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Fill colour.
   */
  blob(ctx, c) { blob(ctx, c); },

  /**
   * Log — rounded rect + wood end-grain.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Bark colour.
   */
  log(ctx, c) {
    rr(ctx, 4, 9, 18, 8, 3, c, O);
    // end grain
    ctx.beginPath();
    ctx.ellipse(22, 13, 2.4, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a06a'; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
  },

  /**
   * Fibre / string — three wavy strands.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Strand colour.
   */
  fiber(ctx, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(6 + i * 3, 22);
      ctx.quadraticCurveTo(10 + i * 4, 12, 20 + i, 5 + i * 4);
      ctx.stroke();
    }
  },

  /**
   * Ore chunk — polygonal rock + sparkles.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Ore colour.
   */
  ore(ctx, c) {
    polyRock(ctx, c);
    sparkles2(ctx, '#ffffff88', 3);
  },

  /**
   * Raw lump — polygonal rock only.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Rock colour.
   */
  lump(ctx, c) { polyRock(ctx, c); },

  /**
   * Metal ingot — top face + shaded side face.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Metal colour.
   */
  ingot(ctx, c) {
    rr(ctx, 8, 6, 16, 8, 2, c, O);
    // side face (darker)
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = O;
    rr(ctx, 5, 11, 16, 8, 2, c, null);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = O; ctx.lineWidth = 1.2;
    ctx.strokeRect(5.5, 11.5, 15, 7);
  },

  /**
   * Crystal shard — small diamond.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Crystal colour.
   */
  shard(ctx, c) { diamond(ctx, c, 13, 13, 10); },

  /**
   * Gem — large diamond.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Gem colour.
   */
  gem(ctx, c) { diamond(ctx, c, 13, 13, 12); },

  /**
   * Relic — frame + diamond + horizontal stripe.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Accent colour.
   */
  relic(ctx, c) {
    rr(ctx, 6, 4, 14, 18, 3, '#d8cfbc', O);
    diamond(ctx, c, 13, 12, 5);
    ctx.fillStyle = c;
    ctx.fillRect(9, 17, 8, 2.4);
  },

  /**
   * Magic core — dark ring + bright centre.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Core glow colour.
   */
  core(ctx, c) {
    circ(ctx, 13, 13, 8, '#16241f', O, 1.4);
    circ(ctx, 13, 13, 5.4, c, null);
    circ(ctx, 13, 13, 2.4, '#fff', null);
  },

  /**
   * Scale — teardrop-shaped dragon scale.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Scale colour.
   */
  scale(ctx, c) {
    ctx.beginPath();
    ctx.moveTo(13, 23);
    ctx.quadraticCurveTo(2, 16, 6, 6);
    ctx.quadraticCurveTo(13, 2, 20, 6);
    ctx.quadraticCurveTo(24, 16, 13, 23);
    ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.3; ctx.stroke();
  },

  /**
   * Hide — blob + diagonal scratch mark.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Hide colour.
   */
  hide(ctx, c) {
    blob(ctx, c);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(18, 16); ctx.stroke();
  },

  /**
   * Bone — shaft with rounded ends.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Bone colour.
   */
  bone(ctx, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, 20); ctx.lineTo(19, 7); ctx.stroke();
    circ(ctx, 5, 21, 3, c, O, 1);
    circ(ctx, 20, 6, 3, c, O, 1);
  },

  /**
   * Feather — tilted ellipse.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Feather colour.
   */
  feather(ctx, c) {
    ctx.beginPath();
    ctx.ellipse(13, 12, 3.4, 9, 0.6, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
  },

  /**
   * Herb — three curved stems from a base.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Stem colour.
   */
  herb(ctx, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 2.2;
    [[-6, -7], [0, -10], [6, -8]].forEach(([dx]) => {
      ctx.beginPath();
      ctx.moveTo(13, 22);
      ctx.quadraticCurveTo(13 + dx / 2, 13, 13 + dx, 6 + Math.abs(dx));
      ctx.stroke();
    });
  },

  /**
   * Mushroom — stem + cap.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Cap colour.
   */
  mushroom(ctx, c) {
    rr(ctx, 11, 12, 4, 9, 1.5, '#ded6bd', O);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(13, 12, 8, Math.PI, Math.PI * 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.2; ctx.stroke();
  },

  /**
   * Berries — cluster of four small circles.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Berry colour.
   */
  berries(ctx, c) {
    [[8, 10], [16, 8], [12, 16], [19, 15]].forEach(([x, y]) =>
      circ(ctx, x, y, 3.4, c, O, 1)
    );
  },

  /**
   * Meat cut — ellipse + bone handle.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Flesh colour.
   */
  meat(ctx, c) {
    ctx.beginPath();
    ctx.ellipse(12, 14, 8, 6, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.2; ctx.stroke();
    // bone
    ctx.strokeStyle = '#efe6d8'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(19, 9); ctx.lineTo(22, 6); ctx.stroke();
  },

  /**
   * Fish — ellipse body + tail triangle + eye dot.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Body colour.
   */
  fish(ctx, c) {
    ctx.beginPath();
    ctx.ellipse(12, 13, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.2; ctx.stroke();
    tri2(ctx, 21, 7, 7, c);
    circ(ctx, 8, 12, 1.3, O, null);
  },

  /**
   * Bread loaf — ellipse + shadow crease.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Crust colour.
   */
  bread(ctx, c) {
    ctx.beginPath();
    ctx.ellipse(13, 14, 10, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.3; ctx.stroke();
    // shadow crease
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.moveTo(7, 12);
    ctx.quadraticCurveTo(13, 15, 19, 12); ctx.stroke();
  },

  /**
   * Stew — bowl with steam.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Liquid colour.
   */
  stew(ctx, c) { bowlAndSteam(ctx, c); },

  /**
   * Honeycomb — hex grid pattern.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Wax colour.
   */
  comb(ctx, c) { hexGrid(ctx, c); },

  /**
   * Flask — neck + rounded body.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Liquid colour.
   */
  flask(ctx, c) {
    // neck
    rr(ctx, 8, 3, 4, 5, 1, '#9aa0a8', O);
    // body
    ctx.beginPath();
    ctx.moveTo(7, 8); ctx.lineTo(19, 8);
    ctx.quadraticCurveTo(22, 14, 19, 22);
    ctx.quadraticCurveTo(13, 26, 7, 22);
    ctx.quadraticCurveTo(4, 14, 7, 8);
    ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.4; ctx.stroke();
  },

  /**
   * Skin — blob + strap.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Skin colour.
   */
  skin(ctx, c) {
    blob(ctx, c);
    ctx.fillStyle = '#7c5632';
    ctx.fillRect(17, 4, 3, 7);
  },

  /**
   * Scroll / roll — rounded rect + diagonal line.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Paper colour.
   */
  roll(ctx, c) {
    rr(ctx, 6, 9, 14, 10, 4, c, O);
    ctx.strokeStyle = '#c99'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(9, 12); ctx.lineTo(17, 17); ctx.stroke();
  },

  /**
   * Stone blade — rounded rect + notch marks.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Stone colour.
   */
  stoneblade(ctx, c) {
    rr(ctx, 5, 10, 12, 7, 2, c, O);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(7 + i * 4, 11);
      ctx.lineTo(7 + i * 4, 16);
      ctx.stroke();
    }
  },

  /**
   * Repair kit — box + handle.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Box colour.
   */
  kit(ctx, c) {
    rr(ctx, 4, 9, 18, 12, 2, c, O);
    rr(ctx, 10, 4, 7, 5, 2, '#00000044', O);
  },

  /**
   * Torch — handle + flame gradient.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Flame colour.
   */
  torch(ctx, c) {
    handle(ctx);
    circ(ctx, 13, 7, 4.6, c, '#a65425', 1.2);
    circ(ctx, 13, 7, 2.2, '#ffe9a8', null);
  },

  /**
   * Arrow — shaft + head triangle.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Shaft colour.
   */
  arrow(ctx, c) {
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, 21); ctx.lineTo(19, 7); ctx.stroke();
    headTri(ctx, 21, 5, '#dfe4ea');
  },

  /**
   * Key — ring + shaft + teeth.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Metal colour.
   */
  key(ctx, c) {
    circ(ctx, 9, 10, 4.4, null, c, 3);
    ctx.strokeStyle = c; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(12, 13); ctx.lineTo(20, 21); ctx.stroke();
    ctx.fillStyle = c;
    ctx.fillRect(17, 16, 5, 2.4);
  },

  /**
   * Map — parchment + red X marker.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Parchment colour.
   */
  map(ctx, c) {
    rr(ctx, 4, 6, 18, 14, 1, c, O);
    ctx.strokeStyle = '#aa3333'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(8, 16);
    ctx.quadraticCurveTo(13, 8, 18, 13); ctx.stroke();
    ctx.font = 'bold 8px serif';
    ctx.fillStyle = '#aa3333';
    ctx.fillText('X', 15, 19);
  },

  /**
   * Grain stalks — five curved lines.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Stalk colour (alternates with gold).
   */
  grain(ctx, c) {
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = i % 2 ? '#d8b74a' : c;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(13, 23);
      ctx.quadraticCurveTo(9 + i * 2.4, 15, 11 + i * 2.4, 5);
      ctx.stroke();
    }
  },
};
