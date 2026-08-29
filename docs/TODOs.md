# TODOs — Known Issues & Improvements

Known bugs, incomplete features, and improvement ideas.

---

## 🔴 Critical (Game-Breaking)

None currently — all critical bugs have been fixed.

## 🟡 Moderate (Functional but Polished)

| # | Issue | Location | Fix Effort |
|---|-------|----------|------------|
| 1 | ~~DebugPanel not toggleable~~ — ✅ Fixed: F3 key toggles, live data refresh | `DebugPanel.jsx` | Done |
| 2 | **Panels.jsx item equip/unequip** — UI buttons exist but equip flow not tested end-to-end | `Panels.jsx` | Medium |
| 3 | **DeathOverlay** — respawn works but doesn't properly restore enemy state after death | `DeathOverlay.jsx` | Medium |
| 4 | **Building HP** — buildings have HP but no attack/damage system for raids | `WorldScene.js` | High |
| 5 | **Node solid HP** — uses array `[10,8]` from nodeTypes but WorldScene only uses first element | `WorldScene.js` | Low |
| 6 | ~~Weather visual effects~~ — ✅ Done: rain, snow, fog wisps, heat shimmer, lightning flashes | `EnvSystem.js` | Done |
| 7 | ~~NPC dialogue variety~~ — ✅ Done: NPCs wander with 3-state AI | `npcs.js` | Done |
| 8 | **Trading economy balance** — buy/sell spreads may be too generous/stingy | `EconomySystem.js` | Low |
| 9 | **Faction war system** — war/hostile states tracked but no actual invasion events | `FactionSystem.js` | High |
| 10 | **LegacyStore (NG+)** — system exists but has no content | `LegacyStore.js` | Medium |

## 🟢 Nice-to-Have (Polish & Content)

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 1 | Weather particles | Visual rain, snow, fog overlays in WorldScene | Medium |
| 2 | Ambient sound system | Wind, water, forest sounds per biome | Medium |
| 3 | ~~NPC walking AI~~ | ✅ Done: 3-state wander AI with walk animation | Done |
| 4 | ~~Building placement validation~~ | ✅ Done | Done |
| 4 | ~~Building placement validation~~ | ✅ Done | Done |
| 5 | Minimap legend | Color key showing biome meanings | Low |
| 6 | Inventory tooltips | Hover to see item stats/descriptions | Low |
| 7 | Key binding customization | Let players rebind keys | Medium |
| 8 | Video settings | Resolution, fullscreen, FPS cap | Medium |
| 9 | Achievement notifications | Visual popup on unlock (currently just toast) | Low |
| 10 | Tutorial system | Guided first 5 minutes for new players | High |
| 11 | Save export/import | JSON download/upload for saves | Low |
| 12 | Enemy spawn zones | Prevent spawning too close to settlement | Low |
| 13 | Screen shake on hits | Configurable camera shake | Low |
| 14 | Pickup animation | Items fly toward player on collect | Low |
| 15 | Minimap zoom levels | Scroll to zoom in/out | Medium |

## Code Quality

| # | Issue | Location | Fix Effort |
|---|-------|----------|------------|
| 1 | `nodeHasTicks` variable assigned but never used | `WorldScene.js:316` | Trivial |
| 2 | `kingdomPct()` defined both as method and module function | `WorldScene.js` | Low |
| 3 | Vite dynamic import warnings (ineffective imports) | Various | Low |
| 4 | Some `for...of` loops could be `Array.forEach` for consistency | Various | Trivial |
| 5 | `GATHER_CONFIG_TICK_XP` is both a const and in Constants.js | `WorldScene.js` | Trivial |
