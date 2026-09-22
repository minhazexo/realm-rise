// Save-versioning tests: migrations, repair, round-trips, idempotency.
// Uses an in-memory localStorage stub (node has none).
import GameState from '../src/game/core/GameState.ts';
import {
  SAVE_VERSION, cmpVersions, migrations, migrateSave,
  serialize, saveToSlot, loadFromSlot, importSlotData, listSaves
} from '../src/game/systems/SaveSystem.ts';
import { newInstance } from '../src/game/data/items.ts';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

let fails = 0;
const ok = (c, m) => {
  if (!c) { fails++; console.error('✗ ' + m); }
  else console.log('✓ ' + m);
};

console.log('— Version compare —');
ok(cmpVersions('0.9.0', '1.0.0') === -1, '0.9.0 < 1.0.0');
ok(cmpVersions('1.0.0', '1.0.0') === 0, 'equal versions');
ok(cmpVersions('1.1.0', '1.0.0') === 1, '1.1.0 > 1.0.0');
ok(cmpVersions('banana', '1.0.0') === -1, 'garbage sorts oldest');
ok(cmpVersions(undefined, '1.0.0') === -1, 'missing sorts oldest');

console.log('— Old-save fixture (v0.9.0, predates camZoom/exploredChunks/slots/stats) —');
// Build a current save, then strip everything a 0.9.0 save would lack.
GameState.newGame(4242, { name: 'Migrant', gender: 'f', personality: 'kind' }, 'normal');
GameState.s.player.gold = 77;
const old = JSON.parse(JSON.stringify(serialize(GameState.s)));
old.meta.version = '0.9.0';
delete old.meta.migratedFrom;
delete old.inventorySlots;
delete old.stats;
delete old.achievements;
delete old.world.exploredChunks;
delete old.settings.camZoom;
delete old.settings.fpsCap;
const migrated = migrateSave(old);
ok(migrated.meta.version === SAVE_VERSION, `stamp lifted to ${SAVE_VERSION}`);
ok(migrated.meta.migratedFrom === '0.9.0', 'origin recorded');
ok(typeof migrated.inventorySlots === 'number', 'inventorySlots repaired');
ok(Array.isArray(migrated.world.exploredChunks), 'exploredChunks repaired');
ok(typeof migrated.settings.camZoom === 'number', 'camZoom defaulted');
ok(migrated.stats && typeof migrated.stats.kills === 'number', 'stats repaired');
ok(migrated.player.gold === 77 && migrated.player.name === 'Migrant', 'progress preserved');
ok(migrated.achievements && typeof migrated.achievements === 'object', 'achievements repaired');

console.log('— Idempotency + freshness —');
const again = migrateSave(migrated);
ok(again.meta.migratedFrom === '0.9.0', 'second run keeps origin stamp');
ok(again.player.gold === 77, 'second run preserves data');
const fresh = migrateSave(JSON.parse(JSON.stringify(serialize(GameState.s))));
ok(fresh.meta.migratedFrom === undefined, 'current saves untouched');

console.log('— Storage round-trip (stub localStorage) —');
ok(saveToSlot('slot1', GameState.s).ok === true, 'saveToSlot writes');
const loaded = loadFromSlot('slot1');
ok(loaded && loaded.player.name === 'Migrant', 'loadFromSlot reads + migrates');
ok(loaded.meta.version === SAVE_VERSION, 'loaded save stamped current');
const meta = listSaves();
ok(meta.slot1 && meta.slot1.name === 'Migrant', 'listSaves sees the slot');
ok(importSlotData(JSON.stringify(loaded), 'slot2').ok === true, 'importSlotData accepts');
ok(loadFromSlot('slot2').player.gold === 77, 'imported slot loads with data');
ok(importSlotData('garbage{{{', 'slot2').ok === false, 'import rejects garbage');
ok(loadFromSlot('empty-slip') === null, 'missing slot reads null');

console.log('— GameState.load migrates programmatic loads —');
const legacy = JSON.parse(JSON.stringify(serialize(GameState.s)));
legacy.meta.version = '0.9.0';
delete legacy.inventorySlots;
GameState.load(legacy);
ok(GameState.s.meta.version === SAVE_VERSION, 'GameState.load stamps current');
ok(typeof GameState.s.inventorySlots === 'number', 'GameState.load repairs branches');

console.log('— Gear ids stay unique across a load —');
// The iid counter restarts every session while the save keeps its ids: the
// first gear crafted after CONTINUE used to collide, and the inventory grid
// then rendered two children with the same React key.
const dupSave = JSON.parse(JSON.stringify(serialize(GameState.s)));
dupSave.inventory = [
  { iid: 'i2', id: 'wooden_sword', qty: 1, dur: 10, maxDur: 10 },
  { iid: 'i2', id: 'iron_sword', qty: 1, dur: 12, maxDur: 12 },
  { iid: 'i5', id: 'iron_sword', qty: 1, dur: 12, maxDur: 12 },
];
GameState.load(dupSave);
const iids = GameState.s.inventory.map((e) => e.iid).filter(Boolean);
ok(iids.length === 3, `restored ${iids.length} gear pieces`);
ok(new Set(iids).size === iids.length, `no duplicate gear ids after a load (${iids.join(', ')})`);
const freshGear = newInstance('wooden_sword');
ok(!!freshGear && !!freshGear.iid && !iids.includes(freshGear.iid), `gear made after a load gets a fresh id (${freshGear && freshGear.iid})`);

console.log(fails === 0 ? '✅ SAVE PASS — versioned persistence holds.' : `❌ ${fails} save failure(s)`);
process.exit(fails ? 1 : 0);
