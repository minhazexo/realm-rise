// ─────────────────────────────────────────────────────────────────────────────
// MinimapSystem — the corner map: a player-centred WINDOW on the one map.
//
// It is not a second map. The frame is painted by `world/mapRender.ts` through
// `drawWorldMap({ detail: 'minimap' })`, i.e. the same entry point the World Map
// panel calls, with the same marker list and the same terrain — only the view
// (centre/zoom/size) and the amount of furniture differ. The version of this
// file that painted its own terrain and its own markers is exactly how the
// minimap drifted into being a different map from the one the panel showed.
//
// What is deliberately NOT on a minimap (see `world/mapView.ts`): enemy or NPC
// dots. A map records places; a radar tracks creatures. This is a map.
//
// The only thing painted here is the night dimming and the published camera
// footprint — lighting and state, not map content.
//
// Reached through `scene.updateMinimap(px, py)`, called on the scene's 10 Hz
// minimap cadence, never per frame.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../../core/GameState.ts';
import { DAWN, DUSK, isGoldenAt, isNightAt } from './EnvSystem.ts';
import { updateNavigation } from '../world/NavigationSystem.ts';
import { allPois } from '../world/PoiRegistry.ts';
import { drawWorldMap } from '../../world/mapRender.ts';
import { MINIMAP_SIZE, minimapView } from '../../world/mapView.ts';
import type { MapSceneData } from '../../world/mapRender.ts';

const LOGICAL_W = MINIMAP_SIZE.w;
const LOGICAL_H = MINIMAP_SIZE.h;

/** Explored-chunk cache hung off the scene (invalidated by list content). */
interface SeenChunks extends Set<string> {
  _len?: number;
  _key?: string;
}

/** Gather-node fields read for map glyphs. */
export interface MinimapNode {
  x: number;
  y: number;
  type: string;
  depleted?: boolean;
  def?: { tex?: string } | null;
}

/** NPC sprite-or-entity shape. */
export interface MinimapNpc {
  x: number;
  y: number;
  dead?: boolean;
  sprite?: { x: number; y: number; dead?: boolean } | null;
}

/** Enemy shape (kept for the scene's own contract; not drawn on a map). */
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

/** The explored-chunk set, rebuilt only when the list actually changes. */
function exploredOf(scene: MinimapScene): Set<string> {
  const list: string[] = GameState.s?.world?.exploredChunks || [];
  const key = list.join('|');
  let seen = scene._mmSeen;
  if (!seen || seen._key !== key) {
    seen = scene._mmSeen = new Set(list) as SeenChunks;
    seen._key = key;
    seen._len = list.length;
  }
  return seen;
}

/** Publish the world camera's footprint so the panel can draw the live window. */
function publishViewRect(scene: MinimapScene): void {
  try {
    const cam = scene.cameras?.main;
    const v = cam?.worldView;
    if (!v) return;
    GameState.session.viewRect = {
      x: Math.round(v.x), y: Math.round(v.y),
      w: Math.round(v.width), h: Math.round(v.height)
    };
  } catch { /* headless */ }
}

/** The map's data slice: places, not creatures (see the header). */
function minimapData(scene: MinimapScene, px: number, py: number, explored: Set<string>): MapSceneData {
  const S: any = GameState.s;
  const known = new Set<string>(S?.world?.discoveredPois || []);
  const owned = new Set<string>(S?.world?.ownedCamps || []);
  const resources: Array<{ x: number; y: number; type: string; tex?: string }> = [];
  try {
    for (const n of scene.nodes.values()) {
      if (n.depleted) continue;
      resources.push({ x: n.x, y: n.y, type: n.type, tex: n.def?.tex || undefined });
    }
  } catch { /* nodes never break a frame */ }
  return {
    player: { x: px, y: py },
    settlement: S?.settlement?.founded ? S.settlement.pos : null,
    buildings: (S?.settlement?.buildings || [])
      .filter((b: { complete?: boolean }) => b.complete).slice(0, 40)
      .map((b: { x: number; y: number }) => ({ x: b.x, y: b.y })),
    pois: (allPois() as any[])
      .filter((p) => known.has(p.id) || owned.has(p.id))
      .map((p) => ({ id: p.id, name: p.label, x: p.x, y: p.y, kind: p.kind, boss: p.boss, npc: p.npc })),
    ownedIds: [...owned],
    waypoint: GameState.session.waypoint || null,
    resources,
    explored
  };
}

/** Night dim / golden tint: the corner map tracks the world's light. */
function paintLighting(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  try {
    const t: number | undefined = GameState.s?.world?.timeOfDay;
    if (typeof t !== 'number') return;
    const night = isNightAt(t);
    const dawnProx = 1 - Math.min(1, Math.abs(t - DAWN) / 0.08);
    const duskProx = 1 - Math.min(1, Math.abs(t - DUSK) / 0.08);
    const golden = isGoldenAt(t) ? Math.max(0, dawnProx, duskProx) : 0;
    if (night) {
      ctx.fillStyle = 'rgba(6,10,24,0.45)';
      ctx.fillRect(0, 0, w, h);
    } else if (golden > 0.2) {
      ctx.fillStyle = `rgba(255,150,80,${(0.08 * golden).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  } catch { /* the minimap never crashes the frame */ }
}

/**
 * Paint one minimap frame. No-ops when the canvas (or DOM) is unavailable, so
 * headless/test environments never crash.
 */
export function updateMinimap(scene: MinimapScene, px: number, py: number): void {
  updateNavigation(px, py);
  if (typeof document === 'undefined') return;
  const canvas: HTMLCanvasElement | null = document.getElementById('minimap-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
  if (!ctx) return;
  // Crisp on retina: fixed logical size, 2x backing store.
  const w = LOGICAL_W, h = LOGICAL_H;
  if (canvas.width !== w * 2) { canvas.width = w * 2; canvas.height = h * 2; }
  ctx.setTransform(2, 0, 0, 2, 0, 0);

  const frame: number = scene._frame || 0;
  const zoom: number = GameState.session.minimapZoom || 1;
  const view = minimapView(px, py, zoom, w, h);
  publishViewRect(scene);

  drawWorldMap(ctx, {
    view,
    data: minimapData(scene, px, py, exploredOf(scene)),
    detail: 'minimap',
    // A window stays truthful: places it cannot show are dropped, not pinned to
    // the rim — except home and the tracked waypoint, which carry `pin`.
    clampMarkers: false,
    layers: {
      pois: true, labels: false, regions: false, grid: false,
      fog: true, resources: true, viewRect: false, chrome: true
    },
    playerDir: scene.player?.dir,
    tick: frame,
    shimmer: 0.10 + 0.06 * Math.sin(frame / 6)
  });

  paintLighting(ctx, w, h);
}
