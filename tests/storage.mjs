// Storage tests: the platform KV layer, the desktop file backend, and the save
// system running on top of it. These run in node with a localStorage stub,
// which is the same contract the desktop shell satisfies with a file.
import assert from 'node:assert/strict';
import { installBackend, createDesktopBackend, kvGet, kvSet, kvRemove } from '../src/platform/kv.ts';
import { parseStore } from '../src/platform/desktop.ts';
import GameState from '../src/game/core/GameState.ts';
import {
  saveToSlot, loadFromSlot, listSaves, deleteSlot, exportSlot, SAVE_VERSION
} from '../src/game/systems/persistence/SaveSystem.ts';

let passed = 0, failed = 0;
const ok = (cond, label) => { if (cond) { passed++; } else { failed++; console.error('  ✗ ' + label); } };

/** Minimal localStorage double backed by a plain object. */
function stubStorage() {
  const map = {};
  return {
    map,
    storage: {
      getItem: (k) => (k in map ? map[k] : null),
      setItem: (k, v) => { map[k] = String(v); },
      removeItem: (k) => { delete map[k]; },
      key: (i) => Object.keys(map)[i] ?? null,
      get length() { return Object.keys(map).length; }
    }
  };
}

/* ── Web: localStorage ─────────────────────────────────────────────────── */
const web = stubStorage();
globalThis.localStorage = web.storage;
installBackend(null);

kvSet('rotr_probe_a', '1');
ok(web.map.rotr_probe_a === '1', 'writes reach localStorage');
ok(kvGet('rotr_probe_a') === '1', 'reads come back');
kvRemove('rotr_probe_a');
ok(kvGet('rotr_probe_a') === null, 'remove clears the key');

// A swapped global is picked up (node tests and shells both swap it).
const web2 = stubStorage();
globalThis.localStorage = web2.storage;
kvSet('rotr_probe_b', '2');
ok(web2.map.rotr_probe_b === '2' && !('rotr_probe_b' in web.map),
  're-resolves when the storage global is replaced');

/* ── No storage at all: memory fallback ────────────────────────────────── */
globalThis.localStorage = undefined;
installBackend(null);
kvSet('rotr_mem', 'm');
ok(kvGet('rotr_mem') === 'm', 'memory fallback keeps working without storage');
kvRemove('rotr_mem');
ok(kvGet('rotr_mem') === null, 'memory fallback removes');

/* ── Desktop backend: synchronous reads, coalesced writes ──────────────── */
const doc = {};
let writes = 0, lastJson = null;
installBackend(createDesktopBackend(doc, (json) => { writes++; lastJson = json; }));

kvSet('rotr_save_auto', '{"a":1}');
kvSet('rotr_save_shadow', '{"a":1}');
ok(kvGet('rotr_save_auto') === '{"a":1}', 'desktop read is immediate (synchronous)');
kvRemove('rotr_save_auto');
ok(kvGet('rotr_save_auto') === null, 'desktop remove is immediate');

await Promise.resolve();
await Promise.resolve();
ok(writes === 1, `same-tick writes coalesce into one persist (got ${writes})`);
ok(lastJson && JSON.parse(lastJson).rotr_save_shadow === '{"a":1}', 'persisted document holds the store');

ok(kvGet('rotr_never') === null, 'missing key reads as null');
ok(kvGet('constructor') === null, 'prototype keys are not readable');

/* ── SaveSystem rides the installed backend, with migrations intact ─────── */
GameState.newGame(90210, { name: 'Desktop', gender: 'f', personality: 'kind' }, 'normal');
const saved = saveToSlot('slot1', GameState.s);
ok(saved.ok, 'saveToSlot succeeds on the desktop backend');
ok(typeof doc.rotr_save_slot1 === 'string', 'save lands in the backend store');
ok(Object.keys(doc).some((k) => k.startsWith('rotr_save_shadow_')), 'shadow copy is written too');

await Promise.resolve();
await Promise.resolve();
const loaded = loadFromSlot('slot1');
ok(!!loaded && loaded.player.name === 'Desktop', 'slot loads back through the same keys');
ok(loaded.meta.version === SAVE_VERSION, `save carries the current schema version (${SAVE_VERSION})`);

const rows = listSaves();
ok(rows.slot1 && rows.slot1.name === 'Desktop', 'slot list reads the desktop store');
ok(exportSlot('slot1').ok, 'export works on the desktop store');
ok(deleteSlot('slot2') === true, 'delete is safe on an empty slot');

/* ── Old saves still migrate from a file-backed store ──────────────────── */
const oldDoc = JSON.parse(doc.rotr_save_slot1);
oldDoc.meta.version = '0.9.0';
delete oldDoc.stats;
delete oldDoc.inventorySlots;
delete oldDoc.world.exploredChunks;
doc.rotr_save_slot2 = JSON.stringify(oldDoc);
const migrated = loadFromSlot('slot2');
ok(migrated.meta.version === SAVE_VERSION, 'a 0.9.0 file save migrates to current');
ok(Array.isArray(migrated.world.exploredChunks), 'migration repairs exploredChunks');
ok(typeof migrated.stats.kills === 'number', 'migration repairs run stats');

/* ── Store document parsing is defensive ──────────────────────────────── */
ok(Object.keys(parseStore(null)).length === 0, 'null document parses to empty');
ok(Object.keys(parseStore('not json')).length === 0, 'garbage document parses to empty');
ok(Object.keys(parseStore('[]')).length === 0, 'array document is rejected');
ok(parseStore('{"rotr_save_auto":"x","bad":5}').rotr_save_auto === 'x', 'string values survive');
ok(!('bad' in parseStore('{"bad":5}')), 'non-string values are dropped');

console.log(`storage: ${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} storage assertion(s) failed`);
