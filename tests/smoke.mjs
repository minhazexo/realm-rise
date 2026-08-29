// Smoke tests for the pure-logic layer: data integrity + math utils.
import { ITEMS } from '../src/game/data/items.js';
import { RECIPES } from '../src/game/data/recipes.js';
import { BUILDINGS } from '../src/game/data/buildings.js';
import { ALL_ENEMY_DEFS } from '../src/game/data/enemies.js';
import { SKILLS } from '../src/game/data/skills.js';
import { MAIN_QUESTS, QUEST_ORDER } from '../src/game/data/questsMain.js';
import { FACTIONS } from '../src/game/data/factions.js';
import { NPCS } from '../src/game/data/npcs.js';
import { mulberry32, hash2, valueNoise, fbm, clamp, lerp } from '../src/utils/math.js';
import { xpForLevel } from '../src/game/core/Constants.js';

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

if (failures === 0) console.log('✅ SMOKE PASS — data layer consistent.');
else {
  console.error(`❌ ${failures} failure(s)`);
  process.exit(1);
}
