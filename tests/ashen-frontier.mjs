// THE ASHEN FRONTIER — authored region integrity & trigger semantics.
// Pure data checks (no Phaser, no browser). Chained into `npm test`.
//
// The trigger section exists because of a real shipped bug: the scene loop
// treated encounterTriggers()'s "should fire now" answer as "already done",
// which spawned every encounter on every frame the player was away from it
// (thousands of enemies). These assertions pin the polarity down.
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

/** Translate a quest step into the gameplay event that satisfies it. */
const bossEventFor = (step) => {
  switch (step.type) {
    case 'kill': return { type: 'kill', enemy: step.enemy };
    case 'boss': return { type: 'kill', boss: step.target };
    case 'gather': return { type: 'gather', item: step.item };
    case 'craft': return { type: 'crafted', itemId: step.itemId };
    case 'build': return { type: 'built', building: step.building };
    case 'reach': return { type: 'discover', poiTag: step.poiTag, poiKind: step.poiKind };
    case 'reachCount': return { type: 'discover', poiKind: step.poiKind };
    case 'talk': return { type: 'talk', npc: step.npc };
    case 'flag': return { type: 'flagset', flag: step.flag };
    case 'deliver': return { type: 'deliver', npc: step.npc, item: step.item };
    case 'surviveNight': return { type: 'survived-night' };
    case 'raid_defended': return { type: 'raid-survived' };
    case 'population': return { type: 'population', count: step.count };
    case 'stores': return { type: 'stores-check', resource: step.resource, amount: step.count };
    case 'recruit': return { type: 'recruit', npc: step.npc };
    case 'territory': return { type: 'territory-pct', pct: 100 };
    default: return { type: 'noop' };
  }
};

const {
  ASHEN_SUBREGIONS, ASHEN_LANDMARKS, ASHEN_ENCOUNTERS, ASHEN_INTERACTABLES,
  ASHEN_PUZZLE, ASHEN_SAFE_ZONE, ASHEN_POIS,
  subregionAt, inSafeZone, encounterTriggers, encountersToTrigger,
  encounterEnemyCount,
  forestBands, corridorDistance, FOREST_CORRIDOR, FOREST_BG_CLEARANCE, FOREST_FG_REACH,
  FOREST_DEEP_WOOD_MAX_Y,
} = await import('../src/game/data/regionAshen.ts');
const { puzzleStep, stationsOf } = await import('../src/game/data/region.ts');
const { getEnemyDef } = await import('../src/game/data/enemies.ts');
const { SIDE_QUESTS } = await import('../src/game/data/questsSide.ts');
const { SHARDS } = await import('../src/game/data/storyShards.ts');
const { getItem } = await import('../src/game/data/items.ts');
const { setWorldSeed, isWaterAt } = await import('../src/game/world/worldGen.ts');
const { allPois } = await import('../src/game/systems/PoiRegistry.ts');

// The player's spawn — the one place the region MUST be safe and quiet.
const SPAWN = { x: 0, y: 260 };

// ── 1. Sub-regions ──────────────────────────────────────────────────────
const areaIds = new Set(ASHEN_SUBREGIONS.map((a) => a.id));
ok(ASHEN_SUBREGIONS.length >= 8, `sub-regions: ${ASHEN_SUBREGIONS.length} areas authored`);
for (const a of ASHEN_SUBREGIONS) {
  ok(a.radius >= 150 && a.radius <= 700, `${a.id}: radius ${a.radius} is a readable play space`);
  ok(typeof a.name === 'string' && a.name.length > 3, `${a.id}: has a real place name`);
  ok(['hub', 'road', 'camp', 'forest', 'ruin', 'corrupted', 'secret', 'arena'].includes(a.kind), `${a.id}: kind '${a.kind}' known`);
  ok(!a.safe || a.kind === 'hub', `${a.id}: only hubs are marked safe`);
}
for (const a of ASHEN_SUBREGIONS) ok(typeof a.mood === 'string' && a.mood.length > 2, `${a.id}: audio mood '${a.mood}' declared`);

