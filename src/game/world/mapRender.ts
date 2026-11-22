/// <reference lib="dom" />
// ─────────────────────────────────────────────────────────────────────────────
// The map renderer — the single visual language for both map surfaces.
//
// There is ONE map in this game. It is drawn here and shown twice:
//   • the corner minimap  (`systems/environment/MinimapSystem.ts`, player-centred)
//   • the World Map panel  (`app/components/panels/MapPanel.tsx`, pannable)
// Both call `drawWorldMap()`. Neither draws terrain or markers itself, because
// the version of this file that let each host draw its own markers is exactly
// how the minimap drifted into being a second, different map.
//
// Everything here is a function of game state passed in by the host
// (`MapSceneData`) — this module never imports a system, so it stays a pure
// renderer that runs in the Phaser scene, in React, and in node tests.
//
// Layer order (low → high): sky/base → terrain → relief → coastline → fog
// frontier → regions (footprint + name) → grid → resources → buildings → POIs →
// home → viewport → player → waypoint → chrome (compass, scale bar, coordinates)
// → vignette.
//
// The ground is `world/mapTerrain.ts`; the pure view geometry, pan/zoom, marker
// placement, label declutter, region-naming and hover rules live in
// `world/mapView.ts`, which is canvas-free and unit-tested.
// ─────────────────────────────────────────────────────────────────────────────
import {
  buildTerrainGrid, paintTerrainGrid, paintTerrainRelief, paintFogFrontier,
  isExplored,
} from './mapTerrain.ts';
import {
  layoutLabels, placeMarkers, resolveHover, toCanvas, niceScaleStep, scaleOf,
  inCanvas, mapCellSize, regionDisplay,
} from './mapView.ts';
import type {
  MapView, MapMarkerSource, MapMarker, PlacedMarker, LabelRect, HoverInfo,
} from './mapView.ts';

export type {
  MapView, MapMarker, MapMarkerKind, PlacedMarker, LabelRect, HoverInfo, RegionDisplay,
} from './mapView.ts';

/** Frame chrome colours — one palette so both views look like the same map. */
const CHROME = {
  ink: '#e8c94b',
  paper: 'rgba(232,220,190,0.78)',
  hairline: 'rgba(232,201,75,0.28)',
  grid: 'rgba(200,180,120,0.07)',
  region: 'rgba(232,201,75,0.22)',
  mine: '#44ff88'
} as const;

// ── Shared marker / POI language ────────────────────────────────────────────

/** Minimal POI shape consumed by {@link poiStyle}. */
export interface PoiStyleInput {
  boss?: unknown;
  npc?: unknown;
  kind?: string;
}

/** Shared POI shape language result. */
export interface PoiStyle {
  shape: 'boss' | 'camp' | 'dot';
  color: string;
}

/**
 * Shared POI shape language. Returns { shape, color } where shape is one of
 * 'boss' (ringed diamond) | 'camp' (triangle) | 'dot' (circle).
 */
export function poiStyle(poi: PoiStyleInput | null | undefined, owned: unknown): PoiStyle {
  if (owned) return { shape: 'dot', color: '#ffd66b' };
  if (poi?.boss) return { shape: 'boss', color: '#ff6b5a' };
  // Friendly places first: an npc or 'friend' in the kind means safe,
  // even when the kind also mentions camp (e.g. Hunter's Rest).
  if (poi?.npc || /friend|shrine/i.test(poi?.kind || '')) return { shape: 'dot', color: '#7ae0ff' };
  if (/camp|den/i.test(poi?.kind || '')) return { shape: 'camp', color: '#ff9a4a' };
  return { shape: 'dot', color: '#c9a8ff' };
}

/** Map glyph classification. */
export type NodeGlyph = 'tree' | 'rock' | 'flora' | null;

