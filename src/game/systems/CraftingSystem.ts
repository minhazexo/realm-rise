// ─────────────────────────────────────────────────────────────────────────────
// Crafting (spec §14): validation incl. stations & knowledge flags, instant
// commit with per-item durations surfaced to the scene for the queue bar.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { RECIPES } from '../data/recipes.ts';
import type { RecipeDef } from '../data/recipesA.ts';
import { getItem, newInstance } from '../data/items.ts';
import type { ItemDef } from '../data/itemDefs.ts';
import { addItem, spendItems, hasItems } from './InventorySystem.ts';
import { awardXP, profXP, skillFx } from './ProgressionSystem.ts';

const st = () => GameState.s;
export const nearbyStations = (): Record<string, unknown> => GameState.session.stationsNear || {};

const STATION_LABELS: Record<string, string> = { campfire: 'Campfire', forge: 'Blacksmith Forge', kitchen: 'Village Kitchen', tannery: 'Tannery', workshop: 'Workshop' };

/** Result of a craft / salvage attempt. */
export interface CraftResult {
  ok: boolean;
  reason?: string;
  refund?: Record<string, number>;
}

/** Gear-vs-equipped comparison shown in the crafting panel. */
export interface GearCompare {
  slot: string;
  note?: string;
  dmgDelta?: number;
  cdDelta?: number;
  critDelta?: number;
  /** Armor pieces compare on armor rating instead of damage. */
  armorDelta?: number;
  equippedId?: string;
}

/** Returns null when craftable right now, otherwise a human reason. */
export function blockReason(recipe: RecipeDef, batch = 1): string | null {
  if (recipe.station && !nearbyStations()[recipe.station]) return `Requires ${STATION_LABELS[recipe.station] || recipe.station} nearby`;
  if (recipe.flag && !st().story.flags[recipe.flag]) return 'Requires unlocked knowledge';
  if (batch > 1) {
    const scaled: Record<string, number> = Object.fromEntries(Object.entries(recipe.cost).map(([id, n]) => [id, n * batch]));
    if (!hasItems(scaled)) return `Missing resources (×${batch})`;
    return null;
  }
  if (!hasItems(recipe.cost)) return 'Missing resources';
  return null;
}

export const craftDurationSec = (recipe: RecipeDef | string): number => {
  const r = typeof recipe === 'string' ? RECIPES.find((x) => x.id === recipe) : recipe;
  if (!r) return 0;
  const base = r.out === 'dawnbreaker' ? 8 : getItem(r.out)?.weapon ? 2.4 : 1.4;
  const craftSpeedMult: number = st().player.derived?.craftSpeedMult ?? 1;
  return Math.round(base * craftSpeedMult * 10) / 10;
};

/**
 * Attempt craft. Returns { ok, reason? }.
 * Pass `{ batch: 5 }` (Shift-click in UI) to repeat `process` recipes ×5 —
 * smelting ingots one-by-one was click-hell.
 */
export function craft(recipeId: string | RecipeDef, opts: { batch?: number } = {}): CraftResult {
  const r = typeof recipeId === 'string' ? RECIPES.find((x) => x.id === recipeId) : recipeId;
  if (!r) return { ok: false, reason: 'Unknown recipe' };
  const batch = r.cat === 'process' && (opts.batch ?? 0) > 1 ? Math.min(5, Math.floor(opts.batch ?? 1)) : 1;
  const why = blockReason(r, batch);
  if (why) return { ok: false, reason: why };

  for (let b = 0; b < batch; b++) spendItems(r.cost);

  const fx = skillFx();
  const armorBonus = 1 + Number(fx.armorBonus || 0);

  for (let b = 0; b < batch; b++) {
    for (let i = 0; i < r.qty || i < 1; i++) {
      if (i >= (r.qty || 1)) break;
      const inst = newInstance(r.out);
      const outDef: ItemDef | null = getItem(r.out);
      if (inst && armorBonus > 1 && outDef?.armor && 'dur' in inst && typeof inst.dur === 'number') {
        inst.dur = Math.round(inst.dur * Math.min(1.35, armorBonus)); // hardier gear from a master armorer
      }
      addItem(r.out, 1, { ignoreCap: true });
    }
  }

  profXP('crafting', 14 * batch);
  awardXP(6 * batch, 'craft');
  GameState.notify(CH.INVENTORY);
  Bus.emit('crafted', r.id);
  return { ok: true };
}

