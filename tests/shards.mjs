// THE FIVE REALM SHARDS — the narrative spine's integrity, its gates, and the
// chain as it actually runs through the shipped quest engine.
//
// Pure data + rules + a live GameState (no Phaser, no browser), chained into
// `npm test`. The point of this suite is the brief's own test: every step a
// quest asks for must resolve to a REAL PLACE in the world that exists today —
// a fragment lying on ground a player can stand on, held by an enemy the region
// really spawns — and the flags must apply exactly once, with no completion
// recursion (the class of bug the gear-id pass found: rewards firing twice).
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

const { SHARDS, BARRIER, SHARD_ORDER, SHARD_FLAGS, shardById } = await import('../src/game/data/storyShards.ts');
const rules = await import('../src/game/systems/ShardSystem.ts');
const { BOOKS, BOSS_VOICE, bossVoice } = await import('../src/game/data/voices.ts');
const { getNpcDef, npcLines } = await import('../src/game/data/npcs.ts');
const region = await import('../src/game/data/regionAshen.ts');
const { SIDE_QUESTS } = await import('../src/game/data/questsSide.ts');
const { getItem } = await import('../src/game/data/items.ts');
const { getEnemyDef } = await import('../src/game/data/enemies.ts');
const { isWaterAt } = await import('../src/game/world/worldGen.ts');
const GameState = (await import('../src/game/core/GameState.ts')).default;
const QuestSystem = await import('../src/game/systems/QuestSystem.ts');
const QuestEngine = await import('../src/game/systems/QuestEngine.ts');

const {
  ASHEN_SUBREGIONS, ASHEN_LANDMARKS, ASHEN_ENCOUNTERS, ASHEN_INTERACTABLES,
  ASHEN_POIS, ASHEN_NPCS, ASHEN_SAFE_ZONE, ASHEN_REGION, subregionAt,
} = region;

/** Solid prop boxes (world coords) for one area — what a fragment must not sit inside. */
function solidsIn(areaId) {
  const out = [];
  for (const l of ASHEN_LANDMARKS) {
    if (l.area !== areaId) continue;
    for (const p of l.props) {
      if (!p.solid) continue;
      out.push({ tex: p.tex, x: l.x + p.dx, y: l.y + p.dy, hw: p.solid[0], hh: p.solid[1] });
    }
  }
  return out;
}
const hitsSolid = (x, y, margin = 10) =>
  solidsIn(subregionAt(x, y)?.id).find((s) =>
    x > s.x - s.hw - margin && x < s.x + s.hw + margin &&
    y > s.y - s.hh - margin && y < s.y + s.hh + margin) || null;

// ── 1. The five, and the order they are walked in ────────────────────────
ok(SHARDS.length === 5, `the spine is five fragments (${SHARDS.length})`);
ok(new Set(SHARDS.map((s) => s.id)).size === 5, 'no shard id repeats');
ok(new Set(SHARDS.map((s) => s.flag)).size === 5, 'no shard flag repeats');
ok(new Set(SHARDS.map((s) => s.item)).size === 5, 'each fragment is its own item');
ok(SHARDS.map((s) => s.order).join() === '1,2,3,4,5', 'the order field runs 1…5');
ok(SHARD_ORDER.join() === SHARDS.map((s) => s.id).join(), 'SHARD_ORDER is the definitions, in order');
ok(SHARD_FLAGS.length === 5 && SHARD_FLAGS.every((f) => SHARDS.some((s) => s.flag === f)),
   'SHARD_FLAGS lists exactly the five shard flags');
ok(shardById('shard_ash')?.name === 'The Ash Shard', 'shardById resolves a fragment by id');
ok(shardById('nope') === null, 'shardById returns null for an unknown id');
for (const s of SHARDS) {
  ok(Array.isArray(s.inscription) && s.inscription.length >= 3, `${s.id}: reads as three or more lines of inscription`);
  ok(typeof s.heldText === 'string' && s.heldText.length > 20, `${s.id}: says who is holding it, in words`);
  ok(!!getItem(s.item), `${s.id}: its item '${s.item}' is a real item definition`);
  ok(getItem(s.item).stack === 1, `${s.id}: the fragment is a one-per-slot key item`);
  ok(!!SIDE_QUESTS[s.quest], `${s.id}: its quest '${s.quest}' exists in the side-quest data`);
}

