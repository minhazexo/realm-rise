# STRUCTURE — where everything lives, and where new work goes

This is the map. Read it before adding a file, and keep it true: `tests/structure.mjs`
fails when a module exists that this file does not name, when a pure layer reaches for
Phaser, or when a file grows past its budget.

For the runtime picture — how state reaches the bus, React and the game loop — read
[Architecture.md](./Architecture.md). This file is the file-level map.

## The five layers

| Layer | Path | Owns | May import |
|---|---|---|---|
| **React UI** | `src/app/**` | Everything the player sees outside the canvas: menus, HUD, panels, overlays, toasts. Reads state, never writes persistent state (the `uidiscipline` gate enforces this). | `game/core` types, `game/systems` read APIs, `hooks/useGameState` |
| **Bootstrap** | `src/main.tsx`, `src/game/main.ts` | Mounting React, creating the Phaser game, wiring the two. `main.tsx` boots platform storage before either runs. | everything |
| **Platform** | `src/platform/**` | Where persistence *lands*: `kv.ts` (synchronous key/value over localStorage, memory or a desktop shell) and `desktop.ts` (shell boot + store parsing). Game code never calls `localStorage` directly. | nothing from `game/` |
| **Desktop shell** | `electron/**`, `scripts/desktop-*.mjs` | Electron main + preload (window, atomic `store.json`), one-command dev runner and the Playwright shell smoke. Ships the built `dist/`, not the source. | built `dist/` output |
| **Phaser layer** | `src/game/scenes/**`, `src/game/entities/**`, `src/game/assets/**`, `src/game/world/**` | Canvas rendering, input surface, cameras, procedural art and chunk painting. | `core`, `data`, `systems` |
| **Systems** | `src/game/systems/**` | ALL behaviour: one file, one job, one owner of its state. | `core`, `data`, `systems` |
| **Pure core & data** | `src/game/core/**`, `src/game/data/**` | Persistent state shape, constants, event bus, and the authored content tables. `data/` is Phaser-free and imports nothing from `systems/`. | `core` ← `data` |

Direction of flow: **data → world → systems → scene → React**. A system never reaches back
into a component; a component never writes persistent state.

`world/` is the PROCEDURAL layer (noise, biome resolution, POI generation, chunk painting).
It sits below `systems/` and must not import one: when a generator product needs authored
content mixed in — the POIs are the case — the merge belongs in a system, not in the
generator (`systems/PoiRegistry` merges `proceduralPois()` with the regions).

The map lives here too, because it is a pure renderer of the world rather than a
system: `world/mapTerrain.ts` (sampling + painting the ground), `world/mapView.ts`
(view math, pan/zoom, marker placement, label declutter, region naming — canvas-free
and unit-tested) and `world/mapRender.ts` (`drawWorldMap`, the ONE entry point both
map surfaces call). None of them imports a system or Phaser, which is what lets the
Phaser scene, React and node tests share one map.

`entities/` own themselves, not the game: they read state and act, but never write
persistent state. A reward a kill or an action produces goes through the system that owns it
(`systems/KillReward` for kills, `ProgressionXP` for XP/gold/stamina), which is what keeps
save-shape policy out of combat code. Enforced by the structure gate.

## Scenes

| Scene | Owns |
|---|---|
| `WorldScene.ts` (~940) | The live world: display list, cameras, entity lists, the per-frame system order, delegates. |
| `MenuScene.ts` (50) | The title screen's lifecycle: backdrop textures, the backdrop, menu music, the `menu` screen state. |
| `menuBackdrop.ts` | The title screen's animated world (sky, stars, moon, hills, castle, fog, weather, the wanderer, treeline) and its per-frame drift. |

## The scene is a coordinator, not a home for logic

`src/game/scenes/WorldScene.ts` (~940 lines) owns exactly three things:

1. the Phaser display/camera and the live entity lists (`nodes`, `enemies`, `npcs`, `loots`, `projectiles`, `buildings`),
2. the per-frame order in which systems run (`update()`),
3. thin delegates — `spawnProjectile()`, `interactNpc()`, `doGather()`, … — so entities and
   React can call `scene.<name>()` without importing a dozen modules.

Every method marked *delegated* is a one-line forward: the policy lives in `systems/`.
When you add behaviour, add it to a system and, only if something outside needs it, add a
delegate.

## Systems, by concern

