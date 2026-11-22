// ─────────────────────────────────────────────────────────────────────────────
// regionKit — the authoring pipeline for world regions.
//
// A region is DATA: sub-areas, landmark compositions, designed encounters,
// clickables, POIs and one guardian. Three things are pure geometry and should
// never be re-implemented per region:
//
//   • which sub-area contains a point      (subregionAt)
//   • which encounters fire for a player   (encountersToTrigger)
//   • where enemies may not spawn          (isSafe)
//
// `defineRegion()` derives those from the authored areas and returns the
// RegionDef the runtime consumes, so adding a region is one data file plus one
// registry line — and `regionIssues()` is the contract check the pipeline test
// runs over every registered region, catching the mistakes that used to be
// found by walking there (a POI outside its own footprint, a waypoint naming a
// POI that does not exist, a guardian seated in a safe zone).
//
// Pure data + geometry: no Phaser, no scene, node-testable.
// ─────────────────────────────────────────────────────────────────────────────
import { getEnemyDef } from './enemies.ts';
import type {
  Encounter, Interactable, Landmark, RegionAnchor, RegionDef, RegionPoi, SubRegion,
} from './region.ts';

/** A no-spawn circle; sub-areas can also mark themselves safe. */
export interface SafeZone {
  x: number;
  y: number;
  radius: number;
}

/** Everything a region authors; the geometry helpers are derived. */
export type RegionSpec = Omit<RegionDef, 'subregionAt' | 'encountersToTrigger' | 'isSafe'> & {
  /** Extra no-spawn circles beyond the sub-areas marked `safe`. */
  safeZones?: SafeZone[];
};

