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
import GameState from '../../core/GameState.ts';
import { WORLD_CONFIG } from '../../core/Constants.ts';
import { biomeAt, isWaterAt } from '../../world/worldGen.ts';
import { rollNodeType, rollEnemyKey } from '../../world/nodeTypes.ts';
import { BIOMES } from '../../world/biomeTable.ts';
import { configureEntities, createEnemy, createResource } from '../combat/EntityFactory.ts';
import type { ResourceScene, EnemyScene } from '../combat/EntityFactory.ts';
import { getEnemyDef } from '../../data/enemies.ts';
import { isNightAt } from '../environment/EnvSystem.ts';
import { ELITE_FOR_BASE } from '../../data/elites.ts';
import { inLandmarkClearing, inRegionSafeZone } from './RegionRegistry.ts';

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

  // Cluster centers: 2 deterministic grove anchors per chunk so trees/rocks
  // read as natural stands instead of uniform scatter. All math reuses the
  // existing chunkHash — no new imports, fully seed-stable.
  const centers = [
    { x: oX + hash(cx * 17 + 1, cy * 23 + 3) * cs, y: oY + hash(cx * 19 + 5, cy * 29 + 7) * cs },
    { x: oX + hash(cx * 31 + 11, cy * 37 + 13) * cs, y: oY + hash(cx * 41 + 17, cy * 43 + 19) * cs },
  ];

  // nodes
  for (let i = 0; i < density + 6; i++) {
    const ux: number = oX + hash(cx * 7 + i * 13, cy * 3 + i * 7) * cs;
    const uy: number = oY + hash(cx * 11 + i * 29, cy * 17 + i * 5) * cs;
    const d0 = (ux - centers[0]!.x) ** 2 + (uy - centers[0]!.y) ** 2;
    const d1 = (ux - centers[1]!.x) ** 2 + (uy - centers[1]!.y) ** 2;
    const center = d0 <= d1 ? centers[0]! : centers[1]!;
    // ~60% of nodes hug the nearest grove (±90px deterministic jitter),
    // the rest stay uniform so clearings and lone landmarks survive.
    const clustered: boolean = hash(cx * 47 + i * 53, cy * 59 + i * 61) < 0.6;
    let nx: number = clustered
      ? center.x + (hash(cx * 67 + i * 71, cy * 73 + i * 79) - 0.5) * 180
      : ux;
    let ny: number = clustered
      ? center.y + (hash(cx * 83 + i * 89, cy * 97 + i * 101) - 0.5) * 180
      : uy;
    // Clamp jittered candidates back inside this chunk so neighboring
    // chunks never double-spawn the same ground.
    nx = Math.max(oX + 4, Math.min(oX + cs - 4, nx));
    ny = Math.max(oY + 4, Math.min(oY + cs - 4, ny));
    if (nx * nx + ny * ny > WORLD_CONFIG.worldHalfExtent ** 2) continue;
    if (isWaterAt(nx, ny)) continue; // no trees in lakes
    // Authored landmark ground stays clear so tents, fires and lore props are
    // actually visible instead of buried under procedural forest.
    if (inLandmarkClearing(nx, ny)) continue;
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
    // Authored safe hubs (the Ashen Frontier's village, map brief §5): no
    // spawns inside them, authored or procedural.
    if (key && !isWaterAt(oX + cs / 2, oY + cs / 2) && !inRegionSafeZone(oX + cs / 2, oY + cs / 2)) {
      // Prey spawns as a small herd (deer are social; lone deer read as bugs).
      if (key === 'deer') {
        const herd: number = 2 + Math.floor(hash(cx * 3, cy * 9) * 3); // 2–4
        for (let i = 0; i < herd; i++) {
          const hx: number = oX + cs / 2 + (hash(cx + i, cy) - 0.5) * 160;
          const hy: number = oY + cs / 2 + (hash(cx, cy + i) - 0.5) * 160;
          if (!isWaterAt(hx, hy) && !inRegionSafeZone(hx, hy)) spawnEnemy(scene, key, hx, hy);
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

/** Spawn an enemy — delegates to EntityFactory, with a small chance the
 *  common enemy is promoted to its named elite variant (vertical slice §7).
 *  Promotion is rarer by day, more likely in dangerous biomes and at night. */
export function spawnEnemy(scene: Phaser.Scene, key: string, x: number, y: number): unknown {
  let spawnKey: string = key;
  const eliteKey: string | undefined = ELITE_FOR_BASE[key];
  if (eliteKey) {
    const base = getEnemyDef(key);
    if (base && !base.boss && !base.prey) {
      const t: number = GameState.s.world.timeOfDay;
      const night: boolean = isNightAt(t);
      let dm: number = 1;
      try { dm = BIOMES[biomeAt(x, y)]?.dangerMult || 1; } catch { /* origin chunk */ }
      if (Math.random() < 0.03 * dm + (night ? 0.025 : 0)) spawnKey = eliteKey;
    }
  }
  return createEnemy(scene as EnemyScene, spawnKey, x, y);
}
