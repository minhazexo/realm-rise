// ─────────────────────────────────────────────────────────────────────────────
// BridgeSystem: one-time wiring between gameplay Bus events and the quest/
// story/achievement reducers, so scenes & systems never import each other.
// ─────────────────────────────────────────────────────────────────────────────
import { Bus, CH } from './EventBus.ts';
import GameState from './GameState.ts';
import { allDefs, handleEvent } from '../systems/narrative/QuestEngine.ts';
import { trackKill, trackCrafted, trackNightSurvived } from '../systems/narrative/AchievementSystem.ts';
import { grantLegacy } from '../systems/narrative/LegacyStore.ts';
import { endingFor } from '../systems/narrative/StorySystem.ts';

let installed = false;

export function installBridge(): void {
  if (installed) return;
  installed = true;

  Bus.on('crafted', (itemId) => {
    handleEvent({ type: 'crafted', itemId });
    trackCrafted();
    // main-quest wording uses step.itemId === crafted id
  });

  Bus.on('enemy-killed', ({ defKey, isBoss }) => {
    handleEvent({ type: 'kill', enemy: defKey });
    if (isBoss) handleEvent({ type: 'kill', boss: defKey });
    trackKill();
  });

  Bus.on('built-complete', ({ key }) => {
    handleEvent({ type: 'built', building: key });
  });

  Bus.on('poi-discovered', ({ poi }) => {
    handleEvent({ type: 'discover', poiTag: poi.tag, poiKind: poi.kind, poi });
  });

  Bus.on('talked-to', ({ npc }) => handleEvent({ type: 'talk', npc }));

  Bus.on('delivered', ({ npc, item, amount }) => handleEvent({ type: 'deliver', npc, item, amount }));

  Bus.on('dawn-broke', () => {
    handleEvent({ type: 'survived-night' });
    try { trackNightSurvived(); } catch { /* stats never crash quests */ }
  });

  Bus.on('raid-resolved', () => handleEvent({ type: 'raid-survived' }));

  Bus.on('recruited', ({ npc }) => handleEvent({ type: 'recruit', npc }));

  // Step-level feedback: the engine only toasts on full completion, so a
  // multi-step quest would otherwise advance silently until the finale.
  Bus.on('quest-step-done', ({ qid, idx }: { qid?: string; idx?: number }) => {
    try {
      const def = (qid && (allDefs() as Record<string, { title?: string; steps?: Array<{ text?: string }> }>)[qid]) || undefined;
      const step = def?.steps?.[idx ?? -1];
      if (def && step) GameState.toast({ title: 'STEP COMPLETE', msg: `${def.title} — ${step.text}`, kind: 'quest', dur: 3200 });
    } catch { /* toast never blocks quests */ }
  });

  // Epilogue: persist the oath for NG+ boons, show the ending text, and wake
  // the UI. App renders RulerPanel while session.ending is set.
  Bus.on('game-ending', (oath: string) => {
    try {
      const oathId: string = typeof oath === 'string' && oath ? oath : 'sage';
      try {
        grantLegacy(oathId);
      } catch { /* legacy never blocks the epilogue */ }
      const ending = endingFor(oathId);
      (GameState.session as unknown as { ending?: unknown }).ending = {
        oath: oathId,
        title: ending.title,
        body: ending.body,
        at: Date.now()
      };
      GameState.toast({ title: ending.title, msg: ending.body, kind: 'story', dur: 9000 });
      GameState.notify(CH.SCREEN, CH.STORY);
    } catch { /* epilogue never crashes gameplay */ }
  });
}
