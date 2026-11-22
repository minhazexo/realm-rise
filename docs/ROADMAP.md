# Roadmap — Painterly Overhaul & World/Story Expansion

> The build order for `VISION.md` / `ART-DIRECTION.md` / `WORLD-MAP.md` /
> `STORY.md` / `EVENTS.md` / `GAME-DESIGN.md`. **Docs are authored; no code is
> implemented yet.** Each phase ships green before the next begins.

## How to read this

- **One phase per working session-group**, each ending with a demoable build.
- Every phase lists **tasks → touched modules → acceptance gate**.
- Gates are the existing project gates: `npm test` (20 suites), `npm run
  typecheck`, `npm run build`, plus screenshot review where visual.
- Respect `AI_RULES.md` and `STRUCTURE.md` at all times (layer rules, size
  budgets, header comments, no new top-level folders).

---

## Phase 0 — Baseline & design lock ✅ (docs only)

**Goal:** green baseline + this design set, so later phases have a reference.

- [x] Replace the docs set; keep `STRUCTURE.md`, `Architecture.md`,
      `AI_RULES.md`, `STORY-BIBLE.md` (load-bearing).
- [x] Author the vision/plan docs.
- [x] Capture the current baseline (2026-09-26, `architecture-pass`):
  `npm test` ✅ (15 suites), `npm run typecheck` ✅, `npm run build` ✅ (2.55 s).
  All green before any visual change.

**Exit:** a known-green baseline and an agreed design set. ✅

---

## Phase 1 — Painterly pipeline + vertical slice

**Goal:** prove the new style. Deliberately split into **1a** (pipeline + kernel,
shippable on its own) and **1b** (repaint the slice), because repainting every
asset is the volume risk and must not block the pipeline switch.

### Phase 1a — Pipeline, kernel, palette, grass ✅ (landed 2026-09-26)

| # | Task | Modules | Status |
|---|---|---|---|
| 1.1 | Painterly render profile behind one switch | `core/VisualProfile.ts`, `src/game/main.ts` | ✅ |
| 1.2 | Painterly kernel: `linearGrad`, `radialGrad`, `softBlob`, `featherShadow`, `rgba` | `assets/artCore.ts` | ✅ |
| 1.3 | Palette-as-data: `contour`/`shadow`/`highlight`/`haze` per biome | `world/biomeTable.ts` | ✅ |
| 1.4 | Deterministic painterly grass (fixed-seed rng + gradients) | `world/GrassField.ts` | ✅ |
| 1.4b | Player-facing **Render style** toggle (see 1.11) | `SettingsPanel.tsx`, `SettingsSystem.ts` | ✅ |
| 1.4c | Profile knobs become real: supersampling at the sheet boundary, gameplay contour, feathered night holes, one owner for the active style + a no-dead-knob gate | `core/VisualProfile.ts`, `assets/artCore.ts`, `sheetsHuman/Quad.ts`, `environment/NightLights.ts`, `main.ts`, `tests/structure.mjs` | ✅ (landed 2026-09-27) |

**Acceptance:** `npm run typecheck` + all 20 suites + `npm run build` green; the
render pipeline has one owner; grass is deterministic across loads. ✅

> **How to A/B the old look:** Settings → **Render style** (the choice is saved
> with the game). It is pushed into `core/VisualProfile.setRenderStyle()` at boot
> and on every toggle, and the profile owns the whole pipeline from there: Phaser
> render flags, the art pipeline's authoring scale (`artScale` 4 painterly vs 1
> pixel, `terrainScale` for ground), contour widths and the night-light feather.
> `VISUAL_PROFILE.style`
> is only the default for a game with no saved choice.

### Phase 1b — Repaint the slice

