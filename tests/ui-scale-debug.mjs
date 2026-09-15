// Debug: log what the slider sees when we change it.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => console.log(`[browser:${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForTimeout(1500);

// Open settings.
const settingsBtn = page.locator('button', { hasText: /^settings$/i }).first();
if (await settingsBtn.count()) {
  await settingsBtn.click();
  await page.waitForTimeout(500);
}

// What sliders exist?
const sliders = await page.evaluate(() => {
  const panel = document.querySelector('.settings-panel');
  if (!panel) return { error: 'no panel' };
  const ranges = panel.querySelectorAll('input[type="range"]');
  return {
    count: ranges.length,
    items: Array.from(ranges).map((r) => ({
      value: r.value,
      min: r.min, max: r.max, step: r.step
    }))
  };
});
console.log('sliders found:', JSON.stringify(sliders, null, 2));

// Try clicking the first slider and using keyboard.
const firstSlider = page.locator('.settings-panel input[type="range"]').first();
await firstSlider.focus();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
const afterKb = await page.evaluate(() => {
  const root = document.getElementById('root');
  return {
    uiScaleVar: getComputedStyle(root).getPropertyValue('--ui-scale').trim(),
    wrapperInline: document.querySelector('.ui-scale-wrapper')?.style.zoom || ''
  };
});
console.log('after keyboard arrows:', afterKb);

await browser.close();
