// ─────────────────────────────────────────────────────────────────────────────
// EntityFactory — single construction point for world entities (Phase 6a).
//
// SpawnDirector.spawnEnemy/spawnNode delegate here, and WorldScene.spawn*
// delegates through SpawnDirector, so enemy / resource-node / item
// construction logic lives in exactly one place.
//
// Scene-context pattern (same as SpawnDirector/LootSystem): functions take
// the scene as an argument and stay Phaser-free. Entity classes are INJECTED
// via configureEntities() — entities/ pull in Phaser, which must never leak
// into systems/ (node tests inject stubs). Never import entities/ or phaser
// here.
//
// Node uid note (§5 validation): uids (`n<seq>`) are session-local Map keys
// only. Nodes are (re)built per chunk activation and persistence/depletion
// keys off `stateKey` (poiStates[`node_x,y`], read in createResource and
// written in WorldScene.breakNode/gatherTick) — never off uid. So the
// sequence can never collide harmfully with stored data or any legacy
// `w`-prefix scheme: even a duplicate uid would only replace a transient
// Map entry, never corrupt a save.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { getEnemyDef } from '../data/enemies.ts';
import { getNodeDef } from '../world/nodeTypes.ts';
import type { NodeTypeDef } from '../world/nodeTypes.ts';
import { getNpcDef } from '../data/npcs.ts';
import { getItem } from '../data/items.ts';
import type { ItemDef } from '../data/itemDefs.ts';
import { addItem } from './InventorySystem.ts';
import type { InventoryEntry } from '../core/stateFactory.ts';
import type { GatherNode } from './GatherSystem.ts';

/** Structural surface of an instantiated enemy (real class or test stub). */
export interface EnemyEntity {
  dead?: boolean;
  key?: string;
  hp?: number;
  maxHp?: number;
  sprite?: { x: number; y: number };
}

/** Constructor shape for injected enemy classes. */
export type EnemyCtor = new (scene: Phaser.Scene, key: string, x: number, y: number) => EnemyEntity;

/** Entity constructors wired once from WorldScene.create() / tests. */
export interface SpawningClasses {
  Enemy?: unknown;
  BossEnemy?: unknown;
}

/** Persisted depletion record for one node (world.poiStates[stateKey]). */
interface NodeState {
  depletedAt?: number;
  regrowIn?: number;
  regrowAt?: number;
  [key: string]: unknown;
}

/** Minimal scene surface consumed by resource-node construction. */
export type ResourceScene = Phaser.Scene & { nodes: Map<string, GatherNode> };

/** Minimal scene surface consumed by enemy construction. */
export type EnemyScene = Phaser.Scene & { enemies: EnemyEntity[] };

/** Living NPC record (sprite + wander-AI state). */
export interface NpcRecord {
  key: string;
  def: unknown;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  wanderRadius: number;
  aiState: string;
  aiDir: string;
  aiTimer: number;
  aiWalkFrame: number;
  aiWalkAccum: number;
  aiTargetX: number;
  aiTargetY: number;
  /**
   * Walk speed override (px/s). Village NPCs use the default 28; a traveling
   * pedlar set by the world-event layer covers ground instead of pottering.
   */
  walkSpeed?: number;
}

/** Minimal scene surface consumed by NPC construction. */
export type NpcScene = Phaser.Scene & { npcs: NpcRecord[] };

let EnemyClass: EnemyCtor | null = null;
let BossEnemyClass: EnemyCtor | null = null;
let nodeUidSeq = 1;

/** Wire entity constructors (call once from WorldScene.create()). */
export function configureEntities({ Enemy, BossEnemy }: SpawningClasses): void {
  if (Enemy) EnemyClass = Enemy as EnemyCtor;
  if (BossEnemy) BossEnemyClass = BossEnemy as EnemyCtor;
}

/** Spawn an enemy (boss keys get the BossEnemy class). */
export function createEnemy(scene: EnemyScene, key: string, x: number, y: number): EnemyEntity | null {
  const def = getEnemyDef(key);
  if (!def) return null;
  if (!EnemyClass || !BossEnemyClass) {
    throw new Error('[spawn] entity classes not configured — call configureEntities() at scene create');
  }
  // boss uses dedicated class
  const e: EnemyEntity = def.boss ? new BossEnemyClass(scene, key, x, y) : new EnemyClass(scene, key, x, y);
  if (e.dead) return null;
  scene.enemies.push(e);
  return e;
}

