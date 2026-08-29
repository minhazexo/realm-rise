// Player entity (spec §5–7, §18): movement feel, combat actions, survival.
import Phaser from 'phaser';
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';
import { PLAYER_CONFIG, DIFFICULTY } from '../core/Constants.js';
import { getItem } from '../data/items.js';
import { wearEquipped, countItem, removeItem } from '../systems/InventorySystem.js';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.dir = 'down';
    this.walkPhase = 1;
    this.walkTimer = 0;
    this.stepTimer = 0;
    this.sprite = scene.physics.add
      .sprite(x, y, 'player_char', 'down_1')
      .setSize(18, 14)
      .setOffset(4, 20)
      .setDepth(50);
    this.sprite.body.setCircle(9);
    this.sprite.setCollideWorldBounds(true);
    // Soft ambient shadow under the character grounds it visually.
    this.shadow = scene.add.image(x, y + 2, 'fx_shadow')
      .setDepth(49)
      .setScale(1.1)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.slashFx = scene.add.image(x, y, 'fx_slash2').setDepth(80).setVisible(false).setBlendMode('ADD');
    this.dodgeGhost = scene.add.image(x, y, 'player_char', 'down_1').setAlpha(0).setDepth(49);
    this.cool = { attack: 0, dodge: 0 };
    this.iFrames = 0;
    this.blocking = false;
    this.wantDodge = false;
    this.holdStart = null;
    this.regenDelay = 0;
    this._mv = new Phaser.Math.Vector2();
    // Combat juice state
    this.hitstopTimer = 0;     // freeze frames remaining on hitstop
    this._dodgeTrailTimer = 0; // accumulator for dodge trail after-images
  }
  get pos() {
    return { x: this.sprite.x, y: this.sprite.y };
  }
  weaponDef() {
    const eq = GameState.s.player.equipment.weapon;
    return eq ? getItem(eq.id) : null;
  }

  update(dt, ctx) {
    const S = GameState.s, D = S.player.derived || {};
    // ── Hitstop: freeze game for a few frames on impactful hits ──────
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      // Keep player velocity frozen but allow animation to finish
      if (this.sprite.body) this.sprite.body.setVelocity(0, 0);
      return; // skip all other update logic during hitstop
    }
    const keys = ctx.keys, mv = this._mv.set(0, 0);
    if (!ctx.uiBlocked) {
      if (keys.A.isDown || keys.LEFT.isDown) mv.x -= 1;
      if (keys.D.isDown || keys.RIGHT.isDown) mv.x += 1;
      if (keys.W.isDown || keys.UP.isDown) mv.y -= 1;
      if (keys.S.isDown || keys.DOWN.isDown) mv.y += 1;
      if (ctx.joystick) { mv.x += ctx.joystick.x; mv.y += ctx.joystick.y; }
    }
    const moving = mv.lengthSq() > 0.01;
    if (moving) mv.normalize();
    this.blocking = !ctx.uiBlocked && !moving && (ctx.pointer?.rightButtonDown() || ctx.mobileBlock === true);

    // dodge roll
    this.cool.dodge = Math.max(0, this.cool.dodge - dt);
    if (this.wantDodge) {
      this.wantDodge = false;
      if (this.cool.dodge <= 0 && S.player.stamina >= D.dodgeStamina * D.staminaCostMult) {
        S.player.stamina -= D.dodgeStamina * D.staminaCostMult;
        this.regenDelay = PLAYER_CONFIG.staminaRegenDelaySec;
        this.iFrames = PLAYER_CONFIG.iFramesOnDodgeSec;
        this.cool.dodge = 0.8;
        const ang = moving ? mv.angle() : Phaser.Math.DegToRad({ down: 90, up: -90, left: 180, right: 0 }[this.dir]);
        if (this.sprite.body) this.sprite.body.velocity.set(Math.cos(ang) * D.dodgeSpeed, Math.sin(ang) * D.dodgeSpeed);
        this.dodgeGhost.setTexture('player_char').setFrame(`${this.dir}_1`).setPosition(this.sprite.x, this.sprite.y).setAlpha(0.45);
        this.scene.tweens.add({ targets: this.dodgeGhost, alpha: 0, duration: 220 });
        this._dodgeTrailTimer = 0; // reset trail accumulator
        Bus.emit('play-sound', 'dodge');
      }
    }
    this.iFrames = Math.max(0, this.iFrames - dt);

    // ── Dodge trail: ghost after-images during invincibility frames ──
    if (this.iFrames > 0 && this.sprite.body?.speed > 50) {
      this._dodgeTrailTimer += dt;
      if (this._dodgeTrailTimer > 0.035) {
        this._dodgeTrailTimer = 0;
        const ghost = this.scene.add.image(this.sprite.x, this.sprite.y, 'player_char', `${this.dir}_1`)
          .setDepth(48).setAlpha(0.3).setTint(0x88ccff);
        this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 180, onComplete: () => ghost.destroy() });
      }
    }

    // acceleration/friction smoothing (spec §5)
    let speed = D.moveSpeed * (ctx.envCold ? 0.88 : 1);
    const sprinting =
      !ctx.uiBlocked && !this.blocking && moving &&
      ((keys.SHIFT.isDown || ctx.mobileSprint === true)) && S.player.stamina > 4;
    if (sprinting) {
      speed *= D.sprintMult;
      S.player.stamina -= 13 * D.staminaCostMult * dt;
      this.regenDelay = PLAYER_CONFIG.staminaRegenDelaySec;
    }
    const k = 1 - Math.exp(-10 * dt);
    const b = this.sprite.body;
    b.velocity.x += (mv.x * speed - b.velocity.x) * k;
    b.velocity.y += (mv.y * speed - b.velocity.y) * k;

    this.regenDelay -= dt;
    if (this.regenDelay <= 0 && !sprinting) {
      S.player.stamina = Math.min(D.maxStamina, S.player.stamina + D.staminaRegen * dt);
    }

    this.updateFacing(mv, moving, ctx.pointerWorld);
    this.updateWalkAnim(dt, moving);
    this.sprite.setDepth(Math.round(this.sprite.y));
    this.shadow.setPosition(this.sprite.x, this.sprite.y + 2).setDepth(this.sprite.depth - 1);
    const shieldOn = S.player.equipment.offhand && getItem(S.player.equipment.offhand.id)?.shieldBlock;
    this.sprite.setTint(this.blocking && shieldOn ? 0xbfd7ff : 0xffffff);
    this.cool.attack = Math.max(0, this.cool.attack - dt);
    this.survivalTick(dt, ctx);
  }

  updateFacing(mv, moving, pointerWorld) {
    if (pointerWorld) {
      const dx = pointerWorld.x - this.sprite.x, dy = pointerWorld.y - this.sprite.y;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    } else if (moving) {
      this.dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x < 0 ? 'left' : 'right') : mv.y < 0 ? 'up' : 'down';
    }
  }

  updateWalkAnim(dt, moving) {
    if (moving) {
      this.walkTimer += dt;
      const fps = PLAYER_CONFIG.walkAnimFps * ((this.sprite.body?.speed || 0) > 240 ? 1.4 : 1);
      if (this.walkTimer >= 1 / fps) {
        this.walkTimer = 0;
        this.walkPhase = (this.walkPhase + 1) % 3;
        this.sprite.setFrame(`${this.dir}_${this.walkPhase}`);
        if (--this.stepTimer <= 0) { this.stepTimer = 2; Bus.emit('play-sound', 'footstep_grass'); }
      }
    } else { this.walkPhase = 1; this.sprite.setFrame(`${this.dir}_1`); }
  }

  /* ── Attacks (spec §18) ──────────────────────────────────────────────── */

  tryAttack(opts, pointerWorld, enemies, floaters) {
    const S = GameState.s, D = S.player.derived;
    if (this.cool.attack > 0 || this.blocking || S.session_dead) return;
    const wdef = this.weaponDef();
    const wpn = wdef?.weapon || { dmg: 3, crit: 0.02, cd: 0.5, range: 40, style: 'slash' };

    let stam = (opts.heavy ? PLAYER_CONFIG.heavyAttackStamina : PLAYER_CONFIG.lightAttackStamina) * D.staminaCostMult;
    if (S.player.stamina < stam * 0.5) return;
    S.player.stamina -= stam;
    this.regenDelay = PLAYER_CONFIG.staminaRegenDelaySec;
    this.cool.attack = (wpn.cd / D.attackCdMult) * (opts.heavy ? 1.5 : 1);

    const ox = this.sprite.x, oy = this.sprite.y;
    const ang = pointerWorld
      ? Math.atan2(pointerWorld.y - oy, pointerWorld.x - ox)
      : Phaser.Math.DegToRad({ right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 }[this.dir]);

    if (wpn.style === 'bow') {
      if (countItem(wpn.ammo) <= 0) { floaters.add(ox, oy - 34, 'No arrows!', '#ff9a7a'); return; }
      removeItem(wpn.ammo, 1);
      this.scene.spawnProjectile({
        kind: 'arrow', x: ox, y: oy - 6, angle: ang,
        speed: wpn.projectileSpeed, maxDist: wpn.range * D.bowRangeMult,
        dmg: wpn.dmg * D.rangedDmgMult, crit: D.critRanged, pierce: wpn.pierce || 0, owner: 'player'
      });
      Bus.emit('play-sound', 'arrow_shot');
      return false;
    }

    Bus.emit('play-sound', 'sword');
    this.slashFx.setTexture(opts.heavy ? 'fx_slash3' : 'fx_slash2')
      .setPosition(ox + Math.cos(ang) * 26, oy + Math.sin(ang) * 26)
      .setAngle(Phaser.Math.RadToDeg(ang) % 360)
      .setVisible(true).setScale(opts.heavy ? 1.25 : 1);
    this.scene.tweens.add({ targets: this.slashFx, angle: '-=80', alpha: 0, duration: 130, onComplete: () => this.slashFx.setVisible(false).setAlpha(1) });

    let dmgBase = wpn.dmg * D.meleeDmgMult;
    if (opts.heavy) dmgBase *= D.heavyDmgMult;
    if (S.player.hp < D.maxHp * 0.35 && D.berserk > 1) dmgBase *= D.berserk;
    const reach = wpn.range * (wdef?.weapon?.reachBonusVsAnimals ? 1.12 : 1);
    const arcHalf = (PLAYER_CONFIG.attackArcDeg * 0.55 * Math.PI) / 180;

    let hitAny = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.sprite.x - ox, dy = e.sprite.y - oy;
      if (dx * dx + dy * dy > (reach + e.def.radius * 0.5) ** 2) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang)) > arcHalf) continue;
      hitAny = true;
      const crit = Math.random() < D.critMelee + (wpn.crit || 0);
      e.takeDamage(Math.round(dmgBase * (crit ? 1.85 : 1)), ox, oy, floaters, crit);
    }
    wearEquipped('weapon', opts.heavy ? 2 : 1, D.toolWearMult);
    if (hitAny) {
      this.scene.onMeleeImpact(ox, oy, !!opts.heavy);
      // ── Combat juice: hitstop + camera shake ─────────────────────────
      // Brief freeze frames give attacks weight and impact.
      const hitstopDuration = opts.heavy ? 0.065 : 0.035;
      this.hitstopTimer = hitstopDuration;
      // Camera shake scaled by damage dealt — crits shake harder
      const shakeIntensity = opts.heavy ? 0.008 : 0.004;
      this.scene.cameras.main.shake(80, shakeIntensity);
      // Kill streak: restore a tiny bit of stamina on hit to reward aggression
      S.player.stamina = Math.min(D.maxStamina, S.player.stamina + (opts.heavy ? 3 : 1.5));
    }
    return hitAny;
  }

