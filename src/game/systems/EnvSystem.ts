// ─────────────────────────────────────────────────────────────────────────────
// Environment controller (spec §16–17): day/night light curve, dynamic weather
// with real gameplay effects. Compact: lighting + weather + env context.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { Bus } from '../core/EventBus.ts';
import { DAYNIGHT_CONFIG, WEATHER_CONFIG } from '../core/Constants.ts';
import { biomeAt } from '../world/worldGen.ts';
import { particleMultiplier, photosensitiveMode, reducedMotion } from './SettingsSystem.ts';
import { throttleConfig } from './particleThrottle.ts';
import { setSkyColor, setSunPosition } from './WaterSystem.ts';
import { addScreenOverlay, screenPoint } from './ScreenOverlays.ts';

export const DAWN = 0.24;
export const DUSK = 0.78;

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Minimal scene surface consumed by the environment controller. */
export type EnvScene = Phaser.Scene & {
  player: { sprite: { x: number; y: number }; pos: { x: number; y: number } };
  useLightMask?: boolean;
  spawnBurst?(x: number, y: number, key: string): void;
};

/** One twinkling star in the screen-space star field. */
interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  phase: number;
  spd: number;
}

/** Environmental context published for gameplay systems (cold/heat/night). */
export interface EnvContext {
  envCold?: boolean;
  envHeat?: boolean;
  nearWarmth?: boolean;
  night?: boolean;
}

export default class EnvSystem {
  scene: EnvScene;
  weather = 'clear';
  warmthUntil = 0;
  rainEmitter: Emitter | null = null;
  snowEmitter: Emitter | null = null;
  fogEmitter: Emitter | null = null;
  fogRect: Phaser.GameObjects.Rectangle | null = null;
  fireflyEmitter: Emitter | null = null;
  envContext: EnvContext = {};
  darkLayer!: Phaser.GameObjects.Rectangle;
  gradeLayer!: Phaser.GameObjects.Rectangle;
  starLayer!: Phaser.GameObjects.Graphics;
  vignette!: Phaser.GameObjects.Image;
  dangerVignette!: Phaser.GameObjects.Image;
  sunSprite!: Phaser.GameObjects.Image;
  skyGlow!: Phaser.GameObjects.Image;
  _stars: Star[] = [];
  _frame = 0;
  _lastCycle = -1;
  _lightningTimer: ReturnType<typeof setInterval> | null = null;
  _splashAcc = 0;
  /** Set by WorldScene when the NightLights mask carries the darkness. */
  useLightMask = false;
  weatherTimer = 0;

  constructor(scene: EnvScene) {
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

  create(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    // Night darkness overlay (tinted blue-black for richer nights)
    this.darkLayer = addScreenOverlay(this.scene,
      this.scene.add.rectangle(0, 0, w, h, 0x080e1a, 0).setOrigin(0), 4000);

    // Warm dawn/dusk color grade overlay
    this.gradeLayer = addScreenOverlay(this.scene,
      this.scene.add.rectangle(0, 0, w, h, 0xff8844, 0).setOrigin(0).setBlendMode('ADD'), 3998);

    // Richer star field (draws in screen coords, so it is anchored, not sized)
    this.starLayer = addScreenOverlay(this.scene, this.scene.add.graphics().setAlpha(0), 4001, { mode: 'anchor' });
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
    this.vignette = addScreenOverlay(this.scene,
      this.scene.add.image(0, 0, 'fx_vignette').setOrigin(0), 4195);

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
    this.dangerVignette = addScreenOverlay(this.scene,
      this.scene.add.image(0, 0, 'fx_danger_vignette').setOrigin(0).setAlpha(0), 4196);

    // Sun / moon — pinned 100px in from the top-right corner.
    this.sunSprite = addScreenOverlay(this.scene,
      this.scene.add.image(0, 0, 'proj_fireball').setBlendMode('ADD').setAlpha(0.55), 4001,
      { mode: 'pin', at: (vw: number) => [vw - 100, 70] });

    // Ambient sky fill light
    this.skyGlow = addScreenOverlay(this.scene,
      this.scene.add.image(0, 0, 'fx_light').setBlendMode('ADD').setAlpha(0.12), 3999,
      { mode: 'fill', scale: 2.2 });

    // Night fireflies (spawned when night begins)
    this.fireflyEmitter = null;

    this.weatherTimer = 18 + Math.random() * 40;
  }

  /** Canvas helper for building the procedural vignette texture. */
  static makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    // A 2d context is always available in the browser; tests never reach here.
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    return { canvas, ctx };
  }

