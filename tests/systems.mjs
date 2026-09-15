// Integration smoke test: full systems round-trip without Phaser.
import GameState from '../src/game/core/GameState.ts';
import { recompute, awardXP, learnSkill } from '../src/game/systems/ProgressionSystem.ts';
import * as Inv from '../src/game/systems/InventorySystem.ts';
import { craft } from '../src/game/systems/CraftingSystem.ts';
import { handleEvent, currentMainQuest } from '../src/game/systems/QuestEngine.ts';
import { completeQuest, setFlag, offerSideQuest } from '../src/game/systems/QuestSystem.ts';
import { refresh as kingdomRefresh, recruitCitizen, stageRequirementsMissing } from '../src/game/systems/KingdomSystem.ts';
import { productionTick, claimOverflow } from '../src/game/systems/KingdomEconomy.ts';
import { adjustRel, relOf } from '../src/game/systems/FactionSystem.ts';
import { buyPrice, sellPrice, makeContext } from '../src/game/systems/EconomySystem.ts';
import { serialize } from '../src/game/systems/SaveSystem.ts';
import { firstSteps, earlyWinTick, welcomeBackText } from '../src/game/systems/TutorialSystem.ts';
import * as Loot from '../src/game/systems/LootSystem.ts';
import * as Build from '../src/game/systems/BuildSystem.ts';
import * as Spawn from '../src/game/systems/SpawnDirector.ts';
import * as Factory from '../src/game/systems/EntityFactory.ts';
import * as Econ from '../src/game/systems/EconomySystem.ts';
import { healToFull } from '../src/game/systems/ProgressionXP.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('✗ ' + m); } };

GameState.newGame(1337, { name: 'Ash', gender: 'f', personality: 'kind' }, 'normal');
const S = () => GameState.s;

// derived stats
recompute();
ok(S().player.derived.maxHp > 80, 'derived maxHp sane');

// inventory: add / stack / spend
Inv.addItem('wood', 120);
ok(Inv.countItem('wood') === 120, 'stack added 120 wood');
ok(!Inv.hasItems({ wood: 121 }), 'hasItems refuses overdraft');
ok(Inv.spendItems({ wood: 20 }), 'spendItems succeeds');
ok(Inv.countItem('wood') === 100, 'count after spend = 100');

// equipment flow
Inv.addItem('leather_vest', 1);
const vestEntry = S().inventory.find((e) => e.id === 'leather_vest');
ok(!!vestEntry.iid, 'gear entry is instanced');
const preHp = S().player.derived.maxHp;
ok(Inv.equip(vestEntry.iid), 'equip leather_vest');
recompute();
ok(S().player.derived.maxHp === preHp, 'armor chest has no flat hp mod');
ok(S().player.equipment.chest?.id === 'leather_vest', 'chest slot filled');
ok(S().inventory.find((e) => e.id === 'leather_vest') == null, 'equipped removed from bag');
Inv.unequip('chest');
recompute();
ok(S().inventory.some((e) => e.id === 'leather_vest'), 'unequipped returned to bag');

// crafting failure & success
GameState.session.stationsNear = { campfire: true };
Inv.addItem('raw_meat', 2); Inv.addItem('wood', 5);
const badR = { out: 'iron_ingot', cost: { iron_ore: 99 } };
ok(craft({ id: 'x', ...badR }).ok === false, 'craft fails w/o resources');
ok(craft('cooked_meat').ok === true, 'campfire cooking succeeds');
ok(Inv.countItem('cooked_meat') >= 1, 'cooked meat produced');
ok(S().player.professions.crafting.xp > 0, 'crafting profession xp gained');

// quests: main chain progression — events alone drive completion
handleEvent({ type: 'gather', item: 'wood', amount: 10 });
handleEvent({ type: 'gather', item: 'fiber', amount: 6 });
ok(currentMainQuest()?.id === 'q_first_fire', 'main chain advanced to first fire');
setFlag('test_flag_xyz');
ok(S().story.flags.test_flag_xyz === true, 'flag set flows');
ok(offerSideQuest('sq_herbs_for_elara'), 'side quest offered');

// kingdom sim
S().settlement.founded = true;
S().settlement.pos = { x: 0, y: 0 };
recruitCitizen({ name: 'Tam', role: 'worker' });
recruitCitizen({ name: 'Mira', role: 'farmer', skillLv: 2 });
kingdomRefresh();
ok(GameState.session.kingdom.population === 2, 'population counted');
// farm building + worker assignment handled in scene; simulate yields:
productionTick({ x: 50, y: 50 });
ok(Array.isArray(S().settlement.overflow), 'overflow list exists');
claimOverflow();

// factions
adjustRel('verdant', 90);
ok(relOf('verdant') > 80 && GameState.s.factions.verdant.status === 'allied', `verdant allied (got ${relOf('verdant')}, ${GameState.s.factions.verdant.status})`);

