// Temp probe (delete after use): does the World Map's fast travel button work
// end to end in a real browser — unlock on arrival, click, land on the waypoint?
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const report = { steps: [] };
const step = (name, value) => { report.steps.push({ name, value }); };

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const url = server.resolvedUrls.local[0];
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.getByRole('button', { name: 'NEW GAME', exact: true }).waitFor();
  await page.evaluate(async () => {
    const main = await import('/src/game/main.ts');
    main.startNewGame(1337, { name: 'Traveller' }, 'story');
  });
  await page.waitForFunction(() => window.riseGame?.scene.getScene('WorldScene')?.player?.sprite);
  step('unlocked after arrival', await page.evaluate(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return [...state.s.world.unlockedFastTravel];
  }));
  // Open the World Map and click the waypoint's own travel button.
  await page.evaluate(async () => {
    const { sceneCommand } = await import('/src/game/main.ts');
    sceneCommand('togglePanel', 'map');
  });
  const travel = page.getByRole('button', { name: 'Travel to Ashen Village', exact: true });
  await travel.waitFor({ timeout: 8000 });
  step('travel button rendered', true);
  await travel.click({ timeout: 8000 });
  step('landed', await page.evaluate(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return { px: state.s.world.px, py: state.s.world.py };
  }));
  step('errors', errors);
} catch (e) {
  step('failed', String(e).split('\n').slice(0, 3).join(' | '));
} finally {
  try { await browser?.close(); } catch { /* crash */ }
  await server.close();
  writeFileSync('tmp-travel-probe.json', JSON.stringify(report, null, 2));
}
