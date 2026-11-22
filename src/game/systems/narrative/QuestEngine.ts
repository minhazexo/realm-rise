// ─────────────────────────────────────────────────────────────────────────────
// Quest engine (1/2): event → progress → completion. The world sim emits GEV
// gameplay events; this reducer advances step progress and grants rewards.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../../core/GameState.ts';
import { Bus, CH } from '../../core/EventBus.ts';
import { MAIN_QUESTS, QUEST_ORDER } from '../../data/questsMain.ts';
import type { QuestDef, QuestStep } from '../../data/questsMain.ts';
import { SIDE_QUESTS } from '../../data/questsSide.ts';
import { awardXP, addReputation } from '../combat/ProgressionSystem.ts';
import { addItem } from '../combat/InventorySystem.ts';
import type { GameRootState } from '../../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

/** Gameplay event (GEV) fed into the quest state machine. */
export interface GameplayEvent {
  type: string;
  amount?: number;
  enemy?: string;
  boss?: string;
  item?: string;
  itemId?: string;
  building?: string;
  poiTag?: string;
  poiKind?: string;
  npc?: string;
  flag?: string;
  count?: number;
  resource?: string;
  index?: number;
  pct?: number;
  [key: string]: unknown;
}

export const allDefs = (): Record<string, QuestDef> => ({ ...MAIN_QUESTS, ...SIDE_QUESTS });
export const mainOrder = (): string[] => QUEST_ORDER;

export function currentMainQuest(): QuestDef | null {
  const q = st()?.quests;
  if (!q) return null;
  const order: string[] = QUEST_ORDER;
  const idx: number = Math.min(q.chainIndex, order.length - 1);
  const id: string | undefined = order[idx];
  if (id === undefined) return null;
  return MAIN_QUESTS[id] ?? null;
}

export const progKey = (qid: string, i: number): string => `${qid}:${i}`;
/**
 * Step progress. A `flag` step is read through the world's own flags first, so
 * a save that already did the work (took a shard, raised the anchor, forged
 * Dawnbreaker) can never be asked to do it again — and an old save cannot get
 * stuck on a step whose event fired before the quest became current.
 */
export function stepProgress(qid: string, idx: number): number {
  const recorded: number = st().quests.progress[progKey(qid, idx)] || 0;
  const def: QuestDef | undefined = MAIN_QUESTS[qid] || SIDE_QUESTS[qid];
  const step: QuestStep | undefined = def?.steps?.[idx];
  if (step?.type === 'flag' && step.flag && st().story.flags[step.flag]) {
    return Math.max(recorded, step.count || 1);
  }
  return recorded;
}
/** Is this quest currently tracked (main head or side)? */
export function isQuestActive(qid: string): boolean {
  const S = st().quests;
  return currentMainQuest()?.id === qid || S.sideActive?.includes(qid);
}
export function setFlag(flag: string, value: unknown = true): void {
  st().story.flags[flag] = value;
  handleEvent({ type: 'flagset', flag });
  GameState.notify(CH.STORY);
}

/**
 * Seed the progress of every flag step the world already satisfies, and return
 * how many were seeded. Called when a main quest becomes current and when a
 * side quest is offered, so both paths share one rule.
 */
export function seedSatisfiedFlagSteps(def: QuestDef | null | undefined): number {
  if (!def?.steps) return 0;
  let seeded = 0;
  def.steps.forEach((step, i) => {
    if (step.type !== 'flag' || !step.flag) return;
    if (!st().story.flags[step.flag]) return;
    const key: string = progKey(def.id, i);
    const need: number = step.count || 1;
    if ((st().quests.progress[key] || 0) >= need) return;
    st().quests.progress[key] = need;
    seeded++;
  });
  return seeded;
}

/**
 * Guards against completion re-entering itself: granting a reward flag calls
 * setFlag, which fires a `flagset` event, which runs checkCompletion — and a
 * quest whose steps are all already done would complete all over again,
 * recursing until the stack blew. Completion happens exactly once.
 */
const completing: Set<string> = new Set();

/** Mark a quest complete and grant rewards (also used by test harness). */
export function completeQuest(def: QuestDef): void {
  if (completing.has(def.id)) return;
  completing.add(def.id);
  try { completeQuestOnce(def); } finally { completing.delete(def.id); }
}

