// ─────────────────────────────────────────────────────────────────────────────
// Map view — the pure geometry and rules behind every map surface.
//
// There is ONE map in this game. `world/mapRender.ts` draws it; this module owns
// the part worth testing without a canvas:
//
//   • the VIEW          — what world rectangle a canvas shows (`MapView`)
//   • the mapping       — world ⇄ canvas, both directions
//   • the camera moves  — zoom about a point, pan, fit two world points, and the
//                         rules that keep a view inside the world
//   • the layout rules  — where off-view markers are pinned, how labels avoid
//                         each other, which marker a click lands on
//
// Phaser-free, DOM-free and canvas-free: plain numbers in, plain numbers out.
// It imports nothing from mapRender (mapRender imports this), so the module
// graph stays acyclic.
// ─────────────────────────────────────────────────────────────────────────────
import { WORLD_CONFIG } from '../core/Constants.ts';

/** Which world rectangle a map canvas shows. */
export interface MapView {
  /** World X at the canvas centre. */
  centerX: number;
  /** World Y at the canvas centre. */
  centerY: number;
  /** World px from the centre to the canvas edge (X). */
  radiusX: number;
  /** World px from the centre to the canvas edge (Y). */
  radiusY: number;
  /** Logical canvas width (px). */
  w: number;
  /** Logical canvas height (px). */
  h: number;
}

/** A canvas-space point, in logical (unscaled) pixels. */
export interface CanvasPoint {
  x: number;
  y: number;
}

/** World → canvas. */
export function toCanvas(view: MapView, wx: number, wy: number): CanvasPoint {
  return {
    x: ((wx - view.centerX) / (view.radiusX * 2) + 0.5) * view.w,
    y: ((wy - view.centerY) / (view.radiusY * 2) + 0.5) * view.h
  };
}

/** Canvas → world. Inverse of {@link toCanvas} (round-trips exactly). */
export function fromCanvas(view: MapView, mx: number, my: number): { x: number; y: number } {
  return {
    x: view.centerX + (mx / view.w - 0.5) * view.radiusX * 2,
    y: view.centerY + (my / view.h - 0.5) * view.radiusY * 2
  };
}

/** True when a canvas point is inside the view (with an optional margin). */
export function inCanvas(view: MapView, p: CanvasPoint, pad = 0): boolean {
  return p.x >= -pad && p.x <= view.w + pad && p.y >= -pad && p.y <= view.h + pad;
}

/** World px per canvas px (the map's scale). */
export function scaleOf(view: MapView): number {
  return (view.radiusX * 2) / Math.max(1, view.w);
}

// ── Frame budget ────────────────────────────────────────────────────────────

/** Terrain sample budget: one map frame never samples more cells than this. */
export const MAP_CELL_BUDGET = 9000;

/**
 * Cell size (logical px) for a map frame. A zoomed-in view wants a fixed WORLD
 * density so hills and shores keep their shape; but the cell count then explodes
 * as the view widens — at full-world zoom the old rule asked for ~39 000 cells
 * per repaint and dragging stalled. The budget is the cap: the cell grows until
 * the whole frame fits inside `MAP_CELL_BUDGET`.
 */
export function mapCellSize(view: MapView, cellWorld: number, budget = MAP_CELL_BUDGET): number {
  const w = Math.max(1, view.w);
  const h = Math.max(1, view.h);
  const raw = (cellWorld * w) / Math.max(1, view.radiusX * 2);
  const min = Math.max(2, Math.ceil(Math.sqrt((w * h) / Math.max(1, budget))));
  return Math.max(min, Math.min(26, Math.round(raw)));
}

// ── The minimap's window ────────────────────────────────────────────────────

/** World px from the minimap's centre to its edge at zoom 1. */
export const MINIMAP_BASE_RADIUS = 2200;

/**
 * The minimap's logical canvas size: ONE owner for the painter and for the
 * click handler that converts a click back into a world point (a click is only
 * truthful if both agree on the rectangle and the scale).
 */
export const MINIMAP_SIZE = { w: 240, h: 170 } as const;

/** Minimap zoom → view radius. The ONE owner: the painter and the click handler
 * both read it, so a click always charts the world point the player saw. */
