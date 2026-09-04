# Graphics Upgrade — Ground View & Terrain Rendering

> Deep-dive findings from `src/game/world/chunkPainter.js`, `biomeTable.js`, `worldGen.js`, `EnvSystem.js`, `DynamicLights.js`, `PostFXSystem.js`, `WaterSystem.js`.
> Research: Phaser 4.2 Mesh2D/stencil lights, chunk-streaming map-gen patterns, parallax best practices.

## 1. How ground works today

- Chunk = 512px (`tileSize 32 × chunkTiles 16`), 7×7 = 49 live `Phaser.Image`s at `depth 0`, streamed on chunk-boundary crossing (`WorldScene.updateChunks`).
- `getChunkCanvas(cx,cy)` paints once to an offscreen canvas, copies into `textures.createCanvas(texKey)`. LRU 140. Deterministic hash `rand(a,b)`, NOT `Math.random()`.
- Pipeline: (1) radial gradient `grass → grassDark`, (2) 48px moisture blotches, (3) ~56–100 1–3px speckles + blades + 15 pebbles, (4) ember/snow accents, (5) 8px-grid water blobs.
- One biome per chunk (sampled at center). No blending → hard seams + checkerboard vignette.
- Fog is **baked destructively** (`applyFogToChunk` multiply) + `cache.clear()` on every time/weather bucket change → full rebake hitch.
- Lighting is overlay-only (`darkLayer`, `gradeLayer`, `skyGlow`, vignette). Ground canvases are never relit. `DynamicLights` = ADD sprites, no flicker/occlusion. `PostFX` = vignette + saturate/contrast + bloom/chromatic on high.
- Water = ground blobs + detached DOM `<canvas>` overlay (`WaterSystem`) with 1:1 world:screen math (breaks under zoom), `isMurky=false` hardcoded.

## 2. Problems (ranked)

1. **Checkerboard tiling** — radial vignette per chunk + single biome per chunk.
2. **No transitions / macro variation** — speckles read as noise at 1080p, empty at close zoom. No slope/AO.
3. **Lighting disconnected** — night = blue overlay, glows leak through walls, no tree/building shadows.
4. **Blocky water + overlay mismatch** — 8px arcs + DOM canvas foam dots, no edge foam lines, no reflection.
5. **Prop style clash + broken depth** — `#241d17` outlines vs soft ground, all nodes `depth 5` (pop through player), baked ellipse shadows point random directions, no wind sway.

## 3. Upgrade plan

### Phase A — done in this patch (see code changes)
- [x] Flat base + large soft macro blobs (60–120px, alpha 0.08) instead of radial vignette.
- [x] Fixed `shadeHex` misuse (`12` / `-8` → `1.12` / `0.92`) that was blowing speckles to pure white/black.
- [x] 2× speckle density + dirt patches + elevation slope shading.
- [x] Fog no longer `cache.clear()`s everything — pristine canvas kept, fog re-baked per display copy only.

### Phase B — implemented
- [x] **Biome blending:** 8-point ring sampling around each chunk; neighbor `grass/grassDark` washed toward the shared edge (3 soft blobs, alpha 0.14). 8 `biomeAt` calls vs ~1k for per-pixel — no load hitch.
- [x] **Slope + AO:** per-texel elevation-gradient darkening pass (40 samples) + dirt patches for close-zoom readability.
- [x] **Water edges:** foam contour arcs where land cells touch water (`RIVER_LEVEL` band), murky-aware tint.
- [x] **Y-sort everything:** `spawnNode` uses `setDepth(Math.round(y))` (was fixed 5); buildings already Y-sorted.
- [x] **Wind sway:** every 3rd tree gets a subtle ±1.5° `Sine.easeInOut` yoyo tween.
- [x] **Ground relight:** `WorldScene.relightChunks()` (60-frame cadence) tints active chunks night-blue / dawn-gold / day-clear — ground now participates in day/night.

### Phase C — stretch (Phaser 4.2 features)
- Cone lights / stencil shadows for trees + buildings at night (Phaser 4.2 `Mesh2D` + stencil).
- Parallax dust/pollen as **world-space** particles (`scrollFactor 1`) instead of screen-space.
- Ground emissive layer (volcanic cracks, crystals) with bloom pickup via `PostFXSystem.pulse()`.

## 4. Acceptance checks
- Duplicate chunk side-by-side ×3 — no visible seam.
- Grayscale screenshot — biome boundaries still readable by value.
- Night screenshot — ground darkens, campfire pool visible, no ADD leak through walls.
- `npm test` green + 60fps with 49 chunks (profile `updateChunks` < 8ms).
