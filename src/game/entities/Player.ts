// Player entity (spec §5–7, §18): movement feel, combat actions, survival.
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { PLAYER_CONFIG, DIFFICULTY } from '../core/Constants.ts';
import { getItem } from '../data/items.ts';
import { wearEquipped, countItem, removeItem } from '../systems/InventorySystem.ts';
import { shakeAllowed, shadowsEnabled, isImmortal } from '../systems/SettingsSystem.ts';

type Dir = 'down' | 'up' | 'left' | 'right';

interface PlayerUpdateCtx {
  keys: any;
  bindKeys?: any;
  pointer?: Phaser.Input.Pointer;
  pointerWorld?: { x: number; y: number } | null;
  joystick?: { x: number; y: number } | null;
  mobileBlock?: boolean;
  mobileSprint?: boolean;
  uiBlocked?: boolean;
  envCold?: boolean;
  envHeat?: boolean;
  nearWarmth?: boolean;
  [key: string]: any;
}

interface AttackOpts {
  heavy?: boolean;
}

export default class Player {
  scene: Phaser.Scene;
  dir: Dir;
  walkPhase: number;
  walkTimer: number;
  stepTimer: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  slashFx: Phaser.GameObjects.Image;
  dodgeGhost: Phaser.GameObjects.Image;
  cool: { attack: number; dodge: number };
  iFrames: number;
  blocking: boolean;
  wantDodge: boolean;
  holdStart: number | null;
  regenDelay: number;
  comboCount: number;
  comboWindow: number;
  blockStartAt: number;
  _mv: Phaser.Math.Vector2;
  hitstopTimer: number;
  _dodgeTrailTimer: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
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
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(9);
    this.sprite.setCollideWorldBounds(true);
    // Soft ambient shadow under the character grounds it visually.
    this.shadow = scene.add.image(x, y + 2, 'fx_shadow')
      .setDepth(49)
      .setScale(1.1)
      .setAlpha(0.55)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(shadowsEnabled());
    // React to a shadows toggle without needing a player re-create.
    Bus.on(CH.SETTINGS, () => {
      if (this.shadow) this.shadow.setVisible(shadowsEnabled());
    });
    this.slashFx = scene.add.image(x, y, 'fx_slash2').setDepth(80).setVisible(false).setBlendMode('ADD');
    this.dodgeGhost = scene.add.image(x, y, 'player_char', 'down_1').setAlpha(0).setDepth(49);
    this.cool = { attack: 0, dodge: 0 };
    this.iFrames = 0;
    this.blocking = false;
    this.wantDodge = false;
    this.holdStart = null;
    this.regenDelay = 0;
    // Phase B combat state: light-attack combo chain + parry window.
    this.comboCount = 0;
    this.comboWindow = 0;
    this.blockStartAt = 0;
    this._mv = new Phaser.Math.Vector2();
    // Combat juice state
    this.hitstopTimer = 0;     // freeze frames remaining on hitstop
    this._dodgeTrailTimer = 0; // accumulator for dodge trail after-images
  }
  get pos(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }
  weaponDef(): any {
    const eq = GameState.s.player.equipment.weapon;
    return eq ? getItem(eq.id) : null;
  }

  update(dt: number, ctx: PlayerUpdateCtx): void {
    const S = GameState.s, D = S.player.derived || {};
    // ── Hitstop: freeze game for a few frames on impactful hits ──────
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      // Keep player velocity frozen but allow animation to finish
      if (this.sprite.body) (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return; // skip all other update logic during hitstop
    }
    const keys = ctx.keys, mv = this._mv.set(0, 0);
    const bk = ctx.bindKeys || {};
    if (!ctx.uiBlocked) {
      if (keys.A.isDown || keys.LEFT.isDown || bk.left?.isDown) mv.x -= 1;
      if (keys.D.isDown || keys.RIGHT.isDown || bk.right?.isDown) mv.x += 1;
      if (keys.W.isDown || keys.UP.isDown || bk.up?.isDown) mv.y -= 1;
      if (keys.S.isDown || keys.DOWN.isDown || bk.down?.isDown) mv.y += 1;
      if (ctx.joystick) { mv.x += ctx.joystick.x; mv.y += ctx.joystick.y; }
    }
    const moving = mv.lengthSq() > 0.01;
    if (moving) mv.normalize();
    // Phase B: moving block at reduced speed (was: full stop required).
    const wantBlock: boolean = !ctx.uiBlocked && (ctx.pointer?.rightButtonDown() || ctx.mobileBlock === true);
    if (wantBlock && !this.blocking) this.blockStartAt = performance.now();
    this.blocking = wantBlock;

    // dodge roll
    this.cool.dodge = Math.max(0, this.cool.dodge - dt);
    if (this.wantDodge) {
      this.wantDodge = false;
      if (this.cool.dodge <= 0 && S.player.stamina >= D.dodgeStamina * D.staminaCostMult) {
        S.player.stamina -= D.dodgeStamina * D.staminaCostMult;
        this.regenDelay = PLAYER_CONFIG.staminaRegenDelaySec;
        this.iFrames = PLAYER_CONFIG.iFramesOnDodgeSec;
        this.cool.dodge = 0.8;
        const ang: number = moving ? mv.angle() : Phaser.Math.DegToRad(({ down: 90, up: -90, left: 180, right: 0 } as Record<Dir, number>)[this.dir]);
        if (this.sprite.body) (this.sprite.body as Phaser.Physics.Arcade.Body).velocity.set(Math.cos(ang) * D.dodgeSpeed, Math.sin(ang) * D.dodgeSpeed);
        this.dodgeGhost.setTexture('player_char').setFrame(`${this.dir}_1`).setPosition(this.sprite.x, this.sprite.y).setAlpha(0.45);
        this.scene.tweens.add({ targets: this.dodgeGhost, alpha: 0, duration: 220 });
        this._dodgeTrailTimer = 0; // reset trail accumulator
        Bus.emit('play-sound', 'dodge');
      }
    }
    this.iFrames = Math.max(0, this.iFrames - dt);

    // ── Dodge trail: ghost after-images during invincibility frames ──
    if (this.iFrames > 0 && (this.sprite.body as Phaser.Physics.Arcade.Body)?.speed > 50) {
      this._dodgeTrailTimer += dt;
      if (this._dodgeTrailTimer > 0.035) {
        this._dodgeTrailTimer = 0;
        const ghost = this.scene.add.image(this.sprite.x, this.sprite.y, 'player_char', `${this.dir}_1`)
          .setDepth(48).setAlpha(0.3).setTint(0x88ccff);
        this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 180, onComplete: () => ghost.destroy() });
      }
    }

    // acceleration/friction smoothing (spec §5)
    let speed: number = D.moveSpeed * (ctx.envCold ? 0.88 : 1);
    if (this.blocking) {
      // Blocking on the move: 50% speed; tower shields heavier (movePenalty).
      const offDef = S.player.equipment.offhand ? getItem(S.player.equipment.offhand.id) : null;
      speed *= 0.5 * (1 - (offDef?.movePenalty || 0));
    }
    const sprinting: boolean =
      !ctx.uiBlocked && !this.blocking && moving &&
      ((keys.SHIFT.isDown || bk.sprint?.isDown || ctx.mobileSprint === true)) && S.player.stamina > 4;
    if (sprinting) {
      speed *= D.sprintMult;
      S.player.stamina -= 13 * D.staminaCostMult * dt;
      this.regenDelay = PLAYER_CONFIG.staminaRegenDelaySec;
    }
    const k: number = 1 - Math.exp(-10 * dt);
    const b = this.sprite.body as Phaser.Physics.Arcade.Body;
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

  updateFacing(mv: Phaser.Math.Vector2, moving: boolean, pointerWorld?: { x: number; y: number } | null): void {
    if (pointerWorld) {
      const dx: number = pointerWorld.x - this.sprite.x, dy: number = pointerWorld.y - this.sprite.y;
      this.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    } else if (moving) {
      this.dir = Math.abs(mv.x) > Math.abs(mv.y) ? (mv.x < 0 ? 'left' : 'right') : mv.y < 0 ? 'up' : 'down';
    }
  }

  updateWalkAnim(dt: number, moving: boolean): void {
    if (moving) {
      this.walkTimer += dt;
      const fps: number = PLAYER_CONFIG.walkAnimFps * (((this.sprite.body as Phaser.Physics.Arcade.Body)?.speed || 0) > 240 ? 1.4 : 1);
      if (this.walkTimer >= 1 / fps) {
        this.walkTimer = 0;
        this.walkPhase = (this.walkPhase + 1) % 3;
        this.sprite.setFrame(`${this.dir}_${this.walkPhase}`);
        if (--this.stepTimer <= 0) {
          this.stepTimer = 2;
          Bus.emit('play-sound', 'footstep_grass');
          // Footstep dust puff — subtle grounding effect
          try {
            const px = this.sprite.x + (Math.random() - 0.5) * 8;
            const py = this.sprite.y + 10 + (Math.random() - 0.5) * 4;
            const puff = this.scene.add.image(px, py, 'fx_shadow')
              .setDepth(this.sprite.depth - 2)
              .setScale(0.4 + Math.random() * 0.3)
              .setAlpha(0.35)
              .setTint(0xc8a87a);
            this.scene.tweens.add({
              targets: puff,
              alpha: 0,
              scaleX: puff.scaleX * 2.2,
              scaleY: puff.scaleY * 2.2,
              duration: 280,
              ease: 'Cubic.easeOut',
              onComplete: () => { try { puff.destroy(); } catch { /* ignore */ } }
            });
          } catch { /* cosmetic only */ }
        }
      }
    } else { this.walkPhase = 1; this.sprite.setFrame(`${this.dir}_1`); }
  }

  /* ── Attacks (spec §18) ──────────────────────────────────────────────── */

  /** Heavy attacks require the `war_heavy` skill or a greatsword. */
  heavyUnlocked(): boolean {
    const D = GameState.s.player.derived || {};
    if (D.heavyUnlocked) return true;
    const wdef = this.weaponDef();
    return !!(wdef?.weapon?.heavy);
  }

  /**
   * Called on pointer-up after a hold. Tap = light (already fired on
   * pointer-down); hold >280ms with the skill = heavy.
   */
  requestHeavyRelease(pointerWorld: any, enemies: any[], floaters: any): void {
    if (this.holdStart == null) return;
    const heldMs: number = performance.now() - this.holdStart;
    this.holdStart = null;
    if (heldMs < 280) return;
    if (!this.heavyUnlocked()) {
      floaters?.add?.(this.sprite.x, this.sprite.y - 40, 'Heavy locked (Warrior skill)', '#9fb4cc');
      return;
    }
    // Only heavy if the light swing already recovered — otherwise queue nothing.
    if (this.cool.attack > 0.15) return;
    this.tryAttack({ heavy: true }, pointerWorld, enemies, floaters);
  }

  tryAttack(opts: AttackOpts, pointerWorld: any, enemies: any[], floaters: any): boolean | undefined {
    const S = GameState.s, D = S.player.derived || {};
    if (this.cool.attack > 0 || this.blocking || S.session_dead) return;
    const wdef = this.weaponDef();
    const wpn = wdef?.weapon || { dmg: 3, crit: 0.02, cd: 0.5, range: 40, style: 'slash' };

    const stam: number = ((opts.heavy ? PLAYER_CONFIG.heavyAttackStamina : PLAYER_CONFIG.lightAttackStamina) as number) * D.staminaCostMult;
    if (S.player.stamina < stam * 0.5) return;
    S.player.stamina -= stam;
    this.regenDelay = PLAYER_CONFIG.staminaRegenDelaySec;
    this.cool.attack = (wpn.cd / D.attackCdMult) * (opts.heavy ? 1.5 : 1);

    const ox: number = this.sprite.x, oy: number = this.sprite.y;
    const ang: number = pointerWorld
      ? Math.atan2(pointerWorld.y - oy, pointerWorld.x - ox)
      : Phaser.Math.DegToRad(({ right: 0, left: Math.PI, up: -Math.PI / 2, down: Math.PI / 2 } as Record<Dir, number>)[this.dir]);

    if (wpn.style === 'bow') {
      if (countItem(wpn.ammo) <= 0) { floaters.add(ox, oy - 34, 'No arrows!', '#ff9a7a'); return; }
      removeItem(wpn.ammo, 1);
      (this.scene as any).spawnProjectile({
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

    // ── Weapon style identity: slash / crush / pierce feel different ──
    const style: string = wpn.style || 'slash';
    let styleDmgMult = 1, styleReachMult = 1, styleArcMult = 1;
    if (style === 'crush') { styleDmgMult = 1.15; styleArcMult = 1.32; } // wide cleave
    else if (style === 'pierce') { styleReachMult = 1.35; styleArcMult = 0.36; } // narrow thrust
    let dmgBase: number = wpn.dmg * D.meleeDmgMult * styleDmgMult;
    // Phase B combo: light→light→finisher. 3rd consecutive light within
    // 0.9s deals 1.5× + knockback. Heavy attacks reset the chain.
    let isFinisher = false;
    if (opts.heavy) {
      if (!this.heavyUnlocked()) opts.heavy = false;
      else dmgBase *= D.heavyDmgMult;
      this.comboCount = 0; this.comboWindow = 0;
    } else if (wpn.style !== 'bow') {
      const now: number = performance.now() / 1000;
      if (now < this.comboWindow) this.comboCount += 1; else this.comboCount = 1;
      this.comboWindow = now + 0.9;
      if (this.comboCount >= 3) {
        isFinisher = true;
        dmgBase *= 1.5;
        this.comboCount = 0; this.comboWindow = 0;
      }
    }
    if (S.player.hp < D.maxHp * 0.35 && D.berserk > 1) dmgBase *= D.berserk;
    const reach: number = wpn.range * styleReachMult;
    const arcHalf: number = (PLAYER_CONFIG.attackArcDeg * 0.55 * styleArcMult * Math.PI) / 180;

    let hitAny = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx: number = e.sprite.x - ox, dy: number = e.sprite.y - oy;
      if (dx * dx + dy * dy > (reach + e.def.radius * 0.5) ** 2) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang)) > arcHalf) continue;
      hitAny = true;
      let dmg: number = dmgBase;
      // Spear bonus applies per-target (animals), not blindly to the swing.
      if (wdef?.weapon?.reachBonusVsAnimals && /wolf|boar|bear|dire|beast|animal/i.test(`${e.key || ''} ${e.def?.name || ''} ${e.def?.kind || ''}`)) dmg *= 1.12;
      const crit: boolean = Math.random() < D.critMelee + (wpn.crit || 0);
      e.takeDamage(Math.round(dmg * (crit ? 1.85 : 1)), ox, oy, floaters, crit || isFinisher);
      if (isFinisher && e.sprite?.body && !e.dead) {
        // Finisher knockback shove along the swing direction.
        const ka: number = Math.atan2(e.sprite.y - oy, e.sprite.x - ox);
        (e.sprite.body as Phaser.Physics.Arcade.Body).velocity.set(Math.cos(ka) * 320, Math.sin(ka) * 320);
        floaters?.add?.(e.sprite.x, e.sprite.y - 44, 'Finisher!', '#ffd66b', 1.15);
      }
    }
    wearEquipped('weapon', opts.heavy ? 2 : 1, D.toolWearMult);
    if (hitAny) {
      (this.scene as any).onMeleeImpact(ox, oy, !!opts.heavy);
      // ── Combat juice: hitstop + camera shake ─────────────────────────
      // Brief freeze frames give attacks weight and impact. Crush cleaves
      // shake harder even on light swings (wide-arc identity).
      const isCrush: boolean = (wpn.style || 'slash') === 'crush';
      const bigHit: boolean = !!(opts.heavy || isFinisher);
      const hitstopDuration: number = bigHit ? 0.065 : isCrush ? 0.045 : 0.035;
      this.hitstopTimer = hitstopDuration;
      // Camera shake scaled by damage dealt — crits shake harder. Respects
      // both screenShake and reducedMotion user preferences.
      if (shakeAllowed()) {
        const shakeIntensity: number = bigHit ? 0.008 : isCrush ? 0.006 : 0.004;
        this.scene.cameras.main.shake(80, shakeIntensity);
      }
      // Kill streak: restore a tiny bit of stamina on hit to reward aggression
      S.player.stamina = Math.min(D.maxStamina, S.player.stamina + (opts.heavy ? 3 : 1.5));
    }
    return hitAny;
  }

