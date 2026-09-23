// ─────────────────────────────────────────────────────────────────────────────
// menuBackdrop — the title screen's animated world: multi-layer sky, twinkling
// stars, glowing moon, parallax hills, the ruined castle, drifting fog, clouds,
// birds, rising embers, travellers on the ridge and the foreground treeline.
//
// Split out of MenuScene so the scene owns its lifecycle (textures, screen
// state, menu music) and this owns the backdrop: one home for the layers, their
// types and their per-frame drift. Scene-context functions, the same pattern as
// systems/* — the objects live in the scene's display list.
//
// The React title, menu buttons and settings screen sit on top of this; nothing
// here is interactive.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import { buildFxProps, buildMenuProps } from '../assets/propsFx.ts';
import { buildNatureProps } from '../assets/propsNature1.ts';
import { makePlayerSheet } from '../assets/index.ts';
import { particleMultiplier, reducedMotion } from '../systems/SettingsSystem.ts';

/** One twinkling star. */
export interface Star {
  x: number;
  y: number;
  r: number;
  baseA: number;
  phase: number;
  speed: number;
}

/** A drifting cloud, with its own bob phase so the field never moves in lockstep. */
export interface CloudEntry {
  s: Phaser.GameObjects.Image;
  speed: number;
  bob: number;
  bobSpeed: number;
}

/** A bird: horizontal speed, wing-flap timer and the height it oscillates around. */
export interface BirdEntry {
  s: Phaser.GameObjects.Image;
  vx: number;
  timer: number;
  baseY: number;
}

/** A lone survivor wandering the near ridge (the character you will play). */
export interface Wanderer {
  s: Phaser.GameObjects.Sprite;
  pauseT: number;
  vx: number;
}

/** Background travellers crossing the mid hills. */
export interface HikerEntry {
  s: Phaser.GameObjects.Sprite;
  vx: number;
}

/** The scene surface the backdrop needs: its display list and these objects. */
export type MenuBackdropScene = Phaser.Scene & {
  starGfx: Phaser.GameObjects.Graphics;
  stars: Star[];
  far: Phaser.GameObjects.Image;
  mid: Phaser.GameObjects.Image;
  near: Phaser.GameObjects.Image;
  castle: Phaser.GameObjects.Image;
  clouds: CloudEntry[];
  birds: BirdEntry[];
  wanderer: Wanderer | null;
  hikers: HikerEntry[];
  fogBanks: { s: Phaser.GameObjects.Image; speed: number }[];
};

const STAR_COUNT = 220;
const NEBULA_BLOBS = 6;
const CLOUD_COUNT = 9;
const BIRD_COUNT = 6;
const FOG_BANK_COUNT = 4;
const TREELINE_COUNT = 9;
const HIKER_COUNT = 2;

/**
 * Textures the backdrop draws with. The menu boots first, so it must be
 * self-sufficient; the player sheet is only built when absent so an appearance
 * customized on an existing save is never clobbered.
 */
export function buildMenuTextures(scene: Phaser.Scene): void {
  buildFxProps(scene);
  buildMenuProps(scene);
  buildNatureProps(scene);
  if (!scene.textures.exists('player_char')) {
    makePlayerSheet(scene, {
      skin: '#caa27c', hairstyle: 'short', hairColor: '#4a3222',
      gender: 'm', tierIdx: 0,
    });
  }
}