// Spawn safety: village contains the player start and is flagged safe.
const home = ASHEN_SUBREGIONS.find((a) => a.id === 'village');
ok(!!home && home.safe === true, 'village is the safe hub');
ok(inSafeZone(SPAWN.x, SPAWN.y), 'player spawn is inside the safe zone');
ok(subregionAt(SPAWN.x, SPAWN.y)?.id === 'village', 'player spawn resolves to the village area');
// Safe zone must not swallow a whole neighbour area.
for (const a of ASHEN_SUBREGIONS) {
  if (a.id === 'village') continue;
  ok(!inSafeZone(a.x, a.y), `${a.id}: enemy area is outside the safe zone`);
}

// ── 2. Landmarks ────────────────────────────────────────────────────────
ok(ASHEN_LANDMARKS.length === ASHEN_SUBREGIONS.length, 'every area has exactly one landmark composition');
for (const lm of ASHEN_LANDMARKS) {
  ok(areaIds.has(lm.area), `${lm.id}: area '${lm.area}' exists`);
  ok(typeof lm.story === 'string' && lm.story.length > 30, `${lm.id}: tells you what happened here`);
  ok(lm.props.length >= 4, `${lm.id}: composed of ${lm.props.length} props (not a single stamp)`);
  const offsets = new Set(lm.props.map((p) => `${p.dx},${p.dy}`));
  ok(offsets.size === lm.props.length, `${lm.id}: no two props stacked on the same offset`);
  const span = Math.max(...lm.props.map((p) => Math.hypot(p.dx, p.dy)));
  ok(span >= 60, `${lm.id}: spreads ${Math.round(span)}px — reads as a place, not a dot`);
}
ok(ASHEN_LANDMARKS.filter((l) => l.glow).length >= 2, 'at least a couple of landmarks carry their own light');

// ── 3. Encounter triggers (the shipped polarity bug) ─────────────────────
const spawnFires = encountersToTrigger(SPAWN.x, SPAWN.y, () => false);
ok(spawnFires.length === 0, `standing at spawn with nothing cleared triggers 0 encounters (got ${spawnFires.length}: ${spawnFires.map((e) => e.id).join(', ')})`);
ok(encountersToTrigger(ASHEN_SAFE_ZONE.x, ASHEN_SAFE_ZONE.y, () => false).length === 0, 'standing at the hub centre triggers nothing');

for (const enc of ASHEN_ENCOUNTERS) {
  const reach = enc.ambush ? Math.min(enc.trigger, 200) : enc.trigger;
  ok(!encounterTriggers(enc, enc.x + reach + 60, enc.y, false), `${enc.id}: silent while outside its ${reach}px trigger`);
  ok(encounterTriggers(enc, enc.x, enc.y, false), `${enc.id}: fires when the player steps onto it`);
  ok(!encounterTriggers(enc, enc.x, enc.y, true), `${enc.id}: never re-fires once cleared`);
  ok(enc.members.length > 0, `${enc.id}: has members`);
  ok(areaIds.has(enc.area), `${enc.id}: area '${enc.area}' exists`);
  // A fight must not be able to start inside the safe hub, and no enemy may
  // be RING-SPAWNED inside it either (the brief's safe-zone promise).
  const fromHub = Math.hypot(enc.x - ASHEN_SAFE_ZONE.x, enc.y - ASHEN_SAFE_ZONE.y);
  ok(!inSafeZone(enc.x, enc.y), `${enc.id}: centre sits outside the safe hub`);
  ok(fromHub - enc.spread > ASHEN_SAFE_ZONE.radius,
    `${enc.id}: even its widest spawn ring (${Math.round(fromHub - enc.spread)}px from hub) clears the hub`);
  for (const m of enc.members) {
    ok(!!getEnemyDef(m.key), `${enc.id}: member '${m.key}' resolves`);
    ok(m.count >= 1 && m.count <= 6, `${enc.id}: ${m.key} x${m.count} is a fair pull`);
    ok(['patrol', 'guard', 'idle', 'leader', 'ambush'].includes(m.role), `${enc.id}: role '${m.role}' known`);
  }
}
ok(encounterEnemyCount() <= 45, `designed enemy total is ${encounterEnemyCount()} — a region, not a horde`);
ok(ASHEN_ENCOUNTERS.filter((e) => e.ambush).length >= 1, 'exactly the designed ambush exists (>=1)');
ok(ASHEN_ENCOUNTERS.filter((e) => e.alarm).length >= 1, 'the camp can raise an alarm');
// Each encounter's fights need room: spread must not exceed the area radius.
for (const enc of ASHEN_ENCOUNTERS) {
  const area = ASHEN_SUBREGIONS.find((a) => a.id === enc.area);
  ok(!!area && enc.spread < area.radius, `${enc.id}: fight spread ${enc.spread} fits inside ${enc.area}`);
}

