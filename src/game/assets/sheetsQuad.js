// ─────────────────────────────────────────────────────────────────────────────
// Quadruped sheet builder — wolves, boars, bears — 12 frames.
//
// Produces a 3×4 grid of animation frames (3 walk phases × 4 directions).
// Each frame is 44×30 px (QUAD_W × QUAD_H).
//
// Quadrupeds are mirrored horizontally for left/right facing.
// ─────────────────────────────────────────────────────────────────────────────
import {
  QUAD_W, QUAD_H, DIR_ROWS, OUTLINE,
  makeCanvas, registerFrames, circ, ell, tri, shade,
} from './artCore.js';

// ── Quadruped anatomy proportions ───────────────────────────────────────────
const BODY_RX        = 12.5; // body ellipse horizontal radius
const BODY_RY        = 7.2;  // body ellipse vertical radius
const HEAD_R         = 5.6;  // head circle radius
const HEAD_OFFSET_X  = 12;   // head centre X offset from body centre
const HEAD_OFFSET_Y  = -4;   // head centre Y offset from body centre
const SNOUT_RX       = 3.2;  // snout ellipse horizontal radius
const SNOUT_RY       = 2.1;  // snout ellipse vertical radius
const SNOUT_OFFSET   = 4.6;  // snout X offset from head centre
const NOSE_SIZE      = 1.4;  // nose pixel size
const LEG_W          = 3.6;  // leg width
const LEG_BASE_LEN   = 8;    // leg base length
const TAIL_LEN       = 19;   // tail tip X offset from body centre
const EAR_SIZE       = 4;    // ear triangle size
const SHADOW_RX      = 13;   // ground shadow horizontal radius
const SHADOW_RY      = 3.2;  // ground shadow vertical radius

// ── Leg positions relative to body centre (x-offset, phase-alternating flag) ─
const LEG_POSITIONS = [[-8, 0], [-5, 1], [6, 0], [9, 1]];

// ── Face-down eye positions ─────────────────────────────────────────────────
const EYES_DOWN = [
  { dx: -2.4, dy: -1.2 },
  { dx: 0.8,  dy: -1.2 },
];

/**
 * Build a full 12-frame quadruped sheet texture.
 *
 * @param {Phaser.Scene} scene  Scene that owns the texture manager.
 * @param {string}       key    Unique texture key.
 * @param {Object}       cfg    Appearance configuration.
 * @param {string}       [cfg.fur='#7a7060']   Fur base colour hex.
 * @param {string}       [cfg.belly='#b3aa97'] Belly / underside colour hex.
 * @param {number}       [cfg.bulk=1]          Body size multiplier (>1 = bigger).
 * @param {boolean}      [cfg.tusks=false]     Draw boar tusks.
 * @param {string|null}  [cfg.scars=null]      Draw alpha scars if truthy.
 * @param {string|null}  [cfg.eyes=null]       Eye colour (defaults to OUTLINE).
 * @returns {string[]} Array of generated frame names (e.g. "down_0", "up_2").
 */
export function makeQuadrupedSheet(scene, key, cfg) {
  const names = [];
  const { canvas, ctx } = makeCanvas(QUAD_W * 3, QUAD_H * 4);
  const fur   = cfg.fur   || '#7a7060';
  const belly = cfg.belly || '#b3aa97';
  const bulk  = cfg.bulk  || 1;

  DIR_ROWS.forEach((dir, row) => {
    for (let p = 0; p < 3; p++) {
      const ox = p * QUAD_W;
      const oy = row * QUAD_H;
      const stepA = p === 1 ? 3 : p === 2 ? -3 : 0;
      const flip = dir === 'right' ? -1 : 1;

      ctx.save();

      // Mirror for right-facing
      if (flip < 0) {
        ctx.translate(ox + QUAD_W / 2 + ox + QUAD_W / 2, 0);
        ctx.scale(-1, 1);
      }

      const bx = ox + QUAD_W / 2; // body centre X
      const by = oy + QUAD_H / 2; // body centre Y

      // ── Ground shadow ─────────────────────────────────────────────────
      ell(ctx, bx, oy + QUAD_H - 3, SHADOW_RX, SHADOW_RY, 'rgba(0,0,0,0.18)', null);

      // ── Legs ──────────────────────────────────────────────────────────
      ctx.fillStyle = shade(fur, -24);
      LEG_POSITIONS.forEach(([lx, i]) => {
        const legLen = LEG_BASE_LEN + (i ? stepA : -stepA);
        ctx.fillRect(bx + lx * flip, by + 4, LEG_W, legLen);
      });

      // ── Body ──────────────────────────────────────────────────────────
      ell(ctx, bx, by, BODY_RX * bulk, BODY_RY * bulk, fur, OUTLINE, 0);
      // belly highlight
      ell(ctx, bx, by + 2.6, 9, 3.6, belly, null);

      // ── Tail ──────────────────────────────────────────────────────────
      ctx.strokeStyle = fur; ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(bx - 11 * flip, by - 2);
      ctx.quadraticCurveTo(bx - 16 * flip, by - 5 + stepA, bx - TAIL_LEN * flip, by - 8 + stepA * 0.6);
      ctx.stroke();

      // ── Head ──────────────────────────────────────────────────────────
      const hx = bx + HEAD_OFFSET_X * flip;
      const hy = by + HEAD_OFFSET_Y;
      circ(ctx, hx, hy, HEAD_R * bulk, fur, OUTLINE);
      // snout
      ell(ctx, hx + SNOUT_OFFSET * flip, hy + 1.4, SNOUT_RX, SNOUT_RY, belly, OUTLINE);
      // nose
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(hx + 7 * flip, hy + 0.5, NOSE_SIZE, NOSE_SIZE);

      // ── Ears ──────────────────────────────────────────────────────────
      ctx.fillStyle = shade(fur, -14);
      if (dir === 'down') {
        // both ears visible
        tri(ctx, hx - 5, hy - 4.5, EAR_SIZE, shade(fur, -14));
        tri(ctx, hx + 1.5, hy - 4.5, EAR_SIZE, shade(fur, -14));
      } else {
        // single ear (side view)
        tri(ctx, hx - 3.5 * flip - 2, hy - 4.5, EAR_SIZE, shade(fur, -14));
      }

      // ── Eyes ──────────────────────────────────────────────────────────
      ctx.fillStyle = cfg.eyes || OUTLINE;
      if (dir === 'down') {
        // front-facing: two eyes
        EYES_DOWN.forEach(({ dx, dy }) => {
          ctx.fillRect(hx + dx, hy + dy, 1.7, 1.9);
        });
      } else {
        // side view: single eye
        ctx.fillRect(hx + 2 * flip, hy - 1.6, 1.8, 2);
      }

      // ── Boar tusks ────────────────────────────────────────────────────
      if (cfg.tusks) {
        ctx.fillStyle = '#ded6bd';
        ctx.beginPath();
        ctx.moveTo(hx + 3.6 * flip, hy + 3);
        ctx.lineTo(hx + 6 * flip, hy + 1.4);
        ctx.lineTo(hx + 4.2 * flip, hy + 1.2);
        ctx.closePath();
        ctx.fill();
      }

      // ── Alpha scars ───────────────────────────────────────────────────
      if (cfg.scars) {
        ctx.strokeStyle = '#c86a5a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx - 2 * flip, by - 4);
        ctx.lineTo(bx + 3 * flip, by - 1);
        ctx.stroke();
      }

      ctx.restore();
      names.push(`${dir}_${p}`);
    }
  });

  registerFrames(scene, key, canvas, QUAD_W, QUAD_H, names);
  return names.slice();
}
