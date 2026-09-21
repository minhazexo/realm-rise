// ─────────────────────────────────────────────────────────────────────────────
// SpawnDirector — deterministic population of chunks, nodes, and enemies.
//
// Extracted from WorldScene (Phase 3). Scene-context functions; the world
// seed + hash math keep layouts identical for a given seed.
//
// Entity classes are INJECTED (configureSpawning) rather than imported:
// entities pull in Phaser, which must never leak into systems/ (node tests
// import this module). WorldScene wires the real classes once at create();
// tests inject stubs.
//
// Phase 6a: actual construction moved to systems/EntityFactory.js —
// spawnEnemy/spawnNode below are thin delegates (no duplicated logic).
// configureSpawning forwards to configureEntities for backward compat.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { WORLD_CONFIG } from '../core/Constants.ts';
import { biomeAt, isWaterAt } from '../world/worldGen.ts';
import { rollNodeType, rollEnemyKey } from '../world/nodeTypes.ts';
import { BIOMES } from '../world/biomeTable.ts';
import { configureEntities, createEnemy, createResource } from './EntityFactory.ts';
import type { ResourceScene, EnemyScene } from './EntityFactory.ts';

/** Entity constructors wired once from WorldScene.create(). */
export interface SpawningClasses {
  Enemy?: unknown;
  BossEnemy?: unknown;
}

/** Wire entity constructors (call once from WorldScene.create()). */
export function configureSpawning({ Enemy, BossEnemy }: SpawningClasses): void {
  configureEntities({ Enemy, BossEnemy });
}

/** Deterministic 0..1 hash (chunk coords → stable random). */
export function chunkHash(x: number, y: number): number {
  let h: number = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Deterministically populate a chunk with gather nodes + enemies. */
export function populateChunk(scene: Phaser.Scene, cx: number, cy: number): void {
  const cs: number = WORLD_CONFIG.chunkSize;
  const oX: number = cx * cs;
  const oY: number = cy * cs;
  const hash = chunkHash;
  const biomeId: string = biomeAt(oX + cs / 2, oY + cs / 2);
  const density: number = (BIOMES[biomeId]?.decoDensity || 0.2) * 22;

  // nodes
  for (let i = 0; i < density + 6; i++) {
    const nx: number = oX + hash(cx * 7 + i * 13, cy * 3 + i * 7) * cs;
    const ny: number = oY + hash(cx * 11 + i * 29, cy * 17 + i * 5) * cs;
    if (nx * nx + ny * ny > WORLD_CONFIG.worldHalfExtent ** 2) continue;
    if (isWaterAt(nx, ny)) continue; // no trees in lakes
    const type: string | null = rollNodeType(biomeId, hash(cx * 31 + i, cy * 41 + i));
    if (!type) continue;
    // persist depletion via poiStates-by-hash key
    const stateKey = `node_${Math.round(nx)},${Math.round(ny)}`;
    const st = GameState.s.world.poiStates[stateKey];
    spawnNode(scene, type, nx, ny, stateKey, st);
  }

  // enemies — fewer near spawn AND never inside the settlement safe
  // zone (700px around the Town Hall; raids bypass this via explicit,
  // announced raid parties).
  const enemyR: number = hash(cx * 5, cy * 13);
  const distFromSpawn: number = Math.hypot(oX - 0, oY - 260);
  const home: { x: number; y: number } | null | undefined = GameState.s.settlement?.pos;
  const distFromHome: number = home ? Math.hypot(oX + cs / 2 - home.x, oY + cs / 2 - home.y) : Infinity;
  if (enemyR < 0.12 && distFromSpawn > 900 && distFromHome > 700) {
    const key: string | null = rollEnemy(biomeId, hash(cx * 13 + 3, cy * 5 + 9));
    if (key && !isWaterAt(oX + cs / 2, oY + cs / 2)) {
      // Prey spawns as a small herd (deer are social; lone deer read as bugs).
      if (key === 'deer') {
        const herd: number = 2 + Math.floor(hash(cx * 3, cy * 9) * 3); // 2–4
        for (let i = 0; i < herd; i++) {
          const hx: number = oX + cs / 2 + (hash(cx + i, cy) - 0.5) * 160;
          const hy: number = oY + cs / 2 + (hash(cx, cy + i) - 0.5) * 160;
          if (!isWaterAt(hx, hy)) spawnEnemy(scene, key, hx, hy);
        }
      } else {
        spawnEnemy(scene, key, oX + cs / 2, oY + cs / 2);
      }
    }
  }
}

/** Create one gather-node entity — delegates to EntityFactory. */
export function spawnNode(scene: Phaser.Scene, type: string, x: number, y: number, stateKey: string, state: unknown): unknown {
  // Scene contract: callers pass the live WorldScene (has nodes/enemies) —
  // see EntityFactory's ResourceScene / EnemyScene.
  return createResource(scene as ResourceScene, type, x, y, stateKey, state);
}

/**
 * Weighted enemy roll for a biome. Delegates to the shared rollEnemyKey
 * (single source for the weighted-walk algorithm).
 */
export function rollEnemy(biomeId: string, rnd: number): string | null {
  return rollEnemyKey(biomeId, rnd);
}

/** Spawn an enemy — delegates to EntityFactory. */
export function spawnEnemy(scene: Phaser.Scene, key: string, x: number, y: number): unknown {
  return createEnemy(scene as EnemyScene, key, x, y);
}
