// ─────────────────────────────────────────────────────────────────────────────
// Enemy entity (spec §19, §53): data-driven behaviour via `style`, clean FSM.
// States: IDLE/PATROL/DETECT/CHASE/ATTACK/RETREAT/SEARCH/DEAD.
// Styles: melee | pounce | charger | brute | kiter | boss.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';
import { DIFFICULTY } from '../core/Constants.js';
import { getEnemyDef } from '../data/enemies.js';
import { awardXP, profXP } from '../systems/ProgressionSystem.js';

const STATE = Object.freeze({ IDLE: 0, PATROL: 1, DETECT: 2, CHASE: 3, ATTACK: 4, RETREAT: 5, SEARCH: 6, DEAD: 7 });

export default class Enemy {
  constructor(scene, defKey, x, y) {
    this.scene = scene;
    this.def = getEnemyDef(defKey);
    if (!this.def) { console.warn('unknown enemy', defKey); this.dead = true; return; }
    this.key = defKey;
    const diff = DIFFICULTY[GameState.s.settings.difficulty] || DIFFICULTY.normal;

    this.sprite = scene.physics.add.sprite(x, y, this.def.sheetKey, 'down_1').setDepth(50);
    this.scale = this.def.scale || 1;
    this.sprite.setScale(this.scale);
    this.shadow = scene.add.image(x, y + 3, 'fx_shadow')
      .setDepth(49)
      .setScale(0.95 * (this.def.scale || 1))
      .setAlpha(Math.min(0.55, 0.3 + 0.2 * (this.def.scale || 1)))
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    const isQuad = ['wolf', 'boar', 'bear', 'direwolf', 'alphawolf'].some((k) => this.def.key.includes(k));
    if (isQuad) this.sprite.setSize(this.sprite.width * 0.6, this.sprite.height * 0.48).setOffset(this.sprite.width * 0.2, this.sprite.height * 0.42);
    else this.sprite.setSize(16, 14).setOffset(5, 20);
    this.sprite.body.setCircle(this.def.radius);
    this.sprite.setCollideWorldBounds(true);

    this.maxHp = Math.round((this.def.hp || 50) * (diff.enemyHpMult ?? 1));
    this.hp = this.maxHp;
    this.atk = (this.def.atk || 5) * diff.enemyDmg;
    this.atkSpd = (this.def.speed || 100) * diff.enemySpd;
    this.aggro = (this.def.detect || 250) * diff.aggro;
    this.dead = false;
    this.state = STATE.IDLE;
    this.stateTimer = 1 + Math.random() * 2;
    this.patrolTarget = null;
    this.attackCd = 0;
    this.windingUp = false;
    this.fleeUnderHpPct = this.def.fleeBelowHpPct ?? 0;
    this.boss = !!this.def.boss;
    this.dir = 'down';
    this.walkPhase = 0;
    this._walkTimer = 0;
    this.moveCd = {};
    this._hpBarTimer = 0;
    this._hpBarAlpha = 0;
    this._hpBarW = this.boss ? 56 : (isQuad ? 44 : 34);
    this._hpBarH = this.boss ? 6 : 4.5;
    this._hpBarY = isQuad ? -14 : -18;
    this.setupHealthBar();
    Bus.emit('enemy-spawned', { key: defKey });
  }

  get player() {
    return this.scene.player;
  }

  /** Build the world-space health bar graphics (hidden until damaged). */
  setupHealthBar() {
    this.hpBar = this.scene.add.graphics().setDepth(200);
    this.hpBar.setVisible(false);
    this.hpBar.setScrollFactor(1);
  }

