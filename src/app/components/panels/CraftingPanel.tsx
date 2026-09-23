// CraftingPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { getItem } from '../../../game/data/items.ts';
import { countItem } from '../../../game/systems/InventorySystem.ts';
import { craft, recipesForUI } from '../../../game/systems/CraftingSystem.ts';
import type { RecipeUI } from './types.ts';
import type { CraftQueueState } from './types.ts';
import { Icon } from './shared.tsx';
import { uiSession } from './shared.tsx';

/* ── Crafting ───────────────────────────────────────────────────────────── */
// Phase C: timed craft queue (weapons/dawnbreaker take real seconds with a
// progress bar + cancel), Shift-click batch for process recipes, station
// radius preview on hover, and vs-equipped compare lines.
export function CraftingPanel(): JSX.Element {
  const [cat, setCat] = useState<string>('all');
  const [queue, setQueue] = useState<CraftQueueState | null>(null); // { id, name, total, done }
  const queueRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recipes = useGameState([CH.INVENTORY, CH.WORLD], () => {
    try { return recipesForUI(cat); } catch { return []; }
  }) as RecipeUI[];

  const clearQueue = (): void => {
    if (queueRef.current) clearInterval(queueRef.current);
    queueRef.current = null;
    setQueue(null);
  };
  useEffect(() => clearQueue, []);

  const finishQueued = (id: string): void => {
    clearQueue();
    const r: any = craft(id);
    if (!r.ok) GameState.toast({ title: 'Cannot craft', msg: r.reason, kind: 'warn', icon: undefined });
  };

  const doCraft = (r: RecipeUI, shiftKey: boolean): void => {
    if (queue) return; // one at a time — finish or cancel first
    if (r.cat === 'process' && shiftKey) {
      const res: any = craft(r.id, { batch: 5 });
      if (!res.ok) GameState.toast({ title: 'Cannot craft', msg: res.reason, kind: 'warn', icon: undefined });
      return;
    }
    // Slow crafts (>2s) run on a visible timer; cancel is free because
    // resources are only spent when the timer completes.
    if ((r.durSec || 0) >= 2) {
      const total: number = Math.max(1, Math.round((r.durSec ?? 0) * 1000));
      const started: number = Date.now();
      setQueue({ id: r.id, name: r.def?.name || r.id, total, done: 0 });
      queueRef.current = setInterval(() => {
        const done: number = Date.now() - started;
        if (done >= total) finishQueued(r.id);
        else setQueue({ id: r.id, name: r.def?.name || r.id, total, done });
      }, 80);
      return;
    }
    const res: any = craft(r.id);
    if (!res.ok) GameState.toast({ title: 'Cannot craft', msg: res.reason, kind: 'warn', icon: undefined });
  };

  const previewStation = (station: string | undefined): void => {
    if (station && uiSession.showStationRing) {
      try { uiSession.showStationRing(station); } catch { /* scene not ready */ }
    }
  };

  return (
    <div className="panel crafting-panel">
      <h2>Crafting</h2>
      {queue && (
        <div className="craft-queue">
          <span>⚒ {queue.name}… {Math.round((queue.done / queue.total) * 100)}%</span>
          <div className="craft-queue-bar"><div style={{ width: `${Math.min(100, (queue.done / queue.total) * 100)}%` }} /></div>
          <button className="craft-cancel" onClick={clearQueue}>Cancel</button>
        </div>
      )}
      <div className="recipe-tabs">
        {['all', 'survival', 'cooking', 'tools', 'weapons', 'armor', 'process', 'special'].map((c) => (
          <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="recipe-grid">
        {recipes.map((r) => {
          const affordable: boolean = !r.reason && !queue;
          return (
            <button
              key={r.id}
              className={`recipe ${affordable ? '' : 'locked'}`}
              onClick={(e) => doCraft(r, e.shiftKey)}
              onMouseEnter={() => previewStation(r.station)}
              disabled={!affordable}
              title={r.cat === 'process' ? 'Shift-click: craft ×5 batch' : undefined}
            >
              <Icon id={r.out} size={34} />
              <div className="recipe-body">
                <b>{r.def?.name}</b>
                {(r.durSec || 0) >= 2 && <span className="craft-time"> ⏱ {r.durSec}s</span>}
                <div className="recipe-cost">
                  {Object.entries(r.cost).map(([id, n]) => (
                    <span key={id} className={countItem(id) >= n ? 'have' : 'need'}>{getItem(id)?.name}×{n}</span>
                  ))}
                </div>
                {r.compare && r.compare.equippedId && (
                  <span className="compare-line">
                    vs equipped: <span className={(r.compare.dmgDelta ?? r.compare.armorDelta ?? 0) >= 0 ? 'have' : 'need'}>
                      {(r.compare.dmgDelta ?? r.compare.armorDelta ?? 0) >= 0 ? '+' : ''}
                      {r.compare.dmgDelta != null ? `${r.compare.dmgDelta} dmg` : `${r.compare.armorDelta} armor`}
                    </span>
                    {(r.compare.critDelta ?? 0) !== 0 && <span> {(r.compare.critDelta ?? 0) > 0 ? '+' : ''}{((r.compare.critDelta ?? 0) * 100).toFixed(0)}% crit</span>}
                  </span>
                )}
                {r.compare && !r.compare.equippedId && r.compare.note && (
                  <span className="compare-line">{r.compare.note} — pure upgrade</span>
                )}
                {r.reason && <em className="locked-reason">{r.reason}</em>}
              </div>
              <span className="craft-btn">⚒</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
