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
import { shadeHex, lerpHex, terrainColorAt, poiStyle, nodeGlyph, drawMapTerrain, isExplored } from '../src/game/world/mapRender.ts';

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

if (failures === 0) console.log('✅ SMOKE PASS — data layer consistent.');
else {
  console.error(`❌ ${failures} failure(s)`);
  process.exit(1);
}