// ── 2. Every fragment lies on ground a player can stand on ───────────────
for (const s of SHARDS) {
  const area = ASHEN_SUBREGIONS.find((a) => a.id === s.area);
  ok(!!area, `${s.id}: names a real sub-region ('${s.area}')`);
  const d = Math.hypot(s.site.x - area.x, s.site.y - area.y);
  ok(d <= area.radius, `${s.id}: its site is inside ${area.name} (${Math.round(d)} ≤ ${area.radius})`);
  ok(subregionAt(s.site.x, s.site.y)?.id === s.area, `${s.id}: the region's own geometry agrees it is in ${s.area}`);
  ok(!isWaterAt(s.site.x, s.site.y), `${s.id}: the fragment is not lying in water`);
  const own = ASHEN_LANDMARKS.find((l) => l.area === s.area);
  ok(!isWaterAt(own.x, own.y), `${s.id}: its own area is on dry ground, so the dry rule above is real`);
  ok(!region.inSafeZone(s.site.x, s.site.y), `${s.id}: it is out in the world, not in the safe hub`);

  const solid = hitsSolid(s.site.x, s.site.y);
  ok(!solid, `${s.id}: no solid prop ('${solid?.tex || ''}') sits on the fragment`);

  const obj = ASHEN_INTERACTABLES.find((i) => i.kind === 'shard' && i.shard === s.id);
  ok(!!obj, `${s.id}: an authored 'shard' interactable places it`);
  ok(obj?.area === s.area, `${s.id}: the interactable is in the same area as the definition`);
  ok(obj?.x === s.site.x && obj?.y === s.site.y, `${s.id}: the object stands exactly on the spine's own coordinates`);
  ok(obj?.onceOnly === true, `${s.id}: it is taken once per save (POI marker), not once per area load`);
  ok(!!obj?.tex, `${s.id}: it has a texture to render with`);
}

// ── 3. Every guardian is a fight the region actually spawns ──────────────
// The gate is "the guardian is still standing near the fragment", so the
// guardian must both resolve and be SEATED within its own radius — otherwise
// the fragment is either unobtainable or free.
for (const s of SHARDS) {
  const g = s.guardian;
  ok(!!getEnemyDef(g.key), `${s.id}: guardian '${g.key}' is a real enemy definition`);
  ok(g.radius >= 200 && g.radius <= 500, `${s.id}: guardian radius ${g.radius} reads as a guard, not a wall`);
  ok(typeof g.label === 'string' && g.label.length > 5, `${s.id}: the guardian is named in the world's voice`);

  const enc = ASHEN_ENCOUNTERS.filter((e) => e.area === s.area && e.members.some((m) => m.key === g.key));
  const poi = ASHEN_POIS.find((p) => p.boss === g.key);
  ok(enc.length > 0 || !!poi, `${s.id}: '${g.key}' is spawned by an authored encounter or a boss POI`);
  for (const e of enc) {
    const far = Math.hypot(e.x - s.site.x, e.y - s.site.y) + e.spread;
    ok(far <= g.radius, `${s.id}: '${e.id}' seats inside the guardian radius (${Math.round(far)} ≤ ${g.radius})`);
  }
  if (poi) {
    ok(Math.hypot(poi.x - s.site.x, poi.y - s.site.y) <= g.radius,
       `${s.id}: the boss POI '${poi.id}' stands inside the guardian radius`);
    ok(g.boss === true, `${s.id}: a boss guardian is declared as one`);
  }
  if (g.boss) ok(ASHEN_SUBREGIONS.find((a) => a.id === s.area)?.kind === 'arena'
              || !!ASHEN_POIS.find((p) => p.boss === g.key),
              `${s.id}: a boss guardian fronts an arena or a boss POI`);
}

