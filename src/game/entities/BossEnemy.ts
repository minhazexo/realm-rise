// ─────────────────────────────────────────────────────────────────────────────
// Boss enemy (spec §20): multi-phase attacks driven by the def.phases table.
// Extends Enemy and overrides the attack cadence/moves per phase.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { Bus } from '../core/EventBus.ts';
import { photosensitiveMode, shakeAllowed } from '../systems/SettingsSystem.ts';
import Enemy from './Enemy.ts';

export default class BossEnemy extends Enemy {
  phaseIndex: number;
  lastPhaseHpPct: number;
  moveCds: Record<string, number>;
  radius: number;

  constructor(scene: Phaser.Scene, defKey: string, x: number, y: number) {
    super(scene, defKey, x, y);
    this.boss = true;
    this.phaseIndex = 0;
    this.lastPhaseHpPct = 1;
    this.moveCds = {};
    this.radius = this.def.arenaRadius || 520;
    (this.scene as any).bossUI?.show(this);
    Bus.emit('boss-intro', defKey);
    // Arena telegraph:
    // show the leash radius on the ground so the player can see how far
    // they can kite before the boss resets. Pulsing ring, auto-fades.
    import('../systems/CelebrationFX.ts').then((c) =>
      c.bossArenaRing(scene, x, y, this.radius));
  }

  override update(dt: number, _ctx?: any): void {
    if (this.dead) return;
    // phase transitions based on hp %
    const pct: number = this.hp / this.maxHp;
    const phases: any[] = this.def.phases || [];
    // Deepest threshold the current hp has crossed (phases descend 1 → 0.55 …).
    // A plain findIndex always matched phase 0's belowHp:1 and phase-locked
    // every boss at Phase 1 — walk from the deepest phase instead.
    let idx: number = 0;
    for (let i: number = phases.length - 1; i > 0; i--) {
      if (pct <= phases[i].belowHp) { idx = i; break; }
    }
    if (idx !== this.phaseIndex) {
      this.phaseIndex = idx;
      const ph = phases[idx];
      Bus.emit('boss-phase', { key: this.key, phase: idx + 1 });
      if (ph?.enrageSpeed) this.atkSpd *= ph.enrageSpeed;
      if (ph?.summon) this.summon(ph.summon.type, ph.summon.count);
      (this.scene as any).bossUI?.setPhase(idx + 1);
      // Fullscreen phase flash — skipped in photosensitivity mode.
      if (!photosensitiveMode()) this.scene.cameras.main.flash(300, 255, 120, 40);
    }
    this.lastPhaseHpPct = pct;

    const p = this.player;
    if (!p?.sprite || GameState.s.session_dead) { (this.sprite.body as Phaser.Physics.Arcade.Body | null)?.setVelocity(0, 0); return; }

    const d: number = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
    // always chase slowly unless within melee
    if (d > this.def.attackRange) {
      this.moveToward(p.sprite.x, p.sprite.y, this.atkSpd, dt);
    }
    this.faceTarget(p.sprite);
    this.syncAnim(dt);

    // movement-cooldown driven attack selection — try moves in shuffled
    // order so a single on-cd move (e.g. howl_summon) never stalls the boss.
    const phase: any = phases[this.phaseIndex] || phases[0] || { moves: ['swipe'] };
    const candidates: string[] = [...(phase.moves || ['swipe'])];
    if (!candidates.includes('swipe')) candidates.push('swipe'); // fallback basic
    for (let i = candidates.length - 1; i > 0; i--) {
      const j: number = Math.floor(Math.random() * (i + 1));
      const a = candidates[i] as string;
      const b = candidates[j] as string;
      candidates[i] = b as string;
      candidates[j] = a as string;
    }
    for (const moveName of candidates) {
      if (this.runMove(moveName as string, p, d)) break;
    }
  }

