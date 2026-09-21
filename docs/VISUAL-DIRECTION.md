# Visual direction and free-tool research

## Delivered: item artwork foundation

41 selected CC0 icons by Henrique Lazarini (7Soul1) now replace matching
procedural icons: axes, swords, spears, bows, food, potions, resources,
jewelry and quest items. PNGs are bundled locally, loaded before WorldScene
creation, and copied into the shared 34px Phaser/React atlas. Missing or
unmapped artwork uses the original procedural drawing, centered at native
resolution. No engine, language, dependencies, gameplay or save format changed.

Source and licensing: `public/assets/items/CREDITS.md`.
Mapping: `src/game/assets/itemArtwork.ts`.
Browser regression: `node tests/item-art-browser.mjs`.
Screenshots: `tests/_artifacts/item-art-inventory.png` and
`tests/_artifacts/item-art-crafting.png` (regenerable, not committed).

This is not a full graphics overhaul. 51 items still use procedural drawings,
including picks, hammer, fishing rod, armor and shields. The imported stone
axe is a generic axe illustration, not a bespoke flint-tool design.

## Engine recommendation

Keep Phaser + TypeScript for this 2D browser game. The present bottleneck is
art direction and assets, not the programming language. Migrating engines
would require rebuilding scene/input/rendering integration and would not
supply a coherent art set automatically.

Godot is a viable free/open-source alternative if the project deliberately
changes to 3D or an editor-led workflow; it is MIT licensed and requires its
license notice when distributing the engine. No migration was attempted.
Source: https://godotengine.org/license/

## Free resources researched

- **7Soul1 CC0 fantasy icons:** colored 34px item illustrations, selected for
  this implementation. Use this specific CC0 compilation, not an arbitrary
  pack with a similar name.
  https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg
- **Game-icons.net:** scalable symbolic icons; CC BY 3.0 requires author
  attribution. Suitable for action/status UI, not a replacement for colored
  world sprites. Not bundled.
  https://game-icons.net/about.html
- **Piskel:** free, open-source pixel-art and animation editor with PNG and
  sprite-sheet export. Useful for filling icon gaps and authoring coherent
  character animations; not installed or added as a dependency.
  https://www.piskelapp.com/

## Recommended next visual passes (not implemented)

1. Choose a single world-art style and base pixel scale. Build one representative
   clearing with a player, axe swing, tree, rocks, grass and a small building
   before replacing every biome. Do not mix unrelated packs indiscriminately.
2. Improve terrain readability: grounded paths, soil around trees, clustered
   foliage, coherent shadows and less uniform green haze. Review daytime,
   nighttime and indoor/readability cases at normal zoom.
3. Replace character silhouettes and add recognizable equipped-tool attack and
   gathering animations. Preserve collision dimensions and gameplay timing.
4. Replace buildings and gathering nodes in the same style; then complete the
   remaining inventory icons and UI spacing/contrast.
5. Validate frame rate, loading size, reduced motion and browser screenshots
   throughout. Asset licensing must be verified per pack before importing.

The verified icon screenshots demonstrate the remaining mismatch between
detailed item art and simple world sprites. More particles alone will not
resolve that mismatch.
