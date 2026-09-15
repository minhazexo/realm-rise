// Aggregated enemy registry: wildlife, monsters, bandits and bosses.
//
// Data-driven pattern: the split source maps (enemiesWild / enemiesHuman)
// are merged through the strict Registry, so a key defined in two files
// throws at load time instead of one silently overwriting the other.
// Public API is unchanged: ALL_ENEMY_DEFS / getEnemyDef / isBossKey.
import { ENEMIES } from './enemiesWild.ts';
import { BANDITS, BOSSES } from './enemiesHuman.ts';
import { Registry } from '../core/Registry.ts';
import type { EnemyDef } from './enemiesWild.ts';
export { ENEMY_TEAMS } from './enemyTeams.ts';

const ENEMY_REGISTRY = new Registry<EnemyDef>('enemy', { required: ['name'] });
ENEMY_REGISTRY.defineSources({ enemiesWild: ENEMIES, bandits: BANDITS, bosses: BOSSES });
ENEMY_REGISTRY.seal();

export const ALL_ENEMY_DEFS: Record<string, EnemyDef> = ENEMY_REGISTRY.snapshot();
export const getEnemyDef = (key: string): EnemyDef | null => ENEMY_REGISTRY.get(key);
// Snapshot read (no miss-warning): hot-path predicate, called with any key.
export const isBossKey = (key: string): boolean => !!ALL_ENEMY_DEFS[key]?.boss;
