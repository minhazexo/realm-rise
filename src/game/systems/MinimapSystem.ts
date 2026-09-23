// ─────────────────────────────────────────────────────────────────────────────
// MinimapSystem — player-centered tactical map painted on the React canvas.
//
// Extracted from WorldScene (Phase 3). Single entry point
// updateMinimap(scene, px, py), called every 6th frame. Terrain comes from
// the shared mapRender module (identical colors to the main world map);
// markers follow the shared shape language (poiStyle / nodeGlyph).
//
// Layer order (low → high): base → terrain → grid → settlement/buildings →
// POIs → gather nodes → NPCs → enemies → player → compass → vignette.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { updateNavigation } from './NavigationSystem.ts';
import { WORLD_CONFIG } from '../core/Constants.ts';
import { allPois } from './PoiRegistry.ts';
import { drawMapTerrain, poiStyle, nodeGlyph } from '../world/mapRender.ts';

const LOGICAL_W = 240;
const LOGICAL_H = 170;
const CELL = 15;

/** Explored-chunk cache hung off the scene (invalidated by list length). */
interface SeenChunks extends Set<string> {
  _len?: number;
}

/** Gather-node fields read for map glyphs. */
export interface MinimapNode {
  x: number;
  y: number;
  type: string;
  depleted?: boolean;
  def?: { tex?: string } | null;
}

/** NPC sprite-or-entity shape read for cyan dots. */
export interface MinimapNpc {
  x: number;
  y: number;
  dead?: boolean;
  sprite?: { x: number; y: number; dead?: boolean } | null;
}

/** Enemy shape read for red-diamond markers. */
export interface MinimapEnemy {
  dead?: boolean;
  boss?: boolean;
  sprite: { x: number; y: number } | null;
}

/** Minimal scene surface consumed by the minimap painter. */
export type MinimapScene = Phaser.Scene & {
  _frame?: number;
  _mmSeen?: SeenChunks;
  nodes: Map<string, MinimapNode>;
  npcs?: MinimapNpc[];
  enemies: MinimapEnemy[];
  player?: { dir?: string } | null;
};

const DIR_VECTORS: Record<string, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
};
const FALLBACK_DIR: [number, number] = [0, 1];

/**
 * Paint one minimap frame. No-ops when the canvas (or DOM) is unavailable,
 * so headless/test environments never crash.
 */
