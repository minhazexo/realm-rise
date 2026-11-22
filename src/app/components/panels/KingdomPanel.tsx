// KingdomPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { militaryPowerTotal, stageRequirementsMissing, territoryPct, assignWorker } from '../../../game/systems/economy/KingdomSystem.ts';
import { canRecruitUnit, recruitUnit } from '../../../game/systems/world/KingdomEconomy.ts';
import { repairBuilding } from '../../../game/systems/economy/BuildSystem.ts';
import { getBuildingDef } from '../../../game/data/buildings.ts';
import { MILITARY_CONFIG } from '../../../game/core/Constants.ts';
import type { CitizenInfo } from './types.ts';
import { uiSession } from './shared.tsx';

/* ── Kingdom ────────────────────────────────────────────────────────────── */
export function KingdomPanel(): JSX.Element | null {
  const k = useGameState([CH.SETTLEMENT, CH.PLAYER, CH.FACTIONS, CH.INVENTORY], () => {
    const S: any = GameState.s;
    const K: any = uiSession.kingdom || {};
    const citizens: CitizenInfo[] = S?.settlement?.citizens || [];
    const buildings: any[] = S?.settlement?.buildings || [];
    const selectedBuilding: string | null = (GameState.session as any)?.selectedBuilding ?? null;
    const req: any = (() => { try { return stageRequirementsMissing(); } catch { return {}; } })();
    const pct: number = (() => { try { return territoryPct(); } catch { return 0; } })();
    return { S, K, citizens, buildings, selectedBuilding, req, pct, mil: { ...S?.settlement?.military }, founded: S?.settlement?.founded };
  }) as { S: any; K: any; citizens: CitizenInfo[]; buildings: any[]; selectedBuilding: string | null; req: any; pct: number; mil: Record<string, number>; founded?: boolean } | null;
  if (!k || !k.S) return null;

  const doRepair = (uid: string): void => {
    const b = (k.buildings || []).find((x: any) => x.uid === uid);
    if (!b) return;
    import('../../../game/main.ts').then((m: any) => {
      try {
        const scene = m.worldScene?.();
        if (scene) repairBuilding(scene, b);
      } catch { /* repair never crashes the panel */ }
    }).catch(() => {});
  };
  const doAssign = (citizenUid: string, buildingUid: string): void => {
    try {
      assignWorker(buildingUid, citizenUid || null);
    } catch { /* assignment never crashes the panel */ }
  };

  const stageName: string = ['Wanderer','Camp','Village','Town','City','Kingdom','Empire'][k.S.settlement.stageIndex + 1] ?? '';

  return (
    <div className="panel kingdom-panel">
      <div className="k-header">
        <h2>Your Realm — <span className="gold">{k.founded ? stageName : 'Unfounded'}</span></h2>
        {!k.founded && <p>Found a settlement to begin your kingdom. Build a Town Hall.</p>}
      </div>
      {k.founded && <>
        <div className="k-grid">
          <div className="k-stat">👥 <b>{k.S.settlement.citizens.length}</b> <em>People</em></div>
          <div className="k-stat">🍞 <b>{k.K.foodUnits ?? 0}</b> <em>Food ({k.K.foodDays ?? '—'} days)</em></div>
          <div className="k-stat">😊 <b>{k.S.settlement.happiness}</b> <em>Happiness</em></div>
          <div className="k-stat">🪙 <b>{k.S.player.gold}</b> <em>Gold</em></div>
          <div className="k-stat">🛡 <b>{k.K.defenseStructural ?? 0}</b> <em>Defense</em></div>
          <div className="k-stat">⚔ <b>{militaryPowerTotal()}</b> <em>Military</em></div>
          <div className="k-stat">🗺 <b>{k.pct}%</b> <em>Territory</em></div>
          <div className="k-stat">♛ <b>{k.S.player.reputation}</b> <em>Reputation</em></div>
        </div>

        {k.req && k.req.missing?.length > 0 && (
          <div className="stage-req">
            <h4>To next stage ({['','Village','Town','City','Kingdom','Empire','—'][k.S.settlement.stageIndex + 1]}):</h4>
            <ul>{k.req.missing.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
        <h3>Army</h3>
        <div className="army-row">
          {Object.keys(MILITARY_CONFIG.types).map((type) => {
            const cfg: any = MILITARY_CONFIG.types[type as keyof typeof MILITARY_CONFIG.types];
            const chk: any = canRecruitUnit(type);
            return (
              <button key={type} className="army-unit" onClick={() => recruitUnit(type)} disabled={!chk.ok}>
                <b>{type}</b>
                <span>{k.mil[type] || 0} · ⚔{cfg.power}</span>
                {!chk.ok && <em>{chk.reason}</em>}
              </button>
            );
          })}
        </div>
        <h3>People</h3>
        <div className="citizen-list">
          {k.citizens.map((c) => {
            const held = (k.buildings || []).find((b: any) => b.workerUid === c.uid);
            return (
              <div key={c.uid} className="citizen">
                <b>{c.name}</b> <span>{c.role} · ♥{(c.skillLv ?? 1) * 10}</span>
                <select
                  aria-label={`Assign ${c.name}`}
                  value={held?.uid || ''}
                  onChange={(e) => {
                    const to: string = (e.target as HTMLSelectElement).value;
                    if (held) doAssign(held.uid, '');
                    if (to) doAssign(to, c.uid || '');
                  }}
                >
                  <option value="">Unassigned</option>
                  {(k.buildings || []).filter((b: any) => b.complete).map((b: any) => (
                    <option key={b.uid} value={b.uid}>
                      {(getBuildingDef(b.key)?.label || b.key) + (b.workerUid && b.workerUid !== c.uid ? ' (taken)' : '')}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        {k.selectedBuilding && (() => {
          const b = (k.buildings || []).find((x: any) => x.uid === k.selectedBuilding);
          if (!b) return null;
          const def: any = getBuildingDef(b.key);
          const maxHp: number = def?.hp || 100;
          const hp: number = b.hp ?? maxHp;
          const full: boolean = hp >= maxHp;
          return (
            <div className="selected-building">
              <h3>Selected: {def?.label || b.key}</h3>
              <div>Integrity {Math.round(hp)}/{maxHp} ({Math.round((hp / maxHp) * 100)}%)</div>
              <button className="btn btn-small" disabled={full} onClick={() => b.uid && doRepair(b.uid)}>
                {full ? 'Pristine' : 'Repair (1 Wood + 1 Stone)'}
              </button>
            </div>
          );
        })()}
      </>}
    </div>
  );
}
