// ─────────────────────────────────────────────────────────────────────────────
// chunkStreaming (extracted from WorldScene) — chunk streaming, texture
// baking, fog-refresh sweeps and ground relight.
//
// WorldScene stays the coordinator: it calls updateChunks()/relightChunks()
// per frame, and this module owns the ground-tile policy. See
// docs/STRUCTURE.md for the module map and where new behaviour belongs.
// ─────────────────────────────────────────────────────────────────────────────
import GameState from '../core/GameState.ts';
import { WORLD_CONFIG } from '../core/Constants.ts';
import { isGoldenAt, isNightAt } from '../core/Constants.ts';
import {
  getChunkCanvas, evictFarChunks, getFogBakeParams,
  isFogDirty, clearFogDirty, fogSnapshot,
} from '../world/chunkPainter.ts';

/** Structural scene surface consumed by chunk streaming. */
export interface ChunkStreamingScene {
  activeChunks: Map<string, { active?: boolean } & Record<string, any>>;
  pendingChunkQueue: Array<{ cx: number; cy: number; key: string }>;
  pendingChunkKeys: Set<string>;
  fogRefreshQueue: string[];
  fogRefreshKeys: Set<string>;
  lastPcx: number;
  lastPcy: number;
  _frame: number;
  _fogSweepSnapshot: string;
  player: { sprite: { x: number; y: number } };
  cameras: Phaser.Cameras.Scene2D.CameraManager;
  lastChunkRadius: number;
  groundLayer: { add(obj: unknown): void };
  textures: Phaser.Textures.TextureManager;
  add: Phaser.GameObjects.GameObjectFactory;
  populateChunk(cx: number, cy: number): void;
}

/**
 * Chunks needed around the player for the CURRENT view: half the viewport
 * diagonal in world px, converted to chunks, plus one chunk of margin. Zooming
 * out grows the ring; zooming in shrinks it instead of painting chunks nobody
 * can see. Clamped so a broken camera can never ask for the whole world.
 */
export function chunkRadiusForView(
  viewWidthPx: number,
  viewHeightPx: number,
  chunkPx: number,
  min = 2,
  max = 4
): number {
  if (!(viewWidthPx > 0) || !(viewHeightPx > 0) || !(chunkPx > 0)) return min;
  const halfDiagonal = Math.hypot(viewWidthPx, viewHeightPx) / 2;
  return Math.max(min, Math.min(max, Math.ceil(halfDiagonal / chunkPx) + 1));
}

/* ── Chunk streaming (spec §52) ─────────────────────────────────────── */
export function updateChunks(scene: ChunkStreamingScene): void {
  const cs = WORLD_CONFIG.chunkSize;
  const pcx: number = Math.floor(scene.player.sprite.x / cs);
  const pcy: number = Math.floor(scene.player.sprite.y / cs);
  // Radius follows the visible world (viewport ÷ zoom), not a fixed 7×7 ring:
  // at 1080p that is the same coverage as before, at 4K zoomed out it grows,
  // and a zoomed-in view stops paying for off-screen chunks.
  const cam = scene.cameras?.main;
  const zoom = cam?.zoom && cam.zoom > 0 ? cam.zoom : 1;
  const r = chunkRadiusForView((cam?.width ?? 0) / zoom, (cam?.height ?? 0) / zoom, cs);
  const radiusChanged = r !== scene.lastChunkRadius;
  scene.lastChunkRadius = r;
  // Paint only a small number of new chunks per frame. A walk across a
  // boundary must not synchronously rasterize the whole neighborhood.
  if (pcx !== scene.lastPcx || pcy !== scene.lastPcy || radiusChanged) {
    scene.lastPcx = pcx;
    scene.lastPcy = pcy;
    scheduleChunks(scene, pcx, pcy, r, cs);
    // Re-bake distance fog lazily as the camera crosses a chunk boundary.
    queueFogRefresh(scene);
  }
  // Prime the immediate view aggressively, then stream the remaining ring in
  // smaller batches. This removes the visible "flat loading tile" period at
  // world entry without rasterizing the entire 7x7 neighborhood in one frame.
  flushChunkQueue(scene, scene._frame < 3 ? 10 : 4, pcx, pcy, r, cs);
  // Fog sweep runs hot while dirty (bucket/storm flip) so ~49 chunks
  // refresh in ~8 frames instead of ~25, then drops back to a trickle.
  // Bounded by the active set — re-queues can't pile up beyond it.
  flushFogRefreshQueue(scene, isFogDirty() ? 6 : 2, pcx, pcy, cs);
  evictFarChunks(pcx, pcy, r);
}

