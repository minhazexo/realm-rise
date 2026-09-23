# Architecture — How Everything Connects

> This file explains the **data flow** (state → bus → UI, the game loop).
> For the **file map** — which module owns what, where new code belongs, the layer
> rules and the size budgets — see [STRUCTURE.md](./STRUCTURE.md).

> Rewritten 2026-09: the previous copy of this file was saved as UTF-16 with
> null bytes and rendered unreadable in every editor. This version restores
> the original content from the readable fragments and updates it to match
> the current TypeScript codebase (systems are `.ts`, docs cross-links live
> in `docs/improvements/`).

---

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  GameState (singleton)                                          │
│   .state   = persistent data (player, inventory, world, …)      │
│   .session = runtime UI (screen, panel, dialogue, …)            │
│   .notify(channels) = emit Bus events                           │
└─────────────────────────────────────────────────────────────────┘
              ▲ mutate                          │ notify
              │                                 ▼
┌───────────────────────────┐        ┌───────────────────────────┐
│  Phaser (game loop)       │        │  React (UI shell)         │
│  (scenes/entities)        │        │  (HUD, panels, overlays)  │
└───────────────────────────┘        └───────────────────────────┘
              ▲                                  │
              └────────── EventBus ──────────────┘
                     Bus.emit() / Bus.on()
```

## Phaser ↔ React Bridge

1. **Phaser** runs the game loop — systems mutate `GameState.s` /
   `GameState.session`.
2. After mutation: `GameState.notify(CH.PLAYER)` → `Bus.emit('player')`.
3. **React** components call `useGameState([CH.PLAYER], selectFn)`.
4. `useGameState` subscribes to Bus channels → re-renders when notified.
5. React components are **read-only** — they call `GameState.notify()` /
   `sceneCommand()` to request changes, never mutate gameplay state directly.

## WorldScene Structure

```
WorldScene.create()
  ├─ buildAllAssets(scene)          // generate all textures
  ├─ Player(scene, x, y)            // create player sprite + physics
  ├─ EnvSystem(scene)               // day/night, weather, survival drains
  ├─ WaterSystem / PostFXSystem     // atmosphere + camera FX
  ├─ setupInput()                   // keyboard + mouse bindings (InputSystem)
  ├─ setupProjectiles() / setupLoot()
  ├─ syncBuildingsFromState()       // render saved buildings
  ├─ spawnWildNpcs()                // place NPCs at POIs
  ├─ syncPoisMarkers()              // label discovered POIs
  └─ refreshPlayerSkin()            // apply appearance to sprite

WorldScene.update(time, delta)
  ├─ env.update(dt)                        // weather, time, hunger/thirst
  ├─ player.update(dt, input)              // movement, combat, survival
  ├─ updateChunks()                        // stream in/out terrain
  ├─ enemies[].update()                    // AI for nearby enemies
  ├─ updateProjectiles(dt)                 // arrow/fireball movement
  ├─ updateLoot(px, py)                    // auto-pickup nearby drops
  ├─ updateGatherProximity(px, py)         // detect nearest gather node
  ├─ updatePoiProximity(px, py)            // discover nearby POIs
  ├─ updateNpcs(dt)                        // wander AI + depth sort
  ├─ gatherTick(dt)                        // regrow depleted nodes
  ├─ floats.update(dt)                     // floating text lifecycle
  └─ updateMinimap(px, py)                 // draw tactical map (every 6th frame)
```

## State Shape

```js
GameState.s = {
  meta: { version, seed, playSeconds, createdAt },
  player: { name, level, xp, hp, stamina, hunger, thirst, gold,
            equipment: { weapon, offhand, helmet, chest, gloves, boots, ring, amulet },
            alloc: { strength, defense, agility, intellect, willpower },
            professions: { woodcutting, mining, survival, combat, crafting },
            derived: { maxHp, maxStamina, moveSpeed, damageReduction, … },
            skills: { skillId: rank }, reputation, gender, appearance },
  inventory: [{ id, qty, iid?, dur? }],
  settlement: { founded, pos, stageIndex, buildings[], citizens[], military, happiness },
  world: { px, py, discoveredPois[], poiStates{}, ownedCamps[], activeWeather, timeOfDay },
  quests: { chainIndex, stepIdx, progress{}, sideActive[], sideCompleted[] },
  story: { chapter, flags{}, journal[] },
  factions: { iron, verdant, league, ashen, ancient },
  achievements: { id: timestamp },
  settings: { difficulty, volumes, toggles, uiScale, autosave, … }
}

GameState.session = {
  screen: 'boot'|'menu'|'creation'|'intro'|'world',
  uiPanel: 'inventory'|'crafting'|'map'|null,
  dialogue: { npc, name, portrait, lines, actions } | null,
  nearNode: { uid, type, x, y, def, hp, depleted } | null,
  activeBoss: { name, hp, maxHp, phase } | null,
  inCombat: boolean, paused: boolean,
  pendingBuild: { key } | null, buildGhost: Sprite | null,
  joystick: { dx, dy, active } | null
}
```

## File Structure

```
src/
├─ main.tsx                 // React entry, mounts App + Phaser
├─ styles.css               // All UI styles (glass panels, HUD, overlays)
├─ app/
│  ├─ App.tsx               // Top-level React shell, routes to components
│  └─ components/           // HUD, Panels, Minimap, Toasts, …
├─ game/
│  ├─ main.ts               // Phaser config, setScreen(), startNewGame()
│  ├─ core/                 // GameState, EventBus, Constants, BridgeSystem,
│  │                        // Registry (strict data registries), stateFactory
│  ├─ entities/             // Player, Enemy, BossEnemy classes
│  ├─ scenes/               // MenuScene, WorldScene
│  ├─ systems/              // 30+ game systems (see docs/Systems.md)
│  ├─ data/                 // Items, recipes, quests, enemies, NPCs,
│  │                        // buildings, skills, factions, loot tables
│  ├─ assets/               // Procedural art: textures, sprites, icons, sheets
│  └─ world/                // World gen, biomes, chunk painter, node types
├─ hooks/
│  └─ useGameState.ts       // React ↔ GameState bridge hook
└─ utils/
   └─ math.ts               // Noise, RNG, helpers
```

## Key conventions

- **Systems are Phaser-free** where possible: `systems/*.ts` take the scene as
  an argument ("scene-context functions"). Entity classes are *injected* into
  `EntityFactory`/`SpawnDirector` so node tests can stub them.
- **Balance values live in `core/Constants.ts`** (spec §79–80).
- **Strict registries** (`core/Registry.ts`): duplicate data keys throw at
  load instead of silently overwriting.
- **Settings discipline**: only `SettingsSystem.applySettings()` touches
  DOM/audio side-effects; consumers read via `getSetting()` helpers.
- Docs: feature status in `docs/Features.md`, systems reference in
  `docs/Systems.md`, known issues in `docs/TODOs.md`, quality audits and
  ongoing passes in `docs/improvements/`.
