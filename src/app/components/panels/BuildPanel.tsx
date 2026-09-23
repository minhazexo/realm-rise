// BuildPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import { useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { getItem } from '../../../game/data/items.ts';
import { countItem } from '../../../game/systems/InventorySystem.ts';
import { BUILDINGS, BUILDING_CATS, getBuildingDef } from '../../../game/data/buildings.ts';
import { sceneCommand } from '../../../game/main.ts';
import type { BuildingDef } from './types.ts';
import { close } from './shared.tsx';

/* ── Build ──────────────────────────────────────────────────────────────── */
export function BuildPanel(): JSX.Element {
  const [cat, setCat] = useState<string>('all');
  const data = useGameState([CH.SETTLEMENT, CH.INVENTORY], () => ({
    founded: GameState.s?.settlement?.founded,
    stage: GameState.s?.settlement?.stageIndex,
    citizens: GameState.s?.settlement?.citizens?.length,
    count: (k: string): number => GameState.s?.settlement?.buildings?.filter((b: { key?: string; complete?: boolean }) => b.key === k && b.complete).length || 0
  })) as { founded?: boolean; stage: number; citizens?: number; count: (k: string) => number };
  const catMap: Record<string, string[]> = {
    all: Object.keys(BUILDINGS),
    survival: ['campfire', 'tent'],
    residential: ['hut', 'house'],
    resource: ['storage_chest', 'farm', 'woodcutter', 'mine'],
    production: ['forge', 'tannery', 'kitchen', 'workshop'],
    military: ['watchtower', 'barracks', 'archery_range', 'stable', 'fortress'],
    defense: ['wall', 'gate'],
    government: ['townhall'],
    special: ['market', 'temple', 'library']
  };
  const list = (catMap[cat] || []).map((k: string) => BUILDINGS[k]) as BuildingDef[];

  const place = (key: string): void => {
    const def: any = getBuildingDef(key);
    if (def.requiresStage && data.stage < def.requiresStage) {
      GameState.toast({ title: def.label, msg: 'Your realm is not ready for this yet.', kind: 'warn', icon: undefined });
      return;
    }
    close();
    sceneCommand('placeBuild', key);
  };

  return (
    <div className="panel build-panel">
      <h2>Build</h2>
      <div className="recipe-tabs">
        {(BUILDING_CATS as string[]).map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="build-grid">
        {list.map((def) => {
          const have: number = data.count(def.key);
          const afford: boolean = Object.entries(def.cost).every(([id, n]: [string, number]) => countItem(id) >= n);
          return (
            <button key={def.key} className={`build-card ${afford ? '' : 'locked'}`} onClick={() => place(def.key)}>
              <b>{def.label}</b>
              <span className="build-cost">
                {Object.entries(def.cost).map(([id, n]: [string, number]) => (
                  <span key={id} className={countItem(id) >= n ? 'have' : 'need'}>{getItem(id)?.name}×{n}</span>
                ))}
              </span>
              <em>{def.desc}</em>
              {have > 0 && <span className="have-count">Owned: {have}</span>}
            </button>
          );
        })}
      </div>
      {!data.founded && <div className="build-hint">Found your realm: place a <b>Town Hall</b> using your Founder's Kit or by building one.</div>}
    </div>
  );
}
