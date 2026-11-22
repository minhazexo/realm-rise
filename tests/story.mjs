// STORY GATE — the eight-chapter arc, its decisive quests, the banner bargain
// and the three governments, pinned without Phaser or a browser.
//
// The bible's delivery rule is that a choice must change a tangible system, and
// that a chapter is not "reached" until its decisive work is done. This suite
// makes both testable: the chapter table is checked against the quest chain,
// the bargain is actually applied to a live save, and every ending's
// requirements are resolved against real faction standing.
import assert from 'node:assert/strict';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

const {
  CHAPTER_ARC, CHAPTER_BY_NUMBER, CHAPTER_AT_CHAIN,
  chapterForChain, chapterGateMet, chapterReached
} = await import('../src/game/data/chapters.ts');
const { MAIN_QUESTS, QUEST_ORDER } = await import('../src/game/data/questsMain.ts');
const { SIDE_QUESTS } = await import('../src/game/data/questsSide.ts');
const { SHARDS, BARRIER, SHARD_FLAGS } = await import('../src/game/data/storyShards.ts');
const { BANNER_POLICIES, POLICY_FLAGS, POLICY_TOTAL_FLAG, chosenPolicy } = await import('../src/game/data/policies.ts');
const { CHAPTERS, JOURNAL_LORE } = await import('../src/game/data/story.ts');
const { getNpcDef, npcLines, NPCS } = await import('../src/game/data/npcs.ts');
const story = await import('../src/game/systems/narrative/StorySystem.ts');
const policies = await import('../src/game/systems/economy/PolicySystem.ts');
const QuestSystem = await import('../src/game/systems/narrative/QuestSystem.ts');
const QuestEngine = await import('../src/game/systems/narrative/QuestEngine.ts');
const GameState = (await import('../src/game/core/GameState.ts')).default;

/* ── 1. The chapter table ──────────────────────────────────────────────── */
{
  ok(CHAPTER_ARC.length === 8, `the arc is eight chapters (${CHAPTER_ARC.length})`);
  ok(CHAPTER_ARC.map((c) => c.n).join() === '1,2,3,4,5,6,7,8', 'chapters are numbered 1…8 exactly once');
  for (const c of CHAPTER_ARC) {
    ok(CHAPTER_BY_NUMBER[c.n] === c, `chapter ${c.n} resolves by number`);
    ok(!!CHAPTERS[c.n], `chapter ${c.n} has a UI card`);
    ok(CHAPTERS[c.n].title === c.title, `chapter ${c.n}: the card title comes from the arc, not a second copy`);
    ok(CHAPTERS[c.n].card === c.card, `chapter ${c.n}: the card colour comes from the arc`);
    const q = MAIN_QUESTS[c.questId];
    ok(!!q, `chapter ${c.n}: decisive quest '${c.questId}' exists`);
    ok(q?.chapter === c.n, `chapter ${c.n}: '${c.questId}' declares the same chapter`);
    ok(c.beat.length > 120, `chapter ${c.n}: its beat is written, not labelled`);
    ok(c.question.length > 20, `chapter ${c.n}: it asks a question`);
    ok(c.worldChange.length > 40, `chapter ${c.n}: it names the change it leaves behind`);
  }
  ok(CHAPTER_ARC[0].requires.length === 0, 'Chapter I asks for nothing: a fresh save can always begin');
  ok(CHAPTER_ARC[6].title.includes('The Frontier Holds'), 'Chapter VII is the frontier holding, not a generic threat');
}

/* ── 2. Every gate is earnable somewhere in the content ────────────────── */
{
  const produced = new Set();
  for (const def of [...Object.values(MAIN_QUESTS), ...Object.values(SIDE_QUESTS)]) {
    for (const f of def.flagsOnComplete || []) produced.add(f);
    for (const f of def.rewards?.flagsSet || []) produced.add(f);
    for (const s of def.steps || []) if (s.type === 'flag' && s.flag) produced.add(s.flag);
  }
  for (const s of SHARDS) produced.add(s.flag);
  produced.add(BARRIER.flag);
  for (const f of POLICY_FLAGS) produced.add(f);
  produced.add(POLICY_TOTAL_FLAG);
  // World-set flags (regions, arenas, NPC requirements) that are not quest steps.
  for (const f of ['met_hunter_hint', 'alpha_slain', 'settlement_founded', 'bandit_king_slain',
    'secrets_unsealed', 'ancient_forge_lit', 'warden_slain', 'aetheria_remembered']) produced.add(f);

  for (const c of CHAPTER_ARC) {
    for (const f of c.requires) ok(produced.has(f), `chapter ${c.n}: gate '${f}' is produced by real content`);
  }
  ok(chapterGateMet(1, {}), 'Chapter I has no gate');
  ok(!chapterGateMet(7, {}), 'Chapter VII cannot be claimed empty-handed');
  const all = Object.fromEntries([...produced].map((f) => [f, true]));
  ok(CHAPTER_ARC.every((c) => chapterGateMet(c.n, all)), 'every gate opens when its content is done');
}

