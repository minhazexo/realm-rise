# Art Direction — Painterly / Vector-Flat

> **Decision:** the game moves from **32px pixel art** to a **high-resolution,
> painterly vector-flat** look. Sprites and props are still drawn
> *procedurally in code* (no engine change, no external art dependency), but the
> output is smooth, layered, and lit rather than pixel-snapped.

This document is the art bible. `VISION.md` says *what* the game is; this says
*how it looks* and exactly which modules change.

## 1. The look in one paragraph

Confident dark contours over soft, saturated colour fields — a storybook
painting you can walk through. Distant planes dissolve into atmospheric haze;
the play layer stays crisp and readable; light is warm where people live and
cold, wrong, and quiet where the Veil has been. Think the *line hierarchy* of
Hollow Knight, the *value routing* of Ori, and the *flat graphic clarity* of
Night in the Woods — composed for a top-down camera, not a platformer.

## 2. Why painterly / vector-flat (and not HD pixel art)

- We already generate art procedurally in `src/game/assets/**`. Vector/painterly
  shapes scale to any resolution cleanly; pixel art must be redrawn per scale and
  breaks the moment the camera zooms.
- The current mismatch is visible: detailed 34px CC0 item icons sit next to
  simple procedural world sprites (see `VISUAL-DIRECTION` notes, now folded
  here). A painterly pass gives **one continuous style across icons, world, and
  UI**.
- It targets your "4K quality" goal directly: high-res source, smooth filtering,
  real gradients and lighting, no pixel grid.

## 3. What "4K quality" means here

| Term | Definition for this project |
|---|---|
| **Source resolution** | Author every canvas at `VISUAL_PROFILE.artScale` texels per **world** pixel, so that at the largest zoom the player can select (camZoom 2 × DPR cap 2 = 4 device px per world px) there is at least one texel per device pixel — the art is *downsampled* on screen, never magnified. One number, one place: `core/VisualProfile.artScale()` (sprites, props, icons, characters) and `terrainScale()` (ground, which is memory-bound — see below). `assets/artCore.makeCanvas()` applies it and every consumer draws in native coordinates as before; `displayAtNativeSize()` keeps frames displaying at native size. **Any canvas that becomes a Phaser texture must be authored through the profile** (a hand-rolled `document.createElement('canvas')` + `addCanvas` is the bug class this rule exists for — `tests/structure.mjs` now fails on one). |
| **Target display** | Up to **3840×2160**, respecting devicePixelRatio with `maxDpr 2` (perf guard). Phaser 4's `RenderConfig` has no `resolution` knob, so `main.ts:applyDevicePixelRatio()` resizes the canvas backing store to `CSS × renderScale()` and `CameraSystem` multiplies the camera zoom by the same factor — same world on screen, real device resolution instead of one browser-upscaled frame. **Consequence for overlays:** `scale.width/height` are now device px, so a DOM overlay must pin its own CSS size (`WaterSystem` does) and a screen-space overlay must fit through `ScreenOverlays.screenFit()`. |
| **No pixel snapping** | `pixelArt`, `roundPixels`, and integer zoom are turned **off** for the world layer. |
| **Filtering** | Linear (smooth) texture filtering with mipmaps enabled for zoomed-out terrain. |
| **Detail budget** | A single tree is a hand-painted multi-layer shape with at least 3 tones + contour; a character is a readable 3-tone silhouette with a highlight edge. |

Two mechanical rules fall out of the table above. Both were shipped as bugs first,
so they are enforced rather than advised:

- **A canvas remembers its transform.** `makeCanvas` hands out a context that is
already scaled by the density, so anything that *repaints* a canvas it painted
before — a sheet rebuild, a portrait repaint — must call
`ctx.setTransform(1, 0, 0, 1, 0, 0)` first. Without it the fresh copy lands
magnified by the density: every character and enemy became a giant unreadable
blob (measured on the live texture: a left-facing frame **98%** solid paint
against the correct **50%**), and a portrait grew 4× on every re-render.
`tests/structure.mjs` check 9 fails if a repainting module drops the reset.
- **A world tile's size belongs to the tile, not to the texture it happens to
carry.** Ground chunks are created on a 16 px loading placeholder and swapped to
the real 512 px texture later; the display size must be re-applied *after* the
swap. A scale inherited from the placeholder stretched one chunk across 32768
world px — the whole world drawn from a single magnified tile, i.e. ground at
0.02 texels per device pixel (0.93 after the fix).

