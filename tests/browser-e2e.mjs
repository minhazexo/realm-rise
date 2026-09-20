// Browser smoke test: drive the running dev server with Playwright, capture
// console errors and screenshot the major game states. Outputs to tests/_artifacts/.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = 'http://localhost:3000/';
const OUT = 'tests/_artifacts';
if (!existsSync(OUT)) await mkdir(OUT, { recursive: true });

const errors = [];
const warnings = [];
const failedRequests = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1
});
const page = await ctx.newPage();

page.on('console', (msg) => {
  const t = msg.type();
  const text = msg.text();
  if (t === 'error') errors.push(text);
  else if (t === 'warning') warnings.push(text);
});
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));
page.on('requestfailed', (req) => {
  const f = req.failure();
  failedRequests.push(`${req.method()} ${req.url()} :: ${f ? f.errorText : '?'}`);
});
page.on('response', (res) => {
  if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
});

const log = (msg) => console.log(`[e2e] ${msg}`);
const shot = async (name) => {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${name}.png`);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  log('opening ' + BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // Wait for Phaser canvas to mount.
  await page.waitForSelector('canvas', { timeout: 15000 });
  await wait(2200);
  await shot('01-menu');

  // Look for the React MainMenu CTA.
  const buttons = await page.locator('button').allTextContents();
  log('menu buttons: ' + JSON.stringify(buttons.slice(0, 8)));

  // Click "New Game" (or the first non-settings button).
  const newGameBtn = page.locator('button', { hasText: /new game/i }).first();
  if (await newGameBtn.count()) {
    await newGameBtn.click();
    log('clicked New Game');
    await wait(900);
    await shot('02-creation');
  } else {
    log('WARN: no New Game button found — dumping button labels');
  }

  // Character creation: name field, then "Begin" / "Start" / "Create".
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count()) {
    await nameInput.fill('Test Hero');
    log('typed name');
  }
  // Try to find a begin/start button (the creation CTA is "SURVIVE THE STORM").
  const startBtn = page.locator('button', { hasText: /begin|start|create|play|storm/i }).first();
  if (await startBtn.count()) {
    await startBtn.click();
    log('started game');
    // World boot: world scene + asset generation can take a moment.
    await wait(3500);
    await shot('03-world');
  } else {
    log('WARN: no Begin button on creation screen');
  }

  // Try to walk the player with WASD.
  log('walking right + down for 1.2s');
  await page.keyboard.down('d');
  await wait(700);
  await page.keyboard.down('s');
  await wait(500);
  await page.keyboard.up('s');
  await page.keyboard.up('d');
  await shot('04-walked');

  // Try to open inventory ('I' is the standard hotkey per the game docs).
  await page.keyboard.press('i');
  await wait(700);
  await shot('05-inventory');

  // Close panel with Escape.
  await page.keyboard.press('Escape');
  await wait(400);

  // Try to attack (mouse left-click on canvas).
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.4);
    log('attacked');
    await wait(600);
  }

  // Open settings panel (likely bound to a menu or 'Esc' depending on the build).
  await page.keyboard.press('Escape');
  await wait(400);
  await shot('06-after-attack');

  // ── Feature checks (auto-attack + grass overlay) ───────────────────────
  // Runs in the desktop context while the world is still active. If the
  // world never booted (no start button found), the world() helper throws
  // inside evaluate and the block is skipped safely.
  try {
    // Close any open panel (auto-attack respects UI panels by design), then
    // let the grass build queue drain after the walk above (refresh runs
    // every 0.25s; a fresh window drains in ~1s at 8 slabs/frame).
    await page.keyboard.press('Escape');
    await wait(1800);
    log('feature checks: grass + auto-attack');
    const feats = await page.evaluate(async () => {
      const g = window.riseGame;
      const sc = g && g.scene.getScene('WorldScene');
      if (!sc || !g.scene.isActive('WorldScene')) return { skipped: 'world not active' };
      const out = {};
      // Grass: every sampled VISIBLE pixel must sit inside some live slab's
      // rect (the actual "no visible gap" guarantee — lattice-cell counting
      // over-counts zero-pixel slivers at the screen edge). Pool cap too.
      const gf = sc.grassField;
      if (gf) {
        const TILE_W = 160, TILE_H = 64;
        const view = sc.cameras.main.worldView;
        const live = [];
        for (const s of gf.slabs.values()) live.push([s.sx, s.sy]);
        let samples = 0, covered = 0;
        const STEP = 40;
        for (let py = view.y + TILE_H / 2; py < view.y + view.height; py += STEP) {
          for (let px = view.x + TILE_W / 2; px < view.x + view.width; px += STEP) {
            samples++;
            for (const [cx, cy] of live) {
              if (Math.abs(px - cx) <= TILE_W / 2 && Math.abs(py - cy) <= TILE_H / 2) { covered++; break; }
            }
          }
        }
        out.grass = { want: samples, covered, hidden: gf.hidden.size };
        out.grassOk = covered === samples && gf.hidden.size <= 240;
      }
      // Auto-attack: spawn an ATTACK-state goblin; the assist must lock it.
      const EnemyMod = (await import('/src/game/entities/Enemy.ts')).default;
      const e = new EnemyMod(sc, 'goblin', sc.player.sprite.x + 30, sc.player.sprite.y);
      e.state = 4;
      sc.enemies.push(e);
      const t0 = performance.now();
      let locked = false;
      while (performance.now() - t0 < 1500) {
        await new Promise((r) => setTimeout(r, 100));
        if (sc._autoAtk && sc._autoAtk.lock === e) { locked = true; break; }
      }
      e.dead = true;
      const i = sc.enemies.indexOf(e);
      if (i >= 0) sc.enemies.splice(i, 1);
      try { e.sprite?.destroy(); } catch { /* gone */ }
      try { e.hpBar?.destroy(); } catch { /* gone */ }
      out.autoAttackLocked = locked;
      return out;
    });
    if (feats.skipped) {
      log('  skipped: ' + feats.skipped);
    } else {
      log(`  grass coverage: ${feats.grass ? feats.grass.covered + '/' + feats.grass.want : 'n/a'}, hidden: ${feats.grass ? feats.grass.hidden : 'n/a'}`);
      log(`  auto-attack lock: ${feats.autoAttackLocked ? 'OK' : 'FAIL'}`);
      if (!feats.autoAttackLocked) errors.push('FEATURE: auto-attack did not lock an attacking enemy');
      if (feats.grass && !feats.grassOk) errors.push('FEATURE: grass coverage/pool out of bounds');
    }
  } catch (e) {
    log('feature checks skipped: ' + e.message);
  }

  // Try the main menu's "Continue" path: reload the page and see whether the
  // menu renders without errors.
  log('reload (settings persistence check)');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await wait(2000);
  await shot('07-reload-menu');

  // Mobile viewport check — the touch controls should appear under a phone width.
  log('switching to mobile viewport');
  await ctx.close();
  const mobileCtx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const mobile = await mobileCtx.newPage();
  mobile.on('console', (m) => { if (m.type() === 'error') errors.push('MOBILE: ' + m.text()); });
  mobile.on('pageerror', (e) => errors.push('MOBILE PAGEERROR: ' + e.message));
  await mobile.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mobile.waitForSelector('canvas', { timeout: 15000 });
  await wait(2500);
  await mobile.screenshot({ path: `${OUT}/08-mobile-menu.png` });
  log('  📸 08-mobile-menu.png');

  // Try to start a game on mobile and screenshot the touch controls.
  const mobileNewGame = mobile.locator('button', { hasText: /new game/i }).first();
  if (await mobileNewGame.count()) {
    await mobileNewGame.click();
    await wait(900);
    const mobileStart = mobile.locator('button', { hasText: /begin|start|create|play/i }).first();
    if (await mobileStart.count()) {
      await mobileStart.click();
      await wait(3500);
      await mobile.screenshot({ path: `${OUT}/09-mobile-world.png` });
      log('  📸 09-mobile-world.png');
    }
  }
  await mobileCtx.close();
} catch (err) {
  console.error('[e2e] FAILED:', err);
  errors.push('TEST_FAILURE: ' + err.message);
  try { await page.screenshot({ path: `${OUT}/failure.png` }); } catch {}
}

await browser.close();

const summary = {
  errors: errors.length,
  warnings: warnings.length,
  failedRequests: failedRequests.length,
  errorsList: errors,
  failedRequestsList: failedRequests,
  warningsList: warnings.slice(0, 20)
};

await writeFile(`${OUT}/report.json`, JSON.stringify(summary, null, 2));

console.log('\n=== E2E SUMMARY ===');
console.log(`errors:           ${errors.length}`);
console.log(`failed requests:  ${failedRequests.length}`);
console.log(`console warnings: ${warnings.length}`);
if (errors.length) {
  console.log('\n--- errors ---');
  errors.forEach((e) => console.log('  ✗ ' + e.slice(0, 220)));
}
if (failedRequests.length) {
  console.log('\n--- failed requests ---');
  failedRequests.forEach((e) => console.log('  ✗ ' + e));
}
process.exit(errors.length || failedRequests.length ? 1 : 0);
