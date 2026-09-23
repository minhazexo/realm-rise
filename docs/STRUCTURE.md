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
| **Bootstrap** | `src/main.tsx`, `src/game/main.ts` | Mounting React, creating the Phaser game, wiring the two. | everything |
| **Phaser layer** | `src/game/scenes/**`, `src/game/entities/**`, `src/game/assets/**`, `src/game/world/**` | Canvas rendering, input surface, cameras, procedural art and chunk painting. | `core`, `data`, `systems` |
| **Systems** | `src/game/systems/**` | ALL behaviour: one file, one job, one owner of its state. | `core`, `data`, `systems` |
| **Pure core & data** | `src/game/core/**`, `src/game/data/**` | Persistent state shape, constants, event bus, and the authored content tables. `data/` is Phaser-free and imports nothing from `systems/`. | `core` ← `data` |

Direction of flow: **data → world → systems → scene → React**. A system never reaches back
into a component; a component never writes persistent state.

`world/` is the PROCEDURAL layer (noise, biome resolution, POI generation, chunk painting).
It sits below `systems/` and must not import one: when a generator product needs authored
content mixed in — the POIs are the case — the merge belongs in a system, not in the
generator (`systems/PoiRegistry` merges `proceduralPois()` with the regions).

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
| `PoiRegistry.ts` | **The one list of points of interest**: the generator's own POIs merged with every authored region's, cached per world seed. Discovery, minimap fog, markers, NPC spawning and quest targets all read this. |
| `SpawnDirector.ts` | Deterministic population of chunks, resource nodes and enemies; elite rolls. |
| `WorldEvents.ts` | Dynamic-event **scheduler** — pure and Phaser-free (roll, cooldown, one live). |
| `WorldEventRuntime.ts` | The scene side of world events: builds, ticks and cleans up the live event. |
| `RaidSystem.ts` | Raid parties, hostile factions and open wars. |
| `KingdomEconomy.ts` | Periodic production/consumption tick, overflow, starvation. |
| `kingdomSim.ts` | Pure kingdom simulation math (no Phaser). |
| `AmbientParticles.ts` | Fireflies, leaves and other ambient particle layers. |
| `particleThrottle.ts` | Respects the player's `particles` setting. |

### Authored regions (the hand-built maps)
| Module | Job |
|---|---|
| `RegionRegistry.ts` | Every authored region the game runs, in registration order. Add a region here. |
| `RegionSystem.ts` | Streams the registered regions over the procedural world, per area. |
| `RegionLayout.ts` | Pure placement and cadence math for a region (node-testable). |
| `RegionState.ts` | Per-scene runtime of the regions + the scene contract they consume. |
| `RegionEncounters.ts` | The region's designed fights. |
| `RegionInteractables.ts` | Places the region's clickables and dispatches the click by kind. |
| `RegionStory.ts` | The narrative spine's world interactions: a Realm Shard, the Fivefold Anchor. |
| `RegionArena.ts` | The region's hostile ground and the boss arena's aftermath. |
| `RegionForeground.ts` | The near-camera foreground band that passes in front of the player. |
| `FogCards.ts` | World-space drifting fog banks. |
| `WaterSystem.ts` | Animated water: wave lines, shore foam, sparkles. |
| `GrassField.ts` | Grass overlay. |
| `NavigationSystem.ts` | World-map navigation: sector, distance, arrival. Pure, session-only. |

### Narrative, quests & voices
| Module | Job |
|---|---|
| `QuestEngine.ts` | Quest reducer (1/2): gameplay event → step progress → completion + rewards. |
| `QuestSystem.ts` | Quest facade (2/2): snapshots, offers, **`canOfferSideQuest` — the single owner of the offer gate**, choices. |
| `StorySystem.ts` | Drives the chapter arc from quest progress. |
| `ShardSystem.ts` | Pure rules of the shard chain: is a fragment held, may it be taken, is the anchor ready. |
| `VoiceSystem.ts` | Where prose shows: the dialogue modal and staggered boss toasts. |
| `AchievementSystem.ts` | Achievements, persisted across playthroughs via LegacyStore. |
| `TutorialSystem.ts` | Guided first minutes. |
| `LegacyStore.ts` | Tiny localStorage payload that survives new games. |

