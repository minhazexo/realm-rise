# Rise of the Realm — Documentation

This folder is the design + architecture library for the game. It is written for
both humans and AI agents: every plan names the real modules it touches so it can
be implemented without re-deriving the codebase.

> **Status:** the *vision/plan* set below was authored 2026-09-26 as the
> direction for the painterly/vector-flat visual overhaul and the world/story
> expansion. Code implementation is tracked in `ROADMAP.md`; nothing here is
> implemented yet unless the doc says so.

## Read in this order

| # | Doc | What it answers |
|---|---|---|
| 1 | [VISION.md](./VISION.md) | What the game is, who it is for, and why. Pitch, pillars, audience, market positioning. |
| 2 | [ART-DIRECTION.md](./ART-DIRECTION.md) | The painterly/vector-flat art bible: style, palette, lighting, depth, and the migration off pixel art. |
| 3 | [WORLD-MAP.md](./WORLD-MAP.md) | The detailed world atlas: coordinates, biome bands, regions, POIs, roads, fast travel. |
| 4 | [STORY.md](./STORY.md) | The implementable chapter/quest/flag plan built on `STORY-BIBLE.md`. |
| 5 | [EVENTS.md](./EVENTS.md) | The dynamic world-event catalog and pacing rules. |
| 6 | [GAME-DESIGN.md](./GAME-DESIGN.md) | The mechanics overhaul: combat, progression, economy, kingdom loop. |
| 7 | [ROADMAP.md](./ROADMAP.md) | Phased build order with tasks, affected files, and acceptance gates. |

## Architecture references (load-bearing — do not delete)

| Doc | Role |
|---|---|
| [STRUCTURE.md](./STRUCTURE.md) | The file-level module map. `tests/structure.mjs` **reads this file** and fails if a systems module is not named here. |
| [Architecture.md](./Architecture.md) | The runtime data flow: `GameState` → `EventBus` → React, and the Phaser↔React bridge. |
| [STORY-BIBLE.md](./STORY-BIBLE.md) | The canonical narrative direction (premise, cast, factions, ending states). `STORY.md` implements it. |
| [AI_RULES.md](./AI_RULES.md) | The mandatory rules for AI agents editing this repo. Read before any change. |

## Rules for adding docs

- One concern per file; keep the index above current.
- Prefer editing an existing doc over creating a near-duplicate.
- Name real file paths and real coordinates — vague plans rot.
- When a plan is implemented, move it out of "plan" tense and note the shipped module.
