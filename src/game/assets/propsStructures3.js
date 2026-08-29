// ─────────────────────────────────────────────────────────────────────────────
// Structure props 3/3 — defenses, civic buildings, chests, banner.
//
// Draws: wall segment, gate segment, market stalls, temple/shrine, library,
//        chest variants (wooden/iron/royal/ancient), banner pole.
// ─────────────────────────────────────────────────────────────────────────────
import { single, rr, circ, ell, tri, shade, O } from './artCore.js';
import { structure } from './propsStructures1.js';

/**
 * Build defense, civic, and decorative structure textures.
 * @param {Phaser.Scene} scene
 */
export function buildStructureProps3(scene) {
  // ── Wall Segment ──────────────────────────────────────────────────────
  single(scene, 'wall_seg', 32, 34, (ctx, w, h) => {
    rr(ctx, 2, h - 26, w - 4, 24, 2, '#93683e', O);
    // battlements
    ctx.fillStyle = '#a67f52';
    for (let x = 2; x < w - 7; x += 8) ctx.fillRect(x, h - 31, 5, 6);
    ctx.strokeStyle = O;
    ctx.strokeRect(2, h - 26, w - 4, 24);
  });

  // ── Gate Segment ──────────────────────────────────────────────────────
  single(scene, 'gate_seg', 34, 38, (ctx, w, h) => {
    rr(ctx, 2, h - 34, w - 4, 32, 2, '#7c5632', O);
    // iron bars
    ctx.strokeStyle = '#3f2d1a';
    for (let x = 6; x < w - 4; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, h - 32); ctx.lineTo(x, h - 4);
      ctx.stroke();
    }
    // crossbar
    ctx.fillStyle = '#c9a24b';
    ctx.fillRect(w / 2 - 6, h - 22, 12, 3);
  });

  // ── Market Stalls ─────────────────────────────────────────────────────
  single(scene, 'market_stalls', 84, 62, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 36, 6, 'rgba(0,0,0,0.16)');
    // two stall canopies: [canopyColour, xOffset]
    [['#e05050', 6], ['#e8c94b', 44]].forEach(([c, x]) => {
      // posts
      ctx.fillStyle = '#8a6540';
      ctx.fillRect(x + 4, h - 30, 4, 27);
      ctx.fillRect(x + 26, h - 30, 4, 27);
      // canopy arc
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + 17, h - 30, 15, Math.PI, Math.PI * 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = O; ctx.lineWidth = 1.4; ctx.stroke();
      // counter
      rr(ctx, x + 5, h - 20, 25, 8, 2, '#a67f52', O);
    });
  });

  // ── Temple / Shrine ───────────────────────────────────────────────────
  single(scene, 'temple_shrine', 66, 84, (ctx, w, h) => {
    ell(ctx, w / 2, h - 4, 26, 7, 'rgba(0,0,0,0.18)');
    rr(ctx, 10, h - 20, w - 20, 16, 2, '#cfcabb', O);  // base
    rr(ctx, 14, h - 52, w - 28, 33, 2, '#c5c0b0', O);  // upper body
    tri(ctx, w / 2 - 22, h - 64, 44, '#b8b2a0', O);     // roof
    circ(ctx, w / 2, h - 30, 6, '#7be0c3', O, 1.2);     // crystal
  });

  // ── Library ───────────────────────────────────────────────────────────
  single(scene, 'library', 76, 76, (ctx, w, h) => {
    structure(ctx, w, h, { wallC: '#b08d55', roofC: '#5f7a94', roof: 'flat', tier: 2 });
    circ(ctx, w / 2, h - 30, 10, '#7be0c3', O, 1.3);    // crystal orb
    ctx.fillStyle = '#39404d';
    ctx.font = 'bold 11px serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦', w / 2, h - 26);                    // rune symbol
  });

  // ── Chest Variants ────────────────────────────────────────────────────
  // [key, main colour]
  [
    ['wooden_chest', '#937249'],
    ['iron_chest', '#aeb4bd'],
    ['royal_chest', '#c9a24b'],
    ['ancient_chest', '#57c4ab'],
  ].forEach(([key, c]) => {
    single(scene, key, 30, 28, (ctx, w, h) => {
      ell(ctx, w / 2, h - 3, 10, 3.5, 'rgba(0,0,0,0.16)');
      rr(ctx, 4, h - 17, w - 8, 14, 2, c, O);       // body
      rr(ctx, 4, h - 22, w - 8, 6, 3, shade(c, 18), O); // lid
      // clasp
      ctx.fillStyle = '#39404d';
      ctx.fillRect(w / 2 - 2, h - 20, 4, 6);
    });
  });

  // ── Banner Pole ───────────────────────────────────────────────────────
  single(scene, 'banner', 34, 90, (ctx, w, h) => {
    ell(ctx, w / 2, h - 3, 8, 3.5, 'rgba(0,0,0,0.18)');
    // pole
    ctx.strokeStyle = '#57503f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.lineTo(w / 2, 12); ctx.stroke();
    // banner cloth
    ctx.fillStyle = '#8a3030';
    ctx.beginPath();
    ctx.moveTo(w / 2 + 1.5, 12);
    ctx.quadraticCurveTo(w / 2 + 20, 20, w / 2 + 14, 38);
    ctx.lineTo(w / 2 + 1.5, 34);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = O; ctx.lineWidth = 1.3; ctx.stroke();
    // gold emblem
    ctx.fillStyle = '#c9a24b';
    ctx.fillRect(w / 2 + 5, 18, 5, 5);
  });
}