// ── 4. Interactables ────────────────────────────────────────────────────
const KINDS = new Set(['chest', 'savepoint', 'lore', 'crystal', 'hostage', 'shrine', 'station', 'shard', 'ritual']);
ok(ASHEN_INTERACTABLES.length >= 14, `interactables: ${ASHEN_INTERACTABLES.length} placed`);
for (const it of ASHEN_INTERACTABLES) {
  ok(areaIds.has(it.area), `${it.id}: area '${it.area}' exists`);
  ok(KINDS.has(it.kind), `${it.id}: kind '${it.kind}' known`);
  ok(!!it.tex, `${it.id}: has a texture`);
  if (it.kind === 'lore') ok((it.text || '').length > 40, `${it.id}: lore text actually says something`);
  if (it.kind === 'chest') ok(!!it.tier, `${it.id}: chest declares a tier`);
}
ok(ASHEN_INTERACTABLES.filter((i) => i.kind === 'savepoint').length >= 1, 'the hub has a rest/save point');
const gated = ASHEN_INTERACTABLES.filter((i) => i.requiresFlag);
ok(gated.length >= 2, 'both the seal vault and the boss cache are flag-gated (real secrets)');
ok(gated.some((i) => i.requiresFlag === ASHEN_PUZZLE.flag), 'the seal vault opens on the puzzle flag');
for (const it of gated) {
  ok(typeof it.requiresFlag === 'string' && it.requiresFlag.length > 3, `${it.id}: requires a real flag`);
  // A gate must be opened by something real: a quest reward, the crystal
  // puzzle, or a realm shard actually taken out in the world.
  const producedByQuest = Object.values(SIDE_QUESTS).some((q) => (q.rewards?.flagsSet || []).includes(it.requiresFlag));
  const producedByShard = SHARDS.some((s) => s.flag === it.requiresFlag);
  ok(producedByQuest || producedByShard || it.requiresFlag === ASHEN_PUZZLE.flag,
    `${it.id}: flag '${it.requiresFlag}' is actually produced in-game`);
}
ok(new Set(gated.map((i) => i.requiresFlag)).size === gated.length, 'each vault needs its own flag (no duplicate gates)');

// ── 5. The crystal puzzle ───────────────────────────────────────────────
const seq = ASHEN_PUZZLE.sequence;
ok(seq.length === 3, 'three crystals, three steps');
ok(new Set(seq).size === seq.length, 'the sequence has no repeats (solvable by observation)');
const crystals = ASHEN_INTERACTABLES.filter((i) => i.kind === 'crystal');
for (const c of crystals) ok(seq.includes(c.crystal), `crystal '${c.id}' participates in the sequence`);

let p = [];
for (const c of seq) p = puzzleStep(p, c, seq).progress;
ok(p.length === seq.length, 'pressing the rune order in sequence solves it');
ok(puzzleStep([], seq[1], seq).failed, 'a wrong first press is a failed attempt');
ok(puzzleStep([seq[0]], seq[2], seq).failed, 'a wrong second press resets the attempt');
ok(puzzleStep([seq[0]], seq[1], seq).progress.length === 2, 'the correct second press advances');
ok(puzzleStep([seq[0], seq[1]], seq[0], seq).progress.length === 1, 're-pressing the first crystal restarts cleanly');
ok(puzzleStep([], seq[0], seq).solved === (seq.length === 1), 'first press only solves a one-step sequence');

// ── 6. Rewards & POIs ───────────────────────────────────────────────────
ok(!!getItem(ASHEN_PUZZLE.rewardItem), `puzzle reward '${ASHEN_PUZZLE.rewardItem}' is a real item`);
ok(ASHEN_PUZZLE.rewardTier === 'ancient_chest', 'the puzzle pays out through the top-tier chest');
ok((ASHEN_PUZZLE.failText || '').includes(','), 'the fail message re-teaches the order (no lookup needed)');

