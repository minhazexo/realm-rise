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
export function blockReason(recipe) {
  if (recipe.station && !nearbyStations()[recipe.station]) return `Requires ${STATION_LABELS[recipe.station] || recipe.station} nearby`;
  if (recipe.flag && !st().story.flags[recipe.flag]) return 'Requires unlocked knowledge';
  if (!hasItems(recipe.cost)) return 'Missing resources';
  return null;
}

export const craftDurationSec = (recipe) => {
  const r = typeof recipe === 'string' ? RECIPES.find((x) => x.id === recipe) : recipe;
  const base = r.out === 'dawnbreaker' ? 8 : getItem(r.out)?.weapon ? 2.4 : 1.4;
  return Math.round(base * st().player.derived.craftSpeedMult * 10) / 10;
};

/** Attempt craft. Returns { ok, reason? }. */
export function craft(recipeId) {
  const r = typeof recipeId === 'string' ? RECIPES.find((x) => x.id === recipeId) : recipeId;
  if (!r) return { ok: false, reason: 'Unknown recipe' };
  const why = blockReason(r);
  if (why) return { ok: false, reason: why };

  spendItems(r.cost);

  const fx = skillFx();
  const armorBonus = 1 + (fx.armorBonus || 0);

  for (let i = 0; i < r.qty || i < 1; i++) {
    if (i >= (r.qty || 1)) break;
    const inst = newInstance(r.out);
    if (armorBonus > 1 && getItem(r.out)?.armor && typeof inst.dur === 'number') {
      inst.dur = Math.round(inst.dur * Math.min(1.35, armorBonus)); // hardier gear from a master armorer
    }
    addItem(r.out, 1, { ignoreCap: true });
  }

  profXP('crafting', 14);
  awardXP(6, 'craft');
  GameState.notify(CH.INVENTORY);
  Bus.emit('crafted', r.id);
  return { ok: true };
}

/** Recipes enriched for the UI panel. */
export function recipesForUI(category = 'all') {
  const count = (id) => st().inventory.reduce((n, e) => n + (e.id === id ? e.qty : 0), 0);
  return RECIPES.filter((r) => category === 'all' || r.cat === category).map((r) => ({
    ...r,
    def: getItem(r.out),
    reason: blockReason(r),
    haveCounts: Object.fromEntries(Object.entries(r.cost).map(([id]) => [id, count(id)])),
    durSec: craftDurationSec(r)
  }));
}

