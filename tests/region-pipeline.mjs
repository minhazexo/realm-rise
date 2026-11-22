// Region pipeline gate: the contract every authored region must satisfy, and
// the viewport math that decides how much of the world streams in.
//
// A region used to be validated by walking to it. `regionIssues()` makes the
// mistakes machine-checkable: a POI outside its own footprint, a waypoint that
// names nothing, a guardian seated in a safe zone, an encounter pointing at an
// enemy that does not exist. The suite runs it over every registered region.
import assert from 'node:assert/strict';

import { REGIONS } from '../src/game/systems/world/RegionRegistry.ts';
import { regionIssues, encounterEnemyCount, subregionAt, inSafeZone } from '../src/game/data/regionKit.ts';
import { chunkRadiusForView } from '../src/game/scenes/chunkStreaming.ts';
import { WORLD_CONFIG } from '../src/game/core/Constants.ts';
import { getEnemyDef } from '../src/game/data/enemies.ts';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

/* ── 1. Every registered region passes the contract ─────────────────────── */
for (const region of REGIONS) {
  const issues = regionIssues(region);
  ok(issues.length === 0, `${region.id}: ${issues.length ? issues.join('; ') : 'clean'}`);
}

/* ── 2. The atlas is a set, not a pile ─────────────────────────────────── */
const ids = REGIONS.map((r) => r.id);
ok(new Set(ids).size === ids.length, 'region ids are unique');
ok(REGIONS.length >= 3, `${REGIONS.length} regions registered`);

const poiIds = REGIONS.flatMap((r) => (r.pois ?? []).map((p) => p.id));
ok(new Set(poiIds).size === poiIds.length, 'POI ids are globally unique');

const anchorIds = REGIONS.map((r) => r.anchor?.id);
ok(new Set(anchorIds).size === anchorIds.length, 'anchors are globally unique');

for (const region of REGIONS) {
  ok(region.anchor?.id === region.id, `${region.id}: anchor carries the region id`);
  ok(!!region.waypoint, `${region.id}: declares a travel point`);
  ok(encounterEnemyCount(region) >= 4, `${region.id}: at least 4 designed enemies (${encounterEnemyCount(region)})`);
  ok(region.subregions.some((s) => s.safe), `${region.id}: has a safe ground`);
  ok((region.pois ?? []).some((p) => region.isSafe?.(p.x, p.y) === true), `${region.id}: has a hub POI on its safe ground`);
}

/* ── 3. The authored regions that were added to the atlas ──────────────── */
const deepwood = REGIONS.find((r) => r.id === 'deepwood');
ok(!!deepwood, 'the Deepwood is registered');
ok(deepwood?.anchor?.x === -6200 && deepwood?.anchor?.y === -800, 'the Deepwood sits at its atlas anchor');
ok(deepwood?.subregions.length === 5, 'the Deepwood has five areas');
ok(deepwood?.landmarks.some((l) => l.props.some((p) => p.band === 'fg')), 'the Deepwood uses foreground depth');
ok(deepwood?.arena?.bossKey === 'alpha_wolf', 'Grendelfang holds the Deepwood arena');
ok(!!deepwood && !!getEnemyDef(deepwood.arena.bossKey), 'Grendelfang resolves to an enemy');

const drowned = REGIONS.find((r) => r.id === 'drowned_reach');
ok(!!drowned, 'the Drowned Reach is registered');
ok(drowned?.anchor?.x === 9400 && drowned?.anchor?.y === -1200, 'the Drowned Reach sits at its atlas anchor');
ok(drowned?.arena?.bossKey === 'toll_keeper', 'the Toll Keeper holds the Reach arena');
ok(!!getEnemyDef('toll_keeper'), 'the Toll Keeper is a real enemy');
ok((drowned?.pois ?? []).some((p) => p.boss === 'toll_keeper'), 'a POI spawns the Toll Keeper');

/* ── 4. Geometry helpers are derived, not re-written per region ─────────── */
const camp = deepwood?.subregions.find((s) => s.id === 'clan_camp');
ok(!!camp && subregionAt(deepwood.subregions, camp.x, camp.y)?.id === 'clan_camp', 'a region resolves its own areas');
ok(!!deepwood && subregionAt(deepwood.subregions, 0, 0) === null, 'a point outside every area resolves to null');
ok(!!camp && deepwood.isSafe?.(camp.x, camp.y) === true, 'a safe area is safe');
ok(!!deepwood && deepwood.isSafe?.(camp.x + 4000, camp.y) === false, 'far ground is not safe');
ok(inSafeZone([], [], 0, 0) === false, 'no safe zones means nothing is safe');

/* ── 5. Trigger polarity: ambushers wait for a closer step ─────────────── */
if (deepwood) {
  const ambush = deepwood.encounters.find((e) => e.ambush);
  ok(!!ambush, 'the Deepwood has an ambush');
  if (ambush) {
    const far = deepwood.encountersToTrigger(ambush.x + 260, ambush.y, () => false);
    ok(far.length === 0, 'an ambush stays hidden at 260 px');
    const close = deepwood.encountersToTrigger(ambush.x + 120, ambush.y, () => false);
    ok(close.some((e) => e.id === ambush.id), 'an ambush springs within 200 px');
    const cleared = deepwood.encountersToTrigger(ambush.x, ambush.y, () => true);
    ok(cleared.length === 0, 'a cleared encounter never fires again');
  }
}

/* ── 6. Streaming radius follows the viewport, not a constant ──────────── */
const cs = WORLD_CONFIG.chunkSize;
const at1080 = chunkRadiusForView(1920, 1080, cs);
const at4k = chunkRadiusForView(3840, 2160, cs);
const small = chunkRadiusForView(800, 600, cs);
ok(at1080 >= 3 && at1080 <= 4, `1080p needs a ${at1080}-chunk ring`);
ok(at4k >= at1080, 'a 4K viewport needs at least as much as 1080p');
ok(small <= at1080, 'a small viewport needs fewer chunks than 1080p');
ok(chunkRadiusForView(0, 0, cs) === 2, 'a broken viewport falls back to the minimum ring');
ok(chunkRadiusForView(100000, 100000, cs) === 4, 'an absurd viewport is capped');
ok(chunkRadiusForView(100, 100, 0) === 2, 'a broken chunk size falls back to the minimum ring');

// Zoom shrinks the visible world, so the ring must shrink with it.
const zoomedIn = chunkRadiusForView(1920 / 2, 1080 / 2, cs);
ok(zoomedIn <= at1080, 'zooming in does not ask for more chunks');

console.log(`region-pipeline: ${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} region pipeline assertion(s) failed`);