## 4. Engine + render settings to change

Current settings live in `src/game/main.ts` (`createGame`) and are tuned for
pixel art:

```ts
// today
render: { antialias: false, pixelArt: true, roundPixels: true, subPixel: false, mipmap: false }
```

The painterly profile (set once the vector pipeline lands — see `ROADMAP.md`
Phase 1) becomes:

```ts
render: { antialias: true, pixelArt: false, roundPixels: false, subPixel: true, mipmap: true }
```

**Player-facing switch:** the profile is exposed as **Settings → Video & Quality →
Render style** (`visualProfile: 'painterly' | 'pixel'`, owned by
`SettingsSystem`). Texture filtering and camera pixel-snapping change live via
`main.ts:applyVisualProfile()`; `antialias`/`mipmap` are fixed at context
creation, so those two apply on the next reload. The boot profile is read from
browser prefs before `new Phaser.Game`, so the choice survives a refresh with no
save.

Consequences to handle in the same change:
- `systems/environment/CameraSystem.ts` accepts **fractional zoom** (already
  eases; remove any integer clamp).
- `systems/environment/ScreenOverlays.ts` already fits a zoom-1 UI camera — keep
  it, and re-check overlay alignment at DPR 2.
- Text/floaters (`Floater` in `WorldScene.ts`) should use smooth font rendering
  and drop the pixel-grid assumptions.

## 5. The four-plane depth model

Every scene composes four planes. This is a hard rule, not a suggestion.

| Plane | Content | Treatment |
|---|---|---|
| **Far background** | Sky, distant ridges, weather veil | Highest haze, lowest contrast, slow parallax |
| **Midground** | Terrain, water, forests, buildings' bases | Full colour, medium contrast, receives ground shadow |
| **Gameplay** | Player, enemies, NPCs, interactables, nodes | **Maximum contrast + contour**, never occluded by FX |
| **Foreground** | Near-camera foliage, grass blades, fog cards | Fast parallax, blur/haze, passes *in front of* the player |

Existing hooks: `world/GrassField.ts` (foreground grass), `world/FogCards.ts`
(foreground fog banks), `world/chunkPainter.ts` (terrain), `RegionForeground`
band. The painterly pass gives each plane its own haze/contrast curve.

## 6. Line, colour, and light rules

**Contour hierarchy (from the Hollow Knight lesson):**
- Interactive/gameplay forms: **2–3 px** confident dark contour (`VISUAL_PROFILE.contour.gameplay`, read through `contourWidth('gameplay')`).
- Architecture/ornate scenery: 1–2 px softer line.
- Distant planes: no contour — only value shapes.

**Value & saturation (from the Ori lesson):**
- Route the eye by *value*, then saturation, then detail.
- Warm saturated accent = refuge / interactable / reward.
- Cool desaturated haze = distance / danger / the Veil.
- Ground shadows are soft ellipses tinted toward the biome accent, never black.

**Lighting (reuse what exists):**
- `systems/environment/NightLights.ts` — the darkness-with-holes mask carries
  night. In the painterly pass, its holes get **soft feathered edges** and a warm
  falloff, not hard circles.
- `systems/environment/DynamicLights.ts` — campfires, torches, forges. Add a
  gentle flicker and a coloured ambient rim.
- `systems/environment/PostFXSystem.ts` — bloom, vignette, grade, chromatic
  aberration. Painterly baseline: bloom tuned warmer and weaker; vignette carries
  the cozy-dark mood; chromatic aberration only at high quality.
- `systems/environment/EnvSystem.ts` — day/night + weather drives the grade and
  the fog tint; the four-plane haze curves read from it.

