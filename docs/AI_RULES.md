# AI Rules — Mandatory for AI Coding Agents

> Read this file before modifying anything. It exists because this repo is
> maintained by a solo developer with AI assistance — consistency beats
> cleverness.

## 0. First move: inspect, don't assume

- Read `docs/DATA-ARCHITECTURE.md` + `docs/MIGRATION_PLAN.md` before any change.
- Locate the owning system/data file with grep before creating anything.
- Check `docs/TODOs.md` — your task may already be scoped there.

## 1. The five questions (answer internally, every feature)

1. Does an existing system already solve this? → reuse it.
2. Can this feature be represented as **data**? → put it in `data/` or
   `world/`, not in a scene.
3. Can an existing component/system be **extended**? → extend, don't clone.
4. Will this create coupling (UI→entity internals, system→Phaser)? → reroute
   through system functions + `Bus` events.
5. Does `npm test` cover it? → add validator/test coverage for new references.

## 2. Hard prohibitions

- **No hardcoded content** in scenes or UI: no inline stat blocks, loot
  lists, spawn tables, building costs, quest text in components. Data files
  own content; code owns behavior.
- **No duplicate systems**: grep for existing helpers (`getItem`,
  `awardXP`, `craft`, `spawnEnemy`…) before writing new ones.
- **No giant classes**: new files >400 lines need justification; prefer a new
  `systems/<Domain>.js` over extending `WorldScene`.
- **No new top-level folders** without updating `docs/DATA-ARCHITECTURE.md`.
- **No Phaser imports** in `data/`, `core/`, or `utils/` (tests import these
  in node — a Phaser import breaks the suite).
- **No direct `GameState.s.<branch>.<field> =` writes from React** — call a
  system function and `GameState.notify(...)`. Session flags
  (`uiPanel`, `paused`) are the only UI-writable exception.
- **No `Object.assign` merges of content maps** — use
  `Registry.defineSources()` so collisions throw.
- **No save-shape changes** without a migration entry (see MIGRATION_PLAN
  Phase 5) and a fixture test.

## 3. Required habits

- Preserve public APIs (`getX`, `craft`, `spawn*`) — check callers first.
- Keep defs serializable (no functions closing over scenes, no GameObjects).
- Deterministic art: `seededRandom()`, never `Math.random()`, in asset
  painters and world-gen.
- After architectural changes: update `docs/DATA-ARCHITECTURE.md`,
  `ADDING-CONTENT.md` if schemas changed, and `TODOs.md` status.
- Keep `npm test` (6 suites: smoke, systems, settings, content, uidiscipline, save) + `vite build` green before finishing.
- Prefer small diffs: one domain per change, migrate-then-verify.

## 4. Performance budget

- No per-frame allocations in `update()` hot paths; reuse vectors/objects.
- Throttle background work (`% N` cadences); cap unbounded arrays; keep
  painters one-shot with caches.
- No new event channels without a consumer in the same change.
