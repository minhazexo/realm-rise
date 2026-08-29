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
  makeCanvas, registerFrames, rr, circ, shade,
} from './artCore.js';

// ── Outfit tier palettes ────────────────────────────────────────────────────
/** Main body colour per tier index (0 = rags … 6 = endgame). */
const TIER_MAIN  = ['#7c6c52', '#93683e', '#7c5b41', '#aeb4bd', '#a3bedb', '#8a3030', '#39404d'];
/** Trim / accent colour per tier index. */
const TIER_TRIM  = ['#5c5040', '#6b4a2c', '#4e3826', '#7e848d', '#7290ad', '#c9a24b', '#e8d48a'];

// ── Head accessories ────────────────────────────────────────────────────────

/**
 * Draw hair on a humanoid head.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx     Centre X of the head.
 * @param {number} cy     Centre Y of the head.
 * @param {number} r      Head radius.
 * @param {string} style  'short' | 'long' | 'topknot' | 'bald' | 'braided'
 * @param {string} color  Hair fill colour.
 * @param {string|null} variant  Enemy variant (skips hair for skeletons).
 */
function drawHair(ctx, cx, cy, r, style, color, variant) {
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
}

/**
 * Draw headgear / helmet accessory.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx       Centre X of the head.
 * @param {number} y        Top Y of the head.
 * @param {number} r        Head radius.
 * @param {string|null} variant  'mask' | 'hood' | 'plume' | 'crown' | null
 */
