/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Humanoid character sheet builder — player + bandit/goblin/skeleton variants.
//
// Produces a 3×4 grid of animation frames (3 walk phases × 4 directions).
// Each frame is 26×34 px (CH_FRAME_W × CH_FRAME_H).
//
// Key exports:
//   drawHumanoidFrame — draw a single frame at a given offset.
//   makeHumanoidSheet — build and register a full 12-frame texture.
// ─────────────────────────────────────────────────────────────────────────────
import {
  CH_FRAME_W, CH_FRAME_H, DIR_ROWS, OUTLINE,
  makeSheetPaint, registerFrames, rr, circ, shade,
  featherShadow, linearGrad, rgba,
} from './artCore.ts';
import { contourWidth } from '../core/VisualProfile.ts';
import type * as Phaser from 'phaser';

// ── Outfit tier palettes ────────────────────────────────────────────────────
/** Main body colour per tier index (0 = rags … 6 = endgame). */
const TIER_MAIN: string[] = ['#7c6c52', '#93683e', '#7c5b41', '#aeb4bd', '#a3bedb', '#8a3030', '#39404d'];
/** Trim / accent colour per tier index. */
const TIER_TRIM: string[] = ['#5c5040', '#6b4a2c', '#4e3826', '#7e848d', '#7290ad', '#c9a24b', '#e8d48a'];

// ── Head accessories ────────────────────────────────────────────────────────

/**
 * Draw hair on a humanoid head.
 * @param cx     Centre X of the head.
 * @param cy     Centre Y of the head.
 * @param r      Head radius.
 * @param style  'short' | 'long' | 'topknot' | 'bald' | 'braided'
 * @param color  Hair fill colour.
 * @param variant  Enemy variant (skips hair for skeletons).
 */
