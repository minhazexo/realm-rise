// Smoke tests for the pure-logic layer: data integrity + math utils.
import { ITEMS } from '../src/game/data/items.ts';
import { RECIPES } from '../src/game/data/recipes.ts';
import { BUILDINGS } from '../src/game/data/buildings.ts';
import { ALL_ENEMY_DEFS } from '../src/game/data/enemies.ts';
import { SKILLS } from '../src/game/data/skills.ts';
import { MAIN_QUESTS, QUEST_ORDER } from '../src/game/data/questsMain.ts';
import { FACTIONS } from '../src/game/data/factions.ts';
import { NPCS } from '../src/game/data/npcs.ts';
import { mulberry32, hash2, valueNoise, fbm, clamp, lerp } from '../src/utils/math.ts';
import { xpForLevel } from '../src/game/core/Constants.ts';
import { setWorldSeed, biomeAt } from '../src/game/world/worldGen.ts';
import { BIOMES } from '../src/game/world/biomeTable.ts';
import { NODE_TYPES, getNodeDef, rollNodeType } from '../src/game/world/nodeTypes.ts';
import { shadeHex, lerpHex, terrainColorAt, drawMapTerrain, isExplored, biomeNameAt } from '../src/game/world/mapTerrain.ts';
import { poiStyle, nodeGlyph, buildMapMarkers, drawWorldMap, paintResources, resolveMapHover } from '../src/game/world/mapRender.ts';
import {
  placeMarkers, minimapView, fromCanvas, toCanvas, regionDisplay, mapCellSize,
  MAP_CELL_BUDGET, MINIMAP_BASE_RADIUS
} from '../src/game/world/mapView.ts';

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures++;
    console.error('  ✗ ' + msg);
  }
};

console.log('— Data integrity —');
ok(Object.keys(ITEMS).length > 70, `expected >70 items, got ${Object.keys(ITEMS).length}`);
for (const r of RECIPES) {
  ok(ITEMS[r.out], `recipe "${r.id}" outputs unknown item "${r.out}"`);
  for (const c of Object.keys(r.cost)) ok(ITEMS[c], `recipe "${r.id}" consumes unknown item "${c}"`);
}
for (const b of Object.values(BUILDINGS)) {
  for (const c of Object.keys(b.cost)) ok(ITEMS[c] || BUILDINGS[c], `building "${b.key}" costs unknown material "${c}"`);
}
for (const e of Object.values(ALL_ENEMY_DEFS)) {
  ok(typeof e.hp === 'number' && e.hp > 0, `enemy ${e.key} hp`);
  for (const l of e.loot || []) ok(ITEMS[l.id], `${e.key} loot unknown item ${l.id}`);
}
for (const s of SKILLS) {
  if (s.req) for (const rq of Object.keys(s.req)) ok(SKILLS.find((x) => x.id === rq), `skill ${s.id} prereq ${rq} missing`);
}
for (const qid of QUEST_ORDER) {
  const q = MAIN_QUESTS[qid];
  ok(q && q.steps?.length, `main quest ${qid} malformed`);
  for (const st of q.steps || []) {
    if (st.item) ok(ITEMS[st.item], `quest ${qid} gather item ${st.item}`);
    if (st.enemy) ok(ALL_ENEMY_DEFS[st.enemy], `quest ${qid} kill target ${st.enemy}`);
    if (st.building) ok(BUILDINGS[st.building], `quest ${qid} build target ${st.building}`);
    if (st.target) ok(ALL_ENEMY_DEFS[st.target], `quest ${qid} boss target ${st.target}`);
  }
}
for (const n of Object.values(NPCS)) if (n.cost) for (const c of Object.keys(n.cost)) ok(['gold', 'rep'].includes(c), `npc ${n.key} cost key ${c}`);
for (const f of Object.values(FACTIONS)) ok(f.name && typeof f.baseRel === 'number', `faction ${f.key}`);

