// ─────────────────────────────────────────────────────────────────────────────
// Every authored region the game runs, in registration order.
//
// A region is a data module implementing RegionDef (data/region.ts) plus ONE
// line in the list below. The runtime systems iterate this list and never name a
// region themselves, so adding a region touches no system code.
// ─────────────────────────────────────────────────────────────────────────────
import { ASHEN_REGION } from '../data/regionAshen.ts';
import { stationsOf } from '../data/region.ts';
import type { RegionDef, RegionPoi, StationPoint } from '../data/region.ts';

export const REGIONS: RegionDef[] = [
  ASHEN_REGION,
];

/** Crafting stations every registered region provides (hub anvils, camp forges). */
export function regionStations(): StationPoint[] {
  return REGIONS.flatMap(stationsOf);
}

/** True inside any registered region's authored no-spawn safe zone. */
export function inRegionSafeZone(x: number, y: number): boolean {
  return REGIONS.some((r: RegionDef) => r.isSafe?.(x, y) === true);
}

/** Authored POIs from every registered region (fed to the world generator). */
export function regionPois(): RegionPoi[] {
  return REGIONS.flatMap((r: RegionDef) => r.pois ?? []);
}
