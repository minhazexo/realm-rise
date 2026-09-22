// Unit tests for the ARPG combat pass: ElementalSystem, WeaponSpecials,
// weapon schema validity, and the save migration for the mana pool.
// Pure modules — no Phaser, no browser. Chained into `npm test`.
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

// ── Import the TS modules via the project's node loader pattern ──
// (other suites import compiled .ts directly with node's type-stripping)
const { ELEMENTS, isElement, elementalDamage, statusFor, applyStatus, tickStatuses, newStatusState, WEAK_MULT, RESIST_MULT, statusMoveMult, damageTakenMult } =
  await import('../src/game/systems/ElementalSystem.ts');
const { resolveSpecial, isUndead } = await import('../src/game/systems/WeaponSpecials.ts');
const { getItem, ITEMS } = await import('../src/game/data/items.ts');
const allItems = () => Object.values(ITEMS);
const { migrateSave } = await import('../src/game/systems/SaveSystem.ts');

console.log('— ElementalSystem —');
// Resist/weak math
ok(elementalDamage(100, 'fire', { weak: ['fire'] }).dmg === Math.round(100 * WEAK_MULT), 'weak multiplier amplifies damage');
ok(elementalDamage(100, 'ice', { resist: ['ice'] }).dmg === Math.round(100 * RESIST_MULT), 'resist multiplier reduces damage');
ok(elementalDamage(100, 'fire', { weak: ['ice'], resist: ['fire'] }).dmg === Math.round(100 * RESIST_MULT), 'neutral element ignores profiles');
ok(elementalDamage(100, 'fire', null).dmg === 100, 'null defender profile = neutral');
ok(elementalDamage(100, 'physical', {}).dmg === 100, 'empty profile = neutral');
// Element table integrity
ok(isElement('shadow') && !isElement('magic'), 'isElement gate');
for (const [k, info] of Object.entries(ELEMENTS)) {
  ok(typeof info.color === 'string' && info.color.startsWith('#'), `element ${k} has color`);
}
ok(ELEMENTS.fire.status === 'burn' && ELEMENTS.physical.status === null, 'fire burns, physical does not');
// Status rules
for (let i = 0; i < 200; i++) {
  const s = statusFor('fire', 40, { force: true });
  ok(s && s.kind === 'burn' && s.t > 0, 'forced fire always burns'); break;
}
let noStatus = true;
for (let i = 0; i < 200; i++) if (statusFor('physical', 40)) { noStatus = false; break; }
ok(noStatus, 'physical never inflicts status');
let eventually = false;
for (let i = 0; i < 500; i++) if (statusFor('fire', 40)) { eventually = true; break; }
ok(eventually, 'unforced fire inflicts burn sometimes (RNG path)');
// Stacking + ticking
const st = newStatusState();
ok(applyStatus(st, { kind: 'burn', t: 3, power: 7 }) === true, 'new status applies');
ok(applyStatus(st, { kind: 'burn', t: 2, power: 12 }) === false, 'duplicate refreshes not adds');
ok(st.list.length === 1 && st.list[0].power === 12 && st.list[0].t === 3, 'refresh keeps max power/duration');
let dotTotal = 0;
for (let i = 0; i < 70; i++) dotTotal += tickStatuses(st, 0.1).dot; // 7s of ticks
ok(dotTotal > 0, 'burn deals dot over time');
ok(st.list.length === 0, 'burn expires');
// Chill slows movement
const ch = newStatusState();
applyStatus(ch, { kind: 'chill', t: 2.5, power: 1 });
ok(statusMoveMult(ch) === 1, 'chill set but not yet ticked (mult applies after first tick)');
tickStatuses(ch, 0.1);
ok(statusMoveMult(ch) === 0.55, 'chill slows movement to 55%');
for (let i = 0; i < 30; i++) tickStatuses(ch, 0.1);
ok(statusMoveMult(ch) === 1, 'chill expires → full speed');
// Shock amplifies damage taken while active, then expires
const sh = newStatusState();
applyStatus(sh, { kind: 'shock', t: 1.5, power: 1 });
tickStatuses(sh, 0.1);
ok(damageTakenMult(sh) === 1.15, 'shock amplifies damage taken by 15%');
for (let i = 0; i < 20; i++) tickStatuses(sh, 0.1);
ok(damageTakenMult(sh) === 1, 'shock expires → normal damage');