/** Classify a gather node for map glyphs: 'tree' | 'rock' | 'flora' | null. */
export function nodeGlyph(type: string | null | undefined, tex: string | null | undefined): NodeGlyph {
  const t = `${type || ''} ${tex || ''}`;
  if (/tree|pine|oak|palm|cactus/i.test(t)) return 'tree';
  if (/rock|ore|stone|crystal|coal|gold|silver|iron|flint/i.test(t)) return 'rock';
  if (/herb|berry|mushroom|reed|flower|bush|clay|fiber/i.test(t)) return 'flora';
  return null;
}

// ── The composer ────────────────────────────────────────────────────────────

/** Everything the map draws, gathered by the host from game state. */
export interface MapSceneData extends MapMarkerSource {
  /** Authored regions, drawn as names (+ footprint rings once visited). */
  regions?: ReadonlyArray<{ id?: string; name: string; x: number; y: number; radius?: number }>;
  /** Region ids the player has stood in — see `mapView.regionDisplay`. */
  visitedRegions?: ReadonlyArray<string>;
  /** Resource nodes to overlay (already filtered by the host). */
  resources?: ReadonlyArray<{ x: number; y: number; type?: string; tex?: string }>;
  /** The world camera's footprint, so the panel shows what the minimap window is. */
  viewRect?: { x: number; y: number; w: number; h: number } | null;
  /** Explored chunk keys; null/absent = the whole map is known. */
  explored?: Set<string> | null;
}

/** Which layers a view draws. Both views read the same flags (one map). */
export interface MapLayers {
  pois?: boolean;
  labels?: boolean;
  regions?: boolean;
  grid?: boolean;
  fog?: boolean;
  resources?: boolean;
  viewRect?: boolean;
  chrome?: boolean;
}

/** How much furniture a view can carry: 'full' = the panel, 'minimap' = corner. */
export type MapDetail = 'full' | 'minimap';

export interface DrawWorldMapOpts {
  view: MapView;
  data: MapSceneData;
  detail?: MapDetail;
  layers?: MapLayers;
  /** Marker id to pulse (list hover, click-to-track feedback). */
  highlightId?: string | null;
  /** Cursor in canvas px — drives the readout + hover ring. */
  hover?: { x: number; y: number } | null;
  /** Player facing, for the heading wedge. */
  playerDir?: string;
  /** Animation counter (pulses); omit for a still frame. */
  tick?: number;
  /** Pin off-view markers to the frame (panel) instead of dropping them (minimap). */
  clampMarkers?: boolean;
  /** 0..1 water sparkle for animated views. */
  shimmer?: number;
  /** Rounded frame + vignette. */
  frame?: boolean;
  /**
   * Terrain sample budget for THIS frame (`mapView.mapCellSize`). A host lowers
   * it while the player is dragging or zooming and drops back to the default
   * once the gesture settles: interaction stays smooth, the still map stays
   * crisp. Sampling is the cost, so this is the one dial that matters.
   */
  cellBudget?: number;
}

/** What a painted frame produced — labels and hover state the host reuses. */
export interface MapFrameResult {
  placed: PlacedMarker[];
  labels: LabelRect[];
  hover: HoverInfo | null;
  /** Scale of this frame in world px per canvas px. */
  scale: number;
}

/** Options for {@link resolveMapHover} — the same ones a frame is drawn with. */
export interface MapHoverOpts {
  detail?: MapDetail;
  layers?: MapLayers;
  clampMarkers?: boolean;
}

const DIR_VECTORS: Record<string, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]
};

/** Marker colours by kind, in one place so both views are identical. */
function markerColor(m: MapMarker): string {
  return m.color || '#c9a8ff';
}

