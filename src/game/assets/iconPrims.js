// ─────────────────────────────────────────────────────────────────────────────
// Shared mini-primitives for item icon drawers.
//
// Each function draws a small composited element (blade, crossguard, hilt, …)
// that is reused across multiple icon shapes in iconShapesA / iconShapesB.
// ─────────────────────────────────────────────────────────────────────────────
import { circ, ell, rr } from './artCore.js';
import { O } from './artCore.js';

// Re-export for consumers that import O from this module.
export { O };

// ── Sword primitives ────────────────────────────────────────────────────────

/**
 * Draw a sword blade (angular polygon).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} c  Fill colour for the blade.
 */
export const blade = (ctx, c) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(8, 18); ctx.lineTo(16, 4);
  ctx.lineTo(20, 8); ctx.lineTo(12, 21);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = O; ctx.lineWidth = 1.2; ctx.stroke();
};

/** Draw a sword crossguard (diagonal line). */
export const crossguard = (ctx) => {
  ctx.strokeStyle = '#8a6540';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(5, 15); ctx.lineTo(12, 22);
  ctx.stroke();
};

/** Draw a sword hilt (grip detail). */
export const hilt = (ctx) => {
  ctx.strokeStyle = '#57503f';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(3, 20); ctx.lineTo(7, 16);
  ctx.stroke();
};

/** Draw a generic weapon handle (rounded line). */
export const handle = (ctx) => {
  ctx.strokeStyle = '#8a6540';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 22); ctx.lineTo(13, 12);
  ctx.stroke();
};

// ── Geometric primitives ────────────────────────────────────────────────────

/**
 * Draw a small triangle head (arrow/spear tip).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  Centre X.
 * @param {number} y  Centre Y.
 * @param {string} c  Fill colour.
 */
export const headTri = (ctx, x, y, c) => {
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x - 5, y + 3);
  ctx.lineTo(x + 4, y + 3);
  ctx.closePath();
  ctx.fillStyle = c; ctx.fill();
  ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
};

/**
 * Draw a right-angle triangle (for axe heads, fish tails, etc.).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x  Top-left X.
 * @param {number} y  Top-left Y.
 * @param {number} s  Side length.
 * @param {string} c  Fill colour.
 */
export const tri2 = (ctx, x, y, s, c) => {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - s, y + s);
  ctx.lineTo(x, y + s);
  ctx.closePath();
  ctx.fillStyle = c; ctx.fill();
  ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
};

/**
 * Draw a diamond (rhombus) — used for gems and amulet stones.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} c   Fill colour.
 * @param {number} cx  Centre X.
 * @param {number} cy  Centre Y.
 * @param {number} r   Half-height radius.
 */
export const diamond = (ctx, c, cx, cy, r) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.72, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.72, cy);
  ctx.closePath();
  ctx.fillStyle = c; ctx.fill();
  ctx.strokeStyle = O; ctx.lineWidth = 1.3; ctx.stroke();
};

// ── Material shapes ─────────────────────────────────────────────────────────

/**
 * Draw an irregular polygon for a rock / ore chunk icon.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} c  Fill colour.
 */
export const polyRock = (ctx, c) => {
  ctx.beginPath();
  ctx.moveTo(5, 20); ctx.lineTo(4, 13);
  ctx.lineTo(9, 6); ctx.lineTo(18, 5);
  ctx.lineTo(22, 12); ctx.lineTo(19, 20);
  ctx.closePath();
  ctx.fillStyle = c; ctx.fill();
  ctx.strokeStyle = O; ctx.lineWidth = 1.4; ctx.stroke();
};

/**
 * Draw sparkle dots (for gems, enchanted items).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} c     Fill colour.
 * @param {number} n     Number of sparkles.
 */
export const sparkles2 = (ctx, c, n) => {
  ctx.fillStyle = c;
  for (let i = 0; i < n; i++) {
    ctx.fillRect(9 + i * 5, 9 + ((i * 7) % 8), 2, 2);
  }
};

/**
 * Draw an organic blob shape (for hide, skin, food items).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} c  Fill colour.
 */
export const blobShape = (ctx, c) => {
  ctx.beginPath();
  ctx.moveTo(6, 16);
  ctx.bezierCurveTo(4, 7, 14, 3, 19, 8);
  ctx.bezierCurveTo(23, 12, 20, 21, 13, 22);
  ctx.closePath();
  ctx.fillStyle = c; ctx.fill();
  ctx.strokeStyle = O; ctx.lineWidth = 1.3; ctx.stroke();
};

/**
 * Draw a bowl with steam (for stew / potion icon).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} c  Fill colour for the liquid.
 */
export const bowlAndSteam = (ctx, c) => {
  // bowl body
  ctx.fillStyle = '#59504a';
  ctx.beginPath(); ctx.arc(13, 14, 9, 0, Math.PI); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = O; ctx.lineWidth = 1.2; ctx.stroke();
  // liquid surface
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(13, 14, 7.4, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
  // steam wisp
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.moveTo(11, 9); ctx.quadraticCurveTo(9, 5, 11, 2); ctx.stroke();
};

/**
 * Draw a hexagonal grid pattern (for honeycomb).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} c  Fill colour.
 */
export const hexGrid = (ctx, c) => {
  /** Draw a single hexagon at (x, y) with radius r. */
  const hex = (x, y, r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      if (i) ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      else ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1; ctx.stroke();
  };
  hex(13, 9, 4);
  hex(9, 15, 4);
  hex(17, 15, 4);
  hex(13, 20, 4);
};