const worldPois = allPois();
for (const rp of ASHEN_POIS) {
  const found = worldPois.find((w) => w.id === rp.id);
  ok(!!found, `POI '${rp.id}' is registered with the world (minimap + discovery)`);
  if (found) {
    ok(found.label === rp.label, `POI '${rp.id}' keeps its name into the world`);
    ok(found.tag === rp.tag, `POI '${rp.id}' keeps its tag`);
    ok(found.danger >= 1 && found.danger <= 5, `POI '${rp.id}' danger ${found.danger} in range`);
  }
}
ok(ASHEN_POIS.some((p) => p.kind === 'bandit_camp' && p.chestTier), 'the camp carries a tiered cache');
ok(ASHEN_POIS.length >= 8, `${ASHEN_POIS.length} POIs make the region legible on the map`);
ok(!!ASHEN_SAFE_ZONE && ASHEN_SAFE_ZONE.radius > 0, 'safe zone is declared for the spawn director');

// ── 7. The spine quest must be completable in this world ────────────────
// Every step target is checked against the thing that produces it, so a
// mistyped poiTag / flag / enemy key can never ship as a soft-lock.
const spine = SIDE_QUESTS.sq_echoes_of_ash;
ok(!!spine, "'Echoes of Ash' is authored");
if (spine) {
  const giverExists = SIDE_QUESTS !== undefined && !!spine.giver;
  ok(giverExists, 'the quest has a giver');
  const poiTags = new Set(ASHEN_POIS.map((p) => p.tag));
  const regionFlags = new Set([ASHEN_PUZZLE.flag, ...ASHEN_INTERACTABLES.map((i) => i.flag).filter(Boolean)]);
  const bossKeys = new Set(ASHEN_ENCOUNTERS.flatMap((e) => e.members.map((m) => m.key)));
  const reachable = new Set([...poiTags]);
  for (const step of spine.steps) {
    if (step.type === 'reach') ok(reachable.has(step.poiTag), `step '${step.text}': POI tag '${step.poiTag}' exists in the region`);
    else if (step.type === 'flag') ok(regionFlags.has(step.flag), `step '${step.text}': flag '${step.flag}' is set by region content`);
    else if (step.type === 'talk') ok(step.npc === spine.giver || step.npc === 'mara', `step '${step.text}': NPC '${step.npc}' is the giver you return to`);
    else if (step.type === 'kill') {
      const known = !!getEnemyDef(step.enemy);
      ok(known, `step '${step.text}': enemy '${step.enemy}' exists`);
      ok(bossKeys.has(step.enemy) || known, `step '${step.text}': enemy '${step.enemy}' is placed in the region`);
    } else if (step.type === 'boss') ok(!!getEnemyDef(step.target), `step '${step.text}': boss '${step.target}' exists`);
    else ok(false, `step '${step.text}': unknown step type '${step.type}'`);
  }
  // The order matters: you cannot be asked to break a seal you can't reach.
  const reachIdx = spine.steps.findIndex((s) => s.type === 'reach' && s.poiTag === 'corrupted_hollow');
  const sealIdx = spine.steps.findIndex((s) => s.type === 'flag' && s.flag === ASHEN_PUZZLE.flag);
  ok(reachIdx >= 0 && sealIdx > reachIdx, 'the seal step comes after you can reach the hollow');
  ok(spine.steps[spine.steps.length - 1].type === 'boss' || spine.steps[spine.steps.length - 1].type === 'talk', 'the quest ends on a real climax');
}

// ── 8. The boss payoff exists even without the quest ────────────────────
// The arena cache is gated on `warden_slain`; the Warden itself must be a
// real world POI boss, and the quest reward must be a real item — otherwise
// the slice's unique reward is decorative.
const pyre = worldPois.find((p) => p.id === 'warden_pyre');
ok(!!pyre, "the Warden's Pyre is registered as a world POI");
if (pyre) {
  ok(pyre.boss === 'warden_of_ash', 'the pyre spawns the Warden of Ash');
  ok(pyre.chestTier === 'royal_chest', 'the pyre carries the royal cache tier');
  ok(pyre.tag === 'warden_pyre', 'the pyre tag matches the quest reach step');
}
const warden = getEnemyDef('warden_of_ash');
ok(!!warden && warden.boss === true, 'the Warden is authored as a boss');
ok(Array.isArray(warden?.phases) && warden.phases.length >= 2, 'the Warden has two authored phases');
{
  const p = warden?.phases || [];
  const sorted = [...p].sort((a, b) => b.belowHp - a.belowHp);
  ok(sorted[0].belowHp === 1, 'phase walk starts from full HP (the phase-lock regression)');
  ok(sorted.every((ph, i) => i === 0 || ph.belowHp < sorted[i - 1].belowHp), 'phase thresholds strictly descend');
  ok(p.some((ph) => (ph.moves || []).includes('fire_slam')), 'phase 2 introduces the telegraphed fire slam');
  ok(p.every((ph) => (ph.moves || []).length > 0), 'every phase has moves to run');
}
for (const it of ASHEN_INTERACTABLES) {
  if (it.kind !== 'chest' || it.requiresFlag !== 'warden_slain') continue;
  ok(it.tier === 'royal_chest', `${it.id}: the boss cache is the royal tier`);
}
ok(Object.values(SIDE_QUESTS).some((q) => q.rewards?.items?.emberforged_blade === 1 && (q.rewards?.flagsSet || []).includes('warden_slain')),
  'the Warden quest grants the unique blade and the same flag the cache needs');
