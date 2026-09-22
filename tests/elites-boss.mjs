// Elite enemies + Warden of Ash boss — data integrity & balance sanity.
// Pure data checks (no Phaser, no browser). Chained into `npm test`.
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

const { ELITES, ELITE_FOR_BASE } = await import('../src/game/data/elites.ts');
const { getEnemyDef } = await import('../src/game/data/enemies.ts');
const { getItem } = await import('../src/game/data/items.ts');
const { SIDE_QUESTS } = await import('../src/game/data/questsSide.ts');
const { allPois } = await import('../src/game/world/worldGen.ts');

const ELITE_KEYS = Object.keys(ELITES);
const BOSS_MOVES = new Set([
  'pounce', 'swipe', 'howl_summon', 'beam_sweep', 'slam', 'combo_charge',
  'summon_guards', 'ground_slam', 'shockwave', 'core_overload', 'throw_axe', 'fire_slam'
]);
const PROJECTILE_KINDS = new Set(['arrow', 'fireball', 'magic']);

/** Chance-weighted expected loot value of a def. */
function lootValue(def) {
  let v = 0;
  for (const l of def.loot || []) {
    const it = getItem(l.id);
    if (!it) return -1; // unknown item id — hard failure below
    v += (it.value || 0) * l.chance * ((l.min + l.max) / 2);
  }
  return v + (def.goldDrop || 0);
}

// ── 1. Elite registry integrity ─────────────────────────────────────────
for (const key of ELITE_KEYS) {
  const e = ELITES[key];
  ok(e.elite === true, `${key}: elite flag set`);
  ok(!!e.baseOf && !!getEnemyDef(e.baseOf), `${key}: baseOf '${e.baseOf}' resolves to a real enemy`);
  const base = e.baseOf ? getEnemyDef(e.baseOf) : null;
  ok(!!base && e.name !== base.name, `${key}: name differs from base`);
  ok(!!base && e.hp > base.hp * 3, `${key}: hp ${e.hp} meaningfully above base ${base?.hp}`);
  ok(!!base && e.atk > base.atk, `${key}: atk ${e.atk} scales past base ${base?.atk}`);
  ok(!!base && e.xp > base.xp * 5, `${key}: xp ${e.xp} rewards the risk vs base ${base?.xp}`);
  const lv = lootValue(e), bv = base ? lootValue(base) : -1;
  ok(lv > 0 && lv > bv, `${key}: loot expected value ${Math.round(lv)} beats base ${Math.round(bv)}`);
  ok(e.eliteLootNote === undefined, `${key}: no stray fields`); // trivial shape guard
}
ok(ELITE_KEYS.length === 4, `exactly 4 elites (got ${ELITE_KEYS.length})`);

// ── 2. Promotion map ────────────────────────────────────────────────────
ok(Object.keys(ELITE_FOR_BASE).length === 4, 'promotion map covers all 4 elites');
for (const [base, elite] of Object.entries(ELITE_FOR_BASE)) {
  ok(!!getEnemyDef(base), `promotion base '${base}' exists`);
  ok(!!getEnemyDef(elite) && getEnemyDef(elite).baseOf === base, `promotion '${base}'→'${elite}' round-trips`);
}
// Elites never banish in daylight (nameplate would outlive the sprite).
for (const key of ELITE_KEYS) ok(ELITES[key].nightOnly !== true, `${key}: not nightOnly`);

// ── 3. Ranged elite uses a real projectile kind ─────────────────────────
const stalker = ELITES.void_stalker;
ok(stalker.ranged === true && PROJECTILE_KINDS.has(stalker.projectileKind || 'arrow'),
  `void_stalker ranged kind '${stalker.projectileKind}' is renderable`);

// ── 4. Warden of Ash boss def ────────────────────────────────────────────
const warden = getEnemyDef('warden_of_ash');
ok(!!warden, 'warden_of_ash registered');
ok(warden.boss === true && (warden.phases?.length || 0) === 2, 'warden: boss with 2 phases');
const ph = warden.phases;
ok(ph[0].belowHp === 1 && ph[1].belowHp < ph[0].belowHp, 'warden: phase thresholds descend');
for (const p of ph) for (const m of p.moves) ok(BOSS_MOVES.has(m), `warden: move '${m}' implemented in BossEnemy.runMove`);
ok(warden.weak.includes('ice') && warden.resist.includes('fire'), 'warden: frost weak / fire resist profile');
ok((warden.loot || []).some((l) => l.id === 'ash_ember' && l.chance === 1), 'warden: guaranteed ash_ember haul');
ok(warden.goldDrop >= 200 && warden.xp >= 300, 'warden: kill payout worth the trip');

// ── 5. Unique reward: Emberforged Blade ─────────────────────────────────
const blade = getItem('emberforged_blade');
ok(!!blade, 'emberforged_blade defined');
ok(blade.cat === 'weapon' && blade.weapon?.element === 'fire' && blade.weapon?.style === 'crush',
  'blade: fire greatsword identity');
ok(blade.weapon?.special === 'dawnbreaker', 'blade: reuses the fire-wave special (no duplicate resolver)');
ok(blade.rarity === 'legendary' && blade.weapon?.dmg >= 30 && blade.weapon?.dmg <= 38,
  'blade: legendary, no stat inflation vs Dawnbreaker (36 mythic)');
for (const id of ['bloodfang_fang', 'void_ember', 'ash_ember']) {
  const it = getItem(id);
  ok(!!it && (it.value || 0) > 0, `${id}: trophy resource exists with value`);
}

// ── 6. Quest wiring (explore → boss → reward) ───────────────────────────
const q = SIDE_QUESTS.sq_the_warden_of_ash;
ok(!!q, 'sq_the_warden_of_ash defined');
ok(q.steps[0].type === 'reach' && q.steps[0].poiTag === 'warden_pyre', 'quest: reach step targets the pyre POI');
ok(q.steps[1].type === 'boss' && q.steps[1].target === 'warden_of_ash', 'quest: boss step targets the warden');
ok((q.rewards?.flagsSet || []).includes('warden_slain'), 'quest: sets the warden_slain unlock flag');
ok(!!getItem(q.rewards?.items?.emberforged_blade !== undefined ? 'emberforged_blade' : ''), 'quest: blade reward item exists');
ok(!!q.intro && q.intro.length > 40, 'quest: lore intro present (story-through-text)');

// ── 7. World placement ──────────────────────────────────────────────────
const pois = allPois();
const pyre = pois.find((p) => p.id === 'warden_pyre');
ok(!!pyre && pyre.boss === 'warden_of_ash', 'warden_pyre POI exists and spawns the boss');
ok(!!pyre && pyre.danger >= 3, 'pyre POI is flagged dangerous');
const elara = pois.find((p) => p.id === 'elara_camp');
ok(!!pyre && !!elara && Math.hypot(pyre.x - elara.x, pyre.y - elara.y) > 500,
  'pyre is a deliberate trip from the hub, not next door');

console.log(`elites-boss: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