export function updateMinimap(scene: MinimapScene, px: number, py: number): void {
  updateNavigation(px, py);
  if (typeof document === 'undefined') return;
  const canvas: HTMLCanvasElement | null = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!ctx) return;
  // Crisp on retina: fixed logical size, 2x backing store.
  const mw = LOGICAL_W, mh = LOGICAL_H;
  if (canvas.width !== mw * 2) { canvas.width = mw * 2; canvas.height = mh * 2; }
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  const zoom: number = GameState.session.minimapZoom || 1;
  const viewRadius: number = 2200 / zoom;
  const frame: number = scene._frame || 0;
  const w2mX = (wx: number): number => ((wx - px) / (viewRadius * 2) + 0.5) * mw;
  const w2mY = (wy: number): number => ((wy - py) / (viewRadius * 2) + 0.5) * mh;
  const inView = (mx: number, my: number, pad = 0): boolean => mx >= -pad && mx <= mw + pad && my >= -pad && my <= mh + pad;

  // ── Base: deep gradient so the map feels like parchment-glass ──
  const bg: CanvasGradient = ctx.createLinearGradient(0, 0, 0, mh);
  bg.addColorStop(0, '#0d1322');
  bg.addColorStop(1, '#080c15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, mw, mh);

  // ── Terrain cells: shared renderer — identical colors to the main map ──
  const cs: number = WORLD_CONFIG.chunkSize || 512;
  let seen: SeenChunks | undefined = scene._mmSeen;
  const seenList: string[] = GameState.s?.world?.exploredChunks;
  if (!seen || seen._len !== seenList?.length) {
    seen = scene._mmSeen = new Set(seenList || []);
    seen._len = seenList?.length || 0;
  }
  const shimmer: number = 0.10 + 0.06 * Math.sin(frame / 6);
  drawMapTerrain(ctx, {
    centerX: px, centerY: py, viewRadius, w: mw, h: mh,
    cell: CELL, explored: seen, chunkSize: cs, shimmer,
  });

  // ── Faint grid (orientation aid, cartographic convention) ──
  ctx.strokeStyle = 'rgba(200,180,120,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = mw / 4; gx < mw; gx += mw / 4) { ctx.moveTo(gx, 0); ctx.lineTo(gx, mh); }
  for (let gy = mh / 4; gy < mh; gy += mh / 4) { ctx.moveTo(0, gy); ctx.lineTo(mw, gy); }
  ctx.stroke();

  // ── Settlement + buildings ──
  const S = GameState.s;
  const home: { x: number; y: number } | null = S?.settlement?.founded ? S.settlement.pos : null;
  const clampEdge = (mx: number, my: number): [number, number] => [
    Math.max(8, Math.min(mw - 8, mx)),
    Math.max(10, Math.min(mh - 8, my)),
  ];
  try {
    const done = (S?.settlement?.buildings || []).filter((b) => b.complete).slice(0, 40);
    ctx.fillStyle = '#d8b64a';
    for (const b of done) {
      const mx = w2mX(b.x), my = w2mY(b.y);
      if (!inView(mx, my)) continue;
      ctx.fillRect(mx - 1, my - 1, 2, 2);
    }
  } catch { /* ignore */ }
  if (home) {
    let mx = w2mX(home.x), my = w2mY(home.y);
    const off: boolean = !inView(mx, my);
    [mx, my] = clampEdge(mx, my);
    // Home = gold house glyph (square + roof), clamped to edge when far.
    ctx.fillStyle = off ? 'rgba(255,214,107,0.75)' : '#ffd66b';
    ctx.fillRect(mx - 2.5, my - 1, 5, 4);
    ctx.beginPath();
    ctx.moveTo(mx - 3.5, my - 1); ctx.lineTo(mx, my - 5); ctx.lineTo(mx + 3.5, my - 1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // ── POIs: shared shape language with the main map ──
  try {
    const known = new Set(S?.world?.discoveredPois || []);
    const owned = new Set(S?.world?.ownedCamps || []);
    for (const poi of allPois()) {
      if (!known.has(poi.id) && !owned.has(poi.id)) continue;
      const mx = w2mX(poi.x), my = w2mY(poi.y);
      if (!inView(mx, my)) continue;
      const { shape, color: col } = poiStyle(poi, owned.has(poi.id));
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1;
      if (shape === 'boss') { // boss = ringed diamond
        ctx.beginPath();
        ctx.moveTo(mx, my - 4); ctx.lineTo(mx + 4, my); ctx.lineTo(mx, my + 4); ctx.lineTo(mx - 4, my);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = col; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(frame / 5);
        ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (shape === 'camp') { // camp = triangle
        ctx.beginPath();
        ctx.moveTo(mx, my - 3.5); ctx.lineTo(mx + 3.5, my + 2.5); ctx.lineTo(mx - 3.5, my + 2.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else { // ruins / friends / held = circle
        ctx.beginPath(); ctx.arc(mx, my, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
  } catch { /* ignore */ }

  // ── Nearby gather nodes: ▲ tree · ■ rock/ore · · flora ──
  try {
    let drawn = 0;
    for (const n of scene.nodes.values()) {
      if (drawn > 70) break;
      if (n.depleted) continue;
      const dx = n.x - px, dy = n.y - py;
      if (dx * dx + dy * dy > viewRadius * viewRadius) continue;
      const mx = w2mX(n.x), my = w2mY(n.y);
      if (!inView(mx, my)) continue;
      const glyph = nodeGlyph(n.type, n.def?.tex);
      if (glyph === 'tree') {
        ctx.fillStyle = 'rgba(74,180,90,0.9)';
        ctx.beginPath();
        ctx.moveTo(mx, my - 3); ctx.lineTo(mx + 2.6, my + 2); ctx.lineTo(mx - 2.6, my + 2);
        ctx.closePath(); ctx.fill();
        drawn++;
      } else if (glyph === 'rock') {
        ctx.fillStyle = 'rgba(200,205,215,0.9)';
        ctx.fillRect(mx - 1.6, my - 1.6, 3.2, 3.2);
        drawn++;
      } else if (glyph === 'flora') {
        ctx.fillStyle = 'rgba(190,255,150,0.85)';
        ctx.fillRect(mx - 1, my - 1, 2, 2);
        drawn++;
      }
    }
  } catch { /* ignore */ }

  // ── NPCs: cyan dots · Enemies: red diamonds (boss = big + ring) ──
  try {
    ctx.fillStyle = '#7ae0ff';
    for (const npc of scene.npcs || []) {
      const s = npc.sprite || npc;
      if (!s || s.dead) continue;
      const mx = w2mX(s.x), my = w2mY(s.y);
      if (!inView(mx, my)) continue;
      ctx.beginPath(); ctx.arc(mx, my, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  } catch { /* ignore */ }
  for (const e of scene.enemies) {
    if (e.dead || !e.sprite) continue;
    const mx = w2mX(e.sprite.x), my = w2mY(e.sprite.y);
    if (!inView(mx, my)) continue;
    ctx.fillStyle = e.boss ? '#ff4444' : '#d33a2e';
    const r: number = e.boss ? 4.5 : 2.8;
    ctx.beginPath();
    ctx.moveTo(mx, my - r); ctx.lineTo(mx + r, my); ctx.lineTo(mx, my + r); ctx.lineTo(mx - r, my);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = e.boss ? '#ffffff' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  }

  // Navigation pin and a straight-line bearing (not a pathfinding route).
  const waypoint = GameState.session.waypoint;
  if (waypoint) {
    const mx = Math.max(10, Math.min(mw - 10, w2mX(waypoint.x)));
    const my = Math.max(20, Math.min(mh - 20, w2mY(waypoint.y)));
    ctx.save();
    ctx.strokeStyle = '#7ee8ef'; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(mw / 2, mh / 2); ctx.lineTo(mx, my); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#122c38';
    ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', mx, my);
    ctx.restore();
  }

  // ── Player: view cone + heading arrow (never color-only: white ring) ──
  const dirVec: [number, number] = DIR_VECTORS[scene.player?.dir ?? 'down'] ?? FALLBACK_DIR;
  const ang: number = Math.atan2(dirVec[1], dirVec[0]);
  ctx.fillStyle = 'rgba(68,255,136,0.16)';
  ctx.beginPath();
  ctx.moveTo(mw / 2, mh / 2);
  ctx.arc(mw / 2, mh / 2, 16, ang - 0.5, ang + 0.5);
  ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.translate(mw / 2, mh / 2);
  ctx.rotate(ang);
  ctx.fillStyle = '#44ff88';
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-3.5, -4); ctx.lineTo(-1.5, 0); ctx.lineTo(-3.5, 4);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();

  // ── Compass + coords ──
  ctx.fillStyle = '#e8c94b';
  ctx.font = 'bold 11px serif';
  ctx.fillText('N', 7, 14);
  ctx.fillStyle = 'rgba(232,220,190,0.75)';
  ctx.font = '9px monospace';
  ctx.fillText(`${Math.round(px)}, ${Math.round(py)}`, 7, mh - 7);

  // ── Soft edge vignette so markers melt into the frame ──
  const vg: CanvasGradient = ctx.createRadialGradient(mw / 2, mh / 2, Math.min(mw, mh) * 0.42, mw / 2, mh / 2, Math.max(mw, mh) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, mw, mh);
}
