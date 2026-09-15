// ─────────────────────────────────────────────────────────────────────────────
// Loot tables (spec §70–71, Phase D raids). Data-driven drop tables extracted
// from WorldScene/RaidSystem so new chests and raiders are data edits.
//
// Chest entry: [itemId, qtyMax, chance] — qty rolls 1..qtyMax, kept on chance.
// Raid entry: { key, weight } — weighted pick, replaces duplicated array slots.
// ─────────────────────────────────────────────────────────────────────────────

export type ChestDrop = [itemId: string, qtyMax: number, chance: number];

export const CHEST_POOLS: Record<string, ChestDrop[]> = {
  wooden_chest: [['wood', 12, 0.9], ['stone', 6, 0.8], ['berries', 6, 0.7], ['fiber', 8, 0.8], ['leather_hide', 2, 0.5], ['torch', 2, 0.6]],
  iron_chest: [['iron_ore', 6, 0.9], ['coal', 8, 0.9], ['cooked_meat', 4, 0.7], ['silver', 2, 0.4], ['wooden_sword', 1, 0.2], ['arrows', 12, 0.6]],
  royal_chest: [['gold_nugget', 6, 0.9], ['steel_ingot', 3, 0.7], ['healing_salve', 2, 0.6], ['iron_sword', 1, 0.4], ['repair_kit', 1, 0.5]],
  ancient_chest: [['ancient_core', 1, 1], ['moonstone', 2, 0.8], ['crystal', 4, 0.9], ['ancient_relic', 2, 0.9], ['treasure_map', 1, 0.6]],
};

/** Fallback pool for unknown chest tiers (matches legacy behavior). */
export const FALLBACK_CHEST_POOL: ChestDrop[] = [['wood', 5, 1]];

export interface RaidPoolEntry {
  key: string;
  weight: number;
}

/** Raid party composition weights (realm stage scales size in RaidSystem). */
export const RAID_POOL: RaidPoolEntry[] = [
  { key: 'bandit_scout', weight: 1 },
  { key: 'bandit_swordsman', weight: 2 },
  { key: 'bandit_archer', weight: 1 },
  { key: 'bandit_brute', weight: 1 },
];

/** Weighted raid party of `size` enemy keys. Pure (rng injectable for tests). */
export function rollRaidParty(size: number, rng: () => number = Math.random): string[] {
  const total: number = RAID_POOL.reduce((s, e) => s + e.weight, 0);
  const party: string[] = [];
  for (let i = 0; i < size; i++) {
    let r: number = rng() * total;
    for (const e of RAID_POOL) {
      r -= e.weight;
      if (r < 0) { party.push(e.key); break; }
    }
  }
  return party;
}
