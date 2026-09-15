// ─────────────────────────────────────────────────────────────────────────────
// Kingdom orchestration: live snapshot into session.kingdom, happiness model,
// defense totals, settlement-stage advancement, citizen management.
// Pure sim math lives in kingdomSim.js; economy ticks in KingdomEconomy.js.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { SETTLEMENT_CONFIG, MILITARY_CONFIG, BUILD_RADIUS_FROM_HALL } from '../core/Constants.ts';
import { aggregateBuildings, jobCapacity, computeHappiness, foodSecurityScore, evaluateStage, estimateFoodDays, militaryPower } from './kingdomSim.ts';
import type { BuildingAggregate, StageCounters } from './kingdomSim.ts';
import type { GameRootState, SettlementCitizen } from '../core/stateFactory.ts';
import { countItem } from './InventorySystem.ts';

const st = (): GameRootState => GameState.s;

/** Live kingdom snapshot published to session.kingdom. */
export type KingdomSnapshot = Record<string, any>;

export const claimRadius = (): number =>
  BUILD_RADIUS_FROM_HALL[Math.min(st().settlement.stageIndex, BUILD_RADIUS_FROM_HALL.length - 1)] ?? 900;

export function aggregateDefense(agg: BuildingAggregate): number {
  return agg.defenseStructural || 0;
}

const FOOD_WEIGHTS: [string, number][] = [
  ['bread', 1.6], ['hearty_stew', 2.2], ['cooked_meat', 1.1], ['cooked_fish', 1.0],
  ['wheat', 0.9], ['berries', 0.5], ['mushrooms', 0.5], ['honeycomb', 0.5],
  ['raw_meat', 0.7], ['raw_fish', 0.6]
];

export function totalFoodUnits(): number {
  let u = 0;
  for (const [id, w] of FOOD_WEIGHTS) u += countItem(id) * w;
  return Math.round(u);
}

export function militaryPowerTotal(): number {
  const S = st();
  const morale = MILITARY_CONFIG.moraleFromHappiness(S.settlement.happiness);
  return militaryPower(S.settlement.military, morale, S.player.derived?.militaryPowerMult || 1);
}

export function defensePowerTotal(): number {
  return Math.round(militaryPowerTotal() * 0.5 + aggregateDefense(aggregateBuildings(st().settlement.buildings)));
}

function stageCounters(): StageCounters {
  const S = st();
  const counters: StageCounters = {
    buildingsByKey: {},
    citizens: S.settlement.citizens.length,
    happiness: S.settlement.happiness,
    defensePower: defensePowerTotal(),
    territories: S.world.ownedCamps.length + 1,
    militaryPower: militaryPowerTotal(),
    flags: S.story.flags
  };
  for (const b of S.settlement.buildings) if (b.complete) counters.buildingsByKey[b.key] = (counters.buildingsByKey[b.key] || 0) + 1;
  return counters;
}

/** Recompute settlement snapshot; advances stages when eligible. */
export function refresh(): KingdomSnapshot | null {
  const S = st();
  if (!S) return null;
  if (!GameState.session.kingdom) GameState.session.kingdom = {};
  const k: KingdomSnapshot = GameState.session.kingdom;
  const agg = aggregateBuildings(S.settlement.buildings);
  const pop = S.settlement.citizens.length;
  const cap = jobCapacity(agg);

  const housingShortage = Math.max(0, pop - agg.housing);
  const foodUnits = totalFoodUnits();
  const foodDays = estimateFoodDays(foodUnits, Math.max(pop, 1));
  const starving = foodDays <= 0.15 && pop > 0;
  const taxPressure = S.settlement.stageIndex >= 4 ? 0.35 : S.settlement.stageIndex >= 2 ? 0.2 : 0.08;
  const assignedAll = S.settlement.citizens.filter((c) => c.job && c.job !== 'idle').length;
  const assignableTotal = Object.values(cap).reduce((a, b) => a + b, 0);

  const happiness = S.settlement.founded
    ? computeHappiness({
        foodSecurity: foodSecurityScore(starving, foodDays),
        housingShortage,
        employmentScore: assignableTotal > 0 ? (assignedAll / assignableTotal) * 0.8 + 0.2 : 0.5,
        taxPressure,
        templeJoy: agg.counts.temple ? 10 : 0,
        safetySense: Math.min(1, agg.defenseStructural / 80),
        skillFlat: S.player.derived?.happinessFlat || 0
      })
    : 62;
  S.settlement.happiness = happiness;

  Object.assign(k, {
    population: pop, housing: agg.housing, housingShortage,
    jobCapacity: cap, storageSlots: agg.storageSlots,
    defenseStructural: agg.defenseStructural, marketTier: agg.marketTier,
    taxPerDay: agg.taxPerDay, foodUnits, foodDays, starving, happiness,
    moraleMult: MILITARY_CONFIG.moraleFromHappiness(happiness)
  });

  checkStageAdvance();
  GameState.notify(CH.SETTLEMENT);
  return k;
}