function completeQuestOnce(def: QuestDef): void {
  const S = st().quests;
  const r = def.rewards || {};
  if (r.xp) awardXP(r.xp, 'quest');
  if (r.gold) st().player.gold += r.gold;
  if (r.rep) addReputation(r.rep);
  if (r.items) for (const [id, n] of Object.entries(r.items)) addItem(id, n, { ignoreCap: true });
  if (r.happinessTown) st().settlement.happiness = Math.min(100, st().settlement.happiness + r.happinessTown);
  // Reward flags and completion flags are both real: `flagsSet` is what the
  // reward bundle promises (story beats like warden_slain), `flagsOnComplete`
  // is the quest's own aftermath. Missing flagsSet silently locked every
  // flag-gated vault the data declared.
  for (const f of r.flagsSet || []) setFlag(f);
  for (const f of def.flagsOnComplete || []) setFlag(f);

  GameState.toast({
    title: 'QUEST COMPLETE',
    msg: `${def.title}${r.gold ? ` · +${r.gold} gold` : ''}${r.xp ? ` · +${r.xp} XP` : ''}`,
    kind: 'quest', dur: 4600
  });

  if (MAIN_QUESTS[def.id]) {
    if (S.chainIndex < QUEST_ORDER.length - 1) {
      S.chainIndex++;
      const next: QuestDef | null = currentMainQuest();
      // A player who already holds the shards (or has already raised the
      // anchor) must not be handed a checklist of things they did an hour ago.
      const seeded: number = seedSatisfiedFlagSteps(next);
      if (next?.intro) GameState.toast({ title: next.title.toUpperCase(), msg: next.intro, kind: 'story', dur: 6500 });
      Bus.emit('main-advanced', { index: S.chainIndex, id: next?.id });
      if (next && seeded > 0) checkCompletion(next);
    }
  } else {
    S.sideActive = S.sideActive.filter((id) => id !== def.id);
    if (!S.sideCompleted.includes(def.id)) S.sideCompleted.push(def.id);
  }

  GameState.notify(CH.QUESTS);
  Bus.emit('quest-completed', def.id);
  import('./StorySystem.ts').then((m) => m.evaluate()).catch(() => {});
    import('./AchievementSystem.ts').then((m) => m.evaluateAll()).catch(() => {});
}

/**
 * Re-run completion for every active quest. Used when a quest is accepted into a
 * world that already satisfies it: a player who took a fragment before Mara
 * offered the link would otherwise carry an unfinishable journal entry, because
 * the engine only advances on NEW events (see QuestSystem.offerSideQuest).
 */
export function recheckActive(): void {
  const main: QuestDef | null = currentMainQuest();
  if (main) checkCompletion(main);
  for (const sid of [...st().quests.sideActive]) {
    const def: QuestDef | undefined = SIDE_QUESTS[sid];
    if (def) checkCompletion(def);
  }
}

function checkCompletion(def: QuestDef): boolean {
  if (!def?.steps || !isQuestActive(def.id)) return false;
  for (let i = 0; i < def.steps.length; i++) {
    const step: QuestStep | undefined = def.steps[i];
    if (!step || stepProgress(def.id, i) < (step.count || 1)) return false;
  }
  completeQuest(def);
  return true;
}

/** Active deliver steps for one NPC (outstanding amounts included). */
export interface PendingDelivery {
  qid: string;
  idx: number;
  item: string;
  need: number;
  have: number;
}
export function pendingDeliveries(npcKey: string): PendingDelivery[] {
  const out: PendingDelivery[] = [];
  const S = st().quests;
  const collect = (def: QuestDef | null | undefined): void => {
    if (!def?.steps || !isQuestActive(def.id)) return;
    def.steps.forEach((step, idx) => {
      if (step.type !== 'deliver' || (step as { npc?: string }).npc !== npcKey || !step.item) return;
      const need: number = step.count || 1;
      const have: number = stepProgress(def.id, idx);
      if (have >= need) return;
      out.push({ qid: def.id, idx, item: step.item, need, have });
    });
  };
  collect(currentMainQuest());
  for (const sid of [...S.sideActive]) collect(SIDE_QUESTS[sid]);
  return out;
}

/** Feed one gameplay event into the quest state machine. */
export function handleEvent(gev: GameplayEvent): void {
  const S = st().quests;
  let touched = false;
  const tryQuest = (def: QuestDef | null | undefined): void => {
    if (!def?.steps || !isQuestActive(def.id)) return;
    let localTouched = false;
    def.steps.forEach((step, idx) => {
      const need: number = step.count || 1;
      if (stepProgress(def.id, idx) >= need) return;
      if (!matchStep(gev, step)) return;
      const key: string = progKey(def.id, idx);
      // Threshold steps (territory/population/stage/stores) carry their value
      // on the event — snapping to it beats +1-per-event, which could never
      // reach counts like 40% territory from a handful of captures.
      const isThreshold: boolean =
        step.type === 'territory' || step.type === 'population' ||
        step.type === 'stage' || step.type === 'stores';
      let gain = 1;
      if (step.type === 'gather' || step.type === 'deliver' || step.type === 'stores') {
        gain = gev.amount != null ? gev.amount : 1;
      } else if (step.type === 'territory') {
        gain = gev.pct != null ? gev.pct : 1;
      } else if (step.type === 'population') {
        gain = gev.count != null ? gev.count : 1;
      } else if (step.type === 'stage') {
        gain = gev.index != null ? gev.index : 1;
      }
      const cur: number = S.progress[key] || 0;
      S.progress[key] = Math.min(need, isThreshold ? Math.max(cur, gain) : cur + gain);
      if (S.progress[key] >= need) Bus.emit('quest-step-done', { qid: def.id, idx });
      touched = localTouched = true;
    });
    void localTouched;
    checkCompletion(def);
  };

  tryQuest(currentMainQuest());
  for (const sid of [...S.sideActive]) tryQuest(SIDE_QUESTS[sid]);
  if (touched) GameState.notify(CH.QUESTS);
  announceCoronation();
  announceBannerBargain();
}

