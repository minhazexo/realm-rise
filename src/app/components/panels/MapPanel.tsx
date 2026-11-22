// MapPanel — the World Map: a pannable, zoomable frame on the ONE shared map.
//
// This panel draws nothing itself. It builds the state slice, owns the view
// (where you are looking) and the interaction rules, and calls
// `world/mapRender.drawWorldMap` — the same entry point the corner minimap
// uses, so the two surfaces are the same map at different scales.
//
// The rules this panel owns (the map's *behaviour*, as opposed to its language):
//   • drag pans; a click that did not drag charts a waypoint (a drag must never
//     drop a waypoint behind it)
//   • the wheel zooms about the CURSOR, so the place under the pointer stays put
//     (`mapView.zoomAt`), and every transform is clamped into the world
//   • the default frame is `MAP_VIEW_RADIUS` around home/the player; "fit world"
//     and "centre on me" are the two escape hatches from there
//   • hover is resolved by the shared composition path WITHOUT repainting the
//     terrain — a readout is a line of text, not a new frame
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { WORLD_CONFIG } from '../../../game/core/Constants.ts';
import { MAP_VIEW_RADIUS, clearWaypoint, setWaypoint } from '../../../game/systems/world/NavigationSystem.ts';
import { unlockedWaypoints } from '../../../game/systems/world/RegionTravel.ts';
import { regionAnchors } from '../../../game/systems/world/RegionRegistry.ts';
import { sceneCommand } from '../../../game/main.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { setWorldSeed } from '../../../game/world/worldGen.ts';
import { allPois } from '../../../game/systems/world/PoiRegistry.ts';
import { BIOMES } from '../../../game/world/biomeTable.ts';
import { drawWorldMap, resolveMapHover } from '../../../game/world/mapRender.ts';
import type { HoverInfo, MapSceneData, MapView } from '../../../game/world/mapRender.ts';
import { clampView, fromCanvas, panBy, zoomAt } from '../../../game/world/mapView.ts';
import { biomeNameAt } from '../../../game/world/mapTerrain.ts';
import { territoryPct } from '../../../game/systems/economy/KingdomSystem.ts';
import { statusOf } from '../../../game/systems/economy/FactionSystem.ts';
import { FACTIONS } from '../../../game/data/factions.ts';
import type { PoiInfo, FactionInfo } from './types.ts';

/* ── Map (live canvas: the shared renderer, one entry point) ── */
const MM_LEGEND: string[][] = Object.values(BIOMES).map((b: { grass: string; label: string }) => [b.grass, b.label]);
const LW = 520;
const LH = 300;
/** Smallest / largest half-height of the view, in world px. */
const MIN_RADIUS = 180;
const MAX_RADIUS = WORLD_CONFIG.worldHalfExtent * 2;
/** Terrain budget while a gesture is in flight, and how long after it settles. */
const COARSE_CELL_BUDGET = 3000;
const SETTLE_MS = 180;

interface MapPanelData {
  pois: PoiInfo[];
  factions: FactionInfo[];
  owned: number;
  ownedIds: string[];
  pct: number;
  settlement: { x: number; y: number } | null;
  px: number;
  py: number;
  /** Where the player is RIGHT NOW (camera centre), not the saved px/py. */
  live: { x: number; y: number };
  seed: number;
  explored: string[];
  buildings: { x: number; y: number }[];
  travel: { id: string; label: string; x: number; y: number }[];
  visited: string[];
  viewRect: { x: number; y: number; w: number; h: number } | null;
}

/** One clamp for every view mutation, so no gesture can lose the map. */
function limitView(v: MapView): MapView {
  const radiusX = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, v.radiusX));
  return clampView({ ...v, radiusX, radiusY: radiusX * (LH / LW), w: LW, h: LH });
}

