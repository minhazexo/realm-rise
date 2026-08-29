// ─────────────────────────────────────────────────────────────────────────────
// Environment controller (spec §16–17): day/night light curve, dynamic weather
// with real gameplay effects. Compact: lighting + weather + env context.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';
import { DAYNIGHT_CONFIG, WEATHER_CONFIG } from '../core/Constants.js';
import { biomeAt } from '../world/worldGen.js';

export const DAWN = 0.24;
export const DUSK = 0.78;

export default class EnvSystem {
  constructor(scene) {
    this.scene = scene;
    this.weather = 'clear';
    this.warmthUntil = 0;
    this.rainEmitter = null;
    this.snowEmitter = null;
    this.fogRect = null;
    this.envContext = {};
    this._frame = 0;
    this._lastCycle = -1;
  }

  create() {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.darkLayer = this.scene.add.rectangle(0, 0, w, h, 0x0a0f18, 0).setOrigin(0).setDepth(4000).setScrollFactor(0);
    this.starLayer = this.scene.add.graphics().setDepth(4001).setScrollFactor(0).setAlpha(0);
    for (let i = 0; i < 80; i++) {
      this.starLayer.fillStyle(0xffffff, 0.3 + Math.random() * 0.6);
      this.starLayer.fillRect(Math.random() * w, Math.random() * h * 0.6, 1.5, 1.5);
    }
    // Cinematic vignette: soft darkening toward the screen edges adds depth.
    if (!this.scene.textures.exists('fx_vignette')) {
      const { canvas, ctx } = EnvSystem.makeCanvas(256, 256);
      const grad = ctx.createRadialGradient(128, 128, 78, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      this.scene.textures.addCanvas('fx_vignette', canvas);
    }
    this.vignette = this.scene.add.image(0, 0, 'fx_vignette').setOrigin(0).setDepth(4195).setScrollFactor(0);
    this.posVignette();
    // Low-health danger vignette — pulses red when HP is critical
    if (!this.scene.textures.exists('fx_danger_vignette')) {
      const { canvas, ctx } = EnvSystem.makeCanvas(256, 256);
      const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.6, 'rgba(180,30,20,0)');
      grad.addColorStop(1, 'rgba(180,30,20,0.7)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      this.scene.textures.addCanvas('fx_danger_vignette', canvas);
    }
    this.dangerVignette = this.scene.add.image(0, 0, 'fx_danger_vignette').setOrigin(0).setDepth(4196).setScrollFactor(0).setAlpha(0);
    this.sunSprite = this.scene.add.image(w - 100, 70, 'proj_fireball').setScrollFactor(0).setDepth(4001).setBlendMode('ADD').setAlpha(0.55);
    this.skyGlow = this.scene.add.image(w / 2, h / 2, 'fx_light').setScrollFactor(0).setDepth(3999).setBlendMode('ADD').setAlpha(0.12).setDisplaySize(w * 2, h * 2);
    this.weatherTimer = 18 + Math.random() * 40;
  }

  /** Position the vignette image to cover the whole viewport (on create + resize). */
  posVignette() {
    if (!this.vignette) return;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.vignette.setDisplaySize(w, h);
  }

  /** Canvas helper for building the procedural vignette texture. */
  static makeCanvas(w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  }

  rollWeather() {
    const b = biomeAt(this.scene.player.sprite.x, this.scene.player.sprite.y);
    const pool = ['clear', 'clear', 'clear', 'drizzle', 'fog'];
    if (b === 'frozen') pool.push('snow', 'snow', 'snow');
    if (b === 'desert') pool.push('heat', 'heat');
    if (b === 'swamp' || b === 'riverlands') pool.push('fog', 'drizzle');
    if (Math.random() < 0.12) pool.push('storm');
    this.setWeather(pool[(Math.random() * pool.length) | 0]);
  }

  setWeather(w) {
    this.weather = w;
    GameState.s.world.activeWeather = w;
    GameState.notify('WEATHER');
    Bus.emit('weather-changed', w);
    this.applyWeather();
    // Storm-specific: schedule lightning flashes
    if (this._lightningTimer) clearInterval(this._lightningTimer);
    if (w === 'storm') {
      this._lightningTimer = setInterval(() => {
        if (this.weather !== 'storm') { clearInterval(this._lightningTimer); return; }
        if (Math.random() < 0.35) this.lightningFlash();
      }, 3000 + Math.random() * 5000);
    }
  }

  lightningFlash() {
    const cam = this.scene.cameras.main;
    // White flash overlay
    const flash = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0xffffff, 0.6)
      .setOrigin(0).setScrollFactor(0).setDepth(4100).setBlendMode('ADD');
    // Quick flash + fade
    this.scene.tweens.add({
      targets: flash, alpha: 0, duration: 180,
      onComplete: () => flash.destroy()
    });
    // Camera shake
    cam.shake(250, 0.006);
    // Thunder sound with delay
    setTimeout(() => Bus.emit('play-sound', 'thunder'), 200 + Math.random() * 600);
  }

