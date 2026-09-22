// ─────────────────────────────────────────────────────────────────────────────
// RegionState — the per-scene runtime of the authored regions, the scene
// surface the region systems are allowed to touch, and the two progress
// helpers. This is the only module that creates the runtime object.
//
// Each field is listed under the module that owns it; everything else reads it
// through `regionState(scene)`. Progress that must survive a save does NOT live
// here — cleared fights and looted caches ride the saved `world.poiStates` map,
// story beats ride `story.flags`.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';

/** Near-camera foliage the foreground band fades when the hero walks behind it. */
export interface ForegroundProp {
  img: Phaser.GameObjects.Image;
  /** Half-extents of the drawn prop, so the fade tests a real overlap. */
  hw: number;
  hh: number;
  base: number;
}

export interface RegionRuntime {
  /** RegionSystem — streaming: which areas are built, and their collision. */
  placed: Set<string>;
  solids: Phaser.Physics.Arcade.StaticGroup | null;
  /** RegionSystem — per-area ambience emitters, one live at a time. */
  emitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter>;
  currentArea: string;
  /** RegionSystem — the region's slow clock (0.5s: hazards, arena aftermath). */
  slowT: number;
  /** RegionForeground — the near-camera band. */
  foreground: ForegroundProp[];
  /** RegionInteractables — what is placed, and crystal-puzzle progress. */
  interactPlaced: Set<string>;
  puzzle: string[];
  /** RegionEncounters — spawned members per encounter, and which camps alarmed. */
  members: Map<string, any[]>;
  alarmed: Set<string>;
  /** RegionArena — whether the arena's boss has been seen alive. */
  bossSeen: boolean;
}

/**
 * The part of WorldScene the region systems use. Declared once so the optional
 * calls are explicit instead of `scene as any` at every call site; enemies stay
 * loosely typed because the region only tunes fields on them.
 */
export interface RegionHost {
  player?: { sprite: Phaser.GameObjects.Sprite; takeDamage?(dmg: number, x: number, y: number): void } | null;
  enemies?: any[];
  floats?: { add(x: number, y: number, text: string, style?: string, scale?: number): void };
  spawnNpc?(key: string, x: number, y: number): unknown;
  spawnChest?(x: number, y: number, tier: string, campId?: string): void;
  togglePanel?(name: string): void;
}

export type RegionScene = Phaser.Scene & RegionHost & { _regions?: RegionRuntime };

export function regionState(scene: RegionScene): RegionRuntime {
  if (!scene._regions) {
    scene._regions = {
      placed: new Set(), solids: null, emitters: new Map(), currentArea: '', slowT: 0,
      foreground: [], interactPlaced: new Set(), puzzle: [], members: new Map(),
      alarmed: new Set(), bossSeen: false,
    };
  }
  return scene._regions;
}

/** Has this authored fight / cache already been consumed in this save? */
export function regionFlag(id: string): boolean {
  return !!GameState.s.world.poiStates[id]?.looted;
}

export function setRegionFlag(id: string): void {
  const S = GameState.s;
  S.world.poiStates[id] = { ...(S.world.poiStates[id] || {}), looted: true };
}

/** Set a story flag AND fire the quest event, so 'flag' steps progress. */
export function setStoryFlag(flag: string): void {
  GameState.s.story.flags[flag] = true;
  import('./QuestEngine.ts').then((q: any) => q.handleEvent({ type: 'flagset', flag })).catch(() => {});
}
