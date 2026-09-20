# Implementation Plan — Quality Pass 1

Ordered by (player impact ÷ effort). Each item lists exact files touched.
Bugs first, then feel, then performance. Everything keeps the existing
settings-discipline rules: respect `reducedMotion`, `photosensitiveMode`,
`screenShakeEnabled`, `particles`, and `graphicsQuality` tiers.

---

## Batch A — Real bugs (fix first)

| # | Bug | File | Fix |
|---|-----|------|-----|
| A1 | Goblins never flee despite `cowardly: true` (data field never read; engine reads `fleeBelowHpPct`) | `data/enemiesWild.ts` | Set `fleeBelowHpPct: 0.35` on goblin |
| A2 | Enemy tint sticks when player dies mid-fight (session_dead early-return leaves DETECT/CHASE tint) | `entities/Enemy.ts` | `clearTint()` in the session_dead branch |
| A3 | `nightOnly` enemies freeze visible all day | `entities/Enemy.ts` | Fade + destroy after 1.5 s of daylight (skip bosses) |
| A4 | Architecture.md is UTF-16 corrupted (null bytes) | `docs/Architecture.md` | Rewrite as UTF-8 from the readable fragments |

## Batch B — Game feel (high impact)

| # | Improvement | File |
|---|-------------|------|
| B1 | Level-up ceremony: ring burst ×2 + gold light + "LEVEL n!" float + zoom punch on `level-up` | `systems/CelebrationFX.ts` (new), wire in `WorldScene` |
| B2 | Kill reward beat: `+xp XP` gold float at corpse; boss kill hitstop+shake | `entities/Enemy.ts` |
| B3 | Idle breathing: ±1.5 % scaleY @ ~0.6 Hz when still (player + enemies) | `entities/Player.ts`, `entities/Enemy.ts` |
| B4 | Attack anticipation: 50 ms squash pulse before slash arc | `entities/Player.ts` |
| B5 | Arrow after-image trail while projectile alive | `scenes/WorldScene.ts` (updateProjectiles) |
| B6 | Per-hit gather particles tinted by resource | `systems/GatherSystem.ts` |
| B7 | Camera combat zoom bias ×0.96 with smooth lerp | `systems/InputSystem.ts` |
| B8 | Boss arena ground ring telegraph on spawn | `entities/BossEnemy.ts` |

## Batch C — Performance

| # | Fix | File |
|---|-----|------|
| C1 | Foam band cache: half-res offscreen, refresh on 64 px camera cell cross | `systems/WaterSystem.ts` |
| C2 | Floater pool (24 Text objects round-robin) | `scenes/WorldScene.ts` (Floater class) |
| C3 | NPC AI early-out beyond 1600 px | `scenes/WorldScene.ts` (updateNpcs) |
| C4 | EQUIPMENT notify throttle on wear | `systems/InventorySystem.ts` |

## Batch D — Balance / retention (data-level)

| # | Change | File |
|---|--------|------|
| D1 | Biome dangerMult scales kill XP (`Enemy.die` reads `dangerAt` or cached biome mult) | `entities/Enemy.ts` |
| D2 | Bear reward bump: xp 60→85, guaranteed pelt min 2 | `data/enemiesWild.ts` |
| D3 | Parry buff: +12 stamina, 0.2 s attack-cooldown grace | `entities/Player.ts` |
| D4 | Raider column spawn: spawn ring staggered per enemy | `systems/RaidSystem.ts` |

## Explicitly NOT done this pass (documented for later)

- Water foam buffer (C1 kept simple instead: reduced FOAM_STEP density + fewer
  samples by striding 2× when zoomed out) — full offscreen-cache is a bigger
  refactor with regression risk on the visual test `tests/ambient.mjs`.
- Fast travel UI (P6) — needs map panel + design pass on costs.
- Death loot piles (P7) — needs DeathOverlay coordination.
- New skills (P4), citizen growth (P5), milestone achievements (P1) — content
  passes best done together with a balance review.

## Verification gates

1. `npm run typecheck` — must stay clean.
2. `npm test` — all suites green (smoke, systems, settings, content,
   uidiscipline, save, ambient).
3. Manual: `npm run dev` → level up (rise.setLevel), kill a wolf, dodge,
   block/parry, gather, place a building, trigger a raid via debug.