/* ── Taking damage & death ───────────────────────────────────────────── */
  takeDamage(rawDmg, srcX, srcY) {
    const S = GameState.s, D = S.player.derived;
    if (this.iFrames > 0 || S.session_dead) return 0;
    let dmg = rawDmg * (1 - D.damageReduction);
    const offDef = S.player.equipment.offhand ? getItem(S.player.equipment.offhand.id) : null;
    if (this.blocking && offDef?.shieldBlock && S.player.stamina > 5) {
      dmg *= 1 - offDef.shieldBlock;
      S.player.stamina = Math.max(0, S.player.stamina - D.blockStaminaCost);
      Bus.emit('play-sound', 'hit_flesh');
    } else Bus.emit('play-sound', 'player_hurt');
    dmg = Math.max(1, Math.round(dmg));
    S.player.hp -= dmg;
    this.regenDelay = 2;
    this.scene.fxHit?.(this.sprite.x, this.sprite.y);
    this.sprite.setTint(0xff6b5a).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => !S.session_dead && this.sprite.clearTint());
    if (srcX != null && this.sprite.body) {
      const a = Math.atan2(this.sprite.y - srcY, this.sprite.x - srcX);
      this.sprite.body.velocity.set(Math.cos(a) * 210, Math.sin(a) * 210);
    }
    if (S.settings.toggles.screenShake !== false) this.scene.cameras.main.shake(140, 0.005);
    GameState.notify('PLAYER');
    if (S.player.hp <= 0) this.die();
    return dmg;
  }

  die() {
    const S = GameState.s;
    if (S.session_dead) return;
    S.session_dead = true;
    S.player.gold -= Math.floor(S.player.gold * 0.12);
    S.stats.deaths = (S.stats.deaths || 0) + 1;
    this.sprite.setVisible(false);
    this.shadow?.setVisible(false);
    if (this.sprite.body) this.sprite.body.enable = false;
    Bus.emit('player-death', { lostGold: S.player.gold });
  }

  respawn() {
    const S = GameState.s, D = S.player.derived;
    const home = S.settlement.pos || { x: 0, y: 260 };
    this.sprite.setPosition(home.x + 30, home.y + 40).setVisible(true);
    this.shadow?.setVisible(true).setPosition(this.sprite.x, this.sprite.y + 2);
    if (this.sprite.body) this.sprite.body.enable = true;
    S.player.hp = D.maxHp * 0.75;
    S.player.stamina = D.maxStamina;
    S.player.hunger = Math.max(28, S.player.hunger);
    S.player.thirst = Math.max(24, S.player.thirst);
    S.session_dead = false;
    GameState.notify('PLAYER');
  }

  /* ── Survival (spec §15: tension, not frustration) ───────────────────── */
  survivalTick(dt, ctx) {
    const S = GameState.s, D = S.player.derived;
    const diff = DIFFICULTY[S.settings.difficulty] || DIFFICULTY.normal;
    const resist = 1 - (D.drainResist || 0) * 0.4;
    const hot = ctx.envHeat ? 1.55 : 1;
    const chilled = ctx.envCold && D.warmthCapable < 4 ? 1.5 : 1;
    S.player.hunger = Math.max(0, S.player.hunger - diff.drain * resist * dt * 0.22 * detached(100));
    S.player.thirst = Math.max(0, S.player.thirst - diff.drain * resist * hot * dt * 0.26 * detached(100));
    if (ctx.envCold && D.warmthCapable < 3 && !ctx.nearWarmth) {
      S.player.coldExposure = (S.player.coldExposure || 0) + dt;
      if (S.player.coldExposure > 12) S.player.hp -= 0.7 * dt;
    } else S.player.coldExposure = Math.max(0, (S.player.coldExposure || 0) - dt * 2);
    if (S.player.hunger > 42 && S.player.thirst > 20 && S.player.hp < D.maxHp) {
      S.player.hp = Math.min(D.maxHp, S.player.hp + PLAYER_CONFIG.regenPerSec * dt);
    }
    if (S.player.hunger <= 0) S.player.hp -= PLAYER_CONFIG.starveHpData * dt * chilled;
    if (S.player.thirst <= 0) S.player.hp -= PLAYER_CONFIG.starveHpData * 1.35 * dt;
    if (S.player.hp <= 0) this.die();
    else GameState.notify('PLAYER');

    function detached(n) {
      return n / 100; // drain rates expressed per-second already; scale to 0..1
    }
  }

  applyConsumableEffects(u) {
    if (!u) return;
    const S = GameState.s, D = S.player.derived;
    if (u.food) S.player.hunger = Math.min(100, S.player.hunger + u.food);
    if (u.thirst) S.player.thirst = Math.min(100, S.player.thirst + u.thirst);
    if (u.hp) S.player.hp = Math.min(D.maxHp, S.player.hp + u.hp);
    if (u.staminaFull) S.player.stamina = D.maxStamina;
    if (u.warmBuff) this.scene.grantWarmth?.(u.warmBuff);
    if (u.repairEquipped != null || u.repairAll != null) {
      import('../systems/InventorySystem.js').then((m) => m.repairAll(u.repairAll ?? u.repairEquipped, D.perfectRepair));
    }
  }
}