## 7. Palette system

Palettes become **data**, per biome, extending `world/biomeTable.ts`
(`grass`, `grassDark`, `accent` today). Add: `contour`, `shadow`, `highlight`,
`haze`, `waterDeep`, `waterShallow`, `lightWarm`, `lightCold`. Art code reads
palettes; it must not hardcode colour again.

Existing biome identities to build on (`world/biomeTable.ts`): Sunlit Plains,
The Deepwood, Riverlands, Murkfen Swamp, Grayfang Mountains, Ashen Dunes, Frozen
North, Emberwaste — plus the authored Ashen Frontier. `docs/WORLD-MAP.md` extends
this set.

## 8. Procedural art migration map

Everything is drawn in code today. The migration is **rewrite the painters, keep
the registration/atlas contract**.

| Concern | Current modules | Painterly change |
|---|---|---|
| Draw kernel | `assets/artCore.ts` (`makeCanvas`, `CanvasPair`, frame grid, `OUTLINE`) | Add vector helpers (bezier blobs, gradient fills, soft shadow); keep `makeCanvas` registration. |
| Icon geometry | `assets/iconPrims.ts`, `iconShapesA/B.ts`, `icons.ts` | Replace primitive boxes with smooth silhouettes; keep the icon-frame atlas contract. |
| Imported icons | `assets/itemArtwork.ts` + `public/assets/items/**` | Keep (CC0, detailed) — now the *style target* for procedural icons. |
| Humanoids | `assets/sheetsHuman.ts` | Silhouette-first redraw; more frames per action, smooth interpolation. |
| Quadrupeds | `assets/sheetsQuad.ts` | Same. |
| Nature props | `assets/propsNature1/2.ts` | Layered canopies, grass tufts, soft ground shadow. |
| Structure props | `assets/propsStructures1/2/3.ts`, `propsAshen.ts` | Architectural line hierarchy; lit windows. |
| FX | `assets/propsFx.ts` | Additive soft particles, not hard sprites. |
| Terrain chunks | `world/chunkPainter.ts` (`bakeChunkTexture`) | Painterly terrain: gradient base, organic blotches, path grounding, soft water edges. |
| Assembly | `assets/index.ts` (`buildAllAssets`) | Unchanged contract; still called from `WorldScene.create()`. |
| World map render | `world/mapRender.ts` | Painterly minimap/map (see `WORLD-MAP.md`). |

> Determinism rule (`AI_RULES.md`): painters use `seededRandom()`, never
> `Math.random()`, so a world looks identical on every load.

## 9. Characters

- **Silhouette first.** Every character must be identifiable as a flat black
  shape at gameplay zoom — test enemies/player as pure silhouettes before colour.
- **Three tones + contour** minimum; add a rim light so the player pops at night.
- **Animation:** keep gameplay timing identical (attack wind-up, dodge i-frames,
  gather cadence are in `core/Constants.ts`). Redraw frames only.
- **Appearance evolution:** `player.appearance.outfitTier` drives visual tier
  upgrades (rags → leather → iron → steel → royal → legendary) — now strongly
  readable, so progression is visible on the body.
- Player color channel: hair/skin/outfit must stay high-contrast against every
  biome palette (the current `AI_RULES` readability intent, enforced visually).

## 10. Items, weapons, enemies, buildings

- **Items/weapons:** detail target = the existing CC0 icons; procedural items are
  redrawn to match, at 2× and smooth. Rarity is communicated by contour colour,
  glow, and a small corner flourish — not just hue.
