// ─────────────────────────────────────────────────────────────────────────────
// Icon drawers part A — weapons, tools, armour pieces.
//
// Each drawer receives (ctx, c) where c is the item's primary colour.
// They compose shared primitives from iconPrims.js and artCore.js.
// All coordinates are relative to a 26×26 cell.
// ─────────────────────────────────────────────────────────────────────────────
import { rr, circ } from './artCore.js';
import { O, blade, crossguard, hilt, handle, headTri, tri2, diamond } from './iconPrims.js';

export const SHAPES_A = {
  /**
   * Sword — blade + crossguard + hilt.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Blade colour.
   */
  sword(ctx, c) {
    blade(ctx, c);
    crossguard(ctx);
    hilt(ctx);
  },

  /**
   * Spear — wooden shaft + arrow head.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Head colour.
   */
  spear(ctx, c) {
    // shaft
    ctx.strokeStyle = '#7c5632';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 22); ctx.lineTo(18, 8);
    ctx.stroke();
    // arrow head
    headTri(ctx, 20, 5, c);
  },

  /**
   * Bow — curved arc + taut string.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Bow limb colour.
   */
  bow(ctx, c) {
    // bow limb
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(8, 13, 10, -Math.PI / 2.4, Math.PI / 2.4);
    ctx.stroke();
    // string
    ctx.strokeStyle = '#e5e0d2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 4.5); ctx.lineTo(12, 21.5);
    ctx.stroke();
  },

  /**
   * Crossbow — stock + limb + string.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Limb colour.
   */
  xbow(ctx, c) {
    // wooden stock
    rr(ctx, 9, 16, 8, 7, 1, '#7c5632', O);
    // limb
    ctx.strokeStyle = c; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(22, 8); ctx.stroke();
    // string
    ctx.strokeStyle = '#ddd';
    ctx.beginPath(); ctx.moveTo(13, 4); ctx.lineTo(13, 15); ctx.stroke();
  },

  /**
   * Axe — handle + metal head + blade edge.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Head colour.
   */
  axe(ctx, c) {
    handle(ctx);
    rr(ctx, 14, 5, 9, 10, 2, c, O);
    tri2(ctx, 15, 5, 6, c);
  },

  /**
   * Pickaxe — handle + curved pick head.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Head colour.
   */
  pick(ctx, c) {
    handle(ctx);
    ctx.strokeStyle = c; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(13, 13, 9, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
  },

  /**
   * Hammer — handle + blocky head.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Head colour.
   */
  hammer(ctx, c) {
    handle(ctx);
    rr(ctx, 9, 4, 12, 8, 2, c, O);
  },

  /**
   * Magic rod / staff — curved shaft + orb.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Orb colour.
   */
  rod(ctx, c) {
    // wooden shaft
    ctx.strokeStyle = '#a67f52'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(6, 23);
    ctx.quadraticCurveTo(20, 14, 19, 4); ctx.stroke();
    // wire wrapping
    ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(19, 4);
    ctx.quadraticCurveTo(21, 18, 10, 20); ctx.stroke();
    // orb
    circ(ctx, 9, 20, 2, c);
  },

  /**
   * Shield — kite shape with centre stripe.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Shield face colour.
   */
  shield(ctx, c) {
    ctx.beginPath();
    ctx.moveTo(4, 5); ctx.lineTo(22, 5); ctx.lineTo(22, 14);
    ctx.quadraticCurveTo(22, 22, 13, 24);
    ctx.quadraticCurveTo(4, 22, 4, 14);
    ctx.closePath();
    ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.6; ctx.stroke();
    // centre stripe
    ctx.fillStyle = 'rgba(40,50,60,0.35)';
    ctx.fillRect(11, 5, 4, 19);
  },

  /**
   * Helmet — dome + face slit.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Helmet colour.
   */
  helm(ctx, c) {
    // dome
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(13, 15, 9, Math.PI, Math.PI * 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.5; ctx.stroke();
    // brim
    rr(ctx, 4, 14, 18, 5, 2, c, O);
    // face slit
    ctx.fillStyle = O;
    ctx.fillRect(10, 17, 6, 2);
  },

  /**
   * Chest armour — upper torso + lower torso + centre seam.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Armour colour.
   */
  chest(ctx, c) {
    rr(ctx, 7, 5, 12, 9, 2, c, O);
    rr(ctx, 5, 13, 16, 8, 2, c, O);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = O;
    ctx.fillRect(11, 5, 4, 16);
    ctx.globalAlpha = 1;
  },

  /**
   * Gloves — two small rounded rects side by side.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Glove colour.
   */
  gloves(ctx, c) {
    rr(ctx, 7, 8, 7, 12, 3, c, O);
    rr(ctx, 14, 10, 7, 10, 3, c, O);
  },

  /**
   * Boots — shaft + sole.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Boot colour.
   */
  boots(ctx, c) {
    rr(ctx, 7, 5, 6, 12, 2, c, O);
    rr(ctx, 7, 16, 12, 5, 2, c, O);
  },

  /**
   * Ring — band + gem.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Gem colour.
   */
  ring(ctx, c) {
    circ(ctx, 13, 15, 7, null, c, 3.4);
    diamond(ctx, c, 13, 5, 4);
  },

  /**
   * Amulet — chain arc + gem pendant.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} c  Gem colour.
   */
  amulet(ctx, c) {
    // chain
    ctx.strokeStyle = '#b9a06a'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(13, 12, 8, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    // pendant
    diamond(ctx, c, 13, 19, 6);
  },
};
