# 13 — The Five Realm Shards (brief §14)

Date: 2026-09-23. The story spine, built as reachable content: five fragments in
the Ashen Frontier the player can find, fight for and carry, and one final beat
that answers why the protagonist survived. No new screens; every step runs
through machinery that already shipped.

## One owner per job

| Module | Owns | Phaser |
|---|---|---|
| `data/storyShards.ts` | the five fragments: site, guardian, item, flag, quest, inscription, and the `BARRIER` beat (cold text, raised banner, epilogue) | no |
| `systems/ShardSystem.ts` | the rules: is a guardian still holding it, what is the story on, is the anchor ready | no |
| `data/voices.ts` | every line of prose: `BOSS_VOICE` (intro + defeat), `BOOKS` (nine books and inscriptions) | no |
| `systems/VoiceSystem.ts` | where prose is displayed: `readLines` (the shipped dialogue modal) and staggered boss toasts | yes |
| `data/regionAshen.ts` | builds the five objects and the anchor **from** `storyShards`, and attaches `book` keys to the eight lore props it already had | no |
| `systems/RegionInteractables.ts` | the click: `shard` (take or refuse), `ritual` (plant the five), `lore` (read the book) | yes |
| `data/questsSide.ts` | six quests: five `flag` steps plus the anchor's, each gated by `requiresFlags` on the fragment before it | no |

## Rules that keep it honest

- **A fragment is held, not hidden.** While its keeper is alive and standing
  over it the click refuses and says who in the world's own voice. A **boss**
  holds its fragment wherever it stands — it was posted there, so kiting it away
  from the pyre must not open the gate (live probing found that hole).
- **Everything reused.** Region encounters seat every guardian; the boss POI
  spawns the Warden; the dialogue modal reads inscriptions, books, shard
  recoveries and the epilogue; story flags and `world.poiStates` carry progress
  through the save.
- **Taken once per save.** Each fragment rides the existing POI marker
  (`onceOnly`), so a fragment does not reappear after CONTINUE.
- **The chain survives being walked out of order.** A player who takes a
  fragment — or plants all five — before asking Mara about it gets the objective
  anyway: `offerSideQuest` seeds already-satisfied flag steps and re-checks
  completion, so the quest neither sticks unfinishable nor pays twice.

## Evidence

- `tests/shards.mjs` — **318 assertions** in `npm test`: every site inside its
  sub-area on ground a player can stand on and clear of solid props, every
  guardian a real enemy seated inside its own radius, the refusal/allow rules
  (including the boss rule), the anchor's gate naming what is missing, the whole
  chain run through the real quest engine paying exactly once, the out-of-order
  path, and that no book or boss voice is a stub or dangling.
- `.freebuff/shards-verify.mjs` — the live run: Mara's world click and Accept
  button, each keeper seated by its authored encounter, a real projected click
  refused then taken, inscriptions in the modal, the hub shrine's save read back
  through `SaveSystem`, a reload + CONTINUE keeping the flags, fragments and
  once-only markers, the anchor's cold refusal, the epilogue, and Mara's recovery
  of the whole chain afterwards. Frame rate measured before and after the chain
  on the same headless renderer: **7 fps → 6 fps** (software WebGL; no cost added
  by the chain), with 27 live enemies on screen at the end.