/* ── Taking damage & death ───────────────────────────────────────────── */
  takeDamage(rawDmg: number, srcX?: number | null, srcY?: number | null): number {
    const S = GameState.s, D = S.player.derived || {};
    if (this.iFrames > 0 || S.session_dead) return 0;
    // Phase B parry: blocking tapped within 150ms of impact = full negate +
    // stamina reward. Reads as skill, not a stat check.
    const offDef = S.player.equipment.offhand ? getItem(S.player.equipment.offhand.id) : null;
    if (this.blocking && offDef?.shieldBlock && performance.now() - this.blockStartAt < 150 && S.player.stamina > 5) {
      S.player.stamina = Math.min(D.maxStamina, S.player.stamina + 6);
      (this.scene as any).fxHit?.(this.sprite.x, this.sprite.y - 20);
      (GameState.session as any).floatRenderer?.(this.sprite.x, this.sprite.y - 44, 'Parried!', '#8fd8ff', 1.2);
      Bus.emit('play-sound', 'parry');
      GameState.notify('PLAYER');
      return 0;
    }
    let dmg: number = rawDmg * (1 - D.damageReduction);
    if (this.blocking && offDef?.shieldBlock && S.player.stamina > 5) {
      dmg *= 1 - offDef.shieldBlock;
      S.player.stamina = Math.max(0, S.player.stamina - D.blockStaminaCost);
      Bus.emit('play-sound', 'hit_flesh');
    } else Bus.emit('play-sound', 'player_hurt');
    dmg = Math.max(1, Math.round(dmg));
    // Immortal (test-only) — clamp damage to a single hp-tick so the player
    // still sees the red flash + knockback feedback but never reaches 0 hp.
    if (isImmortal()) dmg = 1;
    S.player.hp -= dmg;
    this.regenDelay = 2;
    (this.scene as any).fxHit?.(this.sprite.x, this.sprite.y);
    this.sprite.setTint(0xff6b5a).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => !S.session_dead && this.sprite.clearTint());
    if (srcX != null && this.sprite.body) {
      const a: number = Math.atan2(this.sprite.y - (srcY as number), this.sprite.x - srcX);
      (this.sprite.body as Phaser.Physics.Arcade.Body).velocity.set(Math.cos(a) * 210, Math.sin(a) * 210);
    }
    // Armor soaks damage — and soaks durability. Slow wear so a set lasts.
    if (this.blocking && offDef?.shieldBlock) wearEquipped('offhand', 1, D.toolWearMult);
    else if (Math.random() < 0.35) wearEquipped('armor', 1, D.toolWearMult);
    if (shakeAllowed()) this.scene.cameras.main.shake(140, 0.005);
    GameState.notify('PLAYER');
    if (S.player.hp <= 0 && !isImmortal()) this.die();
    else if (isImmortal()) S.player.hp = Math.max(1, S.player.hp);
    return dmg;
  }

  die(): void {
    const S = GameState.s;
    if (S.session_dead) return;
    // Defensive: even if some future code path forgets the isImmortal() check
    // before calling die(), immortal mode prevents death outright.
    if (isImmortal()) {
      S.player.hp = Math.max(1, S.player.hp || 1);
      GameState.notify('PLAYER');
      return;
    }
    S.session_dead = true;
    S.player.gold -= Math.floor(S.player.gold * 0.12);
    S.stats.deaths = (S.stats.deaths || 0) + 1;
    this.sprite.setVisible(false);
    this.shadow?.setVisible(false);
    if (this.sprite.body) (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;
    Bus.emit('player-death', { lostGold: S.player.gold });
  }

  respawn(): void {
    const S = GameState.s, D = S.player.derived || {};
    const home = S.settlement.pos || { x: 0, y: 260 };
    this.sprite.setPosition(home.x + 30, home.y + 40).setVisible(true);
    this.shadow?.setVisible(true).setPosition(this.sprite.x, this.sprite.y + 2);
    if (this.sprite.body) (this.sprite.body as Phaser.Physics.Arcade.Body).enable = true;
    S.player.hp = D.maxHp * 0.75;
    S.player.stamina = D.maxStamina;
    S.player.hunger = Math.max(28, S.player.hunger);
    S.player.thirst = Math.max(24, S.player.thirst);
    S.session_dead = false;
    GameState.notify('PLAYER');
  }

  /* ── Survival (spec §15: tension, not frustration) ───────────────────── */
  survivalTick(dt: number, ctx: PlayerUpdateCtx): void {
    const S = GameState.s, D = S.player.derived || {};
    const diff = (DIFFICULTY as any)[S.settings.difficulty] || (DIFFICULTY as any).normal;
    const resist: number = 1 - (D.drainResist || 0) * 0.4;
    const hot: number = ctx.envHeat ? 1.55 : 1;
    const chilled: number = ctx.envCold && D.warmthCapable < 4 ? 1.5 : 1;
    S.player.hunger = Math.max(0, S.player.hunger - diff.drain * resist * dt * 0.22 * detached(100));
    S.player.thirst = Math.max(0, S.player.thirst - diff.drain * resist * hot * dt * 0.26 * detached(100));
    if (ctx.envCold && D.warmthCapable < 3 && !ctx.nearWarmth) {
      S.player.coldExposure = (S.player.coldExposure || 0) + dt;
      if (S.player.coldExposure > 12 && !isImmortal()) S.player.hp -= 0.7 * dt;
    } else S.player.coldExposure = Math.max(0, (S.player.coldExposure || 0) - dt * 2);
    if (S.player.hunger > 42 && S.player.thirst > 20 && S.player.hp < D.maxHp) {
      S.player.hp = Math.min(D.maxHp, S.player.hp + PLAYER_CONFIG.regenPerSec * dt);
    }
    if (S.player.hunger <= 0 && !isImmortal()) S.player.hp -= PLAYER_CONFIG.starveHpData * dt * chilled;
    if (S.player.thirst <= 0 && !isImmortal()) S.player.hp -= PLAYER_CONFIG.starveHpData * 1.35 * dt;
    if (S.player.hp <= 0 && !isImmortal()) this.die();
    else if (!isImmortal()) GameState.notify('PLAYER');
    else { S.player.hp = Math.max(1, S.player.hp); GameState.notify('PLAYER'); }

    function detached(n: number): number {
      return n / 100; // drain rates expressed per-second already; scale to 0..1
    }
  }

  applyConsumableEffects(u: any): void {
    if (!u) return;
    const S = GameState.s, D = S.player.derived || {};
    if (u.food) S.player.hunger = Math.min(100, S.player.hunger + u.food);
    if (u.thirst) S.player.thirst = Math.min(100, S.player.thirst + u.thirst);
    if (u.hp) S.player.hp = Math.min(D.maxHp, S.player.hp + u.hp);
    if (u.staminaFull) S.player.stamina = D.maxStamina;
    if (u.warmBuff) (this.scene as any).grantWarmth?.(u.warmBuff);
    if (u.repairEquipped != null || u.repairAll != null) {
            import('../systems/InventorySystem.ts').then((m) => m.repairAll(u.repairAll ?? u.repairEquipped, D.perfectRepair));
    }
  }
}