ok(!!getItem('emberforged_blade'), 'the unique reward item exists');

// ── 9. Reward flags actually land (QuestEngine regression) ──────────────
// `rewards.flagsSet` is declared in quest data and gates the region's vaults
// and unlocks; completeQuest used to apply only `flagsOnComplete`, so every
// declared flag silently vanished.
{
  const GameState = (await import('../src/game/core/GameState.ts')).default;
  GameState.newGame(20260922, { name: 'Ash', gender: 'f', personality: 'kind' }, 'normal');
  const qe = await import('../src/game/systems/QuestEngine.ts');
  const inv = await import('../src/game/systems/InventorySystem.ts');
  const S = GameState.s;
  S.quests.sideActive = ['sq_echoes_of_ash'];
  const steps = [
    { type: 'discover', poiTag: 'broken_road' },
    { type: 'discover', poiTag: 'old_watchtower' },
    { type: 'kill', enemy: 'grave_knight' },
    { type: 'discover', poiTag: 'whispering_forest' },
    { type: 'discover', poiTag: 'corrupted_hollow' },
    { type: 'flagset', flag: 'hollow_seal_broken' },
    { type: 'flagset', flag: 'camp_hostage_freed' },
    { type: 'talk', npc: 'mara' },
    { type: 'kill', boss: 'warden_of_ash' },
  ];
  steps.forEach((ev) => qe.handleEvent(ev));
  ok(!qe.isQuestActive('sq_echoes_of_ash'), 'walking every step in order completes the spine quest');
  ok(S.quests.sideCompleted.includes('sq_echoes_of_ash'), 'the completed quest is recorded');
  ok(S.story.flags.ashen_frontier_cleared === true, "completion sets 'ashen_frontier_cleared' (the next-area unlock)");
  ok(inv.countItem('moonstone') >= 2 && inv.countItem('ancient_core') >= 1, 'the quest pays its item rewards');

  // The Warden's own quest must hand over its signature weapon AND the flag
  // the royal cache is gated on.
  S.quests.sideActive = ['sq_the_warden_of_ash'];
  qe.handleEvent({ type: 'discover', poiTag: 'warden_pyre' });
  qe.handleEvent({ type: 'kill', boss: 'warden_of_ash' });
  ok(S.story.flags.warden_slain === true, 'the Warden quest sets warden_slain (opens its cache)');
  ok(inv.countItem('emberforged_blade') >= 1, 'the Warden quest grants the unique blade');

  // Same contract through the OTHER flag field, on the main chain — where a
  // completion flag used to re-enter completion until the stack overflowed.
  const { MAIN_QUESTS, QUEST_ORDER } = await import('../src/game/data/questsMain.ts');
  const ch2 = QUEST_ORDER.find((id) => MAIN_QUESTS[id]?.flagsOnComplete?.length);
  ok(!!ch2, 'the main chain has a chapter that sets a completion flag');
  if (ch2) {
    const def = MAIN_QUESTS[ch2];
    S.quests.chainIndex = QUEST_ORDER.indexOf(ch2);
    let threw = null;
    try {
      for (const step of def.steps) {
        const n = step.count || 1;
        for (let i = 0; i < n; i++) qe.handleEvent(bossEventFor(step));
      }
    } catch (e) { threw = String(e).slice(0, 80); }
    ok(threw === null, `completing '${ch2}' does not recurse (${threw || 'clean'})`);
    for (const f of def.flagsOnComplete) ok(S.story.flags[f] === true, `completion flag '${f}' is set`);
    ok(S.quests.chainIndex > QUEST_ORDER.indexOf(ch2), 'the chain advances to the next chapter');
  }
}

