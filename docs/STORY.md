# Story — Implementable Plan

> `STORY-BIBLE.md` is canon: premise, cast, factions, tone, endings. **This doc
> turns it into a build order**: chapters → quests → world-state change → flags,
> mapped to real data and systems.

## 1. Narrative model

**Foldback with memory.** A critical path every player walks; choices change
*who helps, what the town looks like, and what the ending costs* — not the
destination. Destinations reconverge at each chapter gate.

Dialogue uses two structures deliberately (`Mirkowski`):

| Structure | Where | Why |
|---|---|---|
| **Hub-and-spoke** | Town NPCs, faction representatives, lore NPCs | Players ask about topics in any order; conversation returns to the hub |
| **Waterfall** | Decisive beats: shard guardians, council, endings | Weight and irreversibility; missed options are lost |

**Variable discipline:** a choice sets a flag; the world *reacts* with a changed
line, price, spawn, or object — not a new branch of the plot.

## 2. Where story lives (modules)

| Concern | Module |
|---|---|
| Main quest chain + steps | `data/questsMain.ts`, `systems/narrative/QuestEngine.ts` |
| Side quests | `data/questsSide.ts`, `systems/narrative/QuestSystem.ts` |
| Chapter arc / flags / journal | `data/story.ts`, `systems/narrative/StorySystem.ts` |
| Shard chain rules | `data/storyShards.ts`, `systems/narrative/ShardSystem.ts` |
| Dialogue/prose venue | `systems/narrative/VoiceSystem.ts`, `data/voices.ts` |
| NPC definitions & requirements | `data/npcs.ts` |
| Authored world interactions | `systems/world/RegionStory.ts`, `data/regionAshen.ts` |
| Achievements / NG+ | `AchievementSystem`, `LegacyStore` |
| Event → quest routing | `core/BridgeSystem.ts` |

## 3. Chapter-state table

Each chapter declares: entry flags, the decisive quest, the world-state change,
new events, and the screenshot target for review.

| Ch | Title | Region | Entry gate | Decisive quest | World-state change | New events |
|---|---|---|---|---|---|---|
| I | The Stranger | Heartland | new game | first fire + gather chain | campfire becomes a map safe point | — (tutorial) |
| II | The First Fire | Heartland / Frontier edge | Ch I done | survive first night, "KEEP THE FIRE" | night danger + wolves circle | `lost_child`, `ancient_echo` |
| III | A Place to Call Home | Ashen Frontier | Ch II done | Grendelfang (wolf den) → rescue Tam | Town Hall founded; anchor-mark found | `rescue`, `treasure_cache` |
| IV | The Rising Banner | Deepwood / Drowned Reach | town founded | choose a faction bargain | first policy set; route opens | `caravan`, `faction_patrol`, `harvest_festival` |
| V | War Comes | Ashen Dunes / Frontier | stage ≥ Town | Rhogar's Court | Legion patron revealed; raids escalate | `faction_tax`, `veil_surge`, `royal_messenger` |
| VI | The Lost Civilization | Grayfang / Drowned Reach | Ch V done | decipher ruins, forge Dawnbreaker | Ancient sin revealed; research path | `wandering_hero`, `plague` |
| VII | The Frontier Holds | Frozen North / Emberwaste / Frontier | 4 shards recovered | four guardians + Warden of Ash | Crown Ember truth; realm threatened | `beast_migration`, `meteor_crash`, `veil_surge` |
| VIII | Crown of the Realm | Golden Coast / Forsaken Shrine | kingdom stage + shards | final council | ending policy chosen; NG+ boon | epilogue |

## 4. Chapter detail (beats + flags)

### I — The Stranger
- **Beats:** wash ashore; gather wood/fiber; craft first tool; discover the
  Ashen Village hub; meet Mara.
- **Framing:** gathering = a refusal to disappear. `elara_camp`, `tam_crash`
  visible on the horizon as hooks.
- **Flags:** `ch1_woke`, `ch1_first_tool`.
- **Proof of completion:** a craft and a gather recorded (`stats.crafted/kills`).

### II — The First Fire
- **Beats:** place a campfire; cook; survive a night; receive the driftwood
  message; see the lightless presence avoid the fire.
- **World change:** the campfire registers as a safe point; `FirstSteps` chain
  completes; night enemies gain their buff visibly (`DAYNIGHT_CONFIG`).
- **Flags:** `ch2_first_fire`, `ch2_survived_night`, `ch2_keep_the_fire`.

### III — A Place to Call Home
- **Beats:** hunt Grendelfang at `wolf_den`; rescue Tam at `tam_crash`; found the
  Town Hall; discover the anchor-mark in the den.
- **World change:** settlement founded; a permanent safe zone; Tam becomes the
  first named worker (`settlement.citizens[]`).
- **Flags:** `ch3_grendelfang`, `ch3_tam`, `ch3_hall`, `ch3_anchormark`.

### IV — The Rising Banner
- **Beats:** refugees arrive; three faction offers (Verdant food/healing, League
  supplies/contracts, Iron security/obedience); the player picks a policy.
