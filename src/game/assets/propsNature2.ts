/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Nature props 2/2 — rocks / ore nodes, flora pickups, ruins, water accents.
//
// Draws: iron/gold/silver/coal rocks, crystal & moonstone nodes,
//        berry bushes (full + empty), herbs, mushrooms, reeds, lilypads,
//        ruined pillars/arches, ancient statue.
//
// Rock shading (v1 upgrade): every rock now gets a jittered polygonal
// silhouette (never a smooth blob), a linear light→shadow gradient that
// matches the forest's upper-left sun, a lifted crown facet, diagonal crease
// strokes for faceting, faint strata bands, grain speckles, a rim light on
// the shadow edge, a soft penumbra drop shadow and a contact-AO strip.
// ─────────────────────────────────────────────────────────────────────────────
import { makeCanvas, registerImage, circ, ell, rr, shade, single, O, seededRandom } from './artCore.ts';
import type * as Phaser from 'phaser';

// ── Internal helpers ────────────────────────────────────────────────────────

/** Options for {@link rockBase}. */
interface RockBaseOpts {
  /** 0..1 moss coverage at the base. */
  moss?: number;
  /** Extra strata emphasis (mountain stone). */
  strata?: boolean;
}

/** Soft two-pass shadow shared by rocks. */
function rockShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx + 1, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy - 0.5, rx * 0.62, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Build a jittered granite silhouette. Ten vertices orbit the rock core; the
 * crown is tall, the bottom is flattened so the rock "sits" on the soil.
 * Returns the point list so callers can overlay facets on the same geometry.
 */
function granitePath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  main: string | CanvasGradient,
): Array<[number, number]> {
  const cx = w / 2;
  const cy = h - 16;
  const pts: Array<[number, number]> = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2 - Math.PI / 2; // start at the crown
    const vertical = Math.max(0, Math.sin(t));     // 0 crown, 1 bottom
    // crown is tall and irregular; bottom flattens toward the ground line
    const jitter = 0.8 + seededRandom() * 0.45;
    let rad = 11 * jitter;
    if (vertical > 0.35) rad *= 1 - (vertical - 0.35) * 0.42; // flatten base
    if (Math.cos(t) > 0.6) rad *= 0.95;                        // right side reads nearer
    const x = cx + Math.cos(t) * rad;
    const y = cy + Math.sin(t) * rad * 1.05;
    pts.push([x, Math.min(h - 2, Math.max(3, y))]);
  }
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
  ctx.closePath();
  ctx.fillStyle = main;
  ctx.fill();
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  return pts;
}

/**
 * Draw the polygonal base shape shared by all rock / ore sprites.
 * Light is fixed upper-left; every overlay honours it.
 * @param w    Canvas width.
 * @param h    Canvas height.
 * @param main Main rock colour.
 * @param opts
 */
