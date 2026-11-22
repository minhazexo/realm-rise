# Game Design — Mechanics Overhaul

> How the game *plays*: the core loop, combat feel, progression, economy, and the
> kingdom. Each section names the owning system so it can be implemented without
> adding a new one.

## 0. The core loop

```
EXPLORE → DISCOVER → GATHER → SURVIVE → FIGHT → LOOT → CRAFT
   → UPGRADE → RECRUIT → BUILD → PROTECT → EXPAND → RULE
```

Every arrow must pay into the next. The **new rule** is that the loop is
**bidirectional at the settlement**: the town feeds expeditions (food, gear,
recruits, fast travel) and expeditions feed the town (materials, people,
reputation, safety). `KingdomEconomy.productionTick` and the build/craft chain
already do half of this — the missing half is *town → expedition* provisioning.

### Lessons borrowed (and from where)

| Lesson | Source pattern | What we take |
|---|---|---|
| **Tight, legible combat with meta progression** | Hades | Fast telegraphs, meaningful specials, death is a setback not a wall |
| **Two interlocking loops** | Cult of the Lamb | Action loop + town loop, each rewarding the other |
| **Density & build synergy** | Vampire Survivors | Auto-attack assist already exists (`AutoAttackSystem`); evolve into synergies |
| **Hybrid day/night purpose** | Dave the Diver, Moonlighter | Day = build/trade, night = danger/high-value exploration |
| **Relationships as progression** | Stardew | NPCs and citizens are content, not decoration |
| **Early-game clarity** | Bellwright/Core Keeper complaints | A designed first hour, not a sandbox dump |
| **Settlement as the goal** | Bellwright | Chains of need: food → shelter → tools → villagers → defense |

## 1. Combat & feel

Owned by `entities/Player.ts`, `entities/Enemy.ts`, `entities/BossEnemy.ts`,
`systems/combat/*`, `core/Constants.ts`.

**Game feel is a feature.** The juice stack (hitstop, screen shake via
`CameraSystem.shakeAllowed`, flash, knockback, floating numbers) exists — tune it,
don't rebuild it.

| Change | Detail | Owning module |
|---|---|---|
| **Weapon identity** | Slash (wide arc), Crush (stagger), Pierce (reach/line) differ in arc, speed, stagger | `constants.PLAYER_CONFIG`, `WeaponSpecials` |
| **Combo & heavy** | 3-hit light chain + hold-to-heavy within a window | `entities/Player.ts` |
| **Parry reward** | Perfect block within a window reflects/dazes; stamina-efficient | `Player` + `ElementalSystem` statuses |
| **Elemental depth** | Fire/ice/lightning/poison resistances & status with readable tells | `systems/combat/ElementalSystem.ts` |
| **Enemy FSM clarity** | IDLE→PATROL→DETECT→CHASE→ATTACK→RETREAT→SEARCH→DEAD; telegraphed wind-ups | `entities/Enemy.ts` |
| **Elites/bosses phase-lock safely** | No phase lock during transition; add arena tells | `BossEnemy`, `data/elites.ts`, `data/enemies.ts` |

**Rule:** every attack a player must dodge has a ≥250 ms telegraph, a distinct
sound, and high-contrast VFX (readable per `ART-DIRECTION.md` §12).

## 2. Progression & retention

Owned by `systems/combat/ProgressionSystem.ts` (derived stats) and
`ProgressionXP.ts` (XP, levels, skills, professions, reputation).

- **Multiple layers:** player level → stat/skill allocation → gear → abilities →
  professions → reputation → kingdom stage. All exist; the plan is to make each
  layer *unlock a capability*, not just a number (`Constants.STATS_CONFIG`).
- **Short/medium/long/epic goals:** the HUD must always show a chain
  (`QuestTracker` + `FirstSteps`); aim for ≥3 visible goals.
- **No grind walls:** `xpForLevel = 58 + level^1.62 * 17` is already gentle —
  keep, and add XP from exploration/crafting/discovery (already wired in
  `XP_CONFIG`).
- **Capability unlocks:** e.g. high Charisma → better recruits/prices; high
  Survival → more yield/harsher biomes; high Leadership → larger armies. These
  are `req` checks, not new currencies.

## 3. The ARPG layer

`ElementalSystem` and `WeaponSpecials` reference this doc as their design source.

- **Elements:** Fire (DoT), Ice (slow/brittle), Lightning (chain/stun), Poison
  (stacking), Physical. Resistances per enemy type; the night/difficulty
  multipliers (`DIFFICULTY`, `DAYNIGHT_CONFIG.enemyNightBuff = 1.35`) apply on top.
- **Named specials:** legendary weapons resolve named abilities from data
  (`data/weaponsArpg.ts`) — no hardcoded logic in entities.
- **Build expression:** gear + skills + specials combine into named playstyles
  (e.g. "Ember Warden" = fire + crush + high defense). Communicate via a
  character-panel summary, not tooltips alone.

### The weapon ladder (enforced, not asserted in prose)

`dmg / cd` is banded by rarity so a higher tier is never weaker than a lower
one. Within a band, a slow weapon earns a little more DPS and a fast weapon
earns crit instead. `tests/items.mjs` fails the build on any weapon outside its
band, any epic+ weapon without a mechanic, or any gear item without a source.

