# Architecture — Data-Driven Kingdom Game

> Status: living document. Registry rollout (all 7 content domains),
> 5 system extractions (Loot/Build/Minimap/Spawn/Input), EntityFactory,
> UI discipline, versioned saves, and the `window.rise` debug console have
> all landed. See `MIGRATION_PLAN.md` for the remaining backlog (Phases 4–7
> items still open). `Architecture.md` (original) documents the runtime
> bridge and state shape; this file documents the data-driven layer.

## 1. The big picture

```
┌────────────────────────────── DATA (pure, no Phaser) ──────────────────────┐
│ data/*.js + world/nodeTypes + biomeTable  →  Registry-validated definitions │
│ core/Constants.js (balance) · core/Registry.js (strict lookup)              │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │  getX(id) → frozen def | null
┌────────────────────────────── SYSTEMS (pure logic) ────────────────────────┐
│ Inventory · Crafting · Progression · Quests · Kingdom · Factions · ...      │
│ Input: defs + GameState · Output: mutated GameState + Bus events            │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │  GameState.s (persistent) / .session (runtime)
┌────────────────────────────── PRESENTATION ────────────────────────────────┐
│ Phaser: WorldScene (coordination) · Player/Enemy (render+input) · assets/*  │
│ React:  HUD · Panels · Overlays (read via useGameState, write via systems) │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Rule of flow:** data → systems → state → presentation. Presentation never
owns balance numbers; systems never touch the DOM/canvas directly (they emit
`Bus` events or write floats through `session.floatRenderer`).

## 2. Layers and what lives where

| Layer | Path | May import | Must never import |
|---|---|---|---|
| Data defs | `game/data/*`, `game/world/nodeTypes.js`, `biomeTable.js` | `core/Registry`, sibling data, `utils/math` | Phaser, GameState, systems |
| Core | `game/core/*` (GameState, Registry, EventBus, Constants, validateContent) | utils, data (validate only) + accepted GameState↔SaveSystem/SettingsSystem live-binding cycle (runtime-deferred, tested) | Phaser, React |
| Systems | `game/systems/*` (35 files: sim + extracted scene systems + factory) | core, data, utils (+ injected entity classes, never imports) | Phaser scenes, React (InputSystem is the documented browser-only exception) |
| Entities | `game/entities/*` | core, data, systems (read-only helpers) | React |
| Assets | `game/assets/*` | data (to enumerate), artCore | GameState |
| Scenes | `game/scenes/*` | everything except React | React |
| UI | `app/components/*` | core, systems (service fns), data (labels) | Phaser |
| Shared render | `game/world/mapRender.js` | worldGen, biomeTable | Phaser, GameState |

## 3. Data-driven content model

Every content domain follows the same shape:

```
data/<domain>PartA.js, data/<domain>PartB.js   ← split authoring files
data/<domain>.js                                ← aggregator: Registry + getters
```

- Authoring files export plain maps/arrays. They contain **no logic**.
- The aggregator merges sources with `Registry.defineSources()` — a key
  defined in two files **throws at load** (previously `Object.assign`
  silently let the later file win).
- Lookups: `get(id)` → frozen def or `null`. Gameplay code uses `?.` with
  sane fallbacks; loading code uses `require(id)` which throws.
- Schemas live as JSDoc typedefs next to the data (`NodeTypeDef`,
  `BiomeEntry`, …). See `DATA-SCHEMAS` section in `ADDING-CONTENT.md`.

Domains and their getters:

| Domain | Aggregator | Getter | Instance factory |
|---|---|---|---|
| Items | `data/items.js` | `getItem(id)` | `newInstance(id)` (gear vs stack) |
| Enemies | `data/enemies.js` | `getEnemyDef(key)` | `WorldScene.spawnEnemy` (boss branch) |
| Buildings | `data/buildings.js` | `getBuildingDef(key)` | placement via Kingdom systems |
| NPCs | `data/npcs.js` | `getNpcDef(key)` | `WorldScene.spawnNpc` |
| Nodes | `world/nodeTypes.js` | `getNodeDef(type)` | `WorldScene.spawnNode` |
| Recipes | `data/recipes.js` | `getRecipeById(id)` | `craft(id)` |
| Skills | `data/skills.js` | `SKILL_MAP[id]` | `learnSkill(id)` |
| Factions | `data/factions.js` | `getFactionDef(key)` | — |
| Quests | `systems/QuestEngine.allDefs()` | direct map index | `offerSideQuest/completeQuest` |

## 4. Components (pragmatic composition, not ECS)

Entities compose small behaviors rather than inheriting giant bases:

- `Enemy` = health + movement + combat + AI states + loot table ref.
- A gather node = health pips + harvest yield + depletion/respawn state.
- A chest = interactable + lootable.
- `Player` = health/stamina + movement + combat + survival + equipment.

New mechanics go in **new files under `systems/`**, not in `WorldScene`.
`WorldScene` (≈1000 lines after the Phase-3 extractions, down from ~1770)
is only allowed to *coordinate*: create → delegate → render. Extracted:
`LootSystem`, `BuildSystem`, `MinimapSystem`, `SpawnDirector`,
`InputSystem`, plus `EntityFactory` for construction. See migration plan.

## 5. Events

`core/EventBus.js` (`Bus` + `CH` channels). Convention:

- **State channels** (`CH.PLAYER`, `CH.INVENTORY`, …): emitted via
  `GameState.notify(...)` after mutation; React re-renders.
- **Fire-and-forget** (`'play-sound'`, `'enemy-killed'`, `'crafted'`, …):
  consumed by `BridgeSystem` (→ quest engine), `AudioSystem`, `Toasts`.
- UI talks to the sim by calling **system functions or `sceneCommand()`**,
  never by reaching into entity internals. (The Phase-4 audit found
  violations in `Panels.jsx` trade/DebugPanel — all routed through
  `EconomySystem`/`ProgressionXP` services; `tests/uidiscipline.mjs`
  enforces the rule.)

## 6. Save/load

`SaveSystem.serialize()` whitelists persistent branches; session junk never
persists. `meta.version` is stamped from `Constants.VERSION`. Versioned
loading (shipped, see `SAVE-SYSTEM.md`):

```
load() → check meta.version → run migrations[] → repair → normalise → play
```

Rules: never serialize Phaser objects; only IDs + counts + positions;
cap unbounded arrays (`exploredChunks` already capped at 3000 in
`WorldScene.updateChunks`).

## 7. Validation

`core/validateContent.js` + `tests/content.mjs` (runs in `npm test`):

- duplicate IDs across split sources,
- dangling refs: recipes→items, loot→items, nodes→items, biomes→nodes/enemies,
  skills→branches/prereqs, quests→items/enemies/buildings, icons→drawers.

Errors fail the build. Runtime asset keys (textures) are validated
warn-and-skip at build time (`icons.js`, `assets/index.js`) — a headless
texture-presence test is future work.

## 8. Performance stance

Chunk streaming + painter cache, pooled floaters/FX (auto-destroy),
throttled background ticks (`% 30/60/300/1800` cadences in `update()`),
distance-culled AI (1250px full / 1800px reduced), capped arrays. No
framework heavier than this until profiling says so.
