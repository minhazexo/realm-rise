// ─────────────────────────────────────────────────────────────────────────────
// Crafting (spec §14): validation incl. stations & knowledge flags, instant
// commit with per-item durations surfaced to the scene for the queue bar.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus, CH } from '../core/EventBus.js';
import { RECIPES } from '../data/recipes.js';
import { getItem, newInstance } from '../data/items.js';
import { addItem, spendItems, hasItems } from './InventorySystem.js';
import { awardXP, profXP, skillFx } from './ProgressionSystem.js';

const st = () => GameState.s;
export const nearbyStations = () => GameState.session.stationsNear || {};

const STATION_LABELS = { campfire: 'Campfire', forge: 'Blacksmith Forge', kitchen: 'Village Kitchen', tannery: 'Tannery', workshop: 'Workshop' };

/** Returns null when craftable right now, otherwise a human reason. */
export function blockReason(recipe, batch = 1) {
  if (recipe.station && !nearbyStations()[recipe.station]) return `Requires ${STATION_LABELS[recipe.station] || recipe.station} nearby`;
  if (recipe.flag && !st().story.flags[recipe.flag]) return 'Requires unlocked knowledge';
  if (batch > 1) {
    const scaled = Object.fromEntries(Object.entries(recipe.cost).map(([id, n]) => [id, n * batch]));
    if (!hasItems(scaled)) return `Missing resources (×${batch})`;
    return null;
  }
  if (!hasItems(recipe.cost)) return 'Missing resources';
  return null;
}

export const craftDurationSec = (recipe) => {
  const r = typeof recipe === 'string' ? RECIPES.find((x) => x.id === recipe) : recipe;
  const base = r.out === 'dawnbreaker' ? 8 : getItem(r.out)?.weapon ? 2.4 : 1.4;
  return Math.round(base * st().player.derived.craftSpeedMult * 10) / 10;
};

/**
 * Attempt craft. Returns { ok, reason? }.
 * Pass `{ batch: 5 }` (Shift-click in UI) to repeat `process` recipes ×5 —
 * smelting ingots one-by-one was click-hell.
 */
export function craft(recipeId, opts = {}) {
  const r = typeof recipeId === 'string' ? RECIPES.find((x) => x.id === recipeId) : recipeId;
  if (!r) return { ok: false, reason: 'Unknown recipe' };
  const batch = r.cat === 'process' && opts.batch > 1 ? Math.min(5, Math.floor(opts.batch)) : 1;
  const why = blockReason(r, batch);
  if (why) return { ok: false, reason: why };

  for (let b = 0; b < batch; b++) spendItems(r.cost);

  const fx = skillFx();
  const armorBonus = 1 + (fx.armorBonus || 0);

  for (let b = 0; b < batch; b++) {
    for (let i = 0; i < r.qty || i < 1; i++) {
      if (i >= (r.qty || 1)) break;
      const inst = newInstance(r.out);
      if (armorBonus > 1 && getItem(r.out)?.armor && typeof inst.dur === 'number') {
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
export { LOOT_ONLY } from '../data/recipes.js';

/**
 * Salvage a gear instance back into 50% of its recipe cost (rounded down,
 * min 0). Gives bad rolls purpose and closes the economy loop. Requires a
 * forge nearby — same fiction as smelting. Returns { ok, reason?, refund? }.
 */
export function salvage(ref) {
  const S = st();
  const idx = S.inventory.findIndex((e) => e.iid === ref || e.id === ref);
  if (idx < 0) return { ok: false, reason: 'Not in inventory' };
  const entry = S.inventory[idx];
  const def = getItem(entry.id);
  if (!def?.durability && !def?.weapon && !def?.slot) return { ok: false, reason: 'Only gear can be salvaged' };
  if (!nearbyStations().forge) return { ok: false, reason: `Requires ${STATION_LABELS.forge} nearby` };
  const recipe = RECIPES.find((r) => r.out === entry.id);
  if (!recipe) return { ok: false, reason: 'No salvage value' };
  const refund = {};
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

/** Compare a craftable weapon against the equipped one for smart tooltips. */
function compareVsEquipped(outId) {
  const def = getItem(outId);
  if (!def?.weapon) return null;
  const eq = st().player.equipment.weapon;
  if (!eq) return { slot: 'weapon', note: 'No weapon equipped — upgrade' };
  const cur = getItem(eq.id);
  if (!cur?.weapon) return null;
  return {
    slot: 'weapon',
    dmgDelta: (def.weapon.dmg || 0) - (cur.weapon.dmg || 0),
    cdDelta: (def.weapon.cd || 0) - (cur.weapon.cd || 0),
    critDelta: (def.weapon.crit || 0) - (cur.weapon.crit || 0),
    equippedId: eq.id,
  };
}

/** Recipes enriched for the UI panel. */
export function recipesForUI(category = 'all') {
  const count = (id) => st().inventory.reduce((n, e) => n + (e.id === id ? e.qty : 0), 0);
  return RECIPES.filter((r) => category === 'all' || r.cat === category).map((r) => ({
    ...r,
    def: getItem(r.out),
    reason: blockReason(r),
    haveCounts: Object.fromEntries(Object.entries(r.cost).map(([id]) => [id, count(id)])),
    durSec: craftDurationSec(r),
    compare: compareVsEquipped(r.out),
  }));
}

