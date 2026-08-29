// ─────────────────────────────────────────────────────────────────────────────
// Boss enemy (spec §20): multi-phase attacks driven by the def.phases table.
// Extends Enemy and overrides the attack cadence/moves per phase.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';
import Enemy from './Enemy.js';

export default class BossEnemy extends Enemy {
  constructor(scene, defKey, x, y) {
    super(scene, defKey, x, y);
    this.boss = true;
    this.phaseIndex = 0;
    this.lastPhaseHpPct = 1;
    this.moveCds = {};
    this.radius = this.def.arenaRadius || 520;
    this.scene.bossUI?.show(this);
    Bus.emit('boss-intro', defKey);
  }

  update(dt, ctx) {
    if (this.dead) return;
    // phase transitions based on hp %
    const pct = this.hp / this.maxHp;
    const phases = this.def.phases || [];
    let idx = phases.findIndex((ph) => pct <= ph.belowHp);
    if (idx < 0) idx = 0;
    if (idx !== this.phaseIndex) {
      this.phaseIndex = idx;
      const ph = phases[idx];
      Bus.emit('boss-phase', { key: this.key, phase: idx + 1 });
      if (ph?.enrageSpeed) this.atkSpd *= ph.enrageSpeed;
      if (ph?.summon) this.summon(ph.summon.type, ph.summon.count);
      this.scene.bossUI?.setPhase(idx + 1);
      this.scene.cameras.main.flash(300, 255, 120, 40);
    }
    this.lastPhaseHpPct = pct;

    const p = this.player;
    if (!p?.sprite || GameState.s.session_dead) { this.sprite.body?.setVelocity(0, 0); return; }

    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
    // always chase slowly unless within melee
    if (d > this.def.attackRange) {
      this.moveToward(p.sprite.x, p.sprite.y, this.atkSpd, dt);
    }
    this.faceTarget(p.sprite);
    this.syncAnim(dt);

    // movement-cooldown driven attack selection
    const phase = phases[this.phaseIndex] || phases[0] || { moves: ['swipe'] };
    const moveName = phase.moves[Math.floor(Math.random() * phase.moves.length)];
    this.runMove(moveName, p, d);
  }

  runMove(name, p, d) {
    const cd = this.tickCd(name);
    if (cd > 0) return;
    const setCd = (s) => { this.moveCds[name] = s; };

    switch (name) {
      case 'pounce': {
        if (d > 90 && d < 420) {
          setCd(1.6);
          Bus.emit('play-sound', 'wolf_growl');
          this.scene.tweens.add({ targets: this.sprite, x: p.sprite.x, y: p.sprite.y, duration: 380, ease: 'Quad.out' });
          this.scene.time.delayedCall(360, () => { if (!this.dead && Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y) < 70) this.hitPlayer(p, 1.0); });
        } else setCd(0.4);
        break;
      }
      case 'swipe':
        setCd(this.def.attackCd);
        this.scene.time.delayedCall(280, () => { if (!this.dead) this.hitPlayer(p, 0.9); });
        break;
      case 'howl_summon':
        setCd(9);
        this.summon('wolf', 2);
        this.scene.cameras.main.shake(200, 0.004);
        break;
      case 'slam': {
        setCd(3.2);
        this.scene.fxSlam?.(this.sprite.x, this.sprite.y, this.def.slamRadius || 86);
        if (d < (this.def.slamRadius || 86) + 30) this.hitPlayer(p, this.def.aoeSlam ? 1.1 : 0.8);
        Bus.emit('play-sound', 'build_thud');
        break;
      }
      case 'combo_charge': {
        setCd(4);
        Bus.emit('play-sound', 'sword');
        for (let i = 0; i < 2; i++) {
          this.scene.time.delayedCall(200 + i * 300, () => { if (!this.dead && Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y) < this.def.attackRange + 24) this.hitPlayer(p, 0.75); });
        }
        break;
      }
      case 'summon_guards':
        setCd(10);
        this.summon(this.def.phases[this.phaseIndex]?.summon?.type || 'bandit_swordsman', this.def.phases[this.phaseIndex]?.summon?.count || 2);
        break;
      case 'ground_slam':
        setCd(3.4);
        this.scene.groundSlamFx?.(this.sprite.x, this.sprite.y);
        if (d < 120) this.hitPlayer(p, 1.1);
        Bus.emit('play-sound', 'build_thud');
        break;
      case 'shockwave':
        setCd(4.4);
        this.scene.shockwaveFx?.(this.sprite.x, this.sprite.y);
        if (d < 220) this.hitPlayer(p, 1.05);
        break;
      case 'core_overload':
        setCd(12);
        Bus.emit('play-sound', 'boss_roar');
        this.scene.overloadFx?.(this);
        this.scene.time.delayedCall(500, () => { if (!this.dead && Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y) < 260) this.hitPlayer(p, 1.5); });
        break;
      case 'throw_axe':
        setCd(3.6);
        this.scene.spawnProjectile({
          kind: 'fireball', x: this.sprite.x, y: this.sprite.y - 18,
          angle: Math.atan2(p.sprite.y - this.sprite.y, p.sprite.x - this.sprite.x),
          speed: 520, maxDist: 480, dmg: this.atk * 0.9, crit: 0.05, owner: 'enemy', enemy: this
        });
        break;
      default:
        setCd(0.5);
        break;
    }
  }

  tickCd(name) {
    this.moveCds[name] = (this.moveCds[name] || 0) - 1 / 60;
    return this.moveCds[name];
  }

  hitPlayer(p, mult) {
    p.takeDamage(this.atk * mult, this.sprite.x, this.sprite.y);
    this.scene.cameras.main.shake(120, 0.006);
  }

  summon(type, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dx = Math.cos(ang) * 70;
      const dy = Math.sin(ang) * 70;
      this.scene.spawnEnemy(type, this.sprite.x + dx, this.sprite.y + dy);
    }
  }
}