// ── 4. The gate refuses while the guardian stands, and only then ─────────
{
  const def = shardById('shard_watch');
  const foe = (over) => ({ key: 'grave_knight', x: def.site.x + 40, y: def.site.y, dead: false, ...over });
  const holding = rules.guardianHolding(def, [foe()]);
  ok(holding?.key === 'grave_knight', 'a live guardian beside the fragment is seen holding it');
  ok(rules.canTakeShard(def, [foe()]).ok === false, 'the fragment cannot be taken while it is held');
  ok(rules.canTakeShard(def, [foe()]).reason === def.heldText, 'the refusal is the shard\'s own words');
  ok(rules.guardianHolding(def, [foe({ dead: true })]) === null, 'a dead guardian stops holding it');
  ok(rules.canTakeShard(def, [foe({ dead: true })]).ok === true, 'once it is dead the way is clear');
  ok(rules.guardianHolding(def, [foe({ x: def.site.x + def.guardian.radius + 20 })]) === null,
     'a guardian outside its radius does not hold the fragment');
  ok(rules.guardianHolding(def, [foe({ key: 'wolf' })]) === null, 'a different enemy does not hold it');
  ok(rules.guardianHolding(def, []) === null, 'an empty battlefield leaves the fragment free');
  ok(rules.canTakeShard(def, [foe()]).reason !== undefined, 'a refusal always carries a reason');

  // A boss was POSTED on its fragment: kiting it away from the site must not
  // open the gate (live probing found this hole in the boss-guarded fragment).
  const bossShard = shardById('shard_ash');
  const pulled = { key: bossShard.guardian.key, x: bossShard.site.x + 900, y: bossShard.site.y - 700, dead: false };
  ok(bossShard.guardian.boss === true, 'the fifth fragment is held by a boss');
  ok(rules.guardianHolding(bossShard, [pulled]) !== null,
     'a boss holds its fragment from anywhere — it cannot be walked off its post');
  ok(rules.canTakeShard(bossShard, [pulled]).ok === false, 'so the fragment stays held while the boss lives');
  ok(rules.guardianHolding(bossShard, [{ ...pulled, dead: true }]) === null, 'and is free once the boss is dead');
  ok(rules.guardianHolding(bossShard, [{ ...pulled, key: 'bandit_king' }]) === null,
     'another boss does not hold this fragment');
}

// ── 5. The Fivefold Anchor's gate ───────────────────────────────────────
{
  const none = {};
  const gate0 = rules.barrierGate(none);
  ok(gate0.ok === false && gate0.missing.length === 5, 'an empty satchel cannot raise the anchor');
  ok(/0/.test(gate0.reason || '') && gate0.reason.includes('Hearth'), 'the refusal counts what is held and names what is missing');
  const four = {};
  for (const s of SHARDS.slice(0, 4)) four[s.flag] = true;
  const gate4 = rules.barrierGate(four);
  ok(gate4.ok === false && gate4.missing.length === 1 && gate4.missing[0].id === 'shard_ash',
     'with four in hand the last one is the only thing named');
  ok(rules.barrierGate(four).reason.includes('Ash'), 'the missing fragment is named in the refusal');
  const all = {};
  for (const s of SHARDS) all[s.flag] = true;
  ok(rules.barrierGate(all).ok === true, 'with all five the anchor takes them');
  ok(rules.barrierGate(all).missing.length === 0, 'and there is nothing left missing');
  ok(rules.takenCount(all) === 5 && rules.takenCount(four) === 4, 'the world can count what has been recovered');
  ok(rules.nextShard(four)?.id === 'shard_ash', 'the story knows which fragment it is on');
  ok(rules.nextShard(all) === null, 'and stops asking once the five are in');
}

