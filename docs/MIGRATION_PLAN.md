# Migration Plan — Toward Fully Data-Driven Architecture

> Pragmatic, incremental, gameplay-preserving. Each step ships green
> (`npm test` + `vite build`) before the next begins. No rewrites, no ECS
> framework, no removed features.

## Phase 0 — Audit (DONE)

- Full-repo audit by two explore agents. Findings:
  1. **No central registry**: 9+ per-domain `map[id] || null` getters, zero
     duplicate protection (`Object.assign` last-wins in enemies/buildings,
     `fromEntries` collapse in skills, `.find` first-wins in recipes).
  2. **God class**: `WorldScene.js` (~1700 lines, ~65 methods, ~30 imports)
     owns spawning, loot, minimap, input, building, sieges, autosave.
  3. **UI writes state directly**: `Panels.jsx` mutates `player.gold`,
     `story.flags`, equipment flows bypass services in places.
  4. **No save migration**: `meta.version` stamped but never checked;
     `GameState.load()` is plain assignment.
  5. Good bones: pure data files, 35 system modules, EventBus with 20 channels,
     whitelisted saves, `Constants.js` centralizes balance, content tests exist.
- No ID collisions found anywhere (verified by script) — strict registries
  are safe to introduce.

## Phase 1 — Foundation (DONE)

- [x] `src/game/core/Registry.js`: strict generic registry (ID format,
  duplicate throws, required-field checks, `get`→null / `require`→throws,
  `defineSources` collision-safe merge, seal, snapshot).
- [x] `src/game/core/validateContent.js` + `tests/content.mjs` in `npm test`:
      10 cross-domain check groups, 0 errors on current content.
- [x] Pilot migration: `data/enemies.js` rebuilt on `Registry` with an
      **identical public API** (`ALL_ENEMY_DEFS`, `getEnemyDef`, `isBossKey`).

## Phase 2 — Registry rollout (IN PROGRESS, one domain per PR)

Same mechanical pattern as the enemies pilot; each is independently shippable:

- [x] `data/enemies.js` (pilot — `defineSources`, identical API).
- [x] `data/buildings.js` (A/B merge → `defineSources`, required: label+cat).
- [x] `world/nodeTypes.js` (registry + keep `rollNodeType`/`getNodeDef` API).
- [x] `data/skills.js` (registry snapshot as `SKILL_MAP` — kills `fromEntries` collapse).
- [x] `data/npcs.js`, `data/factions.js` (same pattern).
- [x] `data/recipes.js` (order-preserving array + id-index Registry;
  lookup-by-output stays a separate scan — bulk `x5` variants share `out`).
- [x] `data/items.js` (`def()` kernel throws on duplicate id / bad id /
  unknown category; side-effect authoring files unchanged).

Acceptance per domain: `npm test` green, `vite build` clean, e2e world boots
with 0 console errors, spot-check gameplay (gather/craft/fight/build).

## Phase 3 — Slim the god class (DONE — extract, don't rewrite)

WorldScene went from ~1770 → ~1020 lines. Each extraction kept thin
delegates so external callers (`main.js`, `Panels.jsx`, `RaidSystem`,
`BossEnemy`) never changed.

- [x] `systems/LootSystem.js`
- [x] `systems/BuildSystem.js`
- [x] `systems/MinimapSystem.js`
- [x] `systems/SpawnDirector.js` (entity injection via `configureSpawning()`)
- [x] `systems/InputSystem.js`: binds, `setupInput`, wheel/keys, cam zoom,
  pause/panel toggles. Browser-only by nature (Phaser KeyCodes, documented
  exception to the no-Phaser-in-systems rule); verified via the live input
  matrix (movement, 6 panels, zoom keys, attack) with 0 errors.
- [x] Incidental root-cause fix found by verification: `installSettingsSystem`
  re-applied with `busNotify:true`, so EVERY settings change recursed
  `applySettings`↔`CH.SETTINGS` until stack overflow (~10k redundant
  applications, caught/logged by the emitter). Now re-applies with
  `busNotify:false` — one emission, one application.

`WorldScene` keeps: `create`/`update` orchestration, chunk streaming,
cross-system Per-frame glue, gathering, projectiles, NPC dialogue glue.
(`spawnNpc` also moved to `EntityFactory.createNpc` in final audit.)
Remaining slices toward <900 (one PR each): gathering → `GatherSystem`,
projectiles → `CombatSystem` slice, siege/raid glue. The <900 target stays
open — direction over deadline.

## Phase 4 — UI discipline (DONE)

- [x] `EconomySystem.spendGold/earnGold/buyOffer/sellUnit` — sole owners of
  `player.gold` mutation; `TradePanel.doBuy/doSell` reduced to one-liners.
- [x] Guide dismiss → `QuestSystem.setFlag('hide_guide')`; debug Heal →
  new `ProgressionXP.healToFull()`. Zero `GameState.s.<branch>.<field> =`
  writes remain in `app/components` (reads + session flags excepted).
- [x] Enforceable gate: `tests/uidiscipline.mjs` (5th suite in `npm test`)
  fails the build on any persistent-state assignment from components.
- [x] Service round-trips covered in `tests/systems.mjs` (overdraft refusal,
  unknown goods, sell pricing). Verified live: guide dismiss, Heal button,
  inventory — 0 errors.

## Phase 5 — Versioned saves (DONE)

- [x] `SaveSystem.SAVE_VERSION` mirrors `Constants.VERSION`; `cmpVersions`
  sorts unknown stamps oldest (never crash, always repair).
- [x] `migrations[]` run oldest→newest to current; first step `0.9.0→1.0.0`
  (camZoom/settings normalise, exploredChunks, inventorySlots, stats,
  achievements). Steps must be idempotent.
- [x] Repair pass fills missing top-level branches from `createStateDefaults`
  + normalises settings; newer-than-client stamps are never downgraded.
- [x] Wired into all three load paths (`loadFromSlot`, `importSlotData`,
  `GameState.load`); `meta.migratedFrom` records upgrades.
- [x] `tests/save.mjs` (6th suite): version compare, 0.9.0 fixture,
  idempotency, storage round-trip, import validation, programmatic load.
- [x] `docs/SAVE-SYSTEM.md` + migration checklist for future versions.

## Phase 6 — Factories + debug console (DONE)

- [x] `EntityFactory.createEnemy/createResource/createItem/createNpc`
  reading registries; `SpawnDirector` + `WorldScene.spawn*` delegate to it.
  Entity classes injected (`configureEntities`), never imported.
- [x] `window.rise` debug console (dev-only behind `import.meta.env.DEV`):
  `help/give/spawnEnemy/spawnResource/teleport/setLevel/clearInventory/
  state`; never throws; verified live + absent from the production bundle.
  (`window.riseGame` handle kept for automation.)

## Phase 7 — Final audit (DONE)

- [x] Full-program audit (delegates, duplication, cycles, saves, assets,
  docs, tests, UI gate, TODOs) — findings applied: doc counts corrected,
  `DATA-ARCHITECTURE.md` split from the original `Architecture.md`,
  `createNpc` factory gap closed, core↔systems live-binding cycle declared
  accepted in `DATA-ARCHITECTURE.md`.
- [x] Open backlog carried in `MIGRATION_PLAN` Phase 3 remainder + `TODOs.md`
  (incl. pre-existing #11 build-card dispatch).

## Explicitly NOT doing

- No ECS framework, no TypeScript migration (JSDoc typedefs suffice),
- no folder rename churn (`src/game/*` stays; registries live in
  `core/`, validators next to them),
- no gameplay/balance changes during migration steps.
