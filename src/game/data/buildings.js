// Aggregated building registry.
import { BUILDINGS_A } from './buildingsA.js';
import { BUILDINGS_B } from './buildingsB.js';

export const BUILDINGS = Object.freeze(Object.assign({}, BUILDINGS_A, BUILDINGS_B));
export const BUILDING_CATS = ['survival', 'residential', 'resource', 'production', 'military', 'defense', 'government', 'special'];
export const getBuildingDef = (key) => BUILDINGS[key] || null;
