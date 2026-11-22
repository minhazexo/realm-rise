# World Events — Design & Catalog

> The dynamic-event layer that makes the frontier feel alive. The scheduler is
> already built and tested: `systems/world/WorldEvents.ts` (pure), driven by
> `data/worldEvents.ts` (data) and acted on by
> `systems/world/WorldEventRuntime.ts` (scene side). This doc **extends the
> catalog and adds chapter/faction reactivity** — it does not change the
> scheduler's contract.

## 1. What already works (do not rebuild)

- **Roll cadence:** `EVENT_RULES.interval = 55 s`, `firstDelay = 25 s`.
- **One live event at a time:** `maxLive = 1`.
- **Forbidden ground:** never in a safe hub, near the arrival point
  (`arrivalClear = 700`), or during a boss fight — `eventBlockReason()`.
- **Anchoring:** events appear on a ring `320–560 px` from the player.
- **Withdrawal:** an event ends when the player leaves `leaveDist = 900 px`.
- **Cooldowns** per kind; table order is the probability order.
- **Reuses real content** — ambushes are designed rosters, elites are real
  `ELITES`, treasures are real `CHEST_POOLS`, rescues are the hostage path.
- Covered by `tests/world-events.mjs`.

## 2. Design rules (restraint is the feature)

1. **Events are invitations, never homework.** One at a time; never inside the
   home light; never while a guardian is live.
2. **Every event reuses shipped content.** No event may invent a second version
   of an enemy, chest, or NPC.
3. **Every event leaves a choice or a trace.** Resolving it changes something
   persistent: a saved settler, a restored node, a route, a scar, a rumour.
4. **Chapter-aware, not chapter-required.** Variants reference the current
   chapter in their text, but an event never gates progress.
5. **Faction policy changes *who* appears.** The same "caravan" is Verdant
   healers, League traders, or Iron taxmen depending on standing.
6. **Read in one line.** The toast is read mid-fight; keep it short.

## 3. Event taxonomy

| Class | Purpose | Frequency | Persistence |
|---|---|---|---|
| **Ambient** | World texture; small, optional | Highest | None |
| **Opportunity** | Reward the curious | Medium | Cache looted, node restored |
| **Threat** | Tension, tests combat | Medium | Cleared / scars |
| **Faction** | Makes diplomacy visible | Medium | Standing, routes |
| **Story** | Reinforces the current chapter | Low | Named NPC / world-state |
| **Seasonal** | Calendar rhythm (day count) | Low | Temporary, festival |

## 4. The catalog

Existing seven (`data/worldEvents.ts`): `ambush`, `wandering_elite`, `rescue`,
`corrupted_zone` (Veil bloom), `treasure_cache`, `traveling_merchant`, `shrine`.

**New kinds to add** (same `WorldEventDef` shape; add rows, not systems):

| Kind | Class | Trigger | Effect | Trace |
|---|---|---|---|---|
| `faction_patrol` | Faction | Standing ≥ cordial with a faction | Friendly patrol walks the road; clears nearby hostiles; gives a small gift | Standing +, route marked safe |
| `faction_tax` | Faction | Iron standing ≥ cordial, settlement founded | Taxmen demand tribute | Pay → Iron+, refuse → Iron−, raids possible |
| `caravan` | Faction | League standing ≥ neutral | Caravan stops; opens a temporary trade stall | Buy/sell at regional affinity; route remembered |
| `refugee_column` | Story | Settlement stage ≥ Village | A family asks to join | Accept (housing/food cost) → 1–2 citizens + a name; refuse → they move on |
| `plague` | Threat | A dense settlement, low happiness | Sickness in town | Spend herbs/medicine → happiness restore; ignore → citizen loss |
| `harvest_festival` | Seasonal | Every `dayCount % 7 == 0` | Temporary market + morale | Happiness boost, rare trade stock |
| `meteor_crash` | Opportunity | Random | Crash site with crystal/ore | Mine it; leaves a crater POI state |
| `beast_migration` | Ambient/Threat | Biome-appropriate | A herd crosses; predators follow | Hunt (food) or shelter |
| `wandering_hero` | Story | Chapter ≥ IV | A named adventurer offers aid for a fight | Aids one encounter, then leaves a rumour |
| `royal_messenger` | Story | Chapter ≥ V | Brings a faction ultimatum | Choice with standing consequences |
| `veil_surge` | Threat | Chapter ≥ V, night | A stronger bloom that spreads | Cleanse under time pressure; region scar if ignored |
| `lost_child` | Story | Random, near a road | A child separated from a column | Return to a settlement → reputation + named NPC; fail → rumour |
| `treasure_map_drop` | Opportunity | Any | A map to a `treasureCacheSpot()` | Deterministic dig site |
| `ancient_echo` | Story | Near ruins/shrine | A memory plays | One lore fact; journal entry |