function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  style: string,
  color: string,
  variant: string | null,
): void {
  if (variant === 'skeleton') return;
  ctx.fillStyle = color;
  switch (style) {
    case 'long':
      ctx.beginPath(); ctx.arc(cx, cy - 1.4, r * 1.04, Math.PI * 1.02, Math.PI * 2.05); ctx.fill();
      ctx.fillRect(cx - r * 0.95, cy - 2, r * 1.9, r * 1.6);
      break;
    case 'topknot':
      ctx.beginPath(); ctx.arc(cx, cy - 2.4, r * 0.92, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 2, cy - 7.6, 4, 5);
      break;
    case 'bald':
      break;
    case 'braided':
      ctx.beginPath(); ctx.arc(cx, cy - 1.4, r, Math.PI * 1.06, Math.PI * 2.02); ctx.fill();
      ctx.fillRect(cx - r, cy - 1, 2.4, 5.5);
      break;
    default: // 'short'
      ctx.beginPath(); ctx.arc(cx, cy - 1.2, r * 0.96, Math.PI * 1.05, Math.PI * 2.0); ctx.fill();
      break;
  }
  // A restrained highlight makes hair read as volume at the gameplay scale.
  // It also separates dark hair from the shared world outline without adding
  // noisy one-pixel texture everywhere.
  ctx.fillStyle = shade(color, 24);
  ctx.globalAlpha = 0.48;
  if (style === 'bald') {
    ctx.globalAlpha = 1;
    return;
  }
  ctx.beginPath();
  ctx.arc(cx - r * 0.23, cy - r * 0.62, Math.max(1.15, r * 0.31), Math.PI * 1.08, Math.PI * 1.82);
  ctx.strokeStyle = shade(color, 24);
  ctx.lineWidth = 1.05;
  ctx.stroke();
  if (style === 'long' || style === 'braided') {
    ctx.fillRect(cx - r * 0.82, cy + 1, 1.05, r * 0.8);
  }
  // Fine strand accents give the silhouette a little more authored texture.
  // Keep them sparse so they survive the game's small native sprite size.
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = shade(color, 38);
  ctx.lineWidth = 0.65;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.48, cy - r * 0.72);
  ctx.quadraticCurveTo(cx - r * 0.18, cy - r * 1.02, cx + r * 0.08, cy - r * 0.86);
  if (style === 'long' || style === 'braided') {
    ctx.moveTo(cx - r * 0.78, cy + 0.2);
    ctx.lineTo(cx - r * 0.78, cy + r * 0.65);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Draw a readable face that remains legible when a 26 px sprite is zoomed. */
function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  headY: number,
  skin: string,
  poseDir: string,
  gender: string,
): void {
  if (poseDir === 'up') return;
  const pupilOffset = poseDir === 'left' ? -0.45 : poseDir === 'right' ? 0.45 : 0;
  const eyeY = headY + 4.1;
  const eye = (x: number): void => {
    ctx.fillStyle = '#f6f0e7';
    ctx.fillRect(x - 0.9, eyeY, 2.5, 1.85);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 0.12 + pupilOffset, eyeY + 0.28, 1.25, 1.2);
  };
  ctx.fillStyle = shade(skin, -42);
  ctx.globalAlpha = 0.72;
  if (poseDir === 'down') {
    const browLift = gender === 'f' ? 0.25 : 0;
    ctx.fillRect(cx - 3.25, eyeY - 1.28 - browLift, 2.45, 0.65);
    ctx.fillRect(cx + 0.85, eyeY - 1.28 - browLift, 2.45, 0.65);
    eye(cx - 2.55); eye(cx + 1.05);
    // A small nose and mouth prevent the face from becoming a blank circle.
    ctx.fillStyle = shade(skin, -18);
    ctx.fillRect(cx - 0.35, headY + 5.35, 0.85, 1.15);
    ctx.fillStyle = shade(skin, -35);
    ctx.globalAlpha = gender === 'f' ? 0.42 : 0.34;
    ctx.fillRect(cx - 1.15, headY + 7.3, 2.3, 0.6);
  } else {
    eye(poseDir === 'left' ? cx - 3.05 : cx + 1.75);
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw headgear / helmet accessory.
 * @param cx       Centre X of the head.
 * @param y        Top Y of the head.
 * @param r        Head radius.
 * @param variant  'mask' | 'hood' | 'plume' | 'crown' | null
 */
function drawHeadgear(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  r: number,
  variant: string | null,
): void {
  switch (variant) {
    case 'mask':
      ctx.fillStyle = '#7a3434';
      ctx.fillRect(cx - r, y + 3.2, r * 2, 2.8);
      break;
    case 'hood':
      ctx.fillStyle = '#5d6b46';
      ctx.beginPath(); ctx.arc(cx, y, r * 1.2, Math.PI * 0.92, Math.PI * 2.15); ctx.fill();
      break;
    case 'plume':
      ctx.fillStyle = '#e05050';
      ctx.beginPath();
      ctx.moveTo(cx - 1, y + 2);
      ctx.quadraticCurveTo(cx + 2, y - 6, cx + 5, y - 1);
      ctx.quadraticCurveTo(cx + 2, y + 1, cx - 1, y + 2);
      ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = '#e8c94b';
      ctx.beginPath();
      ctx.moveTo(cx - 4.5, y + 1); ctx.lineTo(cx - 4.5, y - 2); ctx.lineTo(cx - 2.2, y);
      ctx.lineTo(cx, y - 3.4);     ctx.lineTo(cx + 2.2, y);     ctx.lineTo(cx + 4.5, y - 2);
      ctx.lineTo(cx + 4.5, y + 1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.stroke();
      break;
    default:
      break;
  }
}

// ── Frame renderer ──────────────────────────────────────────────────────────

/** Humanoid proportions (relative to frame). */
const HEAD_RADIUS  = 5.4;
const TORSO_HEIGHT = 10.5;
const SHOULDER_W   = 11;
const ARM_LENGTH   = 8.5;
const ARM_W        = 3;
const LEG_W        = 3.1;
const LEG_OFFSET   = 3.8;
const LEG_INSET    = 0.7;
const SHADOW_RX    = 8;
const SHADOW_RY    = 3;
const EYE_W        = 1.6;
const EYE_H        = 2;

/** Pose direction for a humanoid frame. */
export type HumanoidPoseDir = 'down' | 'left' | 'right' | 'up';

/** Options for {@link drawHumanoidFrame}. */
export interface HumanoidFrameOpts {
  /** Walk phase: 0 = idle, 1 = left-step, 2 = right-step. */
  phase: number;
  /** Facing direction. */
  poseDir: string;
  /** Skin tone hex. */
  skin: string;
  /** Outfit tier (0-6). */
  tierIdx?: number;
  /** Hair colour hex. */
  hairColor: string;
  /** 'short' | 'long' | 'topknot' | 'bald' | 'braided' */
  hairstyle: string;
  /** 'm' | 'f' */
  gender: string;
  /** 'goblin' | 'skeleton' | 'brute' | 'mask' | … */
  variant: string | null;
}

/**
 * Draw a single humanoid frame at the given canvas offset.
 *
 * @param ox  Canvas X offset for the frame's top-left.
 * @param oy  Canvas Y offset for the frame's top-left.
 * @param opt
 */
export function drawHumanoidFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  opt: HumanoidFrameOpts,
): void {
  const { phase, poseDir, skin, tierIdx, hairColor, hairstyle, gender, variant } = opt;
  const W = CH_FRAME_W;
  const H = CH_FRAME_H;
  const cx = ox + W / 2;
  const headY = oy + 5;
  const isFemale = gender === 'f';
  // Distinct adult silhouettes, designed for the top-down scale: a broader
  // travel coat on the male frame and a fitted coat with a shorter mantle on
  // the female frame. The difference is visual, not a gameplay/stat change.
  const torsoTop = oy + (isFemale ? 13.2 : 12.6);
  const torsoHeight = isFemale ? 10.2 : 11.1;
  const isSkeleton = variant === 'skeleton';
  const bruteW = variant === 'brute' ? 1.32 : 1;
  const shoulderW = (isFemale ? SHOULDER_W * 0.94 : SHOULDER_W * 1.12) * bruteW;
  const ti = Math.min(tierIdx ?? 0, 6);
  const outfit = {
    main: isSkeleton ? '#39404d' : (TIER_MAIN[ti] ?? '#7c6c52'),
    trim: TIER_TRIM[ti] ?? '#5c5040',
  };
  const swing = phase === 0 ? 0 : phase === 1 ? 2.4 : -2.4;

  // ── Ground shadow (painterly: soft feathered falloff) ────────────────
  featherShadow(ctx, cx, oy + H - SHADOW_RY, SHADOW_RX * 1.2, SHADOW_RY * 1.5, 0.26);

  // ── Legs ──────────────────────────────────────────────────────────────
  const hipY = torsoTop + torsoHeight - 1.3;
  const legLen = H - (hipY - oy) - 3.5;
  const isWalkLR = poseDir === 'left' || poseDir === 'right';
  const pantsC = isSkeleton
    ? '#ded6bd'
    : variant === 'goblin'
      ? '#54652e'
      : ti <= 2
        ? '#57503f'
        : outfit.trim;

  rr(ctx, cx - LEG_OFFSET, hipY, LEG_W, legLen + (isWalkLR ? swing * 0.4 : swing), 1.5, pantsC, undefined, contourWidth('gameplay'));
  rr(ctx, cx + LEG_INSET, hipY, LEG_W, legLen - (isWalkLR ? swing * 0.4 : swing), 1.5, pantsC, undefined, contourWidth('gameplay'));

  // ── Torso (painterly: left-lit → right-shadow gradient) ───────────────
  const torsoGrad = linearGrad(
    ctx, cx - shoulderW / 2, torsoTop, cx + shoulderW / 2, torsoTop + torsoHeight,
    [[0, shade(outfit.main, 22)], [0.55, outfit.main], [1, shade(outfit.main, -22)]],
  );
  rr(ctx, cx - shoulderW / 2, torsoTop, shoulderW, torsoHeight, isFemale ? 3.5 : 2.7, torsoGrad, undefined, contourWidth('gameplay'));
  // Layered lapel/collar: even starter clothing should look like intentional
  // traveller gear rather than a flat coloured block.
  if (!isSkeleton) {
    ctx.fillStyle = shade(outfit.main, 16);
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW / 2 + 1.2, torsoTop + 1.3);
    ctx.lineTo(cx, torsoTop + 4.4);
    ctx.lineTo(cx + shoulderW / 2 - 1.2, torsoTop + 1.3);
    ctx.lineTo(cx + shoulderW / 2 - 1.2, torsoTop + 2.9);
    ctx.lineTo(cx, torsoTop + 5.7);
    ctx.lineTo(cx - shoulderW / 2 + 1.2, torsoTop + 2.9);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (!isSkeleton && ti >= 3) {
    // armour trim line
    ctx.fillStyle = outfit.trim;
    ctx.fillRect(cx - shoulderW / 2 + 1, torsoTop + 4.5, shoulderW - 2, 1.6);
    // pauldrons
    rr(ctx, cx - shoulderW / 2 - 1.5, torsoTop - 0.5, 4.4, 4, 2, outfit.trim);
    rr(ctx, cx + shoulderW / 2 - 3, torsoTop - 0.5, 4.4, 4, 2, outfit.trim);
  }
  // female tunic (low tiers only)
  if (!isSkeleton && isFemale && ti <= 2) {
    ctx.fillStyle = shade(outfit.main, -12);
    ctx.beginPath();
    ctx.moveTo(cx - 4.9, torsoTop + torsoHeight - 1.8);
    ctx.lineTo(cx + 4.9, torsoTop + torsoHeight - 1.8);
    ctx.lineTo(cx + 6.3, hipY + 3.4 + Math.abs(swing));
    ctx.lineTo(cx - 6.3, hipY + 3.4 - Math.abs(swing));
    ctx.closePath();
    ctx.fill();
  } else if (!isSkeleton && !isFemale && ti <= 2) {
    // The male starter silhouette has a split travel-coat instead of a dress
    // skirt, giving both options believable outdoor clothing.
    ctx.fillStyle = shade(outfit.main, -15);
    ctx.fillRect(cx - shoulderW / 2 + 1, torsoTop + torsoHeight - 2.5, shoulderW - 2, 3.8);
    ctx.fillStyle = shade(outfit.trim, -6);
    ctx.fillRect(cx - 0.6, torsoTop + torsoHeight - 1.4, 1.2, 4.4);
  }

  // ── Arms ──────────────────────────────────────────────────────────────
  // Starter gear should feel handcrafted, even before the player finds armour.
  // Keep these marks chunky enough to read at the game's native 26×34 scale.
  if (!isSkeleton) {
    const leather = ti >= 3 ? '#343b46' : '#493326';
    const leatherLight = ti >= 3 ? '#8e9aa8' : '#9a7046';
    const frontFacing = poseDir === 'down' || poseDir === 'left' || poseDir === 'right';
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = leather;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (frontFacing) {
      ctx.moveTo(cx - shoulderW / 2 + 2, torsoTop + 2.1);
      ctx.lineTo(cx + shoulderW / 2 - 2, torsoTop + torsoHeight - 1.1);
    } else {
      ctx.moveTo(cx - shoulderW / 2 + 2, torsoTop + 2.1);
      ctx.lineTo(cx + shoulderW / 2 - 2, torsoTop + 2.1);
    }
    ctx.stroke();
    ctx.strokeStyle = leatherLight;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    if (frontFacing) {
      ctx.moveTo(cx - shoulderW / 2 + 2, torsoTop + 1.6);
      ctx.lineTo(cx + shoulderW / 2 - 2, torsoTop + torsoHeight - 1.6);
    } else {
      ctx.moveTo(cx - shoulderW / 2 + 2, torsoTop + 1.6);
      ctx.lineTo(cx + shoulderW / 2 - 2, torsoTop + 1.6);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = shade(outfit.main, 28);
    ctx.globalAlpha = 0.78;
    ctx.fillRect(cx - shoulderW / 2 + 1.2, torsoTop + 4.2, 0.7, Math.max(2, torsoHeight - 6));
    ctx.globalAlpha = 1;
    rr(ctx, cx + shoulderW / 2 - 1.2, torsoTop + torsoHeight - 1.5, 4.2, 4.6, 1.1, leather);
    ctx.fillStyle = leatherLight;
    ctx.fillRect(cx + shoulderW / 2 + 0.2, torsoTop + torsoHeight + 0.1, 1.2, 0.8);

    // Tailored seam and small stitched marks make the starter coat feel sewn
    // from separate pieces instead of one flat shape.
    ctx.strokeStyle = shade(outfit.main, 34);
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - shoulderW / 2 + 2.1, torsoTop + 5.1);
    ctx.lineTo(cx - shoulderW / 2 + 2.1, torsoTop + torsoHeight - 3.2);
    ctx.moveTo(cx + shoulderW / 2 - 2.1, torsoTop + 5.1);
    ctx.lineTo(cx + shoulderW / 2 - 2.1, torsoTop + torsoHeight - 3.2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d8c18a';
    ctx.fillRect(cx - 3.5, torsoTop + 6.3, 0.8, 0.8);
    ctx.fillRect(cx + 2.8, torsoTop + 8.2, 0.8, 0.8);

    // Higher tiers get readable metal edging and tiny rivets on the shoulder
    // plates. These accents are cosmetic and use the existing tier palette.
    if (ti >= 3) {
      ctx.fillStyle = shade(outfit.trim, 34);
      ctx.fillRect(cx - shoulderW / 2 - 0.4, torsoTop + 0.1, 2.8, 0.7);
      ctx.fillRect(cx + shoulderW / 2 - 2.4, torsoTop + 0.1, 2.8, 0.7);
      ctx.fillStyle = '#f0d99a';
      ctx.fillRect(cx - shoulderW / 2 + 0.3, torsoTop + 1.3, 0.9, 0.9);
      ctx.fillRect(cx + shoulderW / 2 - 1.2, torsoTop + 1.3, 0.9, 0.9);
    }
  }

  const armSkin = isSkeleton ? '#ded6bd' : skin;
  rr(ctx, cx - shoulderW / 2 - 3, torsoTop + 1.5 + swing * 0.8, ARM_W, ARM_LENGTH, 1.5, armSkin, undefined, contourWidth('gameplay'));
  rr(ctx, cx + shoulderW / 2, torsoTop + 1.5 - swing * 0.8, ARM_W, ARM_LENGTH, 1.5, armSkin, undefined, contourWidth('gameplay'));
  if (!isSkeleton) {
    const bracer = ti >= 3 ? outfit.trim : '#59402e';
    rr(ctx, cx - shoulderW / 2 - 3.1, torsoTop + 5.2 + swing * 0.8, ARM_W + 0.4, 2.5, 0.8, bracer);
    rr(ctx, cx + shoulderW / 2 - 0.2, torsoTop + 5.2 - swing * 0.8, ARM_W + 0.4, 2.5, 0.8, bracer);
    ctx.fillStyle = shade(bracer, 30);
    ctx.fillRect(cx - shoulderW / 2 - 2.8, torsoTop + 5.4 + swing * 0.8, 0.7, 1.5);
    ctx.fillRect(cx + shoulderW / 2 + 0.1, torsoTop + 5.4 - swing * 0.8, 0.7, 1.5);
  }

  // hand circles at arm ends
  if (!isSkeleton) {
    circ(ctx, cx - shoulderW / 2 - 1.5, torsoTop + 1.5 + swing * 0.8 + ARM_LENGTH, 1.8, armSkin, undefined, contourWidth('gameplay'));
    circ(ctx, cx + shoulderW / 2 + 1.5, torsoTop + 1.5 - swing * 0.8 + ARM_LENGTH, 1.8, armSkin, undefined, contourWidth('gameplay'));
  }

  // ── Head ──────────────────────────────────────────────────────────────
  const headColour = isSkeleton ? '#ded6bd' : skin;
  circ(ctx, cx, headY + HEAD_RADIUS - 1, HEAD_RADIUS, headColour, undefined, contourWidth('gameplay'));
  // skin shading — lighter on left (light source), darker on right
  if (!isSkeleton) {
    ctx.fillStyle = shade(skin, 14);
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(cx - 1.5, headY + HEAD_RADIUS - 2, HEAD_RADIUS * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade(skin, -12);
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.arc(cx + 2, headY + HEAD_RADIUS, HEAD_RADIUS * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Painterly rim light: a bright crescent on the lit (upper-left) edge so
    // the head reads against dark biomes and at night (ART-DIRECTION §9).
    ctx.strokeStyle = rgba(shade(skin, 60), 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, headY + HEAD_RADIUS - 1, HEAD_RADIUS - 0.7, Math.PI * 0.95, Math.PI * 1.6);
    ctx.stroke();
  }

  if (isSkeleton) {
    // skeleton face: two eye sockets + jaw line
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(cx - 2.4, headY + 3, 1.8, 1.6);
    ctx.fillRect(cx + 0.8, headY + 3, 1.8, 1.6);
    ctx.fillRect(cx - 1.6, headY + 6.4, 3.4, 0.9);
    // eye glow
    ctx.fillStyle = '#5ad0c0';
    ctx.globalAlpha = 0.6;
    ctx.fillRect(cx - 2, headY + 3.3, 1, 1);
    ctx.fillRect(cx + 1.2, headY + 3.3, 1, 1);
    ctx.globalAlpha = 1;
  } else {
    drawHair(ctx, cx, headY + HEAD_RADIUS - 1, HEAD_RADIUS, hairstyle, hairColor, variant);
    drawHeadgear(ctx, cx, headY + HEAD_RADIUS - 1, HEAD_RADIUS, variant);

    drawFace(ctx, cx, headY, skin, poseDir, gender);

    // goblin ears
    if (variant === 'goblin') {
      ctx.fillStyle = skin;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * (HEAD_RADIUS - 1), headY + 4);
        ctx.lineTo(cx + s * (HEAD_RADIUS + 4), headY + 1);
        ctx.lineTo(cx + s * (HEAD_RADIUS - 0.5), headY + 7);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  }

  // ── Clothing details (belt, collar) ──────────────────────────────────
  if (!isSkeleton) {
    // belt line
    ctx.fillStyle = shade(outfit.main, -18);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(cx - shoulderW / 2 + 1, torsoTop + torsoHeight - 3, shoulderW - 2, 1.5);
    ctx.globalAlpha = 1;
    // belt buckle
    ctx.fillStyle = ti >= 3 ? '#c9a24b' : '#8a7a60';
    ctx.fillRect(cx - 1, torsoTop + torsoHeight - 3.5, 2.5, 2.5);
    const boot = ti >= 3 ? '#353b45' : '#493326';
    ctx.fillStyle = boot;
    ctx.fillRect(cx - LEG_OFFSET - 0.2, oy + H - 5.2, LEG_W + 0.8, 1.6);
    ctx.fillRect(cx + LEG_INSET - 0.2, oy + H - 5.2, LEG_W + 0.8, 1.6);
    ctx.fillStyle = shade(boot, 28);
    ctx.fillRect(cx - LEG_OFFSET, oy + H - 5.1, LEG_W - 0.2, 0.65);
    ctx.fillRect(cx + LEG_INSET, oy + H - 5.1, LEG_W - 0.2, 0.65);
    // A narrow boot welt and trouser fold catch the light as the feet move.
    ctx.fillStyle = shade(boot, 42);
    ctx.fillRect(cx - LEG_OFFSET - 0.1, oy + H - 3.8, LEG_W + 0.6, 0.55);
    ctx.fillRect(cx + LEG_INSET - 0.1, oy + H - 3.8, LEG_W + 0.6, 0.55);
    ctx.fillStyle = shade(pantsC, 18);
    ctx.fillRect(cx - LEG_OFFSET + 0.5, hipY + 2.1, 0.65, Math.max(2, legLen - 4));
    ctx.fillRect(cx + LEG_INSET + 0.5, hipY + 2.1, 0.65, Math.max(2, legLen - 4));
  }
}

// ── Sheet builder ───────────────────────────────────────────────────────────

/** Appearance configuration for {@link makeHumanoidSheet}. */
export interface HumanoidSheetCfg {
  /** Skin tone hex. */
  skin?: string;
  /** Outfit tier (0-6). */
  tierIdx?: number;
  /** Hair colour hex. */
  hairColor?: string;
  /** 'short'|'long'|'topknot'|'bald'|'braided' */
  hairstyle?: string;
  /** 'm'|'f' */
  gender?: string;
  /** 'goblin'|'skeleton'|'brute'|'mask'|… */
  variant?: string | null;
}

/**
 * Build a full 12-frame humanoid sheet texture (3 walk phases × 4 directions).
 *
 * @param scene  Scene that owns the texture manager.
 * @param key    Unique texture key.
 * @param cfg    Appearance configuration.
 * @returns Array of generated frame names (e.g. "down_0", "up_2").
 */
export function makeHumanoidSheet(scene: Phaser.Scene, key: string, cfg: HumanoidSheetCfg): string[] {
  const names: string[] = [];
  // Painted through the active profile: art-scale texels when painterly, native
  // in the pixel style. Frames display at their native size either way, so
  // nothing downstream (body sizes, anchors, depth) has to know.
  const sheet = makeSheetPaint(CH_FRAME_W * 3, CH_FRAME_H * 4);
  const ctx = sheet.ctx;

  DIR_ROWS.forEach((dir, row) => {
    for (let p = 0; p < 3; p++) {
      drawHumanoidFrame(ctx, p * CH_FRAME_W, row * CH_FRAME_H, {
        phase: p,
        poseDir: dir,
        skin: cfg.skin || '#caa27c',
        tierIdx: cfg.tierIdx ?? 0,
        hairColor: cfg.hairColor || '#4a3222',
        hairstyle: cfg.hairstyle || 'short',
        gender: cfg.gender || 'm',
        variant: cfg.variant || null,
      });
      names.push(`${dir}_${p}`);
    }
  });

  registerFrames(scene, key, sheet.canvas, CH_FRAME_W, CH_FRAME_H, names, sheet.scale);
  return names.slice();
}
