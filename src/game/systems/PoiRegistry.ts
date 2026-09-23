// ─────────────────────────────────────────────────────────────────────────────
// PoiRegistry — the game's ONE list of points of interest: the procedural
// world's own POIs merged with every authored region's, cached per world seed.
// Discovery, minimap fog, world markers, NPC spawning and quest step targets
// all read this list, so it must contain both halves.
//
// Why the merge lives here and not in worldGen: the generator sits below
// systems/ and must not know about authored content, but the game needs one
// list of both. Merging in this layer keeps the direction of flow
// data → world → systems → scene, instead of world reaching up into systems.
//
// A region's own POIs come from systems/RegionRegistry (registration order).
// ─────────────────────────────────────────────────────────────────────────────
import { proceduralPois, worldSeed, type PointOfInterest } from '../world/worldGen.ts';
import { regionPois } from './RegionRegistry.ts';

let cache: PointOfInterest[] | null = null;
let cacheSeed: number | null = null;

/**
 * Every point of interest in the world: the generator's own, then each authored
 * region's (map brief §28 — the region files own names, coords and stories;
 * registering them here is what makes discovery, markers, minimap fog and quest
 * targets work for authored content too).
 *
 * Cached per world seed; `setWorldSeed` changes the seed and the next call
 * rebuilds.
 */
export function allPois(): PointOfInterest[] {
  if (cache && cacheSeed === worldSeed()) return cache;

  const spots: PointOfInterest[] = proceduralPois().map((p) => ({ ...p }));
  const seen = new Set(spots.map((p) => p.id));
  for (const rp of regionPois()) {
    // An authored POI never duplicates a procedural one: first registration wins.
    if (seen.has(rp.id)) continue;
    seen.add(rp.id);
    spots.push({
      id: rp.id, x: rp.x, y: rp.y, kind: rp.kind, label: rp.label,
      tag: rp.tag, danger: rp.danger, chestTier: rp.chestTier, npc: rp.npc, boss: rp.boss,
      discovered: false, looted: false
    });
  }

  cache = spots;
  cacheSeed = worldSeed();
  return cache;
}
