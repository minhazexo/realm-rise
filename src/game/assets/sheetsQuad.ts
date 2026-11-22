/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Quadruped sheet builder — wolves, boars, bears, deer — 12 frames.
//
// Produces a 3×4 grid of animation frames (3 walk phases × 4 directions).
// Each frame displays at 44×30 px (QUAD_W × QUAD_H) — the texture behind it
// carries `VISUAL_PROFILE.artScale`× the texels, so collision, anchors and
// display sizes are unchanged while the art stays sharp at the camera's zoom.
//
// Quadrupeds are mirrored horizontally for left/right facing.
//
// Painterly pass (docs/ART-DIRECTION.md): feathered contact shadow, one lit
// body/head form with a shaded far side, two-tone legs for depth order, and a
// rim light on the lit edge so wildlife reads against dark biomes and at night.
// ─────────────────────────────────────────────────────────────────────────────
import {
  QUAD_W, QUAD_H, DIR_ROWS, OUTLINE,
  makeSheetPaint, registerFrames, circ, ell, tri, shade,
  featherShadow, radialGrad, rgba,
} from './artCore.ts';
import { contourWidth } from '../core/VisualProfile.ts';
import type * as Phaser from 'phaser';

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
const LEG_POSITIONS: Array<[number, number]> = [[-8, 0], [-5, 1], [6, 0], [9, 1]];

// ── Face-down eye positions ─────────────────────────────────────────────────
/** Eye offset from the head centre. */
interface EyeOffset {
  dx: number;
  dy: number;
}
const EYES_DOWN: EyeOffset[] = [
  { dx: -2.4, dy: -1.2 },
  { dx: 0.8,  dy: -1.2 },
];

/** Appearance configuration for {@link makeQuadrupedSheet}. */
export interface QuadrupedSheetCfg {
  /** Fur base colour hex. */
  fur?: string;
  /** Belly / underside colour hex. */
  belly?: string;
  /** Body size multiplier (>1 = bigger). */
  bulk?: number;
  /** Draw boar tusks. */
  tusks?: boolean;
  /** Draw alpha scars if truthy. */
  scars?: string | null;
  /** Eye colour (defaults to OUTLINE). */
  eyes?: string | null;
  /** Draw antlers (deer bucks). */
  antlers?: boolean;
  /** Slim runner build: narrower body, longer legs (deer). */
  slim?: boolean;
}

/**
 * Build a full 12-frame quadruped sheet texture.
 *
 * @param scene  Scene that owns the texture manager.
 * @param key    Unique texture key.
 * @param cfg    Appearance configuration.
 * @returns Array of generated frame names (e.g. "down_0", "up_2").
 */
