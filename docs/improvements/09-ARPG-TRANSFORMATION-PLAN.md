# 09 — ARPG Transformation Plan (Realm Rise → Aetheria)

Date: 2026-09-21. Maps the dark-fantasy ARPG brief onto the existing codebase:
what already satisfies it, what this pass grafts on, what later passes own.

**Prime directive honored**: extend working systems, never rewrite. The combat
core (hitstop, shake, combos, finishers, parry, dodge i-frames), enemy state
machines, rarity loot, quest engine, story chapters, and versioned saves were
audited and are kept untouched.

---

## Audit verdict — what the brief asks for vs. what exists

| Brief area | Existing state | Action this pass |
|---|---|---|
| Combat feel (§16) | ✅ Hitstop, camera shake, slash FX, anticipation squash, combo 3-hit finisher w/ knockback, crit floaters, parry window, dodge ghosts | none — already exceeds |
| Enemy architecture (§8) | ✅ Full SM (IDLE/PATROL/DETECT/CHASE/ATTACK/RETREAT/SEARCH/DEAD) + styles (melee/ranged/pounce/charge/brute slam), prey AI, cowardly flee | add `resist`/`weak` element fields |
| Weapons data (§6) | ⚠️ `cat: 'weapon'` defs exist (sword/spear/bow/greatsword/axe), incl. Nightfall + Dawnbreaker | extend schema: `element`, `special`; add dagger/dualblades/staff; wire specials into combat path |
| Elemental system (§7) | ❌ absent | new `systems/ElementalSystem.ts` — pure functions, testable |
| Enemy damage hook | `Enemy.takeDamage(amount, srcX, srcY, floaters, crit)` — no element param | add optional `element` arg; resist/weak multipliers + tint feedback |
| Loot rarity (§11) | ✅ common→mythic w/ rare+ glow fanfare | none |
| Progression (§10) | ✅ XP/levels/stats/skills (skills.ts), derived stats via ProgressionSystem.recompute() | none |
| Quests/story (§13–14) | ✅ QuestEngine, questsMain/Side, StorySystem chapters, intro slides | later pass: shard narrative beats |
| Bosses (§9) | ✅ BossEnemy w/ phases, arena ring | later pass: Hollow King-style phase kits |
| Inventory (§12) | ✅ InventorySystem + React panels | later pass: stat comparison |
| Save (§20) | ✅ versioned SaveSystem | no schema break — weapons data extends additively |
| Regions (§4) | ✅ biome table w/ danger scaling | later pass: region identity kits |
| Audio (§17) | ✅ AudioSystem + sfx + ambient by biome | none |

## This pass (Phases A–D, incremental) — IMPLEMENTED & LIVE-VERIFIED

1. **`data/weaponsArpg.ts`** — new weapon defs only (no edits to existing):
   dagger, dual blades, staff + legendaries **Voidfang**, **Stormpiercer**,
   **Gravekeeper** (Dawnbreaker exists; gets `element`/`special` via schema).
2. **`systems/ElementalSystem.ts`** — pure module: element table (physical,
   fire, ice, lightning, poison, shadow, holy), resist/weak multipliers,
   elemental crit bonus, status-application rules (burn/chill/shock).
   Zero Phaser imports → directly unit-testable.
3. **Wire-up (surgical)**:
   - `Enemy.takeDamage(..., element?)` — applies multipliers, floats colored
     numbers, enemy tint by element, applies status.
   - `Player.tryAttack` — passes `wpn.element`; charged/finisher hits apply
     weapon `special` (Voidfang energy refund, Stormpiercer chain, Gravekeeper
     lifesteal + undead bonus, Dawnbreaker wave on heavy).
   - `spawnProjectile` — element-aware trail tint; staff fires magic bolts.
4. **Tests**: `tests/weapons-elements.mjs` chained into `npm test` — damage
   math, resist/weak, status windows, special triggers, schema validation of
   all weapon defs (every weapon has valid element/style/cd).

## Verification evidence (this pass)

- **Unit**: `tests/weapons-elements.mjs` — 133 assertions (element math,
  resist/weak, status stacking/expiry, chill slow, shock amp, all four
  legendary specials incl. boss-skip and undead matcher, weapon schema
  validation across every `cat:'weapon'` def, distinct-special check,
  mana save-migration + idempotency + ancient-save repair). Chained into
  `npm test` (now 9 suites).
- **Live browser probes** (real combat path, not mocks):
  - Staff bolt: mana −6/cast, `magic` projectile with arcane ADD-blend tint,
    damage landed (60→38 on a boar).
  - Stormpiercer chain: primary 23 → chain 10 (45%) to a second boar.
  - Elemental weakness: Stormpiercer (lightning) vs swamp_beast `weak` →
    1.67× observed damage ratio vs neutral boar.
  - Gravekeeper lifesteal: green `+4` heal floaters (12% of 34) on hit.
  - Dawnbreaker wave: heavy 63 primary → 31 splash to a nearby boar.
  - Mana regen: 3.5/s + willpower scaling confirmed by pool refilling.
- **Fixed during verification**: chill never armed its slow timer;
  shock had no effect (now +15% damage taken); Dawnbreaker was missing its
  `element`/`special` (predated the schema); legendary heavies were
  skill-locked — legendaries now carry `heavy: true` so their signature
  abilities work out of the box.

## Later passes (owned, not forgotten)

- Phase 4+: region identity kits (Ashen Village etc. as biome re-skins +
  ambience), parallax skyline layer, waterfalls/smoke emitters.
- Phase 7: named bosses w/ intro sequences + unique loot tables.
- Phase 6: shard-recovery quest arc grafting onto StorySystem chapters.
- Phase 5: inventory stat-comparison UI.