  applyWeather() {
    this.clearWeatherFx();
    if (this.weather === 'storm') Bus.emit('play-sound', 'thunder');
    const w = this.scene.scale.width, h = this.scene.scale.height;
    if (this.weather === 'drizzle' || this.weather === 'storm') {
      const isStorm = this.weather === 'storm';
      this.rainEmitter = this.scene.add.particles(0, 0, 'pt_rain', {
        x: { min: 0, max: w }, y: -20, lifespan: 900,
        speedY: isStorm ? 520 : 340, speedX: isStorm ? 90 : 60,
        quantity: isStorm ? 5 : 2, frequency: isStorm ? 40 : 60,
        alpha: { start: isStorm ? 0.8 : 0.7, end: 0.1 }
      }).setDepth(3900).setScrollFactor(0);
    } else if (this.weather === 'snow') {
      this.snowEmitter = this.scene.add.particles(0, 0, 'pt_snow', {
        x: { min: 0, max: w }, y: -10, lifespan: 2800,
        speedY: 35, speedX: 25, gravityY: 5, quantity: 1, frequency: 90,
        alpha: { start: 0.9, end: 0.15 }, scale: { min: 0.3, max: 1.1 },
        rotate: { min: 0, max: 360 }
      }).setDepth(3900).setScrollFactor(0);
    } else if (this.weather === 'fog') {
      this.fogRect = this.scene.add.rectangle(0, 0, w, h, 0xdfe4ec, 0.34).setOrigin(0).setScrollFactor(0).setDepth(3900).setBlendMode('ADD');
      // Drifting fog wisps
      this.fogEmitter = this.scene.add.particles(0, 0, 'pt_snow', {
        x: { min: 0, max: w }, y: { min: h * 0.3, max: h * 0.7 }, lifespan: 5000,
        speedX: 18, speedY: -3, quantity: 1, frequency: 400,
        alpha: { start: 0.15, end: 0 }, scale: { min: 2, max: 4 },
        tint: 0xdfe4ec
      }).setDepth(3900).setScrollFactor(0);
    } else if (this.weather === 'heat') {
      this.fogRect = this.scene.add.rectangle(0, 0, w, h, 0xffddaa, 0.2).setOrigin(0).setScrollFactor(0).setDepth(3900).setBlendMode('ADD');
      // Heat shimmer particles (rising wisps)
      this.fogEmitter = this.scene.add.particles(0, 0, 'pt_snow', {
        x: { min: 0, max: w }, y: h + 10, lifespan: 3000,
        speedY: -25, speedX: 5, quantity: 1, frequency: 500,
        alpha: { start: 0.12, end: 0 }, scale: { min: 1.5, max: 3 },
        tint: 0xffddaa
      }).setDepth(3900).setScrollFactor(0);
    }
  }