// economy prices diverge per biome
const forestCtx = makeContext({ biomeId: 'forest' });
const mountCtx = makeContext({ biomeId: 'mountains' });
ok(buyPrice('iron_ore', mountCtx) < buyPrice('iron_ore', forestCtx), 'iron cheaper in mountains');
ok(sellPrice('wood', mountCtx) >= 0, 'sell price computed');

// persistence shape
const snap = serialize(S());
ok(snap.player.name === 'Ash', 'serialize keeps identity');
ok(JSON.stringify(Object.keys(snap)).includes('settlement'), 'snapshot branches present');

// onboarding helpers: checklist shape, early-win once, recap text
const steps = firstSteps();
ok(Array.isArray(steps) && steps.length === 4, 'firstSteps returns 4 starter steps');
ok(steps.every((s) => s.have !== undefined && s.need !== undefined), 'steps carry progress counts');
const xpBefore = S().player.xp;
const lvBefore = S().player.level;
earlyWinTick();
ok(S().story.flags.early_win === true, 'early win flag set on first resources');
ok(S().player.level > lvBefore || S().player.xp >= xpBefore, 'early win never costs progress (xp may convert to level)');
earlyWinTick();
ok(S().story.flags.early_win === true, 'early win fires only once');
ok(typeof welcomeBackText() === 'string' && welcomeBackText().length > 0, 'welcome-back recap builds');

// loot system: drop → magnet → pickup against a stub scene (no Phaser)
const mkImg = (x, y) => ({
  x, y, active: true, destroyed: false,
  setDepth() { return this; }, setScale() { return this; },
  setAngle() { return this; }, setInteractive() { return this; },
  setPosition(nx, ny) { this.x = nx; this.y = ny; return this; },
  on() { return this; }, destroy() { this.destroyed = true; },
});
const floated = [];
const stubScene = {
  loots: [],
  player: { sprite: { x: 0, y: 0 } },
  add: { image: (x, y) => mkImg(x, y) },
  tweens: { add: ({ onComplete }) => { try { onComplete && onComplete(); } catch {} } },
  time: { delayedCall: (_ms, fn) => { try { fn(); } catch {} } },
  floats: { add: (x, y, text) => floated.push(text) },
  spawnBurst: () => {},
  postFX: null,
};
Loot.setupLoot(stubScene);
ok(Array.isArray(stubScene.loots) && stubScene.loots.length === 0, 'loot list initializes');
Loot.dropLoot(stubScene, 500, 500, 'wood', 4);
ok(stubScene.loots.length === 1, 'dropLoot registers a ground drop');
// Far away: no pickup, timer advances, no expiry.
const woodBase = Inv.countItem('wood');
for (let i = 0; i < 10; i++) Loot.updateLoot(stubScene, 0, 0);
ok(stubScene.loots.length === 1 && Inv.countItem('wood') === woodBase, 'distant loot ignored');
// Walk onto it: magnet + pickup grants wood and clears the drop.
// (45 frames clears the 0.6s just-dropped grace period.)
const woodBefore = Inv.countItem('wood');
for (let i = 0; i < 45; i++) Loot.updateLoot(stubScene, 500, 520);
ok(stubScene.loots.length === 0, 'stepped-on loot collected');
ok(Inv.countItem('wood') === woodBefore + 4, 'pickup grants yield to inventory');
ok(floated.some((t) => /wood/i.test(t)), 'pickup emits float text');
// Expiry: ancient drops are swept.
Loot.dropLoot(stubScene, 900, 900, 'stone', 2);
stubScene.loots[0].t = 100;
Loot.updateLoot(stubScene, 0, 0);
ok(stubScene.loots.length === 0, 'expired loot swept');

// build system: pure texture/validation + upgrade guards (no Phaser)
ok(Build.buildingTexture({ key: 'townhall', tier: 3 }) === 'townhall_t3', 'townhall texture is tier-aware');
ok(Build.buildingTexture({ key: 'farm', complete: false }) === 'farm_stage1', 'incomplete farm shows stage 1');
ok(Build.buildingTexture({ key: 'nope' }) === 'hut_t1', 'unknown building falls back to hut');
ok(Build.canBuildAt({ x: 1e9, y: 0 }) !== null, 'out-of-bounds placement rejected');
// Seed 1337: (100,100) is forest land inside the (0,0) settlement radius.
S().settlement.buildings.push({ uid: 'test-hut', key: 'hut', x: 100, y: 100, tier: 1, complete: true });
ok(Build.canBuildAt({ x: 110, y: 100 }) === 'Too close to another building', 'collision with buildings rejected');
ok(typeof Build.nearMountains({ x: 0, y: 0 }) === 'boolean', 'nearMountains returns boolean');
S().settlement.buildings = S().settlement.buildings.filter((b) => b.uid !== 'test-hut');
const stubBuild = { buildings: new Map(), player: { sprite: { x: 0, y: 0 } } };
ok(Build.upgradeBuilding(stubBuild, 'missing').ok === false, 'upgrade of missing building fails');
Inv.addItem('clay', 30); Inv.addItem('stone', 25);
S().settlement.buildings.push({ uid: 'up-hut', key: 'hut', x: 0, y: 0, tier: 1, complete: true });
const upRes = Build.upgradeBuilding(stubBuild, 'up-hut');
ok(upRes.ok === true && S().settlement.buildings.find((b) => b.uid === 'up-hut').tier === 2, 'hut upgrades to tier 2');
S().settlement.buildings = S().settlement.buildings.filter((b) => b.uid !== 'up-hut');

