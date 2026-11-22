// ITEM & WEAPON GATE — the professional-content contract for everything the
// player can hold, wear or swing.
//
// Three classes of bug shipped in this data before this suite existed:
//   • items rendering their internal ids (`wooden_sword`, `iron_plate`) because
//     the armor helper discarded its name argument;
//   • an entire ARPG weapon line with no recipe, no loot and no quest — nine
//     weapons a player could never obtain;
//   • a rarity ladder that paid a mythic bow LESS damage per second than a
//     legendary dagger.
//
// This suite enforces the fixes: every item is named and described, every
// weapon sits inside its rarity's DPS band, every epic+ weapon has an identity,
// every special is implemented, and every gear item has a real source.
import assert from 'node:assert/strict';
import { ITEMS, getItem } from '../src/game/data/items.ts';
import { RECIPES } from '../src/game/data/recipes.ts';
import { MAIN_QUESTS } from '../src/game/data/questsMain.ts';
import { SIDE_QUESTS } from '../src/game/data/questsSide.ts';
import { ALL_ENEMY_DEFS } from '../src/game/data/enemies.ts';
import { CHEST_POOLS } from '../src/game/data/lootTables.ts';
import { STARTER_KIT } from '../src/game/core/stateFactory.ts';
import { BUILDINGS } from '../src/game/data/buildings.ts';
import { RARITY } from '../src/game/data/itemDefs.ts';
import { WEAPON_SPECIAL_IDS } from '../src/game/systems/combat/WeaponSpecials.ts';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

const items = Object.entries(ITEMS);
const weapons = items.filter(([, d]) => d.cat === 'weapon');
const gear = items.filter(([, d]) => ['weapon', 'offhand', 'armor', 'trinket', 'tool'].includes(d.cat));

/* ── 1. Every item is player-facing ─────────────────────────────────────── */
// A name equal to the id means the inventory shows `wooden_sword`.
for (const [id, d] of items) {
  ok(d.name && d.name !== id, `${id}: has a real display name (got "${d.name}")`);
  ok(d.name && !/[_]/.test(d.name), `${id}: name has no raw underscores`);
  ok(typeof d.desc === 'string' && d.desc.length >= 8, `${id}: has a description`);
  ok(d.desc && !/^TODO|placeholder|lorem/i.test(d.desc), `${id}: description is written`);
  ok(typeof d.value === 'number' && d.value > 0, `${id}: is worth something`);
  ok(d.rarity && RARITY[d.rarity], `${id}: rarity '${d.rarity}' is a real tier`);
}

/* ── 2. Every weapon is a complete, legible weapon ──────────────────────── */
const STYLES = new Set(['slash', 'crush', 'pierce', 'bow', 'staff']);
for (const [id, d] of weapons) {
  const w = d.weapon || {};
  ok(!!w, `${id}: has weapon stats`);
  ok(typeof w.dmg === 'number' && w.dmg > 0, `${id}: positive damage`);
  ok(typeof w.cd === 'number' && w.cd > 0, `${id}: positive cooldown`);
  ok(typeof w.range === 'number' && w.range > 0, `${id}: positive reach`);
  ok(STYLES.has(w.style), `${id}: style '${w.style}' is one the combat path understands`);
  ok(typeof w.crit === 'number' && w.crit >= 0 && w.crit <= 1, `${id}: crit chance in range`);
  if (w.special) ok(WEAPON_SPECIAL_IDS.includes(w.special), `${id}: special '${w.special}' is implemented`);
}