/**
 * Chapter IV's bargain has no NPC to walk to either: once its other steps are
 * done, say so once and point at the Crown panel. The choice itself lives in
 * PolicySystem (one owner for the consequence bundle).
 */
function announceBannerBargain(): void {
  try {
    const flags = st().story.flags as Record<string, unknown>;
    if (flags.banner_announced || flags.policy_banner) return;
    const main = currentMainQuest();
    if (!main || main.id !== 'q_rising_banner') return;
    const steps = main.steps || [];
    const choiceIdx = steps.findIndex((s) => s.type === 'choice' && s.choiceId === 'banner_policy');
    if (choiceIdx < 0) return;
    for (let i = 0; i < steps.length; i++) {
      if (i === choiceIdx) continue;
      if (stepProgress(main.id, i) < (steps[i]?.count || 1)) return;
    }
    if (stepProgress(main.id, choiceIdx) >= 1) return;
    flags.banner_announced = true;
    GameState.toast({
      title: 'THREE OFFERS AT YOUR GATE',
      msg: 'The Verdant Clans, the Merchant League and the Iron Kingdom all want your banner. Open the Crown panel (R) to choose.',
      kind: 'story',
      dur: 9000
    });
    GameState.notify(CH.QUESTS, CH.STORY);
  } catch { /* announcement never blocks quests */ }
}

/**
 * The coronation has no NPC to walk to: once the crown quest stands on its
 * final oath step, say so exactly once and point at the Crown panel.
 */
function announceCoronation(): void {
  try {
    const flags = st().story.flags as Record<string, unknown>;
    if (flags.coronation_announced) return;
    const main = currentMainQuest();
    if (!main || main.id !== 'q_crown_of_realm') return;
    const steps = main.steps || [];
    const choiceIdx = steps.findIndex((s) => s.type === 'choice');
    if (choiceIdx < 0) return;
    for (let i = 0; i < steps.length; i++) {
      if (i === choiceIdx) continue;
      if (stepProgress(main.id, i) < (steps[i]?.count || 1)) return;
    }
    if (stepProgress(main.id, choiceIdx) >= 1) return;
    flags.coronation_announced = true;
    GameState.toast({
      title: 'THE COUNCIL AWAITS',
      msg: 'The anchor is raised and the realm stands ready. Open the Crown panel (R) to call the council and choose who carries it.',
      kind: 'story',
      dur: 9000
    });
    GameState.notify(CH.QUESTS, CH.STORY);
  } catch { /* announcement never blocks quests */ }
}

function matchStep(gev: GameplayEvent, step: QuestStep): boolean {
  switch (step.type) {
    case 'kill': return gev.type === 'kill' && gev.enemy === step.enemy;
    case 'boss': return gev.type === 'kill' && gev.boss === step.target;
    case 'gather': return gev.type === 'gather' && gev.item === step.item;
    case 'craft': return gev.type === 'crafted' && gev.itemId === step.itemId;
    case 'build': return gev.type === 'built' && gev.building === step.building;
    case 'reach': return gev.type === 'discover' && gev.poiTag === step.poiTag;
    case 'reachCount': return gev.type === 'discover' && gev.poiKind === step.poiKind;
    case 'talk': return gev.type === 'talk' && gev.npc === step.npc;
    case 'flag': return gev.type === 'flagset' && gev.flag === step.flag;
    case 'deliver': return gev.type === 'deliver' && gev.npc === step.npc && gev.item === step.item;
    case 'surviveNight': return gev.type === 'survived-night';
    case 'raid_defended': return gev.type === 'raid-survived';
    case 'population': return gev.type === 'population' && gev.count !== undefined && step.count !== undefined && gev.count >= step.count;
    case 'stores': return gev.type === 'stores-check' && gev.resource === step.resource && gev.amount !== undefined && step.count !== undefined && gev.amount >= step.count;
    case 'stage': return gev.type === 'stage-reached' && gev.index !== undefined && step.index !== undefined && gev.index >= step.index;
    case 'territory': return gev.type === 'territory-pct' && gev.pct !== undefined && step.count !== undefined && gev.pct >= step.count;
    case 'choice': return gev.type === 'choice' && gev.choiceId === step.choiceId;
    case 'useItem': return gev.type === 'useItem' && gev.itemId === step.itemId;
    case 'recruit': return gev.type === 'recruit' && gev.npc === step.npc;
    default: return false;
  }
}