/** Which sub-area contains this point? Nearest containing circle wins. */
export function subregionAt(areas: SubRegion[], x: number, y: number): SubRegion | null {
  let best: SubRegion | null = null;
  let bestD: number = Infinity;
  for (const s of areas) {
    const d: number = Math.hypot(x - s.x, y - s.y);
    if (d <= s.radius && d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/** True inside any no-spawn zone (safe sub-area or authored safe circle). */
export function inSafeZone(areas: SubRegion[], zones: SafeZone[], x: number, y: number): boolean {
  for (const s of areas) {
    if (s.safe && Math.hypot(x - s.x, y - s.y) <= s.radius) return true;
  }
  for (const z of zones) {
    if (Math.hypot(x - z.x, y - z.y) <= z.radius) return true;
  }
  return false;
}

/**
 * The encounters that should fire this frame. Ambushers wait for a tighter
 * trigger (200 px) so walking past the edge of their clearing does not spring
 * them from across the road.
 */
export function encountersToTrigger(
  encounters: Encounter[],
  x: number,
  y: number,
  cleared: (id: string) => boolean
): Encounter[] {
  return encounters.filter((e: Encounter) => {
    if (cleared(e.id)) return false;
    const trigger = e.ambush ? Math.min(e.trigger, 200) : e.trigger;
    return Math.hypot(x - e.x, y - e.y) <= trigger;
  });
}

/**
 * Fill in the derived geometry and hand back the RegionDef the runtime reads.
 * `id` is copied onto the anchor when the anchor omits it, so a region and its
 * footprint can never disagree about who owns it.
 */
export function defineRegion(spec: RegionSpec): RegionDef {
  const areas = spec.subregions;
  const zones = spec.safeZones ?? [];
  const anchor: RegionAnchor | undefined = spec.anchor
    ? { ...spec.anchor, id: spec.anchor.id || spec.id }
    : undefined;
  return {
    ...spec,
    anchor,
    subregionAt: (x: number, y: number) => subregionAt(areas, x, y),
    encountersToTrigger: (x: number, y: number, cleared: (id: string) => boolean) =>
      encountersToTrigger(spec.encounters, x, y, cleared),
    isSafe: (x: number, y: number) => inSafeZone(areas, zones, x, y),
  };
}

/* ── The contract check ─────────────────────────────────────────────────── */

function inAnchor(a: NonNullable<RegionDef['anchor']>, x: number, y: number): boolean {
  return Math.hypot(x - a.x, y - a.y) <= a.radius;
}

/**
 * Everything a region must get right, as a list of human-readable problems.
 * Empty means the region can be registered. tests/region-pipeline.mjs fails on
 * the first issue, so a broken region cannot ship.
 */
export function regionIssues(def: RegionDef): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();

  if (!def.anchor) issues.push(`${def.id}: no anchor`);
  if (!def.waypoint) issues.push(`${def.id}: no fast-travel waypoint`);
  if (def.subregions.length < 3) issues.push(`${def.id}: needs at least 3 sub-areas`);
  if (def.landmarks.length < 3) issues.push(`${def.id}: needs at least 3 landmarks`);
  if (def.encounters.length < 2) issues.push(`${def.id}: needs at least 2 designed encounters`);
  if ((def.pois ?? []).length < 4) issues.push(`${def.id}: needs at least 4 POIs`);

  const areaIds = new Set(def.subregions.map((s) => s.id));
  for (const s of def.subregions) {
    if (ids.has(s.id)) issues.push(`${def.id}: duplicate sub-area id '${s.id}'`);
    ids.add(s.id);
    if (def.anchor && !inAnchor(def.anchor, s.x, s.y)) issues.push(`${def.id}/${s.id}: area is outside the region footprint`);
    if (def.anchor && Math.hypot(s.x - def.anchor.x, s.y - def.anchor.y) + s.radius > def.anchor.radius) {
      issues.push(`${def.id}/${s.id}: area spills outside the region footprint`);
    }
  }

  const poiIds = new Set<string>();
  for (const poi of def.pois ?? []) {
    if (poiIds.has(poi.id)) issues.push(`${def.id}: duplicate POI id '${poi.id}'`);
    poiIds.add(poi.id);
    if (def.anchor && !inAnchor(def.anchor, poi.x, poi.y)) issues.push(`${def.id}/${poi.id}: POI is outside the region footprint`);
  }

  for (const lm of def.landmarks) {
    if (!areaIds.has(lm.area)) issues.push(`${def.id}/${lm.id}: landmark names unknown area '${lm.area}'`);
    if (!lm.props.length) issues.push(`${def.id}/${lm.id}: landmark has no props`);
  }
  for (const e of def.encounters) {
    if (!areaIds.has(e.area)) issues.push(`${def.id}/${e.id}: encounter names unknown area '${e.area}'`);
    if (!e.members.length) issues.push(`${def.id}/${e.id}: encounter has no members`);
    for (const m of e.members) {
      if (!getEnemyDef(m.key)) issues.push(`${def.id}/${e.id}: unknown enemy '${m.key}'`);
    }
  }
  for (const it of def.interactables as Interactable[]) {
    if (!areaIds.has(it.area)) issues.push(`${def.id}/${it.id}: interactable names unknown area '${it.area}'`);
  }
  for (const h of def.hazards) {
    if (!areaIds.has(h.area)) issues.push(`${def.id}/${h.id}: hazard names unknown area '${h.area}'`);
    if (h.bossKey && !getEnemyDef(h.bossKey)) issues.push(`${def.id}/${h.id}: unknown hazard boss '${h.bossKey}'`);
  }

  if (def.waypoint) {
    const poi = (def.pois ?? []).find((p: RegionPoi) => p.id === def.waypoint!.poi);
    if (!poi) issues.push(`${def.id}: waypoint names missing POI '${def.waypoint.poi}'`);
    else if (def.isSafe && !def.isSafe(poi.x, poi.y)) issues.push(`${def.id}: waypoint is not inside a safe zone`);
  }

  if (def.arena) {
    if (!areaIds.has(def.arena.area)) issues.push(`${def.id}: arena names unknown area '${def.arena.area}'`);
    if (!getEnemyDef(def.arena.bossKey)) issues.push(`${def.id}: arena boss '${def.arena.bossKey}' is not an enemy`);
    const bossPoi = (def.pois ?? []).find((p: RegionPoi) => p.boss === def.arena!.bossKey);
    if (!bossPoi) issues.push(`${def.id}: no POI holds the arena boss '${def.arena.bossKey}'`);
    if (def.isSafe?.(bossPoi?.x ?? 0, bossPoi?.y ?? 0) === true) {
      issues.push(`${def.id}: the guardian is seated inside a safe zone`);
    }
  }

  for (const l of def.landmarks as Landmark[]) {
    if (!l.story || l.story.length < 60) issues.push(`${def.id}/${l.id}: landmark story is a stub`);
  }

  return issues;
}

/** Total designed enemies — the map-density signal. */
export function encounterEnemyCount(def: RegionDef): number {
  return def.encounters.reduce(
    (n, e) => n + e.members.reduce((m, mm) => m + mm.count, 0),
    0
  );
}