/**
 * The frame the panel opens on: `MAP_VIEW_RADIUS` around home when there is one,
 * else around the player. "The player" is the camera centre the minimap
 * publishes, not the saved `world.px/py` — that pair is written on the scene's
 * 0.5 s cadence for saving, so a map centred on it can open a few hundred pixels
 * away from where the player is standing.
 */
function defaultView(data: MapPanelData): MapView {
  return limitView({
    centerX: data.settlement?.x ?? data.live.x,
    centerY: data.settlement?.y ?? data.live.y,
    radiusX: MAP_VIEW_RADIUS, radiusY: MAP_VIEW_RADIUS * (LH / LW), w: LW, h: LH
  });
}

export function MapPanel(): JSX.Element {
  const waypoint = useGameState([CH.MINIMAP], () => GameState.session.waypoint ?? null);
  const data = useGameState([CH.WORLD, CH.SETTLEMENT, CH.FACTIONS], () => {
    const S: any = GameState.s;
    const known = new Set<string>(S?.world?.discoveredPois || []);
    const owned = new Set<string>(S?.world?.ownedCamps || []);
    const pois: PoiInfo[] = (allPois() as unknown as PoiInfo[]).filter((p: PoiInfo) => known.has(p.id) || owned.has(p.id));
    const factions: FactionInfo[] = Object.keys(FACTIONS).map((k: string) => ({ key: k, name: FACTIONS[k]?.name, status: statusOf(k) }));
    return {
      pois, factions, owned: owned.size,
      ownedIds: [...owned],
      pct: (() => { try { return territoryPct(); } catch { return 0; } })(),
      settlement: S?.settlement?.founded ? { x: Math.round(S.settlement.pos?.x ?? 0), y: Math.round(S.settlement.pos?.y ?? 0) } : null,
      px: S?.world?.px ?? 0, py: S?.world?.py ?? 0,
      live: (() => {
        const v = (GameState.session as { viewRect?: { x: number; y: number; w: number; h: number } }).viewRect;
        return v && Number.isFinite(v.x) ? { x: v.x + v.w / 2, y: v.y + v.h / 2 } : { x: S?.world?.px ?? 0, y: S?.world?.py ?? 0 };
      })(),
      seed: S?.meta?.seed ?? 1,
      explored: [...(S?.world?.exploredChunks || [])],
      travel: unlockedWaypoints().map((w) => ({ id: w.region, label: w.label, x: Math.round(w.x), y: Math.round(w.y) })),
      visited: [...(S?.world?.unlockedFastTravel || [])],
      buildings: (S?.settlement?.buildings || []).filter((b: { complete?: boolean }) => b.complete).slice(0, 60).map((b: { x: number; y: number }) => ({ x: b.x, y: b.y })),
      viewRect: (GameState.session as any).viewRect || null
    };
  }) as MapPanelData;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const settleRef = useRef<number | null>(null);
  const [view, setView] = useState<MapView>(() => defaultView(data));
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // Sampling is the whole cost of a frame, so a gesture draws a coarser map and
  // the still frame is re-sampled at full detail once it settles.
  const [coarse, setCoarse] = useState(false);
  const markInteracting = useCallback((): void => {
    setCoarse(true);
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => setCoarse(false), SETTLE_MS);
  }, []);
  useEffect(() => () => { if (settleRef.current !== null) window.clearTimeout(settleRef.current); }, []);

  // The one state slice both the painter and the hover resolver read.
  const scene: MapSceneData = useMemo(() => ({
    player: { x: data.live.x, y: data.live.y },
    settlement: data.settlement,
    visitedRegions: data.visited,
    regions: regionAnchors().map((a) => ({ id: a.id, name: a.name, x: a.x, y: a.y, radius: a.radius })),
    pois: data.pois.map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, kind: (p as { kind?: string }).kind, boss: (p as { boss?: unknown }).boss, npc: (p as { npc?: unknown }).npc })),
    ownedIds: data.ownedIds,
    buildings: data.buildings,
    waypoint: waypoint ? { x: waypoint.x, y: waypoint.y, label: waypoint.label } : null,
    explored: new Set<string>(data.explored),
    viewRect: data.viewRect
  }), [data, waypoint]);

  // Paint the frame: the shared renderer at panel detail, nothing hand-drawn.
  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;
    try { setWorldSeed(data.seed); } catch { /* ignore */ }
    if (canvas.width !== LW * 2) { canvas.width = LW * 2; canvas.height = LH * 2; }
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    try {
      drawWorldMap(ctx, {
        view, data: scene, detail: 'full', clampMarkers: true,
        layers: { pois: true, labels: true, regions: true, grid: true, fog: true, resources: false, viewRect: true, chrome: true },
        highlightId,
        playerDir: (GameState.session as { playerDir?: string }).playerDir,
        tick: Math.floor(performance.now() / 120),
        cellBudget: coarse ? COARSE_CELL_BUDGET : undefined
      });
    } catch { /* the map never blocks the panel */ }
  }, [scene, view, highlightId, coarse, data.seed]);

  // Wheel zoom, anchored to the cursor: React's synthetic wheel is passive, so
  // the listener goes on the element to be allowed to preventDefault.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const mx = (e.clientX - rect.left) * (LW / rect.width);
      const my = (e.clientY - rect.top) * (LH / rect.height);
      const factor = Math.pow(1.0016, -e.deltaY);
      markInteracting();
      setView((v) => limitView(zoomAt(v, factor, mx, my)));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [markInteracting]);

  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: (e.clientX - rect.left) * (LW / rect.width), y: (e.clientY - rect.top) * (LH / rect.height) };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const p = canvasPoint(e);
    if (!p) return;
    dragRef.current = { id: e.pointerId, x: p.x, y: p.y, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const p = canvasPoint(e);
    if (!p) return;
    const drag = dragRef.current;
    if (drag && drag.id === e.pointerId) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      drag.x = p.x; drag.y = p.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 4) { markInteracting(); setView((v) => limitView(panBy(v, dx, dy))); }
      return;
    }
    // Readout only: resolved by the shared path, never by repainting the map.
    try {
      setHover(resolveMapHover(view, scene, p.x, p.y, { detail: 'full', clampMarkers: true }));
    } catch { /* a readout is optional */ }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current;
    dragRef.current = null;
    const p = canvasPoint(e);
    if (!drag || !p || drag.moved > 4) return;   // a drag is not a click
    const point = fromCanvas(view, p.x, p.y);
    setWaypoint(point.x, point.y);
  };

  const onPointerLeave = (): void => { dragRef.current = null; setHover(null); };

  const zoomBy = (factor: number): void => setView((v) => limitView(zoomAt(v, factor, LW / 2, LH / 2)));
  const fitWorld = (): void => setView(() => limitView({
    centerX: 0, centerY: 0, radiusX: MAX_RADIUS, radiusY: MAX_RADIUS * (LH / LW), w: LW, h: LH
  }));
  const centreOnMe = (): void => setView((v) => limitView({ ...v, centerX: data.live.x, centerY: data.live.y }));
  const trackPoi = (p: { id: string; name?: string; x: number; y: number }): void => {
    setWaypoint(p.x, p.y, p.name || p.id);
    setView((v) => limitView({ ...v, centerX: p.x, centerY: p.y }));
    setHighlightId(`poi:${p.id}`);
  };

  return (
    <div className="panel map-panel">
      <h2>World Map</h2>
      <p className="map-note">Drag to travel the map, wheel to zoom, click to chart a destination.</p>
      <div className="map-canvas-wrap">
        <canvas ref={canvasRef} className="worldmap-canvas" width={LW * 2} height={LH * 2}
          aria-label="World map: drag to pan, wheel to zoom, click to set a waypoint"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerLeave={onPointerLeave}
          onDoubleClick={centreOnMe} />
      </div>
      <div className="map-controls">
        <button onClick={() => zoomBy(1.4)} title="Zoom in" aria-label="Zoom in">＋</button>
        <button onClick={() => zoomBy(1 / 1.4)} title="Zoom out" aria-label="Zoom out">－</button>
        <button onClick={fitWorld} title="Show the whole realm" aria-label="Fit the whole world">Fit world</button>
        <button onClick={centreOnMe} title="Centre the map on the player" aria-label="Centre on the player">◎ Centre on me</button>
        <span className="map-readout" aria-live="polite">
          {hover
            ? `${hover.place ? `${hover.place} · ` : ''}${biomeNameAt(hover.world.x, hover.world.y)} · ${Math.round(hover.world.x)}, ${Math.round(hover.world.y)} · ${hover.explored ? 'explored' : 'uncharted'}`
            : 'Hover the map to read it'}
        </span>
      </div>
      <div className="map-navigation-actions">
        {waypoint && <><span>✦ {waypoint.label} · {waypoint.x}, {waypoint.y}</span><button onClick={clearWaypoint}>Clear waypoint</button></>}
        {data.settlement && <button onClick={() => setWaypoint(data.settlement!.x, data.settlement!.y, 'Home')}>⌂ Track home</button>}
      </div>
      <h3>Fast travel {data.travel.length > 0 ? `(${data.travel.length})` : ''}</h3>
      <div className="poi-list">
        {data.travel.length === 0 && <em>Stand in a region to unlock travelling back to it…</em>}
        {data.travel.map((t) => (
          <div key={t.id} className="poi-row">
            <b>{t.label}</b> <span>{t.x}, {t.y}</span>
            <button onClick={() => { setWaypoint(t.x, t.y, t.label); sceneCommand('regionTravel', t.id); }} aria-label={`Travel to ${t.label}`}>Travel</button>
          </div>
        ))}
      </div>
      <div className="map-stats">
        <span>🗺 Territory: <b>{data.pct}%</b></span>
        <span>🏕 Camps held: <b>{data.owned}</b></span>
        {data.settlement && <span>🏠 Home: <b>{data.settlement.x}, {data.settlement.y}</b></span>}
      </div>
      <h3>Discovered ({data.pois.length})</h3>
      <div className="poi-list">
        {data.pois.length === 0 && <em>Explore to reveal the realm…</em>}
        {data.pois.map((p) => (
          <div key={p.id} className="poi-row" onMouseEnter={() => setHighlightId(`poi:${p.id}`)} onMouseLeave={() => setHighlightId(null)}>
            <b>{p.name || p.id}</b> <span>{Math.round(p.x)}, {Math.round(p.y)}</span>
            <button onClick={() => trackPoi(p)} aria-label={`Track ${p.name || p.id} and centre the map on it`}>Locate</button>
          </div>
        ))}
      </div>
      <h3>Factions</h3>
      <div className="poi-list">
        {data.factions.map((f) => <div key={f.key} className="poi-row"><b>{f.name}</b> <span>{f.status}</span></div>)}
      </div>
      <h3>Legend</h3>
      <div className="mm-legend">
        {MM_LEGEND.map(([c, n]) => <span key={n}><i style={{ background: c }} />{n}</span>)}
        <span><i style={{ background: '#44ff88', borderRadius: '50%' }} />You</span>
        <span><i style={{ background: '#ff6b5a', transform: 'rotate(45deg)' }} />Boss</span>
        <span><i style={{ background: '#ff9a4a' }} />Bandit camp</span>
        <span><i style={{ background: '#7ae0ff', borderRadius: '50%' }} />Friend</span>
        <span><i style={{ background: '#ffd66b' }} />Held camp / home</span>
        <span><i style={{ background: '#7ee8ef', borderRadius: '50%' }} />Waypoint ✦</span>
      </div>
      <p className="map-note">Dark ground is unexplored and the dashed gold ring is a region you have stood in. Names are only revealed once you arrive; places nearby are still rumours, and the rest of the frontier is blank until you walk it. The dashed box is the patch of world the minimap is showing right now.</p>
    </div>
  );
}