/** Item ids intentionally without recipes (loot/shop finds, not gaps). */
export { LOOT_ONLY } from '../data/recipes.ts';

/**
 * Salvage a gear instance back into 50% of its recipe cost (rounded down,
 * min 0). Gives bad rolls purpose and closes the economy loop. Requires a
 * forge nearby — same fiction as smelting. Returns { ok, reason?, refund? }.
 */
export function salvage(ref: string): CraftResult {
  const S = st();
  const idx = S.inventory.findIndex((e) => e.iid === ref || e.id === ref);
  if (idx < 0) return { ok: false, reason: 'Not in inventory' };
  const entry = S.inventory[idx];
  if (!entry) return { ok: false, reason: 'Not in inventory' };
  const def = getItem(entry.id);
  if (!def?.durability && !def?.weapon && !def?.slot) return { ok: false, reason: 'Only gear can be salvaged' };
  if (!nearbyStations().forge) return { ok: false, reason: `Requires ${STATION_LABELS.forge} nearby` };
  const recipe = RECIPES.find((r) => r.out === entry.id);
  if (!recipe) return { ok: false, reason: 'No salvage value' };
  const refund: Record<string, number> = {};
  for (const [id, n] of Object.entries(recipe.cost)) {
    const back = Math.floor(n / 2);
    if (back > 0) refund[id] = back;
  }
  S.inventory.splice(idx, 1);
  for (const [id, n] of Object.entries(refund)) addItem(id, n, { ignoreCap: true, silent: true });
  profXP('crafting', 4);
  GameState.notify(CH.INVENTORY);
  Bus.emit('salvaged', entry.id);
  return { ok: true, refund };
}

/** Compare craftable gear against what is equipped, so the stat change is visible. */
function compareVsEquipped(outId: string): GearCompare | null {
  const def = getItem(outId);
  if (!def) return null;
  const eq = st().player.equipment;
  if (def.weapon) {
    const held = eq.weapon;
    const cur = held ? getItem(held.id) : null;
    if (!held || !cur?.weapon) return { slot: 'weapon', note: 'Nothing equipped' };
    return {
      slot: 'weapon',
      dmgDelta: (def.weapon.dmg || 0) - (cur.weapon.dmg || 0),
      cdDelta: (def.weapon.cd || 0) - (cur.weapon.cd || 0),
      critDelta: (def.weapon.crit || 0) - (cur.weapon.crit || 0),
      equippedId: held.id,
    };
  }
  const slot: string | undefined = def.slot;
  if (def.armor && slot) {
    const worn = eq[slot];
    const cur = worn ? getItem(worn.id) : null;
    if (!worn || !cur?.armor) return { slot, note: 'Nothing equipped' };
    return { slot, armorDelta: def.armor - cur.armor, equippedId: worn.id };
  }
  return null;
}

/** One recipe row enriched for the crafting panel. */
export interface RecipeRow extends RecipeDef {
  def: ItemDef | null;
  reason: string | null;
  haveCounts: Record<string, number>;
  durSec: number;
  compare: GearCompare | null;
}

/** Recipes enriched for the UI panel. */
export function recipesForUI(category = 'all'): RecipeRow[] {
  const count = (id: string): number => st().inventory.reduce((n, e) => n + (e.id === id ? e.qty : 0), 0);
  return RECIPES.filter((r) => category === 'all' || r.cat === category).map((r) => ({
    ...r,
    def: getItem(r.out),
    reason: blockReason(r),
    haveCounts: Object.fromEntries(Object.entries(r.cost).map(([id]) => [id, count(id)])),
    durSec: craftDurationSec(r),
    compare: compareVsEquipped(r.out),
  }));
}

/**
 * Why nothing at this station can be made right now — or null if something
 * can. Used when a player walks up to a station, so the interaction answers
 * instead of silently opening an all-locked list.
 */
export function idleReason(station: string): string | null {
  const rows: RecipeDef[] = RECIPES.filter((r: RecipeDef) => r.station === station);
  const first: RecipeDef | undefined = rows[0];
  if (!first) return 'No recipes are known for this station yet';
  for (const r of rows) if (!blockReason(r)) return null;
  return blockReason(first) || 'Missing resources';
}
