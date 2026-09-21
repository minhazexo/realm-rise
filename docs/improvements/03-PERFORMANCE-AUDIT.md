# Performance & Engine Audit — Phaser 4 (Rise of the Realm)

Findings from reading the scene loop, chunk pipeline, water/fog/particle
systems, and entity update paths. Checked against the Phaser performance
guide (generalistprogrammer.com, 2026) and Game Programming Patterns.

---

## Frame budget anatomy (measured by reading update order)

`WorldScene.update` runs, per frame:
1. env.update (day/night math + star twinkle every 3rd frame — 140 circles)
2. player.update (movement, combat, survival)
3. updateChunks (only on chunk cross — good)
4. refreshDynamicLights every 30 frames — good
5. waterSystem.update every frame, redraw every 3rd — **hot**
6. updateAmbientParticles (O(1) emitter mgmt — good)
7. updateFogCards (10 sprites — good)
8. enemies loop w/ distance² gating at 1250/1800 px — good
9. projectiles + loot + gather proximity (nodes Map, throttled 120 ms)
10. NPC wander AI per frame (vector math only — fine)
11. floats.update (tween-driven — fine)
12. minimap every 6th frame (canvas 2D, ~100 draws)
13. night mask every 4th frame (480×270 canvas — good)

## Hot spots + fixes

### H1. WaterSystem foam loop is the #1 CPU cost
`FOAM_STEP = 16` over a 840×840 world view ≈ **2,700 samples × elevationAt
(4-octave fbm!) per redraw**, 20 redraws/s. `elevationAt` is the expensive
noise call and it's also called per wave point and per sparkle.
**Fix**: compute a foam "band mask" into a small offscreen canvas at 1/2 res
**only when the camera crosses 64 px** and oscillate its alpha per frame.
Cuts ~95 % of the per-frame noise sampling.

### H2. Chunk texture memory
`activeChunkRadius 3` = 7×7 = 49 chunks × 512² canvas textures = 49 × 1 MB GPU.
`evictFarChunks` prunes painter cache; scene-side `activeChunks` also destroys
images. OK. But `getChunkCanvas` re-paints a chunk when returning to it —
that's a 512² terrain repaint stutter on re-entry. Consider an LRU of ~40
painted canvases (memory bounded ~40 MB) to make revisits free.

### H3. Enemy update distance gates use squared px
1250²/1800² gates are fine, but enemies beyond 1800 px **do nothing yet still
update shadows via nothing** — actually they skip update entirely (good).
However `updateNpcs` walks ALL npcs every frame regardless of distance; with
30 POIs × few NPCs it's fine, but the wander AI should early-out beyond
1600 px like enemies do.

### H4. `syncPoisMarkers` rebuilds text objects on every discovery
`this.add.text` per POI per call, `removeAll(true)` first. Discoveries are
rare — acceptable — but the layer is also refreshed on load; fine.

### H5. Floater text objects
Each float = one Text object (canvas raster) + bloom FX at high quality +
tween. Damage spam in a raid (6 raiders × multiple hits/s) can create ~20
Texts/s. Phaser Text is heavier than BitmapText. Mitigation already present
(pooled? **No — created/destroyed**). Recommend a simple pool of 24 Text
objects reused round-robin (same pattern as projectile pooling guidance).

### H6. `wearEquipped` notify-on-every-hit
Every melee swing notifies EQUIPMENT channel → React HUD re-renders. The HUD
subscribes via useGameState(PLAYER/EQUIPMENT...). Wear only *changes* on
break; throttle: only notify when `dur === 0` or every 10 wears.

### H7. Bus 'player-pos' every 2 frames → GameState._playerWorldXY
Fine (single consumer), but it also could live in the 30-frame tick.

## GC pressure
- `updateProjectiles` filters `this.projectiles = filter(...)` per destroy —
  allocates per removal; with few projectiles OK.
- `pickLoot`/`updateLoot` `filter` per removal — same, low counts.
- `Enemy.rollLoot` builds arrays per death — fine.
- Object pooling priority list (from research): floaters > projectiles >
  loot glow rings > fx burst images (already tweened & destroyed — pool them).

## What's already right (don't break)
- `pixelArt: true`, `roundPixels`, no mipmaps, `antialias: false`.
- Arcade physics only; bodies disabled on death; `collideWorldBounds`.
- `audio: { noAudio: true }` in Phaser config (custom WebAudio stack).
- Particle settings funnel through `particleMultiplier()` everywhere.
- NightLights mask is low-res 480×270 — correct approach.
- Chunk fog is baked into canvas, not per-frame tint — correct.
- PostFX quality tiers no-op below thresholds — correct.
- FPS cap honored via `game.loop.targetFps`.

## Mobile-specific notes (from research)
- The game RESIZEs to container; DPR is not handled in WaterSystem canvas
  (it resizes to scale.width/height, CSS pixels). On retina the water canvas
  is 1× while Phaser is 1× too — consistent, fine.
- TouchControls exist; ensure water overlay canvas has `pointer-events:none`
  — verified in code.

## Sources
- generalistprogrammer.com "Phaser Performance Optimization Guide" (2026) —
  atlas batching, pooling, physics culling, memory mgmt, draw calls.
- franzeus.medium.com "How I optimized my Phaser 3 action game — 2025" —
  object pools, cached refs, loop-what-you-need, lazy assets.
- Game Programming Patterns — Spatial Partition, Object Pool chapters.