### World streaming & population
| Module | Job |
|---|---|
| `world/PoiRegistry.ts` | **The one list of points of interest**: the generator's own POIs merged with every authored region's, cached per world seed. Discovery, minimap fog, markers, NPC spawning and quest targets all read this. |
| `world/SpawnDirector.ts` | Deterministic population of chunks, resource nodes and enemies; elite rolls. |
| `world/WorldEvents.ts` | Dynamic-event **scheduler** — pure and Phaser-free (roll, cooldown, one live). |
| `world/WorldEventRuntime.ts` | The scene side of world events: builds, ticks and cleans up the live event. |
| `world/RaidSystem.ts` | Raid parties, hostile factions and open wars. |
| `world/KingdomEconomy.ts` | Periodic production/consumption tick, overflow, starvation. |
| `world/kingdomSim.ts` | Pure kingdom simulation math (no Phaser). |
| `world/AmbientParticles.ts` | Fireflies, leaves and other ambient particle layers. |
| `world/particleThrottle.ts` | Respects the player's `particles` setting. |

### Authored regions (the hand-built maps)
| Module | Job |
|---|---|
| `world/RegionRegistry.ts` | Every authored region the game runs, in registration order. Add a region here. |
| `world/RegionSystem.ts` | Streams the registered regions over the procedural world, per area. |
| `world/RegionLayout.ts` | Pure placement, cadence and atlas math for a region (node-testable). |
| `world/RegionTravel.ts` | Crossing into a region and moving between them: announces the region entered, unlocks its waypoint on arrival, fast-travels to the unlocked ones (saved in `world.unlockedFastTravel`). |
| `world/RegionState.ts` | Per-scene runtime of the regions + the scene contract they consume. |
| `world/RegionEncounters.ts` | The region's designed fights. |
| `world/RegionInteractables.ts` | Places the region's clickables and dispatches the click by kind. |
| `world/RegionStory.ts` | The narrative spine's world interactions: a Realm Shard, the Fivefold Anchor. |
| `world/RegionArena.ts` | The region's hostile ground and the boss arena's aftermath. |
| `world/RegionForeground.ts` | The near-camera foreground band that passes in front of the player. |
| `world/FogCards.ts` | World-space drifting fog banks. |
| `world/WaterSystem.ts` | Animated water: wave lines, shore foam, sparkles. |
| `world/GrassField.ts` | Grass overlay. |
| `world/NavigationSystem.ts` | World-map navigation: sector, distance, arrival. Pure, session-only. |

### Narrative, quests & voices
| Module | Job |
|---|---|
| `narrative/QuestEngine.ts` | Quest reducer (1/2): gameplay event → step progress → completion + rewards. |
| `narrative/QuestSystem.ts` | Quest facade (2/2): snapshots, offers, **`canOfferSideQuest` — the single owner of the offer gate**, choices. |
| `narrative/StorySystem.ts` | Drives the gated eight-chapter arc from quest progress + flags; journals the bargain, reliquary and council; resolves the three ending governments and their requirements. |
| `narrative/ShardSystem.ts` | Pure rules of the shard chain: is a fragment held, may it be taken, is the anchor ready. |
| `narrative/VoiceSystem.ts` | Where prose shows: the dialogue modal and staggered boss toasts. |
| `narrative/AchievementSystem.ts` | Achievements, persisted across playthroughs via LegacyStore. |
| `narrative/TutorialSystem.ts` | Guided first minutes. |
| `narrative/LegacyStore.ts` | Tiny localStorage payload that survives new games. |

### Combat, entities & progression
| Module | Job |
|---|---|
| `combat/EntityFactory.ts` | Single construction point for world entities (enemies, bosses, NPCs, nodes). |
| `combat/ElementalSystem.ts` | Elements, resistances, status effects. Pure. |
| `combat/WeaponSpecials.ts` | Named legendary abilities, resolved from data. |
| `combat/AutoAttackSystem.ts` | Defensive auto-swing ("counter-attack assist"). |
| `combat/ProjectileSystem.ts` | Every bolt in flight: spawn, travel, collision, destroy. |
| `combat/KillReward.ts` | **What a kill pays**: loot rolls, gold, biome-scaled XP, profession XP, the reward beat, the stamina refund and the kill events. `Enemy.die()` only dies. |
| `combat/BossUISystem.ts` | Boss bar state, its HP refresh, and the boss's intro/defeat lines. |
| `combat/NpcSystem.ts` | NPC spawning, dialogue, recruit/trade actions, wander AI. |
| `combat/LootSystem.ts` | Ground drops: spawn, magnet drift, pickup, expiry. |
| `combat/GatherSystem.ts` | Resource nodes: regrow, proximity, gathering hits, breaking. |
| `combat/ProgressionSystem.ts` | Derived stat engine (1/2) — every gameplay number the player has. |
| `combat/ProgressionXP.ts` | XP, levels, allocations, skills, professions, reputation (2/2). |
| `combat/InventorySystem.ts` | Inventory operations: resources + gear, stacking, equip. |
| `combat/CraftingSystem.ts` | Crafting validation (stations, knowledge) and `idleReason`. |

