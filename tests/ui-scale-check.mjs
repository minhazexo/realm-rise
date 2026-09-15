// Verify UI scale slider works end-to-end.
// 1. Open the game and navigate to Settings.
// 2. Read the .ui-scale-wrapper state at default 1.0.
// 3. Drag the UI scale slider to 1.4 and 0.8 and confirm the wrapper reflects
//    the change in the `--ui-scale` CSS variable on #root and the inline
//    `zoom` style on the wrapper.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = 'http://localhost:3000/';
const OUT = 'tests/_artifacts';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(1500);

async function openSettings() {
  const settingsBtn = page.locator('button', { hasText: /^settings$/i }).first();
  if (await settingsBtn.count()) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
  }
}

async function readState() {
  return await page.evaluate(() => {
    const w = document.querySelector('.ui-scale-wrapper');
    if (!w) return { found: false };
    return {
      found: true,
      computedZoom: getComputedStyle(w).zoom,
      inlineZoom: w.style.zoom,
      uiScaleVar: getComputedStyle(document.getElementById('root')).getPropertyValue('--ui-scale').trim(),
      textScaleVar: getComputedStyle(document.getElementById('root')).getPropertyValue('--text-scale').trim(),
      width: w.offsetWidth,
      height: w.offsetHeight
    };
  });
}

// UI scale is the range input with min=0.8, max=1.4 (text size has max=1.4 too
// but min=0.85, so UI scale is the one with min=0.8).
async function setUiScale(val) {
  const ok = await page.evaluate((v) => {
    const panel = document.querySelector('.settings-panel');
    if (!panel) return 'no-panel';
    const sliders = panel.querySelectorAll('input[type="range"]');
    let target = null;
    for (const s of sliders) {
      if (s.min === '0.8' && s.max === '1.4') { target = s; break; }
    }
    if (!target) return 'no-target';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(target, String(v));
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  }, val);
  if (ok !== 'ok') throw new Error('setUiScale: ' + ok);
  await page.waitForTimeout(250);
}

await openSettings();
const s1 = await readState();
console.log('initial:', s1);
await page.screenshot({ path: `${OUT}/ui-scale-1.0.png` });

if (!s1.found) { console.log('FAIL: ui-scale-wrapper not in DOM'); process.exit(1); }

await setUiScale(1.4);
const s2 = await readState();
console.log('at 1.4:', s2);
await page.screenshot({ path: `${OUT}/ui-scale-1.4.png` });

await setUiScale(0.8);
const s3 = await readState();
console.log('at 0.8:', s3);
await page.screenshot({ path: `${OUT}/ui-scale-0.8.png` });

await setUiScale(1);
const s4 = await readState();
console.log('back to 1.0:', s4);

console.log('\n=== ERRORS ===');
errs.forEach((e) => console.log('  ✗', e.slice(0, 200)));

const ok =
  s1.uiScaleVar === '1' &&
  s2.uiScaleVar === '1.4' &&
  s3.uiScaleVar === '0.8' &&
  s4.uiScaleVar === '1' &&
  s1.inlineZoom === '' &&
  s2.inlineZoom === '1.4' &&
  s3.inlineZoom === '0.8' &&
  s4.inlineZoom === '1';

console.log(`\nui-scale CSS var tracks slider: ${s1.uiScaleVar} → ${s2.uiScaleVar} → ${s3.uiScaleVar} → ${s4.uiScaleVar}`);
console.log(`wrapper inline zoom tracks slider: '${s1.inlineZoom}' → '${s2.inlineZoom}' → '${s3.inlineZoom}' → '${s4.inlineZoom}'`);
console.log(`\noverall: ${ok ? '✓ PASS' : '✗ FAIL'}`);

await browser.close();
process.exit(errs.length || !ok ? 1 : 0);
