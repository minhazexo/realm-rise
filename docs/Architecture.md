# Architecture — How Everything Connects

> This file explains the **data flow** (state → bus → UI, the game loop).
> For the **file map** — which module owns what, where new code belongs, the layer
> rules and the size budgets — see [STRUCTURE.md](./STRUCTURE.md).

> Rewritten 2026-09: the previous copy of this file was saved as UTF-16 with
> null bytes and rendered unreadable in every editor. This version restores
> the original content from the readable fragments and updates it to match
> the current TypeScript codebase (systems are `.ts` under one folder per
> concern; the doc index is `docs/README.md`).

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

The scene is a **coordinator**: it owns the display list, the cameras and the
per-frame order, and everything listed below is a call into `systems/`. The
order is the contract — reordering it changes gameplay, not just timing.

```
WorldScene.create()                                  // one-time wiring, in order
  ├─ buildAllAssets(scene)                           // generate every texture
  ├─ configureSpawning({ Enemy, BossEnemy })         // inject entity constructors
  ├─ camera bounds · depth layers · Player · recompute() derived stats
  ├─ EnvSystem → create()                            // day/night, weather, drains
  ├─ GrassField · WaterSystem · PostFXSystem → create()
  ├─ createBossUI(scene)                             // boss bar state
  ├─ setupInput() · setupProjectiles() · setupLoot()
  ├─ syncBuildingsFromState() · spawnWildNpcs()
  ├─ placeRegion(scene) · resetRegionTravel()        // the authored region
  ├─ setAuthoredStations(regionStations())           // the hub's own stations
  ├─ syncPoisMarkers() · refreshPlayerSkin() · refreshStationsNear()
  ├─ timers: productionTick, autosave (rebuilt on 'settings-applied')
  └─ Bus.on(level-up…) + 'shutdown' teardown (unsubscribes, chunk textures)

WorldScene.update(_time, delta)                      // per-frame order
  ├─ immortal guard · dt = min(0.05, delta/1000) · paused gate
  ├─ env.update(dt)                                  // weather, time, hunger/thirst
  ├─ player.update(dt, envContextInput())            // movement, combat, survival
  ├─ autoAttackTick(scene, dt)                       // counter-swing assist
  ├─ grassField.update(dt)
  ├─ chunkStream.updateChunks(scene)                 // stream terrain in/out
  ├─ dynamic lights (0.5 s) · followPlayerLights     // campfires, held torch
  ├─ waterSystem.update · updateAmbientParticles · updateFogCards
  ├─ tutorialTick (5 s) · 'player-pos' broadcast (30 Hz)
  ├─ enemies[].update(dt) for the near ones · enemyRaidTick
  ├─ raidTick (30 s) · session.inCombat
  ├─ updateProjectiles(dt) · updateLoot(px, py)
  ├─ updateGatherProximity(px, py) · updatePoiProximity(px, py)
  ├─ updateRegion(scene, px, py, dt) · tickRegionTravel(px, py)
  ├─ tickWorldEvents(scene, px, py, dt)              // scheduler → runtime
  ├─ updateNpcs(dt, px, py) · gatherTick(dt)
  ├─ building occlusion fade (10 Hz) · floats.update(dt)
  ├─ updateMinimap(px, py) (10 Hz) · ambient biome audio (2 s)
  ├─ refreshBossBar + save world.px/py (0.5 s)
  ├─ applyCamZoom(dtMs) · fitScreenLayer(scene)      // zoom, then re-fit overlays
  ├─ updateNightMask (15 Hz)                         // darkness-with-holes
  ├─ refreshStationsNear · relightChunks · kingdomRefresh · raidResolveCheck (1 s)
  └─ factionTick (60 s)                              // diplomacy drift
```

The cadences are written down because they are deliberate: a per-frame call for
an 0.5-second job is the regression this list exists to catch.

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
├─ global.d.ts              // window.riseGame / window.rise types
├─ app/
│  ├─ App.tsx               // Top-level React shell, routes to components
│  └─ components/           // the React surface, one folder per concern:
│     ├─ hud/               // HUD, Toasts, TouchControls, DeathOverlay
│     ├─ overlays/          // Overlays.tsx — dialogue, quest tracker, minimap,
│     │                     // boss bar, zoom, first-steps hints
│     ├─ panels/            // the panel files + index.ts, shared.tsx, types.ts
│     ├─ screens/           // menu, creation, intro, how-to, credits, ruler
│     ├─ debug/             // DebugPanel.tsx (dev-only)
│     ├─ Panels.tsx         // the panel hub: frame + dispatch, nothing else
│     └─ SettingsPanel.tsx  // the one settings surface
├─ game/
│  ├─ main.ts               // Phaser config, setScreen(), startNewGame(),
│  │                        // device-pixel ratio + visual profile
│  ├─ core/                 // GameState, EventBus, Constants, BridgeSystem,
│  │                        // Registry, stateFactory, VisualProfile,
│  │                        // validateContent
│  ├─ entities/             // Player, Enemy, BossEnemy classes
│  ├─ scenes/               // WorldScene (coordinator), MenuScene,
│  │                        // menuBackdrop, chunkStreaming
│  ├─ systems/              // ALL behaviour, grouped by concern:
│  │  ├─ combat/            // entities, weapons, elements, loot, gathering,
│  │  │                     // NPCs, progression, inventory, crafting
│  │  ├─ world/             // streaming, POIs, regions, world events, raids,
│  │  │                     // kingdom sim, navigation, ambient nature
│  │  ├─ narrative/         // quests, story, shards, achievements, voices,
│  │  │                     // tutorial, legacy store
│  │  ├─ economy/           // building, kingdom, factions, regional prices
│  │  ├─ environment/       // input, camera, settings, env/weather, lighting,
│  │  │                     // post FX, overlays, minimap, feel
│  │  ├─ audio/             // AudioSystem, audioSfx, ambientSounds
│  │  └─ persistence/       // SaveSystem
│  ├─ data/                 // Items, recipes, quests, enemies, NPCs,
│  │                        // buildings, skills, factions, loot tables, region*
│  ├─ assets/               // Procedural art: textures, sprites, icons, sheets
│  └─ world/                // World gen, biomes, chunk painter + fog, map render
├─ hooks/
│  └─ useGameState.ts       // React ↔ GameState bridge hook
└─ utils/
   └─ math.ts               // Noise, RNG, helpers
```

## Key conventions

- **Systems are Phaser-free** where possible: `systems/<concern>/*.ts` take the
  scene as an argument ("scene-context functions"). Entity classes are
  *injected* into `EntityFactory`/`SpawnDirector` so node tests can stub them.
- **Balance values live in `core/Constants.ts`** (spec §79–80).
- **Strict registries** (`core/Registry.ts`): duplicate data keys throw at
  load instead of silently overwriting.
- **Settings discipline**: only `SettingsSystem.applySettings()` touches
  DOM/audio side-effects; consumers read via `getSetting()` helpers.
- Docs: `docs/README.md` is the index. The file map is `docs/STRUCTURE.md`
  (`tests/structure.mjs` reads it and fails when it goes stale), the runtime
  flow is this file, the build order and its status are `docs/ROADMAP.md`, and
  `docs/AI_RULES.md` is mandatory reading before a change.