### Settlement, economy & factions
| Module | Job |
|---|---|
| `economy/BuildSystem.ts` | Construction: sprites, placement validation, construction, upgrades, station auras, demolition. |
| `economy/KingdomSystem.ts` | Kingdom orchestration: snapshot into `session.kingdom`, happiness, recruits. |
| `economy/EconomySystem.ts` | Regional price affinities so exploration pays. |
| `economy/FactionSystem.ts` | Numeric standing with the five powers and its consequences. |
| `economy/PolicySystem.ts` | The Chapter IV banner bargain: its readiness rule, the once-only choice, and the trade/standing/militia/happiness consequences. |

### Input, camera, feel & audio
| Module | Job |
|---|---|
| `environment/InputSystem.ts` | Keyboard/mouse wiring, remappable binds, pause/panel keys. |
| `environment/CameraSystem.ts` | The camera's zoom policy (pure; the scene applies it). |
| `environment/SettingsSystem.ts` | Applies user settings; the single source of truth for them. |
| `environment/EnvSystem.ts` | Day/night light curve, dynamic weather, per-area audio moods. |
| `audio/AudioSystem.ts` | Procedural WebAudio: music beds and the SFX bus. |
| `audio/audioSfx.ts` | The SFX synthesis table (pure). |
| `audio/ambientSounds.ts` | Procedural biome-specific environmental audio. |
| `environment/NightLights.ts` | 2D darkness-with-holes night lighting; the hole falloff is the profile's `lightFeather`. |
| `environment/DynamicLights.ts` | Light sources that follow the player and the world. |
| `environment/PostFXSystem.ts` | Bloom, vignette and the rest of the post stack. |
| `environment/ScreenOverlays.ts` | **The single owner of every screen-space overlay** — one zoom-1 UI camera, fit on resize/zoom. |
| `environment/BreathingFX.ts` | Shared idle-breathing helper for characters. |
| `environment/CelebrationFX.ts` | Milestone ceremonies (level-up, discovery). |
| `environment/MinimapSystem.ts` | **The corner map**: a player-centred *window* on the one map (`drawWorldMap`, detail `minimap`) — no private terrain, no labels, no radar dots. Publishes the world camera's footprint (`session.viewRect`) that the panel draws as the live window. |

### Persistence
| Module | Job |
|---|---|
| `persistence/SaveSystem.ts` | 3 manual slots + autosave, versioned and corruption-tolerant. |

### Core (state + plumbing)
| Module | Job |
|---|---|
| `core/GameState.ts` | The one mutable state root, its session slice, dialogue/panel helpers, toasts. |
| `core/stateFactory.ts` | Default persistent state — everything that survives save/load is declared here. |
| `core/EventBus.ts` | `Bus` channels + `CH` names. Changing a channel name changes every listener. |
| `core/Constants.ts` | Tunables: world, difficulty, gather, settlement. |
| `core/Registry.ts`, `core/validateContent.ts` | Content registration and strict validation. |
| `core/BridgeSystem.ts` | Routes gameplay events into quests/achievements. |

### Data (authored content, Phaser-free)
`data/` holds the tables and nothing else: `items*`, `recipes*`, `buildings*`, `enemies*`,
`quests*`, `npcs`, `elites`, `skills`, `factions`, `lootTables`, `region*`, `storyShards`,
`voices`, `worldEvents`, `region` (the region type/vocabulary), `chapters` (the gated
chapter arc) and `policies` (the three banner bargains). A `*A`/`*B` pair is one
registry split for size; the aggregator (`items.ts`, `buildings.ts`, …) is the import.

## Where to add things

