# Vision — Rise of the Realm

> **One sentence:** a beautiful, painterly, top-down survival → kingdom RPG where
> a shipwrecked nobody builds a refuge against a quiet apocalypse and decides
> what kind of ruler the realm deserves.

This is the north-star document. When a feature is in doubt, it should serve a
pillar here or it should not be built.

## The pitch

You wake on a frontier shore with nothing. You gather, cook, and fight to see
tomorrow. Strangers who find your fire stay, and the fire becomes a village, a
town, a kingdom. But the frontier is *wounded* — an ancient barrier called the
**Fivefold Anchor** failed, and the **Veil** is leaking in: places forget their
shape, people forget their promises. The player carries the barrier's missing
piece without knowing it, and the kingdom they raise is the answer to the
question the old civilisation got wrong.

**Genre:** cozy-dark survival-craft × settlement/kingdom builder × action RPG.
**Camera:** top-down 2D, painterly.
**Platform:** browser (Phaser 4 + React 19 + Vite), keyboard/mouse + touch.
**Session shape:** long-lived save with a chapter arc; 20–60 minute comfortable
sessions, always with a next goal.

## Product pillars

| Pillar | Player feeling | The systems that carry it |
|---|---|---|
| **Build the light** | "This place exists because I made it." | Build, craft, population, economy, housing, happiness |
| **Follow the wound** | "Something is wrong and I can understand it." | Exploration, ruins, books, shards, guardians, region story |
| **Choose the burden** | "My leadership has a cost." | Factions, trade routes, raids, kingdom policy, endings |
| **Keep the frontier alive** | "The world remembers what I did." | Dynamic events, reactive NPCs, saves, POIs, world-state |

## Design lessons we are deliberately borrowing

Distilled from current 2D and survival/kingdom games (see sources at the end):

1. **Readability beats raw detail.** Every successful look (Celeste's clean
   silhouettes, Hollow Knight's line hierarchy, Hades' high-contrast accents)
   keeps the gameplay layer legible. Painterly art must never hide an enemy, a
   path, or a hazard. *(digitalsynopsis 2D art-style breakdown)*
2. **Value and saturation route the eye before detail does.** Warm light = safe,
   cool haze = distance, high-contrast accent = interactable. We design the
   lighting pass *with* the art, not after. *(Ori production note)*
3. **Build planes separately.** Foreground / gameplay / midground / background
   are distinct, and the composition is tested **with FX on**, because bloom and
   particles erase platforms in motion. *(Ori production note)*
4. **Systems carry the story.** The strongest modern narrative design tells the
   story through verbs and world state ("foldback with memory") instead of a
   branch explosion. Choices reconverge; *who helps and what changed* varies.
   *(Mirkowski / GDC storytelling-through-systems)*
5. **A clear first-ten-minutes hook.** Market data shows players reach fewer
   games each year; the hook and the pitch matter as much as the feature list.
   *(Newzoo 2025)*
6. **Early-game clarity is the genre's #1 complaint.** Bellwright/Core Keeper
   player discussion is dominated by "what do I do first?" — so our first hour is
   a designed tutorial chain, not a sandbox drop. *(Bellwright/Core Keeper
   community guides)*

## Differentiators

- **A refuge, not a conquest.** The fantasy is protection and belonging, not
  map-painting. Walls exist to keep people safe, and raids are consequences of
  policy, not random aggression.
- **Consequence over sprawl.** We do not promise a separate campaign per player.
  We promise their *town, allies, and government* visibly reflect their choices.
- **One authored spine in a procedural world.** The Ashen Frontier proves the
  world can be hand-built; the generator makes the rest infinite. Regions are the
  bridge between the two.
- **Beauty as a mechanic.** Night is dangerous because it is dark; the painterly
  lighting pass is gameplay readability, not decoration.

## Anti-goals

- Not an MMO; no live-service, monetisation, or manipulative retention loops.
- Not an ECS rewrite; the layered architecture in `STRUCTURE.md` stays.
- Not "RPG with every feature" — every system must feed another.
- Not photoreal; "4K quality" means *crisp, high-resolution painterly craft*,
  not realism (see `ART-DIRECTION.md`).
- Not gratuitous branching: decisive choices only at story-critical moments.

## Success signals (how we know it works)

| Signal | Target |
|---|---|
| First-session completion | Player reaches Chapter II (first fire + campfire) without external help |
| Readability | Enemy, interactable, and path identification at normal zoom in day **and** night, verified by screenshot review |
| Performance | 60 fps at 1080p on an integrated GPU; no frame over 33 ms during a raid |
| Story trace | Every major reward leaves a persistent world-state change |
| Retention | "One more thing" loop: always ≥3 visible short/medium goals in the HUD |

## Sources

- Digital Synopsis — *8 Essential 2D Game Art Styles* (Celeste, Hollow Knight,
  Cuphead, Ori, Limbo, Hades, Night in the Woods, Octopath II) —
  https://digitalsynopsis.com/design/2d-game-art-styles/
- Adam Mirkowski — *How to write a branching narrative and won't lose your mind*
  (hub-and-spoke vs waterfall, critical path, variables) —
  https://adammirkowski.substack.com/p/how-to-write-a-branching-narrative
- *The Art of Game World Maps* (Nathan Cheever) —
  https://medium.com/@EightyLevel/the-art-of-game-world-maps-b41c18633bf7
- Red Blob Games — *mapgen4* procedural biome/rainfall reference —
  https://www.redblobgames.com/maps/mapgen4/
- Bellwright / Core Keeper community progression guides (early-game clarity).