### Combat, entities & progression
| Module | Job |
|---|---|
| `EntityFactory.ts` | Single construction point for world entities (enemies, bosses, NPCs, nodes). |
| `ElementalSystem.ts` | Elements, resistances, status effects. Pure. |
| `WeaponSpecials.ts` | Named legendary abilities, resolved from data. |
| `AutoAttackSystem.ts` | Defensive auto-swing ("counter-attack assist"). |
| `ProjectileSystem.ts` | Every bolt in flight: spawn, travel, collision, destroy. |
| `KillReward.ts` | **What a kill pays**: loot rolls, gold, biome-scaled XP, profession XP, the reward beat, the stamina refund and the kill events. `Enemy.die()` only dies. |
| `BossUISystem.ts` | Boss bar state, its HP refresh, and the boss's intro/defeat lines. |
| `NpcSystem.ts` | NPC spawning, dialogue, recruit/trade actions, wander AI. |
| `LootSystem.ts` | Ground drops: spawn, magnet drift, pickup, expiry. |
| `GatherSystem.ts` | Resource nodes: regrow, proximity, gathering hits, breaking. |
| `ProgressionSystem.ts` | Derived stat engine (1/2) — every gameplay number the player has. |
| `ProgressionXP.ts` | XP, levels, allocations, skills, professions, reputation (2/2). |
| `InventorySystem.ts` | Inventory operations: resources + gear, stacking, equip. |
| `CraftingSystem.ts` | Crafting validation (stations, knowledge) and `idleReason`. |

### Settlement, economy & factions
| Module | Job |
|---|---|
| `BuildSystem.ts` | Construction: sprites, placement validation, construction, upgrades, station auras, demolition. |
| `KingdomSystem.ts` | Kingdom orchestration: snapshot into `session.kingdom`, happiness, recruits. |
| `EconomySystem.ts` | Regional price affinities so exploration pays. |
| `FactionSystem.ts` | Numeric standing with the five powers and its consequences. |

### Input, camera, feel & audio
| Module | Job |
|---|---|
| `InputSystem.ts` | Keyboard/mouse wiring, remappable binds, pause/panel keys. |
| `CameraSystem.ts` | The camera's zoom policy (pure; the scene applies it). |
| `SettingsSystem.ts` | Applies user settings; the single source of truth for them. |
| `EnvSystem.ts` | Day/night light curve, dynamic weather, per-area audio moods. |
| `AudioSystem.ts` | Procedural WebAudio: music beds and the SFX bus. |
| `audioSfx.ts` | The SFX synthesis table (pure). |
| `ambientSounds.ts` | Procedural biome-specific environmental audio. |
| `NightLights.ts` | 2D darkness-with-holes night lighting. |
| `DynamicLights.ts` | Light sources that follow the player and the world. |
| `PostFXSystem.ts` | Bloom, vignette and the rest of the post stack. |
| `ScreenOverlays.ts` | **The single owner of every screen-space overlay** — one zoom-1 UI camera, fit on resize/zoom. |
| `BreathingFX.ts` | Shared idle-breathing helper for characters. |
| `CelebrationFX.ts` | Milestone ceremonies (level-up, discovery). |
| `MinimapSystem.ts` | Player-centred tactical map painted on the React canvas. |

### Persistence
| Module | Job |
|---|---|
| `SaveSystem.ts` | 3 manual slots + autosave, versioned and corruption-tolerant. |

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
`voices`, `worldEvents`, `region` (the region type/vocabulary). A `*A`/`*B` pair is one
registry split for size; the aggregator (`items.ts`, `buildings.ts`, …) is the import.

## Where to add things

| I want to… | Do this |
|---|---|
| Add content (item, enemy, recipe, quest, NPC) | Add to the right `data/` module. Nothing else. If it needs a new field, add it to the type in the same file. |
| Add a new system | New file in `systems/` with the banner, import it where it runs — `WorldScene.update()` for per-frame, `BridgeSystem` for events. Name it in this doc. |
| Add an authored region | New `data/region<name>.ts` (copy `regionAshen.ts` as the shape) + one `registerRegion(...)` call in `systems/RegionRegistry.ts`. No system edits. |
| Add a region interactable kind | Add the kind to `data/region.ts`, then handle it in `RegionInteractables` (or delegate to a new owner like `RegionStory`). |
| Add a world event | Add a row to `data/worldEvents.ts`; the scheduler and runtime already handle roll/cooldown/cleanup. |
| Add a UI panel | New file in `app/components/panels/`, export it from `panels/index.ts`, add its case to the panel hub. |
| Change what an action pays | The owning system: kills in `KillReward`, XP/gold/reputation/stamina in `ProgressionXP`, drops in `LootSystem`. Never in an entity. |
| Add a point of interest that should exist in the world | A region's `pois` array (`data/region*.ts`); `PoiRegistry.allPois()` merges it. Only procedural generation goes in `world/worldGen`. |
| Add a screen-space overlay | Go through `ScreenOverlays.addScreenOverlay` — never `setScrollFactor(0)` on a raw object, because the world camera's zoom scales it. |
| Change a gameplay number | It is derived: `ProgressionSystem` (stats) or `Constants`/`data` (tunables). |
| Change when something is offered/unlocked | `QuestSystem.canOfferSideQuest` for quests; the requirement shape (`req` in `data/npcs.ts`) for NPCs. |

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