  clearWeatherFx() {
    this.rainEmitter?.destroy(); this.rainEmitter = null;
    this.snowEmitter?.destroy(); this.snowEmitter = null;
    this.fogEmitter?.destroy(); this.fogEmitter = null;
    this.fogRect?.destroy(); this.fogRect = null;
  }

  /** Called every frame; advances clock, weather, darkness, day counter. */
  update(dt) {
    const S = GameState.s;
    if (!S) return;
    S.world.timeOfDay = (S.world.timeOfDay + dt / DAYNIGHT_CONFIG.cycleSeconds) % 1;

    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = WEATHER_CONFIG.changeEveryMin + Math.random() * (WEATHER_CONFIG.changeEveryMax - WEATHER_CONFIG.changeEveryMin);
      this.rollWeather();
    }

    const t = S.world.timeOfDay;
    const isNight = t > DUSK || t < DAWN;
    const smoothDay = t >= DAWN && t <= DUSK ? Math.max(0, 1 - Math.abs(t - ((DAWN + DUSK) / 2)) / (DUSK - DAWN) * 2) : 0;
    this.darkLayer.setAlpha(Math.max(0, 0.85 - smoothDay * 0.85));
    this.starLayer.setAlpha(isNight ? 1 : 0);
    this.sunSprite.setAlpha(isNight ? 0.35 : 0.55).setScale(isNight ? 2.6 : 3.5);
    // Ambient sky glow breathes with the time of day (warm day, cool night).
    if (this.skyGlow) {
      this.skyGlow.setTint(isNight ? 0x2840a0 : 0xffcf8a);
      this.skyGlow.setAlpha(isNight ? 0.16 : 0.1);
    }

    const biome = biomeAt(this.scene.player.sprite.x, this.scene.player.sprite.y);
    const w = this.weather;
    this.envContext = {
      envCold: isNight || w === 'snow' || biome === 'frozen' || (biome === 'mountains' && isNight),
      envHeat: w === 'heat' || biome === 'desert' || biome === 'volcanic',
      nearWarmth: this.nearWarmth(this.scene.player.pos),
      night: isNight
    };
    GameState.session.timePhase = isNight ? 'night' : 'day';

    // ── Low-health danger vignette — pulses red when HP is critical ──
    if (this.dangerVignette) {
      const hpPct = (S.player.hp || 0) / (S.player.derived?.maxHp || 1);
      if (hpPct < 0.3) {
        // Pulse intensity: stronger the lower HP gets, with a breathing effect
        const danger = (0.3 - hpPct) / 0.3; // 0 at 30% HP, 1 at 0% HP
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
        this.dangerVignette.setAlpha(danger * (0.45 + pulse * 0.25));
      } else {
        this.dangerVignette.setAlpha(0);
      }
    }

    // dawn-broke on day-count change
    if (S.world.dayCount !== this._lastCycle) {
      if (this._lastCycle !== -1) Bus.emit('dawn-broke');
      this._lastCycle = S.world.dayCount;
      GameState.notify('TIME');
    }
    if (this._frame++ % 30 === 0) GameState.notify('TIME');
  }

  nearWarmth(pos) {
    if (this.warmthUntil > performance.now() / 1000) return true;
    for (const b of GameState.s.settlement.buildings) {
      if (b.key === 'campfire' && b.complete &&
        (pos.x - b.x) ** 2 + (pos.y - b.y) ** 2 < 40000) return true;
    }
    return false;
  }

  grantWarmth(sec) {
    this.warmthUntil = performance.now() / 1000 + sec;
  }

  fmtTime() {
    const total = GameState.s.world.timeOfDay * 24;
    const h = Math.floor(total);
    const m = Math.floor((total - h) * 60);
    const suf = h < 12 ? 'AM' : 'PM';
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${String(m).padStart(2, '0')} ${suf}`;
  }
}