/** Draw one marker glyph. Sizes scale with the view's detail level. */
function drawMarker(
  ctx: CanvasRenderingContext2D,
  m: MapMarker,
  x: number,
  y: number,
  detail: MapDetail,
  highlighted: boolean,
  tick: number,
): void {
  const big = detail === 'full';
  const col = markerColor(m);
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = big ? 1.2 : 1;
  if (m.shape === 'player') {
    ctx.beginPath(); ctx.arc(x, y, big ? 5 : 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = big ? 1.5 : 1.2; ctx.stroke();
    return;
  }
  if (m.shape === 'home') {
    ctx.fillRect(x - (big ? 4 : 2.5), y - 1, big ? 8 : 5, big ? 6 : 4);
    ctx.beginPath();
    ctx.moveTo(x - (big ? 5.5 : 3.5), y - 1);
    ctx.lineTo(x, y - (big ? 7 : 5));
    ctx.lineTo(x + (big ? 5.5 : 3.5), y - 1);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    return;
  }
  if (m.shape === 'waypoint') {
    ctx.fillStyle = '#122c38';
    ctx.beginPath(); ctx.arc(x, y, big ? 8 : 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7ee8ef'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${big ? 12 : 10}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', x, y);
    return;
  }
  if (m.shape === 'building') {
    const s = big ? 3 : 2;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    return;
  }
  if (m.shape === 'boss') {
    const r = big ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Bosses ring: a slow pulse is the map's "danger here" language.
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin((tick || 0) / 5);
    ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  if (m.shape === 'camp') {
    const r = big ? 5 : 3.5;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.72); ctx.lineTo(x - r, y + r * 0.72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    return;
  }
  ctx.beginPath(); ctx.arc(x, y, big ? 4 : 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (highlighted) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.5 + 0.35 * Math.sin((tick || 0) / 4);
    ctx.beginPath(); ctx.arc(x, y, (big ? 9 : 7), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Chrome: rounded frame, compass, scale bar, coordinates. */
function drawChrome(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  detail: MapDetail,
  readout: string | null,
): void {
  const { w, h } = view;
  ctx.strokeStyle = CHROME.hairline;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  // Compass: N is the only label that matters; a rose would crowd a small map.
  const cx = detail === 'full' ? 20 : 12;
  const cy = detail === 'full' ? 26 : 16;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = CHROME.ink;
  ctx.fillStyle = CHROME.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.moveTo(-5, -3); ctx.lineTo(5, -3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(-3.2, -6); ctx.lineTo(3.2, -6); ctx.closePath(); ctx.fill();
  ctx.font = `bold ${detail === 'full' ? 10 : 9}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -16);
  ctx.restore();
  if (detail !== 'full') return;
  // Scale bar: a round world distance across a fixed 90 px.
  const step = niceScaleStep(scaleOf(view) * 90);
  if (step > 0) {
    const px = step / scaleOf(view);
    const x0 = 12, y0 = h - 16;
    ctx.strokeStyle = CHROME.paper;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + px, y0);
    ctx.moveTo(x0, y0 - 3); ctx.lineTo(x0, y0 + 3);
    ctx.moveTo(x0 + px, y0 - 3); ctx.lineTo(x0 + px, y0 + 3);
    ctx.stroke();
    ctx.fillStyle = CHROME.paper;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${step.toLocaleString()} u`, x0, y0 - 4);
  }
  if (readout) {
    ctx.fillStyle = CHROME.paper;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(readout, w - 8, h - 6);
  }
}

/**
 * Resource glyphs: the nearest few nodes, in the same shapes the world props
 * use. Nearest-first and capped, because a 180 px window over a forest would
 * otherwise be confetti — and the rocks you are deciding between are the ones
 * within reach. Returns how many were drawn (0 when the layer is off).
 */
export function paintResources(
  ctx: CanvasRenderingContext2D,
  view: MapView,
  resources: ReadonlyArray<{ x: number; y: number; type?: string; tex?: string }>,
  detail: MapDetail,
  limit = 70,
): number {
  const big = detail === 'full';
  const found: Array<{ x: number; y: number; glyph: NodeGlyph; d: number }> = [];
  for (const n of resources) {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    const glyph = nodeGlyph(n.type, n.tex);
    if (!glyph) continue;
    const p = toCanvas(view, n.x, n.y);
    if (!inCanvas(view, p, 2)) continue;
    found.push({ x: p.x, y: p.y, glyph, d: (n.x - view.centerX) ** 2 + (n.y - view.centerY) ** 2 });
  }
  if (!found.length) return 0;
  found.sort((a, b) => a.d - b.d);
  let drawn = 0;
  for (const n of found) {
    if (drawn >= limit) break;
    if (n.glyph === 'tree') {
      const r = big ? 4 : 3;
      ctx.fillStyle = 'rgba(74,180,90,0.9)';
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - r); ctx.lineTo(n.x + r * 0.86, n.y + r * 0.66); ctx.lineTo(n.x - r * 0.86, n.y + r * 0.66);
      ctx.closePath(); ctx.fill();
    } else if (n.glyph === 'rock') {
      const s = big ? 4 : 3.2;
      ctx.fillStyle = 'rgba(200,205,215,0.9)';
      ctx.fillRect(n.x - s / 2, n.y - s / 2, s, s);
    } else {
      ctx.fillStyle = 'rgba(190,255,150,0.85)';
      ctx.fillRect(n.x - 1, n.y - 1, 2, 2);
    }
    drawn++;
  }
  return drawn;
}

/**
 * Resolve what the map says at a canvas point: cursor world position, the place
 * under the cursor, and whether that ground is explored. THE composition path —
 * it builds the marker list, places it, lays the labels out and reads the hover
 * with the same primitives `drawWorldMap` uses, so a readout can never disagree
 * with the pixels. A host calls this for a hover WITHOUT repainting the terrain,
 * because a readout is a line of DOM, not a new frame.
 */
export function resolveMapHover(
  view: MapView,
  data: MapSceneData,
  mx: number,
  my: number,
  opts: MapHoverOpts = {},
): HoverInfo {
  const detail: MapDetail = opts.detail || 'full';
  const layers: MapLayers = { pois: true, labels: detail === 'full', ...(opts.layers || {}) };
  const placed = placeMarkers(
    buildMapMarkers(data, layers), view,
    detail === 'full' ? 18 : 10,
    opts.clampMarkers !== false,
  );
  const labels = layers.labels
    ? layoutLabels(
      placed
        .filter((p) => !p.off && p.marker.label && p.marker.kind !== 'building')
        .map((p) => ({
          id: p.marker.id, text: p.marker.label!, anchorX: p.x, anchorY: p.y,
          color: p.marker.kind === 'player' ? CHROME.mine : 'rgba(232,236,244,0.88)',
          priority: p.marker.priority
        })),
      view.w, view.h, 6, detail === 'full' ? 11 : 9,
    )
    : [];
  const exploredSet = (layers.fog === false ? null : data.explored) || null;
  return resolveHover(
    view,
    placed.filter((p) => !!p.marker.label),
    labels,
    mx, my,
    (wx, wy) => isExplored(exploredSet, wx, wy, 512),
    detail === 'full' ? 12 : 9,
  );
}

/**
 * Paint the map. THE entry point: the minimap and the World Map panel both call
 * this with the same `data` and the same layer flags, differing only in view
 * (centre/zoom/size) and detail (how much furniture fits).
 */
export function drawWorldMap(ctx: CanvasRenderingContext2D, opts: DrawWorldMapOpts): MapFrameResult {
  const detail: MapDetail = opts.detail || 'full';
  const layers: MapLayers = {
    pois: true, labels: detail === 'full', regions: true, grid: detail === 'full',
    fog: true, resources: false, viewRect: false, chrome: true, ...(opts.layers || {})
  };
  const view = opts.view;
  const { w, h } = view;
  const data: MapSceneData = opts.data;
  const tick = opts.tick || 0;

  // ── Base ──────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0d1322');
  bg.addColorStop(1, '#080c15');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // ── Terrain + relief + fog frontier ───────────────────────────────────
  // The cell size is the frame budget's business (`mapCellSize`): a fixed world
  // density up close, grown so a whole-world view still fits in one repaint.
  const cell = mapCellSize(view, detail === 'full' ? 64 : 96, opts.cellBudget);
  const terrainOpts = {
    centerX: view.centerX, centerY: view.centerY, viewRadius: view.radiusX,
    w, h, cell, shimmer: opts.shimmer || 0,
    explored: layers.fog ? data.explored || null : null,
    chunkSize: 512
  };
  const grid = buildTerrainGrid(terrainOpts);
  paintTerrainGrid(ctx, grid, terrainOpts);
  paintTerrainRelief(ctx, grid);
  if (layers.fog) paintFogFrontier(ctx, grid);

  // ── Regions: footprint ring when visited, name when named or rumoured ──
  if (layers.regions && data.regions?.length) {
    const placedRegions: Array<{ x: number; y: number }> = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of data.regions) {
      const display = regionDisplay(r, data.player, data.visitedRegions || []);
      if (!display) continue;
      const p = toCanvas(view, r.x, r.y);
      if (p.x < 12 || p.x > w - 12 || p.y < 12 || p.y > h - 12) continue;
      if (placedRegions.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < (detail === 'full' ? 120 : 70))) continue;
      placedRegions.push({ x: p.x, y: p.y });
      if (display.known && r.radius) {
        const edge = toCanvas(view, r.x + r.radius, r.y);
        const rad = Math.abs(edge.x - p.x);
        if (rad > 8) {
          ctx.save();
          ctx.setLineDash([5, 6]);
          ctx.strokeStyle = CHROME.region;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      }
      const size = detail === 'full' ? 12 : 9;
      ctx.font = `italic ${size}px Georgia, serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(4,7,12,0.75)';
      ctx.strokeText(display.name, p.x, p.y);
      ctx.fillStyle = display.known ? 'rgba(226,236,255,0.62)' : 'rgba(226,236,255,0.34)';
      ctx.fillText(display.name, p.x, p.y);
    }
  }

  // ── Grid ──────────────────────────────────────────────────────────────
  if (layers.grid) {
    ctx.strokeStyle = CHROME.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = w / 4; gx < w; gx += w / 4) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
    for (let gy = h / 4; gy < h; gy += h / 4) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
    ctx.stroke();
  }

  // ── Resources (under the markers: they are terrain detail, not destinations)
  if (layers.resources && data.resources?.length) {
    paintResources(ctx, view, data.resources, detail);
  }

  // ── Markers + labels ──────────────────────────────────────────────────
  const placed = placeMarkers(
    buildMapMarkers(data, layers), view,
    detail === 'full' ? 18 : 10,
    opts.clampMarkers !== false,
  );
  for (const p of placed) {
    ctx.globalAlpha = p.off ? 0.6 : 1;
    drawMarker(ctx, p.marker, p.x, p.y, detail, opts.highlightId === p.marker.id, tick);
    if (p.off) {
      // Off-view: a tick on the inside of the frame showing which way it lies.
      const ang = Math.atan2(p.y - h / 2, p.x - w / 2);
      ctx.strokeStyle = p.marker.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, detail === 'full' ? 9 : 6, ang + Math.PI * 0.75, ang + Math.PI * 1.25);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const labels = layers.labels
    ? layoutLabels(
      placed
        .filter((p) => !p.off && p.marker.label && p.marker.kind !== 'building')
        .map((p) => ({
          id: p.marker.id, text: p.marker.label!, anchorX: p.x, anchorY: p.y,
          color: p.marker.kind === 'player' ? CHROME.mine : 'rgba(232,236,244,0.88)',
          priority: p.marker.priority
        })),
      w, h, 6, detail === 'full' ? 11 : 9,
    )
    : [];
  for (const l of labels) {
    ctx.font = `${detail === 'full' ? 11 : 9}px Georgia, serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(4,7,12,0.8)';
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, l.x, l.y);
  }

  // ── World-camera footprint (the minimap's window, drawn on the big map) ─
  if (layers.viewRect && data.viewRect) {
    const a = toCanvas(view, data.viewRect.x, data.viewRect.y);
    const b = toCanvas(view, data.viewRect.x + data.viewRect.w, data.viewRect.y + data.viewRect.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.setLineDash([]);
  }

  // ── Player heading wedge (drawn under the player dot) ─────────────────
  const dirVec = DIR_VECTORS[opts.playerDir || 'down'] || [0, 1];
  const ang = Math.atan2(dirVec[1] as number, dirVec[0] as number);
  const pp = toCanvas(view, data.player.x, data.player.y);
  ctx.fillStyle = 'rgba(68,255,136,0.16)';
  ctx.beginPath();
  ctx.moveTo(pp.x, pp.y);
  ctx.arc(pp.x, pp.y, detail === 'full' ? 22 : 16, ang - 0.5, ang + 0.5);
  ctx.closePath();
  ctx.fill();

  // ── Waypoint: dashed bearing from the player to the target ────────────
  const wp = placed.find((p) => p.marker.kind === 'waypoint');
  if (wp && !wp.off) {
    ctx.save();
    ctx.strokeStyle = 'rgba(126,232,239,0.75)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(pp.x, pp.y);
    ctx.lineTo(wp.x, wp.y);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);
  }

  // ── Hover: ring + readout (resolved by the shared composition path) ────
  let hover: HoverInfo | null = null;
  if (opts.hover) {
    hover = resolveMapHover(view, data, opts.hover.x, opts.hover.y, {
      detail, layers, clampMarkers: opts.clampMarkers
    });
    const hovered = placed.find((p) => p.marker.label && hover?.place === p.marker.label);
    if (hovered) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(hovered.x, hovered.y, detail === 'full' ? 11 : 8, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ── Chrome ────────────────────────────────────────────────────────────
  if (layers.chrome) {
    const centre = `${Math.round(view.centerX)}, ${Math.round(view.centerY)}`;
    drawChrome(ctx, view, detail, detail === 'full' ? centre : null);
  }

  // ── Vignette ──────────────────────────────────────────────────────────
  if (opts.frame !== false) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.44, w / 2, h / 2, Math.max(w, h) * 0.74);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  return { placed, labels, hover, scale: scaleOf(view) };
}

/**
 * The ONE place game state becomes map markers. Both views draw this list, so a
 * new marker kind shows up on the minimap and the panel in the same commit —
 * which is what stops the minimap drifting into being a second, different map.
 * Layer flags only ever *remove* from it (they can never add a private marker).
 */
export function buildMapMarkers(data: MapSceneData, layers: MapLayers = {}): MapMarker[] {
  const out: MapMarker[] = [];
  const owned = new Set<string>(data.ownedIds || []);
  if (layers.pois !== false) {
    for (const p of data.pois || []) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const held = owned.has(p.id);
      const style = poiStyle(p, held);
      out.push({
        id: `poi:${p.id}`, kind: 'poi', x: p.x, y: p.y,
        label: p.name || undefined, shape: style.shape, color: style.color,
        priority: held ? 6 : style.shape === 'boss' ? 5 : style.shape === 'camp' ? 4 : 3
      });
    }
  }
  for (const b of data.buildings || []) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
    out.push({
      id: `b:${Math.round(b.x)},${Math.round(b.y)}`, kind: 'building', x: b.x, y: b.y,
      shape: 'building', color: '#d8b64a', priority: 1
    });
  }
  if (data.settlement) {
    out.push({ id: 'home', kind: 'home', x: data.settlement.x, y: data.settlement.y, label: 'Home', shape: 'home', color: '#ffd66b', priority: 9, pin: true });
  }
  if (data.waypoint) {
    out.push({
      id: 'waypoint', kind: 'waypoint', x: data.waypoint.x, y: data.waypoint.y,
      label: data.waypoint.label || 'Waypoint', shape: 'waypoint', color: '#7ee8ef', priority: 8, pin: true
    });
  }
  out.push({ id: 'player', kind: 'player', x: data.player.x, y: data.player.y, label: 'You', shape: 'player', color: '#44ff88', priority: 10, pin: true });
  return out;
}