  rollWeather(): void {
    const b = biomeAt(this.scene.player.sprite.x, this.scene.player.sprite.y);
    const pool: string[] = ['clear', 'clear', 'clear', 'drizzle', 'fog'];
    if (b === 'frozen') pool.push('snow', 'snow', 'snow');
    if (b === 'desert') pool.push('heat', 'heat');
    if (b === 'volcanic') pool.push('ash', 'ash');
    if (b === 'swamp' || b === 'riverlands') pool.push('fog', 'drizzle');
    if (Math.random() < 0.12) pool.push('storm');
    this.setWeather(pool[(Math.random() * pool.length) | 0] ?? 'clear');
  }

  setWeather(w: string): void {
    this.weather = w;
    GameState.s.world.activeWeather = w;
    GameState.notify('WEATHER');
    Bus.emit('weather-changed', w);
    this.applyWeather();
    // Storm-specific: schedule lightning flashes
    if (this._lightningTimer) clearInterval(this._lightningTimer);
    if (w === 'storm') {
      this._lightningTimer = setInterval(() => {
        if (this.weather !== 'storm') { if (this._lightningTimer) clearInterval(this._lightningTimer); return; }
        if (Math.random() < 0.35) this.lightningFlash();
      }, 3000 + Math.random() * 5000);
    }
  }

