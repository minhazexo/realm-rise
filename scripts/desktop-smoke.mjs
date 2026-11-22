// Desktop smoke test: launches the real Electron main process against the
// production build, proves the renderer booted through the file-backed store,
// and proves the bridge writes an atomic store document to disk.
//
// Run: bun run desktop:smoke   (after `bun run build`)
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-desktop-'));
// Seed a store document BEFORE launch: the boot log then proves the renderer
// hydrated the file before rendering the menu.
fs.writeFileSync(path.join(userData, 'store.json'),
  JSON.stringify({ rotr_probe: 'seed', rotr_save_auto: '{}' }));
const logs = [];
let failed = 0;
const ok = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failed++; console.error(`  ✗ ${label}`); }
};

// ROTR_SMOKE_EXE runs the same checks against a packaged build.
const exe = process.env.ROTR_SMOKE_EXE || '';
const app = await electron.launch({
  ...(exe ? { executablePath: exe, args: [`--user-data-dir=${userData}`] } : { args: ['.', `--user-data-dir=${userData}`] }),
  env: { ...process.env, ROTR_DEV_URL: '' },
});

try {
  const win = await app.firstWindow();
  win.on('console', (msg) => logs.push(msg.text()));
  await win.waitForSelector('text=RISE OF THE REALM', { timeout: 45000 });

  ok(true, 'game menu rendered inside the desktop shell');

  const bridge = await win.evaluate(() => ({
    present: !!window.rotrDesktop,
    load: typeof window.rotrDesktop?.loadStore,
    save: typeof window.rotrDesktop?.saveStore,
    flush: typeof window.rotrDesktop?.flushStore
  }));
  ok(bridge.present, 'preload bridge is present');
  ok(bridge.load === 'function' && bridge.save === 'function' && bridge.flush === 'function',
    'bridge exposes load/save/flush');

  ok(logs.some((l) => l.includes('[storage] desktop file store active (2 keys)')),
    'renderer hydrated the seeded store before rendering');

  const seeded = await win.evaluate(async () => {
    const raw = await window.rotrDesktop.loadStore();
    return JSON.parse(raw || '{}').rotr_probe ?? null;
  });
  ok(seeded === 'seed', 'seeded document is readable through the bridge');

  // Write through the same IPC the game uses, then read it back off disk.
  await win.evaluate(async () => {
    await window.rotrDesktop.saveStore(JSON.stringify({ rotr_probe: 'smoke', rotr_save_auto: '{}' }));
  });
  const file = path.join(userData, 'store.json');
  await new Promise((r) => setTimeout(r, 400));
  ok(fs.existsSync(file), 'store.json written to userData');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(doc.rotr_probe === 'smoke', 'written document round-trips');
  ok(fs.existsSync(`${file}.bak`), 'previous document kept as .bak');
} catch (err) {
  failed++;
  console.error('  ✗ desktop smoke threw:', err?.message || err);
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}

console.log(`desktop-smoke: ${failed === 0 ? 'PASS' : `${failed} failed`}`);
process.exit(failed === 0 ? 0 : 1);
