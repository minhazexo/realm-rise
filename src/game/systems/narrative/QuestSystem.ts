// ─────────────────────────────────────────────────────────────────────────────
// QuestSystem (2/2) — the quest facade the rest of the game talks to: UI
// snapshots for the HUD/journal, side-quest offers, the offer gate, and the
// choices with consequences. The reducer itself is QuestEngine (1/2); this file
// re-exports it so callers have one import for quests.
// ─────────────────────────────────────────────────────────────────────────────
export { currentMainQuest, handleEvent, setFlag, stepProgress, progKey, completeQuest } from './QuestEngine.ts';

import GameState from '../../core/GameState.ts';
import { Bus, CH } from '../../core/EventBus.ts';
import { SIDE_QUESTS } from '../../data/questsSide.ts';
import type { QuestDef } from '../../data/questsMain.ts';
import { stepProgress, currentMainQuest, progKey, recheckActive, handleEvent } from './QuestEngine.ts';
import { endingOptions } from './StorySystem.ts';
import { applyBannerPolicy } from '../economy/PolicySystem.ts';
import type { GameRootState } from '../../core/stateFactory.ts';

const st = (): GameRootState => GameState.s;

export const activeSideQuests = (): QuestDef[] =>
  st().quests.sideActive.map((id) => SIDE_QUESTS[id]).filter((d): d is QuestDef => Boolean(d));

export function isQuestActive(qid: string): boolean {
  if (currentMainQuest()?.id === qid) return true;
  return st().quests.sideActive.includes(qid);
}

/** One quest step row for HUD + Journal panels. */
export interface QuestStepSnapshot {
  text: string;
  have: number;
  need: number;
  done: boolean;
}

/** One quest card snapshot for HUD + Journal panels. */
export interface QuestPackSnapshot {
  id: string;
  title: string;
  chapter?: number;
  steps: QuestStepSnapshot[];
}

/** Tracker snapshot for HUD + Journal panel. */
export type QuestSnapshot = { none: true } | (QuestPackSnapshot & { side: QuestPackSnapshot[] });

/** Tracker snapshot for HUD + Journal panel. */
export function questStateSnapshot(): QuestSnapshot {
  const main: QuestDef | null = currentMainQuest();
  if (!main) return { none: true };
  const pack = (def: QuestDef): QuestPackSnapshot => ({
    id: def.id,
    title: def.title,
    chapter: def.chapter,
    steps: def.steps.map((s, i) => {
      const need: number = s.count || 1;
      const have: number = Math.min(stepProgress(def.id, i), need);
      return { text: s.text, have, need, done: have >= need };
    })
  });
  return { ...pack(main), side: activeSideQuests().map(pack) };
}

/**
 * May this side quest be offered right now? Not already running or done, and —
 * for a chained quest like the shard links — every flag it requires already
 * set. THE single owner of that rule: the Accept button (NpcSystem
 * .offerableQuest) and the action (offerSideQuest below) both call it, so the
 * affordance and the action can never disagree.
 */
export function canOfferSideQuest(id: string): boolean {
  const S = st();
  if (!S) return false;
  if (S.quests.sideActive.includes(id) || S.quests.sideCompleted.includes(id)) return false;
  const def: QuestDef | undefined = SIDE_QUESTS[id];
  if (!def) return false;
  return (def.requiresFlags || []).every((f: string) => !!S.story.flags[f]);
}

/** Offer a side quest from NPC/event. False when already active/done/unknown. */
export function offerSideQuest(id: string): boolean {
  const S = st().quests;
  const def: QuestDef | undefined = SIDE_QUESTS[id];
  if (!canOfferSideQuest(id) || !def) return false;
  S.sideActive.push(id);
  // Seed the steps the world already satisfies, then let the engine complete
  // what is already done. The shard chain is walked through the world, not
  // through the journal: a player can take a fragment (or plant all five at the
  // anchor) before asking Mara about it. Without this the quest would arrive
  // already-satisfied and never advance, since the engine only reacts to NEW
  // events — an unfinishable entry and a lost reward.
  def.steps.forEach((step, i) => {
    if (step.type !== 'flag' || !step.flag) return;
    if (!st().story.flags[step.flag]) return;
    const key: string = progKey(id, i);
    S.progress[key] = Math.max(S.progress[key] || 0, step.count || 1);
  });
  recheckActive();
  GameState.notify(CH.QUESTS);
  // If the world had already done the work, the engine completed (and toasted)
  // it above — announcing a brand new objective over the top of that would be
  // nonsense.
  if (!S.sideCompleted.includes(id)) GameState.toast({ title: 'New Side Quest', msg: def.title, kind: 'quest' });
  return true;
}

/* ── Choices with consequences (spec §34) ──────────────────────────────── */
export function applyChoice(choiceId: string, optionIdx: number): void {
  const flags: Record<string, unknown> = st().story.flags;
  switch (choiceId) {
    case 'coronation': {
      // The three governments are gated on the realm's real standing; a player
      // cannot buy the Concord by clicking it after alienating both signatories.
      const option = endingOptions()[optionIdx];
      if (!option) break;
      if (!option.eligible) {
        const missing: string = option.requirements.filter((r) => !r.ok).map((r) => r.label).join(' · ');
        GameState.toast({ title: option.title.toUpperCase(), msg: `Not yet earned: ${missing}`, kind: 'warn', dur: 6000 });
        GameState.notify(CH.STORY);
        break;
      }
      flags['ending_' + option.id] = true;
      flags.game_completed = true;
      // Feed the choice back through the engine so q_crown_of_realm's final
      // step can complete (rewards, chain advance) like every other step.
      try {
        handleEvent({ type: 'choice', choiceId });
      } catch { /* flags above are the source of truth */ }
      GameState.notify(CH.STORY);
      Bus.emit('game-ending', option.id);
      break;
    }
    case 'banner_policy': {
      const result = applyBannerPolicy(optionIdx);
      if (!result.ok) {
        GameState.toast({ title: 'THE BANNER', msg: result.reason || 'The bargain is closed.', kind: 'warn' });
      }
      break;
    }
    case 'starving_village':
      // handled inline by event implementations; kept for future expansions
      break;
    default:
      break;
  }
}

/** Is the coronation choice ready (crown quest active, only oath pending)? */
export function crownChoiceReady(): boolean {
  try {
    const main = currentMainQuest();
    if (!main || main.id !== 'q_crown_of_realm') return false;
    const steps = main.steps || [];
    const choiceIdx = steps.findIndex((s) => s.type === 'choice');
    if (choiceIdx < 0) return false;
    for (let i = 0; i < steps.length; i++) {
      if (i === choiceIdx) continue;
      // Progress semantics are +1 per matching event (threshold steps snap to
      // their carried value), so every step completes at count||1.
      const need: number = steps[i]?.count || 1;
      if (stepProgress(main.id, i) < need) return false;
    }
    return stepProgress(main.id, choiceIdx) < 1;
  } catch {
    return false;
  }
}
