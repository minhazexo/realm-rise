// TradePanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { getItem } from '../../../game/data/items.ts';
import { buyOffer, makeContext, merchantStock, sellUnit } from '../../../game/systems/EconomySystem.ts';
import type { PriceContext } from '../../../game/systems/EconomySystem.ts';
import { biomeAt } from '../../../game/world/worldGen.ts';
import type { InventoryEntry } from './types.ts';
import type { TradeOffer } from './types.ts';
import { Icon } from './shared.tsx';
import { uiSession } from './shared.tsx';

/* ── Trade ────────────────────────────────────────────────────────────── */
export function TradePanel(): JSX.Element {
  const npc: any = uiSession.tradeNpc;
  const data = useGameState([CH.INVENTORY, CH.PLAYER], () => {
    const S: any = GameState.s;
    let biomeId = 'forest';
    try { biomeId = biomeAt(S.world.px, S.world.py); } catch { /* default */ }
    const ctx: any = makeContext({ biomeId, marketTier: S.settlement?.stageIndex || 0 });
    const stock: TradeOffer[] = merchantStock(ctx);
    const sellable: InventoryEntry[] = (S.inventory || []).filter((e: InventoryEntry) => {
      const d: any = getItem(e.id);
      return d && d.value > 0 && (d.cat === 'resource' || d.cat === 'consumable');
    });
    return { stock, sellable, gold: S.player.gold, ctx };
  }) as { stock: TradeOffer[]; sellable: InventoryEntry[]; gold: number; ctx: PriceContext };
  const doBuy = (s: TradeOffer): void => {
    buyOffer(s); // service owns gold math + failure toast
  };
  const doSell = (e: InventoryEntry): void => {
    sellUnit(e.id, data.ctx); // service owns pricing + gold + toast
  };
  return (
    <div className="panel trade-panel">
      <h2>Trade {npc?.key ? <span className="gold">· {npc.key}</span> : null} <span className="gold">🪙 {data.gold}</span></h2>
      <h3>Merchant stock</h3>
      <div className="recipe-grid">
        {data.stock.length === 0 && <em>Nothing in stock.</em>}
        {data.stock.map((s) => (
          <button key={s.id} className="recipe" onClick={() => doBuy(s)} disabled={data.gold < s.buy}>
            <Icon id={s.id} size={30} />
            <div className="recipe-body"><b>{getItem(s.id)?.name}</b><div className="recipe-cost"><span>🪙 {s.buy}</span></div></div>
          </button>
        ))}
      </div>
      <h3>Sell yours</h3>
      <div className="recipe-grid">
        {data.sellable.length === 0 && <em>Nothing worth selling.</em>}
        {data.sellable.map((e) => (
          <button key={e.iid || e.id} className="recipe" onClick={() => doSell(e)}>
            <Icon id={e.id} size={30} />
            <div className="recipe-body"><b>{getItem(e.id)?.name}×{e.qty}</b></div>
          </button>
        ))}
      </div>
    </div>
  );
}
