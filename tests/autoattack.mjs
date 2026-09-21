// Unit tests for AutoAttackSystem — pure logic, no Phaser.
// Added to `npm test` chain in package.json.
import assert from 'node:assert/strict';
import GameState from '../src/game/core/GameState.ts';
import {
  autoAttackTick, pickTarget, scoreTarget, notifyPlayerHit, autoAttackEnabled
} from '../src/game/systems/AutoAttackSystem.ts';
import { updateSettings } from '../src/game/systems/SettingsSystem.ts';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; } else { failed++; console.error('✗ ' + m); } };

GameState.newGame(4242, { name: 'Auto', gender: 'm', personality: 'bold' }, 'normal');
const S = () => GameState.s;

// ── stub scene + enemies ────────────────────────────────────────────────────
function mkEnemy(x, y, opts = {}) {
  return {
    dead: false,
    sprite: { x, y },
    hp: opts.hp ?? 30, maxHp: opts.maxHp ?? 30,
    state: opts.state ?? 3, // CHASE by default
    def: { radius: 10 },
    ...opts
  };
}
function mkScene(enemies) {
  return {
    player: {
      sprite: { x: 0, y: 0 },
      blocking: false,
      cool: { attack: 0 },
      // Stub tryAttack: records swings, applies the same cooldown contract
      // the real Player sets (cool.attack = wpn.cd / mult ≈ 0.5).
      tryAttack(opts, aim, _enemies, _floats) {
        this.lastAim = aim;
        this.cool.attack = 0.5;
        return true;
      }
    },
    enemies,
    floats: { add() {} }
  };
}

// ── 1. settings toggle gates everything ────────────────────────────────────
ok(autoAttackEnabled() === true, 'auto-attack defaults ON');
updateSettings({ toggles: { autoAttack: false } });
ok(autoAttackEnabled() === false, 'toggle off reads false');
const gated = mkScene([mkEnemy(60, 0)]);
const before = S().stats.autoAttacks || 0;
ok(autoAttackTick(gated, 0.016) === false, 'tick does nothing while toggled off');
ok((S().stats.autoAttacks || 0) === before, 'no swing counted while toggled off');
updateSettings({ toggles: { autoAttack: true } });
ok(autoAttackEnabled() === true, 'toggle back on');

// ── 2. scoring: attacking enemy outranks a distant chaser at same distance ──
const nearAttacker = mkEnemy(100, 0, { state: 4 });
const nearChaser = mkEnemy(-100, 0, { state: 3 });
ok(scoreTarget(nearAttacker, 100) < scoreTarget(nearChaser, 100), 'ATTACK state outscores CHASE at equal distance');
const woundedChaser = mkEnemy(0, 100, { state: 3, hp: 10 });
ok(scoreTarget(woundedChaser, 100) < scoreTarget(nearChaser, 100), 'wounded enemy outranks healthy at equal distance');

// pickTarget picks the attacking enemy even if farther.
const scene2 = mkScene([mkEnemy(50, 0, { state: 3 }), mkEnemy(90, 0, { state: 4 })]);
const t2 = pickTarget(scene2);
ok(t2.state === 4, 'pickTarget selects the mid-attack enemy (the request)');

// Out-of-range enemies are never candidates.
const scene3 = mkScene([mkEnemy(400, 0)]);
ok(pickTarget(scene3) === null, 'enemy beyond scan range is ignored');
ok(scene3._autoAtk.lock === null, 'no lock created for out-of-range enemy');

// Dead enemies are skipped.
const scene4 = mkScene([mkEnemy(60, 0, { dead: true })]);
ok(pickTarget(scene4) === null, 'dead enemy is not targeted');

// ── 3. sticky lock ──────────────────────────────────────────────────────────
const boss = mkEnemy(120, 0, { state: 3, boss: true });
const chaser = mkEnemy(80, 0, { state: 3 });
const scene5 = mkScene([boss, chaser]);
const first = pickTarget(scene5); // chaser is closer → lock
ok(first === chaser, 'locks the closest enemy first');
// Now a juicier (attacking) enemy appears closer than LOCK_RANGE but the
// lock holds — no thrash mid-fight.
const attacker = mkEnemy(100, 0, { state: 4 });
scene5.enemies.push(attacker);
ok(pickTarget(scene5) === chaser, 'lock is sticky while target lives in range');
// Lock breaks beyond LOCK_RANGE (400px): teleport the locked one away.
chaser.sprite.x = 800;
const now = pickTarget(scene5);
ok(now === attacker, 'lock releases beyond range and re-picks best (attacker)');

// ── 4. tick swings in range, holds fire out of range ───────────────────────
const scene6 = mkScene([mkEnemy(40, 0, { state: 3 })]);
ok(autoAttackTick(scene6, 0.016) === true, 'swings when target within reach');
ok(scene6.player.lastAim.x === 40 && scene6.player.lastAim.y === 0, 'swing aims at the target position');
const cdAfter = scene6._autoAtk.cd;
ok(cdAfter >= 0.4, `cooldown floor 0.4s applied (got ${cdAfter})`);
ok(autoAttackTick(scene6, 0.01) === false, 'no second swing during cooldown');

const scene7 = mkScene([mkEnemy(200, 0, { state: 3 })]);
ok(autoAttackTick(scene7, 0.016) === false, 'holds fire while target out of weapon reach');
ok(scene7.player.lastAim === undefined, 'no swing fired out of range');

// ── 5. player-busy gates ────────────────────────────────────────────────────
const scene8 = mkScene([mkEnemy(40, 0, { state: 3 })]);
scene8.player.blocking = true;
ok(autoAttackTick(scene8, 0.016) === false, 'never swings while blocking');
scene8.player.blocking = false;
scene8.player.cool.attack = 0.3;
ok(autoAttackTick(scene8, 0.016) === false, 'never interrupts an in-progress swing');
scene8.player.cool.attack = 0;
GameState.session.uiPanel = 'inventory';
ok(autoAttackTick(scene8, 0.016) === false, 'never swings while a UI panel is open');
GameState.session.uiPanel = null;

// ── 6. vengeance window opens on player hit ────────────────────────────────
const scene9 = mkScene([mkEnemy(250, 0, { state: 0 })]); // idle, in scan range
ok(pickTarget(scene9) === null, 'idle enemy is never targeted (assist is defensive)');
notifyPlayerHit(scene9, 250, 0);
ok(scene9._autoAtk.vengeance > 0, 'vengeance window opened');
ok(pickTarget(scene9) === scene9.enemies[0], 'vengeance makes the attacker eligible even while idle');
// The window decays over time and clamps at zero.
autoAttackTick(scene9, 1.0);
ok(scene9._autoAtk.vengeance < 2.5, 'vengeance decays with dt');
autoAttackTick(scene9, 2.0);
ok(scene9._autoAtk.vengeance === 0, 'vengeance clamps at zero');

// ── 7. state introspection (scene._autoAtk is the state contract) ──────────
const sceneState = mkScene([]);
autoAttackTick(sceneState, 0.016); // first tick lazily creates the state
const st = sceneState._autoAtk;
ok(st && typeof st.cd === 'number' && 'lock' in st && 'vengeance' in st, 'scene._autoAtk exposes cd/lock/vengeance');

console.log(`autoattack: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
