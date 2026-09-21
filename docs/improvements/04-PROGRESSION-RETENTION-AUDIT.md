# Progression, Retention & Economy Audit

Read of `ProgressionSystem/XP`, `QuestEngine`, `TutorialSystem`,
`KingdomSystem/Economy`, `FactionSystem`, `RaidSystem`, quests data, skills
tree vs. retention-design research (power-progression pacing, goal laddering,
"one more thing" loops from docs/Project.md §48–49).

---

## What's strong (verified in code)

- **Goal ladder exists at every timescale**: tutorial hints (first 60 s
  "early win" +12 XP), first-steps checklist card, 12-step main quest chain
  across 8 chapters, 7 settlement stages, 12 achievements.
- **Professions** (woodcutting/mining/survival/combat/crafting, cap 10) give
  learn-by-doing micro-progression with roman-numeral rank toasts.
- **Personality micro-identities** (bold/stoic/kind/clever) tweak start stats
  + reputation/trade/XP — cheap replay variety.
- **NG+**: LegacyStore persists achievements across wipes; heirloom boons.
- **Economy anti-grind**: `TRADE_SPREAD.sellMult` was deliberately raised
  0.38 → 0.45 with a documented rationale; biome affinity tables make
  exploration pay (mountains buy iron cheap, deserts charge for water).
- **Consequences**: starvation drops happiness, unhappy citizens leave
  (`citizenLeaves`), destroyed Town Hall un-founds the realm.

## Issues found (ranked)

### P1. The 5–15 min reward cadence has a hole at 20–60 min
Between "found settlement" (quest 5, ~30 min) and "Iron in the Veins" the
player's goals are all *build* goals. Kills/gathering give flat XP that
doesn't scale; nothing celebrates milestones like "first steel ingot" or
"reached level 10". **Fix**: add milestone toasts (+small XP) for first-time
events — already half-exists in AchievementSystem (12 achievements, most
late-game). Add ~10 early/mid achievements: first night survived, first
iron smelt, first wolf den cleared, level 10, 5 citizens, first upgrade.

### P2. XP curve vs. quest rewards mismatch
`xpForLevel(10) ≈ 690`; kills give 16–38 XP → 20–40 kills per level in ch.4–6.
Quests give 60–1200 but are one-time. Gathering gives 2 XP per node — noise.
**Fix options** (pick one): (a) scale kill XP with biome `dangerMult`
(1.25–1.6 exists, unused for XP), (b) add streak multiplier (5 kills in 30 s
= 1.2×), (c) discovery chain bonus (each new POI within 10 min of the last
+25 %). (a) is one line in `Enemy.die` and makes dangerous biomes worth it.

### P3. Settlement stages 5–7 are gated behind territory (5/9 camps) but
`ownedCamps` only increments via chest-loot capture (`openChest` adds camp
when `bcamp_` + looted). There's no *defend-what-you-captured* loop: raiders
never re-take camps. **Fix**: `RaidSystem.raidTick` — if hostile factions
exist and the player ignores a raid for 90 s (no player within 900 px of
home), flip one random owned camp back to unowned with a toast. Creates
tension + a reason for the watchtower/fortress defense investment.

### P4. Skill tree: 31 skills but `war_heavy` is the only *unlock* skill;
the rest are stat-mults. Unlock-style skills create build identity (research:
meaningful choices = mutually exclusive or build-defining). Cheap additions:
`surv_camp_cook` (unlocks hearty_stew without kitchen), `rang_multishot`
(bow fires 2 arrows, +stamina cost), `cra_salvage` (repair kits refund
materials). Even 2–3 unlocks per branch sharpens identity.

### P5. Citizens have `skillLv` but no growth. Workers assigned to buildings
produce at `0.75 + skillLv*0.12` forever. Let assigned workers gain
`skillLv` (cap 5) after N production ticks — visible "your people improve"
moment, feeds the happiness/production flywheel.

### P6. Fast travel listed in world state (`unlockedFastTravel`) but there's
no fast-travel UI. Spec §43 wants discovered-location fast travel w/ food
cost. The map panel already has waypoint clicks; add "Travel here" for
discovered POIs within friendly territory, cost 15 hunger + advance time
2 h. Big QoL, uses existing state field.

### P7. Death penalty is 12 % gold — flat and boring. Research favors
"lose something you were carrying": drop 30 % of inventory resources at
death location as a reclaimable loot pile (existing loot system supports
this — `dropLoot`). Creates death-runs (tension) and self-balances vs.
gold.

### P8. `consumable` hunger/thirst values aren't shown on item cards in
the inventory UI (only names). Players can't make food decisions. Add
`+{food} 🍖 / +{thirst} 💧` line — data exists in `def.use`.

## Content gaps worth noting
- Only 3 recruit NPCs w/ dialogue variety; POI NPCs (elara/tam/…) have fixed
  2–3 lines. Rotating "rumor" lines from a table per biome would make
  revisits feel alive (data-only change).
- 7 side quests vs. 12 main; side quests are the replayability layer —
  each faction deserves 1 signature side quest (data-only).

## Sources
- gamedeveloper.com "Power progression in games" (2024) — reward pacing,
  frequent small rewards vs. large milestones.
- juegostudio/gamedesignskills retention pieces (2026) — goal laddering,
  habit loops, alternative modes.
- docs/Project.md §48–49 — short/medium/long/epic goal ladder, "one more
  thing" chains (already the design north star; audits map gaps to it).
- r/gamedesign "17 strategies for player retention" — idle/away production
  (overflow stockpile already does this — praise it).