// spawn director: injected stub entities (no Phaser), deterministic layout
class StubEnemy {
  constructor(scene, key, x, y) { this.key = key; this.sprite = { x, y }; this.dead = false; }
}
class StubBoss extends StubEnemy {
  constructor(scene, key, x, y) { super(scene, key, x, y); this.boss = true; }
}
Spawn.configureSpawning({ Enemy: StubEnemy, BossEnemy: StubBoss });
const mkNodeImg = (x, y) => ({
  x, y,
  setDepth() { return this; }, setTint() { return this; }, setName() { return this; },
});
const stubWorld = {
  nodes: new Map(), enemies: [],
  add: { image: (x, y) => mkNodeImg(x, y) },
  tweens: { add: () => {} },
};
const wolf = Spawn.spawnEnemy(stubWorld, 'wolf', 10, 20);
ok(wolf && wolf.key === 'wolf' && !(wolf instanceof StubBoss), 'spawnEnemy creates normal foes');
const boss = Spawn.spawnEnemy(stubWorld, 'alpha_wolf', 30, 40);
ok(boss && boss instanceof StubBoss, 'spawnEnemy routes bosses to the boss class');
ok(Spawn.spawnEnemy(stubWorld, 'nope') === null, 'spawnEnemy rejects unknown keys');
ok(Spawn.rollEnemy('plains', 0.5) === Spawn.rollEnemy('plains', 0.5), 'enemy rolls deterministic');
const node = Spawn.spawnNode(stubWorld, 'tree_oak', 111, 222, 'k1', null);
ok(node && node.type === 'tree_oak' && stubWorld.nodes.size === 1, 'spawnNode registers a node');
ok(Spawn.spawnNode(stubWorld, 'nope', 0, 0, 'k2', null) === null, 'spawnNode rejects unknown types');
const before = stubWorld.nodes.size + stubWorld.enemies.length;
Spawn.populateChunk(stubWorld, 6, 6);
ok(stubWorld.nodes.size + stubWorld.enemies.length > before, 'populateChunk fills a chunk deterministically');
const countAgain = stubWorld.nodes.size;
Spawn.populateChunk(stubWorld, 6, 6);
ok(stubWorld.nodes.size >= countAgain, 'repopulation is additive and stable');

// entity factory npcs: record shape + interact wiring (stub scene)
const mkNpcImg = () => {
  const handlers = {};
  return {
    setDepth() { return this; }, setAlpha() { return this; },
    setBlendMode() { return this; }, setInteractive() { return this; },
    setFrame() { return this; }, on(ev, fn) { handlers[ev] = fn; return this; },
    _fire: (ev) => handlers[ev]?.(),
  };
};
const stubNpcScene = { npcs: [], add: { image: () => mkNpcImg() } };
let interacted = null;
const tam = Factory.createNpc(stubNpcScene, 'tam', 5, 6, (npc) => { interacted = npc; });
ok(tam && tam.key === 'tam' && tam.homeX === 5 && stubNpcScene.npcs.length === 1, 'createNpc registers a villager');
ok(Factory.createNpc(stubNpcScene, 'nope', 0, 0, () => {}) === null, 'createNpc rejects unknown keys');
tam.sprite._fire('pointerdown');
ok(interacted === tam && tam.aiState === 'idle', 'npc interact wiring pauses wandering + calls back');