| Rarity | DPS band | Identity budget |
|---|---|---|
| Common | 12–30 | one clear trade-off |
| Uncommon | 28–42 | a stat trade-off (reach, stagger, ammo) |
| Rare | 40–56 | one stat spike (crit, range, combo finisher) |
| Epic | 54–66 | one named special (cleave, shadowfang) |
| Legendary | 68–80 | a named special plus a second spike |
| Mythic | 84–96 | a special and a rule-breaker (pierce, wave, reach) |

Named specials live in `WeaponSpecials.WEAPON_SPECIAL_IDS` and are resolved from
data — a weapon may only name a special that exists.

**Acquisition is content.** Every weapon, armor piece and trinket must have a
real source: a recipe (often flag-gated by the story beat that makes it
plausible), a boss/elite drop, a chest pool, a quest reward, or the starter kit.
Nine ARPG weapons once shipped with no source at all; the gate now catches it.

## 4. Survival — lean, not punishing

Owned by `systems/environment/EnvSystem.ts`, `core/Constants.ts`.

- Hunger/thirst drain (`hungerDrain 0.015`, `thirstDrain 0.019`), regen gate
  (`regenWhenFedAbove 62`), temperature exposure by biome.
- **Keep it tension, not chore:** food should gate long expeditions and enable
  buffs, not force a return home every few minutes.
- **Biome survival identity:** Frozen = cold; Emberwaste = heat; Murkfen =
  disease; Veil zones = sanity/forgetfulness (a new light mechanic, not a bar
  spam — a whispered UI effect first).

## 5. Economy & trade

Owned by `systems/economy/EconomySystem.ts`, `systems/world/KingdomEconomy.ts`,
`core/Constants.TRADE_SPREAD` (`buyMult 1`, `sellMult 0.45`).

- **Regional affinity** already makes exploration pay; extend it to authored
  regions in `WORLD-MAP.md`.
- **Town → expedition provisioning:** buy rations/tools/contracts at home to
  enable the next push.
- **Faction policy moves prices:** an alliance should visibly change a route's
  rates (per `EVENTS.md` `caravan`/`faction_tax`).
- **Gold sinks:** building upkeep, military wages (`MILITARY_CONFIG`), repairs.

## 6. Kingdom, population, happiness

Owned by `systems/economy/KingdomSystem.ts`, `world/KingdomEconomy.ts`,
`world/kingdomSim.ts`, `Constants.SETTLEMENT_CONFIG`.

- **Stage gates** already require buildings/citizens/happiness/defense/territory
  — keep, and make each stage *visually transform the town* (`ART-DIRECTION.md`).
- **Citizen needs:** food, housing, safety, employment, entertainment →
  happiness; low happiness → departure/productivity loss (exists), high →
  growth and better arrivals.
- **Policy choices:** each faction alliance should require a visible kingdom
  policy with a cost (taxes, land use, garrisons) — ties to `STORY.md`.

## 7. Crafting & building

Owned by `systems/combat/CraftingSystem.ts`, `systems/economy/BuildSystem.ts`.

- **Craft queue UI + batch salvage** and **armor wear/repair** are planned
  quality passes (referenced by the prior improvements set) — they live here now.
- **Station proximity** (campfire, forge, kitchen, tannery, workshop) is the
  craft's spatial rule; authored stations (`regionStations()`) join the same rule.
- **Building placement** (`canBuildAt`, `nearMountains`, ghost, construction
  animation) stays; add damage states so raids read visually.

## 8. Factions & diplomacy

Owned by `systems/economy/FactionSystem.ts`, `data/factions.ts`.

- Five powers: Iron, Verdant, League, Ashen, Ancient — `rel` with stages
  (war → hostile → neutral → cordial → allied).
- **Consequence-first:** a gift/quest/trade changes standing; standing changes
  prices, routes, and *who appears in events*. Never cosmetic.
- **Ashen redemption path:** Ashen rank-and-file are redeemable (see
  `STORY-BIBLE.md`), so low Ashen standing is a story state, not just a debuff.

## 9. Exploration & discovery

Owned by `PoiRegistry`, `worldGen`, `RegionSystem`, `MinimapSystem`.

- Curiosity rewards: each region reveals **one new fact and one new question**
  (bible rule) and a persistent change.
- **Fog of war** with rumour labels for undiscovered regions (`WORLD-MAP.md` §7).
- Fast travel unlocked by discovery only.

## 10. Difficulty & accessibility

- `DIFFICULTY` tiers already scale enemy dmg/speed/aggro/loot/drain/threat.
- **Accessibility:** `immortal` toggle (tests), `reducedMotion`, photosensitivity
  rules (weaken bloom/shake/aberration), text size, UI scale — all in
  `SettingsSystem` and `styles.css`.

## 11. What we will NOT do

- No ECS rewrite, no engine change (`ART-DIRECTION.md` §1).
- No feature that doesn't feed another system.
- No manipulative retention, energy timers, or monetisation.
- No branching explosion — choices use foldback with memory (`STORY.md`).

## 12. Concrete tunable targets (initial)

| Knob | Now | Target | File |
|---|---|---|---|
| Light→heavy combo window | — | 320 ms | `Constants.PLAYER_CONFIG` |
| Parry window | — | 220 ms | `Constants.PLAYER_CONFIG` |
| Night enemy buff | 1.35 | 1.35 (keep) | `Constants.DAYNIGHT_CONFIG` |
| Sell multiplier | 0.45 | 0.45 (keep) | `Constants.TRADE_SPREAD` |
| Event interval | 55 s | chapter-scaled 45–75 s | `data/worldEvents.ts` |
| Settlement stages | 7 | 7 (keep) | `Constants.SETTLEMENT_CONFIG` |
