/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// Ashen Frontier props — environmental-storytelling decals & wreckage.
//
// These are the props that make the ruined region read as a PLACE that was
// attacked rather than a decorative backdrop: dried blood, a line of
// footprints leading away, scorch marks, a splintered cart, toppled signs and
// the frame of a holding cage. All procedural canvas art in the same visual
// language as the rest of the world (upper-left sun, muted dark-fantasy
// palette, soft contact shadow).
// ─────────────────────────────────────────────────────────────────────────────
import { ell, circ, rr, shade, single } from './artCore.ts';
import type * as Phaser from 'phaser';

/**
 * Local mulberry32 stream. The shared artCore PRNG is a single global
 * sequence; a local one keeps every prop's spatter deterministic without
 * disturbing the builders that run after this file.
 */
function localRng(seed: number): () => number {
  let s: number = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t: number = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dried blood pool with spatter — the road's first story beat. */
function drawBlood(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 11): void {
  const rnd = localRng(seed);
  const cx = w / 2, cy = h / 2;
  // main pool, irregular
  ctx.fillStyle = 'rgba(74,14,18,0.82)';
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 7 + rnd() * 4;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.6;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // darker centre
  ell(ctx, cx, cy, 4.5, 2.6, 'rgba(46,6,10,0.9)', null);
  // spatter
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, d = 9 + rnd() * 13;
    circ(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 0.9 + rnd() * 1.5, 'rgba(74,14,18,0.62)', null);
  }
}

/** A dragging line of footprints — someone was carried or crawled away. */
function drawFootsteps(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 7): void {
  const rnd = localRng(seed);
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const x = 6 + t * (w - 12) + (rnd() - 0.5) * 3;
    const y = h * 0.5 + Math.sin(i * 0.9) * 4 + (rnd() - 0.5) * 2;
    ctx.fillStyle = 'rgba(38,28,20,0.5)';
    rr(ctx, x, y, 3.4, 5.4, 1.6, 'rgba(38,28,20,0.5)');
    // scuffed trail between prints
    if (i % 2 === 0) ctx.fillRect(x + 1, y + 5, 10, 1.1);
  }
}

/** Scorched ground — fire, magic, or The Veil itself. */
function drawScorch(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 5): void {
  const rnd = localRng(seed);
  const cx = w / 2, cy = h / 2;
  ctx.fillStyle = 'rgba(18,16,16,0.72)';
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 10 + rnd() * 6;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.62;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // charred spokes reaching outward
  ctx.strokeStyle = 'rgba(10,9,9,0.6)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * (11 + rnd() * 10), cy + Math.sin(a) * (7 + rnd() * 6));
    ctx.stroke();
  }
  // a few live embers still glowing
  for (let i = 0; i < 3; i++) {
    circ(ctx, cx + (rnd() - 0.5) * 14, cy + (rnd() - 0.5) * 8, 0.9, 'rgba(255,138,74,0.55)', null);
  }
}

/** A drift of grey ash — the region's namesake. */
function drawAshPile(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 9): void {
  const rnd = localRng(seed);
  ell(ctx, w / 2, h / 2 + 2, w * 0.42, h * 0.24, 'rgba(150,146,140,0.30)', null);
  ell(ctx, w / 2 - 3, h / 2, w * 0.3, h * 0.16, 'rgba(186,182,176,0.26)', null);
  for (let i = 0; i < 10; i++) {
    circ(ctx, rnd() * w, h / 2 + (rnd() - 0.5) * h * 0.4, 0.8 + rnd(), 'rgba(210,206,200,0.22)', null);
  }
}