- **Enemies:** categories get a shared shape language — wildlife = organic curves;
  bandits/humans = angular, cloth; monsters = wrong geometry (the Veil's "wrong
  silhouette" motif); bosses = unique multi-tone forms with an aura.
- **Buildings:** each kingdom stage must be visually legible at a glance
  (`SETTLEMENT_CONFIG.stageNames`). Walls/roofs gain light and damage states
  (raiders already attack building HP — show scorch/cracks as HP drops).

## 11. UI / HUD

- Painterly textured panels (parchment/glass) as currently intended, but asset
  glow and shadows replace flat CSS borders where it matters.
- Keep `src/styles.css` as the single style home; no per-component inline theme.
- Icons come from the same atlas as items so the HUD and inventory agree.
- Accessibility: honor `reducedMotion` (already in settings) and keep a
  photosensitivity-safe mode (weaken bloom/shake/chromatic aberration).

## 12. Readability & accessibility gates

Every art change is reviewed against:
1. Can an enemy be seen at night in Emberwaste and in Frozen North?
2. Can the path/interactable be found in daylight in The Deepwood?
3. Does the scene still read with **all FX on** (bloom, fog, grass)?
4. Does it read in grayscale? (value test)
5. Does it hold at 50% zoom-out and 200% zoom-in?

Screenshot review follows the existing Playwright harness (`tests/screen-review.mjs`,
`tests/browser-e2e.mjs`); new screenshots land in `tests/_artifacts/`.

## 13. Performance budget

- Terrain stays **baked textures** per chunk (`chunkPainter`), not per-frame
  vector draws. Painterly detail must be baked, not live.
- Texture memory: mipmaps double cost — cap chunk texture size and evict as
  today (`chunkStream.removeChunkTexture`). Measured on a live world (49 live
  chunks): ground **224 MB**, every sprite/prop/icon **108 MB** (~5 MB of it
  characters and sheets). The ground is 2/3 of the budget, which is why its
  density is a separate, deliberately lower knob than `artScale`.
- Density costs are quadratic: `artScale` 4 = 4× the texels of 2 (28 MB → 108 MB
  measured) and is cheap for sprites because they are small; the same step on
  terrain would add ~200 MB, so terrain stays at `terrainScale 2` (~1 texel per
  device pixel at max zoom on a 1.25× display).
- No per-frame allocations in the four-plane composition.
- Target 60 fps at 1080p integrated GPU; no frame > 33 ms during a raid.

## 14. Asset resolution & atlas strategy

| Asset class | Native size (world px) | Authored at | Notes |
|---|---|---|---|
| Terrain chunk tile | 512 (16 tiles of 32) | `terrainScale` × = 1024 px | Baked per chunk, mipmapped, memory-bound |
| Character frame | 26×34 humanoid, 44×30 quadruped | `artScale` × = 104×136 / 176×120 | Smooth-scaled, no grid |
| Prop (tree, rock, building) | 40–160 px | `artScale` × = 160–640 px | Layered, soft shadow baked in |
| Item icon | 34 (atlas cell) | `artScale` × = 136 px | React PNG crops come out of the same atlas |
| Grass field tile | 160×64 | `artScale` × = 640×256 | One shared TileSprite texture, `tileScale = 1/density` |
| UI glyph | vector / 2× | — | Same atlas as items |

## 15. Licensing

- Existing CC0 set (7Soul1 / Henrique Lazarini) stays; see
  `public/assets/items/CREDITS.md`. Keep attribution for CC-BY sources.
- **No new art dependency without a license note in this file.** Prefer
  self-generated procedural art to avoid licensing debt.

## 16. Validation for the art pass

- `tests/screen-review.mjs` + `tests/item-art-browser.mjs` extended with
  painterly baselines.
- `tests/structure.mjs` must stay green (it enforces header comments and file
  budgets — new painters are new files under `assets/`, budget 800 lines).
- A new doc-only change must never alter `WorldScene.create()`'s asset-build
  contract without updating this file and `STRUCTURE.md`.
- `tests/structure.mjs` enforces the density rule from §3: a canvas that becomes
  a Phaser texture must be authored through `core/VisualProfile` (the few
  intentional exceptions — the memory-bound ground painter, the DPR-aware DOM
  overlay, atlas crops — are listed in the test with a reason, and each of them
  must read the profile to justify itself).
- `.freebuff/density-probe.mjs` records the reviewable evidence: a pinned world
  view at DPR 1.25 with texels-per-device-pixel for every visible object, the
  texture-memory split, and screenshots. Run it before/after a resolution change.
