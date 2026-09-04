# Improvement Program — Index

Deep-dive + internet-researched upgrade tracks for Rise of the Realm. Each file is self-contained with today-state, plan, and acceptance checks.

| # | Doc | Scope | Status |
|---|---|---|---|
| 01 | `01_GRAPHICS_GROUND_VIEW.md` | Chunk painter, biomes, lighting, water, props/depth | Phase A implemented |
| 02 | `02_ATTACKS_WEAPONS.md` | Light/heavy/bow/block/dodge, styles, enemy roles, FX leaks | Phase A implemented |
| 03 | `03_CRAFT_SYSTEM.md` | 45→47 recipes, wear/repair, batch process, lootOnly | Phase A implemented |
| 04 | `04_VISUAL_FX_POLISH.md` | Weather, gather/loot juice, minimap, post, accessibility | Phase A implemented |
| 05 | `05_PHASE_C.md` | Build fix, craft queue UI, gathering tiers, photosensitivity, night light mask | Implemented |
| 06 | `06_PHASE_D.md` | Missing panels crash fix, fog cards, tutorial, raids, save share, popups | Implemented |
| 07 | `07_PHASE_E.md` | Video, key rebinding, NG+ boons, economy, death fix | Implemented |

## What changed in code (this patch)
- `src/game/world/chunkPainter.js` — flat base + macro blobs, fixed `shadeHex` args, denser speckles + dirt + slope shade, pristine-cache fog (no more full `cache.clear()` hitch).
- `src/game/entities/Player.js` — `heavyUnlocked()` gate, `requestHeavyRelease()`, style-differentiated arcs (`slash` 114° / `crush` 150° + shake / `pierce` 40° thrust + per-target animal bonus), armor wear on damage.
- `src/game/scenes/WorldScene.js` — hold-to-heavy wiring (280ms), FX auto-destroy, single-floater projectiles, rarity-graded loot pulse.
- `src/game/systems/InventorySystem.js` — `wearEquipped('armor'|'offhand'|kind)` generalization.
- `src/game/data/recipesB.js` — added `steel_sword` + `iron_shield`; `recipes.js` exposes `LOOT_ONLY` set.

## How to verify
```bash
npm test
```
Then playtest: hold-LMB heavy, spear vs axe feel, wear armor down, craft steel sword, compare day/night ground, watch `children.length` stability.

## Phase B — implemented (this patch)
- Terrain: biome edge blending, foam contours, slope/AO dirt, Y-sorted swaying trees, chunk relight tick.
- Combat: light→light→finisher combos, 150ms parry, moving block, kiter/charger/brute/pounce AI, `DETECT` telegraph, boss `beam_sweep` + stall-proof move picker.
- Craft: `steel_plate`/`crossbow` rebalance, ×5 ingot recipes, `salvage()`, `compare` tooltips, station radius rings.
- FX: world-space rain splashes, light flicker + day dimming, rare-loot ground glow.

## Phase C — implemented (this patch)
- `vite build` fixed (CSS comment swallow); 111 modules bundle clean.
- Craft queue UI (progress + cancel), Shift-batch, salvage button, ring-on-hover, compare lines.
- Gathering tiers (pips + wiggle + common/rich/rare eruption).
- Photosensitivity-safe toggle wired through shake/bloom/chromatic/flash/vignette.
- Night darkness-with-holes mask (torch matters: 300 vs 190 sight).

## Phase D — implemented (this patch)
- Crash fix: all six missing panels built (Map/Journal/Character/Trade/Pause/Save).
- Fog cards, minimap zoom + legend, tutorial hint chain.
- Faction raids + building siege damage + safe spawn zones.
- Save export/import, achievement popup, working boss bar.

## Phase E — implemented (this patch)
- Death respawn rebuilt (was soft-locking) + enemy evade reset.
- Video: FPS cap + fullscreen. Controls: full key rebinding UI.
- NG+ heirloom boons from past endings. Economy sell spread 0.38 → 0.45.
- Quality sweep: dead method + duplicate constant removed.

## Next (Phase F ideas)
Dither-alpha fog cards, building stencil occlusion, ambient-sound mix pass,
multiplayer-ghost legacies, modding hooks. See `docs/TODOs.md` for the remaining backlog.