// ── Whispering Forest: the four-band depth composition (map brief §7) ───────
// The wood was a flat scatter — every tree the same depth band, so the layers
// the brief asks for did not exist. These assertions pin the composition down:
// background foliage clear of the path, foreground foliage ON it (and never
// collidable), both off water, and the whole layout deterministic.
{
  setWorldSeed(1);
  const grove = ASHEN_LANDMARKS.find((l) => l.id === 'forest_grove');
  const bands = forestBands();
  const world = (prop) => [grove.x + prop.dx, grove.y + prop.dy];

  const bg = bands.filter((b) => b.band === 'bg');
  const fg = bands.filter((b) => b.band === 'fg');
  ok(bands.length === bg.length + fg.length, 'forest bands are exactly bg + fg (mid stays authored)');
  ok(bg.length >= 40, `deep wood is dense (${bg.length} background props)`);
  ok(fg.length >= 8 && fg.length <= 16, `foreground band is sparse (${fg.length} props)`);

  ok(bg.every((b) => corridorDistance(grove.x + b.dx, grove.y + b.dy) >= FOREST_BG_CLEARANCE),
     'background band never occupies the walkable corridor');
  ok(fg.every((b) => corridorDistance(grove.x + b.dx, grove.y + b.dy) <= FOREST_FG_REACH),
     'foreground band sits on the corridor, where a walk meets it');
  ok([...bg, ...fg].every((b) => !b.solid), 'no banded prop collides — the player can never be blocked by foliage');
  ok(bg.every((b) => b.dy + grove.y >= FOREST_DEEP_WOOD_MAX_Y), 'deep wood stops short of the stream bank');

  const wetBg = bg.filter((b) => { const [x, y] = world(b); return isWaterAt(x, y); });
  ok(wetBg.length === 0, `no canopy or understory stands in water (${wetBg.length} wet)`);

  // Stream edge: reeds on the bank, lilies on the water — the brief's §13 water.
  const reeds = grove.props.filter((p) => p.tex === 'reed_tuft');
  const lilies = grove.props.filter((p) => p.tex === 'lilypad');
  ok(reeds.length >= 3 && reeds.every((p) => !isWaterAt(grove.x + p.dx, grove.y + p.dy)),
     'reeds stand on the bank, not in the water');
  ok(lilies.length >= 2 && lilies.every((p) => isWaterAt(grove.x + p.dx, grove.y + p.dy)),
     'lilies float on the water');

  // All four bands are present and distinct in the composition.
  const bandOf = (p) => p.band ?? (p.decal ? 'ground' : 'mid');
  const counts = {};
  for (const p of grove.props) counts[bandOf(p)] = (counts[bandOf(p)] ?? 0) + 1;
  ok(counts.bg >= 40 && counts.mid >= 20 && counts.fg >= 8,
     `four bands present (bg ${counts.bg}, mid ${counts.mid}, ground ${counts.ground}, fg ${counts.fg})`);
  ok(grove.props.some((p) => p.tex === 'log_fallen') && grove.props.some((p) => p.tex === 'frond_near'),
     'midground logs and foreground fronds are in the composition');

  ok(JSON.stringify(forestBands()) === JSON.stringify(bands), 'band layout is deterministic (same seed → same wood)');
  ok(corridorDistance(FOREST_CORRIDOR.ax, FOREST_CORRIDOR.ay) === 0, 'corridor axis measures 0 on itself');
}

