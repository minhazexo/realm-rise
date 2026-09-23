// MapPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { MAP_VIEW_RADIUS, clearWaypoint, mapPoint, setWaypoint } from '../../../game/systems/NavigationSystem.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { allPois, setWorldSeed } from '../../../game/world/worldGen.ts';
import { BIOMES } from '../../../game/world/biomeTable.ts';
import { drawMapTerrain, poiStyle } from '../../../game/world/mapRender.ts';
import { territoryPct } from '../../../game/systems/KingdomSystem.ts';
import { statusOf } from '../../../game/systems/FactionSystem.ts';
import { FACTIONS } from '../../../game/data/factions.ts';
import type { PoiInfo } from './types.ts';
import type { FactionInfo } from './types.ts';

/* ── Map (live canvas: same shared renderer as the minimap) ── */
const MM_LEGEND: string[][] = Object.values(BIOMES).map((b: { grass: string; label: string }) => [b.grass, b.label]);

interface MapPanelData {
  pois: PoiInfo[];
  factions: FactionInfo[];
  owned: number;
  knownIds: string[];
  ownedIds: string[];
  pct: number;
  settlement: { x: number; y: number } | null;
  px: number;
  py: number;
  seed: number;
  explored: string[];
  buildings: { x: number; y: number }[];
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
      knownIds: [...known], ownedIds: [...owned],
      pct: (() => { try { return territoryPct(); } catch { return 0; } })(),
      settlement: S?.settlement?.founded ? { x: Math.round(S.settlement.pos?.x ?? 0), y: Math.round(S.settlement.pos?.y ?? 0) } : null,
      px: S?.world?.px ?? 0, py: S?.world?.py ?? 0,
      seed: S?.meta?.seed ?? 1,
      explored: [...(S?.world?.exploredChunks || [])],
      buildings: (S?.settlement?.buildings || []).filter((b: { complete?: boolean }) => b.complete).slice(0, 60).map((b: { x: number; y: number }) => ({ x: b.x, y: b.y })),
    };
  }) as MapPanelData;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Paint the live world map: shared terrain renderer + synced markers.
  useEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas) return;
    try { setWorldSeed(data.seed); } catch { /* ignore */ }
    const LW = 520, LH = 300;
    if (canvas.width !== LW * 2) { canvas.width = LW * 2; canvas.height = LH * 2; }
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    const cx: number = data.settlement?.x ?? data.px;
    const cy: number = data.settlement?.y ?? data.py;
    const viewRadius = MAP_VIEW_RADIUS;
    const explored = new Set<string>(data.explored);
    const bg: CanvasGradient = ctx.createLinearGradient(0, 0, 0, LH);
    bg.addColorStop(0, '#0d1322');
    bg.addColorStop(1, '#080c15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, LW, LH);
    try {
      drawMapTerrain(ctx, {
        centerX: cx, centerY: cy, viewRadius, w: LW, h: LH,
        cell: 13, explored, chunkSize: 512, shimmer: 0,
      });
    } catch { /* terrain never blocks the panel */ }
    const X = (wx: number): number => ((wx - cx) / (viewRadius * 2) + 0.5) * LW;
    const Y = (wy: number): number => ((wy - cy) / (viewRadius * 2) + 0.5) * LH;
    const inView = (mx: number, my: number): boolean => mx >= 0 && mx <= LW && my >= 0 && my <= LH;
    // Buildings: tiny gold ticks.
    try {
      ctx.fillStyle = '#d8b64a';
      for (const b of data.buildings) {
        const mx = X(b.x), my = Y(b.y);
        if (inView(mx, my)) ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    } catch { /* ignore */ }
    // POIs with the shared shape language; off-view ones clamp to the edge.
    const owned = new Set<string>(data.ownedIds);
    try {
      for (const p of data.pois) {
        let mx = X(p.x), my = Y(p.y);
        const off = !inView(mx, my);
        mx = Math.max(10, Math.min(LW - 10, mx));
        my = Math.max(12, Math.min(LH - 10, my));
        const { shape, color }: { shape: string; color: string } = poiStyle(p as any, owned.has(p.id));
        ctx.globalAlpha = off ? 0.55 : 1;
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.2;
        if (shape === 'boss') {
          ctx.beginPath();
          ctx.moveTo(mx, my - 6); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 6); ctx.lineTo(mx - 6, my);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (shape === 'camp') {
          ctx.beginPath();
          ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 5, my + 4); ctx.lineTo(mx - 5, my + 4);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    } catch { /* ignore */ }
    // Settlement + player.
    try {
      if (data.settlement) {
        const mx = X(data.settlement.x), my = Y(data.settlement.y);
        if (inView(mx, my)) {
          ctx.fillStyle = '#ffd66b';
          ctx.fillRect(mx - 4, my - 1, 8, 6);
          ctx.beginPath();
          ctx.moveTo(mx - 5.5, my - 1); ctx.lineTo(mx, my - 7); ctx.lineTo(mx + 5.5, my - 1);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
      const ux = X(data.px), uy = Y(data.py);
      if (inView(ux, uy)) {
        ctx.fillStyle = '#44ff88';
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(ux, uy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } catch { /* ignore */ }
    if (waypoint) {
      const mx = Math.max(10, Math.min(LW - 10, X(waypoint.x)));
      const my = Math.max(25, Math.min(LH - 10, Y(waypoint.y)));
      ctx.save(); ctx.strokeStyle = '#7ee8ef'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(X(data.px), Y(data.py)); ctx.lineTo(mx, my); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = '#122c38';
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', mx, my);
      ctx.restore();
    }
    // Compass + vignette.
    ctx.fillStyle = '#e8c94b';
    ctx.font = 'bold 13px serif';
    ctx.fillText('N', 10, 19);
    const vg: CanvasGradient = ctx.createRadialGradient(LW / 2, LH / 2, Math.min(LW, LH) * 0.42, LW / 2, LH / 2, Math.max(LW, LH) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, LW, LH);
  }, [data, waypoint]);
  return (
    <div className="panel map-panel">
      <h2>World Map</h2>
      <p className="map-note">Click the map to chart your next destination, or track a discovered location below.</p>
      <canvas ref={canvasRef} className="worldmap-canvas" width="1040" height="600" aria-label="World map: click to set waypoint" onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const point = mapPoint((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height,
          data.settlement?.x ?? data.px, data.settlement?.y ?? data.py);
        setWaypoint(point.x, point.y);
      }} />
      <div className="map-navigation-actions">
        {waypoint && <><span>✦ {waypoint.label} · {waypoint.x}, {waypoint.y}</span><button onClick={clearWaypoint}>Clear waypoint</button></>}
        {data.settlement && <button onClick={() => setWaypoint(data.settlement!.x, data.settlement!.y, 'Home')}>⌂ Track home</button>}
      </div>
      <div className="map-stats">
        <span>🗺 Territory: <b>{data.pct}%</b></span>
        <span>🏕 Camps held: <b>{data.owned}</b></span>
        {data.settlement && <span>🏠 Home: <b>{data.settlement.x}, {data.settlement.y}</b></span>}
      </div>
      <h3>Discovered ({data.pois.length})</h3>
      <div className="poi-list">
        {data.pois.length === 0 && <em>Explore to reveal the realm…</em>}
        {data.pois.map((p) => <div key={p.id} className="poi-row"><b>{p.name || p.id}</b> <span>{Math.round(p.x)}, {Math.round(p.y)}</span><button onClick={() => setWaypoint(p.x, p.y, p.name || p.id)} aria-label={`Track ${p.name || p.id}`}>Track</button></div>)}
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
      </div>
      <p className="map-note">Dark regions are unexplored — the map fills in as you travel.</p>
    </div>
  );
}