export function scheduleChunks(scene: ChunkStreamingScene, pcx: number, pcy: number, r: number, cs: number): void {
  const wanted = new Set<string>();
  const px: number = scene.player.sprite.x;
  const py: number = scene.player.sprite.y;
  // Fog-of-war memory: remember visited chunks so the minimap can dim
  // the unknown (was tracked in state but never written).
  try {
    const seen = GameState.s?.world?.exploredChunks;
    if (Array.isArray(seen)) {
      const known = new Set(seen);
      for (let cy = pcy - r; cy <= pcy + r; cy++) {
        for (let cx = pcx - r; cx <= pcx + r; cx++) {
          const k: string = `${cx},${cy}`;
          if (!known.has(k)) { known.add(k); seen.push(k); }
        }
      }
      // Cap memory: drop oldest while far beyond any reasonable trek.
      if (seen.length > 3000) seen.splice(0, seen.length - 3000);
    }
  } catch { /* minimap memory never blocks streaming */ }
  for (let cy = pcy - r; cy <= pcy + r; cy++) {
    for (let cx = pcx - r; cx <= pcx + r; cx++) {
      const key: string = `${cx},${cy}`;
      wanted.add(key);
      if (!scene.activeChunks.has(key) && !scene.pendingChunkKeys.has(key)) {
        const cxCenter: number = cx * cs + cs / 2;
        const cyCenter: number = cy * cs + cs / 2;
        const img = scene.add.image(cxCenter, cyCenter, ensureChunkPlaceholder(scene))
          .setOrigin(0.5)
          // Child depth is local to the ground layer; the layer owns the
          // scene-level depth. Negative world Y therefore cannot make a
          // ground tile sort above/below an actor unexpectedly.
          .setDepth(0);
        img.setDisplaySize(cs, cs);
        scene.groundLayer.add(img);
        scene.activeChunks.set(key, img);
        scene.pendingChunkKeys.add(key);
        scene.pendingChunkQueue.push({ cx, cy, key });
      }
    }
  }
  // remove far chunks & evict painter cache
  for (const [key, img] of [...scene.activeChunks]) {
    const parts: number[] = key.split(',').map(Number);
    const x: number = parts[0] ?? 0;
    const y: number = parts[1] ?? 0;
    if (Math.abs(x - pcx) > r + 1 || Math.abs(y - pcy) > r + 1) {
      (img as { destroy(): void }).destroy();
      removeChunkTexture(scene, key);
      scene.activeChunks.delete(key);
    }
  }
  scene.pendingChunkQueue = scene.pendingChunkQueue.filter(({ cx, cy, key }) => {
    const keep = Math.abs(cx - pcx) <= r + 1 && Math.abs(cy - pcy) <= r + 1;
    if (!keep) scene.pendingChunkKeys.delete(key);
    return keep;
  });
  // Nearest chunks complete first, so the ground around the player is ready
  // before distant scenery while the rest of the view streams in.
  scene.pendingChunkQueue.sort((a, b) =>
    (a.cx - pcx) ** 2 + (a.cy - pcy) ** 2 - ((b.cx - pcx) ** 2 + (b.cy - pcy) ** 2));
}

export function ensureChunkPlaceholder(scene: ChunkStreamingScene): string {
  const key = '__chunk_loading_ground';
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, 16, 16);
    const ctx = texture!.getContext();
    ctx.fillStyle = '#718b4b';
    ctx.fillRect(0, 0, 16, 16);
    texture!.refresh();
  }
  return key;
}

export function flushChunkQueue(scene: ChunkStreamingScene, max: number, pcx: number, pcy: number, r: number, cs: number): void {
  while (max-- > 0 && scene.pendingChunkQueue.length) {
    const job = scene.pendingChunkQueue.shift()!;
    scene.pendingChunkKeys.delete(job.key);
    if (Math.abs(job.cx - pcx) > r + 1 || Math.abs(job.cy - pcy) > r + 1) continue;
    const img = scene.activeChunks.get(job.key);
    if (!img?.active) continue;
    const px = scene.player.sprite.x;
    const py = scene.player.sprite.y;
    const cxCenter = job.cx * cs + cs / 2;
    const cyCenter = job.cy * cs + cs / 2;
    const canvas = getChunkCanvas(job.cx, job.cy);
    const texKey = `chunk_${job.cx}_${job.cy}`;
    bakeChunkTexture(scene, texKey, canvas, cxCenter - px, cyCenter - py, cs);
    const tile = img as unknown as { setTexture(key: string): void; setDisplaySize(w: number, h: number): void };
    tile.setTexture(texKey);
    // Re-apply the world size AFTER the swap. The image was created on the 16px
    // loading placeholder, so its scale came from that frame — and `setTexture`
    // keeps the transform. Without this line the chunk's texels are spread over
    // (cs/16)² of world: caught live at displayWidth 32768 instead of 512, i.e.
    // a ground sampled at 0.03 texels per device pixel (one texel per 24 screen
    // px) — the soft, washed-out terrain. Size belongs to the tile, not to
    // whichever loading texture happened to be on it.
    tile.setDisplaySize(cs, cs);
    scene.populateChunk(job.cx, job.cy);
  }
}

