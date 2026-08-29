# Architecture — How Everything Connects

---

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    GameState (singleton)                  │
│  .state = persistent data (player, inventory, world...)  │
│  .session = runtime UI (screen, panel, dialogue...)      │
│  .notify(channels) = emit Bus events                     │
└──────────┬────────────────────┬──────────────────────────┘
           │                    │
     ┌─────▼─────┐      ┌──────▼──────┐
     │   Phaser    │      │    React     │
     │  (game loop)│      │  (UI shell)  │
     └─────┬──────┘      └──────┬───────┘
           │                    │
     ┌─────▼─────┐      ┌──────▼──────┐
     │  Systems   │      │ Components  │
     │ (mutate S) │◄────►│ (read only) │
     └───────────┘      └─────────────┘
           │
     ┌─────▼─────────┐
     │   EventBus     │
     │  Bus.emit()    │
     │  Bus.on()      │
     └───────────────┘
```

## Phaser ↔ React Bridge

1. **Phaser** runs the game loop → systems mutate `GameState.s` / `GameState.session`
2. After mutation: `GameState.notify(CH.PLAYER)` → `Bus.emit('PLAYER')`
3. **React** components call `useGameState([CH.PLAYER], selectFn)`
4. `useGameState` subscribes to Bus channels → re-renders when notified
5. React components are **read-only** — they call `GameState.notify()` to request changes, never mutate directly

## WorldScene Structure

```
WorldScene.create()
├── buildAllAssets(scene)      → Generate all textures
├── Player(scene, x, y)        → Create player sprite + physics
├── EnvSystem(scene)           → Day/night, weather, survival drains
├── setupInput()               → Keyboard + mouse bindings
├── setupProjectiles()         → Arrow/fireball pool
├── setupLoot()                → Drop pickup system
├── syncBuildingsFromState()   → Render saved buildings
├── spawnWildNpcs()            → Place NPCs at POIs
├── syncPoisMarkers()          → Label discovered POIs
└── refreshPlayerSkin()        → Apply appearance to sprite

WorldScene.update(time, delta)
├── env.update(dt)             → Weather, time, hunger/thirst
├── player.update(dt, input)   → Movement, combat, survival
├── updateChunks()             → Stream in/out terrain
├── enemies[].update()         → AI for nearby enemies
├── updateProjectiles(dt)      → Arrow/ fireball movement + collision
├── updateLoot(px, py)         → Auto-pickup nearby drops
├── updateGatherProximity()    → Detect nearest gather node
├── updatePoiProximity()       → Discover nearby POIs
├── updateNpcs()               → Sort NPC depth
├── gatherTick(dt)             → Regrow depleted nodes
├── floats.update(dt)          → Floating text lifecycle
└── updateMinimap(px, py)      → Draw terrain/enemies/player on canvas
```

## State Shape

```javascript
GameState.s = {
  meta: { version, seed, playSeconds, createdAt },
  player: { name, level, xp, hp, stamina, hunger, thirst, gold,
            equipment: { weapon, offhand, helmet, chest, gloves, boots, ring, amulet },
            alloc: { strength, defense, agility, intellect, willpower },
            professions: { woodcutting, mining, survival, combat, crafting },
            derived: { maxHp, maxStamina, moveSpeed, damageReduction, ... },
            skills: { skillId: rank }, reputation, gender, appearance },
  inventory: [{ id, qty, iid?, dur? }],
  settlement: { founded, pos, stageIndex, buildings[], citizens[], military, happiness },
  world: { px, py, discoveredPois[], poiStates{}, ownedCamps[], activeWeather, timeOfDay },
  quests: { chainIndex, stepIdx, progress{}, sideActive[], sideCompleted[] },
  story: { chapter, flags{}, journal[] },
  factions: { iron, verdant, league, ashen, ancient },
  achievements: { id: timestamp },
  settings: { difficulty, volumes, toggles, uiScale, autosave }
}

GameState.session = {
  screen: 'boot'|'menu'|'creation'|'intro'|'world',
  uiPanel: 'inventory'|'crafting'|'map'|null,
  dialogue: { npc, name, portrait, lines, actions } | null,
  nearNode: { uid, type, x, y, def, hp, depleted } | null,
  activeBoss: { name, hp, maxHp, phase } | null,
  inCombat: boolean, paused: boolean, dead: boolean,
  pendingBuild: { key } | null, buildModeGhost: Sprite | null,
  joystick: { dx, dy, active } | null
}
```

## File Structure

```
src/
├── main.jsx                    → React entry, mounts App + Phaser
├── styles.css                  → All UI styles (glass panels, HUD, overlays)
├── app/
│   ├── App.jsx                 → Top-level React shell, routes to components
│   └── components/             → 18 React components (HUD, Panels, etc.)
├── game/
│   ├── main.js                 → Phaser config, setScreen(), startNewGame()
│   ├── core/                   → GameState, EventBus, Constants, BridgeSystem
│   ├── entities/               → Player, Enemy, BossEnemy classes
│   ├── scenes/                 → MenuScene, WorldScene
│   ├── systems/                → 18 game systems
│   ├── data/                   → Items, recipes, quests, enemies, NPCs, buildings, skills, factions
│   ├── assets/                 → Procedural art: textures, sprites, icons, sheets
│   └── world/                  → World gen, biomes, chunk painting, node types
├── hooks/
│   └── useGameState.js         → React ↔ GameState bridge hook
├── utils/
│   └── math.js                 → Noise, RNG, helpers
└── tests/
    ├── smoke.mjs               → Data integrity + math tests
    └── systems.mjs             → Systems integration round-trip
```