/* ── 3. The chapter table tracks the main chain ────────────────────────── */
{
  ok(CHAPTER_AT_CHAIN.length === QUEST_ORDER.length,
     `the chapter map covers the whole chain (${CHAPTER_AT_CHAIN.length} vs ${QUEST_ORDER.length})`);
  ok(CHAPTER_AT_CHAIN.every((n, i) => i === 0 || n >= CHAPTER_AT_CHAIN[i - 1]), 'chapters never run backwards');
  ok(CHAPTER_AT_CHAIN[0] === 1 && CHAPTER_AT_CHAIN[CHAPTER_AT_CHAIN.length - 1] === 8,
     'the chain opens in Chapter I and ends in Chapter VIII');
  ok(chapterForChain(0) === 1, 'the first quest is Chapter I');
  ok(chapterForChain(QUEST_ORDER.length - 1) === 8, 'the last quest is Chapter VIII');
  ok(chapterForChain(9999) === 8, 'an out-of-range chain index saturates, never crashes');

  // Gates stop the count rather than skip it.
  ok(chapterReached(QUEST_ORDER.length - 1, {}) === 2,
     'a chain that skipped its gates cannot claim past Chapter II');
  const all = Object.fromEntries([...SHARD_FLAGS, BARRIER.flag, 'met_hunter_hint', 'settlement_founded',
    'policy_banner', 'bandit_king_slain', 'secrets_unsealed'].map((f) => [f, true]));
  ok(chapterReached(QUEST_ORDER.length - 1, all) === 8, 'with the gates earned the whole arc is claimable');
  ok(chapterReached(3, all) === 3, 'the chain still caps the chapter it has actually reached');
}

/* ── 4. The decisive quests tell the bible's story ─────────────────────── */
{
  const frontier = MAIN_QUESTS.q_ancient_threat;
  ok(frontier?.title === 'The Frontier Holds', 'Chapter VII is carried by "The Frontier Holds"');
  const flags = (frontier.steps || []).filter((s) => s.type === 'flag').map((s) => s.flag);
  ok(SHARD_FLAGS.every((f) => flags.includes(f)), 'the chapter asks for every one of the five fragments');
  ok(flags.includes(BARRIER.flag), 'and for the anchor to be raised');

  const crown = MAIN_QUESTS.q_crown_of_realm;
  ok(crown.steps.some((s) => s.type === 'flag' && s.flag === BARRIER.flag),
     'the crown cannot be claimed before the barrier is restored');
  const choiceIdx = crown.steps.findIndex((s) => s.type === 'choice' && s.choiceId === 'coronation');
  ok(choiceIdx === crown.steps.length - 1, 'the council is the last thing the campaign asks for');

  const banner = MAIN_QUESTS.q_rising_banner;
  const last = banner.steps[banner.steps.length - 1];
  ok(last.type === 'choice' && last.choiceId === 'banner_policy',
     'Chapter IV closes on the banner bargain (appended, so old saves keep their step progress)');
  ok(banner.steps.length === 4, 'the bargain is appended rather than inserted into existing steps');
}

/* ── 5. Flag steps are read from the world, so old saves cannot stick ───── */
{
  GameState.newGame(424242, { name: 'Ash', gender: 'f', personality: 'kind' }, 'normal');
  const S = GameState.s;
  S.quests.chainIndex = QUEST_ORDER.indexOf('q_ancient_threat');
  for (const f of SHARD_FLAGS) S.story.flags[f] = true;
  S.story.flags[BARRIER.flag] = true;
  const q = MAIN_QUESTS.q_ancient_threat;
  ok(q.steps.every((s, i) => QuestEngine.stepProgress(q.id, i) >= (s.count || 1)),
     'a save that already holds the five reads every flag step as done');
  QuestEngine.recheckActive();
  ok(S.quests.chainIndex === QUEST_ORDER.indexOf('q_crown_of_realm'),
     'the frontier chapter completes on the world state it describes, without re-playing it');
}