// entity factory (Phase 6a): unified construction over a stub scene (no Phaser)
Factory.configureEntities({ Enemy: StubEnemy, BossEnemy: StubBoss });
const stubFactory = {
  nodes: new Map(), enemies: [],
  add: { image: (x, y) => mkNodeImg(x, y) },
  tweens: { add: () => {} },
};
const fwolf = Factory.createEnemy(stubFactory, 'wolf', 5, 6);
ok(fwolf && fwolf.key === 'wolf' && !(fwolf instanceof StubBoss), 'factory creates normal foes');
ok(stubFactory.enemies.includes(fwolf), 'factory registers enemies on the scene');
const fboss = Factory.createEnemy(stubFactory, 'alpha_wolf', 7, 8);
ok(fboss && fboss instanceof StubBoss, 'factory routes bosses to the boss class');
ok(Factory.createEnemy(stubFactory, 'nope_not_real') === null, 'factory rejects unknown enemy keys');
// dead on arrival → null, never registered
class DeadStub extends StubEnemy {
  constructor(scene, key, x, y) { super(scene, key, x, y); this.dead = true; }
}
Factory.configureEntities({ Enemy: DeadStub, BossEnemy: StubBoss });
const foeCount = stubFactory.enemies.length;
ok(Factory.createEnemy(stubFactory, 'wolf', 1, 1) === null, 'factory returns null when dead on arrival');
ok(stubFactory.enemies.length === foeCount, 'dead arrivals are not registered');
Factory.configureEntities({ Enemy: StubEnemy, BossEnemy: StubBoss });
const fnode = Factory.createResource(stubFactory, 'tree_oak', 50, 60, 'fk1', null);
ok(fnode && fnode.type === 'tree_oak' && stubFactory.nodes.get(fnode.uid) === fnode, 'factory creates + registers resource nodes');
ok(fnode.hp === 10 && fnode.maxHp === 10 && fnode.ticks === 0 && fnode.depleted === false, 'factory node record matches SpawnDirector shape');
ok(typeof fnode.uid === 'string' && fnode.uid.startsWith('n'), 'factory node uids use the session-local n-prefix');
ok(Factory.createResource(stubFactory, 'nope_not_real', 0, 0, 'fk2', null) === null, 'factory rejects unknown node types');
// spawn delegates route through the factory (shared injection)
const viaSpawn = Spawn.spawnEnemy(stubFactory, 'wolf', 9, 9);
ok(viaSpawn && viaSpawn.key === 'wolf', 'SpawnDirector.spawnEnemy delegates to the factory');
const viaNode = Spawn.spawnNode(stubFactory, 'rock_small', 5, 5, 'dk1', null);
ok(viaNode && stubFactory.nodes.get(viaNode.uid) === viaNode && viaNode.uid !== fnode.uid, 'SpawnDirector.spawnNode delegates with unique uids');
// createItem: headless (no scene), stack vs instanced gear, unknown → null
const woodBeforeF = Inv.countItem('wood');
const stackRes = Factory.createItem('wood', 3);
ok(stackRes && stackRes.qty === 3 && stackRes.added === 3 && stackRes.left === 0, 'createItem builds stackables with addItem accounting');
ok(Inv.countItem('wood') === woodBeforeF + 3, 'createItem mutates inventory for stacks');
const gearRes = Factory.createItem('leather_vest', 1);
ok(gearRes && gearRes.iid && gearRes.id === 'leather_vest', 'createItem builds gear as iid instances');
ok(S().inventory.some((e) => e.iid === gearRes.iid), 'created gear instance lands in inventory');
ok(Factory.createItem('nope_not_real') === null, 'createItem rejects unknown ids');

// economy transactions own gold (Phase 4: UI never touches player.gold)
S().player.gold = 100;
ok(Econ.spendGold(30) === true && S().player.gold === 70, 'spendGold deducts on funds');
ok(Econ.spendGold(999) === false && S().player.gold === 70, 'spendGold refuses overdraft + never negative');
ok(Econ.earnGold(15) === 15 && S().player.gold === 85, 'earnGold credits');
const woodN = Inv.countItem('wood');
const buyRes = Econ.buyOffer({ id: 'arrows', buy: 5 });
ok(buyRes.ok === true && S().player.gold === 80, 'buyOffer charges + delivers goods');
ok(Econ.buyOffer({ id: 'arrows', buy: 1e9 }).ok === false, 'buyOffer refuses the broke');
ok(Econ.buyOffer({ id: 'nope_not_real', buy: 1 }).ok === false, 'buyOffer rejects unknown goods');
const sellRes = Econ.sellUnit('wood', Econ.makeContext({ biomeId: 'forest' }));
ok(sellRes.ok === true && sellRes.price > 0 && Inv.countItem('wood') === woodN - 1, 'sellUnit moves goods for gold');
ok(Econ.sellUnit('nope_not_real', Econ.makeContext({})).ok === false, 'sellUnit rejects unknown goods');

// vitals service owns healing (Phase 4: UI never writes player.hp)
S().player.hp = 3;
healToFull();
ok(S().player.hp === S().player.derived.maxHp, 'healToFull restores max HP');

console.log(fails === 0 ? '✅ INTEGRATION PASS — systems layer healthy.' : `❌ ${fails} integration failure(s)`);
process.exit(fails ? 1 : 0);
