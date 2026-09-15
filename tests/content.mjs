// Content validation tests: every data-driven reference must resolve.
// Fails the build on dangling IDs (items, loot, recipes, nodes, quests...).
import { validateContent } from '../src/game/core/validateContent.ts';
import { Registry } from '../src/game/core/Registry.ts';

let fails = 0;
const ok = (c, m) => {
  if (!c) { fails++; console.error('✗ ' + m); }
  else console.log('✓ ' + m);
};

console.log('— Registry unit behavior —');
// Duplicates throw instead of silently winning.
const r = new Registry('test', { required: ['name'] });
r.define('a', { name: 'A' });
let threw = false;
try { r.define('a', { name: 'A2' }); } catch { threw = true; }
ok(threw, 'duplicate id throws');
// Bad IDs throw.
threw = false;
try { r.define('bad id!', { name: 'x' }); } catch { threw = true; }
ok(threw, 'invalid id throws');
// Missing required fields throw.
threw = false;
try { r.define('b', {}); } catch { threw = true; }
ok(threw, 'missing required field throws');
// get() misses return null; require() misses throw.
ok(r.get('nope') === null, 'get() miss returns null');
threw = false;
try { r.require('nope'); } catch { threw = true; }
ok(threw, 'require() miss throws');
// defineSources rejects cross-file collisions.
const r2 = new Registry('test2');
threw = false;
try { r2.defineSources({ fileA: { x: {} }, fileB: { x: {} } }); } catch { threw = true; }
ok(threw, 'cross-source collision throws');
ok(r2.size === 1, 'first definition wins on collision');

console.log('— Cross-domain content validation —');
const { errors, warnings } = validateContent();
for (const w of warnings.slice(0, 10)) console.log(`  ! warn: ${w}`);
if (warnings.length > 10) console.log(`  ! ... +${warnings.length - 10} more warnings`);
ok(errors.length === 0, `no dangling content references (${errors.length} errors)`);
for (const e of errors.slice(0, 15)) console.error('  ✗ ' + e);

console.log(fails === 0 ? '✅ CONTENT PASS — registries strict, references resolve.' : `❌ ${fails} content failure(s)`);
process.exit(fails ? 1 : 0);