/* ── 6. The banner bargain: one choice, real consequences ─────────────── */
{
  GameState.newGame(424243, { name: 'Ash', gender: 'm', personality: 'stoic' }, 'normal');
  const S = GameState.s;
  S.quests.chainIndex = QUEST_ORDER.indexOf('q_rising_banner');
  const before = { league: S.factions.league.rel, verdant: S.factions.verdant.rel, gold: S.player.gold };

  ok(policies.bannerBargain().ready === false, 'the bargain is not offered before the settlement has grown');
  QuestEngine.handleEvent({ type: 'population', count: 3 });
  QuestEngine.handleEvent({ type: 'built', building: 'farm' });
  QuestEngine.handleEvent({ type: 'built', building: 'storage_chest' });
  ok(policies.bannerBargain().ready === true, 'once Chapter IV\'s work is done the three offers are open');

  const result = policies.applyBannerPolicy(1);
  ok(result.ok === true, 'the signed-road bargain can be taken');
  ok(S.story.flags.policy_pragmatism === true && S.story.flags[POLICY_TOTAL_FLAG] === true,
     'choosing writes the policy flag and the once-only banner flag');
  ok(S.factions.league.rel > before.league && S.factions.verdant.rel < before.verdant,
     'standing really moves: the League up, the clans down');
  ok(S.player.gold === before.gold + 120 + (MAIN_QUESTS.q_rising_banner.rewards.gold || 0),
     'the League\'s signing gold is paid exactly once (plus the chapter reward)');
  ok(policies.policyTradeBonus() === BANNER_POLICIES[1].tradeBonus, 'the banner prices the whole market');
  ok(policies.applyBannerPolicy(0).ok === false, 'a second banner cannot be taken');
  ok(chosenPolicy(S.story.flags)?.id === 'pragmatism', 'the realm remembers which banner it flies');
  ok(S.quests.chainIndex > QUEST_ORDER.indexOf('q_rising_banner'),
     'the choice closes Chapter IV and the war chapter begins');

  for (const p of BANNER_POLICIES) {
    ok(typeof p.benefit === 'string' && p.benefit.length > 30, `${p.id}: names what the realm gains`);
    ok(typeof p.cost === 'string' && p.cost.length > 30, `${p.id}: names what the realm pays`);
    ok(Object.keys(p.factionDeltas).length > 0, `${p.id}: moves at least one power`);
  }
  ok(new Set(BANNER_POLICIES.map((p) => p.flag)).size === 3, 'each banner is its own saved flag');
}

/* ── 7. The council: three governments, gated and priced ──────────────── */
{
  GameState.newGame(424244, { name: 'Ash', gender: 'f', personality: 'clever' }, 'normal');
  const S = GameState.s;
  S.quests.chainIndex = QUEST_ORDER.indexOf('q_crown_of_realm');
  S.story.flags[BARRIER.flag] = true;
  S.settlement.stageIndex = 5;

  const atStart = story.endingOptions();
  ok(atStart.length === 3, 'the council offers three governments');
  ok(atStart.map((o) => o.id).join() === 'concord,crown,dominion', 'they are the bible\'s three, in order');
  ok(atStart[0].eligible === false, 'the Concord is not free: it needs both signatories');
  ok(atStart[2].eligible === true, 'the Dominion is always available — the uneasy choice is a choice');
  ok(atStart.every((o) => o.cost.length > 30), 'every government names its cost');
  ok(atStart[0].requirements.filter((r) => !r.ok).length > 0, 'an unmet requirement is visible, not hidden');

  QuestEngine.handleEvent({ type: 'stage-reached', index: 5 });
  QuestEngine.handleEvent({ type: 'territory-pct', pct: 40 });
  ok(QuestSystem.crownChoiceReady() === true, 'with the anchor raised and the realm grown, the council can be called');

  // The Concord is refused until its signatories are earned.
  QuestSystem.applyChoice('coronation', 0);
  ok(S.story.flags.ending_concord !== true, 'an unearned Concord is refused');
  ok(S.quests.chainIndex === QUEST_ORDER.indexOf('q_crown_of_realm'), 'and the campaign stays open');

  QuestSystem.applyChoice('coronation', 2);
  ok(S.story.flags.ending_dominion === true, 'the Dominion is recorded');
  ok(S.story.flags.game_completed === true, 'the realm is completed under that government');
  ok(story.endingFor('dominion').title.includes('DOMINION'), 'its epilogue text resolves');
  ok(story.endingFor('concord').title.includes('CONCORD'), 'the Concord has its own epilogue');
  ok(story.endingFor('conqueror').title === 'THE CONQUEROR’S PEACE', 'legacy oaths from old saves still resolve');
}