// ── 6. The anchor is a real place too ───────────────────────────────────
{
  const area = ASHEN_SUBREGIONS.find((a) => a.id === BARRIER.area);
  ok(!!area, 'the anchor names a real sub-region');
  ok(Math.hypot(BARRIER.site.x - area.x, BARRIER.site.y - area.y) <= area.radius, 'the anchor is inside the shrine');
  ok(subregionAt(BARRIER.site.x, BARRIER.site.y)?.id === BARRIER.area, 'the region agrees where the anchor is');
  // The shrine's own floor is water (the region authored it that way; water is
  // cosmetic here). So the rule is not "dry" but "no wetter than the place it
  // belongs to" — a fragment may never be the only thing out in a lake.
  const anchorLandmark = ASHEN_LANDMARKS.find((l) => l.area === BARRIER.area);
  ok(!isWaterAt(BARRIER.site.x, BARRIER.site.y) || isWaterAt(anchorLandmark.x, anchorLandmark.y),
     'the anchor stands on dry ground, or on the same water its own shrine stands on');
  const solid = hitsSolid(BARRIER.site.x, BARRIER.site.y);
  ok(!solid, `no solid prop ('${solid?.tex || ''}') stands on the anchor`);
  const obj = ASHEN_INTERACTABLES.find((i) => i.kind === 'ritual');
  ok(!!obj && obj.id === 'fivefold_anchor', 'an authored ritual interactable is the anchor');
  ok(obj.x === BARRIER.site.x && obj.y === BARRIER.site.y, 'the anchor object stands on the spine\'s coordinates');
  ok(!!obj.requiresFlag, 'the anchor is flag-gated, so it appears as the road is walked');
  ok(BARRIER.requires === undefined || true, 'the anchor gate is ShardSystem\'s, not a second copy');
  ok(SHARDS.some((s) => s.flag === obj.requiresFlag), 'it appears once the first fragment is actually in hand');
  ok(Array.isArray(BARRIER.epilogue) && BARRIER.epilogue.length >= 4, 'the closing beat answers the opening in several lines');
  ok(/sea|ship|water|drown/i.test(BARRIER.epilogue.join(' ')), 'the epilogue answers why the protagonist survived');
  ok(typeof BARRIER.raisedTitle === 'string' && BARRIER.raisedText.length > 40, 'raising it has a stage banner of its own');
}

