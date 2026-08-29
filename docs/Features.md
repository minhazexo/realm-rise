# Features — Completion Checklist

Status of every major feature in the game.

---

## Core Gameplay ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Procedural world gen | ✅ | 8 biomes, noise-driven elevation/moisture/temp |
| Chunk streaming | ✅ | 512px chunks, radius-3 active set |
| Player movement | ✅ | WASD + mouse, sprint, dodge roll |
| Melee combat | ✅ | Light/heavy attacks, arc-based, knockback |
| Ranged combat | ✅ | Arrow/projectile system, pierce |
| Blocking/shields | ✅ | Stamina-based, damage reduction |
| Equipment system | ✅ | 8 slots, durability, stat mods |
| Gathering | ✅ | 20 node types, tool requirements, yield scaling |
| Crafting | ✅ | 45 recipes, station requirements, tiered tools |
| Inventory | ✅ | Stackable items, slot cap, storage buildings |
| Survival mechanics | ✅ | Hunger, thirst, cold exposure, HP regen |
| Day/night cycle | ✅ | 520s cycle, night enemy buff |
| Weather system | ✅ | Clear/rain/storm, temperature effects |
| Save/load | ✅ | 3 slots + autosave + crash recovery |

## World & Exploration ✅

| Feature | Status | Notes |
|---------|--------|-------|
| 8 biomes | ✅ | Plains, forest, desert, frozen, swamp, mountains, volcanic, riverlands |
| 30+ POIs | ✅ | Ruins, camps, shrines, dens, story locations |
| 20 gather node types | ✅ | Trees, rocks, ores, herbs, berries, etc. |
| Procedural art | ✅ | All textures generated at runtime |
| Procedural audio | ✅ | Music + SFX via Web Audio API |

## Combat & Enemies ✅

| Feature | Status | Notes |
|---------|--------|-------|
| 11 enemy types | ✅ | Wolves, boars, bears, goblins, skeletons, bandits |
| 4 bosses | ✅ | Alpha Wolf, Bandit King, Ancient Guardian, dire variants |
| Boss multi-phase | ✅ | HP-based phase transitions, enrage, summons |
| Enemy AI | ✅ | Chase, attack, flee, night-only variants |
| Loot drops | ✅ | Gold, items, with pickup radius |
| Crit/dodge system | ✅ | Agility-based crit, stamina-based dodge |

## Building & Kingdom ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Town Hall placement | ✅ | Founding moment, auto-recruit 2 citizens |
| 23 building types | ✅ | Farm, forge, barracks, market, temple, etc. |
| 7 settlement stages | ✅ | Camp → Homestead → Village → Town → City → Kingdom → Empire |
| Citizen recruitment | ✅ | NPCs join, job assignment |
| Production ticks | ✅ | Buildings produce resources over time |
| Military units | ✅ | Militia, swordsman, archer, cavalry, knight |
| Territory control | ✅ | Bandit camp capture, 18 territories |

## Quests & Story ✅

| Feature | Status | Notes |
|---------|--------|-------|
| 8-chapter main story | ✅ | Progressive narrative with choice points |
| 7 side quests | ✅ | NPC-given, various types |
| Quest tracker HUD | ✅ | Step-by-step progress display |
| Choice consequences | ✅ | Branching endings (conqueror/diplomat/sage) |
| Faction reputation | ✅ | 5 factions with diplomacy states |

## UI & UX ✅

| Feature | Status | Notes |
|---------|--------|-------|
| HUD (health, stamina, etc.) | ✅ | Bars, level, gold |
| Inventory panel | ✅ | Grid with filtering/sorting |
| Crafting panel | ✅ | Recipe list with station check |
| Journal/quest panel | ✅ | Active quest display |
| Kingdom panel | ✅ | Buildings, citizens, military |
| Map panel | ✅ | Full-screen map |
| Dialogue system | ✅ | NPC portraits, choices, actions |
| Boss bar | ✅ | HP bar + phase indicator |
| Touch controls | ✅ | Mobile joystick + action buttons |
| Death overlay | ✅ | Respawn from save |
| Toast notifications | ✅ | Quest, discovery, combat toasts |
| Character creation | ✅ | Name, gender, appearance, personality |
| Main menu | ✅ | New game, continue, settings |
| Settings panel | ✅ | Volume, toggles, difficulty |

## Minimap ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Canvas minimap | ✅ | Terrain colors, POI dots, enemy dots, player marker |

## Gathering (Fixed) ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Starter axe | ✅ | Stone axe included in starter kit |
| Tool checking | ✅ | Proper object-based equipment lookup |
| Sound feedback | ✅ | Tool-appropriate sounds (chop/mine/gather) |
| Node depletion | ✅ | Visual stump/empty states, regrow timer |

## Incomplete / Known Issues

See `docs/TODOs.md` for the full list.