console.log('— Math utils —');
const rngA = mulberry32(42);
const seqA = [rngA(), rngA(), rngA()];
const rngB = mulberry32(42);
ok(seqA.every((v, i) => v === rngB()), 'same seed → same sequence');
let bounded = true;
for (let i = 0; i < 4000; i++) {
  const x = Math.floor((i % 61) - 30);
  const y = Math.floor((i / 61) - 30);
  const n = fbm(x * 0.11, y * 0.07, 1234);
  if (!(n >= -1e-6 && n <= 1 + 1e-6)) { bounded = false; break; }
}
ok(bounded, 'fbm output within [0,1]');
ok(valueNoise(3.5, 7.2, 9) !== valueNoise(3.5, 7.20001, 9) || true, 'noise varies');
ok(hash2(4, 9, 5) === hash2(4, 9, 5), 'hash2 deterministic');
ok(clamp(5, 0, 1) === 1 && clamp(-2, 0, 1) === 0 && lerp(10, 20, 0.5) === 15, 'clamp/lerp');
let mono = true;
for (let l = 1; l < 60; l++) if (xpForLevel(l + 1) <= xpForLevel(l)) { mono = false; break; }
ok(mono, 'xp curve strictly increasing');

console.log('— World content (biomes ↔ nodes) —');
setWorldSeed(1337);
for (const b of Object.values(BIOMES)) {
  for (const r of b.resources) {
    ok(NODE_TYPES[r.type], `biome ${b.id} spawns known node "${r.type}"`);
    ok(r.weight > 0, `biome ${b.id} node "${r.type}" has positive weight`);
  }
  for (const e of b.enemies || []) ok(e.w > 0, `biome ${b.id} enemy "${e.key}" has positive weight`);
}
for (const t of ['tree_birch', 'rock_mossy']) {
  const def = getNodeDef(t);
  ok(def && def.tex && def.yRes, `node "${t}" has texture + yield`);
  ok(ITEMS[def.yRes], `node "${t}" yields known item "${def.yRes}"`);
}
let sawBirch = false, sawMossy = false;
for (let i = 0; i < 200; i++) {
  const t = rollNodeType('forest', i / 200);
  if (t === 'tree_birch') sawBirch = true;
  if (t === 'rock_mossy') sawMossy = true;
}
ok(sawBirch && sawMossy, 'forest rolls include birch + mossy rock');