/** A splintered supply cart, wheel sheared off. */
function drawCartWreck(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 3): void {
  const rnd = localRng(seed);
  const dark = '#3d3128', wood = '#5c4832', light = '#6f593d';
  ell(ctx, w / 2, h - 7, w * 0.4, 4.5, 'rgba(0,0,0,0.3)', null);
  // cart bed, tilted
  ctx.save();
  ctx.translate(w / 2, h * 0.62);
  ctx.rotate(-0.16);
  rr(ctx, -w * 0.36, -h * 0.2, w * 0.72, h * 0.34, 3, wood);
  rr(ctx, -w * 0.36, -h * 0.2, w * 0.72, h * 0.1, 3, light);
  // broken planks jutting out
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(-0.5 + i * 0.42);
    ctx.fillStyle = dark;
    ctx.fillRect(w * 0.3, -3, 11 + rnd() * 9, 3);
    ctx.restore();
  }
  ctx.restore();
  // one intact wheel, one broken half-wheel
  circ(ctx, w * 0.22, h * 0.78, 7.5, dark, '#2a231d');
  circ(ctx, w * 0.22, h * 0.78, 3.2, shade(wood, -30), null);
  ctx.strokeStyle = '#2a231d';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(w * 0.76, h * 0.8, 7, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

/** A toppled waystone/signboard, lettering weathered away. */
function drawSignBroken(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const post = '#4a3a29', board = '#6b563c', ink = 'rgba(30,24,18,0.75)';
  // leaning post
  ctx.save();
  ctx.translate(w / 2, h * 0.55);
  ctx.rotate(0.22);
  ctx.fillStyle = post;
  ctx.fillRect(-2, -h * 0.32, 4, h * 0.62);
  rr(ctx, -w * 0.36, -h * 0.34, w * 0.72, h * 0.24, 2, board);
  rr(ctx, -w * 0.36, -h * 0.34, w * 0.72, h * 0.08, 2, shade(board, 14));
  // illegible carved lines
  ctx.fillStyle = ink;
  for (let i = 0; i < 3; i++) ctx.fillRect(-w * 0.28, -h * 0.3 + i * 5, w * (0.34 - i * 0.06), 1.4);
  // splintered top edge
  ctx.fillStyle = post;
  ctx.fillRect(w * 0.22, -h * 0.42, 3, 6);
  ctx.restore();
}

/** Frame of a holding cage — iron bars, the door torn open. */
function drawCageFrame(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const iron = '#3a3a42', ironL = '#565663';
  ell(ctx, w / 2, h - 5, w * 0.36, 4, 'rgba(0,0,0,0.28)', null);
  // floor + back bars
  rr(ctx, 6, h - 13, w - 12, 7, 2, '#2c2620');
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * ((w - 16) / 5);
    ctx.fillStyle = i % 2 ? iron : ironL;
    ctx.fillRect(x, 10, 2.2, h - 22);
  }
  // top / bottom rails
  rr(ctx, 6, 8, w - 12, 3, 1, iron);
  rr(ctx, 6, h - 16, w - 12, 3, 1, iron);
  // torn-open door leaning against the frame
  ctx.save();
  ctx.translate(w - 12, h - 20);
  ctx.rotate(-0.6);
  rr(ctx, 0, 0, 3, h * 0.44, 1, ironL);
  rr(ctx, 8, 0, 3, h * 0.44, 1, iron);
  rr(ctx, 0, 0, 11, 2.6, 1, iron);
  ctx.restore();
}

/**
 * Deep-wood canopy: a soft mass of shadowed foliage. Scaled up and overlapped
 * into rings, these are what give the Whispering Forest a BACKGROUND band —
 * the wall of wood the path threads through.
 */
function drawCanopyMass(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 3): void {
  const rnd = localRng(seed);
  // Body: overlapping clumps, darker at the base (light comes from above).
  for (let i = 0; i < 22; i++) {
    const x = 10 + rnd() * (w - 20), y = 12 + rnd() * (h - 16);
    const r = 12 + rnd() * 20;
    const light = rnd() < 0.4;
    circ(ctx, x, y, r, light ? '#3d4d36' : shade('#2b3626', -6 + rnd() * 12), null);
  }
  // Crown highlight: the upper edge catching light.
  for (let i = 0; i < 10; i++) {
    const x = 12 + rnd() * (w - 24);
    circ(ctx, x, 10 + rnd() * 16, 8 + rnd() * 12, 'rgba(96,120,80,0.5)', null);
  }
  // A few trunk shadows showing through the mass.
  ctx.fillStyle = 'rgba(20,26,18,0.5)';
  for (let i = 0; i < 4; i++) ctx.fillRect(16 + rnd() * (w - 32), h * 0.55, 2.5, h * 0.34);
}

/** Low understory shrub — the dim floor of the deep wood. */
function drawUnderBush(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 9): void {
  const rnd = localRng(seed);
  ell(ctx, w / 2, h - 4, w * 0.36, 3.4, 'rgba(0,0,0,0.3)', null);
  for (let i = 0; i < 9; i++) {
    const x = w * 0.22 + rnd() * w * 0.56;
    const y = h * 0.5 + rnd() * h * 0.32;
    circ(ctx, x, y, 5 + rnd() * 7, rnd() < 0.35 ? '#465438' : '#33412c', null);
  }
  for (let i = 0; i < 5; i++) {
    circ(ctx, w * 0.26 + rnd() * w * 0.48, h * 0.34 + rnd() * h * 0.2, 3 + rnd() * 4, 'rgba(110,134,88,0.55)', null);
  }
}

/**
 * Near-camera fern — the FOREGROUND band. Long arcing fronds read as much
 * closer to the eye than anything else in the wood, so walking behind one
 * sells the depth of the path.
 */