export function minimapViewRadius(zoom: number): number {
  const z = Number.isFinite(zoom) && zoom > 0 ? Math.min(6, Math.max(0.25, zoom)) : 1;
  return MINIMAP_BASE_RADIUS / z;
}

/**
 * The minimap's view: a player-centred window on the SAME map the panel draws,
 * at the minimap's own scale and the canvas's aspect. It is a window, not a
 * second map — which is why the rule lives here instead of in the painter.
 */
export function minimapView(px: number, py: number, zoom: number, w: number, h: number): MapView {
  const r = minimapViewRadius(zoom);
  return {
    centerX: Number.isFinite(px) ? px : 0,
    centerY: Number.isFinite(py) ? py : 0,
    radiusX: r,
    radiusY: r * (Math.max(1, h) / Math.max(1, w)),
    w, h
  };
}

/** World px per canvas px vertically (views keep the canvas aspect, but be exact). */
export function scaleYOf(view: MapView): number {
  return (view.radiusY * 2) / Math.max(1, view.h);
}

/** Keep the view's centre inside the world so a pan can never lose the map. */
export function clampView(view: MapView): MapView {
  const limit = WORLD_CONFIG.worldHalfExtent;
  return {
    ...view,
    centerX: Math.max(-limit, Math.min(limit, view.centerX)),
    centerY: Math.max(-limit, Math.min(limit, view.centerY))
  };
}

/**
 * Zoom about a canvas point: the world position under `(mx, my)` stays put, so a
 * wheel zoom stays anchored to whatever the cursor is over (the rule every map
 * satisfies) instead of dragging the world toward the centre.
 */
export function zoomAt(view: MapView, factor: number, mx: number, my: number): MapView {
  const f = Math.max(0.05, Math.min(20, factor));
  if (!Number.isFinite(f) || f === 1) return view;
  const before = fromCanvas(view, mx, my);
  const next: MapView = {
    ...view,
    radiusX: view.radiusX / f,
    radiusY: view.radiusY / f
  };
  const after = toCanvas(next, before.x, before.y);
  return clampView({
    ...next,
    centerX: next.centerX + (after.x - mx) * scaleOf(next),
    centerY: next.centerY + (after.y - my) * scaleYOf(next)
  });
}

/** Pan by a canvas delta (drag): dragging right moves the world left, like paper. */
export function panBy(view: MapView, dxCanvas: number, dyCanvas: number): MapView {
  return clampView({
    ...view,
    centerX: view.centerX - dxCanvas * scaleOf(view),
    centerY: view.centerY - dyCanvas * scaleYOf(view)
  });
}

/**
 * A view that shows every given world point with `pad` world px of breathing
 * room — "fit the journey" (player → waypoint) and "show me home again".
 * The canvas aspect is preserved (the tighter axis wins).
 */
export function fitView(
  points: ReadonlyArray<{ x: number; y: number }>,
  w: number,
  h: number,
  pad = 400,
  minRadiusX = 1200,
): MapView {
  const aspect = h / Math.max(1, w);
  const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid.length) {
    const rx = 7000;
    return { centerX: 0, centerY: 0, radiusX: rx, radiusY: rx * aspect, w, h };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of valid) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const needX = (maxX - minX) / 2 + pad;
  const needY = (maxY - minY) / 2 + pad;
  const rx = Math.max(minRadiusX, needX, needY / aspect);
  return clampView({
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    radiusX: rx,
    radiusY: rx * aspect,
    w, h
  });
}

/** A round number a human reads off a scale bar: 1/2/5 × 10ⁿ (0 for nonsense). */
export function niceScaleStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

// ── Markers ─────────────────────────────────────────────────────────────────

/**
 * Marker kinds the map language knows. There is deliberately no "enemy" kind: a
 * map records places, it is not a tracker. A map and a radar are different
 * instruments, and this game shows the same map both times.
 */
export type MapMarkerKind = 'poi' | 'home' | 'building' | 'player' | 'waypoint';

/** Shapes a marker can take (the POI subset is decided by `poiStyle`). */
export type MarkerShape = 'dot' | 'camp' | 'boss' | 'home' | 'player' | 'waypoint' | 'building';

