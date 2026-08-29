// Integration smoke test: full systems round-trip without Phaser.
import GameState from '../src/game/core/GameState.js';
import { recompute, awardXP, learnSkill } from '../src/game/systems/ProgressionSystem.js';
import * as Inv from '../src/game/systems/InventorySystem.js';
import { craft } from '../src/game/systems/CraftingSystem.js';
import { handleEvent, currentMainQuest } from '../src/game/systems/QuestEngine.js';
import { completeQuest, setFlag, offerSideQuest } from '../src/game/systems/QuestSystem.js';
import { refresh as kingdomRefresh, recruitCitizen, stageRequirementsMissing } from '../src/game/systems/KingdomSystem.js';
import { productionTick, claimOverflow } from '../src/game/systems/KingdomEconomy.js';
import { adjustRel, relOf } from '../src/game/systems/FactionSystem.js';
import { buyPrice, sellPrice, makeContext } from '../src/game/systems/EconomySystem.js';
import { serialize } from '../src/game/systems/SaveSystem.js';

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

console.log(fails === 0 ? '✅ INTEGRATION PASS — systems layer healthy.' : `❌ ${fails} integration failure(s)`);
process.exit(fails ? 1 : 0);