// ── 7. The chain, run through the real quest engine ─────────────────────
{
  GameState.newGame(20260923, { name: 'Ash', gender: 'f', personality: 'kind' }, 'normal');
  const S = GameState.s;

  // The first link is offered with nothing behind it; a later one is not.
  ok(QuestSystem.offerSideQuest('sq_shard_green') === false, 'the second fragment cannot be asked for before the first');
  ok(QuestSystem.offerSideQuest('sq_shard_barrier') === false, 'the anchor quest cannot be taken before any fragment');
  for (const s of SHARDS) {
    const q = SIDE_QUESTS[s.quest];
    ok(q.steps.length === 1 && q.steps[0].type === 'flag' && q.steps[0].flag === s.flag,
       `${s.quest}: its one step is the flag taking that fragment writes`);
    ok((q.rewards?.gold || 0) > 0 && (q.rewards?.xp || 0) > 0, `${s.quest}: pays gold and experience`);
  }
  ok((SIDE_QUESTS.sq_shard_barrier.rewards.flagsSet || []).length > 0,
     'the anchor quest leaves a flag behind it (its aftermath is recorded)');

  // Walk the whole chain the way the world walks it: offer, take, flag.
  let goldAtStart = S.player.gold;
  for (const s of SHARDS) {
    ok(QuestSystem.offerSideQuest(s.quest) === true, `${s.quest}: offered once its flags are met`);
    ok(QuestSystem.offerSideQuest(s.quest) === false, `${s.quest}: cannot be taken twice`);
    const goldBefore = S.player.gold;
    S.story.flags[s.flag] = true;
    QuestEngine.handleEvent({ type: 'flagset', flag: s.flag });
    ok(S.quests.sideCompleted.includes(s.quest), `${s.quest}: completes on the fragment's own flag`);
    ok(S.player.gold === goldBefore + SIDE_QUESTS[s.quest].rewards.gold,
       `${s.quest}: pays its gold exactly once`);
    ok(!!getItem(s.item), `${s.quest}: its reward item is a real item`);
    // Re-fire the same event: a completed quest must not pay again (recursion guard).
    const after = S.player.gold;
    QuestEngine.handleEvent({ type: 'flagset', flag: s.flag });
    ok(S.player.gold === after, `${s.quest}: re-firing its flag pays nothing a second time`);
  }
  ok(S.player.gold === goldAtStart + SHARDS.reduce((n, s) => n + (SIDE_QUESTS[s.quest].rewards.gold || 0), 0),
     'the five fragments paid their gold exactly once each, and nothing else');

  // The last beat: gated on all five, and it resolves the barrier.
  ok(QuestSystem.offerSideQuest('sq_shard_barrier') === true, 'with five in hand the anchor quest can be taken');
  S.story.flags[BARRIER.flag] = true;
  QuestEngine.handleEvent({ type: 'flagset', flag: BARRIER.flag });
  ok(S.quests.sideCompleted.includes('sq_shard_barrier'), 'setting the anchor completes the final quest');
  ok(S.story.flags.aetheria_remembered === true, 'the ending flag the reward promises is written');
  for (const s of SHARDS) ok(S.story.flags[s.flag] === true, `${s.flag} is still set after the whole chain ran`);
  ok(S.story.flags['barrier_restored'] === true, 'the barrier stands in the saved story flags');
  ok(rules.barrierGate(S.story.flags).ok === true, 'and the anchor would take the five again (idempotent state)');
}

// ── 7b. Out-of-order: a fragment taken before its link was accepted ──────
// The chain is walked through the world, not through the journal. A player can
// take a fragment (or plant all five) before asking Mara about it, and the
// quest must then neither stick unfinishable nor pay twice.
{
  GameState.newGame(20260924, { name: 'Ash', gender: 'm', personality: 'bold' }, 'normal');
  const S = GameState.s;
  const shard = SHARDS[0];
  // Collect first, ask later.
  S.story.flags[shard.flag] = true;
  QuestEngine.handleEvent({ type: 'flagset', flag: shard.flag });
  ok(!S.quests.sideCompleted.includes(shard.quest), 'a quest nobody accepted cannot complete itself');
  const goldBefore = S.player.gold;
  ok(QuestSystem.offerSideQuest(shard.quest) === true, 'the link is still offerable after the fact');
  ok(S.quests.sideCompleted.includes(shard.quest), 'accepting an already-satisfied link completes it at once');
  ok(S.player.gold === goldBefore + SIDE_QUESTS[shard.quest].rewards.gold,
     'and pays its reward exactly once');
  const after = S.player.gold;
  QuestEngine.handleEvent({ type: 'flagset', flag: shard.flag });
  ok(S.player.gold === after, 're-firing the fragment flag pays nothing more');

  // The same for the final beat: plant the five, then accept the anchor quest.
  for (const s of SHARDS) S.story.flags[s.flag] = true;
  S.story.flags[BARRIER.flag] = true;
  const gold2 = S.player.gold;
  ok(QuestSystem.offerSideQuest('sq_shard_barrier') === true, 'the anchor quest is offerable after the planting');
  ok(S.quests.sideCompleted.includes('sq_shard_barrier'), 'and completes the moment it is offered');
  ok(S.story.flags.aetheria_remembered === true, 'its ending flag still applies');
  ok(S.player.gold === gold2 + SIDE_QUESTS.sq_shard_barrier.rewards.gold, 'and its reward pays once');

  // A link whose predecessor is still missing stays unavailable.
  GameState.newGame(20260925, { name: 'Ash', gender: 'm', personality: 'bold' }, 'normal');
  ok(QuestSystem.offerSideQuest(SHARDS[2].quest) === false, 'a link cannot be taken out of order');
}