function rockBase(ctx: CanvasRenderingContext2D, w: number, h: number, main: string, opts: RockBaseOpts = {}): void {
  const moss = opts.moss == null ? 0.25 : opts.moss;
  const strata = opts.strata ?? false;

  // penumbra drop shadow
  rockShadow(ctx, w / 2 + 2, h - 3, 18, 5.5);
  // body gradient — lit crown / shaded base to match the world light
  const grad = ctx.createLinearGradient(w * 0.15, h * 0.08, w * 0.85, h * 0.92);
  grad.addColorStop(0, shade(main, 22));
  grad.addColorStop(0.42, main);
  grad.addColorStop(1, shade(main, -26));
  const pts = granitePath(ctx, w, h, grad);

  // ── lifted crown facet: a lighter parallelogram across the top-left ──
  const crown = pts.filter(([, y]) => y < h - 18);
  if (crown.length >= 3) {
    ctx.fillStyle = shade(main, 20);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(crown[0]![0] + 1, crown[0]![1]);
    for (let i = 1; i < crown.length; i++) ctx.lineTo(crown[i]![0], crown[i]![1]);
    // close the facet along a lower line (offset toward the light)
    ctx.lineTo(crown[crown.length - 1]![0] + 2, crown[crown.length - 1]![1] + 5);
    ctx.lineTo(crown[0]![0] + 1, crown[0]![1] + 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── diagonal facet creases: dark + light pair per seam ──────────────
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = shade(main, -22);
  ctx.beginPath();
  ctx.moveTo(w / 2, h - 24);
  ctx.lineTo(5, h - 9);
  ctx.moveTo(w / 2 + 3, h - 20);
  ctx.lineTo(w - 5, h - 7);
  ctx.stroke();
  ctx.strokeStyle = shade(main, 16);
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(w / 2 + 0.7, h - 24);
  ctx.lineTo(5.7, h - 9);
  ctx.moveTo(w / 2 + 3.7, h - 20);
  ctx.lineTo(w - 4.3, h - 7);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── strata bands — faint angled bedding planes (stronger on mountains) ──
  const strataAlpha = strata ? 0.16 : 0.1;
  ctx.strokeStyle = shade(main, -16);
  ctx.lineWidth = 0.7;
  for (let s = 0; s < 3; s++) {
    ctx.globalAlpha = strataAlpha;
    const yy = h - 14 + s * 3;
    ctx.beginPath();
    ctx.moveTo(3, yy);
    ctx.lineTo(w - 3, yy + 2.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── grain speckles — micro-pitting for real stone ───────────────────
  ctx.lineWidth = 0;
  for (let i = 0; i < 16; i++) {
    const gx = 3 + seededRandom() * (w - 6);
    const gy = h - 24 + seededRandom() * 18;
    const pit = seededRandom();
    ctx.fillStyle = pit > 0.72 ? shade(main, 16) : shade(main, -18);
    ctx.globalAlpha = pit > 0.72 ? 0.5 : 0.34;
    ctx.fillRect(gx, gy, 0.9, 0.9);
  }
  ctx.globalAlpha = 1;

  // ── rim light on the shadowed (right) edge — restores the silhouette ──
  ctx.strokeStyle = shade(main, 14);
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(w - 7, h - 20);
  ctx.quadraticCurveTo(w - 5, h - 13, w - 7, h - 7);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // highlight stroke along the lit edge
  ctx.strokeStyle = shade(main, 20);
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(6, h - 20);
  ctx.lineTo(11, h - 26);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── contact AO strip where stone meets soil ─────────────────────────
  ctx.fillStyle = 'rgba(12,14,8,0.34)';
  ctx.fillRect(4, h - 8, w - 8, 2.6);

  // ── moss / lichen seat ──────────────────────────────────────────────
  if (moss > 0) {
    ctx.fillStyle = '#5a8a42';
    const dots = Math.round(4 + moss * 9);
    for (let i = 0; i < dots; i++) {
      ctx.globalAlpha = 0.22 + seededRandom() * 0.32;
      const mx = 6 + seededRandom() * (w - 12);
      const my = h - 11 + seededRandom() * 5;
      ctx.beginPath();
      ctx.arc(mx, my, 0.9 + seededRandom() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // moss creeping up the lit face
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 6; i++) {
      const mx = 8 + seededRandom() * (w - 16);
      const my = h - 22 + seededRandom() * 8;
      ctx.beginPath();
      ctx.arc(mx, my, 1 + seededRandom() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw ore sparkles on a rock face — diamond flares with a soft halo.
 * @param w      Canvas width.
 * @param h      Canvas height.
 * @param colours  One or two sparkle colours.
 */
function sparkles(ctx: CanvasRenderingContext2D, w: number, h: number, colours: string[]): void {
  colours.forEach((c, i) => {
    const pts: Array<[number, number]> = [
      [w / 2 - 5 + i * 4, h - 25 + i * 3],
      [w / 2 + 5 - i * 2, h - 15],
      [w / 2 - 2 + i * 2, h - 20],
    ];
    pts.forEach(([x, y]) => {
      const sz = 1.8 + seededRandom() * 1.4;
      // soft halo
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(x, y, sz * 1.9, 0, Math.PI * 2);
      ctx.fill();
      // 4-point star
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(x, y - sz);
      ctx.lineTo(x + sz * 0.7, y);
      ctx.lineTo(x, y + sz);
      ctx.lineTo(x - sz * 0.7, y);
      ctx.closePath();
      ctx.fill();
      // inner bright core
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x - 0.4, y - 0.4, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  });
}

/**
 * Draw ore veins: soft glowing seam (halo pass) then a jagged mineral core.
 * Reads as embedded mineral, not surface glitter.
 */
function veins(ctx: CanvasRenderingContext2D, w: number, h: number, colour: string): void {
  for (let i = 0; i < 2; i++) {
    let vx = w / 2 - 7 + i * 9 + (seededRandom() - 0.5) * 4;
    let vy = h - 26 + (seededRandom() - 0.5) * 5;
    const drawSeam = (wdt: number, alpha: number): void => {
      ctx.lineWidth = wdt;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      let cx2 = vx, cy2 = vy;
      for (let k = 0; k < 4; k++) {
        cx2 += (seededRandom() - 0.42) * 7;
        cy2 += 3 + seededRandom() * 4;
        ctx.lineTo(cx2, cy2);
      }
      ctx.stroke();
    };
    // halo pass makes gold/silver read as catching the light
    ctx.strokeStyle = colour;
    drawSeam(2.8, 0.18);
    ctx.strokeStyle = shade(colour, -10);
    drawSeam(1.1, 0.8);
    // tiny node chunks along the seam
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(vx, vy + 6, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
  }
  ctx.globalAlpha = 1;
}

// ── Rock / ore nodes ────────────────────────────────────────────────────────

/**
 * Build all rock and ore-node textures.
 */
export function buildRockProps(scene: Phaser.Scene): void {
  single(scene, 'rock_small', 34, 36, (ctx, w, h) => rockBase(ctx, w, h, '#8a8f97'));
  single(scene, 'rock_iron', 36, 38, (ctx, w, h) => {
    rockBase(ctx, w, h, '#7e7568');
    veins(ctx, w, h, '#b0654f');
    sparkles(ctx, w, h, ['#b0654f', '#d08a6b']);
  });
  single(scene, 'rock_gold', 34, 36, (ctx, w, h) => {
    rockBase(ctx, w, h, '#7e7258');
    veins(ctx, w, h, '#e8c94b');
    sparkles(ctx, w, h, ['#ffd66b', '#e8c94b']);
  });
  single(scene, 'rock_silver', 34, 36, (ctx, w, h) => {
    rockBase(ctx, w, h, '#797f88');
    veins(ctx, w, h, '#e8ecf2');
    sparkles(ctx, w, h, ['#dfe4ea', '#c9ced6']);
  });
  single(scene, 'rock_coal', 34, 36, (ctx, w, h) => {
    rockBase(ctx, w, h, '#4a4c54', { moss: 0 });
    veins(ctx, w, h, '#24252c');
    sparkles(ctx, w, h, ['#202126', '#3a3c44']);
  });
  // Mossy boulder (new): forest/swamp flavor of plain stone, moss-heavy.
  single(scene, 'rock_mossy', 36, 38, (ctx, w, h) => {
    rockBase(ctx, w, h, '#7d8478', { moss: 1 });
    // extra moss creep climbing the lit face
    ctx.fillStyle = '#5a8a42';
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = 0.2 + seededRandom() * 0.26;
      const mx = 8 + seededRandom() * (w - 16);
      const my = h - 26 + seededRandom() * 12;
      ctx.beginPath();
      ctx.arc(mx, my, 1 + seededRandom() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  single(scene, 'crystal_node', 34, 44, (ctx, w, h) => {
    rockShadow(ctx, w / 2, h - 3, 14, 5);
    // crystal shards: [colour, offsetX, offsetY, height]
    const shards: Array<[string, number, number, number]> = [
      ['#7be0c3', 0, -16, 20],
      ['#57c4ab', -9, -10, 14],
      ['#9bead6', 9, -11, 15],
    ];
    shards.forEach(([c, dx, dy, ch]) => {
      const bx = w / 2 + dx;
      const by = h - 8 + dy;
      // soft glow behind each shard
      const glow = ctx.createRadialGradient(bx, by - ch / 2, 1, bx, by - ch / 2, 10);
      glow.addColorStop(0, c);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(bx, by - ch / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // shard body with pale-to-saturated gradient
      const g = ctx.createLinearGradient(0, by - ch, 0, by + 12);
      g.addColorStop(0, shade(c, 26));
      g.addColorStop(0.5, c);
      g.addColorStop(1, shade(c, -16));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx, by + 14);
      ctx.lineTo(bx - 5, by);
      ctx.lineTo(bx, by - ch);
      ctx.lineTo(bx + 5, by);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = O;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // inner refraction facet
      ctx.strokeStyle = shade(c, 22);
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(bx + 1, by + 12);
      ctx.lineTo(bx, by - ch + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // bright sparkle at the tallest tip
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.arc(w / 2, h - 8 - 16 - 16, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(w / 2, h - 40, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });

  single(scene, 'moonstone_node', 32, 40, (ctx, w, h) => {
    rockShadow(ctx, w / 2, h - 3, 13, 4.5);
    // layered planetary glow
    const glow = ctx.createRadialGradient(w / 2, h - 18, 2, w / 2, h - 18, 17);
    glow.addColorStop(0, '#cfd9ff');
    glow.addColorStop(0.4, 'rgba(185,199,255,0.5)');
    glow.addColorStop(1, 'rgba(120,140,255,0)');
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(w / 2, h - 18, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // stone orb with a lit crescent
    const orb = ctx.createRadialGradient(w / 2 - 3, h - 20, 1, w / 2, h - 18, 11);
    orb.addColorStop(0, '#eef4ff');
    orb.addColorStop(0.55, '#b9c7ff');
    orb.addColorStop(1, '#8da0e8');
    circ(ctx, w / 2, h - 18, 11, orb, '#6f7fce', 1.2);
    circ(ctx, w / 2 - 2, h - 20, 5, '#dce6ff', null);
    circ(ctx, w / 2 - 3, h - 22, 2, '#ffffff', null);
    // faint glow rays
    ctx.strokeStyle = 'rgba(185,199,255,0.35)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * 11, h - 18 + Math.sin(a) * 11);
      ctx.lineTo(w / 2 + Math.cos(a) * 14, h - 18 + Math.sin(a) * 14);
      ctx.stroke();
    }
  });
}

// ── Flora pickups ───────────────────────────────────────────────────────────

/**
 * Build flora / foraging pickup textures.
 */
export function buildFloraProps(scene: Phaser.Scene): void {
  // Berry bush (full)
  single(scene, 'berry_bush', 42, 36, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 15, 4.5, 'rgba(0,0,0,0.14)');
    circ(ctx, w / 2 - 8, h - 14, 11, '#4a7c3a', O, 1.4);
    circ(ctx, w / 2 + 8, h - 15, 10, '#55895b', O, 1.4);
    // berry dots: [offsetX, offsetY]
    ([
      [-10, -10], [-2, -6], [4, -12],
      [11, -9], [-6, -18], [8, -19],
    ] as const).forEach(([dx, dy]) => {
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
    ([[-6, -12], [0, -17], [6, -13]] as const).forEach(([dx, dy]) => {
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
    ([[8, 16, 5.5], [21, 19, 4.5]] as const).forEach(([x, y, r]) => {
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
    ([[-6, 0], [-2, -1], [3, 1], [7, -1]] as const).forEach(([dx, bend]) => {
      ctx.beginPath();
      ctx.moveTo(w / 2, h - 3);
      ctx.quadraticCurveTo(w / 2 + dx + bend * 3, h - 16, w / 2 + dx, h - 26);
      ctx.stroke();
    });
  });

  // Lily pad
  single(scene, 'lilypad', 26, 18, (ctx, w, h) =>
    ell(ctx, w / 2, h / 2, 10, 6, '#4d7a44', O),
  );
}

// ── Ruins ───────────────────────────────────────────────────────────────────

/**
 * Build ruined / ancient structure textures.
 */
export function buildRuinsProps(scene: Phaser.Scene): void {
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