// ─────────────────────────────────────────────────────────────────────────────
// MenuScene — the title screen's lifecycle. The animated world it shows lives
// in ./menuBackdrop.ts (sky, stars, moon, hills, castle, fog, weather, the
// wanderer, the treeline); the React title, menu buttons and settings sit on
// top of this canvas.
//
// This scene therefore owns exactly: the backdrop's textures, the backdrop
// itself, the menu music, and the session's 'menu' screen state.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { CH } from '../core/EventBus.ts';
import {
  buildMenuTextures, buildMenuBackdrop, updateMenuBackdrop,
  type Star, type CloudEntry, type BirdEntry, type Wanderer, type HikerEntry
} from './menuBackdrop.ts';

export default class MenuScene extends Phaser.Scene {
  starGfx!: Phaser.GameObjects.Graphics;
  stars: Star[] = [];
  far!: Phaser.GameObjects.Image;
  mid!: Phaser.GameObjects.Image;
  near!: Phaser.GameObjects.Image;
  castle!: Phaser.GameObjects.Image;
  clouds: CloudEntry[] = [];
  birds: BirdEntry[] = [];
  wanderer: Wanderer | null = null;
  hikers: HikerEntry[] = [];
  fogBanks: { s: Phaser.GameObjects.Image; speed: number }[] = [];

  constructor() {
    super('MenuScene');
  }

  create(): void {
    // Textures first: the menu boots before the world, so it must be able to
    // draw everything it needs (see buildMenuTextures).
    buildMenuTextures(this);
    buildMenuBackdrop(this);

    // Title handled by React; start ambient menu music.
    import('../systems/AudioSystem.ts').then((a) => a.setMenuMood());
    GameState.session.screen = 'menu';
    GameState.notify(CH.SCREEN);
  }

  override update(time: number, delta: number): void {
    updateMenuBackdrop(this, time, Math.min(delta, 50) / 1000);
  }
}