/** One thing the map draws. Built by `mapRender.buildMapMarkers`, drawn here. */
export interface MapMarker {
  id: string;
  kind: MapMarkerKind;
  x: number;
  y: number;
  /** Player-facing name; absent means "marker only, no label". */
  label?: string;
  shape: MarkerShape;
  color: string;
  /** Higher wins a contested label and a hover pick. */
  priority: number;
  /**
   * Pin to the frame edge when off-view even where clamping is off. This is the
   * difference between the two surfaces: the panel pins everything ("that place
   * is north-east of here"), while the minimap drops what it cannot show — a
   * tactical window stays truthful — except the markers you are navigating BY
   * (home, the tracked waypoint), which are exactly the ones you need a bearing
   * for. A map that tells you which way home lies is still a map.
   */
  pin?: boolean;
}

/** The marker-relevant slice of game state (gathered by each host). */
export interface MapMarkerSource {
  player: { x: number; y: number };
  /** Founded settlement position, if any. */
  settlement?: { x: number; y: number } | null;
  /** Completed buildings (already sliced by the host). */
  buildings?: ReadonlyArray<{ x: number; y: number }>;
  /** Discovered or owned POIs. */
  pois?: ReadonlyArray<{ id: string; name?: string; x: number; y: number; kind?: string; boss?: unknown; npc?: unknown }>;
  /** Ids the player owns (gold marker + safe language). */
  ownedIds?: ReadonlyArray<string>;
  /** Active navigation target. */
  waypoint?: { x: number; y: number; label?: string } | null;
}

/** A marker plus where it landed on the canvas (and whether it was pinned). */
export interface PlacedMarker {
  marker: MapMarker;
  x: number;
  y: number;
  /** True when the marker is outside the view and was pinned to the frame. */
  off: boolean;
}

/**
 * Place markers on the canvas. Outside markers are pinned inside `margin` — a
 * map always tells you which direction a place lies in — unless `clamp` is off,
 * which is what the minimap uses to stay a truthful view of the same rectangle.
 * With clamping off a marker can still opt in per-marker with `pin` (home and
 * the tracked waypoint do), so the window stays truthful WITHOUT losing the
 * bearings that are the whole point of a corner map.
 */
export function placeMarkers(
  markers: ReadonlyArray<MapMarker>,
  view: MapView,
  margin = 14,
  clamp = true,
): PlacedMarker[] {
  const out: PlacedMarker[] = [];
  for (const m of markers) {
    const p = toCanvas(view, m.x, m.y);
    if (inCanvas(view, p, 0)) { out.push({ marker: m, x: p.x, y: p.y, off: false }); continue; }
    if (!clamp && !m.pin) continue;
    out.push({
      marker: m,
      x: Math.max(margin, Math.min(view.w - margin, p.x)),
      y: Math.max(margin, Math.min(view.h - margin, p.y)),
      off: true
    });
  }
  return out;
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** A label rectangle that has been accepted for drawing. */
export interface LabelRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  anchorX: number;
  anchorY: number;
}

export interface LabelCandidate {
  id: string;
  text: string;
  anchorX: number;
  anchorY: number;
  color: string;
  priority: number;
}

/** Approximate text width for the map label font (no canvas needed). */
export function labelWidth(text: string, size: number): number {
  return Math.round(text.length * size * 0.56) + 2;
}

/**
 * Greedy label declutter: highest priority first, then left-to-right, keeping a
 * label only when its box touches no accepted box. This is the rule that stops
 * "Ashen Village" printing over "Hunter's Rest" when both are on screen — and it
 * is pure, so the rule is tested rather than eyeballed.
 */