function drawHeadgear(ctx, cx, y, r, variant) {
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

/**
 * Draw a single humanoid frame at the given canvas offset.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} ox  Canvas X offset for the frame's top-left.
 * @param {number} oy  Canvas Y offset for the frame's top-left.
 * @param {Object} opt
 * @param {number}  opt.phase     Walk phase: 0 = idle, 1 = left-step, 2 = right-step.
 * @param {string}  opt.poseDir   'down' | 'left' | 'right' | 'up'
 * @param {string}  opt.skin      Skin tone hex.
 * @param {number}  opt.tierIdx   Outfit tier (0-6).
 * @param {string}  opt.hairColor Hair colour hex.
 * @param {string}  opt.hairstyle 'short' | 'long' | 'topknot' | 'bald' | 'braided'
 * @param {string}  opt.gender    'm' | 'f'
 * @param {string|null} opt.variant  'goblin' | 'skeleton' | 'brute' | 'mask' | …
 */
export function drawHumanoidFrame(ctx, ox, oy, opt) {
  const { phase, poseDir, skin, tierIdx, hairColor, hairstyle, gender, variant } = opt;
  const W = CH_FRAME_W;
  const H = CH_FRAME_H;
  const cx = ox + W / 2;
  const headY = oy + 5;
  const torsoTop = oy + 13;
  const isSkeleton = variant === 'skeleton';
  const bruteW = variant === 'brute' ? 1.32 : 1;
  const shoulderW = SHOULDER_W * bruteW;
  const ti = Math.min(tierIdx ?? 0, 6);
  const outfit = {
    main: isSkeleton ? '#39404d' : TIER_MAIN[ti],
    trim: TIER_TRIM[ti],
  };
  const swing = phase === 0 ? 0 : phase === 1 ? 2.4 : -2.4;

  // ── Ground shadow ─────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, oy + H - SHADOW_RY, SHADOW_RX, SHADOW_RY, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Legs ──────────────────────────────────────────────────────────────
  const hipY = torsoTop + 9;
  const legLen = H - (hipY - oy) - 3.5;
  const isWalkLR = poseDir === 'left' || poseDir === 'right';
  const pantsC = isSkeleton
    ? '#ded6bd'
    : variant === 'goblin'
      ? '#54652e'
      : ti <= 2
        ? '#57503f'
        : outfit.trim;

  rr(ctx, cx - LEG_OFFSET, hipY, LEG_W, legLen + (isWalkLR ? swing * 0.4 : swing), 1.5, pantsC);
  rr(ctx, cx + LEG_INSET, hipY, LEG_W, legLen - (isWalkLR ? swing * 0.4 : swing), 1.5, pantsC);

  // ── Torso ─────────────────────────────────────────────────────────────
  rr(ctx, cx - shoulderW / 2, torsoTop, shoulderW, TORSO_HEIGHT, 3, outfit.main);
  if (!isSkeleton && ti >= 3) {
    // armour trim line
    ctx.fillStyle = outfit.trim;
    ctx.fillRect(cx - shoulderW / 2 + 1, torsoTop + 4.5, shoulderW - 2, 1.6);
    // pauldrons
    rr(ctx, cx - shoulderW / 2 - 1.5, torsoTop - 0.5, 4.4, 4, 2, outfit.trim);
    rr(ctx, cx + shoulderW / 2 - 3, torsoTop - 0.5, 4.4, 4, 2, outfit.trim);
  }
  // female tunic (low tiers only)
  if (!isSkeleton && gender === 'f' && ti <= 2) {
    ctx.fillStyle = outfit.trim;
    ctx.beginPath();
    ctx.moveTo(cx - 6, torsoTop + 10);
    ctx.lineTo(cx + 6, torsoTop + 10);
    ctx.lineTo(cx + 7.5, hipY + 3 + Math.abs(swing));
    ctx.lineTo(cx - 7.5, hipY + 3 - Math.abs(swing));
    ctx.closePath();
    ctx.fill();
  }

  // ── Arms ──────────────────────────────────────────────────────────────
  const armSkin = isSkeleton ? '#ded6bd' : skin;
  rr(ctx, cx - shoulderW / 2 - 3, torsoTop + 1.5 + swing * 0.8, ARM_W, ARM_LENGTH, 1.5, armSkin);
  rr(ctx, cx + shoulderW / 2, torsoTop + 1.5 - swing * 0.8, ARM_W, ARM_LENGTH, 1.5, armSkin);
  // hand circles at arm ends
  if (!isSkeleton) {
    circ(ctx, cx - shoulderW / 2 - 1.5, torsoTop + 1.5 + swing * 0.8 + ARM_LENGTH, 1.8, armSkin);
    circ(ctx, cx + shoulderW / 2 + 1.5, torsoTop + 1.5 - swing * 0.8 + ARM_LENGTH, 1.8, armSkin);
  }

  // ── Head ──────────────────────────────────────────────────────────────
  const headColour = isSkeleton ? '#ded6bd' : skin;
  circ(ctx, cx, headY + HEAD_RADIUS - 1, HEAD_RADIUS, headColour);
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

    // eyes with whites + pupils (facing direction)
    if (poseDir !== 'up') {
      const drawEye = (ex, ey) => {
        // eye white
        ctx.fillStyle = '#f0ece4';
        ctx.fillRect(ex - 0.8, ey, 2.4, 2);
        // pupil
        ctx.fillStyle = OUTLINE;
        const pupilOff = poseDir === 'left' ? -0.4 : poseDir === 'right' ? 0.4 : 0;
        ctx.fillRect(ex - 0.2 + pupilOff, ey + 0.3, 1.4, 1.4);
        // specular highlight
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(ex + 0.1 + pupilOff, ey + 0.2, 0.6, 0.5);
        ctx.globalAlpha = 1;
      };
      if (poseDir === 'down') {
        drawEye(cx - 2.6, headY + 4.2);
        drawEye(cx + 1.0, headY + 4.2);
      } else if (poseDir === 'left') {
        drawEye(cx - 3.2, headY + 4.2);
      } else {
        drawEye(cx + 1.8, headY + 4.2);
      }
      // mouth (tiny line below eyes, facing down only)
      if (poseDir === 'down') {
        ctx.fillStyle = shade(skin, -25);
        ctx.globalAlpha = 0.4;
        ctx.fillRect(cx - 1, headY + 7.2, 2, 0.6);
        ctx.globalAlpha = 1;
      }
    }

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
    ctx.fillRect(cx - shoulderW / 2 + 1, torsoTop + TORSO_HEIGHT - 3, shoulderW - 2, 1.5);
    ctx.globalAlpha = 1;
    // belt buckle
    ctx.fillStyle = ti >= 3 ? '#c9a24b' : '#8a7a60';
    ctx.fillRect(cx - 1, torsoTop + TORSO_HEIGHT - 3.5, 2.5, 2.5);
  }
}

// ── Sheet builder ───────────────────────────────────────────────────────────

/**
 * Build a full 12-frame humanoid sheet texture (3 walk phases × 4 directions).
 *
 * @param {Phaser.Scene} scene  Scene that owns the texture manager.
 * @param {string}       key    Unique texture key.
 * @param {Object}       cfg    Appearance configuration.
 * @param {string}       [cfg.skin='#caa27c']       Skin tone hex.
 * @param {number}       [cfg.tierIdx=0]            Outfit tier (0-6).
 * @param {string}       [cfg.hairColor='#4a3222']  Hair colour hex.
 * @param {string}       [cfg.hairstyle='short']    'short'|'long'|'topknot'|'bald'|'braided'
 * @param {string}       [cfg.gender='m']           'm'|'f'
 * @param {string|null}  [cfg.variant=null]         'goblin'|'skeleton'|'brute'|'mask'|…
 * @returns {string[]} Array of generated frame names (e.g. "down_0", "up_2").
 */
export function makeHumanoidSheet(scene, key, cfg) {
  const names = [];
  const { canvas, ctx } = makeCanvas(CH_FRAME_W * 3, CH_FRAME_H * 4);

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

  registerFrames(scene, key, canvas, CH_FRAME_W, CH_FRAME_H, names);
  return names.slice();
}
