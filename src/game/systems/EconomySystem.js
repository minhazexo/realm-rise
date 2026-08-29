// ─────────────────────────────────────────────────────────────────────────────
// Economy (spec §28): regional price affinities so exploration pays. Mountains
// sell iron cheap, deserts charge dearly for water, coasts are fish-rich, etc.
// ─────────────────────────────────────────────────────────────────────────────
import { getItem } from '../data/items.js';
import { TRADE_SPREAD } from '../core/Constants.js';

/** Multipliers per biome per item id (1 = neutral). Missing entries neutral. */
const AFFINITY = {
  mountains: { stone: 0.55, iron_ore: 0.6, silver: 0.7, coal: 0.7, steel_ingot: 0.85, berries: 1.6 },
  riverlands: { raw_fish: 0.5, cooked_fish: 0.55, wheat: 0.7, bread: 0.8, clay: 0.7 },
  desert: { waterskin: 2.2, herb_tea: 1.8, fur_pelt: 0.75, clay: 1.4, leather_hide: 1.3, flint: 0.7 },
  frozen: { fur_coat: 0.7, fur_pelt: 0.65, moonstone: 0.8, crystal: 0.85, wood: 1.5 },
  forest: { wood: 0.6, hardwood: 0.7, berries: 0.65, mushrooms: 0.7, herbs: 0.75 },
  swamp: { herbs: 0.55, mushrooms: 0.6, raw_meat: 0.8 },
  plains: { wheat: 0.6, fiber: 0.7, bread: 0.85 },
  ruins: { ancient_relic: 0.8, crystal: 0.9 }
};

export function biomeMult(biomeId, itemId) {
  return AFFINITY[biomeId]?.[itemId] ?? 1;
}

/**
 * Price context: { biomeId, tradeBonusPct, factionBonusPct, marketTier }
 * marketTier reduces spread; trade/faction bonuses shift both sides.
 */
export function makeContext({ biomeId = 'forest', tradeBonusPct = 0, factionBonusPct = 0, marketTier = 0 } = {}) {
  const spread = Math.max(0.22, TRADE_SPREAD.sellMult - marketTier * 0.02);
  return { biomeId, bonus: 1 + tradeBonusPct + factionBonusPct, sellBase: spread };
}

export function buyPrice(itemId, ctx) {
  const def = getItem(itemId);
  if (!def) return Infinity;
  const p = Math.ceil(def.value * biomeMult(ctx.biomeId, itemId) * (2 - ctx.bonus) * 100) / 100;
  return Math.max(1, Math.round(p));
}

export function sellPrice(itemId, ctx) {
  const def = getItem(itemId);
  if (!def) return 0;
  const p = Math.floor(def.value * biomeMult(ctx.biomeId, itemId) * ctx.sellBase * ctx.bonus);
  return Math.max(1, p);
}

/** Merchant stock adapts to realm progress & biome (spec §35 caravans use it too). */
export function merchantStock(ctx) {
  const tierStock = [
    ['berries', 'mushrooms', 'wood', 'stone', 'fiber', 'waterskin', 'arrows', 'torch'],
    ['cooked_meat', 'bandage', 'axe_iron', 'pick_iron', 'iron_ingot', 'leather_vest', 'helm_leather', 'short_bow'],
    ['steel_ingot', 'healing_salve', 'iron_plate', 'helm_iron', 'longbow', 'whetstone', 'repair_kit', 'treasure_map'],
    ['steel_sword', 'steel_plate', 'crossbow', 'fishing_rod', 'herb_tea', 'stamina_tonic', 'silver', 'gold_nugget']
  ];
  const stageTier = Math.min(3, ctx.marketTier);
  const pool = [];
  for (let t = 0; t <= stageTier; t++) pool.push(...tierStock[t]);
  const stock = [];
  for (const id of pool) {
    const baseQty = getItem(id)?.durability ? 2 : 12;
    stock.push({
      id,
      qty: baseQty,
      buy: buyPrice(id, ctx),
      sell: sellPrice(id, ctx)
    });
  }
  return stock;
}
