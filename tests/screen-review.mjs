// Comprehensive screen capture: visit every reachable UI state and screenshot it.
// Output: tests/_artifacts/screen-review/*.png + an INDEX.md of the labels.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:3000/';
const OUT = 'tests/_artifacts/screen-review';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[review] ${msg}`);

const shots = [];
async function shot(label) {
  const file = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const path = `${OUT}/${file}.png`;
  await page.screenshot({ path, fullPage: false });
  shots.push({ label, file: `${file}.png` });
  log('  📸 ' + label);
}

try {
  log('opening ' + BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await wait(2500);
  await shot('01 main menu');

  // Settings panel
  const settingsBtn = page.locator('button', { hasText: /^settings$/i }).first();
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await wait(700);
    await shot('02 settings panel');
    await page.keyboard.press('Escape');
    await wait(400);
  }

  // Credits / how-to (whatever other links exist on the menu)
  for (const label of ['credits', 'how to play', 'how to']) {
    const b = page.locator('button, a', { hasText: new RegExp(label, 'i') }).first();
    if (await b.count()) {
      await b.click();
      await wait(700);
      await shot(`03 ${label}`);
      await page.keyboard.press('Escape');
      await wait(400);
    }
  }

  // New Game
  const newGame = page.locator('button', { hasText: /new game/i }).first();
  if (await newGame.count()) {
    await newGame.click();
    await wait(900);
    await shot('04 character creation');

    // Try to find a class picker (warrior/mage/etc)
    const classBtns = await page.locator('button').allTextContents();
    log('creation buttons: ' + JSON.stringify(classBtns.slice(0, 12)));

    // Pick the first non-start button
    const firstPick = page.locator('.creation-root button, .character-creation button').first();
    if (await firstPick.count()) {
      // Don't click start - we want to capture the panel
    }

    // Fill name and start
    const nameInput = page.locator('input[type="text"]').first();
    if (await nameInput.count()) await nameInput.fill('Test Hero');

    const startBtn = page.locator('button', { hasText: /begin|start|create|play/i }).first();
    if (await startBtn.count()) {
      await startBtn.click();
      await wait(3500);
      await shot('05 world initial');
    }
  }

  // Walk around
  await page.keyboard.down('d');
  await wait(800);
  await page.keyboard.up('d');
  await shot('06 world walked right');

  await page.keyboard.down('w');
  await wait(600);
  await page.keyboard.up('w');
  await shot('07 world walked up');

  // Open inventory
  await page.keyboard.press('i');
  await wait(700);
  await shot('08 inventory panel');
  await page.keyboard.press('Escape');
  await wait(400);

  // Equipment
  await page.keyboard.press('e');
  await wait(600);
  await shot('09 equipment panel');
  await page.keyboard.press('Escape');
  await wait(400);

  // Character / stats
  await page.keyboard.press('c');
  await wait(600);
  await shot('10 character panel');
  await page.keyboard.press('Escape');
  await wait(400);

  // Map
  await page.keyboard.press('m');
  await wait(600);
  await shot('11 map panel');
  await page.keyboard.press('Escape');
  await wait(400);

  // Quest log
  await page.keyboard.press('j');
  await wait(600);
  await shot('12 quest log');
  await page.keyboard.press('Escape');
  await wait(400);

  // Crafting
  await page.keyboard.press('k');
  await wait(600);
  await shot('13 crafting panel');
  await page.keyboard.press('Escape');
  await wait(400);

  // Settings (in-world)
  await page.keyboard.press('Escape');
  await wait(500);
  await shot('14 escape menu');

  // Try to attack
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.4);
    await wait(400);
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await wait(400);
  }
  await shot('15 after attacks');

  // Try dialogue (move near an NPC if possible) - we'll just capture current
  await page.keyboard.press('f');
  await wait(500);
  await shot('16 interact attempt');

  // Mobile viewport
  await ctx.close();
  const mctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true, hasTouch: true
  });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => errs.push('MOBILE PAGEERROR: ' + e.message));
  m.on('console', (msg) => { if (msg.type() === 'error') errs.push('MOBILE CONSOLE: ' + msg.text()); });
  await m.goto(BASE, { waitUntil: 'domcontentloaded' });
  await m.waitForSelector('canvas', { timeout: 15000 });
  await wait(2500);
  await m.screenshot({ path: `${OUT}/20-mobile-menu.png` });
  shots.push({ label: '20 mobile menu', file: '20-mobile-menu.png' });
  log('  📸 20 mobile menu');

  // Mobile new game
  const mNew = m.locator('button', { hasText: /new game/i }).first();
  if (await mNew.count()) {
    await mNew.click();
    await wait(900);
    await m.screenshot({ path: `${OUT}/21-mobile-creation.png` });
    shots.push({ label: '21 mobile creation', file: '21-mobile-creation.png' });
    log('  📸 21 mobile creation');

    const mName = m.locator('input[type="text"]').first();
    if (await mName.count()) await mName.fill('Mobile');
    const mStart = m.locator('button', { hasText: /begin|start|create|play/i }).first();
    if (await mStart.count()) {
      await mStart.click();
      await wait(3500);
      await m.screenshot({ path: `${OUT}/22-mobile-world.png` });
      shots.push({ label: '22 mobile world with touch controls', file: '22-mobile-world.png' });
      log('  📸 22 mobile world');
    }
  }
  await mctx.close();
} catch (err) {
  console.error('[review] FAILED:', err);
  errs.push('TEST_FAILURE: ' + err.message);
}

await browser.close();

await writeFile(`${OUT}/INDEX.md`, shots.map(s => `- ${s.label} → \`${s.file}\``).join('\n') + '\n\n## Console errors\n' + (errs.length ? errs.map(e => '- ' + e).join('\n') : '_(none)_'));

console.log('\n=== ERRORS ===');
if (errs.length) errs.forEach((e) => console.log('  ✗', e.slice(0, 200)));
else console.log('  (none)');
console.log('\nshots: ' + shots.length);
process.exit(errs.length ? 1 : 0);