| # | Task | Modules | Status |
|---|---|---|---|
| 1.5 | Painterly terrain pass: directional light wash + organic (soft) blotches; fog split out to hold the budget | `world/chunkPainter.ts`, `world/chunkFog.ts` | ✅ |
| 1.6 | Player painterly: feathered shadow, left-lit torso gradient, rim light (frame size kept so collision is unchanged) | `assets/sheetsHuman.ts` | ✅ player · ✅ enemies (quadrupeds, 2026-09-27) |
| 1.6b | Quadruped painterly: feathered shadow, lit body/head gradient, rim light, two-tone legs for depth order | `assets/sheetsQuad.ts` | ✅ (landed 2026-09-27) |
| 1.7 | 5 items/weapons matched to the imported icon style | `assets/iconPrims.ts`, `iconShapes*.ts` | ⬜ |
| 1.8 | 2 buildings + damage states (townhall, hut) | `assets/propsStructures*.ts`, `systems/economy/BuildSystem.ts` | ⬜ |
| 1.9 | Lighting pass: feathered night holes, warm dynamic lights | `environment/NightLights.ts`, `DynamicLights.ts`, `PostFXSystem.ts` | ⬜ |
| 1.10 | Four-plane depth on the slice (bg/mid/game/fg) | `world/GrassField.ts`, `FogCards.ts`, `RegionForeground` | ⬜ |
| 1.11 | **Render-style settings toggle** (Painterly/Pixel): live texture filter + camera snapping; antialias/mipmap on reload | `core/VisualProfile.ts`, `main.ts`, `SettingsSystem.ts`, `SettingsPanel.tsx` | ✅ |
| 1.12 | Browser screenshot review on the painterly profile | `tests/screen-review.mjs` | ✅ |

> **Browser verification (2026-09-26):** `node tests/screen-review.mjs` against a
> Vite dev server captured 15 screens (menu, settings, world, panels, mobile)
> with **zero page/console errors** — the painterly profile (antialias + mipmap
> on canvas textures) renders cleanly in Chromium.
>
> **Density pass landed (2026-09-27).** `assets/artCore` authors every sheet,
> prop and icon at `VISUAL_PROFILE.artScale` (4× = one texel per device pixel at
> the largest selectable zoom) while `displayAtNativeSize` keeps the frames
> native, so frame rectangles, collision, anchors and sprite scales are
> untouched. Measured with `.freebuff/density-probe.mjs` at DPR 1.25 / camZoom 2:
> median **1.87** texels per device pixel across visible sprites (was 0.97) and
> ground **0.93** (was 0.02 — one chunk texture was being stretched over 32768
> world px by a scale inherited from its 16px loading placeholder). The grass
> tile and the water overlay were authored at screen density too. Also landed:
> `contour.gameplay` on character/enemy sheets, `lightFeather` in the night mask,
> and `tests/structure.mjs` checks 7-9 (a knob with no reader, art not authored
> through the profile, and a repaint that forgets to reset the canvas transform
> are all failures now — the last one is what had been drawing every character
> and enemy magnified 4× as a giant blob).

**Acceptance (1b):** screenshot review (`tests/screen-review.mjs`) at day + night
with player, enemy, path and building readable with FX on; art authored through
the profile so entity collision sizes are unchanged; 60 fps @1080p.

**Risk:** asset volume + the memory/scale boundary (sprite textures are now
~108 MB, ground ~224 MB at the shipped streaming radius). Mitigation: the ground
keeps its own lower density knob, and every density decision is recorded in
`ART-DIRECTION` §3/§13 with its measured cost.

---

## Phase 2 — World expansion (regions)

**Goal:** the atlas becomes real. Each region is a data module + one registry line.

> **Scope discipline:** do **two regions at a time** (2.2+2.3, then 2.4+2.5, …),
> ship green, then continue. Eight regions in one pass is the overscope to
> avoid — each region is 4–8 landmarks, encounters, an arena and a probe test.