  /** Redraw + position the health bar above the enemy. */
  refreshHealthBar() {
    if (!this.hpBar || this.dead) return;
    const w = this._hpBarW;
    const h = this._hpBarH;
    const x = this.sprite.x;
    const y = this.sprite.y + this._hpBarY;
    const g = this.hpBar;
    const pct = Math.max(0, Math.min(1, this.hp / this.maxHp));

    g.clear();
    // Drop shadow backing
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(x - w / 2 - 1, y - 1, w + 2, h + 2, 2);
    // Low-HP color shifts from green → amber → red
    const col = pct > 0.55 ? 0x5cc45c : pct > 0.28 ? 0xd8a53a : 0xdc5050;
    g.fillStyle(0x11151e, 1);
    g.fillRoundedRect(x - w / 2 + 1, y + 1, w - 2, h - 2, 1.5);
    g.fillStyle(col, 1);
    g.fillRoundedRect(x - w / 2 + 1, y + 1, Math.max(0, (w - 2) * pct), h - 2, 1.5);
    g.lineStyle(1, 0x000000, 0.8);
    g.strokeRoundedRect(x - w / 2, y, w, h, 2);

    g.setVisible(true);
    g.setAlpha(this._hpBarAlpha * 0.92);
  }

update(dt, ctx) {
    if (this.dead) return;
    const S = GameState.s;
    const p = this.player;
    if (!p || !p.sprite || S.session_dead) {
      this.sprite.body?.setVelocity(0, 0);
      this.sprite.setFrame(`${this.dir}_1`);
      return;
    }
    if (this.def.nightOnly && this.isDay()) { this.sprite.body?.setVelocity(0, 0); return; }

    const d = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
    const detect = this.boss ? this.def.detect : this.aggro * (1 - (S.player.derived?.stealth || 0));
    this.attackCd = Math.max(0, (this.attackCd || 0) - dt);
    this.windingUp = this.windingUp && this.attackCd > 0;

    // ── Attack telegraph: red glow warning before strike lands ──────
    if (this.windingUp) {
      this.sprite.setTint(0xff4444);
    }

    switch (this.state) {
      case STATE.IDLE:
        this.stateTimer -= dt;
        this.sprite.setFrame(`${this.dir}_1`);
        if (this.stateTimer <= 0) {
          this.state = STATE.PATROL;
          const ang = Math.random() * Math.PI * 2;
          this.patrolTarget = { x: this.sprite.x + Math.cos(ang) * (60 + Math.random() * 90), y: this.sprite.y + Math.sin(ang) * (60 + Math.random() * 90) };
          this.stateTimer = 3 + Math.random() * 2;
        }
        if (d < detect) this.enterChase();
        break;
      case STATE.PATROL:
        this.stateTimer -= dt;
        if (!this.patrolTarget || Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.patrolTarget.x, this.patrolTarget.y) < 14) {
          this.state = STATE.IDLE;
        } else this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.atkSpd * 0.55, dt);
        if (d < detect) this.enterChase();
        if (this.stateTimer <= 0) { this.state = STATE.IDLE; this.stateTimer = 1 + Math.random() * 2; }
        break;
      case STATE.DETECT:
        this.stateTimer -= dt;
        this.sprite.setTint(0xffd08a);
        if (this.stateTimer <= 0) { this.state = STATE.CHASE; this.sprite.clearTint(); }
        break;
      case STATE.CHASE:
        if (d > this.def.attackRange * 0.85) {
          this.sprite.setTint(0xff9a6a);
          this.moveToward(p.sprite.x, p.sprite.y, this.atkSpd, dt);
        } else { this.sprite.clearTint(); this.state = STATE.ATTACK; }
        this.faceTarget(p.sprite);
        if (d > detect * 2.6 && !this.boss) { this.state = STATE.SEARCH; this.stateTimer = 4; }
        break;
      case STATE.ATTACK:
        this.faceTarget(p.sprite);
        if (d > this.def.attackRange * 1.25) { this.state = STATE.CHASE; break; }
        this.tryAttack(p);
        break;
      case STATE.RETREAT:
        this.moveAway(p.sprite.x, p.sprite.y, this.atkSpd * 1.1, dt);
        if (this.hp > this.maxHp * (this.fleeUnderHpPct + 0.12) || d > detect) { this.state = STATE.SEARCH; this.stateTimer = 4; }
        break;
      case STATE.SEARCH:
        this.stateTimer -= dt;
        if (d < detect * 1.2) this.enterChase();
        if (this.stateTimer <= 0) { this.state = STATE.IDLE; this.stateTimer = 2; }
        break;
      default:
        break;
    }
    if (this.fleeUnderHpPct > 0 && (this.hp / this.maxHp) < this.fleeUnderHpPct && this.state !== STATE.RETREAT && !this.boss) {
      this.state = STATE.RETREAT;
    }
    this.sprite.setDepth(Math.round(this.sprite.y));
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 3).setDepth(this.sprite.depth - 1);
    this.syncAnim(dt);
    this.updateHealthBar(dt);
  }

  /** Keep the health bar glued to the enemy and fade it out after damage. */
  updateHealthBar(dt) {
    if (!this.hpBar) return;
    this._hpBarTimer = Math.max(0, this._hpBarTimer - dt);
    if (this._hpBarTimer <= 0 && this._hpBarAlpha > 0) {
      this._hpBarAlpha = Math.max(0, this._hpBarAlpha - dt * 1.2);
      if (this._hpBarAlpha <= 0) this.hpBar.setVisible(false);
    }
    if (this._hpBarAlpha > 0) this.refreshHealthBar();
  }

  enterChase() {
    this.state = STATE.CHASE;
    this.sprite.setTint(0xff9a6a);
  }

  faceTarget(t) {
    const dx = t.x - this.sprite.x, dy = t.y - this.sprite.y;
    this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  }

  moveToward(tx, ty, speed) {
    if (!this.sprite?.body) return;
    const ang = Math.atan2(ty - this.sprite.y, tx - this.sprite.x);
    this.sprite.body.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed);
    this.dir = Math.abs(Math.cos(ang)) > 0.5 ? (Math.cos(ang) > 0 ? 'right' : 'left') : (Math.sin(ang) > 0 ? 'down' : 'up');
  }
  moveAway(tx, ty, speed) {
    this.moveToward(2 * this.sprite.x - tx, 2 * this.sprite.y - ty, speed);
  }

  syncAnim(dt) {
    const moving = this.sprite.body?.velocity.lengthSq() > 400;
    if (moving) {
      this._walkTimer += dt;
      if (this._walkTimer > 0.13) {
        this._walkTimer = 0;
        this.walkPhase = (this.walkPhase + 1) % 3;
      }
      this.sprite.setFrame(`${this.dir}_${this.walkPhase}`);
    } else this.sprite.setFrame(`${this.dir}_1`);
  }

  tryAttack(p) {
    const def = this.def;
    if (this.attackCd > 0) return;
    this.attackCd = def.attackCd;
    this.windingUp = true;
    Bus.emit('play-sound', 'sword');
    this.scene.time.delayedCall((def.windupSec || 0.4) * 1000, () => {
      if (this.dead) return;
      this.windingUp = false;
      const dmg = this.atk * (0.85 + Math.random() * 0.25);
      const dNow = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, p.sprite.x, p.sprite.y);
      const effRange = def.ranged ? def.attackRange : def.attackRange + def.radius * 0.5;
      if (dNow > effRange) return;
      if (def.ranged) {
        this.scene.spawnProjectile({
          kind: 'arrow', x: this.sprite.x, y: this.sprite.y - 12,
          angle: Math.atan2(p.sprite.y - this.sprite.y, p.sprite.x - this.sprite.x),
          speed: def.projectileSpeed || 480, maxDist: def.attackRange, dmg, crit: 0.05, owner: 'enemy', enemy: this
        });
      } else {
        p.takeDamage(dmg, this.sprite.x, this.sprite.y);
      }
    });
  }

