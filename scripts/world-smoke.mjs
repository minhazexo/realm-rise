// World smoke test: drives the real game in a visible Electron window and
// checks that the authored regions stream, tick and cull.
//
// The in-app browser tab used for screenshots can be hidden, and Phaser pauses
// its loop on hidden documents — so streaming can only be verified in a window
// that is actually rendering. Requires the Vite dev server on :3000.
//
// Run: bun run dev (one shell)  then  bun run world:smoke
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-world-'));
let failed = 0;
const ok = (cond, label) => { if (cond) console.log(`  ✓ ${label}`); else { failed++; console.error(`  ✗ ${label}`); } };

const app = await electron.launch({
  args: ['.', `--user-data-dir=${userData}`],
  env: { ...process.env, ROTR_DEV_URL: 'http://localhost:3000/' },
});

try {
  const win = await app.firstWindow();
  const errors = [];
  win.on('pageerror', (e) => errors.push(String(e?.message || e)));

  await win.waitForSelector('text=RISE OF THE REALM', { timeout: 45000 });
  await win.click('text=NEW GAME');
  await win.click('text=SURVIVE THE STORM');
  for (let i = 0; i < 5; i++) {
    const next = win.locator('text=click to continue');
    if (await next.count()) await next.first().click({ timeout: 3000 }).catch(() => {});
    await win.waitForTimeout(250);
  }

  await win.waitForFunction(() => !!window.riseGame?.scene?.getScene('WorldScene')?.player?.sprite, null, { timeout: 30000 });
  ok(true, 'world scene reached create() with a player');

  const enter = async (x, y) => {
    await win.evaluate(([px, py]) => window.rise.teleport(px, py), [x, y]);
    await win.waitForTimeout(1800);
    return win.evaluate(() => {
      const ws = window.riseGame.scene.getScene('WorldScene');
      const reg = ws._regions;
      return {
        area: reg?.currentArea ?? '',
        placed: reg ? [...reg.placed] : [],
        props: reg?.props.length ?? 0,
        visibleProps: reg ? reg.props.filter((p) => p.visible).length : 0,
        chunks: ws.activeChunks.size,
        enemies: ws.enemies.length,
        visibleEnemies: ws.enemies.filter((e) => e.sprite && e.sprite.visible).length,
      };
    });
  };

  const deepwood = await enter(-6200, -800);
  ok(deepwood.chunks > 0, `chunks stream around the Deepwood (${deepwood.chunks})`);
  ok(deepwood.placed.includes('clan_camp'), 'the Deepwood camp area is built');
  ok(deepwood.props > 20, `landmark props are placed (${deepwood.props})`);
  ok(deepwood.visibleProps > 0 && deepwood.visibleProps < deepwood.props,
    `props are view-culled (${deepwood.visibleProps}/${deepwood.props} visible)`);

  const drowned = await enter(9200, -880);
  ok(drowned.placed.includes('toll_bridge'), 'the Drowned Reach bridge area is built');
  ok(drowned.props > 20, `Drowned Reach props are placed (${drowned.props})`);

  ok(errors.length === 0, `no page errors (${errors.join(' | ') || 'none'})`);
} catch (err) {
  failed++;
  console.error('  ✗ world smoke threw:', err?.message || err);
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}

console.log(`world-smoke: ${failed === 0 ? 'PASS' : `${failed} failed`}`);
process.exit(failed === 0 ? 0 : 1);
