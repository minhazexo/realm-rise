// CharacterPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { RARITY, getItem } from '../../../game/data/items.ts';
import { equip, unequip } from '../../../game/systems/InventorySystem.ts';
import { spendStat, xpToNext } from '../../../game/systems/ProgressionSystem.ts';
import type { EquippedItem } from './types.ts';
import { Icon } from './shared.tsx';

/* ── Character ────────────────────────────────────────────────────────── */
interface CharacterSnapshot {
  name: string;
  level: number;
  xp: number;
  xpNext: number;
  statPoints: number;
  gold: number;
  reputation: number;
  hp: number;
  maxHp?: number;
  stamina: number;
  maxStamina?: number;
  alloc: Record<string, number>;
  profs: { k: string; lv: number }[];
  dmg: number;
  redux: number;
  eq: Record<string, EquippedItem | undefined>;
}

export function CharacterPanel(): JSX.Element | null {
  const c = useGameState([CH.PLAYER, CH.EQUIPMENT], () => {
    const p: any = GameState.s?.player;
    if (!p) return null;
    return {
      name: p.name, level: p.level, xp: p.xp, xpNext: xpToNext(p.level),
      statPoints: p.statPoints ?? 0,
      gold: p.gold, reputation: p.reputation,
      hp: Math.round(p.hp), maxHp: p.derived?.maxHp, stamina: Math.round(p.stamina), maxStamina: p.derived?.maxStamina,
      alloc: { ...p.alloc }, profs: Object.entries(p.professions || {}).map(([k, v]: [string, any]) => ({ k, lv: v?.lv ?? v ?? 1 })),
      dmg: Math.round((p.derived?.meleeDmgMult || 1) * 100), redux: Math.round((p.derived?.damageReduction || 0) * 100),
      eq: { ...p.equipment },
    };
  }) as CharacterSnapshot | null;
  if (!c) return null;

  const handleUnequip = (slot: string): void => {
    unequip(slot);
    import('../../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
    import('../../../game/main.ts').then((m: any) => m.worldScene()?.refreshPlayerSkin?.());
  };

  return (
    <div className="panel character-panel">
      <h2>{c.name} <span className="gold">Lv {c.level}</span></h2>
      <div style={{ margin: '4px 0 10px', fontSize: '12px', color: '#9fb4cc' }}>
        Experience: <b>{c.xp}</b> / <b>{c.xpNext}</b> XP
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden', marginTop: 4 }}>
          <div style={{ background: '#ffd66b', height: '100%', width: `${Math.min(100, Math.round((c.xp / (c.xpNext || 1)) * 100))}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>
      <div className="k-grid">
        <div className="k-stat">❤ <b>{c.hp}/{c.maxHp}</b> <em>Health</em></div>
        <div className="k-stat">⚡ <b>{c.stamina}/{c.maxStamina}</b> <em>Stamina</em></div>
        <div className="k-stat">🪙 <b>{c.gold}</b> <em>Gold</em></div>
        <div className="k-stat">♛ <b>{c.reputation}</b> <em>Renown</em></div>
        <div className="k-stat">⚔ <b>{c.dmg}%</b> <em>Melee</em></div>
        <div className="k-stat">🛡 <b>{c.redux}%</b> <em>Resist</em></div>
      </div>
      <h3>Equipped Gear</h3>
      <div className="equip-strip" style={{ marginBottom: 12 }}>
        {['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet'].map((slot) => {
          const eq: EquippedItem | undefined = c.eq[slot];
          const def: any = eq ? getItem(eq.id) : null;
          return (
            <button key={slot} className="eq-slot" onClick={() => eq && handleUnequip(slot)} title={eq ? `Click to unequip ${def?.name || slot}` : slot}>
              <span className="eq-slot-label">{slot.slice(0, 3).toUpperCase()}</span>
              {def && eq ? <Icon id={eq.id} size={30} /> : <span className="eq-empty">—</span>}
              {def && (
                <span className="drop-hover">
                  <b className="rn">{def.name}</b><br />
                  <span className="rd">{RARITY[def.rarity]?.label || 'Common'}</span>
                  {def.weapon && <><br /><span className="stat-line">⚔ {def.weapon.damage} dmg</span></>}
                  {def.armor != null && def.armor > 0 && <><br /><span className="stat-line">🛡 +{def.armor} armor</span></>}
                  {def.shieldBlock && <><br /><span className="stat-line">🛡 {Math.round(def.shieldBlock * 100)}% block</span></>}
                  <br /><span style={{ fontSize: '10px', color: '#ffb3b3' }}>Click to unequip</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <h3>Attributes {c.statPoints > 0 && <span className="gold">({c.statPoints} unspent points)</span>}</h3>
      <div className="attr-row">
        {Object.entries(c.alloc).map(([k, v]: [string, number]) => (
          <span key={k} className="attr" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <b>{k}</b> <span>{v}</span>
            {c.statPoints > 0 && (
              <button
                className="btn"
                style={{ padding: '2px 7px', fontSize: '11px', lineHeight: 1, minWidth: 'auto', background: '#3b5478', border: '1px solid #6b8bb8' }}
                onClick={() => {
                  spendStat(k);
                  import('../../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
                }}
                title={`Increase ${k}`}
              >+</button>
            )}
          </span>
        ))}
      </div>
      <h3>Professions</h3>
      <div className="attr-row">{c.profs.map((p) => <span key={p.k} className="attr"><b>{p.k}</b> <span>Lv {p.lv}</span></span>)}</div>
    </div>
  );
}