/* ── 3. The rarity ladder holds (no mythic weaker than a legendary) ─────── */
// Band floor/ceiling per rarity. Slow weapons sit high in the band, fast ones
// low; a weapon outside its band is either a typo or an unannounced exception.
const BANDS = {
  common: [12, 30],
  uncommon: [28, 42],
  rare: [40, 56],
  epic: [54, 66],
  legendary: [68, 80],
  mythic: [84, 96]
};
const dpsOf = (d) => d.weapon.dmg / d.weapon.cd;
for (const [id, d] of weapons) {
  const band = BANDS[d.rarity || 'common'];
  const dps = dpsOf(d);
  ok(!!band, `${id}: rarity '${d.rarity}' has a declared DPS band`);
  if (band) ok(dps >= band[0] && dps <= band[1],
    `${id}: ${dps.toFixed(1)} dps sits in the ${d.rarity} band ${band[0]}–${band[1]}`);
}

// Within each rarity, a slower weapon should not be weaker than a faster one
// by more than its crit advantage can explain — check the spread, not order.
for (const r of Object.keys(BANDS)) {
  const row = weapons.filter(([, d]) => (d.rarity || 'common') === r);
  if (row.length < 2) continue;
  const dps = row.map(([, d]) => dpsOf(d));
  const spread = Math.max(...dps) / Math.min(...dps);
  ok(spread <= 2.2, `${r}: its weapons are within a 2.2x DPS spread (${spread.toFixed(2)}x)`);
}

/* ── 4. Every epic+ weapon has an identity, not just numbers ────────────── */
for (const [id, d] of weapons) {
  if (!['epic', 'legendary', 'mythic'].includes(d.rarity)) continue;
  const w = d.weapon;
  const identity = !!w.special || (w.pierce || 0) > 0 || (w.manaCost || 0) > 0;
  ok(identity, `${id}: ${d.rarity} weapon has a mechanic (special, pierce or mana)`);
}
for (const sid of WEAPON_SPECIAL_IDS) {
  ok(weapons.some(([, d]) => d.weapon?.special === sid), `special '${sid}' is used by a real weapon`);
}

/* ── 5. Every gear item has a real source ──────────────────────────────── */
const sources = new Set();
for (const r of RECIPES) sources.add(r.out);
for (const q of [...Object.values(MAIN_QUESTS), ...Object.values(SIDE_QUESTS)]) {
  for (const id of Object.keys(q.rewards?.items || {})) sources.add(id);
}
for (const e of Object.values(ALL_ENEMY_DEFS)) {
  for (const l of e.loot || []) sources.add(l.id);
}
for (const pool of Object.values(CHEST_POOLS)) {
  for (const [id] of pool) sources.add(id);
}
for (const entry of STARTER_KIT()) sources.add(entry.id);

for (const [id, d] of gear) {
  ok(sources.has(id), `${id} (${d.cat}): obtainable — recipe, loot, chest, quest or starter`);
}

/* ── 6. Recipes are complete and point at real things ──────────────────── */
const STATIONS = new Set(Object.keys(BUILDINGS));
for (const r of RECIPES) {
  ok(!!getItem(r.out), `recipe '${r.id}': output '${r.out}' is a real item`);
  ok(r.qty > 0, `recipe '${r.id}': produces something`);
  ok(Object.keys(r.cost || {}).length > 0, `recipe '${r.id}': has a cost`);
  for (const [id, n] of Object.entries(r.cost || {})) {
    ok(!!getItem(id), `recipe '${r.id}': ingredient '${id}' is a real item`);
    ok(n > 0, `recipe '${r.id}': ingredient '${id}' has a positive amount`);
  }
  if (r.station) ok(STATIONS.has(r.station), `recipe '${r.id}': station '${r.station}' is a real building`);
}
const dupeOuts = RECIPES.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i);
ok(dupeOuts.length === 0, `no duplicate recipe ids (${dupeOuts.join(', ') || 'clean'})`);

/* ── 7. Consumables do something ───────────────────────────────────────── */
for (const [id, d] of items) {
  if (d.cat !== 'consumable') continue;
  ok(d.use && Object.keys(d.use).length > 0, `${id}: a consumable has an effect`);
  ok(d.stack > 1, `${id}: consumables stack`);
}

console.log(`items: ${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} item assertion(s) failed`);
