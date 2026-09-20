# TODOs — Known Issues & Improvements

Known bugs, incomplete features, and improvement ideas.

---

## 🔴 Critical (Game-Breaking)

None currently — all critical bugs have been fixed.

## 🟡 Moderate (Functional but Polished)

| # | Issue | Location | Fix Effort |
|---|-------|----------|------------|
| 1 | **Build-card click doesn't engage placement mode reliably** — panel closes but no ghost/toast follows (verified identical on pre-extraction code, so pre-existing, not a migration regression). Direct `enterBuildMode` + handler-emitted pointer events found a settlement correctly end-to-end, so `BuildSystem` itself is sound; suspect React→canvas dispatch or synthetic-input delivery. Repro: B → click any build card → move mouse (expect green/red ghost). | `Panels.jsx` BuildPanel / `main.js` sceneCommand | Medium |
| 2 | ~~DebugPanel not toggleable~~ — ✅ Fixed: F3 key toggles, live data refresh | `DebugPanel.jsx` | Done |
| 3 | **Panels.jsx item equip/unequip** — UI buttons exist but equip flow not tested end-to-end | `Panels.jsx` | Medium |
| 4 | **DeathOverlay** — respawn works but doesn't properly restore enemy state after death | `DeathOverlay.jsx` | Medium |
| 5 | ~~**Building HP**~~ — ✅ Fixed (Phase D + pass 1): raiders batter building HP when the player stays away; destruction animates; repairable | `WorldScene.ts` | Done |
| 6 | ~~**Node solid HP**~~ — ✅ uses `def.solid[0]` per node type | `WorldScene.ts` | Done |
| 7 | **Trading economy balance** — buy/sell spreads may be too generous/stingy | `EconomySystem.js` | Low |
| 8 | ~~**Faction war system**~~ — ✅ Fixed (Phase D): hostile factions launch real raid parties; pass 1 staggers them into marching columns | `RaidSystem.ts` | Done |
| 9 | **LegacyStore (NG+)** — system exists but has no content | `LegacyStore.js` | Medium |

## 🟢 Nice-to-Have (Polish & Content)

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 1 | ~~Weather particles~~ | ✅ Done: rain, snow, fog wisps, heat shimmer, lightning | Done |
| 2 | ~~Ambient sound system~~ | ✅ Done: per-biome ambience via `AudioSystem.updateAmbient` | Done |
| 3 | ~~NPC walking AI~~ | ✅ Done: 3-state wander AI with walk animation | Done |
| 4 | ~~Building placement validation~~ | ✅ Done | Done |
| 5 | ~~Minimap legend~~ — ✅ Done: collapsible icon + biome legend on minimap and world map | Done |
| 6 | Inventory tooltips | Hover to see item stats/descriptions | Low |
| 7 | ~~Key binding customization~~ | ✅ Done: full rebind UI in Settings → Controls | Done |
| 8 | ~~Video settings~~ | ✅ Done: graphics preset, FPS cap, fullscreen, camera zoom, UI/text scale | Done |
| 9 | Achievement notifications | Visual popup on unlock (currently just toast) | Low |
| 10 | ~~Tutorial system~~ | ✅ Done: hint chain (`TutorialSystem.ts`) wired into WorldScene | Done |
| 11 | Save export/import | JSON download/upload for saves | Low |
| 12 | Enemy spawn zones | Prevent spawning too close to settlement | Low |
| 13 | ~~Screen shake on hits~~ | ✅ Done: shake on hits with a settings toggle | Done |
| 14 | Pickup animation | Items fly toward player on collect | Low |
| 15 | ~~Minimap zoom levels~~ | ✅ Done: +/− zoom buttons on the minimap | Done |

## Code Quality

| # | Issue | Location | Fix Effort |
|---|-------|----------|------------|
| 1 | `nodeHasTicks` variable assigned but never used | `WorldScene.js:316` | Trivial |
| 2 | `kingdomPct()` defined both as method and module function | `WorldScene.js` | Low |
| 3 | Vite dynamic import warnings (ineffective imports) | Various | Low |
| 4 | Some `for...of` loops could be `Array.forEach` for consistency | Various | Trivial |
| 5 | `GATHER_CONFIG_TICK_XP` is both a const and in Constants.ts | `WorldScene.ts` | Trivial |

## Fixed in Quality Pass 1 (2026-09)

Full audits in `docs/improvements/`, ledger in `05-IMPLEMENTATION-PLAN.md`.
Summary of code changes:

- **Bugs**: goblins now flee when `cowardly: true` (the data field was never
  read); enemy aggro tints no longer stick after the player dies mid-fight;
  `nightOnly` enemies fade out at dawn instead of freezing all day.
- **Game feel**: level-up ceremony (ring shockwave + gold pulse + LEVEL banner
  + camera zoom punch via `systems/CelebrationFX.ts`), kill-reward XP float at
  corpses, idle breathing for player/enemies, attack anticipation squash,
  projectile after-image trails, per-hit gather chips tinted by resource,
  combat camera zoom bias, boss arena ground ring. All respect reducedMotion /
  photosensitive / graphicsQuality settings.
- **Performance**: shore-foam pass drops to a 32px grid while the camera holds
  still (cuts most of its per-frame fbm noise sampling), floating-text pool of
  24 reused Text objects, distant-NPC AI cull at 1600px.
- **Balance**: kill XP scales with biome dangerMult (swamp 1.25× … volcanic
  1.6×), bear reward bumped (85 XP, guaranteed pelts), parry buffs (+12
  stamina, 0.2s counter window), raid parties arrive as staggered columns.