| # | Task | Modules |
|---|---|---|
| 2.1 | Harden the region contract so all `RegionDef` fields are exercised | `data/region.ts`, `world/RegionSystem.ts` | ✅ anchor + waypoint in the contract; `tests/regions.mjs` pins every field |
| 2.2 | Region 1: **The Deepwood** (forest, Ch III–IV) | `data/regionDeepwood.ts`, `systems/world/RegionRegistry.ts` |
| 2.3 | Region 2: **The Drowned Reach** (riverlands, trade) | `data/regionDrownedReach.ts` |
| 2.4 | Region 3: **Ashen Dunes** (desert, Ch V) | `data/regionAshenDunes.ts` |
| 2.5 | Region 4: **Murkfen** (swamp) | `data/regionMurkfen.ts` |
| 2.6 | Region 5: **Grayfang Heights** (mountains, forge, Ch VI) | `data/regionGrayfang.ts` |
| 2.7 | Region 6: **Frozen North** (Watch shard, Ch VII) | `data/regionFrozenNorth.ts` |
| 2.8 | Region 7: **Emberwaste** (Hearth/Green shards, Ch VII) | `data/regionEmberwaste.ts` |
| 2.9 | Region 8: **Golden Coast** (finale gate) | `data/regionGoldenCoast.ts` |
| 2.10 | Roads + waypoints + fast travel unlock | region data, `world/RegionTravel.ts`, `world/NavigationSystem.ts` | ✅ for registered regions (share the file) |
| 2.11 | **The map UI**: one shared map, region labels + fog rumours | `world/mapRender.ts`, `world/mapTerrain.ts`, `world/mapView.ts`, `environment/MinimapSystem.ts`, `panels/MapPanel.tsx` | ✅ (landed 2026-09-27) |
| 2.12 | Per-region probe test (template: `tests/ashen-frontier.mjs`) | `tests/<region>.mjs` · atlas gate: `tests/regions.mjs` ✅ |

**Acceptance:** all regions registered; no overlap; every guardian resolves to a
real boss; fog cap `exploredChunks ≤ 3000` holds; region probes green.

> **Map UI landed (2026-09-27), before the remaining regions.** The corner map and
the World Map panel now draw through one entry point (`drawWorldMap`) instead of
two hand-rolled painters, so a new marker kind or region reaches both in the same
commit; `tests/structure.mjs` check 10 keeps it that way. The panel is a real map:
drag to pan, wheel to zoom about the cursor, click to chart, `Fit world` /
`Centre on me`, hover readout (place · biome · coordinates · explored), scale bar,
region names with rumours until you arrive, and the dashed rectangle showing the
patch of world the minimap window is on. The minimap is a truthful window
(`minimapView`, 2 200 px at zoom 1) that drops what it cannot show instead of
pinning it to the rim. Sampling is bounded by `MAP_CELL_BUDGET` (9 000 cells), with
a coarser frame while a gesture is in flight — see `WORLD-MAP.md` §7 for the rules
and `.freebuff/map-verify.mjs` for the live evidence.

---

## Phase 3 — Events & story integration

**Goal:** the frontier reacts. Extends shipped systems, no rebuild.

> **Scope discipline:** ship the new event kinds in **waves of ~5**, pinned by
> `tests/world-events.mjs` at each step. Wave 1: `faction_patrol`, `caravan`,
> `refugee_column`, `meteor_crash`, `lost_child`. Then the rest.

| # | Task | Modules |
|---|---|---|
| 3.1 | Add the new event kinds + variant tables | `data/worldEvents.ts` |
| 3.2 | Chapter/faction/stage candidate filtering | `systems/world/WorldEventRuntime.ts` |
| 3.3 | Scene builders for new events (reuse Npc/Raid/Loot/Kingdom) | `WorldEventRuntime.ts` + owning systems |
| 3.4 | Chapter arc + flags + gates | `data/chapters.ts`, `data/story.ts`, `systems/narrative/StorySystem.ts` | ✅ (landed 2026-11-22) |
| 3.5 | Decisive quest per chapter | `data/questsMain.ts`, `QuestEngine` (lazy flag steps) | ✅ (landed 2026-11-22) |
| 3.6 | Banner policy → standing, prices, militia, happiness | `data/policies.ts`, `economy/PolicySystem.ts`, `TradePanel` | ✅ (landed 2026-11-22) |
| 3.7 | Reactive dialogue blocks | `data/npcs.ts` | ✅ (landed 2026-11-22) |
| 3.8 | Three ending policies | `StorySystem.endingOptions/endingFor`, `RulerPanel.tsx`, `LegacyStore` | ✅ (landed 2026-11-22) |
| 3.9 | Extend event + story tests | `tests/world-events.mjs`, `tests/story.mjs` | ✅ (landed 2026-11-22) |