function checkStageAdvance(): void {
  const S = st();
  if (!S.settlement.founded) return;
  const evalRes = evaluateStage(S.settlement.stageIndex, stageCounters());
  if (evalRes.canAdvance && !evalRes.maxed) {
    S.settlement.stageIndex++;
    // Latent-bug fix surfaced by typing: the pre-migration code read the
    // requirement object from `stages` and called `.toUpperCase()` on it,
    // which throws on the first stage advance. The display name lives in
    // `stageNames`.
    const name: string = SETTLEMENT_CONFIG.stageNames[S.settlement.stageIndex] ?? '';
    GameState.toast({ title: `${name.toUpperCase()}!`, msg: 'Your realm ascends a rung of history.', kind: 'stage', dur: 5200 });
    Bus.emit('stage-reached', { index: S.settlement.stageIndex });
    import('./QuestEngine.ts').then((q) => q.handleEvent({ type: 'stage-reached', index: S.settlement.stageIndex })).catch(() => {});
    import('./AchievementSystem.ts').then((a) => a.evaluateAll()).catch(() => {});
  }
}

export function stageRequirementsMissing(): { canAdvance: boolean; missing?: string[]; maxed: boolean } {
  if (!st().settlement.founded) return { canAdvance: false, missing: ['Found your settlement first'], maxed: false };
  return evaluateStage(st().settlement.stageIndex, stageCounters());
}

export function territoryPct(): number {
  const owned = st().world.ownedCamps.length + (st().settlement.founded ? 1 : 0);
  const pct = Math.round((owned / 18) * 100);
  GameState.session.territoryPct = pct;
  return pct;
}

/* ── Citizens (spec §26) ───────────────────────────────────────────────── */
let uidSeq = 99000 + ((Date.now() % 7919) | 0);
const nextUid = (): string => `c${++uidSeq}`;

/** Options accepted by recruitCitizen (all but name optional). */
export interface RecruitOpts {
  name: string;
  role?: string;
  skillLv?: number;
}

export function recruitCitizen({ name, role = 'worker', skillLv = 1 }: RecruitOpts): SettlementCitizen {
  const c: SettlementCitizen = {
    uid: nextUid(), name, role, job: role === 'worker' ? 'idle' : role, skillLv,
    recruitedAt: st().world.dayCount
  };
  st().settlement.citizens.push(c);
  GameState.notify(CH.SETTLEMENT);
  Bus.emit('population-change');
  import('./QuestEngine.ts').then((q) => q.handleEvent({ type: 'population', count: st().settlement.citizens.length })).catch(() => {});
  import('./AchievementSystem.ts').then((a) => a.evaluateAll()).catch(() => {});
  return c;
}

/** Unhappy citizen packs up and leaves (consequence of starvation/unrest). */
export function citizenLeaves(uid: string): SettlementCitizen | null {
  const list = st().settlement.citizens;
  const i = list.findIndex((c) => c.uid === uid);
  if (i < 0) return null;
  const [gone] = list.splice(i, 1);
  if (!gone) return null;
  for (const b of st().settlement.buildings) if (b.workerUid === gone.uid) b.workerUid = null;
  refresh();
  return gone;
}

export function assignWorker(buildingUid: string, citizenUid?: string | null): boolean {
  const b = st().settlement.buildings.find((x) => x.uid === buildingUid);
  if (!b) return false;
  b.workerUid = citizenUid || null;
  refresh();
  return true;
}
