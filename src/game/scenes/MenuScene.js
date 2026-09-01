// Cinematic main-menu backdrop — upgraded for professional atmosphere:
// multi-layer sky, twinkling stars, glowing moon, denser parallax, fog,
// fireflies, richer embers, subtle camera drift. React UI sits on top.
import Phaser from 'phaser';
import { buildFxProps, buildMenuProps } from '../assets/propsFx.js';
import GameState from '../core/GameState.js';
import { CH } from '../core/EventBus.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // FX textures (pt_spark, proj_fireball, etc.) are required by the menu backdrop
    buildFxProps(this);
    buildMenuProps(this);
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#060910');

    // ── Deep multi-stop sky gradient ──────────────────────────────────────
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x060910, 0x0c1220, 0x121a2e, 0x1a2438, 1);
    sky.fillRect(0, 0, W, H * 0.72);
    // lower atmospheric haze
    sky.fillGradientStyle(0x1a2438, 0x1a2438, 0x0f1520, 0x0a0e16, 1);
    sky.fillRect(0, H * 0.55, W, H * 0.45);

    // ── Twinkling star field ─────────────────────────────────────────────
    this.starGfx = this.add.graphics().setDepth(0.5);
    this.stars = [];
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H * 0.58;
      const r = 0.6 + Math.random() * 1.8;
      const baseA = 0.25 + Math.random() * 0.65;
      this.stars.push({ x, y, r, baseA, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 2.2 });
    }

    // ── Soft nebula / atmospheric glow blobs ─────────────────────────────
    const nebula = this.add.graphics().setDepth(0.6).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 6; i++) {
      const cx = Math.random() * W;
      const cy = Math.random() * H * 0.4;
      const rad = 80 + Math.random() * 140;
      nebula.fillStyle(0x3a4a7a, 0.04 + Math.random() * 0.05);
      nebula.fillCircle(cx, cy, rad);
    }

    // ── Moon with soft glow ──────────────────────────────────────────────
    const moonX = W * 0.76;
    const moonY = H * 0.16;
    // outer glow
    this.add.image(moonX, moonY, 'proj_fireball')
      .setScale(14).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.7);
    // mid glow
    this.add.image(moonX, moonY, 'proj_fireball')
      .setScale(7).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.8);
    // core
    this.add.circle(moonX, moonY, 18, 0xf0e6c8, 0.92).setDepth(0.9);
    this.add.circle(moonX - 4, moonY - 3, 14, 0xfff8e8, 0.35).setDepth(0.95);

    // ── Parallax hill layers ─────────────────────────────────────────────
    this.far = this.add.image(W / 2, H * 0.70, 'menu_hills_far')
      .setDisplaySize(W * 1.15, H * 0.52).setAlpha(0.85).setDepth(1);
    this.mid = this.add.image(W / 2, H * 0.76, 'menu_hills_mid')
      .setDisplaySize(W * 1.12, H * 0.52).setDepth(2);
    this.near = this.add.image(W / 2, H * 0.84, 'menu_hills_near')
      .setDisplaySize(W * 1.1, H * 0.52).setDepth(3);

    // ── Castle ───────────────────────────────────────────────────────────
    this.castle = this.add.image(W * 0.48, H * 0.84, 'menu_castle')
      .setScale(1.15).setDepth(4).setOrigin(0.5, 1);

    // soft ground fog in front of hills
    const fog = this.add.graphics().setDepth(4.5);
    fog.fillStyle(0x0a1018, 0.35);
    fog.fillRect(0, H * 0.78, W, H * 0.22);
    // gradient fog strip
    const fogStrip = this.add.graphics().setDepth(4.6);
    fogStrip.fillGradientStyle(0x0a1018, 0x0a1018, 0x0a1018, 0x0a1018, 0, 0, 0.45, 0);
    fogStrip.fillRect(0, H * 0.72, W, H * 0.18);

    // ── Clouds (more + softer) ───────────────────────────────────────────
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = this.add.image(
        Math.random() * W,
        30 + Math.random() * H * 0.32,
        'menu_cloud'
      )
        .setScale(0.55 + Math.random() * 1.1)
        .setAlpha(0.28 + Math.random() * 0.35)
        .setDepth(5);
      this.clouds.push({
        s: c,
        speed: 2.5 + Math.random() * 7,
        bob: Math.random() * Math.PI * 2,
        bobSpeed: 0.3 + Math.random() * 0.5
      });
    }

    // ── Birds ────────────────────────────────────────────────────────────
    this.birds = [];
    for (let i = 0; i < 6; i++) {
      const b = this.add.image(
        Math.random() * W,
        50 + Math.random() * H * 0.28,
        'menu_bird_f1'
      ).setDepth(6).setScale(0.75 + Math.random() * 0.4).setAlpha(0.85);
      this.birds.push({
        s: b,
        vx: 5 + Math.random() * 9,
        timer: Math.random() * 2,
        baseY: b.y
      });
    }

    // ── Rising embers ────────────────────────────────────────────────────
    this.add.particles(0, H + 10, 'pt_spark', {
      x: { min: 0, max: W },
      y: H + 10,
      lifespan: { min: 2200, max: 3800 },
      speedY: { min: -35, max: -95 },
      speedX: { min: -12, max: 12 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.55, end: 0 },
      quantity: 1,
      frequency: 90,
      tint: [0xffb45a, 0xff8c3a, 0xffd080]
    }).setDepth(7);

    // ── Fireflies / magical motes ─────────────────────────────────────────
    this.add.particles(0, 0, 'pt_firefly', {
      x: { min: W * 0.1, max: W * 0.9 },
      y: { min: H * 0.45, max: H * 0.85 },
      lifespan: { min: 3000, max: 5500 },
      speedX: { min: -8, max: 8 },
      speedY: { min: -12, max: 6 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.85, end: 0 },
      quantity: 1,
      frequency: 220,
      tint: [0xc9e8ff, 0xffe8a0, 0xd0c0ff],
      blendMode: 'ADD'
    }).setDepth(8);

    // ── Subtle parallax drift ────────────────────────────────────────────
    this.tweens.add({
      targets: this.far,
      x: W / 2 - 12,
      yoyo: true,
      repeat: -1,
      duration: 14000,
      ease: 'Sine.inOut'
    });
    this.tweens.add({
      targets: this.mid,
      x: W / 2 + 20,
      yoyo: true,
      repeat: -1,
      duration: 11000,
      ease: 'Sine.inOut'
    });
    this.tweens.add({
      targets: this.near,
      x: W / 2 - 16,
      yoyo: true,
      repeat: -1,
      duration: 9000,
      ease: 'Sine.inOut'
    });
    this.tweens.add({
      targets: this.castle,
      y: this.castle.y - 4,
      yoyo: true,
      repeat: -1,
      duration: 7000,
      ease: 'Sine.inOut'
    });

    // gentle camera drift for living feel
    this.cameras.main.setZoom(1.02);
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: 8,
      scrollY: -4,
      yoyo: true,
      repeat: -1,
      duration: 16000,
      ease: 'Sine.inOut'
    });

    // title handled by React; start ambient menu music
    import('../systems/AudioSystem.js').then((a) => a.setMenuMood());
    GameState.session.screen = 'menu';
    GameState.notify(CH.SCREEN);
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;

    // twinkling stars
    this.starGfx.clear();
    for (const s of this.stars) {
      const a = s.baseA * (0.45 + 0.55 * Math.sin(time * 0.001 * s.speed + s.phase));
      this.starGfx.fillStyle(0xffffff, a);
      this.starGfx.fillCircle(s.x, s.y, s.r);
    }

    // clouds
    for (const c of this.clouds) {
      c.s.x += c.speed * dt;
      c.bob += c.bobSpeed * dt;
      c.s.y += Math.sin(c.bob) * 0.15;
      if (c.s.x > this.scale.width + 180) {
        c.s.x = -180;
        c.s.y = 30 + Math.random() * this.scale.height * 0.32;
      }
    }

    // birds
    for (const b of this.birds) {
      b.s.x += b.vx * dt;
      b.timer += dt;
      b.s.setTexture((Math.floor(b.timer * 2.2) % 2) ? 'menu_bird_f1' : 'menu_bird_f2');
      b.s.y = b.baseY + Math.sin(b.timer * 1.4) * 6;
      if (b.s.x > this.scale.width + 50) {
        b.s.x = -50;
        b.baseY = 50 + Math.random() * this.scale.height * 0.28;
        b.s.y = b.baseY;
      }
    }
  }
}