/* ── 7b. Earned Concord: standing actually opens a government ─────────── */
{
  GameState.newGame(424245, { name: 'Ash', gender: 'f', personality: 'kind' }, 'normal');
  const S = GameState.s;
  S.quests.chainIndex = QUEST_ORDER.indexOf('q_crown_of_realm');
  S.story.flags[BARRIER.flag] = true;
  S.settlement.stageIndex = 5;
  S.factions.verdant.rel = 40;
  S.factions.league.rel = 40;
  S.factions.iron.rel = 0;
  QuestEngine.handleEvent({ type: 'stage-reached', index: 5 });
  QuestEngine.handleEvent({ type: 'territory-pct', pct: 40 });
  ok(story.endingOptions()[0].eligible === true, 'high Verdant and League standing open the Concord');
  QuestSystem.applyChoice('coronation', 0);
  ok(S.story.flags.ending_concord === true, 'the earned Concord is recorded');
}

/* ── 8. Reactive dialogue: the cast moves with the story ──────────────── */
{
  const known = new Set(['policy_banner']);
  for (const f of POLICY_FLAGS) known.add(f);
  for (const f of SHARD_FLAGS) known.add(f);
  known.add(BARRIER.flag);
  for (const f of ['met_hunter_hint', 'alpha_slain', 'settlement_founded', 'bandit_king_slain',
    'secrets_unsealed', 'ancient_forge_lit', 'warden_slain', 'aetheria_remembered',
    'ending_concord', 'ending_crown', 'ending_dominion', 'banner_risen', 'kara_rescued', 'first_fire']) known.add(f);

  let blocks = 0;
  for (const [key, def] of Object.entries(NPCS)) {
    for (const b of def.linesByFlag || []) {
      blocks++;
      const tag = b.flag || `chapter ${b.minChapter}`;
      ok(!!b.flag || typeof b.minChapter === 'number', `${key}: a block has a flag or a chapter`);
      if (b.flag) ok(known.has(b.flag), `${key}: reacts to a real story flag ('${b.flag}')`);
      if (b.minChapter) ok(b.minChapter >= 2 && b.minChapter <= 8, `${key}: chapter gate ${b.minChapter} is in the arc`);
      ok(Array.isArray(b.lines) && b.lines.length >= 2, `${key}: '${tag}' is more than a single line`);
      ok(b.lines.every((l) => l.length > 20), `${key}: '${tag}' has no stub lines`);
    }
  }
  ok(blocks >= 20, `the cast has real state-based dialogue (${blocks} blocks)`);

  const mara = getNpcDef('mara');
  ok((mara.linesByFlag || []).length >= 6, 'Mara reacts to the chain and the banner');
  ok(POLICY_FLAGS.every((f) => (mara.linesByFlag || []).some((b) => b.flag === f)),
     'each banner changes what Mara says');
  ok(npcLines(getNpcDef('tam'), { barrier_restored: true }).join(' ').includes('quiet'),
     'Tam has something to say when the night turns ordinary again');
  ok(npcLines(getNpcDef('hob'), { policy_discipline: true }).join(' ').includes('roof'),
     'the scholar has an opinion about the garrison');
  ok(npcLines(mara, {}) === mara.dialogue, 'with no story behind her, Mara still says her opening lines');

  // The order rule: a later block wins, so the endgame cannot be drowned out
  // by an earlier policy reaction.
  const both = { policy_discipline: true, barrier_restored: true };
  ok(npcLines(mara, both).join(' ').includes('anchor is holding'),
     'once the barrier is restored Mara speaks about the peace, not the bargain');
}

/* ── 9. The reliquary: renamed for the player, unchanged for the save ─── */
{
  const reliquary = SHARDS.find((s) => s.id === 'shard_ash');
  ok(reliquary?.name === 'The Ashen Reliquary', 'the fifth vessel is player-facing as the Ashen Reliquary');
  ok(reliquary?.item === 'shard_of_ash' && reliquary?.flag === 'shard_ash_taken',
     'its item and flag ids are untouched, so saves and quests keep working');
  ok((reliquary?.inscription || []).join(' ').includes('Crown Ember'),
     'its inscription names the truth the finale pays off');
  ok(BARRIER.epilogue.join(' ').includes('Crown Ember'), 'the shrine answers with the Crown Ember');
  for (const key of ['banner_bargain', 'reliquary_truth', 'warden_slain', 'council_called',
    'ending_concord', 'ending_crown', 'ending_dominion']) {
    ok(typeof JOURNAL_LORE[key] === 'string' && JOURNAL_LORE[key].length > 80, `journal '${key}' is written`);
  }
}

console.log(`story: ${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} story assertion(s) failed`);
