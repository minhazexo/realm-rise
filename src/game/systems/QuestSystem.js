// Quest system (2/2): UI snapshots, side-quest offers, choices.
// Facade re-export so callers only import './QuestSystem.js'.
export { currentMainQuest, handleEvent, setFlag, stepProgress, progKey, completeQuest } from './QuestEngine.js';

import GameState from '../core/GameState.js';
import { Bus, CH } from '../core/EventBus.js';
import { SIDE_QUESTS } from '../data/questsSide.js';
import { stepProgress, currentMainQuest } from './QuestEngine.js';

const st = () => GameState.s;

export const activeSideQuests = () =>
  st().quests.sideActive.map((id) => SIDE_QUESTS[id]).filter(Boolean);

export function isQuestActive(qid) {
  if (currentMainQuest()?.id === qid) return true;
  return st().quests.sideActive.includes(qid);
}

/** Tracker snapshot for HUD + Journal panel. */
export function questStateSnapshot() {
  const main = currentMainQuest();
  if (!main) return { none: true };
  const pack = (def) => ({
    id: def.id,
    title: def.title,
    chapter: def.chapter,
    steps: def.steps.map((s, i) => {
      const need = s.count || 1;
      const have = Math.min(stepProgress(def.id, i), need);
      return { text: s.text, have, need, done: have >= need };
    })
  });
  return { ...pack(main), side: activeSideQuests().map(pack) };
}

/** Offer a side quest from NPC/event. False when already active/done/unknown. */
export function offerSideQuest(id) {
  const S = st().quests;
  const def = SIDE_QUESTS[id];
  if (!def) return false;
  if (S.sideActive.includes(id) || S.sideCompleted.includes(id)) return false;
  S.sideActive.push(id);
  GameState.notify(CH.QUESTS);
  GameState.toast({ title: 'New Side Quest', msg: def.title, kind: 'quest' });
  return true;
}

/* ── Choices with consequences (spec §34) ──────────────────────────────── */
export function applyChoice(choiceId, optionIdx) {
  const flags = st().story.flags;
  switch (choiceId) {
    case 'coronation': {
      const oath = ['conqueror', 'diplomat', 'sage'][optionIdx] || 'sage';
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