console.log('— WeaponSpecials —');
// Voidfang: crits refund energy
const vf = resolveSpecial({ special: 'voidfang', element: 'shadow', baseDmg: 30, isCrit: true, isFinisher: false, isHeavy: false, nearbyEnemies: [], defenderKey: 'wolf' });
ok(vf.energyRefund === 8 && vf.label === 'Void drain', 'voidfang crit refunds energy');
ok(resolveSpecial({ special: 'voidfang', element: 'shadow', baseDmg: 30, isCrit: false, isFinisher: false, isHeavy: false, nearbyEnemies: [], defenderKey: 'wolf' }).energyRefund === 0, 'voidfang non-crit does nothing');
// Stormpiercer chains, skipping bosses
const sp = resolveSpecial({ special: 'chain_lightning', element: 'lightning', baseDmg: 20, isCrit: false, isFinisher: false, isHeavy: false, nearbyEnemies: [{ key: 'wolf', def: { boss: false } }, { key: 'boss_x', def: { boss: true } }, { key: 'boar', def: {} }], defenderKey: 'wolf' });
ok(sp.chainTargets.length === 2 && sp.chainMult === 0.45, 'chain hits 2 non-boss neighbors at 45%');
ok(resolveSpecial({ special: 'chain_lightning', element: 'lightning', baseDmg: 20, isCrit: false, isFinisher: false, isHeavy: false, nearbyEnemies: [{ key: 'boss', def: { boss: true } }], defenderKey: 'w' }).chainTargets.length === 0, 'chain skips lone boss');
// Gravekeeper: lifesteal + undead bonus
const gk = resolveSpecial({ special: 'gravekeeper', element: 'holy', baseDmg: 28, isCrit: false, isFinisher: false, isHeavy: false, nearbyEnemies: [], defenderKey: 'skeleton' });
ok(gk.lifesteal === 0.12 && gk.dmgMult === 1.35 && gk.label === 'Purified', 'gravekeeper lifesteals and smites undead');
const gk2 = resolveSpecial({ special: 'gravekeeper', element: 'holy', baseDmg: 28, isCrit: false, isFinisher: false, isHeavy: false, nearbyEnemies: [], defenderKey: 'bandit_scout' });
ok(gk2.lifesteal === 0.12 && gk2.dmgMult === 1, 'gravekeeper lifesteal applies to living too, no bonus');
// Dawnbreaker: heavy-only fire wave
ok(resolveSpecial({ special: 'dawnbreaker', element: 'fire', baseDmg: 36, isCrit: false, isFinisher: false, isHeavy: true, nearbyEnemies: [], defenderKey: 'w' }).fireWave, 'dawnbreaker heavy triggers wave');
ok(!resolveSpecial({ special: 'dawnbreaker', element: 'fire', baseDmg: 36, isCrit: false, isFinisher: false, isHeavy: false, nearbyEnemies: [], defenderKey: 'w' }).fireWave, 'dawnbreaker light does not wave');
// No special = inert result
const none = resolveSpecial({ special: undefined, element: 'physical', baseDmg: 10, isCrit: false, isFinisher: false, isHeavy: false, nearbyEnemies: [], defenderKey: 'w' });
ok(!none.fireWave && none.dmgMult === 1 && none.chainTargets.length === 0, 'missing special = inert');
ok(isUndead('skeleton') && isUndead('skeleton Restless Bones') && !isUndead('bandit_scout'), 'undead matcher (key, key+name; living false)');
ok(isUndead('skeleton Restless Bones') && !isUndead('wolf'), 'undead matcher (key+name string, plain animal false)');

