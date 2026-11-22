// ─────────────────────────────────────────────────────────────────────────────
// Every authored region the game runs, in registration order.
//
// A region is a data module implementing RegionDef (data/region.ts) plus ONE
// line in the list below. The runtime systems iterate this list and never name a
// region themselves, so adding a region touches no system code.
// ─────────────────────────────────────────────────────────────────────────────
import { ASHEN_REGION } from '../../data/regionAshen.ts';
import { DEEPWOOD_REGION } from '../../data/regionDeepwood.ts';
import { DROWNED_REGION } from '../../data/regionDrowned.ts';
import { stationsOf, waypointsOf } from '../../data/region.ts';
import type { RegionAnchor, RegionDef, RegionPoi, StationPoint, WaypointPoint } from '../../data/region.ts';

export const REGIONS: RegionDef[] = [
  ASHEN_REGION,
  DEEPWOOD_REGION,
  DROWNED_REGION,
];

/** Crafting stations every registered region provides (hub anvils, camp forges). */
export function regionStations(): StationPoint[] {
  return REGIONS.flatMap(stationsOf);
}

/** The atlas footprint of every registered region (see data/region.ts §anchor). */
export function regionAnchors(): RegionAnchor[] {
  return REGIONS
    .map((r: RegionDef) => r.anchor)
    .filter((a: RegionAnchor | undefined): a is RegionAnchor => !!a);
}

/** Travel points the registered regions provide, in registration order. */
export function regionWaypoints(): WaypointPoint[] {
  return REGIONS.flatMap(waypointsOf);
}

/** One registered region by id (null when it is not in the list). */
export function regionById(id: string): RegionDef | null {
  return REGIONS.find((r: RegionDef) => r.id === id) || null;
}

/**
 * Ground kept clear of procedural gather nodes around an authored landmark.
 *
 * Nodes (trees, bushes, rocks) are spawned per chunk by the world generator and
 * know nothing about authored content: at forest density a landmark's tents,
 * fire and lore props ended up completely buried under a wall of oaks, so the
 * camp read as another patch of woods. Cleared ground is what makes the
 * composition visible from inside the area.
 */
export const LANDMARK_CLEARING = 240;

/** True inside the clear radius of any registered region's landmark. */
export function inLandmarkClearing(x: number, y: number): boolean {
  for (const r of REGIONS) {
    for (const l of r.landmarks ?? []) {
      if (Math.hypot(x - l.x, y - l.y) <= LANDMARK_CLEARING) return true;
    }
  }
  return false;
}

/** True inside any registered region's authored no-spawn safe zone. */
export function inRegionSafeZone(x: number, y: number): boolean {
  return REGIONS.some((r: RegionDef) => r.isSafe?.(x, y) === true);
}

/** Authored POIs from every registered region (fed to the world generator). */
export function regionPois(): RegionPoi[] {
  return REGIONS.flatMap((r: RegionDef) => r.pois ?? []);
}