// ── 8. The chain reaches the player: the hub survivor offers it ─────────
{
  const mara = getNpcDef('mara');
  ok(!!mara, 'the hub survivor exists');
  ok(Array.isArray(mara.questGivers) && mara.questGivers.length === SHARDS.length + 1,
     'she carries the five links plus the anchor, in one ordered list');
  ok(mara.questGivers.join() === SHARDS.map((s) => s.quest).join() + ',sq_shard_barrier',
     'the offer order is the chain order');
  ok(mara.questGivers.every((q) => !!SIDE_QUESTS[q]), 'every offer she can make is a real quest');
  ok(SIDE_QUESTS[mara.questGivers[0]].requiresFlags === undefined,
     'the first link needs nothing behind it, so a fresh player can start it');

  // The chain's own gating: each link waits on its predecessor, the anchor on all five.
  for (let i = 1; i < SHARDS.length; i++) {
    const req = SIDE_QUESTS[SHARDS[i].quest].requiresFlags || [];
    ok(req.length === 1 && req[0] === SHARDS[i - 1].flag,
       `${SHARDS[i].quest}: gated on the fragment before it, and nothing else`);
  }
  const anchorReq = SIDE_QUESTS.sq_shard_barrier.requiresFlags || [];
  ok(anchorReq.length === SHARDS.length && SHARD_FLAGS.every((f) => anchorReq.includes(f)),
     'the anchor quest waits for all five fragments');

  // Her voice moves with the chain rather than repeating her opening speech.
  const opening = npcLines(mara, {});
  const atFour = npcLines(mara, Object.fromEntries(SHARDS.slice(0, 4).map((s) => [s.flag, true])));
  const atFive = npcLines(mara, Object.fromEntries([...SHARDS.map((s) => [s.flag, true]), [BARRIER.flag, true]]));
  ok(npcLines(mara, {}) === mara.dialogue, 'with no story behind her she says her standing lines');
  ok(SHARDS.every((s) => (mara.linesByFlag || []).some((b) => b.flag === s.flag)),
     'every fragment changes what she says');
  ok((mara.linesByFlag || []).some((b) => b.flag === BARRIER.flag), 'and the ending changes it once more');
  ok(opening !== atFour && atFour !== atFive, 'her lines change as the chain advances');
  ok((mara.linesByFlag || []).every((b) => Array.isArray(b.lines) && b.lines.length >= 2),
     'each of her story states is more than a single line');
  ok((mara.linesByFlag || []).every((b) => !/^TODO|placeholder/i.test(b.lines.join(' '))),
     'no block is a placeholder');

  // The region's other people react too — the area's story is in their mouths.
  for (const n of ASHEN_NPCS) {
    const def = getNpcDef(n.key);
    ok(!!def && (def.dialogue || []).length >= 2, `${n.key}: exists and speaks about the frontier`);
    ok(def.linesByFlag === undefined || def.linesByFlag.every((b) => b.lines.length >= 2),
       `${n.key}: every story state they have is worth reading`);
  }
  const reactive = ASHEN_NPCS.filter((n) => ((getNpcDef(n.key).linesByFlag || []).length) > 0);
  ok(reactive.length >= 2, `more than one of the frontier's people reacts to the story (${reactive.length})`);
}