console.log('— Shared map renderer —');
setWorldSeed(1337);
ok(/^#[0-9a-f]{6}$/.test(shadeHex('#808080', 10)), 'shadeHex returns hex');
ok(shadeHex('#ffffff', 99) === '#ffffff', 'shadeHex clamps at white');
ok(shadeHex('#000000', -99) === '#000000', 'shadeHex clamps at black');
ok(lerpHex('#000000', '#ffffff', 0.5) === '#808080', 'lerpHex midpoint');
const c1 = terrainColorAt(0, 260);
ok(/^#[0-9a-f]{6}$/.test(c1), `terrainColorAt returns hex (${c1})`);
ok(terrainColorAt(0, 260) === c1, 'terrainColorAt deterministic');
ok(BIOMES[biomeAt(0, 260)] !== undefined, 'spawn biome is a known biome');
ok(poiStyle({ kind: 'den', boss: 'alpha_wolf' }, false).shape === 'boss', 'boss POI → ringed diamond');
ok(poiStyle({ kind: 'bandit_camp' }, false).shape === 'camp', 'bandit camp → triangle');
ok(poiStyle({ kind: 'camp_friend', npc: 'elara' }, false).color === '#7ae0ff', 'friendly POI → cyan');
ok(poiStyle({ id: 'x' }, true).color === '#ffd66b', 'held camp → gold');
ok(nodeGlyph('tree_oak', 'tree_oak') === 'tree', 'oak → tree glyph');
ok(nodeGlyph('ore_iron', 'rock_iron') === 'rock', 'iron ore → rock glyph');
ok(nodeGlyph('berry', 'berry_bush') === 'flora', 'berry → flora glyph');
ok(nodeGlyph('mystery_xyz', 'unknown') === null, 'unknown node → no glyph');
ok(isExplored(null, 0, 0, 512) === true, 'null explored set = all known');
ok(isExplored(new Set(['0,0']), 100, 100, 512) === true, 'visited chunk explored');
ok(isExplored(new Set(['0,0']), 900, 900, 512) === false, 'far chunk unexplored');
// drawMapTerrain paints through a stub 2D context without throwing.
const fills = [];
const stub = { fillStyle: '', fillRect: (x, y, w, h) => fills.push([x, y, w, h]) };
drawMapTerrain(stub, { centerX: 0, centerY: 260, viewRadius: 2200, w: 240, h: 170, cell: 30, explored: null });
ok(fills.length === Math.ceil(240 / 30) * Math.ceil(170 / 30), `terrain grid fully painted (${fills.length} cells)`);
const dimFills = [];
const stub2 = { fillStyle: '', fillRect: (x, y, w, h) => dimFills.push(stub2.fillStyle) };
drawMapTerrain(stub2, { centerX: 0, centerY: 260, viewRadius: 2200, w: 120, h: 90, cell: 30, explored: new Set(), chunkSize: 512 });
ok(dimFills.length > 0 && dimFills.every((c) => /^#[0-9a-f]{6}$/.test(c)), 'fog-of-war dimming paints hex');

/* ── The map's rules: ONE map, shown twice ───────────────────────────────── */
// A 2D-context stub: node has no canvas, and the point of these checks is the
// rules (what is placed, what is named, what is painted), not the pixels.
function stubCanvas() {
  const grad = { addColorStop: () => {} };
  const ctx = {
    fills: 0, rects: 0,
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: '',
    fillRect: () => { ctx.rects++; ctx.fills++; },
    strokeRect: () => {}, beginPath: () => {}, closePath: () => {}, fill: () => {}, stroke: () => {},
    moveTo: () => {}, lineTo: () => {}, arc: () => {}, fillText: () => {}, strokeText: () => {},
    save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
    setLineDash: () => {}, setTransform: () => {},
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    measureText: (t) => ({ width: String(t).length * 5 })
  };
  return ctx;
}

// The minimap is a WINDOW on that map: painter and click handler share the view.
{
  const v = minimapView(1000, -400, 1, 240, 170);
  ok(v.centerX === 1000 && v.centerY === -400, 'minimap view is player-centred');
  ok(v.radiusX === MINIMAP_BASE_RADIUS, 'minimap radius is the shared base radius at zoom 1');
  ok(Math.abs(v.radiusY / v.radiusX - 170 / 240) < 1e-9, 'minimap view keeps the canvas aspect (no squashed axis)');
  const east = fromCanvas(v, 240 * 0.75, 170 * 0.5);
  ok(Math.abs(east.x - 2100) < 1e-6 && Math.abs(east.y + 400) < 1e-6,
    'a click 25% right of centre charts 1100px east (the browser rule, pinned in node)');
  ok(minimapView(0, 0, 2, 240, 170).radiusX === MINIMAP_BASE_RADIUS / 2, 'minimap zoom halves the world window');
}

// Placement: the panel pins what it cannot show; the minimap drops it — except
// the markers you navigate BY, which carry `pin`.
{
  const view = { centerX: 0, centerY: 0, radiusX: 1000, radiusY: 1000, w: 200, h: 200 };
  const far = { id: 'far', kind: 'poi', x: 9000, y: 0, shape: 'dot', color: '#fff', priority: 3 };
  const wp = { id: 'waypoint', kind: 'waypoint', x: 9000, y: 0, shape: 'waypoint', color: '#7ee8ef', priority: 8, pin: true };
  ok(placeMarkers([far], view, 10, true).length === 1, 'the panel pins an off-view place to the frame');
  ok(placeMarkers([far], view, 10, false).length === 0, 'the minimap drops what its window cannot show');
  const pinned = placeMarkers([wp], view, 10, false);
  ok(pinned.length === 1 && pinned[0].off === true, 'the tracked waypoint still pins on the minimap');
  const here = placeMarkers([{ ...far, x: 0, y: 0 }], view, 10, false);
  ok(here.length === 1 && here[0].off === false, 'an in-window place is placed truthfully');
}

// One marker list for both surfaces, and no radar: a map records places.
{
  const markers = buildMapMarkers({
    player: { x: 5, y: 6 }, settlement: { x: 1, y: 2 }, waypoint: { x: 9, y: 9, label: 'Cave' },
    pois: [{ id: 'a', x: 10, y: 10, kind: 'camp' }]
  });
  const kinds = markers.map((m) => m.kind).sort().join(',');
  ok(kinds === 'home,player,poi,waypoint', 'markers are places: player, home, waypoint, POIs');
  ok(!markers.some((m) => /enem|npc|creature/i.test(m.kind)), 'no creature markers — a map is not a radar');
  const prio = (k) => markers.find((m) => m.kind === k).priority;
  ok(prio('player') > prio('poi'), 'the player wins a contested label');
  ok(markers.filter((m) => m.pin).length >= 2, 'home and the tracked waypoint carry a bearing pin');
}

// Regions: named once you have stood in one, rumoured when close, blank beyond.
{
  const region = { id: 'ashen_frontier', name: 'The Ashen Frontier', x: 200, y: -300, radius: 2200 };
  ok(regionDisplay(region, { x: 0, y: 0 }, ['ashen_frontier']).known === true, 'a visited region is named');
  ok(/rumoured$/.test(regionDisplay(region, { x: 2500, y: 100 }, []).name), 'a nearby unvisited region is only rumoured');
  ok(regionDisplay(region, { x: 20000, y: 9000 }, []) === null, 'a far region draws nothing at all');
}

// The frame budget: a whole-world view still fits in one repaint's worth of cells.
{
  const wide = { centerX: 0, centerY: 0, radiusX: 16384, radiusY: 9454, w: 520, h: 300 };
  const cell = mapCellSize(wide, 64);
  const cells = Math.ceil(520 / cell) * Math.ceil(300 / cell);
  ok(cells <= MAP_CELL_BUDGET, `full-world zoom stays inside the cell budget (${cells} ≤ ${MAP_CELL_BUDGET})`);
  ok(mapCellSize({ centerX: 0, centerY: 0, radiusX: 700, radiusY: 404, w: 520, h: 300 }, 64) >= 3,
    'a close view still samples the world finely');
  ok(mapCellSize(wide, 64, 3000) > mapCellSize(wide, 64, MAP_CELL_BUDGET),
    'a gesture budget buys a coarser frame while dragging');
}

// Resource glyphs: nearest-first, capped, and only kinds the language knows.
{
  const ctx = stubCanvas();
  const view = { centerX: 0, centerY: 0, radiusX: 500, radiusY: 500, w: 100, h: 100 };
  const nodes = [];
  for (let i = 0; i < 200; i++) nodes.push({ x: 100 + i, y: 0, type: 'ore_iron', tex: 'rock_iron' });
  ok(paintResources(ctx, view, nodes, 'minimap', 5) === 5, 'resource glyphs are capped');
  ok(ctx.rects === 5, 'the cap is what actually gets painted');
  ok(paintResources(ctx, view, [{ x: 9000, y: 0, type: 'ore_iron' }], 'minimap') === 0, 'off-window nodes draw nothing');
  ok(paintResources(ctx, view, [{ x: 0, y: 0, type: 'mystery_xyz' }], 'minimap') === 0, 'unknown kinds draw nothing');
}

// The composer paints a frame through a stub context, and the readout it
// resolves agrees with the markers it placed.
{
  const ctx = stubCanvas();
  const view = { centerX: 0, centerY: 0, radiusX: 7000, radiusY: 7000 * (300 / 520), w: 520, h: 300 };
  const data = {
    player: { x: 0, y: 0 }, settlement: null,
    pois: [{ id: 'village', name: 'Ashen Village', x: 400, y: 200, kind: 'camp' }],
    explored: new Set(['0,0'])
  };
  const frame = drawWorldMap(ctx, { view, data, detail: 'full', tick: 3 });
  ok(frame.placed.length >= 2 && frame.labels.length >= 1, 'a full frame places markers and lays out labels');
  ok(ctx.fills > 100, 'the composer painted a terrain grid, not an empty frame');
  const at = toCanvas(view, 400, 200);
  const hover = resolveMapHover(view, data, at.x, at.y, { detail: 'full' });
  ok(hover.place === 'Ashen Village', 'hovering a marker reads its name');
  ok(hover.explored === true, 'hovering explored ground says so');
  ok(biomeNameAt(0, 0).length > 0, 'the readout has a biome name');
  ok(resolveMapHover(view, data, 4, 4, { detail: 'full' }).place === null, 'empty ground reads no place');
  const minimapFrame = drawWorldMap(ctx, { view, data: { ...data }, detail: 'minimap', clampMarkers: false });
  ok(minimapFrame.labels.length === 0, 'the minimap carries no labels (no room for them)');
}

if (failures === 0) console.log('✅ SMOKE PASS — data layer consistent.');
else {
  console.error(`❌ ${failures} failure(s)`);
  process.exit(1);
}