export function layoutLabels(
  candidates: ReadonlyArray<LabelCandidate>,
  w: number,
  h: number,
  margin = 6,
  size = 10,
  markerBox = 13,
): LabelRect[] {
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  const out: LabelRect[] = [];
  const sorted = [...candidates].sort((a, b) => (b.priority - a.priority) || (a.anchorX - b.anchorX));
  for (const c of sorted) {
    if (!c.text) continue;
    const lw = labelWidth(c.text, size);
    const lh = size + 2;
    // Preferred spots, in order: right of the marker, left of it, above, below.
    const spots: Array<[number, number]> = [
      [c.anchorX + markerBox, c.anchorY - lh / 2],
      [c.anchorX - markerBox - lw, c.anchorY - lh / 2],
      [c.anchorX - lw / 2, c.anchorY - markerBox - lh],
      [c.anchorX - lw / 2, c.anchorY + markerBox]
    ];
    for (const [sx, sy] of spots) {
      const x = Math.max(margin, Math.min(w - margin - lw, sx));
      const y = Math.max(margin, Math.min(h - margin - lh, sy));
      const box = { x, y, w: lw, h: lh };
      if (boxes.some((b) => !(box.x + box.w < b.x || b.x + b.w < box.x || box.y + box.h < b.y || b.y + b.h < box.y))) continue;
      boxes.push(box);
      out.push({ id: c.id, x, y, w: lw, h: lh, text: c.text, color: c.color, anchorX: c.anchorX, anchorY: c.anchorY });
      break;
    }
  }
  return out;
}

// ── Region labels ───────────────────────────────────────────────────────────

/** What the map says about a region: its name, and whether it is still a rumour. */
export interface RegionDisplay {
  name: string;
  known: boolean;
}

/** Has the player stood in this region? Accepts a set (the panel) or a list. */
function wasVisited(ids: ReadonlySet<string> | ReadonlyArray<string>, id: string): boolean {
  const asSet = ids as ReadonlySet<string>;
  return typeof asSet.has === 'function' ? asSet.has(id) : (ids as ReadonlyArray<string>).includes(id);
}

/**
 * The map's region rule. A region is NAMED once the player has stood in it (its
 * waypoint is unlocked by arriving); ground that is merely close by is only
 * *rumoured* — a muted label, so exploration has a target without the map
 * handing over coordinates for places the player has never been. Anything
 * further away draws nothing at all, which is what keeps the frontier dark.
 */
export function regionDisplay(
  region: { id?: string; name: string; x: number; y: number; radius?: number },
  player: { x: number; y: number },
  visitedIds: ReadonlySet<string> | ReadonlyArray<string> = [],
): RegionDisplay | null {
  const id = region.id || '';
  const visited = wasVisited(visitedIds, id);
  if (visited) return { name: region.name, known: true };
  const radius = Number(region.radius) || 0;
  const reach = radius > 0 ? radius * 1.6 : 3000;
  const near = Math.hypot(region.x - player.x, region.y - player.y) <= reach;
  return near ? { name: `${region.name} — rumoured`, known: false } : null;
}

// ── Hover / picking ─────────────────────────────────────────────────────────

/**
 * The marker under a canvas point (hover and click-to-track). `tol` is the grab
 * radius in canvas px; ties break on priority, so the overlap of Home and a camp
 * names Home.
 */
export function pickMarker(
  placed: ReadonlyArray<PlacedMarker>,
  mx: number,
  my: number,
  tol = 10,
): MapMarker | null {
  let best: MapMarker | null = null;
  let bestD = Infinity;
  for (const p of placed) {
    const d = Math.hypot(p.x - mx, p.y - my);
    if (d > tol) continue;
    if (d < bestD - 0.001 || (Math.abs(d - bestD) <= 0.001 && p.marker.priority > (best?.priority ?? -1))) {
      best = p.marker;
      bestD = d;
    }
  }
  return best;
}

/** What a hover/readout resolves to at a canvas point. */
export interface HoverInfo {
  /** Cursor world position. */
  world: { x: number; y: number };
  /** Place name under the cursor, when it is on a marker or its label. */
  place: string | null;
  /** True when the hovered world position is inside an explored chunk. */
  explored: boolean;
}

/** Resolve a hover: cursor → world position + whatever the map knows about it. */
export function resolveHover(
  view: MapView,
  placed: ReadonlyArray<PlacedMarker>,
  labels: ReadonlyArray<LabelRect>,
  mx: number,
  my: number,
  isExploredAt: (wx: number, wy: number) => boolean,
  tol = 10,
): HoverInfo {
  const world = fromCanvas(view, mx, my);
  const onMarker = pickMarker(placed, mx, my, tol);
  const onLabel = onMarker ? null : labels.find((l) => mx >= l.x && mx <= l.x + l.w && my >= l.y && my <= l.y + l.h);
  return {
    world,
    place: onMarker?.label || onLabel?.text || null,
    explored: isExploredAt(world.x, world.y)
  };
}