/** Create one gather-node entity (sprite + state + wind sway). */
export function createResource(scene: ResourceScene, type: string, x: number, y: number, stateKey: string, state?: unknown): GatherNode | null {
  const def: NodeTypeDef | null = getNodeDef(type);
  if (!def) return null;
  const prior = (state ?? null) as NodeState | null;
  const depleted = !!(prior?.depletedAt && prior.regrowIn && prior.regrowIn > GameState.s.meta.playSeconds);
  // Y-sort nodes like every other entity (fixed depth made trees pop
  // through the player).
  const img = scene.add.image(x, y, depleted ? (def.emptyTex || def.tex) : def.tex).setDepth(Math.round(y));
  if (def.tint) img.setTint(def.tint);
  if (def.solid) img.setName('solid-' + def.solid);
  // Deterministic per-node variety — same tree/rock reads differently by
  // position (scale/occasional mirror) without breaking reproducible saves.
  const hx = Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77);
  const r1 = ((Math.imul(hx, 0x27d4eb2d) >>> 0) % 1000) / 1000;
  const r2 = ((Math.imul(hx ^ 0xa11, 0x2545f491) >>> 0) % 1000) / 1000;
  if (/oak|pine|birch|dead_tree|cactus/.test(type)) {
    if (typeof img.setScale === 'function') img.setScale(0.82 + r1 * 0.4);
    if (typeof img.setFlipX === 'function' && r2 > 0.74) img.setFlipX(true);
  } else if (/rock|ore|crystal|moonstone/.test(type)) {
    if (typeof img.setScale === 'function') img.setScale(0.82 + r1 * 0.34);
    if (typeof img.setFlipX === 'function' && r2 > 0.88) img.setFlipX(true);
  }
  const solidHp: number = def.solid ? (Array.isArray(def.solid) ? def.solid[0] : def.solid) : 1;
  const node: GatherNode = {
    uid: `n${nodeUidSeq++}`, type, x, y, def, img, stateKey,
    hp: solidHp,
    maxHp: solidHp,
    depleted: !!depleted,
    regrowAt: prior?.regrowAt || 0,
    ticks: 0
  };
  scene.nodes.set(node.uid, node);
  // Wind sway on every 3rd tree (deterministic) — subtle ±1.5° rotation so
  // forests feel alive without hundreds of heavy tweens.
  if (/tree|pine|oak|palm|cactus/i.test(`${type} ${def.tex || ''}`) && (Math.round(x + y) % 3 === 0)) {
    try {
      scene.tweens.add({
        targets: img, angle: 1.5, duration: 2200 + (Math.abs(Math.round(x)) % 900),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } catch { /* tween manager may be unavailable in tests */ }
  }
  return node;
}

/** Stackable add result (inventory is mutated; `left` is the overflow). */
export interface StackAddResult {
  id: string;
  qty: number;
  added: number;
  left: number;
}

/** Instanced (gear) add result with the appended inventory entries. */
export interface InstanceAddResult extends StackAddResult {
  entries: InventoryEntry[];
}

/** Return shape of createItem: null for unknown ids, see JSDoc below. */
export type CreatedItem = StackAddResult | InstanceAddResult | InventoryEntry | InventoryEntry[] | null;

/**
 * Create item(s) for the player inventory (headless: no scene needed).
 *
 * Uses addItem semantics from InventorySystem: stackables merge by id,
 * gear creates unique iid instances. Unknown ids → null (addItem would
 * silently no-op with `left === qty`, so check the def first).
 *
 * @returns null for unknown ids; otherwise the created shape (inventory is
 * mutated): stackables → `{ id, qty, added, left }`; a single gear piece →
 * its new instance (`{ iid, … }`); multi-qty gear → array of new instances.
 */
export function createItem(id: string, qty = 1): CreatedItem {
  const def: ItemDef | null = getItem(id);
  if (!def) return null;
  const n = Math.max(1, Math.floor(qty));
  const left = addItem(id, n);
  const added = n - left;
  const instanced = !!(def.durability || def.weapon || def.slot);
  if (!instanced) return { id, qty: added, added, left };
  if (added <= 0) return { id, qty: 0, added: 0, left, entries: [] };
  // Gear appends one entry per unit at the tail — slice off exactly those.
  const inv = GameState.s.inventory;
  const entries = inv.slice(inv.length - added);
  return added === 1 ? (entries[0] ?? null) : entries;
}

/**
 * Spawn a living NPC (sprite + shadow + wander-AI state + interact wiring).
 *
 * @param scene  Phaser scene (needs add/image/tweens-free, npcs[]).
 * @param key  NPC def id (getNpcDef).
 * @param x  World X. @param y  World Y.
 * @param onInteract  Called on pointerdown (scene dialogue).
 * @returns The npc record, pushed to scene.npcs. Unknown key → null.
 */
export function createNpc(scene: NpcScene, key: string, x: number, y: number, onInteract?: (npc: NpcRecord) => void): NpcRecord | null {
  const npcDef = getNpcDef(key);
  if (!npcDef) return null;
  const tex: string = key === 'torvald' ? 'npc_merchant' : 'npc_generic';
  const s = scene.add.image(x, y, tex, 'down_1').setDepth(6);
  const sh = scene.add.image(x, y + 3, 'fx_shadow').setDepth(5).setAlpha(0.5).setBlendMode('MULTIPLY');
  s.setInteractive({ useHandCursor: true });
  const npc: NpcRecord = {
    key, def: npcDef, sprite: s, shadow: sh, x, y,
    // Wander AI state
    homeX: x, homeY: y,
    wanderRadius: 60 + Math.random() * 40,
    aiState: 'idle',    // idle | walking | pausing
    aiDir: 'down',
    aiTimer: 2 + Math.random() * 4,  // seconds until next state change
    aiWalkFrame: 0,
    aiWalkAccum: 0,
    aiTargetX: x,
    aiTargetY: y,
  };
  s.on('pointerdown', () => {
    // Stop wandering briefly when player interacts
    npc.aiState = 'idle';
    npc.aiTimer = 3;
    npc.sprite.setFrame(`${npc.aiDir}_1`);
    try { onInteract?.(npc); } catch { /* dialogue never breaks the world */ }
  });
  scene.npcs.push(npc);
  return npc;
}
