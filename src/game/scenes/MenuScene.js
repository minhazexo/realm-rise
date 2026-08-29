// Cinematic main-menu backdrop (spec §40): drifting parallax hills, castle,
// clouds, birds, fog, embers. React renders the actual menu UI on top.
import Phaser from 'phaser';
import { buildMenuProps } from '../assets/propsFx.js';
import GameState from '../core/GameState.js';
import { CH } from '../core/EventBus.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }
  create() {
    buildMenuProps(this);
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0a0e16');

    // gradient sky
    const g = this.add.graphics();
    const grad = g.createGradientStyle ? (() => null)() : null;
    g.fillGradientStyle(0x0a0e16, 0x1b2a44, 0x0a0e16, 0x2a2a3c, 1);
    g.fillRect(0, 0, W, H);

    // stars
    const stars = this.add.graphics();
    for (let i = 0; i < 130; i++) {
      stars.fillStyle(0xffffff, 0.3 + Math.random() * 0.6);
      stars.fillRect(Math.random() * W, Math.random() * H * 0.6, 1.5, 1.5);
    }

    // moon
    this.add.image(W * 0.78, H * 0.18, 'proj_fireball').setScale(5).setAlpha(0.5).setBlendMode('ADD');

    // parallax layers
    this.far = this.add.image(W / 2, H * 0.72, 'menu_hills_far').setDisplaySize(W, H * 0.5).setAlpha(0.9).setDepth(1);
    this.mid = this.add.image(W / 2, H * 0.78, 'menu_hills_mid').setDisplaySize(W, H * 0.5).setDepth(2);
    this.near = this.add.image(W / 2, H * 0.86, 'menu_hills_near').setDisplaySize(W, H * 0.5).setDepth(3);
    this.castle = this.add.image(W * 0.5, H * 0.86, 'menu_castle').setScale(1).setDepth(4).setOrigin(0.5, 1);

    // clouds
    this.clouds = [];
    for (let i = 0; i < 5; i++) {
      const c = this.add.image(Math.random() * W, 40 + Math.random() * H * 0.3, 'menu_cloud')
        .setScale(0.6 + Math.random() * 0.9).setAlpha(0.5).setDepth(5);
      this.clouds.push({ s: c, speed: 4 + Math.random() * 9 });
    }

    // birds
    this.birds = [];
    for (let i = 0; i < 4; i++) {
      const b = this.add.image(Math.random() * W, 60 + Math.random() * H * 0.3, 'menu_bird_f1').setDepth(6).setScale(0.9);
      this.birds.push({ s: b, vx: 6 + Math.random() * 8, timer: 0 });
    }

    // embers (volcanic longing)
    const embers = this.add.particles(0, H, 'pt_spark', {
      x: { min: 0, max: W }, y: H, lifespan: 2600, speedY: { min: -40, max: -90 },
      speedX: { min: -10, max: 10 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.5, end: 0 },
      quantity: 2, frequency: 240, tint: 0xffb45a
    }).setDepth(7);

    this.tweens.add({ targets: this.mid, x: W / 2 - 18, yoyo: true, repeat: -1, duration: 8000, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.near, x: W / 2 + 16, yoyo: true, repeat: -1, duration: 10000, ease: 'Sine.inOut' });

    // title handled by React; start soothing ambient menu music
    import('../systems/AudioSystem.js').then((a) => a.setMenuMood());
    GameState.session.screen = 'menu';
    GameState.notify(CH.SCREEN);
  }

  update(time) {
    for (const c of this.clouds) {
      c.s.x += c.speed * 0.016;
      if (c.s.x > this.scale.width + 160) c.s.x = -160;
    }
    for (const b of this.birds) {
      b.s.x += b.vx * 0.016;
      b.timer += 0.016;
      b.s.setTexture((Math.floor(b.timer * 2) % 2) ? 'menu_bird_f1' : 'menu_bird_f2');
      if (b.s.x > this.scale.width + 40) { b.s.x = -40; b.s.y = 60 + Math.random() * this.scale.height * 0.3; }
    }
  }
}
