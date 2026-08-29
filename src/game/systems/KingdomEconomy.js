// ─────────────────────────────────────────────────────────────────────────────
// Kingdom economy (2/2): periodic production/consumption tick, overflow
// stockpile for away-production, daily taxes, military recruitment & power.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { CH } from '../core/EventBus.js';
import { SETTLEMENT_CONFIG, MILITARY_CONFIG } from '../core/Constants.js';
import { getBuildingDef } from '../data/buildings.js';
import { aggregateBuildings } from './kingdomSim.js';
import { addItem, countItem, spendItems, hasItems, removeItem } from './InventorySystem.js';
import { addGold } from './ProgressionSystem.js';
import {
  refresh, claimRadius, aggregateDefense
} from './KingdomSystem.js';

const st = () => GameState.s;

/** Deposit into the settlement overflow stockpile (capped 300 units). */
export function depositOverflow(id, qty) {
  const ov = st().settlement.overflow;
  const e = ov.find((x) => x.id === id);
  if (e) e.qty += qty;
  else ov.push({ id, qty });
  let total = ov.reduce((s, x) => s + x.qty, 0);
  while (total > 300 && ov.length) {
    const first = ov[0];
    const cut = Math.min(first.qty, total - 300);
    first.qty -= cut;
    total -= cut;
    if (first.qty <= 0) ov.shift();
  }
}

/** Player standing near their hall collects the overflow. */
export function claimOverflow() {
  const ov = st().settlement.overflow;
  if (!ov.length) return 0;
  let claimed = 0;
  for (const e of [...ov]) {
    const leftover = addItem(e.id, e.qty);
    claimed += e.qty - leftover;
    if (leftover > 0) e.qty = leftover;
    else ov.splice(ov.indexOf(e), 1);
  }
  GameState.notify(CH.INVENTORY, CH.SETTLEMENT);
  return claimed;
}

export const overflowTotalUnits = () =>
  st().settlement.overflow.reduce((s, x) => s + x.qty, 0);

function marketTaxPerDay() {
  let tax = 0;
  for (const b of st().settlement.buildings) {
    if (!b.complete) continue;
    const def = getBuildingDef(b.key);
    if (def?.taxPerDay) tax += def.taxPerDay[Math.min(b.tier, def.taxPerDay.length) - 1];
  }
  return tax;
}

let lastTaxDay = -1;
function collectTaxesIfDawn() {
  const day = st().world.dayCount;
  if (lastTaxDay === day || st().world.timeOfDay > 0.05) return;
  lastTaxDay = day;
  const base = marketTaxPerDay();
  if (base <= 0) return;
  const mult = 1 + (st().player.derived?.taxBonus || 0) + (st().settlement.happiness - 50) / 250;
  const gold = Math.max(1, Math.round(base * mult));
  addGold(gold);
  GameState.toast({ title: 'Daily tariffs collected', msg: `+${gold} gold from your markets`, kind: 'info' });
}

/** Eat from shared stores: bulk crops first, delicacies last. Returns satisfied. */
export function consumeFood(unitsNeeded) {
  let left = unitsNeeded;
  for (const [id, w] of [
    ['wheat', 0.9], ['berries', 0.5], ['mushrooms', 0.5], ['raw_meat', 0.7], ['raw_fish', 0.6],
    ['cooked_meat', 1.1], ['cooked_fish', 1.0], ['bread', 1.6], ['hearty_stew', 2.2], ['honeycomb', 0.5]
  ]) {
    if (left <= 0.001) break;
    const have = countItem(id);
    if (have <= 0) continue;
    const eatQty = Math.min(have, Math.ceil(left / w));
    if (removeItem(id, eatQty)) left -= eatQty * w;
  }
  return left <= 0.02;
}

/**
 * Runs every SETTLEMENT_CONFIG.productionTickSec while in world.
 * playerPos = {x,y} | null (null during fast travel).
 */
export function productionTick(playerPos) {
  const S = st();
  if (!S.settlement.founded) return null;
  const agg = aggregateBuildings(S.settlement.buildings);
  const happinessFactor = 0.55 + (S.settlement.happiness / 100) * 0.65;
  const prodMult = happinessFactor * (S.player.derived?.productionMult || 1);

  const yields = {};
  for (const b of S.settlement.buildings) {
    if (!b.complete || !b.workerUid) continue;
    const def = getBuildingDef(b.key);
    if (!def?.produce) continue;
    const worker = S.settlement.citizens.find((c) => c.uid === b.workerUid);
    if (!worker) continue;
    const eff = 0.75 + worker.skillLv * 0.12;
    const frac = SETTLEMENT_CONFIG.productionTickSec / 60;
    for (const [resId, perMin] of Object.entries(def.produce)) {
      let amt = perMin * eff * prodMult * frac;
      if (b.tier >= 2 && def.tierProduceBonus?.[resId]) amt += def.tierProduceBonus[resId] * prodMult * frac;
      if (b.key === 'mine' && b.mountainAffinity && resId === 'iron_ore') amt *= 1.5;
      yields[resId] = (yields[resId] || 0) + amt;
    }
  }

  const nearHall =
    playerPos && S.settlement.pos &&
    Math.hypot(playerPos.x - S.settlement.pos.x, playerPos.y - S.settlement.pos.y) < claimRadius();

  for (const [id, amount] of Object.entries(yields)) {
    const qty = Math.floor(amount);
    if (qty > 0) (nearHall ? addItem(id, qty) : depositOverflow(id, qty));
  }

  // Citizens eat; starving hurts happiness.
  const fed = consumeFood(0.0008 * Math.max(1, S.settlement.citizens.length));
  if (!fed && S.settlement.citizens.length > 0) {
    S.settlement.happiness = Math.max(5, S.settlement.happiness - 4);
  }
  collectTaxesIfDawn();
  refresh();
  GameState.session.lastProductionSummary = yields;
  return yields;
}

/* ── Military recruitment (spec §73) ───────────────────────────────────── */
export function canRecruitUnit(type) {
  const cfg = MILITARY_CONFIG.types[type];
  if (!cfg) return { ok: false, reason: 'Unknown unit' };
  if (cfg.reqBuilding && !st().settlement.buildings.some((b) => b.key === cfg.reqBuilding && b.complete)) {
    return { ok: false, reason: `Requires ${cfg.reqBuilding}` };
  }
  const gearCost = {};
  for (const [k, v] of Object.entries(cfg.cost)) if (k !== 'gold' && k !== 'royal_rep') gearCost[k] = v;
  if (st().player.gold < (cfg.cost.gold || 0)) return { ok: false, reason: 'Not enough gold' };
  if (!hasItems(gearCost)) return { ok: false, reason: 'Missing equipment resources' };
  const armyNow = Object.values(st().settlement.military).reduce((a, b) => a + b, 0);
  if (armyNow >= st().player.derived.armyCap) return { ok: false, reason: `Army cap ${st().player.derived.armyCap}` };
  return { ok: true };
}

export function recruitUnit(type) {
  const chk = canRecruitUnit(type);
  if (!chk.ok) return chk;
  const cost = { ...MILITARY_CONFIG.types[type].cost };
  delete cost.royal_rep;
  if (!spendItems(cost)) return { ok: false, reason: 'Resources changed' };
  st().settlement.military[type]++;
  refresh();
  GameState.toast({ title: `${cap(type)} enlisted`, msg: 'They muster beneath your banner.', kind: 'info' });
  GameState.notify(CH.SETTLEMENT, CH.PLAYER);
  return { ok: true };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