export function bakeChunkTexture(scene: ChunkStreamingScene, texKey: string, canvas: HTMLCanvasElement, dx: number, dy: number, cs: number): void {
  // The source canvas is painted at the profile's art scale (chunkPainter), so
  // the GPU texture holds that many texels while the tile still displays at
  // `cs` world px (the image's setDisplaySize) — sharper ground, same world.
  const txW: number = canvas.width || cs;
  const txH: number = canvas.height || cs;
  let texture = scene.textures.get(texKey) as Phaser.Textures.CanvasTexture | null;
  if (!texture || !scene.textures.exists(texKey) || texture.width !== txW || texture.height !== txH) {
    if (texture && scene.textures.exists(texKey)) scene.textures.remove(texKey);
    texture = scene.textures.createCanvas(texKey, txW, txH) as Phaser.Textures.CanvasTexture;
  }
  const ctx = texture.getContext();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, txW, txH);
  ctx.drawImage(canvas, 0, 0);
  const fog = getFogBakeParams(dx, dy, cs);
  if (fog.alpha > 0) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = fog.alpha;
    ctx.fillStyle = fog.color;
    ctx.fillRect(0, 0, txW, txH);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  texture.refresh();
}

export function flushFogRefreshQueue(scene: ChunkStreamingScene, max: number, _pcx: number, _pcy: number, cs: number): void {
  void _pcx; void _pcy;
  if (isFogDirty()) {
    // A second flip landing mid-sweep would otherwise leave early-baked
    // chunks on the previous tint — restart the sweep on snapshot change.
    if (fogSnapshot() !== scene._fogSweepSnapshot) {
      scene._fogSweepSnapshot = fogSnapshot();
      scene.fogRefreshQueue.length = 0;
      scene.fogRefreshKeys.clear();
    }
    queueFogRefresh(scene);
  }
  while (max-- > 0 && scene.fogRefreshQueue.length) {
    const key = scene.fogRefreshQueue.shift()!;
    scene.fogRefreshKeys.delete(key);
    const img = scene.activeChunks.get(key);
    if (!img?.active) continue;
    const parts = key.split(',').map(Number);
    const cx = parts[0];
    const cy = parts[1];
    if (cx === undefined || cy === undefined || !Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    const canvas = getChunkCanvas(cx, cy);
    const px = scene.player.sprite.x;
    const py = scene.player.sprite.y;
    bakeChunkTexture(scene, `chunk_${cx}_${cy}`, canvas, cx * cs + cs / 2 - px, cy * cs + cs / 2 - py, cs);
  }
  if (scene.fogRefreshQueue.length === 0) clearFogDirty();
}

export function queueFogRefresh(scene: ChunkStreamingScene): void {
  // Skip redundant re-queues: if every active chunk is already queued,
  // a repeat flip adds nothing — the sweep in flight covers it.
  if (scene.fogRefreshKeys.size >= scene.activeChunks.size && scene.activeChunks.size > 0) return;
  for (const key of scene.activeChunks.keys()) {
    if (!scene.fogRefreshKeys.has(key)) {
      scene.fogRefreshKeys.add(key);
      scene.fogRefreshQueue.push(key);
    }
  }
}

export function removeChunkTexture(scene: ChunkStreamingScene, chunkKey: string): void {
  const texKey = `chunk_${chunkKey.replace(',', '_')}`;
  if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
  scene.fogRefreshKeys.delete(chunkKey);
  scene.fogRefreshQueue = scene.fogRefreshQueue.filter((key) => key !== chunkKey);
}

/**
 * Phase B: real ground relight. Tints active chunk images toward a cool
 * night blue (or warm dawn/dusk) instead of relying only on the dark
 * overlay — the ground itself now participates in day/night.
 */
export function relightChunks(scene: ChunkStreamingScene): void {
  const t = GameState.s.world.timeOfDay;
  const isNight: boolean = isNightAt(t);
  const golden: boolean = isGoldenAt(t);
  for (const img of scene.activeChunks.values()) {
    const im = img as unknown as { scene?: unknown; setTint(c: number): void; clearTint(): void } | null;
    if (!im || !im.scene) continue;
    if (isNight) im.setTint(0x8a94c0);
    else if (golden) im.setTint(0xffe2b8);
    else im.clearTint();
  }
}
