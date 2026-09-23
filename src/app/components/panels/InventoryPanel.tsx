// InventoryPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import { useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { RARITY, getItem } from '../../../game/data/items.ts';
import { equip, sortedInventory, unequip, useConsumable } from '../../../game/systems/InventorySystem.ts';
import { craft } from '../../../game/systems/CraftingSystem.ts';
import type { InventoryEntry } from './types.ts';
import type { EquippedItem } from './types.ts';
import { Icon } from './shared.tsx';

/* ── Inventory ─────────────────────────────────────────────────────────── */
export function InventoryPanel(): JSX.Element {
  const [sort, setSort] = useState<string>('rarity');
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState<string>('');
  const inv = useGameState([CH.INVENTORY, CH.EQUIPMENT, CH.SETTLEMENT], () => ({
    list: (sortedInventory as (...args: any[]) => InventoryEntry[])(sort, cat, q),
    eq: { ...GameState.s?.player?.equipment },
    gold: GameState.s?.player?.gold
  })) as { list: InventoryEntry[]; eq: Record<string, EquippedItem | undefined>; gold?: number };
  const R: any = RARITY;

  const handleClick = (e: InventoryEntry): void => {
    const ref: string = e.iid || e.id;
    if (e.qty === undefined) {
      // stacked resource/consumable — use if consumable else info toast
      const d: any = getItem(e.id);
      if (d?.use) {
        const u: any = useConsumable(e.id, GameState.s.player.derived?.healPower);
                import('../../../game/main.ts').then((m: any) => m.worldScene()?.player?.applyConsumableEffects?.(u));
                if (d.id === 'treasure_map') import('../../../game/systems/QuestEngine.ts').then((q2: any) => q2.handleEvent({ type: 'useItem', itemId: 'treasure_map' }));
        return;
      }
    }
    // gear → equip (equip() itself validates the entry exists)
    import('../../../game/systems/InventorySystem.ts').then((I: any) => {
      I.equip(ref);
    });
    import('../../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
    import('../../../game/main.ts').then((m: any) => m.worldScene()?.refreshPlayerSkin?.());
  };

  const handleUnequip = (slot: string): void => {
    unequip(slot);
    import('../../../game/systems/ProgressionSystem.ts').then((P: any) => P.recompute());
    import('../../../game/main.ts').then((m: any) => m.worldScene()?.refreshPlayerSkin?.());
  };

  return (
    <div className="panel inventory-panel">
      <h2>Inventory <span className="gold">🪙 {inv.gold}</span></h2>
      <div className="inv-toolbar">
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rarity">Rarity</option><option value="name">Name</option>
          <option value="type">Type</option><option value="value">Value</option>
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All</option>
          {['resource', 'tool', 'weapon', 'offhand', 'armor', 'trinket', 'consumable', 'special'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="equip-strip">
        {['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet'].map((slot) => {
          const eq: EquippedItem | undefined = inv.eq[slot];
          const def: any = eq ? getItem(eq.id) : null;
          return (
            <button key={slot} className="eq-slot" onClick={() => eq && handleUnequip(slot)}>
              <span className="eq-slot-label">{slot.slice(0, 3).toUpperCase()}</span>
              {def && eq ? <Icon id={eq.id} size={30} /> : <span className="eq-empty">—</span>}
              {def && (
                <span className="drop-hover">
                  <b className="rn">{def.name}</b><br />
                  <span className="rd">{RARITY[def.rarity]?.label || 'Common'}</span>
                  {def.weapon && <><br /><span className="stat-line">⚔ {def.weapon.damage} dmg</span></>}
                  {def.armor != null && def.armor > 0 && <><br /><span className="stat-line">🛡 +{def.armor} armor</span></>}
                  {def.shieldBlock && <><br /><span className="stat-line">🛡 {Math.round(def.shieldBlock * 100)}% block</span></>}
                  {eq?.dur != null && <><br /><span className="stat-line">♻ {eq.dur}/{def.durability}</span></>}
                  {def.desc && <><br /><span>{def.desc}</span></>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid">
        {inv.list.map((e) => {
          const d: any = getItem(e.id);
          const isGear: boolean = !!(e.iid || d?.durability || d?.weapon || d?.slot);
          return (
            <button key={e.iid || e.id} className="cell" style={{ '--rar': R[d.rarity].color } as CSSProperties} onClick={() => handleClick(e)} title={d.name}>
              <Icon id={e.id} size={32} />
              {(e.qty ?? 0) > 1 && <span className="qty">{e.qty}</span>}
              {isGear && (
                <span
                  className="salvage-btn"
                  title="Salvage for 50% materials (needs forge nearby)"
                  onClick={(ev) => {
                    ev.stopPropagation();
                                        import('../../../game/systems/CraftingSystem.ts').then((C: any) => {
                      const r: any = C.salvage(e.iid || e.id);
                      GameState.toast(r.ok
                        ? { title: `Salvaged ${d.name}`, msg: Object.entries(r.refund || {}).map(([id, n]) => `${getItem(id)?.name}×${n}`).join(', ') || 'Scrap.', kind: 'craft', icon: undefined }
                        : { title: 'Cannot salvage', msg: r.reason, kind: 'warn', icon: undefined });
                    });
                  }}
                >♻</span>
              )}
              <span className="drop-hover">
                <b className="rn">{d.name}</b><br />
                <span className="rd">{R[d.rarity].label} {d.cat}</span>
                {d.desc && <><br /><span>{d.desc}</span></>}
                {d.weapon && <><br /><span className="stat-line">⚔ Damage: {d.weapon.damage}{d.weapon.reachBonusVsAnimals ? ' (+vs animals)' : ''}</span></>}
                {d.armor != null && d.armor > 0 && <><br /><span className="stat-line">🛡 Armor: +{d.armor}</span></>}
                {d.shieldBlock && <><br /><span className="stat-line">🛡 Block: {Math.round(d.shieldBlock * 100)}%</span></>}
                {d.tool && <><br /><span className="stat-line">🔧 Tool: {d.tool} (Tier {d.tier || 1})</span></>}
                {d.gatherMult && d.gatherMult > 1 && <><br /><span className="stat-line">📦 Gather: ×{d.gatherMult}</span></>}
                {d.durability != null && <><br /><span className="stat-line">♻ Durability: {d.durability}</span></>}
                {d.value > 0 && <><br /><span className="stat-line">🪙 Value: {d.value}g</span></>}
                {d.warmth != null && d.warmth > 0 && <><br /><span className="stat-line">🔥 Warmth: +{d.warmth}</span></>}
                {d.movePenalty != null && d.movePenalty > 0 && <><br /><span className="stat-line">🐌 Speed: -{Math.round(d.movePenalty * 100)}%</span></>}
                {d.use && <><br /><span className="stat-line">✨ Click to use</span></>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
