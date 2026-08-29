// Aggregated crafting registry.
import { RECIPES_A } from './recipesA.js';
import { RECIPES_B, RECIPE_CATS } from './recipesB.js';

export const RECIPES = [...RECIPES_A, ...RECIPES_B].filter((r) => r.out);
export { RECIPE_CATS };
export const getRecipeById = (id) => RECIPES.find((r) => r.id === id) || null;
