// ─────────────────────────────────────────────────────────────────────────────
// Quest engine (1/2): event → progress → completion. The world sim emits GEV
// gameplay events; this reducer advances step progress and grants rewards.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus, CH } from '../core/EventBus.js';
import { MAIN_QUESTS, QUEST_ORDER } from '../data/questsMain.js';
import { SIDE_QUESTS } from '../data/questsSide.js';
import { awardXP, addReputation } from './ProgressionSystem.js';
import { addItem } from './InventorySystem.js';

const st = () => GameState.s;
export const allDefs = () => ({ ...MAIN_QUESTS, ...SIDE_QUESTS });
export const mainOrder = () => QUEST_ORDER;

export function currentMainQuest() {
  const q = st()?.quests;
  if (!q) return null;
  return MAIN_QUESTS[QUEST_ORDER[Math.min(q.chainIndex, QUEST_ORDER.length - 1)]] || null;
}

export const progKey = (qid, i) => `${qid}:${i}`;
export function stepProgress(qid, idx) {
  return st().quests.progress[progKey(qid, idx)] || 0;
}
/** Is this quest currently tracked (main head or side)? */
export function isQuestActive(qid) {
  const S = st().quests;
  return currentMainQuest()?.id === qid || S.sideActive?.includes(qid);
}
export function setFlag(flag, value = true) {
  st().story.flags[flag] = value;
  handleEvent({ type: 'flagset', flag });
  GameState.notify(CH.STORY);
}

/** Mark a quest complete and grant rewards (also used by test harness). */
export function completeQuest(def) {
  const S = st().quests;
  const r = def.rewards || {};
  if (r.xp) awardXP(r.xp, 'quest');
  if (r.gold) st().player.gold += r.gold;
  if (r.rep) addReputation(r.rep);
  if (r.items) for (const [id, n] of Object.entries(r.items)) addItem(id, n, { ignoreCap: true });
  if (r.happinessTown) st().settlement.happiness = Math.min(100, st().settlement.happiness + r.happinessTown);
  for (const f of def.flagsOnComplete || []) setFlag(f);

  GameState.toast({
    title: 'QUEST COMPLETE',
    msg: `${def.title}${r.gold ? ` · +${r.gold} gold` : ''}${r.xp ? ` · +${r.xp} XP` : ''}`,
    kind: 'quest', dur: 4600
  });

  if (MAIN_QUESTS[def.id]) {
    if (S.chainIndex < QUEST_ORDER.length - 1) {
      S.chainIndex++;
      const next = currentMainQuest();
      if (next?.intro) GameState.toast({ title: next.title.toUpperCase(), msg: next.intro, kind: 'story', dur: 6500 });
      Bus.emit('main-advanced', { index: S.chainIndex, id: next?.id });
    }
  } else {
    S.sideActive = S.sideActive.filter((id) => id !== def.id);
    if (!S.sideCompleted.includes(def.id)) S.sideCompleted.push(def.id);
  }

  GameState.notify(CH.QUESTS);
  Bus.emit('quest-completed', def.id);
  import('./StorySystem.js').then((m) => m.evaluate()).catch(() => {});
  import('./AchievementSystem.js').then((m) => m.evaluateAll()).catch(() => {});
}

function checkCompletion(def) {
  if (!def?.steps || !isQuestActive(def.id)) return false;
  for (let i = 0; i < def.steps.length; i++) {
    if (stepProgress(def.id, i) < (def.steps[i].count || 1)) return false;
  }
  completeQuest(def);
  return true;
}

/** Feed one gameplay event into the quest state machine. */
export function handleEvent(gev) {
  const S = st().quests;
  let touched = false;
  const tryQuest = (def) => {
    if (!def?.steps || !isQuestActive(def.id)) return;
    let localTouched = false;
    def.steps.forEach((step, idx) => {
      const need = step.count || 1;
      if (stepProgress(def.id, idx) >= need) return;
      if (!matchStep(gev, step)) return;
      const key = progKey(def.id, idx);
      S.progress[key] = Math.min(need, (S.progress[key] || 0) + (gev.amount != null && step.type === 'gather' ? gev.amount : 1));
      if (S.progress[key] >= need) Bus.emit('quest-step-done', { qid: def.id, idx });
      touched = localTouched = true;
    });
    checkCompletion(def);
  };

  tryQuest(currentMainQuest());
  for (const sid of [...S.sideActive]) tryQuest(SIDE_QUESTS[sid]);
  if (touched) GameState.notify(CH.QUESTS);
}

function matchStep(gev, step) {
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
    case 'population': return gev.type === 'population' && gev.count >= step.count;
    case 'stores': return gev.type === 'stores-check' && gev.resource === step.resource && gev.amount >= step.count;
    case 'stage': return gev.type === 'stage-reached' && gev.index >= step.index;
    case 'territory': return gev.type === 'territory-pct' && gev.pct >= step.count;
    default: return false;
  }
}