| I want to… | Do this |
|---|---|
| Add content (item, enemy, recipe, quest, NPC) | Add to the right `data/` module. Nothing else. If it needs a new field, add it to the type in the same file. |
| Add a new system | New file in `systems/` with the banner, import it where it runs — `WorldScene.update()` for per-frame, `BridgeSystem` for events. Name it in this doc. |
| Add an authored region | New `data/region<name>.ts` (copy `regionAshen.ts` as the shape) + one `registerRegion(...)` call in `systems/RegionRegistry.ts`. No system edits. |
| Add a region interactable kind | Add the kind to `data/region.ts`, then handle it in `RegionInteractables` (or delegate to a new owner like `RegionStory`). |
| Add a world event | Add a row to `data/worldEvents.ts`; the scheduler and runtime already handle roll/cooldown/cleanup. |
| Add or change anything the map shows | `world/mapRender.drawWorldMap` — the one entry point both surfaces call. Ground belongs in `world/mapTerrain.ts`, rules (placement, pinning, labels, region naming, frame budget) in `world/mapView.ts`. A host that paints its own terrain or markers fails `tests/structure.mjs` check 10. |
| Add a UI panel | New file in `app/components/panels/`, export it from `panels/index.ts`, add its case to the panel hub. |
| Change what an action pays | The owning system: kills in `KillReward`, XP/gold/reputation/stamina in `ProgressionXP`, drops in `LootSystem`. Never in an entity. |
| Add a point of interest that should exist in the world | A region's `pois` array (`data/region*.ts`); `PoiRegistry.allPois()` merges it. Only procedural generation goes in `world/worldGen`. |
| Add a screen-space overlay | Go through `ScreenOverlays.addScreenOverlay` — never `setScrollFactor(0)` on a raw object, because the world camera's zoom scales it. |
| Change a gameplay number | It is derived: `ProgressionSystem` (stats) or `Constants`/`data` (tunables). |
| Change when something is offered/unlocked | `QuestSystem.canOfferSideQuest` for quests; the requirement shape (`req` in `data/npcs.ts`) for NPCs. |
| Tune the rendering pipeline (style, art density, contour, night feather) | `core/VisualProfile.ts` — the one switch. The player's choice is pushed in with `setRenderStyle()`; art reads it back through `artScale()` / `terrainScale()` / `contourWidth()` / `lightFeather()`. Declare a knob nothing reads and `tests/structure.mjs` fails. |
| Paint a new sprite sheet | Build it through `makeSheetPaint(w, h)` from `assets/artCore.ts` and draw in **native** frame coordinates — the profile decides the authoring scale, and `registerFrames` keeps every frame displaying at native size. Repainting an existing canvas must reset its transform (`ctx.setTransform(1,0,0,1,0,0)`): structure check 9 enforces it. |
| Make a character or creature look painterly | `assets/sheetsHuman.ts` (people) or `assets/sheetsQuad.ts` (animals): feathered shadow via `featherShadow`, lit form via `radialGrad`, rim light, gameplay contour via `contourWidth('gameplay')`. |

## Size budgets (enforced by `tests/structure.mjs`)

| Area | Budget | Largest today |
|---|---|---|
| `scenes/` | 1000 | `WorldScene.ts` ~940 |
| `data/`, `world/`, `systems/`, `assets/` | 800 | `regionAshen.ts` 771, `chunkPainter.ts` 766 |
| `entities/`, `core/` | 700 | `Enemy.ts` 608 |
| `app/components/**` | 500 | `SettingsPanel.tsx` 455 |

Exceed a budget and the gate fails: split the file by concern (the region, panel, and
system splits are the templates) rather than raising the number.

## Known boundaries worth keeping in mind

- `core/` imports a few `systems/` modules (`GameState` → `LegacyStore`, `SaveSystem`;
  `BridgeSystem` → `QuestEngine`, `AchievementSystem`). That is deliberate: they are the
  persistence and event-routing seams. Don't add more without a reason.
- `QuestSystem.canOfferSideQuest` is the only place the "may this be offered" rule lives.
  The Accept button and the action both call it.
- `types.ts` in `app/components/panels/` is the shared panel vocabulary; a panel that needs
  a new prop adds it there rather than inventing a local shape.
- `assets/artCore.ts` paints each sheet, prop and icon at the profile's `artScale()` (4× when
  painterly, 1× in the pixel style) and keeps the **frames** native via `displayAtNativeSize`,
  so frame rectangles, body sizes, anchors and sprite scales are untouched by the art pipeline.
  The frame grid itself stays 26×34 / 44×30 on purpose — entity collision is authored against
  it, and `drawHumanoidFrame` is also used by the React previews (which scale it themselves).
  Ground chunks use the lower, memory-bounded `terrainScale()`.
- Phaser 4's `RenderConfig` has no `resolution`/DPR knob, so a devicePixelRatio cap cannot be
  wired there. The perf guard for high-density displays belongs in Phase 6.1, not in
  `VisualProfile` (the knob was removed rather than left unread).