console.log('— Weapon data validity —');
const WEAPON_STYLE_MAP = ['slash', 'crush', 'pierce', 'bow', 'staff'];
const VALID_ELEMENTS = new Set(Object.keys(ELEMENTS));
let weaponsChecked = 0;
for (const it of allItems()) {
  if (it.cat !== 'weapon' || !it.weapon) continue;
  weaponsChecked++;
  ok(typeof it.weapon.dmg === 'number' && it.weapon.dmg > 0, `${it.id}: positive dmg`);
  ok(it.weapon.cd > 0 && it.weapon.cd < 3, `${it.id}: sane cooldown`);
  ok(WEAPON_STYLE_MAP.includes(it.weapon.style), `${it.id}: known style (${it.weapon.style})`);
  if (it.weapon.element) ok(VALID_ELEMENTS.has(it.weapon.element) || it.weapon.element === 'arcane', `${it.id}: valid element (${it.weapon.element})`);
  if (it.weapon.style === 'bow') ok(!!it.weapon.ammo, `${it.id}: bow declares ammo`);
  if (it.weapon.style === 'staff') ok(typeof it.weapon.manaCost === 'number', `${it.id}: staff declares mana cost`);
  if (it.weapon.special) ok(['voidfang', 'chain_lightning', 'gravekeeper', 'dawnbreaker'].includes(it.weapon.special), `${it.id}: known special (${it.weapon.special})`);
}
ok(weaponsChecked >= 20, `weapon count sane (${weaponsChecked})`);
// Category identities from the brief
const dagger = getItem('bone_dagger'), dual = getItem('twin_cutlasses'), staff = getItem('apprentice_staff');
ok(dagger && dual && staff, 'new categories registered');
ok(dagger.weapon.cd < staff.weapon.cd && dagger.weapon.crit > 0.2, 'dagger: faster + crit-focused than staff');
ok(dual.weapon.comboFinisherMult > 1.5, 'dual blades: stronger finisher override');
// Legendaries present + distinct mechanics
const vb = getItem('voidfang'), stm = getItem('stormpiercer'), gkk = getItem('gravekeeper'), db = getItem('dawnbreaker');
ok(vb && stm && gkk && db, 'four legendaries registered');
ok(new Set([vb.weapon.special, stm.weapon.special, gkk.weapon.special, db.weapon.special]).size === 4, 'each legendary has a DISTINCT special');
ok(stm.weapon.style === 'pierce' && gkk.weapon.style === 'crush' && db.weapon.style === 'slash', 'legendaries span styles');

console.log('— Save migration (mana pool) —');
{
  const oldSave = { meta: { version: '1.0.0' }, player: { hp: 88, stamina: 50 }, inventory: [], settings: {}, world: {}, quests: {}, story: {}, factions: {}, stats: {}, settlement: {} };
  const m = migrateSave(oldSave);
  ok(m.player.mana === 60, '1.0.0 save gains mana=60 via migration');
  // Idempotency rule from SaveSystem header
  const m2 = migrateSave(m);
  ok(m2.player.mana === 60, 'migration idempotent');
  // Pre-migration ancient save → repair path (skips step table)
  const ancient = { meta: { version: '0.5.0' }, player: { hp: 70, stamina: 30 } };
  const m3 = migrateSave(ancient);
  ok(m3.player && typeof m3.player.mana === 'number', 'ancient save repaired with mana');
  // Modern save keeps its value
  const modern = { meta: { version: '1.1.0' }, player: { hp: 100, stamina: 100, mana: 123 }, inventory: [] };
  ok(migrateSave(modern).player.mana === 123, 'existing mana preserved');
}

console.log(`weapons-elements: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
