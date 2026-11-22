// Regions gate: the atlas contract, its geometry, and fast travel.
//
// docs/WORLD-MAP.md §4/§9 makes promises the code has to keep, and this is where
// they are checked: every region declares its footprint, footprints never
// overlap, the player spawns inside exactly one region and that region keeps him
// safe, every waypoint resolves to a real POI of its own region, and the
// unlocked list the World Map reads is written by arriving — never by a guess.
//
// Pure data + pure geometry + the travel rules: no Phaser, no browser.
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) passed++; else { failed++; console.error('  ✗ ' + label); } };

const GameState = (await import('../src/game/core/GameState.ts')).default;
const { WORLD_CONFIG } = await import('../src/game/core/Constants.ts');
const { Bus, CH } = await import('../src/game/core/EventBus.ts');
const { REGIONS, regionAnchors, regionById, regionWaypoints } = await import('../src/game/systems/world/RegionRegistry.ts');
const { inAnchor, regionAt } = await import('../src/game/systems/world/RegionLayout.ts');
const Travel = await import('../src/game/systems/world/RegionTravel.ts');
const { waypointsOf } = await import('../src/game/data/region.ts');
const { getEnemyDef } = await import('../src/game/data/enemies.ts');

const SPAWN = { x: WORLD_CONFIG.spawn.x, y: WORLD_CONFIG.spawn.y };

// ── 1. The contract: a region declares where it is ──────────────────────────
// A region without an anchor cannot be found by geometry, which is the whole
// point of registering it: RegionTravel would never announce it.
ok(REGIONS.length >= 1, `${REGIONS.length} region(s) registered`);
const ids = new Set(REGIONS.map((r) => r.id));
ok(ids.size === REGIONS.length, 'region ids are unique');
ok(regionAnchors().length === REGIONS.length, 'every registered region declares an anchor');
ok(regionAnchors().every((a) => a.id && ids.has(a.id)), 'every anchor carries its region id');
for (const r of REGIONS) {
  const a = r.anchor;
  ok(!!a && a.radius > 0, `${r.id}: anchor radius ${a?.radius} is a real footprint`);
  ok(!!a && inAnchor(a, a.x, a.y), `${r.id}: anchor contains its own centre`);
  // Every authored area sits inside the footprint: crossing into a region must
  // never happen after you are already standing in one of its places.
  for (const s of r.subregions) {
    ok(!!a && Math.hypot(s.x - a.x, s.y - a.y) + s.radius <= a.radius,
      `${r.id}/${s.id}: area fits inside the region footprint`);
  }
  for (const p of r.pois ?? []) {
    ok(!!a && inAnchor(a, p.x, p.y), `${r.id}/${p.id}: POI is inside the region footprint`);
  }
}

// ── 2. Regions keep their distance (and the hub belongs to one of them) ─────
const anchors = regionAnchors();
for (let i = 0; i < anchors.length; i++) {
  for (let j = i + 1; j < anchors.length; j++) {
    const a = anchors[i], b = anchors[j];
    ok(Math.hypot(a.x - b.x, a.y - b.y) > a.radius + b.radius,
      `${a.id} and ${b.id} do not overlap (${Math.round(Math.hypot(a.x - b.x, a.y - b.y))}px apart)`);
  }
}
const homes = anchors.filter((a) => inAnchor(a, SPAWN.x, SPAWN.y));
ok(homes.length === 1, `the player spawns inside exactly one region (${homes.map((h) => h.id).join(', ') || 'none'})`);
const home = homes[0] ? regionById(homes[0].id) : null;
ok(!!home && home.isSafe?.(SPAWN.x, SPAWN.y) === true, 'the region the player spawns in keeps him safe');
ok(anchors.every((a) => {
  const r = regionById(a.id);
  return !r || r.encounters.every((e) => r.isSafe?.(e.x, e.y) !== true);
}), 'no designed fight is seated inside a region safe zone');

// ── 3. Geometry answers "which region am I in?" ─────────────────────────────
ok(regionAt([], 0, 0) === null, 'no regions → no region');
ok(regionAt(anchors, 16000, 16000) === null, 'the corners of the world are wilds');
if (home) {
  ok(regionAt(anchors, SPAWN.x, SPAWN.y)?.id === home.id, 'the spawn resolves to the home region');
  const a = home.anchor;
  ok(regionAt(anchors, a.x, a.y).id === a.id, 'an anchor centre resolves to itself');
  ok(regionAt(anchors, a.x + a.radius + 1, a.y) === null, 'one pixel outside the circle is out of the region');
  ok(inAnchor(a, a.x + a.radius, a.y), 'the boundary itself is inside (inclusive)');
}

