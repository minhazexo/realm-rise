// ─────────────────────────────────────────────────────────────────────────────
// Economy (spec §28): regional price affinities so exploration pays. Mountains
// sell iron cheap, deserts charge dearly for water, coasts are fish-rich, etc.
//
// Pricing (buyPrice/sellPrice/merchantStock) is pure. The transaction
// services below (spendGold/earnGold/buyOffer/sellUnit) own ALL gold mutation
// so UI panels never touch player.gold directly (Phase 4 UI discipline).
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { getItem } from '../data/items.ts';
import { addItem, removeItem } from './InventorySystem.ts';
import { TRADE_SPREAD } from '../core/Constants.ts';
import type { GameRootState } from '../core/stateFactory.ts';

/** Multipliers per biome per item id (1 = neutral). Missing entries neutral. */
const AFFINITY: Record<string, Record<string, number>> = {
  mountains: { stone: 0.55, iron_ore: 0.6, silver: 0.7, coal: 0.7, steel_ingot: 0.85, berries: 1.6 },
  riverlands: { raw_fish: 0.5, cooked_fish: 0.55, wheat: 0.7, bread: 0.8, clay: 0.7 },
  desert: { waterskin: 2.2, herb_tea: 1.8, fur_pelt: 0.75, clay: 1.4, leather_hide: 1.3, flint: 0.7 },
  frozen: { fur_coat: 0.7, fur_pelt: 0.65, moonstone: 0.8, crystal: 0.85, wood: 1.5 },
  forest: { wood: 0.6, hardwood: 0.7, berries: 0.65, mushrooms: 0.7, herbs: 0.75 },
  swamp: { herbs: 0.55, mushrooms: 0.6, raw_meat: 0.8 },
  plains: { wheat: 0.6, fiber: 0.7, bread: 0.85 },
  ruins: { ancient_relic: 0.8, crystal: 0.9 }
};

export function biomeMult(biomeId: string, itemId: string): number {
  return AFFINITY[biomeId]?.[itemId] ?? 1;
}

export interface PriceContextOpts {
  biomeId?: string;
  tradeBonusPct?: number;
  factionBonusPct?: number;
  marketTier?: number;
}

/**
 * Price context: { biomeId, bonus, sellBase }.
 * marketTier narrows the spread; trade/faction bonuses shift both sides.
 * (marketTier intentionally absent from the returned context — merchantStock
 * reads it from caller-augmented contexts.)
 */
export interface PriceContext {
  biomeId: string;
  bonus: number;
  sellBase: number;
  marketTier?: number;
}

export function makeContext({ biomeId = 'forest', tradeBonusPct = 0, factionBonusPct = 0, marketTier = 0 }: PriceContextOpts = {}): PriceContext {
  const spread: number = Math.max(0.22, TRADE_SPREAD.sellMult - marketTier * 0.02);
  return { biomeId, bonus: 1 + tradeBonusPct + factionBonusPct, sellBase: spread };
}

export function buyPrice(itemId: string, ctx: PriceContext): number {
  const def = getItem(itemId);
  if (!def) return Infinity;
  const p: number = Math.ceil(def.value * biomeMult(ctx.biomeId, itemId) * (2 - ctx.bonus) * 100) / 100;
  return Math.max(1, Math.round(p));
}

export function sellPrice(itemId: string, ctx: PriceContext): number {
  const def = getItem(itemId);
  if (!def) return 0;
  const p: number = Math.floor(def.value * biomeMult(ctx.biomeId, itemId) * ctx.sellBase * ctx.bonus);
  return Math.max(1, p);
}

export interface StockEntry {
  id: string;
  qty: number;
  buy: number;
  sell: number;
}

/** Merchant stock adapts to realm progress & biome (spec §35 caravans use it too). */
export function merchantStock(ctx: PriceContext): StockEntry[] {
  const tierStock: string[][] = [
    ['berries', 'mushrooms', 'wood', 'stone', 'fiber', 'waterskin', 'arrows', 'torch'],
    ['cooked_meat', 'bandage', 'axe_iron', 'pick_iron', 'iron_ingot', 'leather_vest', 'helm_leather', 'short_bow'],
    ['steel_ingot', 'healing_salve', 'iron_plate', 'helm_iron', 'longbow', 'whetstone', 'repair_kit', 'treasure_map'],
    ['steel_sword', 'steel_plate', 'crossbow', 'fishing_rod', 'herb_tea', 'stamina_tonic', 'silver', 'gold_nugget']
  ];
  const stageTier: number = Math.min(3, ctx.marketTier as number);
  const pool: string[] = [];
  for (let t = 0; t <= stageTier; t++) {
    const tier: string[] | undefined = tierStock[t];
    if (tier) pool.push(...tier);
  }
  const stock: StockEntry[] = [];
  for (const id of pool) {
    const baseQty: number = getItem(id)?.durability ? 2 : 12;
    stock.push({
      id,
      qty: baseQty,
      buy: buyPrice(id, ctx),
      sell: sellPrice(id, ctx)
    });
  }
  return stock;
}

/* ── Transactions (sole owners of player.gold mutation) ───────────────── */

const st = (): GameRootState => GameState.s;

/** Current gold (0 when no game running). */
export function gold(): number {
  return st()?.player?.gold ?? 0;
}

/**
 * Spend gold. Returns true on success, false when funds are short
 * (emits the merchant warning toast). Never drives gold negative.
 */
export function spendGold(amount: number): boolean {
  const S: GameRootState = st();
  amount = Math.max(0, Math.floor(amount));
  if (!S) return false;
  if (S.player.gold < amount) {
    GameState.toast({ title: 'Merchant', msg: 'Not enough gold.', kind: 'warn' });
    return false;
  }
  S.player.gold -= amount;
  GameState.notify(CH.PLAYER, CH.INVENTORY);
  return true;
}

/** Earn gold (quest rewards, trade, taxes). Returns the amount credited. */
export function earnGold(amount: number): number {
  const S: GameRootState = st();
  if (!S) return 0;
  amount = Math.max(0, Math.floor(amount));
  S.player.gold += amount;
  GameState.notify(CH.PLAYER, CH.INVENTORY);
  return amount;
}

export interface TradeResult {
  ok: boolean;
  reason?: string;
  price?: number;
}

/**
 * Buy one unit of a merchant stock offer ({ id, buy }).
 * Returns { ok, reason? } — UI reads reason for feedback, owns no math.
 */
export function buyOffer(offer: { id: string; buy: number }): TradeResult {
  if (!offer || !getItem(offer.id)) return { ok: false, reason: 'Unknown goods' };
  if (!spendGold(offer.buy)) return { ok: false, reason: 'Short of gold' };
  addItem(offer.id, 1);
  GameState.notify(CH.PLAYER, CH.INVENTORY);
  return { ok: true };
}

/**
 * Sell one unit of an inventory entry id at the context price.
 * Returns { ok, price?, reason? }.
 */
export function sellUnit(entryId: string, ctx: PriceContext): TradeResult {
  const price: number = sellPrice(entryId, ctx);
  if (!removeItem(entryId, 1)) return { ok: false, reason: 'Nothing to sell' };
  earnGold(price);
  GameState.toast({ title: 'Sold', msg: `+${price} 🪙`, kind: 'craft' });
  return { ok: true, price };
}

void Bus;
