// ─────────────────────────────────────────────────────────────────────────────
// Kingdom simulation core (spec §25–27, §72–74). PURE functions — no Phaser,
// fully testable. The orchestration wrapper lives in KingdomSystem.js.
// ─────────────────────────────────────────────────────────────────────────────
import { SETTLEMENT_CONFIG, MILITARY_CONFIG } from '../core/Constants.js';
import { getBuildingDef } from '../data/buildings.js';

export function aggregateBuildings(buildings) {
  const agg = {
    counts: {}, housing: 0, jobSlots: {}, storageSlots: 0,
    defenseStructural: 0, taxPerDay: 0, tradePriceTier: 0,
    stations: {}, warmthRadius: 0, marketTier: 0
  };
  for (const b of buildings) {
    if (!b.complete) continue;
    agg.counts[b.key] = (agg.counts[b.key] || 0) + 1;
    const def = getBuildingDef(b.key);
    if (!def) continue;
    const tier = b.tier;
    if (def.effects.housing) agg.housing += def.effects.housing + (tier > 1 ? tier : 0);
    if (def.jobs) {
      agg.jobSlots[def.jobs] = (agg.jobSlots[def.jobs] || 0);
      agg.jobSlots[def.jobs] += 1 + (tier - 1) * 0.5;
    }
    if (def.effects.storageSlots) agg.storageSlots += def.effects.storageSlots;
    // structural defense sources
    if (b.key === 'wall') agg.defenseStructural += (tier === 2 ? 3 : 2);
    if (b.key === 'gate') agg.defenseStructural += 4;
    if (def.defenseByTier) agg.defenseStructural += def.defenseByTier[Math.min(tier, def.defenseByTier.length) - 1];
    if (b.key === 'townhall' && def.tierDefense) agg.defenseStructural += def.tierDefense[tier - 1];
    if (b.key === 'temple') agg.defenseStructural += 2;
    if (b.key === 'fortress') agg.defenseStructural += 45;
    // taxes / markets
    if (def.taxPerDay) agg.taxPerDay += def.taxPerDay[Math.min(tier, def.taxPerDay.length) - 1];
    if (b.key === 'market') agg.marketTier = Math.max(agg.marketTier, tier);
    // crafting stations
    if (def.station) agg.stations[def.station] = true;
  }
  return agg;
}

export function jobCapacity(agg) {
  return Object.entries(agg.jobSlots).reduce((acc, [job, slots]) => ({ ...acc, [job]: Math.floor(slots) }), {});
}

export function militaryPower(military, moraleMult, commandMult) {
  let power = 0;
  for (const [type, n] of Object.entries(military)) {
    const cfg = MILITARY_CONFIG.types[type];
    if (cfg && n > 0) power += cfg.power * n;
  }
  return Math.round(power * moraleMult * commandMult);
}

/** Happiness model: clear factors the player can act on (spec §27). */
export function computeHappiness(input) {
  const h =
    50 +
    input.foodSecurity * 22 -
    input.housingShortage * 18 +
    input.employmentScore * 12 -
    input.taxPressure * 16 +
    input.templeJoy +
    input.safetySense * 10 +
    (input.skillFlat || 0);
  return Math.round(Math.max(5, Math.min(100, h)));
}

export function foodSecurityScore(starving, foodDays) {
  if (starving) return -0.6;
  if (foodDays < 1) return -0.35;
  if (foodDays < 3) return 0;
  if (foodDays < 7) return 0.6;
  return 1;
}

export function evaluateStage(stageIndex, counters) {
  const reqs = SETTLEMENT_CONFIG.stages[stageIndex + 1];
  if (!reqs) return { canAdvance: false, maxed: true };
  const missing = [];
  const okBuildings = () => {
    for (const [key, count] of Object.entries(reqs.buildings || {})) {
      if ((counters.buildingsByKey[key] || 0) < count) missing.push(`${count}× ${getBuildingDef(key)?.label ?? key}`);
    }
  };
  okBuildings();
  if (reqs.citizens && counters.citizens < reqs.citizens) missing.push(`${reqs.citizens} citizens`);
  if (reqs.happiness != null && counters.happiness < reqs.happiness) missing.push(`happiness ${reqs.happiness}`);
  if (reqs.defense != null && counters.defensePower < reqs.defense) missing.push(`defense ${reqs.defense}`);
  if (reqs.territory && counters.territories < reqs.territory) missing.push(`${reqs.territory} territories`);
  if (reqs.militaryPower && counters.militaryPower < reqs.militaryPower) missing.push(`army ${reqs.militaryPower}`);
  if (reqs.chapterCompleted && !counters.flags[reqs.chapterCompleted]) missing.push('story progress');
  return { canAdvance: missing.length === 0, missing, maxed: false };
}

/** Food "days" estimate from current stores vs population appetite. */
export function estimateFoodDays(foodUnits, population, drainPerCitizenPerDay = 2.2) {
  if (population <= 0) return 99;
  return Math.max(0, +(foodUnits / (population * drainPerCitizenPerDay)).toFixed(1));
}