/** Build the whole backdrop: sky → stars → moon → hills → life → treeline. */
export function buildMenuBackdrop(scene: MenuBackdropScene): void {
  const W: number = scene.scale.width;
  const H: number = scene.scale.height;
  scene.cameras.main.setBackgroundColor('#060910');

  // ── Deep multi-stop sky gradient ──────────────────────────────────────
  const sky = scene.add.graphics().setDepth(0);
  sky.fillGradientStyle(0x060910, 0x0c1220, 0x121a2e, 0x1a2438, 1);
  sky.fillRect(0, 0, W, H * 0.72);
  // lower atmospheric haze
  sky.fillGradientStyle(0x1a2438, 0x1a2438, 0x0f1520, 0x0a0e16, 1);
  sky.fillRect(0, H * 0.55, W, H * 0.45);

  // ── Twinkling star field ─────────────────────────────────────────────
  scene.starGfx = scene.add.graphics().setDepth(0.5);
  scene.stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const x: number = Math.random() * W;
    const y: number = Math.random() * H * 0.58;
    const r: number = 0.6 + Math.random() * 1.8;
    const baseA: number = 0.25 + Math.random() * 0.65;
    scene.stars.push({ x, y, r, baseA, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 2.2 });
  }

  // ── Soft nebula / atmospheric glow blobs ─────────────────────────────
  const nebula = scene.add.graphics().setDepth(0.6).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < NEBULA_BLOBS; i++) {
    const cx: number = Math.random() * W;
    const cy: number = Math.random() * H * 0.4;
    const rad: number = 80 + Math.random() * 140;
    nebula.fillStyle(0x3a4a7a, 0.04 + Math.random() * 0.05);
    nebula.fillCircle(cx, cy, rad);
  }

  // ── Moon with soft glow ──────────────────────────────────────────────
  const moonX: number = W * 0.76;
  const moonY: number = H * 0.16;
  // outer glow
  scene.add.image(moonX, moonY, 'proj_fireball')
    .setScale(14).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.7);
  // mid glow
  scene.add.image(moonX, moonY, 'proj_fireball')
    .setScale(7).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(0.8);
  // core
  scene.add.circle(moonX, moonY, 18, 0xf0e6c8, 0.92).setDepth(0.9);
  scene.add.circle(moonX - 4, moonY - 3, 14, 0xfff8e8, 0.35).setDepth(0.95);

  // ── Parallax hill layers ─────────────────────────────────────────────
  scene.far = scene.add.image(W / 2, H * 0.70, 'menu_hills_far')
    .setDisplaySize(W * 1.15, H * 0.52).setAlpha(0.85).setDepth(1);
  scene.mid = scene.add.image(W / 2, H * 0.76, 'menu_hills_mid')
    .setDisplaySize(W * 1.12, H * 0.52).setDepth(2);
  scene.near = scene.add.image(W / 2, H * 0.84, 'menu_hills_near')
    .setDisplaySize(W * 1.1, H * 0.52).setDepth(3);

  // ── Castle ───────────────────────────────────────────────────────────
  scene.castle = scene.add.image(W * 0.48, H * 0.84, 'menu_castle')
    .setScale(1.15).setDepth(4).setOrigin(0.5, 1);

  // soft ground fog in front of hills
  const fog = scene.add.graphics().setDepth(4.5);
  fog.fillStyle(0x0a1018, 0.35);
  fog.fillRect(0, H * 0.78, W, H * 0.22);
  // gradient fog strip
  const fogStrip = scene.add.graphics().setDepth(4.6);
  fogStrip.fillGradientStyle(0x0a1018, 0x0a1018, 0x0a1018, 0x0a1018, 0, 0, 0.45, 0);
  fogStrip.fillRect(0, H * 0.72, W, H * 0.18);

  // ── Clouds (more + softer) ───────────────────────────────────────────
  scene.clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const c = scene.add.image(
      Math.random() * W,
      30 + Math.random() * H * 0.32,
      'menu_cloud'
    )
      .setScale(0.55 + Math.random() * 1.1)
      .setAlpha(0.28 + Math.random() * 0.35)
      .setDepth(5);
    scene.clouds.push({
      s: c,
      speed: 2.5 + Math.random() * 7,
      bob: Math.random() * Math.PI * 2,
      bobSpeed: 0.3 + Math.random() * 0.5
    });
  }

  // ── Birds ────────────────────────────────────────────────────────────
  scene.birds = [];
  for (let i = 0; i < BIRD_COUNT; i++) {
    const b = scene.add.image(
      Math.random() * W,
      50 + Math.random() * H * 0.28,
      'menu_bird_f1'
    ).setDepth(6).setScale(0.75 + Math.random() * 0.4).setAlpha(0.85);
    scene.birds.push({
      s: b,
      vx: 5 + Math.random() * 9,
      timer: Math.random() * 2,
      baseY: b.y
    });
  }

  // ── Rising embers (density respects the particle settings) ──────────
  const pm: number = Math.max(0.25, particleMultiplier());
  scene.add.particles(0, H + 10, 'pt_spark', {
    x: { min: 0, max: W },
    y: H + 10,
    lifespan: { min: 2200, max: 3800 },
    speedY: { min: -35, max: -95 },
    speedX: { min: -12, max: 12 },
    scale: { start: 0.7, end: 0 },
    alpha: { start: 0.55, end: 0 },
    quantity: 1,
    frequency: Math.round(90 / pm),
    tint: [0xffb45a, 0xff8c3a, 0xffd080]
  }).setDepth(7);

  // ── Fireflies / magical motes ─────────────────────────────────────────
  scene.add.particles(0, 0, 'pt_firefly', {
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

  // ── Atmospheric layers: midground travellers + foreground frame ──────
  const motion: boolean = !reducedMotion();

  // Walking animations for the menu figures (real player-sheet frames:
  // the wanderer IS the character you will play).
  if (!scene.anims.exists('wanderer_walk')) {
    scene.anims.create({ key: 'wanderer_walk', frames: [
      { key: 'player_char', frame: 'left_0' },
      { key: 'player_char', frame: 'left_1' },
      { key: 'player_char', frame: 'left_2' },
      { key: 'player_char', frame: 'left_1' }
    ], frameRate: 5, repeat: -1 });
    scene.anims.create({ key: 'wanderer_walk_back', frames: [
      { key: 'player_char', frame: 'up_0' },
      { key: 'player_char', frame: 'up_1' },
      { key: 'player_char', frame: 'up_2' },
      { key: 'player_char', frame: 'up_1' }
    ], frameRate: 5, repeat: -1 });
  }

  // Background travellers on the mid ridge (small, dark, slow).
  scene.hikers = [];
  for (let i: number = 0; i < HIKER_COUNT; i++) {
    const hiker: Phaser.GameObjects.Sprite = scene.add.sprite(
      W * (0.3 + i * 0.42),
      H * (0.735 - i * 0.02),
      'player_char', 'left_1'
    ).setScale(0.6).setAlpha(0.55).setTint(0x5a6c86).setDepth(6.5);
    scene.hikers.push({ s: hiker, vx: 6 + i * 3 });
    if (motion) hiker.play('wanderer_walk');
  }

  // The wanderer: crossing the near ridge toward the ruined castle —
  // a survivor pausing to look out over the fallen kingdom.
  const wanderer: Phaser.GameObjects.Sprite = scene.add.sprite(W * 0.16, H * 0.795, 'player_char', 'down_1')
    .setScale(1.25)
    .setTint(0x8fa3bd)
    .setDepth(12);
  scene.wanderer = { s: wanderer, pauseT: 2.5, vx: 9 };
  if (motion) wanderer.play('wanderer_walk_back');

  // Distant campfire glow in the ruins — someone survived down there.
  scene.add.image(W * 0.24, H * 0.735, 'proj_fireball')
    .setScale(3.2).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD)
    .setTint(0xff8c3a).setDepth(4.8);

  // Slow fog banks rolling across the valley floor.
  scene.fogBanks = [];
  for (let i: number = 0; i < FOG_BANK_COUNT; i++) {
    const fogBank: Phaser.GameObjects.Image = scene.add.image(
      Math.random() * W,
      H * (0.68 + Math.random() * 0.16),
      'menu_cloud'
    )
      .setScale(1.6 + Math.random() * 1.4)
      .setAlpha(0.05 + Math.random() * 0.07)
      .setTint(0x9fb8d8)
      .setDepth(15);
    scene.fogBanks.push({ s: fogBank, speed: 4 + Math.random() * 5 });
  }

  // Foreground treeline: near-black silhouettes framing the bottom edge,
  // swaying gently. Reads as depth: hills (far) → castle (mid) →
  // wanderer (near) → treeline (foreground).
  for (let i: number = 0; i < TREELINE_COUNT; i++) {
    const tx: number = (i / (TREELINE_COUNT - 1)) * W + (Math.random() - 0.5) * 70;
    const tree: Phaser.GameObjects.Image = scene.add.image(tx, H + 26, Math.random() < 0.6 ? 'tree_oak' : 'tree_pine')
      .setOrigin(0.5, 1)
      .setScale(1.5 + Math.random() * 1.1)
      .setTint(0x0d141c)
      .setAlpha(0.96)
      .setDepth(14);
    if (motion) {
      scene.tweens.add({
        targets: tree,
        angle: { from: -1.1, to: 1.1 },
        duration: 3400 + Math.random() * 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  }

  // ── Subtle parallax drift ────────────────────────────────────────────
  scene.tweens.add({
    targets: scene.far, x: W / 2 - 12, yoyo: true, repeat: -1, duration: 14000, ease: 'Sine.inOut'
  });
  scene.tweens.add({
    targets: scene.mid, x: W / 2 + 20, yoyo: true, repeat: -1, duration: 11000, ease: 'Sine.inOut'
  });
  scene.tweens.add({
    targets: scene.near, x: W / 2 - 16, yoyo: true, repeat: -1, duration: 9000, ease: 'Sine.inOut'
  });
  scene.tweens.add({
    targets: scene.castle, y: scene.castle.y - 4, yoyo: true, repeat: -1, duration: 7000, ease: 'Sine.inOut'
  });

  // gentle camera drift for living feel
  scene.cameras.main.setZoom(1.02);
  scene.tweens.add({
    targets: scene.cameras.main,
    scrollX: 8,
    scrollY: -4,
    yoyo: true,
    repeat: -1,
    duration: 16000,
    ease: 'Sine.inOut'
  });
}

/**
 * One frame of drift: the stars twinkle, the clouds and fog roll, the birds
 * flap, the travellers walk and the wanderer crosses the ridge, pausing now and
 * then to look out over the ruins.
 *
 * @param dt Seconds since the last frame, already clamped by the scene.
 */
export function updateMenuBackdrop(scene: MenuBackdropScene, time: number, dt: number): void {
  // twinkling stars
  scene.starGfx.clear();
  for (const s of scene.stars) {
    const a: number = s.baseA * (0.45 + 0.55 * Math.sin(time * 0.001 * s.speed + s.phase));
    scene.starGfx.fillStyle(0xffffff, a);
    scene.starGfx.fillCircle(s.x, s.y, s.r);
  }

  // clouds
  for (const c of scene.clouds) {
    c.s.x += c.speed * dt;
    c.bob += c.bobSpeed * dt;
    c.s.y += Math.sin(c.bob) * 0.15;
    if (c.s.x > scene.scale.width + 180) {
      c.s.x = -180;
      c.s.y = 30 + Math.random() * scene.scale.height * 0.32;
    }
  }

  // birds
  for (const b of scene.birds) {
    b.s.x += b.vx * dt;
    b.timer += dt;
    b.s.setTexture((Math.floor(b.timer * 2.2) % 2) ? 'menu_bird_f1' : 'menu_bird_f2');
    b.s.y = b.baseY + Math.sin(b.timer * 1.4) * 6;
    if (b.s.x > scene.scale.width + 50) {
      b.s.x = -50;
      b.baseY = 50 + Math.random() * scene.scale.height * 0.28;
      b.s.y = b.baseY;
    }
  }

  // fog banks drifting across the valley floor
  for (const f of scene.fogBanks) {
    f.s.x += f.speed * dt;
    if (f.s.x > scene.scale.width + 260) f.s.x = -260;
  }

  // background travellers on the mid ridge
  for (const h of scene.hikers) {
    h.s.x += h.vx * dt;
    if (h.s.x > scene.scale.width + 30) h.s.x = -30;
  }

  // the wanderer: walks the ridge, pauses to gaze at the castle, moves on
  const w = scene.wanderer;
  if (w) {
    if (w.pauseT > 0) {
      w.pauseT -= dt;
      if (w.pauseT <= 0) {
        w.vx = 8 + Math.random() * 4;
        w.s.play(reducedMotion() ? 'wanderer_walk' : (Math.random() < 0.5 ? 'wanderer_walk' : 'wanderer_walk_back'));
        w.s.setFlipX(Math.random() < 0.4);
      }
    } else {
      w.s.x += w.vx * dt;
      // small chance to stop and gaze at the ruins
      if (Math.random() < dt * 0.12) {
        w.pauseT = 1.8 + Math.random() * 2.4;
        w.s.stop();
        w.s.setFrame(w.s.flipX ? 'left_1' : 'down_1');
      }
      // wrap at the screen edges
      if (w.s.x > scene.scale.width + 30) { w.s.x = -30; w.pauseT = 1 + Math.random(); }
      if (w.s.x < -30) { w.s.x = scene.scale.width + 30; w.pauseT = 1 + Math.random(); }
    }
  }
}
