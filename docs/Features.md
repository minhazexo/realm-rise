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
| Auto-attack assist | ✅ | Defensive counter-swing when enemies attack/close in; toggle in Settings → Gameplay; `tests/autoattack.mjs` |
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
| Exploration waypoints | ✅ | Click either map; track discovered locations or home; compass bearing/distance, map pin, clear and arrival notification. Session-only; straight-line guidance, not pathfinding. |

Navigation verification: `node tests/navigation-browser.mjs` starts its own Vite server and uses installed Playwright Chromium to check minimap clicks, marker pixels, compass, clear, world-map clicks and arrival. Pure navigation regression coverage runs with `npm test`.

## Gathering (Fixed) ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Starter axe | ✅ | Stone axe included in starter kit |
| Tool checking | ✅ | Proper object-based equipment lookup |
| Sound feedback | ✅ | Tool-appropriate sounds (chop/mine/gather) |
| Node depletion | ✅ | Visual stump/empty states, regrow timer |

## Incomplete / Known Issues

See `docs/TODOs.md` for the full list.

## Game Feel (Quality Pass 1) ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Level-up ceremony | ✅ | Ring shockwave + gold pulse + banner + zoom punch (`CelebrationFX`) |
| Kill reward beat | ✅ | XP float anchored at corpse; bosses burst |
| Idle breathing | ✅ | Player + enemies, scale-y micro-oscillation, reduced-motion aware |
| Attack anticipation | ✅ | 50 ms squash before the slash arc; heavies squash deeper |
| Projectile trails | ✅ | Arrow after-images every 40 ms, skipped on low quality |
| Gather chips | ✅ | Per-hit particles tinted by yielded resource |
| Combat camera bias | ✅ | 4% zoom-out while `inCombat`, smooth lerp |
| Boss arena ring | ✅ | Pulsing ground ring shows the leash radius |
| Biome danger XP | ✅ | Kill XP × biome `dangerMult` (1.25–1.6) |
| Parry buff | ✅ | +12 stamina, 0.2 s counter window |
| Night-only despawn | ✅ | Undead fade at dawn instead of freezing |
| Goblin flee | ✅ | `cowardly` wired to `fleeBelowHpPct: 0.35` |
| Raid columns | ✅ | Raiders march staggered, two abreast |
| Floater pool | ✅ | 24 reused Text objects (was ~20 allocs/s in sieges) |
| Foam fast pass | ✅ | 32px grid while camera holds; fine pass on 64px move |
