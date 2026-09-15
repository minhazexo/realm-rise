// Quest system (2/2): UI snapshots, side-quest offers, choices.
// Facade re-export so callers only import './QuestSystem.js'.
export { currentMainQuest, handleEvent, setFlag, stepProgress, progKey, completeQuest } from './QuestEngine.ts';

import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { SIDE_QUESTS } from '../data/questsSide.ts';
import type { QuestDef } from '../data/questsMain.ts';
import { stepProgress, currentMainQuest } from './QuestEngine.ts';
import type { GameRootState } from '../core/stateFactory.ts';

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

/** Offer a side quest from NPC/event. False when already active/done/unknown. */
export function offerSideQuest(id: string): boolean {
  const S = st().quests;
  const def: QuestDef | undefined = SIDE_QUESTS[id];
  if (!def) return false;
  if (S.sideActive.includes(id) || S.sideCompleted.includes(id)) return false;
  S.sideActive.push(id);
  GameState.notify(CH.QUESTS);
  GameState.toast({ title: 'New Side Quest', msg: def.title, kind: 'quest' });
  return true;
}

/* ── Choices with consequences (spec §34) ──────────────────────────────── */
export function applyChoice(choiceId: string, optionIdx: number): void {
  const flags: Record<string, unknown> = st().story.flags;
  switch (choiceId) {
    case 'coronation': {
      const oath: string = ['conqueror', 'diplomat', 'sage'][optionIdx] || 'sage';
      flags['ending_' + oath] = true;
      flags.game_completed = true;
      GameState.notify(CH.STORY);
      Bus.emit('game-ending', oath);
      break;
    }
    case 'starving_village':
      // handled inline by event implementations; kept for future expansions
      break;
    default:
      break;
  }
}
