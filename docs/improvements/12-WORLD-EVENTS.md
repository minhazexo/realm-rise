# 12 — Dynamic World Events (brief §15)

The brief asks that exploration stop being predictable: *"lightweight dynamic
events: enemy ambush, traveling merchant, wandering elite, treasure event,
corrupted zone, NPC rescue, mysterious shrine, hidden boss."* Before this pass
every one of those existed only where a data file had placed it — a single
authored ambush, seeded shrines, one hidden boss — so walking the same road
twice produced the same walk.

## The split (one owner per job)

| Module | Owns | Phaser? |
|---|---|---|
| `src/game/data/worldEvents.ts` | The table: 7 event defs (weight, duration, cooldown, copy), the rules, the ambush rosters, and the specs for the reused content | no |
| `src/game/systems/WorldEvents.ts` | The **scheduler**: seeded roll, per-kind cooldown, one-at-a-time, the three forbidden places, expiry and withdrawal | no |
| `src/game/systems/WorldEventRuntime.ts` | The **objects**: builds each event out of existing systems, ticks what needs ticking, takes everything back on end | yes |

`WorldScene.update` calls `tickWorldEvents(this, px, py, dt)` right after
`updateRegion`. Live event state is deliberately **not** saved — events are the
world's surprises; only outcomes persist, through the existing
`world.poiStates` map (`setRegionFlag`) and the shipped chest path.

## Rule: designed content, never a spray

Each event drives a system that already exists:

- **ambush** → `RegionEncounters.spawnEncounter` with a role roster (idle
  guards hold, `ambush` members charge) — the same vocabulary as an authored camp
- **wandering elite** → `SpawnDirector.spawnEnemy` with a real `ELITES` key
- **traveling pedlar** → the shipped merchant NPC, walked between waypoints on
  the NPC walk AI (one added field: `walkSpeed`), opening the existing trade UI
- **treasure cache** → `WorldScene.spawnChest` with a real `CHEST_POOLS` tier
- **rescue** → `RegionInteractables.useHostage` (the shipped cage, guard rule
  and reward), extracted so a rolled rescue is literally the authored one
- **wayside shrine** → `RegionInteractables.useSavepoint` (rest, heal, autosave)
- **Veil bloom** → RegionArena's corruption signature (scorch decals, tinted
  crystals, violet motes) plus the same hazard cadence: `dps * 0.5` per 0.5 s,
  and a real click to cleanse once nothing hostile stands inside it

## Rule: restraint

`EVENT_RULES` (data) plus `eventBlockReason` (pure) forbid a start:

- inside an authored safe hub (`inRegionSafeZone`) → `safe-zone`
- within 700 px of where the player entered the world → `arrival-clearance`
- while a boss is on the field → `boss-fight`
- with no legal ground (water, safe zone, unstreamed area) → `no-ground`

Anchors are sampled on a 320–560 px ring around the player, on dry ground,
inside an area that has already streamed in. One event may be live at a time
(`maxLive: 1`); each kind rests for its own cooldown; a refused roll waits a
full interval instead of retrying every frame.

## Rule: it cleans up after itself

`withdraw()` removes what the event built: elites always despawn, ambush
members leave when the player is not fighting them (nothing vanishes out of a
melee you are in), the pedlar is removed from the NPC list, an unlooted cache is
taken back with a toast, and every image, emitter and hit area the event created
is destroyed. Events end on expiry, on `finishEvent` (freed survivor, used
shrine, cleansed bloom), or when the player walks beyond 900 px.

## Verification

`tests/world-events.mjs` (132 assertions, in `npm test`) pins the scheduler
without a scene: quiet opening, anchored start, the one-at-a-time invariant over
400 ticks, expiry, the rest period across three roll windows, a rested kind
returning, withdrawal on leaving, each gate reason, refused-roll pacing, seeded
reproducibility, forced end, and data integrity (every ambush enemy exists with
a real role, every elite key resolves, every cache tier has a loot table, the
pedlar is a merchant).

Live, in the running game, each kind was started, observed and finished:
ambush spawned 3 members and cleaned up; the elite (`executioner`) despawned on
end; Corvin walked 80 px at his 56 px/s pace before being withdrawn; a
`royal_chest` was revealed and taken back; the bloom dropped the player's HP on
the hazard cadence, refused a real click with 6 guards inside, and cleansed on a
real click for +60 gold with every violet object destroyed; the cage refused
with guards up and freed for +40 gold when clear; a wayside shrine healed 20 →
55 and vanished. Parked in the safe hub for 400 simulated seconds the layer
started **zero** events (7 rolls, all `safe-zone`).

## Not in this pass

No "hidden boss" event kind: the Warden of Ash and the boss POIs already give
the world a hidden boss, and re-spawning a boss as a random event would fight
the arena's own design. No saved event state (above). The four remaining
briefed realms are still unwritten, so today these events only ever fire inside
the Ashen Frontier.
