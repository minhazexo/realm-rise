/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Nature props 1/2 — trees & plants
//
// Draws: oak tree, pine tree, birch tree, dead tree, cactus, tree stump.
// The drawing style favours organic silhouettes over geometric primitives:
// canopies are assembled from layered "leaf mounds" (overlapping lobes whose
// centres drift into the sunlit / shaded quadrants), trunks get tapered
// polygons with wavy bark grain, and every tree casts a soft, light-direction
// consistent drop shadow so the whole forest reads as lit from the upper-left.
//
// Everything uses seededRandom() so output is fully deterministic per build.
// ─────────────────────────────────────────────────────────────────────────────
import {
  makeCanvas, registerImage, circ, rr, shade, seededRandom, resetRandom, O,
} from './artCore.ts';

// ── Re-use artCore.single but allow local fallback ──────────────────────────
import { single as artSingle } from './artCore.ts';
import type { DrawCallback } from './artCore.ts';
import type * as Phaser from 'phaser';

/**
 * Wrapper around artCore.single that resets the PRNG seed first, ensuring
 * deterministic output for nature props.
 */
function single(scene: Phaser.Scene, key: string, w: number, h: number, draw: DrawCallback): void {
  resetRandom(0x5A17_0EED); // nature seed
  artSingle(scene, key, w, h, draw);
}

// ── Detail helpers ──────────────────────────────────────────────────────────

/**
 * Soft two-pass elliptical drop shadow. The extra inner pass (offset slightly
 * further toward the light) reads as a blurred penumbra instead of a hard blob.
 */
function dropShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha: number,
): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.55})`;
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.35, cy - ry * 0.1, rx * 0.6, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Wavy vertical bark grain: dark fissures with a few pale highlight strokes on
 * the lit (left) side. Reads as real bark at sprite scale.
 */
function barkGrain(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: string,
  light: string,
): void {
  // dark fissures
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.7;
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = dark;
  for (let i = 0; i < 6; i++) {
    const fx = x + (i + 0.5) * (w / 5);
    const bend = (seededRandom() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(fx, y + 1);
    ctx.quadraticCurveTo(fx + bend, y + h * 0.5, fx + bend * 0.7, y + h - 1);
    ctx.stroke();
  }
  // pale highlights on the lit side
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = light;
  for (let i = 0; i < 3; i++) {
    const fx = x + 1 + i * (w / 5.5);
    ctx.beginPath();
    ctx.moveTo(fx, y + 3);
    ctx.quadraticCurveTo(fx - 0.5, y + h * 0.55, fx + 0.4, y + h - 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Small elliptical knot hole with a lit lower rim. */
function knot(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, bark: string): void {
  ctx.fillStyle = shade(bark, -26);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(bark, 14);
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(x, y + 0.8, rx * 0.72, ry * 0.36, 0, 0.1, Math.PI);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** A few soft moss tufts hugging the trunk or rock base. */
function mossPatch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  const n = 5;
  ctx.fillStyle = '#5a8a42';
  for (let i = 0; i < n; i++) {
    const a = seededRandom() * Math.PI * 2;
    const d = seededRandom() * r * 0.7;
    ctx.globalAlpha = alpha * (0.6 + seededRandom() * 0.4);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.8 + seededRandom() * r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Dense organic leaf mound. Builds a crown from dark under-lobes (back rim),
 * mid-tone body lobes, and a fan of bright lobes biased into the upper-left
 * sun quadrant, then finishes with per-leaf speckles — several poking just
 * past the silhouette so the crown edge stays irregular, not a circle.
 */
function leafMound(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  lobes: number,
): void {
  // ── back (shadowed) under-lobes ─────────────────────────────────────
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + seededRandom() * 0.8;
    const d = (0.3 + seededRandom() * 0.45) * r;
    const lr = Math.max(1, (0.55 + seededRandom() * 0.4) * r);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = shade(color, -24 - Math.floor(seededRandom() * 12));
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  // ── body lobes ─────────────────────────────────────────────────────
  for (let i = 0; i < lobes + 1; i++) {
    const a = (i / (lobes + 1)) * Math.PI * 2 + seededRandom() * 0.6;
    const d = (0.28 + seededRandom() * 0.4) * r;
    const lr = Math.max(1, (0.4 + seededRandom() * 0.45) * r);
    ctx.globalAlpha = 1;
    ctx.fillStyle = seededRandom() > 0.5 ? shade(color, -8) : shade(color, 2);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  // ── sunlit crown (upper-left bias) ────────────────────────────────
  for (let i = 0; i < Math.ceil(lobes * 0.75); i++) {
    const a = -Math.PI * 0.85 + seededRandom() * Math.PI * 1.1; // uppermost 200°
    const d = (0.2 + seededRandom() * 0.4) * r;
    const lr = Math.max(0.8, (0.28 + seededRandom() * 0.4) * r);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = shade(color, 8 + Math.floor(seededRandom() * 10));
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  // ── per-leaf speckles (texture breaks the flat fill) ──────────────
  const specks = Math.floor(r * 3.6);
  ctx.lineWidth = 0;
  for (let i = 0; i < specks; i++) {
    const a = seededRandom() * Math.PI * 2;
    const d = r * (0.15 + seededRandom() * 0.9);
    // a few leaves burst past the silhouette for an irregular crown edge
    const lr = 0.7 + seededRandom() * 1.0;
    let col: string;
    const roll = seededRandom();
    if (roll > 0.68) col = shade(color, 18 + Math.floor(seededRandom() * 12));
    else if (roll > 0.34) col = shade(color, -14 - Math.floor(seededRandom() * 10));
    else col = color;
    ctx.globalAlpha = 0.45 + seededRandom() * 0.4;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, lr, 0, Math.PI * 2);
    ctx.fill();
    // tiny highlight pip on a subset
    if (roll > 0.8) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = shade(color, 34);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d - lr * 0.3, cy + Math.sin(a) * d - lr * 0.3, lr * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Thin pale rim-light crescent across the sunlit crown edge. */
function rimLight(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.strokeStyle = shade(color, 42);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.92, Math.PI * 1.6);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Ground ring of grass blades hugging a trunk base. */
function grassRing(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 10; i++) {
    const gx = cx - w / 2 + (i / 9) * w + (seededRandom() - 0.5) * 2;
    const lean = (seededRandom() - 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(gx, groundY);
    ctx.quadraticCurveTo(gx + 1, groundY - 4, gx + lean, groundY - (5 + seededRandom() * 3));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── Asset builders ──────────────────────────────────────────────────────────

/**
 * Build all nature-prop tree textures (oak, birch, pine, dead tree, cactus, stump).
 * @returns {true}
 */
export function buildNatureProps(scene: Phaser.Scene): true {  // ── Oak Tree ───────────────────────────────────────────────────────────
  single(scene, 'tree_oak', 72, 86, (ctx, w, h) => {
    // ground shadow — dropped toward the lower-right as the light comes from
    // the upper-left, with a soft penumbra.
    dropShadow(ctx, w / 2 + 7, h - 3, 26, 8, 0.26);

    // ── tapered trunk ──────────────────────────────────────────────
    const TRUNK = '#6b4527';
    const baseX = w / 2 - 9, baseY = h - 8;
    const topX = w / 2 - 5, topY = h - 46;
    const grad = ctx.createLinearGradient(baseX, 0, baseX + 18, 0);
    grad.addColorStop(0, shade(TRUNK, 16));
    grad.addColorStop(0.55, TRUNK);
    grad.addColorStop(1, shade(TRUNK, -24));
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + 10, topY + 1);
    ctx.lineTo(baseX + 18, baseY);
    ctx.lineTo(baseX, baseY);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 1;
    ctx.stroke();
    // bark grain
    barkGrain(ctx, topX - 0.5, topY + 1, 11, baseY - topY - 3, shade(TRUNK, -26), shade(TRUNK, 22));
    // knots
    knot(ctx, w / 2 + 2, h - 26, 2.2, 3.2, TRUNK);
    knot(ctx, w / 2 - 3, h - 16, 1.6, 2.4, TRUNK);
    // root flares gripping the soil
    ctx.fillStyle = shade(TRUNK, -10);
    const flares: Array<[number, number]> = [
      [baseX - 1, baseX - 7], [baseX + 19, baseX + 26],
      [baseX + 3, baseX - 3], [baseX + 15, baseX + 21],
    ];
    for (const [x1, x2] of flares) {
      ctx.beginPath();
      ctx.moveTo(x1, baseY - 2);
      ctx.lineTo(x2, h - 1);
      ctx.lineTo(x2 + (x2 > w / 2 ? -4 : 4), h - 1);
      ctx.closePath();
      ctx.fill();
    }
    // moss at the base
    mossPatch(ctx, baseX + 12, h - 6, 5.5, 0.6);

    // ── canopy: layered organic mounds ─────────────────────────────
    const C = '#4a7c3a';
    // hidden trunk-to-canopy shadow so the junction never floats
    leafMound(ctx, w / 2 + 1, h - 44, 13, shade(C, -14), 5);
    leafMound(ctx, w / 2 - 13, h - 47, 8, shade(C, -10), 4);
    leafMound(ctx, w / 2 + 14, h - 45, 7, shade(C, -8), 4);
    // main crown
    leafMound(ctx, w / 2 - 1, h - 56, 17, C, 8);
    // tumbling peripheral clumps — these push the silhouette outward
    leafMound(ctx, w / 2 - 15, h - 36, 9, shade(C, 4), 5);
    leafMound(ctx, w / 2 + 16, h - 34, 8, shade(C, 2), 5);
    leafMound(ctx, w / 2 - 5, h - 66, 8, shade(C, 8), 5);
    leafMound(ctx, w / 2 + 11, h - 60, 7, shade(C, 6), 4);
    leafMound(ctx, w / 2 + 4, h - 38, 9, shade(C, 0), 5);
    // loose satellite leaves on the edges
    for (let i = 0; i < 9; i++) {
      const a = seededRandom() * Math.PI * 2;
      const d = 20 + seededRandom() * 6;
      const lx = w / 2 + Math.cos(a) * d;
      const ly = h - 54 + Math.sin(a) * d * 0.62;
      if (ly < 12 || ly > h - 30) continue;
      ctx.globalAlpha = 0.5 + seededRandom() * 0.3;
      ctx.fillStyle = seededRandom() > 0.5 ? shade(C, 14) : shade(C, -6);
      ctx.beginPath();
      ctx.arc(lx, ly, 1.4 + seededRandom() * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // rim light across the sunlit crown
    rimLight(ctx, w / 2 - 4, h - 57, 17, C);
    // AO crescent where the canopy meets the trunk
    ctx.fillStyle = shade(C, -30);
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.ellipse(w / 2 + 1, h - 36, 15, 5.4, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    // grounded grass ring at the trunk base
    grassRing(ctx, w / 2, h - 4, 22, '#71a052');
  });

  // ── Pine Tree ────────────────────────────────────────────────────
  // Drooping needle fans (concave sides) stacked top-to-bottom — the widest
  // band sits mid-trunk and the lower fronds spread outward like a real crown.
  single(scene, 'tree_pine', 56, 92, (ctx, w, h) => {
    dropShadow(ctx, w / 2 + 5, h - 3, 19, 6, 0.22);
    const TRUNK = '#54402a';

    // trunk (slender; mostly hidden by the fronds except at the base)
    const tg = ctx.createLinearGradient(w / 2 - 5, 0, w / 2 + 5, 0);
    tg.addColorStop(0, shade(TRUNK, 14));
    tg.addColorStop(0.55, TRUNK);
    tg.addColorStop(1, shade(TRUNK, -22));
    rr(ctx, w / 2 - 4, h - 24, 8, 22, 2, tg, O);
    barkGrain(ctx, w / 2 - 4, h - 24, 8, 21, shade(TRUNK, -24), shade(TRUNK, 18));

    // frond layers: top → bottom (later fronds overdraw earlier ones)
    const green = '#3d7347';
    const layers: Array<{ apexY: number; halfW: number; tipY: number }> = [
      { apexY: 10, halfW: 9, tipY: 30 },
      { apexY: 25, halfW: 15, tipY: 50 },
      { apexY: 41, halfW: 20, tipY: 68 },
      { apexY: 57, halfW: 17, tipY: 80 },
      { apexY: 74, halfW: 15, tipY: 90 },
    ];
    layers.forEach(({ apexY, halfW, tipY }, li) => {
      const col = shade(green, li <= 1 ? 2 : -2);
      // shaded band where the previous layer hangs over this one
      if (li > 0) {
        ctx.fillStyle = 'rgba(8,18,10,0.30)';
        ctx.beginPath();
        ctx.moveTo(w / 2 - halfW + 3, apexY);
        ctx.lineTo(w / 2 + halfW - 3, apexY);
        ctx.lineTo(w / 2 + 3, apexY + 6);
        ctx.closePath();
        ctx.fill();
      }
      // main drooping triangle body (sides bow outward from the droop)
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(w / 2, apexY);
      ctx.quadraticCurveTo(w / 2 - (halfW * 0.34), apexY + (tipY - apexY) * 0.38, w / 2 - halfW, tipY);
      ctx.lineTo(w / 2 + halfW, tipY);
      ctx.quadraticCurveTo(w / 2 + (halfW * 0.34), apexY + (tipY - apexY) * 0.38, w / 2, apexY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = shade(col, -20);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // needle fans along the side edges (read as needles, not a flat triangle)
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 3; k++) {
        const ty = apexY + (tipY - apexY) * (0.3 + k * 0.26);
        const side = k % 2 === 0 ? -1 : 1;
        const tipX = w / 2 + side * (halfW * (0.95 - k * 0.22));
        ctx.strokeStyle = shade(col, 16);
        ctx.beginPath();
        ctx.moveTo(w / 2 + side * 1.5, ty - 3);
        ctx.lineTo(tipX, ty + 5 + seededRandom() * 3);
        ctx.stroke();
        ctx.strokeStyle = shade(col, -12);
        ctx.beginPath();
        ctx.moveTo(w / 2 + side * 1.5, ty - 1);
        ctx.lineTo(tipX - side * 1.5, ty + 8 + seededRandom() * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // dark underside edge on the shadowed side
      ctx.strokeStyle = shade(col, -26);
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(w / 2 + halfW - 1, tipY - 3);
      ctx.lineTo(w / 2 - halfW + 2, tipY - 1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // apex needle spike poking above the crown
    ctx.fillStyle = shade(green, -18);
    ctx.beginPath();
    ctx.moveTo(w / 2, 2 - 4);
    ctx.lineTo(w / 2 + 2.2, 12);
    ctx.lineTo(w / 2 - 2.2, 12);
    ctx.closePath();
    ctx.fill();

    // root flare + needle litter on the ground
    ctx.fillStyle = shade(TRUNK, -12);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 4, h - 5);
    ctx.lineTo(w / 2 - 9, h - 1);
    ctx.lineTo(w / 2 - 1, h - 1);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 + 4, h - 5);
    ctx.lineTo(w / 2 + 9, h - 1);
    ctx.lineTo(w / 2 + 1, h - 1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(green, -18);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const gx = w / 2 - 11 + i * 4.4 + (seededRandom() - 0.5) * 2;
      const len = 2.5 + seededRandom() * 2;
      ctx.beginPath();
      ctx.moveTo(gx, h - 3);
      ctx.lineTo(gx + (seededRandom() - 0.5) * 3, h - 3 - len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  // ── Birch Tree ───────────────────────────────────────────────────
  // Pale, slender trunk with horizontal lenticels and an airy, open canopy so
  // the branch structure stays visible — a soft counterpart to the oak.
  single(scene, 'tree_birch', 64, 88, (ctx, w, h) => {
    dropShadow(ctx, w / 2 + 5, h - 3, 20, 6.5, 0.22);
    const BARK = '#e0dbc9';

    // branches reaching out under the canopy (drawn before trunk overlap)
    ctx.lineCap = 'round';
    ctx.strokeStyle = shade(BARK, -14);
    ctx.lineWidth = 2.4;
    for (const [x1, y1, x2, y2] of [
      [w / 2 + 1, h - 40, w / 2 - 17, h - 52],
      [w / 2 - 1, h - 42, w / 2 + 18, h - 55],
      [w / 2 + 1, h - 46, w / 2 - 13, h - 66],
      [w / 2 - 1, h - 46, w / 2 + 12, h - 70],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(x1 + (x2 - x1) * 0.5, y1 + 2, x2, y2);
      ctx.stroke();
      // tapering fork at each branch tip
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 + 3, y2 - 3);
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 3, y2 - 3);
      ctx.stroke();
      ctx.lineWidth = 2.4;
    }

    // slender trunk
    const tg = ctx.createLinearGradient(w / 2 - 4, 0, w / 2 + 4, 0);
    tg.addColorStop(0, shade(BARK, 14));
    tg.addColorStop(0.55, BARK);
    tg.addColorStop(1, shade(BARK, -30));
    rr(ctx, w / 2 - 4, h - 40, 8, 32, 1.4, tg, O);
    // lenticel dashes (black, blocky, slightly random)
    ctx.fillStyle = '#3a3630';
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 8; i++) {
      const ly = h - 38 + i * 4.2 + (seededRandom() - 0.5) * 3;
      const lw = 2.4 + seededRandom() * 2.6;
      ctx.fillRect(w / 2 - lw / 2 + (seededRandom() - 0.5) * 3, ly, lw, 1.1);
    }
    ctx.globalAlpha = 1;
    barkGrain(ctx, w / 2 - 4, h - 40, 8, 30, '#9d9684', '#f2efe2');
    // small dark notch where the trunk touches the ground
    mossPatch(ctx, w / 2, h - 4, 4.5, 0.5);

    // airy canopy — several light mounds with sky gaps between them
    const C = '#7fae5a';
    leafMound(ctx, w / 2 - 11, h - 52, 9, shade(C, -10), 4);
    leafMound(ctx, w / 2 + 13, h - 54, 8, shade(C, -8), 4);
    leafMound(ctx, w / 2, h - 64, 12, C, 6);
    leafMound(ctx, w / 2 - 4, h - 74, 6, shade(C, 10), 4);
    leafMound(ctx, w / 2 + 6, h - 70, 5, shade(C, 8), 3);
    // sparse loose tufts so the trunk/branches peek through
    for (let i = 0; i < 7; i++) {
      const a = seededRandom() * Math.PI * 2;
      const d = 12 + seededRandom() * 7;
      const lx = w / 2 + Math.cos(a) * d;
      const ly = h - 60 + Math.sin(a) * d * 0.6;
      if (ly < 14 || ly > h - 34) continue;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = seededRandom() > 0.5 ? shade(C, 16) : C;
      ctx.beginPath();
      ctx.arc(lx, ly, 1.3 + seededRandom(), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    rimLight(ctx, w / 2 - 2, h - 65, 12, C);
    // AO under the canopy
    ctx.fillStyle = shade(C, -28);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(w / 2 + 1, h - 42, 12, 4.6, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // ── Dead Tree ────────────────────────────────────────────────────
  // Weathered snag: gnarled trunk, broken branch stubs, knotholes, a pale
  // lightning scar and a couple of hanging moss strands.
  single(scene, 'dead_tree', 54, 76, (ctx, w, h) => {
    dropShadow(ctx, w / 2 + 4, h - 3, 15, 5.5, 0.2);
    const TRUNK = '#4c4438';

    // gnarled trunk with an irregular wobble
    const wob = (y: number, amp: number): number => Math.sin(y * 0.21 + 2.2) * amp;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = TRUNK;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 2 + wob(h - 8, 1.5), h - 8);
    ctx.quadraticCurveTo(w / 2 - 3 + wob(h - 26, 2), h - 30, w / 2 + 1 + wob(h - 48, 2.5), h - 52);
    ctx.stroke();
    // lit left edge + shaded right edge
    ctx.strokeStyle = shade(TRUNK, 12);
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5 + wob(h - 8, 1.5), h - 9);
    ctx.lineTo(w / 2 - 5 + wob(h - 46, 2.4), h - 46);
    ctx.stroke();
    ctx.strokeStyle = shade(TRUNK, -18);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(w / 2 + 3 + wob(h - 8, 1.5), h - 9);
    ctx.lineTo(w / 2 + 4 + wob(h - 46, 2.4), h - 46);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // bark grain + cracks
    barkGrain(ctx, w / 2 - 4, h - 50, 9, 42, shade(TRUNK, -20), shade(TRUNK, 14));
    ctx.strokeStyle = shade(TRUNK, -22);
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.45;
    for (const [x1, y1, x2, y2] of [
      [w / 2, h - 16, w / 2 - 1, h - 34],
      [w / 2 + 2, h - 22, w / 2 + 1, h - 44],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + x1, h + y1);
      ctx.lineTo(w / 2 + x2, h + y2);
      ctx.stroke();
    }
    // pale lightning scar on the shadowed (right) side
    ctx.strokeStyle = 'rgba(226,216,196,0.5)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(w / 2 + 3, h - 50);
    ctx.quadraticCurveTo(w / 2 + 6, h - 36, w / 2 + 3, h - 20);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // knotholes
    knot(ctx, w / 2 - 1, h - 30, 2.1, 3, TRUNK);
    knot(ctx, w / 2 + 2, h - 44, 1.4, 2, TRUNK);

    // broken branch stubs with tapered joints and fractured tips
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = shade(TRUNK, -6);
    for (const [x1, y1, x2, y2] of [
      [-1, -38, -17, -52],
      [0, -42, 15, -58],
      [-1, -44, 5, -70],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + x1, h + y1);
      ctx.quadraticCurveTo(w / 2 + x2 * 0.5, h + y1 - 6, w / 2 + x2, h + y2);
      ctx.stroke();
      // fracture: dark nub + pale broken wood
      ctx.fillStyle = '#6f6757';
      ctx.beginPath();
      ctx.arc(w / 2 + x2, h + y2, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(TRUNK, -18);
      ctx.beginPath();
      ctx.arc(w / 2 + x2, h + y2 + 0.6, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    // hanging moss strands
    ctx.strokeStyle = '#77845a';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (const [x0, y0, len] of [
      [w / 2 - 16, h - 50, 8],
      [w / 2 + 13, h - 56, 6],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + x0, h + y0);
      ctx.quadraticCurveTo(w / 2 + x0 - 1, h + y0 + len * 0.6, w / 2 + x0, h + y0 + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  // ── Cactus ───────────────────────────────────────────────────────
  single(scene, 'cactus', 40, 62, (ctx, w, h) => {
    dropShadow(ctx, w / 2, h - 3, 12, 4.5, 0.2);
    const GREEN = '#5f8a4e';

    const body = (x: number, y: number, bw: number, bh: number, r: number): void => {
      const g = ctx.createLinearGradient(x, 0, x + bw, 0);
      g.addColorStop(0, shade(GREEN, 22));
      g.addColorStop(0.45, GREEN);
      g.addColorStop(1, shade(GREEN, -20));
      rr(ctx, x, y, bw, bh, r, g, O);
      // rib lines with subtle light/dark edge on each
      ctx.lineWidth = 0.6;
      for (const [ri, dxv] of [[0, 2], [1, 0], [2, -2]] as const) {
        ctx.strokeStyle = shade(GREEN, -12 - ri * 2);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(x + bw / 2 + dxv - 0.8, y + 2);
        ctx.lineTo(x + bw / 2 + dxv - 0.8, y + bh - 2);
        ctx.stroke();
        ctx.strokeStyle = shade(GREEN, 14 - ri);
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.moveTo(x + bw / 2 + dxv + 0.6, y + 2);
        ctx.lineTo(x + bw / 2 + dxv + 0.6, y + bh - 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // spines along both edges
      ctx.fillStyle = '#d8d3ae';
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < Math.floor(bh / 5); i++) {
        const sy = y + 4 + i * 5;
        ctx.fillRect(x - 1, sy, 1.1, 1.1);
        ctx.fillRect(x + bw - 0.5, sy, 1.1, 1.1);
      }
      ctx.globalAlpha = 1;
    };

    // main trunk
    body(w / 2 - 6, h - 50, 12, 47, 5);
    // arms: two on the left, one on the right — with rounded joints
    body(w / 2 - 18, h - 36, 9, 8, 3);   // left elbow
    body(w / 2 - 17, h - 46, 7, 11, 3);  // left arm up
    body(w / 2 + 9, h - 32, 9, 7, 3);    // right elbow
    body(w / 2 + 10, h - 44, 7, 12, 3);  // right arm up
    // small bloom at the top
    ctx.fillStyle = '#e08ab0';
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(a) * 2.2, h - 51 + Math.sin(a) * 1.6, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f6e9c8';
    ctx.beginPath(); ctx.arc(w / 2, h - 51, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Tree stump (for depleted trees)
  drawTreeStump(scene);

  return true;
}

/**
 * Draw a small tree stump texture for depleted resource nodes.
 */
export function drawTreeStump(scene: Phaser.Scene): void {
  const { canvas, ctx } = makeCanvas(24, 20);
  const bark = '#6b5b42';
  const cx = 12;

  dropShadow(ctx, cx, 17, 10.5, 3.6, 0.2);
  // jagged outer bark wall
  ctx.fillStyle = shade(bark, -10);
  ctx.beginPath();
  ctx.moveTo(4, 6);
  for (let i = 0; i < 7; i++) {
    ctx.lineTo(4 + (i % 3), 6 + i * 1.7);
  }
  ctx.lineTo(7, 16);
  ctx.lineTo(20, 16);
  ctx.lineTo(21, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = O;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // wood top — pale heartwood with growth rings
  ctx.fillStyle = '#a98a62';
  ctx.beginPath();
  ctx.ellipse(cx, 5.5, 8.6, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(bark, -12);
  ctx.lineWidth = 0.7;
  ctx.globalAlpha = 0.55;
  for (let r = 2.2; r <= 7.6; r += 1.8) {
    ctx.beginPath();
    ctx.ellipse(cx, 5.5, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // radial cracks from the centre
  ctx.strokeStyle = shade('#a98a62', -26);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    const a = seededRandom() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, 5.5);
    ctx.lineTo(cx + Math.cos(a) * (6 + seededRandom() * 2), 5.5 + Math.sin(a) * (2.4 + seededRandom() * 1.2));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // pale highlight on the lit top-left of the cut
  ctx.fillStyle = shade('#a98a62', 26);
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(cx - 2, 4.6, 3.4, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // moss skirt on the shaded side
  mossPatch(ctx, 18, 15.5, 4, 0.5);
  registerImage(scene, 'tree_stump', canvas);
}