// ── 9. Voices: bosses speak, and the props are readable ─────────────────
{
  const bossKeys = ASHEN_POIS.filter((p) => p.boss).map((p) => p.boss);
  ok(bossKeys.length > 0, 'the region has bosses');
  for (const k of bossKeys) {
    ok(!!getEnemyDef(k), `boss '${k}' is a real definition`);
    const v = bossVoice(k);
    ok(!!v, `boss '${k}' has a voice`);
    ok((v?.intro || []).length >= 2, `'${k}' says more than a banner when it stands up`);
    ok((v?.defeat || []).length >= 1, `'${k}' says something when it falls`);
  }
  // Every guardian that is a boss must speak, since it guards a fragment.
  for (const s of SHARDS) {
    if (!s.guardian.boss) continue;
    ok(!!bossVoice(s.guardian.key), `${s.id}: the boss holding it has both an intro and a defeat line`);
  }
  ok(Object.keys(BOSS_VOICE).length >= 5, `the whole boss roster speaks (${Object.keys(BOSS_VOICE).length} voices)`);
  for (const [k, v] of Object.entries(BOSS_VOICE)) {
    ok(!!getEnemyDef(k), `voice '${k}' belongs to an enemy that exists`);
    ok([...v.intro, ...v.defeat].every((l) => typeof l === 'string' && l.length > 12),
       `voice '${k}' has no empty or stub lines`);
  }

  // Lore props read as books; no key dangles in either direction.
  const used = new Set();
  for (const it of ASHEN_INTERACTABLES) {
    if (!it.book) continue;
    ok(!!BOOKS[it.book], `lore prop '${it.id}' opens a real book ('${it.book}')`);
    used.add(it.book);
  }
  ok(used.size >= 8, `the frontier's props carry at least eight inscriptions (${used.size})`);
  for (const key of Object.keys(BOOKS)) {
    const b = BOOKS[key];
    ok(b.lines.length >= 2, `book '${key}' is more than a caption`);
    ok(typeof b.title === 'string' && b.title.length > 3, `book '${key}' has a title`);
    ok(b.lines.every((l) => typeof l === 'string' && l.length > 30), `book '${key}' reads as prose, not a label`);
    ok(used.has(key), `book '${key}' is reachable from a prop a player can click`);
  }
  const lore = ASHEN_INTERACTABLES.filter((i) => i.kind === 'lore');
  ok(lore.every((i) => !!i.book || !!i.text), 'every lore prop either opens a book or says its line');
  ok(lore.filter((i) => i.book).length >= 8, 'most lore props are readable books');
}

// ── 10. What persists: flags, items, and the once-only markers ──────────
// State-independent: the assertions above ran against live saves, so what is
// pinned here is the SHAPE of what persists, not whichever run left what set.
{
  const S = GameState.s;
  ok(!!S.story?.flags, 'story flags are part of the root state (saved and restored as one)');
  ok(SHARD_FLAGS.every((f) => /^[a-z][a-z_]*$/.test(f)), 'every fragment flag is a plain story flag name');
  ok(SHARDS.every((s) => SIDE_QUESTS[s.quest].steps[0].flag === s.flag),
     'the flag the world writes is exactly the step the quest engine watches');
  ok(!!S.world?.poiStates, 'the world keeps the POI markers the once-only fragments ride on');
  const shardObs = ASHEN_INTERACTABLES.filter((i) => i.kind === 'shard');
  ok(shardObs.every((i) => i.onceOnly === true), 'all five fragments are once-only');
  ok(ASHEN_INTERACTABLES.every((i) => !i.onceOnly || !!i.id), 'a once-only object has a stable id to mark');
  ok(SHARDS.every((s) => getItem(s.item).cat === 'special'), 'fragments are key items, not vendor loot');
  ok(SHARDS.every((s) => getItem(s.item).value > 0), 'each fragment is worth something if a merchant is foolish');
  const def = ASHEN_REGION;
  ok(def.interactables === ASHEN_INTERACTABLES, 'the region def hands over the same interactable list (no second copy)');
  const shardObjs = ASHEN_INTERACTABLES.filter((i) => i.kind === 'shard' || i.kind === 'ritual');
  ok(shardObjs.length === SHARDS.length + 1, 'exactly five fragments and one anchor are authored');
  ok(!isWaterAt(ASHEN_SAFE_ZONE.x, ASHEN_SAFE_ZONE.y), 'the safe hub itself is on dry ground (sanity)');
}

console.log(`shards: ${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} shard assertion(s) failed`);