- **World change:** the chosen policy sets prices/routes and which `caravan` /
  `faction_patrol` variant appears.
- **Flags:** `policy:generosity|pragmatism|discipline`, plus one faction alliance
  flag.

### V — War Comes
- **Beats:** Ashen raids target "warm stones"; defeat Rhogar at `bcamp_8`;
  discover the Legion is paid by a hidden patron.
- **World change:** raid escalation; the Ashen redemption path opens; Dunes
  region unlocks as a route.
- **Flags:** `ch5_rhogar`, `ch5_patron_known`, `ashen_contact`.

### VI — The Lost Civilization
- **Beats:** Old Hob deciphers the Great Ruins; the Ancient Order confesses the
  first unsealing; forge Dawnbreaker from an Ancient Core (Grayfang).
- **World change:** forge unlocked; research path; the "cuts false bindings"
  property is established for the finale.
- **Flags:** `ch6_deciphered`, `ch6_dawnbreaker`, `ancient_truth`.

### VII — The Frontier Holds
- **Beats:** recover the Hearth, Green, Watch, and Hollow shards from the four
  regions; each guardian embodies a failure (greed, exhaustion, duty, fear);
  relieve the Warden of Ash.
- **World change:** each recovered shard changes its region (a scar healed, a
  route opened); the Crown Ember truth is confirmed.
- **Flags:** `shard_hearth|green|watch|hollow`, `warden_relieved`, `crown_known`.

### VIII — Crown of the Realm
- **Beats:** council at the Forsaken Shrine (`shrine` in the Frontier,
  `(1180,−980)`); plant the four shards + Ashen Reliquary; the shrine asks for
  the Crown Ember; choose the ending policy.
- **World change:** ending policy recorded; `LegacyStore.grantLegacy` grants the
  NG+ boon; `RulerPanel` shows the epilogue.
- **Flags:** `ending:concord|crown|dominion`.

## 5. Cast reactivity

Each important NPC ships **3–5 state-based dialogue blocks**, swapped by chapter
(`data/npcs.ts` `dialogue` + `req`). See `STORY-BIBLE.md` for arcs.

| NPC | Reacts to | Gameplay role |
|---|---|---|
| Mara | chapter, memorial built, power shared | frontier quests, shrine ritual |
| Elara | grove policy, hunts done | hunting, Verdant path |
| Tam | recruitment, worker growth | first citizen, citizen quests |
| Old Hob | ruins found, research path | deciphering, Ancient path |
| Rhogar | spared vs defeated | Ashen redemption or domination |
| Warden of Ash | shards held, dawnbreaker forged | final guardian |

## 6. Ending conditions (transparent)

| Ending | Requires | Cost shown in epilogue |
|---|---|---|
| **Realm Concord** | Verdant + League trust, Iron ≥ neutral, spared/redeemed Ashen | Player lives; rules with a council, never alone |
| **Warden Crown** | Fortified kingdom, high Iron standing | Order and safety; asks if it became a cage |
| **Ashen Dominion** | Legion methods / low-compassion choices | Veil contained by conquered territory; uneasy, not a joke |

Endings restore the barrier regardless — the choice decides *who shares the
burden*, not whether the world survives. `systems/narrative/StorySystem.ts`
`endingFor()` already resolves ending text; extend it to check faction + kingdom
state before selecting.

## 7. Delivery budget

- Main path: 8 chapters, one decisive quest each, 2–3 memorable sequences per
  chapter, one irreversible world-state change per chapter.
- Regional story: 4–6 short readable objects per region, all perspectives on the
  current mystery.
- Character reactivity: 3–5 blocks per important NPC.
- Dynamic events: 1–2 sentence variants by chapter and faction policy; only
  persistent when the player resolves them.
- **Do not** promise a wholly separate campaign per player.

## 8. Implementation checklist

> **Status (2026-11-22):** steps 1, 2, 4, 6 and 7 are implemented and pinned by
> `tests/story.mjs`; step 5 rides the shipped region interactables. Chapter VII
> is now carried by the shard chain + the Ashen Reliquary, and Chapter IV closes
> on the banner bargain (`data/policies.ts` → `PolicySystem` → standing, prices,
> militia, happiness). Step 3 landed as the same bargain rather than a second
> policy layer: one decision, four systems moved.

1. Extend `story.ts` chapters + flags; add a chapter gate to `StorySystem`.
2. Add the decisive quest per chapter to `questsMain.ts` with real steps
   (`QuestEngine` events: gather/kill/discover/talk/built/territory).
3. Add faction-policy data and wire it to `EconomySystem` + `FactionSystem`.
4. Add reactive dialogue blocks (req-based) to `npcs.ts`.
5. Wire region story beats through `RegionStory` / region `pois[]`.
6. Replace the generic coronation with the three ending policies in
   `StorySystem.endingFor` + `RulerPanel`.
7. Add a chapter-state fixture test (flags + gate + ending selection).
8. Preserve save IDs; any new persistent field needs a migration + fixture
   (`AI_RULES.md`).