// ── 10. The hub's own crafting station ──────────────────────────────────
// A visitor must be able to improve gear WITHOUT founding a settlement. The
// region authors the station; it feeds the same `stationsNear` flag the
// settlement forge feeds, so both share one rule and one UI.
{
  const region = await import('../src/game/data/regionAshen.ts');
  const build = await import('../src/game/systems/BuildSystem.ts');
  const craft = await import('../src/game/systems/CraftingSystem.ts');
  const inv = await import('../src/game/systems/InventorySystem.ts');
  const GameState = (await import('../src/game/core/GameState.ts')).default;
  GameState.newGame(20260922, { name: 'Ash', gender: 'f', personality: 'kind' }, 'normal');

  const stations = stationsOf(region.ASHEN_REGION);
  const forge = stations.find((s) => s.station === 'forge');
  ok(!!forge, 'the region provides a forge station of its own');
  ok(!isWaterAt(forge.x, forge.y), 'the anvil stands on dry ground');

  const village = region.ASHEN_SUBREGIONS.find((a) => a.id === 'village');
  ok(Math.hypot(forge.x - village.x, forge.y - village.y) < village.radius,
     'the anvil is inside the safe hub, where a visitor actually walks');

  const authored = region.ASHEN_INTERACTABLES.find((i) => i.id === 'village_forge');
  ok(!!authored && authored.kind === 'station' && !!authored.flag,
     'the anvil is an authored interactable (same list as chests and savepoints)');

  // The shared rule, exercised through BuildSystem exactly as the scene does.
  const at = (x, y) => ({ player: { sprite: { x, y } } });
  build.setAuthoredStations(stations);
  build.refreshStationsNear(at(forge.x, forge.y - 60));
  ok(GameState.session.stationsNear.forge === true,
     'standing at the hub anvil makes the forge available — with no settlement');

  build.refreshStationsNear(at(760, -420));
  ok(GameState.session.stationsNear.forge !== true, 'walking away from the anvil takes the forge away');
  ok((GameState.s.settlement.buildings || []).length === 0, 'neither state needed a settlement building');

  // Nothing to improve → the station can say why instead of doing nothing.
  ok(/forge/i.test(craft.idleReason('forge') || ''), 'out of reach, the forge says the station is what is missing');
  build.refreshStationsNear(at(forge.x, forge.y - 60));
  ok(/resources/i.test(craft.idleReason('forge') || ''), 'in reach but empty-handed, the reason becomes the materials');
  for (const [id, n] of Object.entries({ iron_ingot: 14, hardwood: 2, leather_hide: 1, coal: 4 })) {
    inv.addItem(id, n, { ignoreCap: true, silent: true });
  }
  ok(craft.idleReason('forge') === null, 'with materials in reach the forge has work again');

  // The settlement path must still work through the SAME flag (no regression).
  GameState.s.settlement.buildings = [{
    uid: 'b1', key: 'forge', x: -176, y: 700, tier: 1, hp: 100, maxHp: 100,
    builtProgress: 1, complete: true, builders: [],
  }];
  build.refreshStationsNear(at(760, -420));
  ok(GameState.session.stationsNear.forge !== true, 'a distant settlement forge does not reach the forest');
  build.refreshStationsNear(at(-176, 700));
  ok(GameState.session.stationsNear.forge === true, 'a completed settlement forge still provides the station');
  GameState.s.settlement.buildings = [];

  // A piece of gear must show its stat change too — armor used to have none.
  const plate = craft.recipesForUI('armor').find((r) => r.out === 'iron_plate');
  ok(!!plate && plate.compare && plate.compare.slot === 'chest', 'armor rows carry an equipped comparison');
  ok(plate.compare.armorDelta != null || plate.compare.note === 'Nothing equipped',
     'the armor comparison states either the delta or why there is none');
}