**Acceptance:** `tests/world-events.mjs` pins gating + one-live + coherent
content; a chapter fixture proves gates; every ending reachable in a scripted
save.

---

## Phase 4 — Mechanics & feel (ARPG)

**Goal:** the combat/progression overhaul in `GAME-DESIGN.md`.

| # | Task | Modules |
|---|---|---|
| 4.1 | Weapon identity (slash/crush/pierce) + combos | `entities/Player.ts`, `Constants.ts` |
| 4.2 | Parry/perfect block reward | `Player`, `ElementalSystem` |
| 4.3 | Elemental resistances + readable status tells | `systems/combat/ElementalSystem.ts` |
| 4.4 | Specials from data, add build summary | `WeaponSpecials.ts`, `data/weaponsArpg.ts`, `CharacterPanel` |
| 4.5 | Enemy telegraph pass + safe boss phases | `entities/Enemy.ts`, `BossEnemy.ts` |
| 4.6 | Town→expedition provisioning | `EconomySystem`, `KingdomEconomy` |
| 4.7 | Craft queue UI + batch salvage + armor wear/repair | `CraftingSystem.ts`, `panels/CraftingPanel.tsx` |

**Acceptance:** existing `tests/systems.mjs`, `weapons-elements.mjs`,
`elites-boss.mjs`, `autoattack.mjs` stay green with new coverage; combat feel
spot-checked in-browser.

---

## Phase 5 — Kingdom & economy depth

| # | Task | Modules |
|---|---|---|
| 5.1 | Stage visual transformation (buildings evolve per stage) | assets + `BuildSystem` |
| 5.2 | Citizen needs + policy consequences | `KingdomSystem`, `kingdomSim.ts` |
| 5.3 | Raid/building damage read visually | `RaidSystem`, building sprites |
| 5.4 | Regional price affinities per region | `EconomySystem`, `WORLD-MAP.md` |

**Acceptance:** `tests/ashen-frontier.mjs` + `systems.mjs` extended; a siege
survived with visible damage.

---

## Phase 6 — Polish, performance, accessibility

| # | Task | Modules |
|---|---|---|
| 6.1 | Perf budget: baked terrain, pooled FX, no hot-path allocs. **Includes** the devicePixelRatio cap the profile cannot carry: Phaser 4's `RenderConfig` has no `resolution` knob, so it has to be solved here (canvas/renderer sizing), not in `core/VisualProfile.ts` | `chunkPainter`, `WorldScene.Floater`, systems |
| 6.2 | Photosensitivity-safe mode + reduced motion | `SettingsSystem`, `PostFXSystem`, `styles.css` |
| 6.3 | Readability gate (grayscale, zoom, night) | `tests/screen-review.mjs` |
| 6.4 | Docs refresh + `STRUCTURE.md`/`graphify` update | this folder |

**Acceptance:** 60 fps @1080p integrated; no frame >33 ms in a raid; all
accessibility toggles verified; docs index current.

---

## Cross-cutting rules

- **Never break the four load-bearing docs.** `tests/structure.mjs` reads
  `docs/STRUCTURE.md`; keep it listing every systems module.
- **Data stays Phaser-free; data/ never imports systems/** (`structure.mjs`).
- **No React component writes persistent state** (`uidiscipline.mjs`).
- **Save shape changes need a migration + fixture** (`SaveSystem`).
- **Deterministic art** uses `seededRandom()`, never `Math.random()`.
- **One concern per PR**; update the doc it implements when behaviour shifts.

## Working agreement for AI sessions

1. Read `README.md` → the doc for the phase → `AI_RULES.md`.
2. Implement **one task**, run `npm test` + `npm run typecheck`.
3. Update the phase checkbox and any affected doc.
4. Leave the graph stale-guard: run `graphify update .` is optional (0 token
   cost) after code changes.
