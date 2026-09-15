// Aggregated building registry.
//
// Data-driven pattern: the split source maps (buildingsA / buildingsB) are
// merged through the strict Registry, so a key defined in both files throws
// at load time instead of one silently overwriting the other.
// Public API is unchanged: BUILDINGS / BUILDING_CATS / getBuildingDef.
import { BUILDINGS_A } from './buildingsA.ts';
import { BUILDINGS_B } from './buildingsB.ts';
import { Registry } from '../core/Registry.ts';
import type { BuildingDef } from './buildingsA.ts';

const BUILDING_REGISTRY = new Registry<BuildingDef>('building', { required: ['label', 'cat'] });
BUILDING_REGISTRY.defineSources({ buildingsA: BUILDINGS_A, buildingsB: BUILDINGS_B });
BUILDING_REGISTRY.seal();

export const BUILDINGS: Record<string, BuildingDef> = BUILDING_REGISTRY.snapshot();
export const BUILDING_CATS = ['survival', 'residential', 'resource', 'production', 'military', 'defense', 'government', 'special'];
export const getBuildingDef = (key: string): BuildingDef | null => BUILDING_REGISTRY.get(key);