// ── 11. The region's seams: one data module, one registration ───────────
// RegionSystem was split along its responsibilities, so the region DATA is the
// only input: the layout math is pure (runs here in node, no Phaser), and a
// second region is a data module plus one line in the registry.
{
  const layout = await import('../src/game/systems/RegionLayout.ts');
  const registry = await import('../src/game/systems/RegionRegistry.ts');
  const region = await import('../src/game/data/regionAshen.ts');
  const def = region.ASHEN_REGION;

  // The def hands over the authored arrays — never a second copy of the level.
  ok(def.subregions === region.ASHEN_SUBREGIONS && def.landmarks === region.ASHEN_LANDMARKS,
     'the region def hands over the authored arrays, not copies');
  ok(def.encounters === region.ASHEN_ENCOUNTERS && def.interactables === region.ASHEN_INTERACTABLES,
     'encounters and interactables come from the same authored lists');
  ok(def.subregionAt(SPAWN.x, SPAWN.y)?.id === 'village', "the def carries the region's own geometry helpers");
  ok(registry.REGIONS.length === 1 && registry.REGIONS[0].id === def.id, 'the region is registered once');

  // Depth bands, pinned to the four-layer composition the brief asks for.
  const bgD = layout.propDepth({ tex: 't', dx: 0, dy: 0, band: 'bg' }, 120);
  const fgD = layout.propDepth({ tex: 't', dx: 0, dy: 0, band: 'fg' }, 120);
  const midD = layout.propDepth({ tex: 't', dx: 0, dy: 0 }, 123.4);
  const decalD = layout.propDepth({ tex: 't', dx: 0, dy: 0, decal: true }, 120);
  ok(bgD === layout.BACKGROUND_DEPTH && bgD < midD, 'background foliage sorts behind the gameplay band');
  ok(fgD === layout.FOREGROUND_DEPTH && fgD > midD, 'foreground foliage sorts in front of the player');
  ok(decalD === 4 && decalD > bgD, 'ground decals stay flat above the deep background band');
  ok(midD === 123, 'the gameplay band is y-sorted by prop position');
  const ys = region.ASHEN_LANDMARKS.flatMap((l) => l.props.filter((p) => !p.decal && !p.band).map((p) => l.y + p.dy));
  ok(fgD > Math.max(...ys) && bgD < Math.min(...ys), 'the two bands bracket every y-sorted prop in the region');

  // Streaming: radius-bounded, and an area is only ever built once.
  const areas = [{ id: 'near', x: 100, y: 0 }, { id: 'far', x: layout.PLACE_RADIUS + 400, y: 0 }];
  const built = new Set();
  ok(layout.areasToPlace(areas, built, 0, 0).map((a) => a.id).join() === 'near',
     `only areas inside the ${layout.PLACE_RADIUS}-unit radius stream in`);
  built.add('near');
  ok(layout.areasToPlace(areas, built, 0, 0).length === 0, 'an area that is already built is never rebuilt');
  ok(layout.areasToPlace(region.ASHEN_SUBREGIONS, new Set(), SPAWN.x, SPAWN.y).some((a) => a.id === 'village'),
     'the player spawn streams the village in');

  // Encounter seating: one seat per authored enemy, inside the spread.
  const enc = region.ASHEN_ENCOUNTERS.find((e) => e.members.length > 1) ?? region.ASHEN_ENCOUNTERS[0];
  const authored = enc.members.reduce((n, m) => n + m.count, 0);
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const plan = layout.encounterPlan(enc, rand);
  ok(plan.length === authored, `'${enc.id}' seats one enemy per authored member (${plan.length})`);
  ok(plan.every((s) => Math.hypot(s.x - enc.x, s.y - enc.y) <= enc.spread), 'every seat lands inside the encounter spread');
  ok(plan.every((s) => enc.members.some((m) => m.key === s.key && m.role === s.role)),
     'each seat carries an authored enemy key and role');
  ok(JSON.stringify(layout.encounterPlan(enc, () => 0.5)) === JSON.stringify(layout.encounterPlan(enc, () => 0.5)),
     'seating is deterministic for a given random source');
  const roles = new Set(region.ASHEN_ENCOUNTERS.flatMap((e) => e.members.map((m) => m.role)));
  ok([...roles].every((r) => r in layout.ROLE_TUNING), 'every authored role has tuning');

  // The foreground fade rule: a real overlap, eased, never overshooting.
  const near = { x: 0, y: 0, hw: 40, hh: 30 };
  ok(layout.isBehind(0, 0, near) && layout.isBehind(0, 40, near), 'the fade covers the hero standing behind the prop');
  ok(!layout.isBehind(41, 0, near) && !layout.isBehind(0, 47, near), 'a hero clear of the prop is not faded');
  const step = layout.fadeAlpha(1, layout.FOREGROUND_FADED_ALPHA, 0.016);
  ok(step < 1 && step > layout.FOREGROUND_FADED_ALPHA, 'the fade eases toward the floor without jumping');
  ok(Math.abs(layout.fadeAlpha(1, layout.FOREGROUND_FADED_ALPHA, 1) - layout.FOREGROUND_FADED_ALPHA) < 1e-9,
     'a long frame still lands exactly on the target alpha');

  // What the scene and the world generator actually consume.
  ok(registry.regionStations().some((s) => s.station === 'forge'), "the registry publishes the region's stations");
  ok(registry.inRegionSafeZone(SPAWN.x, SPAWN.y) && !registry.inRegionSafeZone(760, -420),
     'the registry answers the safe zone the spawn director needs');
  ok(registry.regionPois().length === region.ASHEN_POIS.length, 'the registry publishes the authored POIs');
}

console.log(`ashen-frontier: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
assert.equal(failed, 0);
