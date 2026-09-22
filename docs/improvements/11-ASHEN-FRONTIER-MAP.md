# 11 — THE ASHEN FRONTIER: a real playable region

Date: 2026-09-22. This file is the record of the map brief ("create a fully
playable, believable, atmospheric dark-fantasy game map") against what actually
ships. It is a working ledger: design, evidence, and the defects found by
playing it.

**Status: playable end-to-end and verified in the running game.** The region is
data, the runtime is one system, and every claim below was exercised in the
browser (not just read).

## 1. Prime directive: extend, never rewrite

The brief said audit first and reuse the existing systems. The audit found the
hard parts already existed and working — so none of them were touched:

| Need (brief) | Already in the repo | This pass |
| --- | --- | --- |
| Player / combat / camera | Player, hit-stop, combos, camera shake | untouched |
| Collision | procedural world is walk-through by design | added **authored** static bodies for region structures (player-only) |
| Enemies | Enemy state machine, SpawnDirector, elites, boss engine | added **designed encounters** with roles + alarms |
| Loot / chests | chest pools, tiers, toast, persistence | region chests reuse `spawnChest` |
| Interactables | gather nodes, POI discovery | added a data-driven interactable layer |
| Minimap / fog of war | `exploredChunks` + `discoveredPois` | region POIs feed `worldGen.allPois()` |
| Save | versioned `poiStates` + story flags | region progress rides them (no schema change) |
| Audio | moods, ambience emitters | per-area ambience type/tint/rate |

## 2. The region is data, not a scene

`src/game/data/regionAshen.ts` is the single source of truth (map brief §28):

- **9 sub-regions** — Ruined Ashen Village (safe hub) → The Broken Road →
  Ragged Hollow Camp → Whispering Forest → The Old Watchtower → The Broken
  Bridge → The Corrupted Hollow → The Forsaken Shrine → The Warden's Pyre
  (boss arena). Each has a name, radius, `kind`, audio `mood`, ambience
  signature, and is *invented* rather than recolored: the tower is a vertical
  ruin landmark, the hollow is a hazard maze with a puzzle, the pyre is a vat
  of fire vents.
- **9 landmark compositions** built only from the shipped prop library plus
  `assets/propsAshen.ts` decals (blood, scorch, ash, cart wreck, shattered
  sign, cage) — one visual language, no licensed art.
- **10 designed encounters** (35 enemies total) with roles:
  `patrol` / `guard` / `idle` / `leader` / `ambush`, plus alarm propagation —
  never random scatter.
- **19 interactables**: chests, a savepoint shrine, lore inscriptions, the
  three seal crystals, a caged villager, the puzzle vault.
- **6 hazards** (corruption vents in the hollow, fire vents in the arena that
  only burn *while the boss lives*).

`src/game/systems/RegionSystem.ts` is the whole runtime: lazy placement,
encounters, roles, alarms, hazards, ambience, interactable behaviours, and a
snapshot API for probes/tests. Adding the next region is data + a new file.

## 3. The loop, verified in the running game

Each step below was executed live against the dev server:

| Step | Evidence |
| --- | --- |
| Spawn safely | spawns at (0,260) inside the village; **0** encounter spawns while standing there for 5 s; 59-60 FPS |
| Explore | areas stream in: 6 of 9 placed at spawn, 9/9 after travelling; interactables appear per area (12 → 18 → 19) |
| Fight normal enemies | road scouts fire once → exactly 2 wolves `patrol`; ambush → 3 wolves + archer `ambush` |
| Camp texture | camp core → 2 idle archers, brute `guard`, **executioner `leader`**, swordsman `guard`; alarm raised in both camps |
| Discover landmarks | tower → 3 skeletons `guard` + **grave knight `leader`**; forest → boars `patrol` + bear `idle` |
| Take damage | corruption/fire vents tick damage; arena vents gate on the boss being alive |
| Find a secret | crystal puzzle: wrong first press resets to `[]`, correct `a,b,c` solves it, `hollow_seal_broken` set, the vault appears at (-260,-1100) |
| Fight a boss | Warden spawns with the arena (700 HP); at 40 % HP → **phase 1** (tempo ×1.2, fire slam enters the rotation) |
| Receive a meaningful reward | Warden death sets `warden_slain` → the royal cache opens at (1080,-1520); the quest also grants the unique **Emberforged Blade** |
| Quest | all 9 "Echoes of Ash" steps advance through the real QuestEngine; completion pays items and sets `ashen_frontier_cleared` |
| Hub services | Mara (survivor, quest giver) and Corvin (pedlar/merchant) spawn in the village |
| Save/reload | rest at the shrine → `rotr_save_auto` contains `"warden_slain":true`; after reload the puzzle stays solved, 8 cleared fights stay cleared, the opened vault stays open |

## 4. Defects this pass found by playing it

These are the reason the pass took the shape it did. All were found by
exercising the game, not by reading it, and all are now fixed and pinned by
tests.

1. **Encounter trigger polarity — the world flooded with enemies.**
   `encounterTriggers()` answers "should this fire now?", but the caller read a
   `true` as "already done, skip". The result: every encounter re-spawned on
   *every frame the player was away from it* and stopped only when you stood
   inside it. Measured: **3,500 → 8,100 live enemies at 2 FPS** in one session.
   Fixed by moving the decision into one exported helper
   (`encountersToTrigger`) that the scene consumes and the test suite pins.
2. **`rewards.flagsSet` was never applied.** `completeQuest` honoured only
   `flagsOnComplete`, so every flag declared in a reward bundle vanished —
   including `warden_slain` (locked the boss cache) and
   `ashen_frontier_cleared` (the "next area unlocked" beat).
3. **Quest completion re-entered itself.** Granting a reward flag calls
   `setFlag` → fires a `flagset` event → `checkCompletion` → `completeQuest`
   again, forever. Every main quest from **chapter 2 onward** carries a
   completion flag, so this was a stack overflow waiting on the normal story
   path. Fixed with a re-entrancy guard; the suite completes a chapter to prove
   it.
4. **An encounter was centred inside the safe hub.** Road scouts sat 432 px
   from the hub centre (safe radius 470), so a fight could spawn inside the
   "safe" village. Moved out; the suite now asserts no encounter centre — or
   its widest spawn ring — can reach the hub.
5. **The puzzle's declared reward item did not exist** (`corrupted_relic`; the
   registry has `ancient_relic`).