  lightningFlash(): void {
    const cam = this.scene.cameras.main;
    // Photosensitivity mode: thunder + soft rumble cue, no white strobe.
    if (!photosensitiveMode()) {
      // White flash overlay
      const flash = addScreenOverlay(this.scene,
        this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0xffffff, 0.6)
          .setOrigin(0).setBlendMode('ADD'), 4100);
      // Quick flash + fade
      this.scene.tweens.add({
        targets: flash, alpha: 0, duration: 180,
        onComplete: () => flash.destroy()
      });
      // Camera shake
      cam.shake(250, 0.006);
    }
    // Thunder sound with delay
    setTimeout(() => Bus.emit('play-sound', 'thunder'), 200 + Math.random() * 600);
  }

  applyWeather(): void {
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
      if (cfg) this.rainEmitter = addScreenOverlay(this.scene,
        this.scene.add.particles(0, 0, 'pt_rain', cfg), 3900, { mode: 'anchor' });
    } else if (this.weather === 'snow') {
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: -10, lifespan: 2800,
        speedY: 35, speedX: 25, gravityY: 5, quantity: 1, frequency: 90,
        alpha: { start: 0.9, end: 0.15 }, scale: { min: 0.3, max: 1.1 },
        rotate: { min: 0, max: 360 }
      });
      if (cfg) this.snowEmitter = addScreenOverlay(this.scene,
        this.scene.add.particles(0, 0, 'pt_snow', cfg), 3900, { mode: 'anchor' });
    } else if (this.weather === 'fog') {
      this.fogRect = addScreenOverlay(this.scene,
        this.scene.add.rectangle(0, 0, w, h, 0xdfe4ec, 0.34).setOrigin(0).setBlendMode('ADD'), 3900);
      // Drifting fog wisps
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: { min: h * 0.3, max: h * 0.7 }, lifespan: 5000,
        speedX: 18, speedY: -3, quantity: 1, frequency: 400,
        alpha: { start: 0.15, end: 0 }, scale: { min: 2, max: 4 },
        tint: 0xdfe4ec
      });
      if (cfg) this.fogEmitter = addScreenOverlay(this.scene,
        this.scene.add.particles(0, 0, 'pt_snow', cfg), 3900, { mode: 'anchor' });
    } else if (this.weather === 'ash') {
      // Emberwaste ashfall: a grey NORMAL-blend veil (ADD would read as light)
      // plus slow drifting flakes — reduced visibility, not a colour grade.
      this.fogRect = addScreenOverlay(this.scene,
        this.scene.add.rectangle(0, 0, w, h, 0x9a8f86, 0.22).setOrigin(0), 3900);
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: -10, lifespan: 4200,
        speedY: 34, speedX: 16, quantity: 1, frequency: 110,
        alpha: { start: 0.55, end: 0.05 }, scale: { min: 0.2, max: 0.7 },
        tint: 0xbfb4a8
      });
      if (cfg) this.fogEmitter = addScreenOverlay(this.scene,
        this.scene.add.particles(0, 0, 'pt_snow', cfg), 3900, { mode: 'anchor' });
    } else if (this.weather === 'heat') {
      this.fogRect = addScreenOverlay(this.scene,
        this.scene.add.rectangle(0, 0, w, h, 0xffddaa, 0.2).setOrigin(0).setBlendMode('ADD'), 3900);
      // Heat shimmer particles (rising wisps)
      const cfg = throttleConfig({
        x: { min: 0, max: w }, y: h + 10, lifespan: 3000,
        speedY: -25, speedX: 5, quantity: 1, frequency: 500,
        alpha: { start: 0.12, end: 0 }, scale: { min: 1.5, max: 3 },
        tint: 0xffddaa
      });
      if (cfg) this.fogEmitter = addScreenOverlay(this.scene,
        this.scene.add.particles(0, 0, 'pt_snow', cfg), 3900, { mode: 'anchor' });
    }
  }

  clearWeatherFx(): void {
    this.rainEmitter?.destroy(); this.rainEmitter = null;
    this.snowEmitter?.destroy(); this.snowEmitter = null;
    this.fogEmitter?.destroy(); this.fogEmitter = null;
    this.fogRect?.destroy(); this.fogRect = null;
  }

  /** Called every frame; advances clock, weather, darkness, day counter. */
  update(dt: number): void {
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

    // Night darkness — deeper and cooler. When the NightLights mask is
    // active it carries the darkness (with light holes), so the flat layer
    // drops to a 0.25 residual instead of double-darkening the scene.
    this.darkLayer.setFillStyle(0x080e1a);
    const flatDark = Math.max(0, 0.88 - smoothDay * 0.88);
    this.darkLayer.setAlpha(this.useLightMask ? Math.min(flatDark, 0.25) : flatDark);

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
      // The sun lives in the screen layer, so its x/y are layer-local. Convert
      // to screen, then to world, so the water shader can position glints
      // relative to the camera.
      const cam = this.scene.cameras.main;
      const [sunX, sunY] = screenPoint(this.scene.scale.width, this.scene.scale.height,
        [this.sunSprite.x, this.sunSprite.y]);
      setSunPosition(cam.scrollX + sunX, cam.scrollY + sunY);
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
      if (cfg) this.fireflyEmitter = addScreenOverlay(this.scene,
        this.scene.add.particles(0, 0, 'pt_firefly', cfg), 3905, { mode: 'anchor' });
    } else if (!isNight && this.fireflyEmitter) {
      this.fireflyEmitter.destroy();
      this.fireflyEmitter = null;
    }

    // Phase B: world-space rain splashes — the screen-space streaks read
    // as overlay; splashes on the ground around the player anchor weather
    // in the world. Throttled, particle-setting aware.
    if ((this.weather === 'drizzle' || this.weather === 'storm') && particleMultiplier() > 0) {
      this._splashAcc = (this._splashAcc || 0) + dt;
      if (this._splashAcc > 0.4) {
        this._splashAcc = 0;
        try {
          const p = this.scene.player?.sprite;
          const mult = particleMultiplier();
          if (p && Math.random() < mult && this.scene.spawnBurst) {
            const n = this.weather === 'storm' ? 3 : 1;
            for (let i = 0; i < n; i++) {
              this.scene.spawnBurst(
                p.x + (Math.random() - 0.5) * 420,
                p.y + (Math.random() - 0.5) * 300,
                'pt_rain',
              );
            }
          }
        } catch { /* cosmetic */ }
      }
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
        // vignette still warns but doesn't strobe. Static in photosensitivity
        // mode — no oscillation at all.
        const danger = (0.3 - hpPct) / 0.3; // 0 at 30% HP, 1 at 0% HP
        const pulse = photosensitiveMode() ? 0.6 : reducedMotion() ? 0.65 : 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
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

  nearWarmth(pos: { x: number; y: number }): boolean {
    if (this.warmthUntil > performance.now() / 1000) return true;
    for (const b of GameState.s.settlement.buildings) {
      if (b.key === 'campfire' && b.complete &&
        (pos.x - b.x) ** 2 + (pos.y - b.y) ** 2 < 40000) return true;
    }
    return false;
  }

  grantWarmth(sec: number): void {
    this.warmthUntil = performance.now() / 1000 + sec;
  }

  fmtTime(): string {
    const total = GameState.s.world.timeOfDay * 24;
    const h = Math.floor(total);
    const m = Math.floor((total - h) * 60);
    const suf = h < 12 ? 'AM' : 'PM';
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${String(m).padStart(2, '0')} ${suf}`;
  }
}
