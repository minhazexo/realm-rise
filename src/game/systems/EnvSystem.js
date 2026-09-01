// ─────────────────────────────────────────────────────────────────────────────
// Environment controller (spec §16–17): day/night light curve, dynamic weather
// with real gameplay effects. Compact: lighting + weather + env context.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.js';
import { Bus } from '../core/EventBus.js';
import { DAYNIGHT_CONFIG, WEATHER_CONFIG } from '../core/Constants.js';
import { biomeAt } from '../world/worldGen.js';
import { particleMultiplier, shadowsEnabled } from './SettingsSystem.js';
import { throttleConfig } from './particleThrottle.js';
import { setSkyColor, setSunPosition } from './WaterSystem.js';

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

    // Night darkness overlay (tinted blue-black for richer nights)
    this.darkLayer = this.scene.add.rectangle(0, 0, w, h, 0x080e1a, 0)
      .setOrigin(0).setDepth(4000).setScrollFactor(0);

    // Warm dawn/dusk color grade overlay
    this.gradeLayer = this.scene.add.rectangle(0, 0, w, h, 0xff8844, 0)
      .setOrigin(0).setDepth(3998).setScrollFactor(0).setBlendMode('ADD');

    // Richer star field
    this.starLayer = this.scene.add.graphics().setDepth(4001).setScrollFactor(0).setAlpha(0);
    this._stars = [];
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h * 0.62;
      const r = 0.7 + Math.random() * 1.6;
      const a = 0.25 + Math.random() * 0.7;
      this._stars.push({ x, y, r, a, phase: Math.random() * Math.PI * 2, spd: 0.6 + Math.random() * 2 });
      this.starLayer.fillStyle(0xffffff, a);
      this.starLayer.fillCircle(x, y, r);
    }

    // Cinematic vignette
    if (!this.scene.textures.exists('fx_vignette')) {
      const { canvas, ctx } = EnvSystem.makeCanvas(256, 256);
      const grad = ctx.createRadialGradient(128, 128, 70, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0.12)');
      grad.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      this.scene.textures.addCanvas('fx_vignette', canvas);
    }
    this.vignette = this.scene.add.image(0, 0, 'fx_vignette').setOrigin(0).setDepth(4195).setScrollFactor(0);
    this.posVignette();

    // Low-health danger vignette
    if (!this.scene.textures.exists('fx_danger_vignette')) {
      const { canvas, ctx } = EnvSystem.makeCanvas(256, 256);
      const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.55, 'rgba(180,30,20,0)');
      grad.addColorStop(1, 'rgba(180,30,20,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      this.scene.textures.addCanvas('fx_danger_vignette', canvas);
    }
    this.dangerVignette = this.scene.add.image(0, 0, 'fx_danger_vignette')
      .setOrigin(0).setDepth(4196).setScrollFactor(0).setAlpha(0);

    // Sun / moon
    this.sunSprite = this.scene.add.image(w - 100, 70, 'proj_fireball')
      .setScrollFactor(0).setDepth(4001).setBlendMode('ADD').setAlpha(0.55);

    // Ambient sky fill light
    this.skyGlow = this.scene.add.image(w / 2, h / 2, 'fx_light')
      .setScrollFactor(0).setDepth(3999).setBlendMode('ADD')
      .setAlpha(0.12).setDisplaySize(w * 2.2, h * 2.2);

    // Night fireflies (spawned when night begins)
    this.fireflyEmitter = null;

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
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: -20, lifespan: 900,
        speedY: isStorm ? 520 : 340, speedX: isStorm ? 90 : 60,
        quantity: isStorm ? 5 : 2, frequency: isStorm ? 40 : 60,
        alpha: { start: isStorm ? 0.8 : 0.7, end: 0.1 }
      });
      if (cfg) this.rainEmitter = this.scene.add.particles(0, 0, 'pt_rain', cfg)
        .setDepth(3900).setScrollFactor(0);
    } else if (this.weather === 'snow') {
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: -10, lifespan: 2800,
        speedY: 35, speedX: 25, gravityY: 5, quantity: 1, frequency: 90,
        alpha: { start: 0.9, end: 0.15 }, scale: { min: 0.3, max: 1.1 },
        rotate: { min: 0, max: 360 }
      });
      if (cfg) this.snowEmitter = this.scene.add.particles(0, 0, 'pt_snow', cfg)
        .setDepth(3900).setScrollFactor(0);
    } else if (this.weather === 'fog') {
      this.fogRect = this.scene.add.rectangle(0, 0, w, h, 0xdfe4ec, 0.34).setOrigin(0).setScrollFactor(0).setDepth(3900).setBlendMode('ADD');
      // Drifting fog wisps
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: { min: h * 0.3, max: h * 0.7 }, lifespan: 5000,
        speedX: 18, speedY: -3, quantity: 1, frequency: 400,
        alpha: { start: 0.15, end: 0 }, scale: { min: 2, max: 4 },
        tint: 0xdfe4ec
      });
      if (cfg) this.fogEmitter = this.scene.add.particles(0, 0, 'pt_snow', cfg)
        .setDepth(3900).setScrollFactor(0);
    } else if (this.weather === 'heat') {
      this.fogRect = this.scene.add.rectangle(0, 0, w, h, 0xffddaa, 0.2).setOrigin(0).setScrollFactor(0).setDepth(3900).setBlendMode('ADD');
      // Heat shimmer particles (rising wisps)
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: h + 10, lifespan: 3000,
        speedY: -25, speedX: 5, quantity: 1, frequency: 500,
        alpha: { start: 0.12, end: 0 }, scale: { min: 1.5, max: 3 },
        tint: 0xffddaa
      });
      if (cfg) this.fogEmitter = this.scene.add.particles(0, 0, 'pt_snow', cfg)
        .setDepth(3900).setScrollFactor(0);
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

    // Smooth day strength (peaks at noon)
    const mid = (DAWN + DUSK) / 2;
    const half = (DUSK - DAWN) / 2;
    const smoothDay = t >= DAWN && t <= DUSK
      ? Math.max(0, 1 - Math.abs(t - mid) / half)
      : 0;

    // Dawn / dusk warmth factor (peaks near DAWN and DUSK)
    const dawnProx = 1 - Math.min(1, Math.abs(t - DAWN) / 0.08);
    const duskProx = 1 - Math.min(1, Math.abs(t - DUSK) / 0.08);
    const goldenHour = Math.max(0, dawnProx, duskProx);

    // Night darkness — deeper and cooler
    this.darkLayer.setFillStyle(0x080e1a);
    this.darkLayer.setAlpha(Math.max(0, 0.88 - smoothDay * 0.88));

    // Golden-hour color grade
    if (this.gradeLayer) {
      this.gradeLayer.setFillStyle(t < mid ? 0xff9966 : 0xff7744);
      this.gradeLayer.setAlpha(goldenHour * 0.14);
    }

    // Stars fade in/out smoothly + twinkle
    const starTarget = isNight ? 1 : 0;
    const starLerp = Math.min(1, dt * 1.8);
    this.starLayer.setAlpha(this.starLayer.alpha + (starTarget - this.starLayer.alpha) * starLerp);
    if (isNight && this._stars && this._frame % 3 === 0) {
      this.starLayer.clear();
      const now = performance.now() * 0.001;
      for (const s of this._stars) {
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * s.spd + s.phase));
        this.starLayer.fillStyle(0xffffff, s.a * tw * this.starLayer.alpha);
        this.starLayer.fillCircle(s.x, s.y, s.r);
      }
    }

    // Sun by day / moon by night
    this.sunSprite
      .setAlpha(isNight ? 0.4 : 0.6 + smoothDay * 0.15)
      .setScale(isNight ? 2.8 : 3.2 + smoothDay * 0.6)
      .setTint(isNight ? 0xc8d8ff : 0xffe8a0);

    // Ambient sky glow
    if (this.skyGlow) {
      this.skyGlow.setTint(isNight ? 0x203868 : goldenHour > 0.2 ? 0xffb070 : 0xffe0a8);
      this.skyGlow.setAlpha(isNight ? 0.18 : 0.08 + smoothDay * 0.06 + goldenHour * 0.08);
    }

    // Push the sky tint + sun position to the water system so water
    // picks up reflections matching the time of day.
    const skyHex = isNight ? 0x203868 : goldenHour > 0.2 ? 0xffb070 : 0xffe0a8;
    const skyR = (skyHex >> 16) & 255, skyG = (skyHex >> 8) & 255, skyB = skyHex & 255;
    setSkyColor(skyR, skyG, skyB);
    if (this.sunSprite) {
      const w = this.scene.scale.width;
      // The sun sprite is screen-fixed (scrollFactor=0). Convert to world
      // coords by adding camera scroll so the water shader can position
      // glints relative to the camera.
      const cam = this.scene.cameras.main;
      setSunPosition(cam.scrollX + this.sunSprite.x, cam.scrollY + this.sunSprite.y);
    }

    // Night fireflies
    if (isNight && !this.fireflyEmitter && this.scene.textures.exists('pt_firefly')) {
      const sw = this.scene.scale.width, sh = this.scene.scale.height;
      const cfg = throttleConfig({
        x: { min: 0, max: sw },
        y: { min: sh * 0.35, max: sh * 0.9 },
        lifespan: { min: 2500, max: 5000 },
        speedX: { min: -10, max: 10 },
        speedY: { min: -8, max: 4 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.8, end: 0 },
        quantity: 1,
        frequency: 350,
        blendMode: 'ADD'
      });
      if (cfg) this.fireflyEmitter = this.scene.add.particles(0, 0, 'pt_firefly', cfg)
        .setDepth(3905).setScrollFactor(0);
    } else if (!isNight && this.fireflyEmitter) {
      this.fireflyEmitter.destroy();
      this.fireflyEmitter = null;
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
        // Pulse intensity: stronger the lower HP gets, with a breathing effect.
        // Halve the breathing when the user prefers reduced motion so the
        // vignette still warns but doesn't strobe.
        const danger = (0.3 - hpPct) / 0.3; // 0 at 30% HP, 1 at 0% HP
        const reduced = S.settings?.toggles?.reducedMotion === true;
        const pulse = reduced ? 0.65 : 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
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

