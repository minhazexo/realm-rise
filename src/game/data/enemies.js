// Aggregated enemy registry: wildlife, monsters, bandits and bosses.
import { ENEMIES } from './enemiesWild.js';
import { BANDITS, BOSSES } from './enemiesHuman.js';
export { ENEMY_TEAMS } from './enemyTeams.js';

export const ALL_ENEMY_DEFS = Object.freeze(Object.assign({}, ENEMIES, BANDITS, BOSSES));
export const getEnemyDef = (key) => ALL_ENEMY_DEFS[key] || null;
export const isBossKey = (key) => !!ALL_ENEMY_DEFS[key]?.boss;