function drawFrondNear(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 17): void {
  const rnd = localRng(seed);
  const bx = w * 0.5, by = h - 5;
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const spread = (i / (fronds - 1) - 0.5) * 2;              // -1 … 1
    const len = h * (0.7 + rnd() * 0.28);
    const tipX = bx + spread * w * 0.5;
    const tipY = by - len * (0.92 - Math.abs(spread) * 0.34);
    const ctrlX = bx + spread * w * 0.2, ctrlY = by - len * 0.56;
    // Frond as a filled, tapered blade: far more foliage mass than a stroke.
    ctx.beginPath();
    ctx.moveTo(bx + spread * 2, by);
    ctx.quadraticCurveTo(ctrlX, ctrlY + 6, tipX, tipY);
    ctx.quadraticCurveTo(ctrlX, ctrlY - 6, bx + spread * 2, by);
    ctx.closePath();
    ctx.fillStyle = rnd() < 0.42 ? '#33452a' : '#26361f';
    ctx.fill();
    // Centre rib, then paired leaflets down the blade — the fern read.
    ctx.strokeStyle = 'rgba(24,32,18,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bx + spread * 2, by); ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY); ctx.stroke();
    for (let t = 0.16; t < 0.94; t += 0.1) {
      const px = bx + (tipX - bx) * t + (ctrlX - bx) * 2 * t * (1 - t);
      const py = by + (tipY - by) * t + (ctrlY - by) * 2 * t * (1 - t);
      const spreadLeaf = 5.5 * (1 - t) + 1.6;
      const side = (Math.round(t * 100) % 2) === 0 ? 1 : -1;
      ctx.fillStyle = rnd() < 0.45 ? 'rgba(104,132,78,0.72)' : 'rgba(48,66,38,0.9)';
      ell(ctx, px + side * spreadLeaf * 0.6, py - 1.2, spreadLeaf, 1.7, ctx.fillStyle as string, null);
    }
  }
  // Base clump: dark crown where the fronds spring from, so it sits on the ground.
  ell(ctx, bx, by + 1, w * 0.17, 5, 'rgba(26,34,20,0.95)', null);
  for (let i = 0; i < 5; i++) {
    ell(ctx, bx + (rnd() - 0.5) * w * 0.28, by - rnd() * 5, 6 + rnd() * 5, 3, 'rgba(38,52,30,0.9)', null);
  }
}

/** A fallen log lying across the gameplay band — moss, rings, a broken limb. */
function drawLogFallen(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number = 23): void {
  const rnd = localRng(seed);
  const wood = '#4c3a28', woodL = '#634b33';
  ell(ctx, w / 2, h - 4, w * 0.44, 3.6, 'rgba(0,0,0,0.28)', null);
  rr(ctx, 5, h * 0.34, w - 10, h * 0.42, h * 0.2, wood);
  // top light + grain
  rr(ctx, 5, h * 0.34, w - 10, h * 0.14, h * 0.07, woodL);
  ctx.strokeStyle = 'rgba(30,22,14,0.45)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = h * 0.44 + i * 3;
    ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w - 12, y + (rnd() - 0.5) * 2); ctx.stroke();
  }
  // moss on the shaded side + end rings
  for (let i = 0; i < 7; i++) {
    ell(ctx, 12 + rnd() * (w - 24), h * 0.62 + rnd() * 4, 4 + rnd() * 6, 2.4, 'rgba(74,96,54,0.8)', null);
  }
  circ(ctx, w - 9, h * 0.55, h * 0.2, shade(wood, -18), 'rgba(30,22,14,0.7)');
  circ(ctx, w - 9, h * 0.55, h * 0.1, woodL, null);
  // broken limb stub
  ctx.save();
  ctx.translate(w * 0.34, h * 0.36);
  ctx.rotate(-0.7);
  ctx.fillStyle = shade(wood, -10);
  ctx.fillRect(0, 0, 3.4, 13);
  ctx.restore();
}

/**
 * Build every Ashen Frontier prop texture (idempotent — the texture manager
 * skips existing keys, matching the other prop builders).
 */
