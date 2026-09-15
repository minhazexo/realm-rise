// Aggregated quest registry: main chain + side quests.
//
// Data-driven pattern: the split source maps (questsMain / questsSide) are
// merged through the strict Registry, so a quest id defined in two files
// throws at load time instead of one silently overwriting the other.
// Public API is unchanged: MAIN_QUESTS / SIDE_QUESTS / QUEST_ORDER, plus
// ALL_QUEST_DEFS / getQuestDef for registry-backed lookups.
import { MAIN_QUESTS, QUEST_ORDER } from './questsMain.ts';
import { SIDE_QUESTS } from './questsSide.ts';
import { Registry } from '../core/Registry.ts';
import type { QuestDef } from './questsMain.ts';

const QUEST_REGISTRY = new Registry<QuestDef>('quest', { required: ['title', 'steps'] });
QUEST_REGISTRY.defineSources({ main: MAIN_QUESTS, side: SIDE_QUESTS });
QUEST_REGISTRY.seal();

export const ALL_QUEST_DEFS: Record<string, QuestDef> = QUEST_REGISTRY.snapshot();
export const getQuestDef = (id: string): QuestDef | null => QUEST_REGISTRY.get(id);
export { MAIN_QUESTS, QUEST_ORDER, SIDE_QUESTS };