  /** Run a boss move. Returns true when the move executed (was off cooldown). */
  runMove(name: string, p: any, d: number): boolean {
    const cd: number = this.tickCd(name);
    if (cd > 0) return false;
    const setCd = (s: number): void => { this.moveCds[name] = s; };

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
        if (d > this.def.attackRange + 30) { setCd(0.3); return false; }
        setCd(this.def.attackCd);
        this.scene.time.delayedCall(280, () => { if (!this.dead) this.hitPlayer(p, 0.9); });
        break;
      case 'howl_summon':
        setCd(9);
        this.summon('wolf', 2);
        if (shakeAllowed()) this.scene.cameras.main.shake(200, 0.004);
        break;
      case 'beam_sweep': {
        // Ancient Guardian sweeping beam: telegraphed wide-arc zap.
        setCd(5);
        this.sprite.setTint(0x7be0c3);
        Bus.emit('play-sound', 'boss_roar');
        (this.scene as any).spawnBurst?.(this.sprite.x, this.sprite.y, 'fx_ring');
        this.scene.time.delayedCall(500, () => {
          if (this.dead) return;
          this.sprite.clearTint();
          const dd: number = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
          if (dd < 300) this.hitPlayer(p, 1.2);
          (this.scene as any).spawnBurst?.(p.sprite.x, p.sprite.y, 'fx_hitflash');
        });
        break;
      }
      case 'slam': {
        setCd(3.2);
        (this.scene as any).fxSlam?.(this.sprite.x, this.sprite.y, this.def.slamRadius || 86);
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
        (this.scene as any).groundSlamFx?.(this.sprite.x, this.sprite.y);
        if (d < 120) this.hitPlayer(p, 1.1);
        Bus.emit('play-sound', 'build_thud');
        break;
      case 'fire_slam': {
        // Telegraphed fire nova (Warden of Ash): ash-red tint + ground ring
        // during the windup, then a 150px AoE — visible, dodgeable, never instant.
        setCd(3.8);
        this.sprite.setTint(0xff6a3a);
        (this.scene as any).spawnBurst?.(this.sprite.x, this.sprite.y, 'fx_ring');
        Bus.emit('play-sound', 'boss_roar');
        this.scene.time.delayedCall(650, () => {
          if (this.dead) return;
          this.sprite.clearTint();
          (this.scene as any).fxSlam?.(this.sprite.x, this.sprite.y, 150);
          if (shakeAllowed()) this.scene.cameras.main.shake(200, 0.006);
          const dd: number = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
          if (dd < 150 + 24) this.hitPlayer(p, 1.35);
        });
        break;
      }
      case 'shockwave':
        setCd(4.4);
        (this.scene as any).shockwaveFx?.(this.sprite.x, this.sprite.y);
        if (d < 220) this.hitPlayer(p, 1.05);
        break;
      case 'core_overload':
        setCd(12);
        Bus.emit('play-sound', 'boss_roar');
        (this.scene as any).overloadFx?.(this);
        this.scene.time.delayedCall(500, () => { if (!this.dead && Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y) < 260) this.hitPlayer(p, 1.5); });
        break;
      case 'throw_axe':
        setCd(3.6);
        (this.scene as any).spawnProjectile({
          kind: 'fireball', x: this.sprite.x, y: this.sprite.y - 18,
          angle: Math.atan2(p.sprite.y - this.sprite.y, p.sprite.x - this.sprite.x),
          speed: 520, maxDist: 480, dmg: this.atk * 0.9, crit: 0.05, owner: 'enemy', enemy: this
        });
        break;
      default:
        setCd(0.5);
        break;
    }
    return true;
  }

  tickCd(name: string): number {
    this.moveCds[name] = (this.moveCds[name] || 0) - 1 / 60;
    return this.moveCds[name] as number;
  }

  hitPlayer(p: any, mult: number): void {
    p.takeDamage(this.atk * mult, this.sprite.x, this.sprite.y);
    if (shakeAllowed()) this.scene.cameras.main.shake(120, 0.006);
  }

  summon(type: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang: number = Math.random() * Math.PI * 2;
      const dx: number = Math.cos(ang) * 70;
      const dy: number = Math.sin(ang) * 70;
      (this.scene as any).spawnEnemy(type, this.sprite.x + dx, this.sprite.y + dy);
    }
  }
}
