// Aggregated crafting registry.
//
// Data-driven pattern: the ordered recipe arrays (recipesA / recipesB) keep
// their authoring order for the crafting UI, while a strict Registry index
// by id rejects duplicates (previously `.find()` silently used the first
// match and masked the collision). Lookup-by-output stays a separate,
// deliberate scan in CraftingSystem (bulk `x5` variants share `out`).
import { RECIPES_A } from './recipesA.ts';
import { RECIPES_B, RECIPE_CATS } from './recipesB.ts';
import { Registry } from '../core/Registry.ts';
import type { RecipeDef } from './recipesA.ts';

export const RECIPES: RecipeDef[] = [...RECIPES_A, ...RECIPES_B].filter((r) => r.out);
export { RECIPE_CATS };

const RECIPE_REGISTRY = new Registry<RecipeDef>('recipe', { required: ['id', 'out'] });
for (const r of RECIPES) RECIPE_REGISTRY.define(r.id, r);
RECIPE_REGISTRY.seal();

export const getRecipeById = (id: string): RecipeDef | null => RECIPE_REGISTRY.get(id);

/**
 * Intentionally loot/shop-only gear (no recipe by design). The crafting UI
 * uses this to show "Found in the wild" instead of silently omitting them.
 */
export const LOOT_ONLY: Set<string> = new Set(['nightfall_bow']);
