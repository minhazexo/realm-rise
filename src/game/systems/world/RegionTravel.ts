// ─────────────────────────────────────────────────────────────────────────────
// RegionTravel — the world map's other half: crossing INTO a region, and moving
// between the ones you have already stood in.
//
// docs/WORLD-MAP.md §4–§6: a region announces itself when the player crosses
// into it, and that arrival is what unlocks its waypoint for fast travel; the
// unlocked list is the saved `world.unlockedFastTravel[]` the save already
// carries, so nothing new has to be persisted. Which region holds the player is
// geometry (RegionLayout.regionAt over the registry's anchors), so no system
// names a region and registering another one changes nothing here.
//
// The only scene-side need is putting the player down, and that is the
// `movePlayer` delegate (RegionState.RegionHost) — the same seam chests and NPCs
// come through. So this module stays Phaser-free and node-testable.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../../core/GameState.ts';
import { CH } from '../../core/EventBus.ts';
import { regionAnchors, regionById } from './RegionRegistry.ts';
import { regionAt } from './RegionLayout.ts';
import { waypointsOf } from '../../data/region.ts';
import type { RegionAnchor, WaypointPoint } from '../../data/region.ts';
import type { RegionScene } from './RegionState.ts';

/** The region the player is standing in; '' means the wilds between regions. */
let hereId = '';

/**
 * Forget where the player was, so a fresh world announces the region it starts
 * in. Called by the scene on create — the runtime is per world, not per process.
 */
export function resetRegionTravel(): void {
  hereId = '';
}

/** Which registered region holds this position? ('' in the wilds.) */
export function currentRegionId(px: number, py: number): string {
  const anchor: RegionAnchor | null = regionAt(regionAnchors(), px, py);
  return anchor ? anchor.id : '';
}

/** The travel point one region provides, or null if it declares none. */
function waypointOf(regionId: string): WaypointPoint | null {
  const region = regionById(regionId);
  return region ? (waypointsOf(region)[0] ?? null) : null;
}

/** May the player travel to this region yet? (Region id, not POI id.) */
export function canFastTravel(regionId: string): boolean {
  return !!waypointOf(regionId) && (GameState.s.world.unlockedFastTravel || []).includes(regionId);
}

/** Waypoints the player may travel to right now, in registration order. */
export function unlockedWaypoints(): WaypointPoint[] {
  return regionAnchors()
    .map((a: RegionAnchor) => a.id)
    .filter(canFastTravel)
    .map((id: string) => waypointOf(id))
    .filter((w: WaypointPoint | null): w is WaypointPoint => !!w);
}

/**
 * Unlock a region's travel point. Idempotent — arriving twice (or on two
 * different days) appends one entry, so the saved list stays a set of regions.
 */
export function unlockTravel(regionId: string): boolean {
  if (!waypointOf(regionId)) return false;
  const world = GameState.s.world;
  const list: string[] = world.unlockedFastTravel || (world.unlockedFastTravel = []);
  if (list.includes(regionId)) return false;
  list.push(regionId);
  GameState.notify(CH.WORLD);
  return true;
}

/**
 * One frame of travel bookkeeping: announce the region the player has just
 * crossed into and unlock its waypoint. Returns the region entered this frame,
 * or null when the player stayed where (or as far out) they were.
 */
export function tickRegionTravel(px: number, py: number): RegionAnchor | null {
  const id: string = currentRegionId(px, py);
  const changed: boolean = id !== hereId;
  hereId = id;
  if (!changed || !id) return null;
  const anchor: RegionAnchor | null = regionAt(regionAnchors(), px, py);
  if (!anchor) return null;
  const fresh: boolean = unlockTravel(anchor.id);
  GameState.toast({
    title: anchor.name.toUpperCase(),
    msg: fresh ? 'The World Map will carry you back here.' : 'You are back on ground you know.',
    kind: 'discover', dur: 4200,
  });
  return anchor;
}

/**
 * Travel to a region's waypoint. Returns where the player landed, or null when
 * it is refused: never stood in that region, no waypoint authored, or no scene
 * able to move the player.
 */
export function fastTravel(scene: RegionScene, regionId: string): WaypointPoint | null {
  const wp: WaypointPoint | null = waypointOf(regionId);
  if (!wp || !canFastTravel(regionId) || !scene.movePlayer) return null;
  scene.movePlayer(wp.x, wp.y);
  // Arriving is not a crossing: the next tick must not re-announce the region.
  hereId = regionId;
  GameState.notify(CH.WORLD, CH.MINIMAP);
  GameState.toast({ title: wp.label.toUpperCase(), msg: 'You take the old road and arrive.', kind: 'discover', dur: 4200 });
  return wp;
}

/** Travel state for tests and live probes. */
export function travelSnapshot(px: number, py: number): Record<string, unknown> {
  return {
    region: currentRegionId(px, py),
    unlocked: [...(GameState.s.world.unlockedFastTravel || [])],
    waypoints: unlockedWaypoints().map((w: WaypointPoint) => w.region),
  };
}
