# Save System — Versioned Persistence

> If you change the shape of saved data, read this file first.

## Slots & recovery

- 4 slots (`auto`, `slot1–3`) in `localStorage` + rotating shadow copies
  (`shadow_{seed % 7}`) for corruption recovery. Quota fallback strips
  `exploredChunks` and retries.
- `serialize()` whitelists persistent branches (never session, never Phaser).
- Shape guard on every read: `player.level` + `meta.seed` must exist.

## Versions & migrations

- Schema version = `Constants.VERSION`, mirrored as `SaveSystem.SAVE_VERSION`.
- Every load path runs `migrateSave()`:
  - `loadFromSlot()` (menu continue, save panel, autosave restore),
  - `importSlotData()` (migrates before storing, so shares stay current),
  - `GameState.load()` (programmatic loads; idempotent, safe to double-run).
- `migrations[]` runs oldest→newest until the stamp reaches `SAVE_VERSION`.
  Each step `{ from, to, migrate }` MUST be idempotent.
- After steps, a **repair pass** fills any missing top-level branch from
  `createStateDefaults()` and normalises settings — hand-edited and ancient
  saves stay playable even without a dedicated step.
- `meta.migratedFrom` records the origin version when steps applied.
- Saves NEWER than the client keep their stamp (never downgrade).

## Adding a migration (checklist)

1. Bump `VERSION` in `core/Constants.js`.
2. Append `{ from: <old>, to: <new>, migrate(save) {...} }` to `migrations`.
3. Migrate nested fields defensively (`?.`, `== null` fills, no throws —
   `migrateSave` catches step errors and loads as-is).
4. Add a fixture case in `tests/save.mjs`: strip the new fields, set the old
   stamp, assert repair + preservation + idempotency.
5. `npm test` green (save suite runs 6th).

## What is (and isn't) saved

Saved: `meta, player, inventory, inventorySlots, settlement, world, quests,
story, factions, achievements, stats, settings`.
Never saved: Phaser objects, `session` (UI/panel/dialogue/minimap zoom),
transient tweens/timers, derived stats (recomputed on load via `recompute()`).