// ── 4. Waypoints resolve, and are places the region actually declares ────────
const declaring = REGIONS.filter((r) => !!r.waypoint);
ok(declaring.length >= 1, `${declaring.length} region(s) declare a travel point`);
ok(regionWaypoints().length === declaring.length, 'every declared waypoint resolves to a POI (none dangles)');
for (const r of declaring) {
  const wp = waypointsOf(r);
  ok(wp.length === 1, `${r.id}: one waypoint resolves`);
  const poi = (r.pois ?? []).find((p) => p.id === r.waypoint.poi);
  ok(!!poi, `${r.id}: waypoint names a POI of its own region ('${r.waypoint.poi}')`);
  if (poi) {
    ok(wp[0].x === poi.x && wp[0].y === poi.y, `${r.id}: the waypoint IS that POI's position`);
    ok(inAnchor(r.anchor, poi.x, poi.y), `${r.id}: fast travel lands inside the region`);
  }
}


// ── 5. Guardians exist: an arena without its boss is a dead beat ────────────
for (const r of REGIONS) {
  if (r.arena) ok(!!getEnemyDef(r.arena.bossKey), `${r.id}: arena boss '${r.arena.bossKey}' is a real enemy`);
  for (const h of r.hazards) {
    if (h.bossKey) ok(!!getEnemyDef(h.bossKey), `${r.id}/${h.id}: hazard is gated on a real boss`);
  }
  for (const e of r.encounters) {
    for (const m of e.members) ok(!!getEnemyDef(m.key), `${r.id}/${e.id}: member '${m.key}' is a real enemy`);
  }
  ok((r.pois ?? []).length === new Set((r.pois ?? []).map((p) => p.id)).size, `${r.id}: POI ids are unique inside the region`);
  for (const poi of r.pois ?? []) {
    if (poi.boss) ok(!!getEnemyDef(poi.boss), `${r.id}/${poi.id}: POI boss '${poi.boss}' is a real enemy`);
  }
}

// ── 6. Fast travel: unlocked by arriving, refused until then ────────────────
GameState.newGame(20260926, { name: 'Wayfarer', gender: 'f', personality: 'kind' }, 'normal');
Travel.resetRegionTravel();

// Toasts go out on the bus (the React overlay owns the list), so this is how a
// headless suite hears what the player was told.
const toasts = [];
Bus.on(CH.TOAST, (t) => toasts.push(t));

const stub = {
  moved: [],
  movePlayer(x, y) { this.moved.push({ x, y }); GameState.s.world.px = Math.round(x); GameState.s.world.py = Math.round(y); },
};

if (home) {
  const id = home.id;
  ok(Travel.currentRegionId(SPAWN.x, SPAWN.y) === id, 'a fresh world already knows which region it is in');
  ok(Travel.canFastTravel(id) === false, 'a region you have not unlocked cannot be travelled to');
  ok(Travel.unlockedWaypoints().length === 0, 'a fresh save has no travel points');
  ok(Travel.fastTravel(stub, id) === null, 'fast travel is refused before the region is unlocked');
  ok(stub.moved.length === 0, 'a refused travel does not move the player');
  ok(Travel.fastTravel(stub, 'no_such_region') === null, 'an unregistered region is refused');

  const entered = Travel.tickRegionTravel(SPAWN.x, SPAWN.y);
  ok(entered?.id === id, 'crossing into the region announces it');
  ok(Travel.canFastTravel(id) === true, 'arriving unlocks the region travel point');
  ok(GameState.s.world.unlockedFastTravel.join() === id, 'the unlock is written to the saved world list');
  ok(Travel.tickRegionTravel(SPAWN.x, SPAWN.y) === null, 'standing still does not re-announce the region');
  ok(GameState.s.world.unlockedFastTravel.length === 1, 'staying put cannot duplicate the unlock');
  ok(Travel.unlockTravel(id) === false, 'unlockTravel is idempotent');

  ok(Travel.tickRegionTravel(15000, 15000) === null, 'the wilds between regions announce nothing');
  ok(Travel.tickRegionTravel(SPAWN.x, SPAWN.y)?.id === id, 'coming back announces the region again');

  const unlocked = Travel.unlockedWaypoints();
  ok(unlocked.length === 1 && unlocked[0].region === id, 'the unlocked waypoint is listed for the map UI');
  ok(Travel.fastTravel(stub, id)?.label === unlocked[0].label, 'travelling returns where the player landed');
  const wp = waypointsOf(home)[0];
  ok(stub.moved.length === 1 && stub.moved[0].x === wp.x && stub.moved[0].y === wp.y, 'travel moves the player to the waypoint');
  ok(GameState.s.world.px === wp.x && GameState.s.world.py === wp.y, 'the saved world position follows the travel');
  ok(Travel.tickRegionTravel(wp.x, wp.y) === null, 'arriving is not a crossing (no immediate re-announce)');
  ok(Travel.fastTravel({ moved: [] }, id) === null, 'travel with no scene able to move the player is refused');

  const snap = Travel.travelSnapshot(SPAWN.x, SPAWN.y);
  ok(snap.region === id && Array.isArray(snap.unlocked), 'the travel snapshot reports region + unlocks');
  ok(toasts.some((t) => t.title === home.anchor.name.toUpperCase()),
    'crossing into a region tells the player its name');
  ok(toasts.some((t) => t.title === wp.label.toUpperCase()), 'travelling tells the player where they landed');
}

console.log(`regions: ${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} region assertion(s) failed`);