## 5. Chapter & faction reactivity

Events gain two optional gates evaluated by the runtime (not the pure
scheduler, which stays seed-deterministic):

```ts
// proposed additions to WorldEventDef (data only)
chapterMin?: number;          // hidden before this chapter
chapterMax?: number;          // retired after this chapter
requiresFaction?: { key: string; minRel: number };
requiresSettlement?: string;  // 'founded' | stage name
variantBy?: 'faction' | 'chapter' | 'biome';  // picks the toast/label variant
```

`WorldEventRuntime` already knows the scene, chapter (`GameState.s.story.chapter`),
faction standings (`GameState.s.factions`), and settlement stage
(`GameState.s.settlement.stageIndex`), so it filters candidates before handing
the eligible list to `pickKind()`. The pure scheduler keeps its current
signature; the runtime passes the filtered `defs` array.

## 6. Persistence model

Traces live in existing state; **no new top-level save branch**:

| Trace | Where it persists |
|---|---|
| Region/POI changed | `world.poiStates[id]` |
| Territory captured | `world.ownedCamps[]` |
| Route opened | `world.unlockedFastTravel[]` |
| Named settler gained | `settlement.citizens[]` |
| Chapter consequence | `story.flags{}` |
| One-off lore seen | `story.journal[]` |

Any new persistent field needs a save migration + fixture test
(`AI_RULES.md` §2, `systems/persistence/SaveSystem.ts`).

## 7. Pacing model

- **Density:** aim for **one meaningful event every ~2–5 minutes** of active
  exploration, zero while the player is managing the settlement UI.
- **Quiet in the home light:** already enforced by the safe-zone rule; also
  suppress events within `claimRadius` (`SETTLEMENT_CONFIG.claimRadius = 1100`).
- **Escalation by ring** (see `WORLD-MAP.md`): threat weight rises with distance
  from `(0,260)`; opportunity weight rises in the Deep Wilds.
- **Session rhythm:** first event no sooner than `firstDelay` (25 s); never
  during the first chapter's tutorial beats (`chapterMin` gate).

## 8. Implementation plan

1. Extend `WorldEventKind` union + `WORLD_EVENT_DEFS` in `data/worldEvents.ts`
   (data only).
2. Add variant tables (faction/chapter/biome) beside each kind, following the
   existing `VEIL_ZONE` / `MERCHANT_EVENT` / `RESCUE_EVENT` pattern.
3. Add candidate filtering in `WorldEventRuntime.tick` (chapter/faction/stage).
4. Add scene builders for new kinds, each reusing a shipped system
   (`NpcSystem`, `RaidSystem`, `LootSystem`, `KingdomSystem`).
5. Extend `tests/world-events.mjs` to pin: gating, one-live, cooldown,
   forbidden ground, and that every new kind resolves to real content.
6. No scheduler signature change; no new bus channel without a consumer.

## 9. Validation

- Every kind has a toast ≤ 90 chars.
- Every `requiresFaction` key exists in `data/factions.ts`.
- Every referenced enemy/NPC/item id exists (fail the content validator).
- A chapter-gated event never fires before its chapter (test fixture).
- A player who ignores an event never soft-locks: expiry always returns the
  world to its prior state.
