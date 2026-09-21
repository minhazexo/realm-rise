# TODOs — Roadmap & Known Issues

The living roadmap for Realm-Rise, organized by discipline. Items marked ✅
moved to "Recently completed" at the bottom. Effort: S (< 1 pass) · M (a pass)
· L (multi-pass).

---

## 🎮 Game Logic

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| L1 | **Animal schedules & need zones** — deer graze near lakes at dawn, rest midday in thickets; wolves den in pines and hunt at dusk. Reuse the existing time-of-day bus; add a per-species schedule table next to `enemiesWild.ts`. | Biggest single realism win per theHunter design pillars (see `docs/improvements/08_LIGHTING_AND_FAUNA.md`); makes hunting a *game* (time + place), not a spawn-roll. | M |
| L2 | **Animal senses** — replace omniscient `detect` radius with a sight cone + hearing radius; crouching/walking slows detection. Enables a stalking mechanic and stealth play. | Prey that only flee when *seen* create emergent hunts; also fixes deer spooking through trees. | M |
| L3 | **Hunting loop rewards** — field-dress interaction on prey corpses (time cost, better loot), trophies for the settlement. Ties fauna realism into the economy. | Gives the new prey species a purpose beyond ambiance. | S |
| L4 | **Build-card click doesn't reliably engage placement mode** — panel closes but no ghost/toast. `BuildSystem` is sound (verified end-to-end); suspect React→canvas synthetic-input delivery. | Core loop friction. | M |
| L5 | **DeathOverlay restore** — respawn works but enemy state isn't properly restored after death. | Fair-death contract. | S |
| L6 | **Trading economy balance pass** — buy/sell spreads need a tuning pass with real scarcity (regional prices: fish cheap at lakes, ore cheap near mountains). | Money-printing kills progression. | S |
| L7 | **LegacyStore (NG+) content** — system exists, no content: carry-over perks, cosmetic lines, world modifiers. | Retention layer. | M |
| L8 | **Enemy spawn zones** — keep hostiles from spawning/aggroing too close to the settlement (partially done for nodes; extend to enemies). | Base-camp safety valve. | S |
| L9 | **Weather → fauna coupling** — storms send animals to shelter, dawn/dusk activity spikes (weather bus already exists). | World coherence. | S |

## 🎨 Game Visuals

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| V1 | **Light flicker & light sources pass** — subtle 2–4 Hz noise on fire lights (amplitude-capped, zeroed by reducedMotion/photosensitive settings); more settlement lamps, window glow at night. | The night mask now works; flicker is what sells "fire". | S |
| V2 | **Grass–fauna interaction** — trample under deer herds, chaff burst when prey bolt (`GrassField` exposes per-slab trample). | The two new systems should meet. | S |
| V3 | **Water polish** — animated shoreline foam on lakes (river foam exists), reflection tint for sky time-of-day, lily pads/reeds on lake edges. | Lakes are now a centerpiece (grass fix made them readable); they should carry the view. | M |
| V4 | **Character/animation pass** — more player frames (idle variation, jump), hit reactions on enemies (flinch direction), death fades. | Combat reads stiff against the new fauna. | M |
| V5 | **Biome ground texture variety** — second ground tile per biome with patch blending (grass→dirt wear paths near settlements). | Kills tile monotony on long walks. | M |
| V6 | **Weather-facing surfaces** — snow accumulates on roofs/props, rain ripples in puddles. | Endgame visual sell. | L |
| V7 | **UI icon consistency** — inventory tooltips with item stats (also UX U4), unified icon style for the new item art set. | Screenshots sell the game. | S |

## 📖 Story & World

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| S1 | **Story delivery beyond the intro** — the 4-page intro exists; add found-notes on ruins/waypoints (readable journal entries),NPC one-liners that reference current chapter/quests. | World already has ruins, bosses, chapters — it needs a voice. | M |
| S2 | **Faction identity** — names, colors, banners on raid parties and settlements; a "why they raid" line in faction UI. | Raids currently arrive anonymous. | M |
| S3 | **Quest chain per biome** — one memorable quest per biome that teaches its mechanic (swamp → durability/venom, volcanic → heat). | Guides the danger scaling that exists in balance data. | L |
| S4 | **Endgame goal** — a visible win condition after the final chapter (rebuild the realm / seal the storm) with epilogue screen. | Gives NG+ (LegacyStore) a doorway. | L |
| S5 | **Environmental storytelling** — abandoned camps with loot + a note, bone piles near wolf dens, deer grazing grounds marked by worn grass. | Cheap depth via existing node/prop system. | S |

## 🔊 Audio

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| A1 | **Animal voices** — deer bleats on flee, wolf howls at dusk (time bus exists), bird-burst flush when walking through flocks (bird-burst FX exists; needs the sound half). | Fauna realism is half-visual today. | S |
| A2 | **Grass/terrain footsteps** — rustle in grass, crunch in snow, splash at shore (footstep events already emitted). | Ties movement to the world. | S |
| A3 | **Dynamic music layers** — exploration base layer, combat layer crossfade (auto-attack system already exposes "in-combat" state). | Combat entry feels scored. | M |

## 🕹 UX & Meta

| # | Item | Why it matters | Effort |
|---|------|----------------|--------|
| U1 | **Achievement popups** — visual unlock ceremony (CelebrationFX exists — reuse it). | Rewards loop. | S |
| U2 | **Save export/import** — JSON download/upload. | Player trust. | S |
| U3 | **Pickup animation** — items fly toward the player on collect. | Juice on the most repeated action. | S |
| U4 | **Inventory tooltips** — hover stats/descriptions (with V7). | Discoverability. | S |
| U5 | **Hunting journal** — track species sighted/killed, biggest buck; feeds the hunting loop (L3). | Gives fauna a meta layer. | M |

## ⚡ Performance & Code Quality

| # | Item | Notes | Effort |
|---|------|-------|--------|
| P1 | **WorldScene extraction** — still a ~1,150-line coordinator holding Floater, zoom cadence, UI plumbing. Extract into systems (top standing gap from audits). | Maintainability. | L |
| P2 | `nodeHasTicks` unused variable, `kingdomPct()` defined twice, `GATHER_CONFIG_TICK_XP` duplicated (`WorldScene`). | Trivial cleanups. | S |
| P3 | Vite dynamic-import warnings (ineffective imports). | Build hygiene. | S |

---

## Recently completed

- **2026-09, lighting & fauna pass**: grass no longer grows in water (per-cell
  `isWaterAt` gate + per-slab base alpha); trees/enemies no longer spawn in
  lakes; night mask aspect-correct + adaptive sight radius (flat wash and
  egg-shaped holes fixed); held torch follows the player per-frame; day dimming
  via mask alpha; animals stride speed-scaled with torso bob; proper rear-view
  quadruped frames; **Red Deer** prey species (freeze→bolt behavior, herds of
  2–4, meat/hide loot). Details + research: `improvements/08_LIGHTING_AND_FAUNA.md`.
- **2026-09, quality passes 1–2**: level-up ceremony, idle breathing (shared
  `BreathingFX`), combat zoom bias, floater pool, NPC cull, foam striding,
  kill-XP biome scaling, raid columns, auto-attack assist, living grass with
  wind/trample, reducedMotion helper consolidation.
- **Earlier**: building HP/destruction, faction raids, weather particles,
  per-biome ambience, NPC wander AI, tutorial hints, settings (video/controls),
  minimap zoom + legend, screen-shake toggle, debug panel (F3).
