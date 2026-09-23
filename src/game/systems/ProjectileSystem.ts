// ─────────────────────────────────────────────────────────────────────────────
// ProjectileSystem — every bolt in flight: player arrows and magic bolts plus
// enemy return fire. Spawn, per-frame travel, collision and destroy.
//
// Extracted from WorldScene (Phase 4), same scene-context pattern as
// LootSystem / GatherSystem. The scene keeps thin delegates because entities
// call back into it: Player/Enemy/BossEnemy do `scene.spawnProjectile({...})`.
//
// Scene contract: scene.projectiles, scene.enemies, scene.player, scene.floats,
// scene.add, scene.tweens
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { WORLD_CONFIG } from '../core/Constants.ts';

/** Projectile tint per element (magic bolts). Falls back to arcane blue. */
export const ELEMENT_TINT: Record<string, number> = {
  fire: 0xff8a4a, ice: 0x9fdcff, lightning: 0xffe86b, poison: 0x9fe86b,
  shadow: 0xb48aff, holy: 0xfff3c9, arcane: 0x9fb4e8, physical: 0xffffff
};

/** Element that tints an unknown/absent one. */
const DEFAULT_TINT = 0x9fb4e8;

/** Trail after-image cadence (seconds) and lifetime (ms). */
const TRAIL_INTERVAL = 0.04;
const TRAIL_FADE_MS = 160;

/** One live projectile owned by the scene's projectile list. */
export interface Projectile {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  crit: number;
  pierce: number;
  traveled: number;
  maxDist: number;
  owner: 'player' | 'enemy';
  enemy?: any;
  element?: string | null;
  kind: string;
  _trailAcc?: number;
}

/** Minimal scene surface consumed by the projectile lifecycle. */
export type ProjectileScene = Phaser.Scene & {
  projectiles: Projectile[];
  enemies: any[];
  player: { sprite: any; takeDamage(dmg: number, x: number, y: number): void };
  floats: { add(x: number, y: number, text: string, color?: string, scale?: number): void };
};

/** Spawn options as sent by Player / Enemy / BossEnemy. */
export interface ProjectileSpawn {
  x: number;
  y: number;
  angle: number;
  speed: number;
  dmg: number;
  crit?: number;
  pierce?: number;
  maxDist: number;
  owner: 'player' | 'enemy';
  element?: string | null;
  kind?: string;
  /** Firing enemy, when the bolt came from one. */
  enemy?: any;
}

export function setupProjectiles(scene: ProjectileScene): void {
  scene.projectiles = [];
}

export function spawnProjectile(scene: ProjectileScene, o: ProjectileSpawn): Projectile {
  const tex: string = o.kind === 'fireball' ? 'proj_fireball' : o.kind === 'magic' ? 'fx_light' : 'proj_arrow';
  const img = scene.add.image(o.x, o.y, tex).setDepth(85).setRotation(o.angle);
  // Elemental identity: tint the bolt and add a colored trail so magic reads
  // as its element in flight (staff line, elemental bows).
  if (o.kind === 'magic') {
    img.setScale(0.34);
    img.setBlendMode(Phaser.BlendModes.ADD);
    try { img.setTint(ELEMENT_TINT[o.element as string] ?? DEFAULT_TINT); } catch { /* default tint */ }
  }
  const dirx: number = Math.cos(o.angle), diry: number = Math.sin(o.angle);
  const p: Projectile = {
    img, x: o.x, y: o.y, vx: dirx * o.speed, vy: diry * o.speed, dmg: o.dmg,
    crit: o.crit || 0, pierce: o.pierce || 0, traveled: 0, maxDist: o.maxDist,
    owner: o.owner, enemy: o.enemy, element: o.element || null, kind: o.kind || 'arrow'
  };
  scene.projectiles.push(p);
  return p;
}

export function updateProjectiles(scene: ProjectileScene, dt: number): void {
  for (const p of [...scene.projectiles]) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.traveled += Math.hypot(p.vx * dt, p.vy * dt);
    p.img.setPosition(p.x, p.y);
    // Arrow trail: fading after-images make fast projectiles readable.
    // Cheap: one small image every 40ms per projectile, auto-destroyed.
    // Skipped on low quality.
    try {
      const q: string = GameState.s?.settings?.graphicsQuality || 'med';
      p._trailAcc = (p._trailAcc || 0) + dt;
      if (q !== 'low' && p._trailAcc > TRAIL_INTERVAL) {
        p._trailAcc = 0;
        const ghost = scene.add.image(p.x, p.y, p.img.texture.key)
          .setDepth(p.img.depth - 1)
          .setRotation(p.img.rotation)
          .setScale(p.img.scaleX * 0.9)
          .setAlpha(0.35);
        scene.tweens.add({
          targets: ghost, alpha: 0, duration: TRAIL_FADE_MS,
          onComplete: () => { try { ghost.destroy(); } catch { /* gone */ } }
        });
      }
    } catch { /* cosmetic only */ }
    if (p.traveled > p.maxDist || Math.abs(p.x) > WORLD_CONFIG.worldHalfExtent || Math.abs(p.y) > WORLD_CONFIG.worldHalfExtent) {
      destroyProjectile(scene, p);
      continue;
    }
    // collide
    if (p.owner === 'player') {
      let hit = false;
      for (const e of scene.enemies) {
        if (e.dead) continue;
        if ((e.sprite.x - p.x) ** 2 + (e.sprite.y - p.y) ** 2 < (e.def.radius + 8) ** 2) {
          const crit: boolean = Math.random() < (p.crit || 0);
          // NOTE: takeDamage already floats the number — no second floater (was double).
          e.takeDamage(Math.round(p.dmg * (crit ? 1.8 : 1)), p.x, p.y, scene.floats, crit, p.element || undefined, null);
          hit = true;
          if (p.pierce > 0) { p.pierce--; p.dmg *= 0.85; continue; }
          break;
        }
      }
      if (hit) destroyProjectile(scene, p);
    } else if (p.owner === 'enemy') {
      const pl = scene.player;
      if (!pl.sprite) return;
      if ((pl.sprite.x - p.x) ** 2 + (pl.sprite.y - p.y) ** 2 < 13 * 13) {
        pl.takeDamage(p.dmg, p.x, p.y);
        destroyProjectile(scene, p);
      }
    }
  }
}

export function destroyProjectile(scene: ProjectileScene, p: Projectile): void {
  p.img.destroy();
  scene.projectiles = scene.projectiles.filter((q) => q !== p);
}