6. **Lazy placement was a lie.** A 2,600 px placement radius built all nine
   areas at spawn, so "streaming" cost was paid up front. Now 1,150 px, sized
   against the region itself.
7. **The boss payoff was quest-gated.** Kill the Warden without the quest
   active and you got gold and trinkets but no unique reward and a permanently
   locked cache. The arena now records its own outcome (`recordArenaOutcome`),
   so the story beat and the cache exist either way.

## 5. Verification

- `npm run typecheck` — clean.
- `npm test` — **11 suites green**, including the new `tests/ashen-frontier.mjs`
  (**425 assertions**): sub-region shape, spawn safety, landmark composition,
  trigger polarity (including "nothing fires from the hub"), encounter roles and
  fight room, interactable kinds, puzzle solvability and failure reset, vault
  gating, POI registration, the spine quest resolving step-by-step, the Warden's
  phases walking from full HP, the reward chain, and the engine-level
  completion-flag contracts.
- `npm run build` — production build OK.
- Live probes listed in §3, plus two screenshots (village at night with all
  three hub/road/camp labels legible; forest with lakes and landmarks).

## 6. Known gaps (next pass)

- **Visual defect, not yet root-caused**: at night the darkness sometimes reads
  as a hard-edged axis-aligned dark panel around the player instead of a
  screen-wide mask with soft falloff. Observed in the Whispering Forest at
  22:25 with `camZoom 0.6`. The night-mask image itself is correct
  (full-screen, `scrollFactor 0`), and no world object in the scene is that
  size, so it is a compositing/mask-draw issue rather than a stray sprite.
- Region POIs live in two places: eight in `regionAshen.ts`, but
  `warden_pyre` is still registered directly in `worldGen.ts`. The pyre should
  move into `ASHEN_POIS` so the region stays the single source of truth.
- The hollow encounter declares two skeletons that never appear by day
  (skeletons are night-only by an earlier design pass), so that fight is
  thinner in daylight than authored.
- Elite promotion for region encounters is probabilistic, so a designed camp
  may or may not include an elite. A per-encounter "always elite" flag would
  make the camp's difficulty authored instead of rolled.
- The tower's summit reward and the shrine's offering are chests, not yet a
  distinct "you climbed somewhere the map didn't need you to" moment.