/* ── Damage, death & loot ─────────────────────────────────────────────── */
  takeDamage(amount, srcX, srcY, floaters, crit) {
    if (this.dead) return;
    if (this.state === STATE.IDLE || this.state === STATE.PATROL) this.enterChase();
    this.hp -= amount;
    // Reveal health bar on first damage
    this._hpBarTimer = 3.2;
    this._hpBarAlpha = Math.min(1, this._hpBarAlpha + 0.5);
    this.refreshHealthBar();
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(50, () => !this.dead && this.sprite.clearTint());
    floaters?.add(this.sprite.x, this.sprite.y - 30, `${amount}`, crit ? '#ffd66b' : '#ffe9c9', crit ? 1.2 : 1);
    if (this.hp <= 0) this.die(srcX, srcY);
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.state = STATE.DEAD;
    this.sprite.body.enable = false;
    if (this.shadow) { this.shadow.setVisible(false); this.shadow.destroy(); this.shadow = null; }
    if (this.hpBar) { this.hpBar.setVisible(false); this.hpBar.destroy(); this.hpBar = null; }
    this.scene.fxDeath?.(this.sprite.x, this.sprite.y);
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, y: this.sprite.y + 8, duration: 260, onComplete: () => this.sprite.destroy() });

    for (const item of this.rollLoot()) this.scene.dropLoot(this.sprite.x, this.sprite.y, item.id, item.qty);
    const goldMult = DIFFICULTY[GameState.s.settings.difficulty]?.loot || 1;
    if (this.def.goldDrop) this.scene.dropLootGold(this.sprite.x, this.sprite.y, Math.round(this.def.goldDrop * goldMult));

    awardXP(this.def.xp, 'kill');
    profXP('combat', 6);
    // ── Combat reward: stamina restore on kill ──────────────────────────
    // Rewards aggressive play and creates exciting kill chains.
    const killStamina = this.boss ? 25 : 6;
    GameState.s.player.stamina = Math.min(
      GameState.s.player.derived?.maxStamina || 100,
      GameState.s.player.stamina + killStamina
    );
    Bus.emit('enemy-killed', { defKey: this.key, isBoss: this.boss, x: this.sprite.x, y: this.sprite.y });
    Bus.emit('play-sound', 'hit_flesh');
    if (this.boss) Bus.emit('boss-defeated', this.key);
    this.scene.onEnemyDeath?.(this);
  }

  rollLoot() {
    const diff = DIFFICULTY[GameState.s.settings.difficulty] || DIFFICULTY.normal;
    const hunt = GameState.s.player.derived?.huntLoot || 1;
    const out = [];
    for (const l of this.def.loot || []) {
      const isHunt = l.id.includes('meat') || l.id.includes('hide') || l.id.includes('pelt');
      if (Math.random() < l.chance * (isHunt ? hunt : 1) * diff.loot) {
        out.push({ id: l.id, qty: Math.max(l.min, Math.round(l.min + Math.random() * (l.max - l.min))) });
      }
    }
    return out;
  }

  isDay() {
    const t = GameState.s.world.timeOfDay;
    return t > 0.28 && t < 0.72;
  }
}