export function buildAshenProps(scene: Phaser.Scene): void {
  single(scene, 'decal_blood_a', 46, 30, (ctx, w, h) => drawBlood(ctx, w, h, 11));
  single(scene, 'decal_blood_b', 54, 34, (ctx, w, h) => drawBlood(ctx, w, h, 27));
  single(scene, 'decal_footsteps', 56, 22, drawFootsteps);
  single(scene, 'decal_scorch', 44, 30, (ctx, w, h) => drawScorch(ctx, w, h, 5));
  single(scene, 'decal_ash', 40, 22, (ctx, w, h) => drawAshPile(ctx, w, h, 9));
  single(scene, 'cart_wreck', 62, 46, (ctx, w, h) => drawCartWreck(ctx, w, h, 3));
  single(scene, 'cart_wreck_b', 58, 42, (ctx, w, h) => drawCartWreck(ctx, w, h, 41));
  single(scene, 'sign_broken', 44, 48, drawSignBroken);
  single(scene, 'cage_frame', 46, 44, drawCageFrame);
  // Depth-band vocabulary for the Whispering Forest (map brief §7).
  single(scene, 'canopy_mass', 168, 118, (ctx, w, h) => drawCanopyMass(ctx, w, h, 3));
  single(scene, 'under_bush', 46, 34, (ctx, w, h) => drawUnderBush(ctx, w, h, 9));
  single(scene, 'frond_near', 98, 92, (ctx, w, h) => drawFrondNear(ctx, w, h, 17));
  single(scene, 'log_fallen', 78, 28, (ctx, w, h) => drawLogFallen(ctx, w, h, 23));
  // The hub's working forge — the one crafting station the region itself
  // provides, so a visitor can improve gear without founding a settlement.
  single(scene, 'forge_hot', 88, 80, drawForgeHot);
}

/**
 * The village anvil: a stone hearth with live coals, a hood, and an anvil on a
 * stump. Drawn warm and busy on purpose — the region has to LOOK like it has a
 * place to work metal, or the crafting station it provides is undiscoverable.
 */
function drawForgeHot(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const ember = '#ff8c3a', emberHot = '#ffd07a';
  // Warm pool of light on the ground, then the contact shadow. The glow is
  // generous on purpose: it is the only thing that distinguishes a working
  // forge from a grey rock pile at a glance.
  ell(ctx, w * 0.46, h - 9, w * 0.44, 10, 'rgba(255,140,58,0.20)', null);
  ell(ctx, w * 0.42, h - 10, w * 0.22, 6, 'rgba(255,190,110,0.24)', null);
  ell(ctx, w * 0.5, h - 6, w * 0.36, 5.5, 'rgba(0,0,0,0.34)', null);

  // ── Hearth (left): squat stone block with a burning mouth.
  const hx = w * 0.42, hw = w * 0.5, hh = h * 0.34, hy = h - hh - 6;
  rr(ctx, hx - hw / 2, hy, hw, hh, 3, '#6a625a');
  rr(ctx, hx - hw / 2, hy, hw, 4, 3, '#7d746a');        // lit top edge
  rr(ctx, hx - hw * 0.22, hy + hh * 0.34, hw * 0.44, hh * 0.66, 3, '#241d18');
  // Fire in the mouth: a bright bloom behind the coals, so the ember reads
  // even when the frame is dark or weather-tinted.
  ell(ctx, hx, hy + hh * 0.72, hw * 0.2, hh * 0.3, 'rgba(255,150,60,0.55)', null);
  for (let i = 0; i < 7; i++) {                          // coals in the mouth
    const cx = hx - hw * 0.18 + (i % 4) * (hw * 0.12);
    const cy = hy + hh * 0.68 + (i % 3) * 4;
    circ(ctx, cx, cy, 4.2 - (i % 3) * 0.9, i % 2 ? emberHot : ember, null);
  }
  ell(ctx, hx, hy + hh * 0.6, hw * 0.24, 6, 'rgba(255,176,90,0.42)', null);
  ell(ctx, hx, hy + hh * 0.74, hw * 0.12, 3.5, 'rgba(255,236,190,0.7)', null);

  // ── Hood + chimney above the fire, so it reads as a working forge.
  rr(ctx, hx - hw * 0.34, hy - 14, hw * 0.68, 15, 2, '#575049');
  rr(ctx, hx - hw * 0.2, hy - 30, hw * 0.28, 18, 2, '#4d4741');
  circ(ctx, hx - hw * 0.06, hy - 31, 4.5, 'rgba(150,150,150,0.16)', null);

  // ── Anvil (right) on a stump: the silhouette that names the station.
  const ax = w * 0.76, ay = h - 12;
  rr(ctx, ax - 8, ay - 12, 16, 13, 2, '#5a4a34');            // stump
  rr(ctx, ax - 13, ay - 20, 26, 8, 2, '#3a3f45');            // anvil body
  rr(ctx, ax - 5, ay - 26, 11, 6, 1, '#31363b');             // horn/face
  rr(ctx, ax - 14, ay - 18, 28, 3, 1, '#4c525a');            // lit edge
  circ(ctx, ax, ay - 27, 2.2, 'rgba(255,208,122,0.85)', null); // work piece glowing

  // Sparks off the anvil — the "still in use" tell.
  for (let i = 0; i < 12; i++) {
    const sx = ax + (i % 5 - 2) * 5 + (i * 7) % 4 - 2;
    const sy = ay - 26 - i * 2.4;
    circ(ctx, sx, sy, 1.6 + (i % 3) * 0.5, i % 2 ? 'rgba(255,228,160,0.95)' : ember, null);
  }
}
