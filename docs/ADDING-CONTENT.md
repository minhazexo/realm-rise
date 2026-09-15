# Adding Content — Step-by-Step Guide

> If you can edit a data file, you can add content. No scene changes needed
> for standard additions. After any addition run `npm test` — the content
> validator (`tests/content.mjs`) checks every reference you add.

## New resource node (tree / rock / plant)

1. **Art**: add the texture in the matching builder —
   trees → `src/game/assets/propsNature1.js` (`buildNatureProps`),
   rocks/ores/flora → `propsNature2.js` (`buildRockProps`). Reuse helpers
   (`circ`, `ell`, `rr`, `shade`) and `seededRandom()` (deterministic).
2. **Definition** in `src/game/world/nodeTypes.js`:
   ```js
   frost_pine: {
     tex: 'tree_frost_pine', tool: 'axe', yRes: 'wood',
     yieldBase: [3, 5], solid: [10, 8],
     prof: 'woodcutting', xpPerHit: 3,
   },
   ```
   Field reference: `tex` (asset key), `tool` (`axe`|`pick`|null),
   `yRes` (item id — must exist in `data/items*.js`), `yieldBase` [min,max],
   `solid` [w,h] hitbox, `prof`, `xpPerHit`, optional `minToolTier`, `tint`,
   `emptyTex`, `hardMinProf`.
3. **Spawning**: add `{ type: 'frost_pine', weight: N }` to the biome(s) in
   `src/game/world/biomeTable.js`.
4. **Minimap**: automatic if the type matches `nodeGlyph()` in
   `world/mapRender.js` (`tree|rock|herb|berry|…`); extend the regexes if you
   invent a new category.
5. Verify: `npm test` (biome→node, node→item, texture-field checks).

## New item

1. Add a `def(...)` call in the right authoring file:
   `data/itemsResources.js` (materials), `itemsGear.js` (tools/weapons),
   `itemsArmor.js` (armor/trinkets). Kernel:
   ```js
   def('frost_axe', { name: 'Frost Axe', cat: 'weapon', rarity: 'rare',
     stack: 1, value: 120, desc: '…', weapon: { dmg: 18, crit: 0.08,
     cd: 0.4, range: 54, style: 'slash' }, durability: 220,
     icon: { shape: 'axe', c1: '#bfe0ff' } });
   ```
   Categories: `resource|consumable|tool|weapon|offhand|armor|trinket|special`.
   Slots (when wearable): `weapon|offhand|helmet|chest|gloves|boots|ring|amulet`.
   `icon.shape` must match a drawer in `iconShapesA/B.js` (validator checks).
2. Equipment behavior keys: `weapon {dmg,crit,cd,range,style,ammo?}`,
   `armor/warmth`, `tool {tool:'axe'|'pick', tier, gatherMult}`, `use {food,
   thirst,hp,…}`, `mods {strength,…}`, shield: `shieldBlock`.
3. It instantly works in inventory, loot, trade, and crafting outputs.

## New enemy

1. Add the def to `enemiesWild.js` (wildlife) or `enemiesHuman.js`
   (`BANDITS` / `BOSSES`). Required: `name`. Common: `hp, atk, speed,
   detect, attackRange, radius, scale, sheetKey, style, loot [{id, chance,
   min, max}], boss?`.
2. Loot `id`s must be real items (validator checks).
3. Art: humanoids reuse `sheetsHuman.js` variants via `ENEMY_VARIANT_MAP` in
   `assets/index.js`; wildlife needs a quadruped sheet entry.
4. Spawning: add `{ key, w }` to biome `enemies` tables; bosses attach via
   POI `boss` fields or raid parties.
5. No registration step — `data/enemies.js` merges all sources through the
   strict `Registry` (duplicate keys throw at load).

## New building

1. Add to `buildingsA.js`/`buildingsB.js`: `cost {item:qty}`, `hp`,
   `buildTime`, `upgradesTo?`, `tex`, category, production/effect hooks.
   Costs may reference items or other buildings (validator checks both).
2. Appears in BuildPanel + KingdomPanel automatically via `BUILDINGS`.

## New crafting recipe

1. Append to `recipesA.js`/`recipesB.js`:
   ```js
   { id: 'frost_axe', out: 'frost_axe', qty: 1, cost: { wood: 4, iron_ingot: 3 },
     station: 'forge', category: 'weapons', time: 6 },
   ```
2. `cost`/`out` must be real items. Bulk variants: distinct `id`, shared
   `out` (e.g. `iron_ingot_x5`) — lookup-by-id and lookup-by-output are
   separate paths, keep both unique/sane.

## New quest

1. Main: entry in `questsMain.js` + append id to `QUEST_ORDER` (order matters).
   Side: entry in `questsSide.js` (offered via NPC dialogue actions).
2. Step targets must resolve: `item`→items, `enemy|target`→enemies,
   `building`→buildings (validator checks all three).

## New skill

1. Entry in `data/skills.js` with `branch` (one of `BRANCHES`), `maxRank`,
   `fx` (consumed by `ProgressionSystem.skillFx`), `req` (other skill ids).

## Runtime construction (EntityFactory)

Game code never `new Enemy()` directly. `src/game/systems/EntityFactory.js`
is the single construction point, reading the registries:

- `createEnemy(scene, key, x, y)` — boss keys route to `BossEnemy`.
- `createResource(scene, type, x, y, stateKey, state)` — full node record.
- `createNpc(scene, key, x, y, onInteract)` — sprite + wander state + wiring.
- `createItem(id, qty)` — headless; stackables merge, gear returns unique
  instance(s), unknown ids → `null`.
- Entity classes are injected (`configureEntities`, wired once in
  `WorldScene.create`) so systems stay Phaser-free and headless-testable.
  `WorldScene.spawn*` / `SpawnDirector.*` are thin delegates — call those,
  not the classes.

## Debug console (`window.rise`, DEV-only)

Available in dev builds only (gated by `import.meta.env.DEV`, stripped from
production). Never throws — every command returns a status string:

- `rise.help()` — command list.
- `rise.give(itemId, qty)` / `rise.spawnEnemy(key, n)` /
  `rise.spawnResource(type, n)` — content by registry id (typos reported).
- `rise.teleport(x, y)` / `rise.setLevel(n)` / `rise.clearInventory()` /
  `rise.state()` — position, progression, reset, summary.
- `window.riseGame` (the Phaser instance) is kept for automated playtests.

## Data schemas (quick reference)

- ID format: `/^[A-Za-z0-9_]+$/`, unique per domain (enforced).
- Numbers: yields `[min,max]`, chances `0..1`, weights `>0`.
- Never put Phaser objects, functions-with-closures over scenes, or DOM
  handles in defs — data files must stay importable in node (tests enforce
  this by importing them).
