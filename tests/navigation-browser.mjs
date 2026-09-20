// Run explicitly: node tests/navigation-browser.mjs (requires Playwright Chromium).
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const url = server.resolvedUrls.local[0];
  assert.equal((await fetch(url)).status, 200, 'Vite HTTP readiness');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.getByRole('button', { name: 'NEW GAME', exact: true }).waitFor();
  await page.evaluate(async () => {
    const main = await import('/src/game/main.ts');
    main.startNewGame(1337, { name: 'Navigator' }, 'story');
  });
  const canvas = page.locator('#minimap-canvas');
  await canvas.waitFor();
  await page.waitForFunction(() => window.riseGame?.scene.getScene('WorldScene')?.player?.sprite);
  // Keep the player at a known origin. The scene still runs and paints naturally.
  await page.evaluate(async () => {
    window.rise.teleport(0, 0);
    const { default: state } = await import('/src/game/core/GameState.ts');
    state.notify('player', 'world');
  });
  const rect = await canvas.boundingBox();
  await canvas.click({ position: { x: rect.width * 0.75, y: rect.height * 0.5 } });
  await page.waitForFunction(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return state.session.waypoint?.x === 1100 && state.session.waypoint?.y === 0;
  });
  assert.equal(await page.locator('.navigation-arrow').textContent(), '\u2191', 'arrow is valid Unicode, not terminal mojibake');
  // Expected compass text derives from the live snapshot (the world drifts a
  // few pixels), never a hard-coded number.
  const expectedNav = await page.evaluate(async () => {
    const { navigationSnapshot } = await import('/src/game/systems/NavigationSystem.ts');
    const n = navigationSnapshot();
    return `${n.direction} · ${n.distance.toLocaleString('en-US')} units away`;
  });
  await page.locator('.navigation-card').filter({ hasText: expectedNav }).waitFor();
  // Cyan pin/line pixels confirm the scene painter consumed the target.
  await page.waitForFunction(() => {
    const c = document.getElementById('minimap-canvas');
    const pixels = c.getContext('2d').getImageData(348, 158, 24, 24).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 65 && pixels[i] < 150 && pixels[i + 1] > 170 && pixels[i + 2] > 175) return true;
    }
    return false;
  });
  await page.getByRole('button', { name: 'Clear waypoint', exact: true }).click();
  assert.equal(await page.locator('.navigation-card').count(), 0, 'clear removes compass');
  await page.evaluate(async () => {
    const { sceneCommand } = await import('/src/game/main.ts');
    sceneCommand('togglePanel', 'map');
  });
  const map = page.locator('.worldmap-canvas');
  await map.waitFor();
  const mapRect = await map.boundingBox();
  await map.click({ position: { x: mapRect.width * 0.6, y: mapRect.height * 0.4 } });
  const target = await page.evaluate(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return state.session.waypoint;
  });
  assert.ok(Math.abs(target.x - 1400) < 40 && Math.abs(target.y + 1400) < 60, 'scaled world map click converts to world coordinates');
  await page.getByRole('button', { name: 'Clear waypoint', exact: true }).last().click();
  await page.evaluate(async () => {
    const { sceneCommand } = await import('/src/game/main.ts');
    sceneCommand('togglePanel', null);
    const nav = await import('/src/game/systems/NavigationSystem.ts');
    nav.setWaypoint(1000, 0, 'Browser arrival');
    window.rise.teleport(1000, 0);
  });
  await page.getByText('Destination reached', { exact: true }).waitFor();
  assert.equal(await page.locator('.navigation-card').count(), 0, 'arrival clears target');
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('NAVIGATION BROWSER PASS — minimap click, canvas marker, compass, clear, map click and arrival.');
} finally {
  await browser?.close();
  await server.close();
}
