# Visual FX & Polish Upgrade

> Sources: `propsFx.js`, `AmbientParticles.js`, `WaterSystem.js`, `EnvSystem.applyWeather`, `PostFXSystem.js`, `WorldScene` loot/gather/minimap.
> Research: 4-lane VFX readability, juice tiers, juice-as-information (flash=confirm, particles/SFX=where, shake=how-hard, hitstop=when-it-matters).

## 1. Today

- Textures: `pt_spark/leaf/rain/snow/smoke/firefly`, `fx_slash1-3`, `fx_hitflash/ring`, `proj_arrow/fireball` — all procedural canvas, no pooling.
- Weather: rain/snow emitters at `depth 3900` screen-space; fog = rect + snow wisps; heat = rect + rising tinted snow; storm = `setInterval` lightning + shake + thunder.
- Ambient: pollen (day-only ADD), mist (twilight windows), menu birds every 9s. Killed if `particleMultiplier()==0`.
- Gather/loot: floaters + static burst images (leak), texture swap on deplete, loot icon + 0.6s → 280ms fly-to-player tween, POI Cinzel labels, 6-frame minimap (blocky biome + dots).
- Post: vignette always, saturate 1.18 / contrast 1.06, bloom + chromatic on med/high, `pulse()` on hits.

## 2. Problems
1. Screen-space weather (moves with camera, not world).
2. No debris/shake on chop/mine; hit flashes never fade.
3. Bloom/chromatic camera-only; volcanic/crystal ground never glows.
4. Minimap blocky, no legend, no zoom.
5. Loot fly + toast + sound all fire — no rarity grading (common pop vs legendary zoom+sting).

## 3. Plan

### Phase A — done
- [x] World-space bursts: all combat/gather bursts spawn at impact point with directional bias (along hit vector), pooled via short-lived images with destroy.
- [x] Gather feedback: chop/mine/deplete each get distinct burst + pitch-varied sound hook (`arrow_shot`/`sword`/`hit_flesh` already pitch-varied in AudioSystem).
- [x] Rarity-graded loot: common = small pop; rare+ = ring + `postFX.pulse()` + higher floater. Legendary = toast + sting.
- [x] Minimap legend (biome color key) in Map panel + player arrow rotates with facing.

### Phase B — implemented
- [x] World-space rain splashes around the player during drizzle/storm (`spawnBurst`, particle-setting aware) — weather now touches the ground, not just the screen.
- [x] Torch/campfire flicker ±12% with per-light phase + day-dimming (torches read at night, rest by day) in `DynamicLights`.
- [x] Rare+ loot ground glow: pulsing `fx_ring` while the drop sits (cleaned up on pickup/expire) — rarity reads before pickup.
- Deferred: fog cards with Phaser 4.2 `dither` alpha strategy + stencil occlusion; gathering-tier juice profiles; `photosensitivity` mode (shake + particles toggles already exist in Settings).

## 4. Acceptance
- 10-hit combo: `children.length` returns to baseline within 1s (no leak).
- Rain pans with world; screenshot day vs night shows ground relight, not just overlay.
- Common vs legendary drops distinguishable in a 2s muted clip.
