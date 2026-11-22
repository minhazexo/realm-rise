# AI Rules — Mandatory for AI Coding Agents

> Read this file before modifying anything. It exists because this repo is
> maintained by a solo developer with AI assistance — consistency beats
> cleverness.

## 0. First move: inspect, don't assume

- Read `docs/README.md` (the index), then the doc for the area you are changing:
  `docs/STRUCTURE.md` (file map), `docs/Architecture.md` (runtime flow),
  `docs/ART-DIRECTION.md`, `docs/WORLD-MAP.md`, `docs/STORY.md`, `docs/EVENTS.md`,
  `docs/GAME-DESIGN.md`.
- Locate the owning system/data file with grep before creating anything.
- Check `docs/ROADMAP.md` — your task may already be scoped there, with the
  modules it touches.

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
  `systems/<concern>/<Domain>.ts` over extending `WorldScene`.
- **No new top-level folders** without updating `docs/STRUCTURE.md` (the layer
  table and the module map both live there).
- **No Phaser imports** in `data/`, `core/`, or `utils/` (tests import these
  in node — a Phaser import breaks the suite).
- **No direct `GameState.s.<branch>.<field> =` writes from React** — call a
  system function and `GameState.notify(...)`. Session flags
  (`uiPanel`, `paused`) are the only UI-writable exception.
- **No `Object.assign` merges of content maps** — use
  `Registry.defineSources()` so collisions throw.
- **No save-shape changes** without a migration entry — one sequential step
  inside `migrateSave()` in `systems/persistence/SaveSystem.ts` (idempotent) —
  and a fixture case in `tests/save.mjs`. The cross-cutting rule is restated in
  `docs/ROADMAP.md`.

## 3. Required habits

- Preserve public APIs (`getX`, `craft`, `spawn*`) — check callers first.
- Keep defs serializable (no functions closing over scenes, no GameObjects).
- Deterministic art: `seededRandom()`, never `Math.random()`, in asset
  painters and world-gen.
- After architectural changes: update `docs/STRUCTURE.md` (which
  `tests/structure.mjs` reads) and the relevant plan doc
  (`ART-DIRECTION.md`, `WORLD-MAP.md`, `STORY.md`, `EVENTS.md`, `GAME-DESIGN.md`),
  plus `docs/ROADMAP.md` status.
- Keep `npm test` (20 suites: smoke, systems, settings, content, uidiscipline,
  structure, save, ambient, overlays, autoattack, weapons-elements, elites-boss,
  ashen-frontier, regions, region-pipeline, world-events, shards, story, items,
  storage) +
  `npm run typecheck` + `npm run build` green before finishing.
- Desktop: `npm run desktop:dev` (Vite + Electron), `npm run desktop:pack`
  (unpacked build), `npm run desktop:smoke` (Playwright drives the real shell,
  after a build; set `ROTR_SMOKE_EXE` to test `release/win-unpacked`).
- `npm run world:smoke` drives the real game in a visible window (dev server
  must be running) and checks region streaming, prop culling and page errors.
  Phaser pauses on hidden documents, so the in-app preview tab cannot verify
  streaming — use this instead.
- New regions are authored with `data/regionKit.defineRegion()`; `regionIssues()`
  must be empty for every registered region (`tests/region-pipeline.mjs`).
- Persistence never touches `localStorage` directly. Use `src/platform/kv.ts`
  (`kvGet`/`kvSet`/`kvRemove`); the desktop shell installs a file-backed
  backend before React mounts, so the same save code serves web and desktop.
- New item/weapon content must pass `tests/items.mjs`: a display name that is
  not the id, a description, a value, a rarity band, an identity at epic+, and
  a real acquisition path.
- Prefer small diffs: one domain per change, migrate-then-verify.

## 4. Performance budget

- No per-frame allocations in `update()` hot paths; reuse vectors/objects.
- Throttle background work (`% N` cadences); cap unbounded arrays; keep
  painters one-shot with caches.
- No new event channels without a consumer in the same change.
