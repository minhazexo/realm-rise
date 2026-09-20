# Combat & Balance Audit — Rise of the Realm

Cross-read of `Player.ts`, `Enemy.ts`, `BossEnemy.ts`, `RaidSystem.ts`,
`Constants.ts`, enemy data tables against action-RPG combat design research
(soulslike telegraphing, readability, risk-reward loops).

---

## Current combat architecture (verified)

- **Player kit**: light attack (arc 104°), heavy (skill-gated), dodge w/
  i-frames + stamina, block w/ shield `shieldBlock` reduction, parry (150 ms
  window), 3-hit combo finisher, bows w/ ammo + pierce.
- **Enemy FSM**: `IDLE → PATROL → DETECT(0.35s) → CHASE → ATTACK → RETREAT →
  SEARCH → DEAD`, driven by `def.style`: melee | pounce (wolf) | charger (boar)
  | brute (bear, AoE slam) | kiter (archers hold preferred range).
- **Bosses**: `BossEnemy` w/ HP-threshold phases, move tables per phase
  (pounce, swipe, slam, beam_sweep, summon, core_overload, throw_axe),
  enrage speed mults, summons, arena leash (`radius` + 300 hide-out).
- **Difficulty**: `DIFFICULTY` multipliers on enemyDmg/Spd/aggro/loot/drain.
- **Raids**: hostile factions march parties on the Town Hall every ~5–9 min
  after 20 min playtime; raiders batter building HP when the player is away.

## Strengths worth keeping

1. **Telegraphing discipline**: every dangerous enemy move has a warning
   (tint + sound + delay 280–600 ms) — matches soulslike readability guidance.
2. **Stamina as universal action currency** — attacks, dodge, sprint, block
   all spend it; kill/hit refunds create aggression loops.
3. **Role identity per enemy** — kiter archers actually kite (they back off
   under pref-40, strafe at range), chargers telegraph dash 400 ms.
4. **Night danger**: `enemyNightBuff` 1.35 + `nightOnly` skeletons + reduced
   night detection makes the day/night loop meaningful.

## Issues found

### A. Numbers
| Issue | Evidence | Suggested fix |
|---|---|---|
| Player base HP 90 vs wolf 42hp/8atk means ~7 hits to die at L1 with 0 armor — early wolves out-trade an unarmored player who facetanks | `Constants.PLAYER_CONFIG.baseMaxHp`, `enemiesWild.ts` | Buff early armor pieces (traveler_garb 0→2 armor) or soften wolf atk to 7 |
| Crit chance formula double-dips: `critMelee = base + agi*0.005 + modCrit + fxN(critChance)` and melee roll adds `wpn.crit` again | `ProgressionSystem.recompute`, `Player.tryAttack` | Intentional (weapon crit stacks on char crit) — document it |
| `bear` hp 160 but only `xp: 60` — poor risk/reward vs 4× wolves (4×42hp=168hp, 4×16=64xp + more loot rolls) | enemiesWild.ts | Raise bear xp to ~85 and give it a guaranteed pelt ×2 |
| XP curve `58 + lv^1.62 * 17` at L10 = 690xp/level; kills at 16–38xp each = ~30 kills/level by midgame — kill-grind heavy; quests only give 40–800 | `Constants.xpForLevel` | Add `xpGainMult` sources: discovery streaks, first-kill-of-type bonus |

### B. Feel
1. **No windup *animation*, only tint.** The red tint is a color flash; the
   enemy sprite should also *grow* ~8 % during windup (readable at glance,
   colorblind-safe). Tint alone fails the `colorblindHints` setting promise.
2. **Enemy attack ranges don't match body sizes.** Bear radius 22 + attackRange
   44 = contact damage at overlap; wolf radius 14 + range 34. When the player
   circles *behind*, wolves snap-rotate (no turn rate). Adding a turn-rate
   (lerp facing over ~0.15 s) gives backstab windows without new data.
3. **Dodge stamina (21) + i-frames 0.42 s** — with regen 11/s the player can
   chain ~5 dodges; good. But dodge has no direction lock vs. camera — fine.
4. **Parry reward is weak vs. block**: parry negates + 6 stamina; block
   negates 62 % + costs 12 stamina. Parry should refund more (+12) and grant
   a 0.2 s attack-speed window (`parryStreak`) — currently it's a trap option.
5. **Boss arenas are open field.** `arenaRadius` exists but nothing visually
   marks it. A subtle ground ring (existing `fx_ring` texture, scrollFactor 1)
   on boss spawn telegraphs the leash to the player.

### C. Systems gaps
1. **RaidSystem waves don't scale loot**: surviving a raid gives only
   `raid-survived` quest progress. Add: +gold from each killed raider is
   already natural; a one-time `raidsSurvived` happiness bump (defended =
   morale) is missing.
2. **No group aggro cap**: 6+ spawned raiders all chase simultaneously;
   soulslike guidance is staggered aggro. Cheap fix: in `SpawnDirector` raid
   spawns, add per-enemy `detect` jitter ±15 % and spawn-ring delay so they
   arrive as a column, not a wall.
3. **`swamp_beast` and `goblin` share `melee` style with identical FSMs** —
   differentiate: goblin `cowardly: true` is in data but `fleeUnderHpPct` is
   never set from it. `Enemy` reads `def.fleeBelowHpPct ?? 0`; data field is
   named `cowardly`. **Bug: goblins never flee.** Wire `fleeBelowHpPct =
   cowardly ? 0.35 : def.fleeBelowHpPct`.
4. **Shield `movePenalty` applies during block only** — good design; but
   `tower_shield`'s movePenalty isn't verified in itemsGear (check when
   rebalancing armor).
5. **`nightOnly` enemies despawn-check uses `isDay()` per-frame** — they
   freeze in place during day (velocity 0, visible). They should fade out and
   despawn (skeletons standing frozen in noon look like bugs). Add alpha fade
   + destroy after 2 s of daylight, keep boss exempt.

## Priority implementation list

1. Fix goblin cowardly-flee wiring (1 line, real gameplay bug).
2. Windup scale-pulse on enemies (readability, colorblind-safe).
3. Enemy turn-rate smoothing (backstab play).
4. Fade-out despawn for day-frozen nightOnly enemies.
5. Parry buff (+12 stamina, brief attack-speed grace).
6. Boss arena ring telegraph.
7. Bear xp/pelt rebalance.
8. Raid column-spawn pacing.

## Sources

- gamedeveloper.com, "Enemy design and enemy AI for melee combat systems" —
  telegraph → commit → recover windows.
- signalsandlight.substack.com "Enemy Combat Fundamentals" — readable enemy
  silhouettes, turn-rate as a design lever.
- book.leveldesignbook.com/process/combat/enemy — behavior archetypes and
  counters (charger↔dodge, kiter↔close distance).
- chaoticstupid.com "Enemy Attacks and Telegraphing" — avoidance-based combat
  needs predictable windup length scaling with damage.