export function makeQuadrupedSheet(scene: Phaser.Scene, key: string, cfg: QuadrupedSheetCfg): string[] {
  const names: string[] = [];
  const sheet = makeSheetPaint(QUAD_W * 3, QUAD_H * 4);
  const ctx = sheet.ctx;
  const fur   = cfg.fur   || '#7a7060';
  const belly = cfg.belly || '#b3aa97';
  const bulk  = cfg.bulk  || 1;
  const slim  = cfg.slim ? 1 : 0;
  const bodyRx = (BODY_RX - 2.2 * slim) * bulk;
  const bodyRy = (BODY_RY - 1.1 * slim) * bulk;
  const legLen0 = LEG_BASE_LEN + 3.5 * slim;
  // Gameplay-plane contour: characters and enemies read as forms (ART §6).
  const contour = contourWidth('gameplay');
  // Lit edge (top-left) rim colour, derived from the belly tone.
  const rim = rgba(shade(belly, 70), 0.4);

  DIR_ROWS.forEach((dir, row) => {
    for (let p = 0; p < 3; p++) {
      const ox = p * QUAD_W;
      const oy = row * QUAD_H;
      const stepA = p === 1 ? 3 : p === 2 ? -3 : 0;
      const flip = dir === 'right' ? -1 : 1;
      // Walk bob: torso rises mid-stride, settles on the pass-through frame.
      const bobY = p === 1 ? -1.1 : p === 2 ? 0.5 : 0;

      ctx.save();

      // Mirror for right-facing: reflect about the frame's own centre line.
      if (flip < 0) {
        ctx.translate(2 * ox + QUAD_W, 0);
        ctx.scale(-1, 1);
      }

      const bx = ox + QUAD_W / 2; // body centre X
      const by = oy + QUAD_H / 2 + bobY; // body centre Y (bobbed)

      // ── Ground shadow (painterly: soft feathered falloff) ──────────────
      featherShadow(ctx, bx, oy + QUAD_H - 3, SHADOW_RX * 1.15, SHADOW_RY * 1.6, 0.26);

      // ── Legs ──────────────────────────────────────────────────────────
      // Front/back views use symmetric leg pairs; side views keep the offset set.
      const strideLegs: Array<[number, number]> = (dir === 'down' || dir === 'up')
        ? [[-8, 0], [-5, 1], [5, 0], [8, 1]]
        : LEG_POSITIONS;
      strideLegs.forEach(([lx, i]) => {
        const legLen = legLen0 + (i ? stepA : -stepA);
        // Two tones give the walk a depth order: the far pair sits in the
        // body's shadow, the near pair catches the light.
        ctx.fillStyle = i ? shade(fur, -32) : shade(fur, -12);
        ctx.fillRect(bx + lx * flip, by + 4, LEG_W, legLen);
      });

      // ── Body: one lit form, not a flat ellipse ────────────────────────
      const bodyGrad = radialGrad(
        ctx, bx - bodyRx * 0.38, by - bodyRy * 0.55, bodyRx * 0.12, bodyRx * 1.6,
        [[0, shade(fur, 30)], [0.5, fur], [1, shade(fur, -28)]],
      );
      ell(ctx, bx, by, bodyRx, bodyRy, bodyGrad, OUTLINE, 0, contour);
      // belly highlight (soft, so it reads as light on fur, not a pasted shape)
      ell(ctx, bx, by + 2.6 * bulk, 9 * bulk, 3.6 * bulk, rgba(belly, 0.8), null);
      // Rim light along the lit edge. The arc spans the top of the form, so it
      // stays put when the frame is mirrored for right-facing rows.
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(bx, by, Math.max(1, bodyRx - 1.4), Math.max(1, bodyRy - 1), 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();

      // ── Tail ──────────────────────────────────────────────────────────
      ctx.strokeStyle = shade(fur, -10); ctx.lineWidth = 3.4;
      if (dir === 'up') {
        // Rear view: tail hangs down the centre of the rump.
        ctx.beginPath();
        ctx.moveTo(bx, by - bodyRy * 0.4);
        ctx.quadraticCurveTo(bx + (p - 1) * 1.5, by + 2, bx + (p - 1) * 2.5, by + bodyRy + 3);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(bx - 11 * flip, by - 2);
        ctx.quadraticCurveTo(bx - 16 * flip, by - 5 + stepA, bx - TAIL_LEN * flip, by - 8 + stepA * 0.6);
        ctx.stroke();
      }

      // ── Head ──────────────────────────────────────────────────────
      if (dir === 'up') {
        // Rear view: head hidden behind the body — only ears (and antlers
        // for bucks) peek over the back. No face, no eyes.
        ctx.fillStyle = shade(fur, -14);
        tri(ctx, bx - 5, by - bodyRy - 4, EAR_SIZE, shade(fur, -14));
        tri(ctx, bx + 1.5, by - bodyRy - 4, EAR_SIZE, shade(fur, -14));
        if (cfg.antlers) {
          ctx.strokeStyle = '#6b5233'; ctx.lineWidth = 1.6;
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(bx + s * 3, by - bodyRy - 6);
            ctx.lineTo(bx + s * 5, by - bodyRy - 11);
            ctx.moveTo(bx + s * 4.2, by - bodyRy - 8.5);
            ctx.lineTo(bx + s * 7, by - bodyRy - 10);
            ctx.stroke();
          }
        }
      } else {
      const hx = bx + HEAD_OFFSET_X * flip;
      const hy = by + HEAD_OFFSET_Y;
      const headR = HEAD_R * bulk;
      const headGrad = radialGrad(
        ctx, hx - headR * 0.4, hy - headR * 0.5, headR * 0.15, headR * 1.8,
        [[0, shade(fur, 26)], [0.55, fur], [1, shade(fur, -26)]],
      );
      circ(ctx, hx, hy, headR, headGrad, OUTLINE, contour);
      // Head rim (top edge — mirror-invariant, like the body rim).
      ctx.strokeStyle = rim;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(hx, hy, Math.max(1, headR - 0.9), Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      // snout
      ell(ctx, hx + SNOUT_OFFSET * flip, hy + 1.4, SNOUT_RX, SNOUT_RY, rgba(belly, 0.95), OUTLINE, 0, 1.2);
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

        // ── Antlers (deer bucks, side/front views) ────────────────────
        if (cfg.antlers) {
          ctx.strokeStyle = '#6b5233'; ctx.lineWidth = 1.6;
          if (dir === 'down') {
            for (const s of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(hx + s * 3, hy - 5);
              ctx.lineTo(hx + s * 5, hy - 10);
              ctx.moveTo(hx + s * 4.2, hy - 7.5);
              ctx.lineTo(hx + s * 7, hy - 9);
              ctx.stroke();
            }
          } else {
            ctx.beginPath();
            ctx.moveTo(hx - 1 * flip, hy - 5);
            ctx.lineTo(hx - 3 * flip, hy - 11);
            ctx.moveTo(hx - 2 * flip, hy - 8);
            ctx.lineTo(hx - 5 * flip, hy - 9.5);
            ctx.stroke();
          }
        }
      } // end front/side head branch

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

  registerFrames(scene, key, sheet.canvas, QUAD_W, QUAD_H, names, sheet.scale);
  return names.slice();
}
