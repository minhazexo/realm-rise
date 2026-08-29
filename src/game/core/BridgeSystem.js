// ─────────────────────────────────────────────────────────────────────────────
// BridgeSystem: one-time wiring between gameplay Bus events and the quest/
// story/achievement reducers, so scenes & systems never import each other.
// ─────────────────────────────────────────────────────────────────────────────
import { Bus } from './EventBus.js';
import { handleEvent } from '../systems/QuestEngine.js';
import { trackKill, trackCrafted } from '../systems/AchievementSystem.js';

let installed = false;

export function installBridge() {
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

  Bus.on('dawn-broke', () => handleEvent({ type: 'survived-night' }));

  Bus.on('raid-resolved', () => handleEvent({ type: 'raid-survived' }));

  Bus.on('treasure-map-used', () => handleEvent({ type: 'useItem', itemId: 'treasure_map' }));
}
