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
    return !!state.session.waypoint;
  });
  // A click 25% right of the minimap centre charts a target ~1100px east of the
  // player at the default 2200px radius. Asserted with a tolerance on purpose:
  // the browser reports the click in sub-pixel CSS space, so pinning the exact
  // pixel would be pinning the stylesheet, not the rule.
  const charted = await page.evaluate(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return state.session.waypoint;
  });
  assert.ok(charted.x > 1000 && charted.x < 1200, `minimap click charts a target east of the player (got ${charted.x})`);
  assert.ok(Math.abs(charted.y) < 80, `minimap click keeps the target on the player's latitude (got ${charted.y})`);
  assert.equal(await page.locator('.navigation-arrow').textContent(), '\u2191', 'arrow is valid Unicode, not terminal mojibake');
  // Expected compass text derives from the live snapshot (the world drifts a
  // few pixels), never a hard-coded number.
  const expectedNav = await page.evaluate(async () => {
    const { navigationSnapshot } = await import('/src/game/systems/world/NavigationSystem.ts');
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
  const waypointAt = () => page.evaluate(async () =>
    (await import('/src/game/core/GameState.ts')).default.session.waypoint);
  // The click→world mapping is MEASURED here (two clicks per axis), so the
  // assertion is the rule itself — linear, and the same radius on both axes up
  // to the canvas aspect — instead of whatever centre the frame happened to
  // open on. Staying away from the middle matters: charting the point you are
  // standing on is an arrival, and arrival CLEARS the waypoint.
  const mapRect = await map.boundingBox();
  const clickAt = async (u, v) => {
    await map.click({ position: { x: mapRect.width * u, y: mapRect.height * v } });
    await page.waitForTimeout(120);
    return waypointAt();
  };
  const west = await clickAt(0.35, 0.5);
  const east = await clickAt(0.65, 0.5);
  const north = await clickAt(0.5, 0.35);
  const south = await clickAt(0.5, 0.65);
  const { radius: viewRadius, live } = await page.evaluate(async () => {
    const { MAP_VIEW_RADIUS } = await import('/src/game/systems/world/NavigationSystem.ts');
    const { default: state } = await import('/src/game/core/GameState.ts');
    const v = state.session.viewRect;
    return { radius: MAP_VIEW_RADIUS, live: v ? { x: v.x + v.w / 2, y: v.y + v.h / 2 } : { x: state.s.world.px, y: state.s.world.py } };
  });
  const measuredRadiusX = (east.x - west.x) / (2 * (0.65 - 0.35));
  const measuredRadiusY = (south.y - north.y) / (2 * (0.65 - 0.35));
  const centreX = (east.x + west.x) / 2;
  const centreY = (south.y + north.y) / 2;
  assert.ok(Math.abs(measuredRadiusX - viewRadius) < viewRadius * 0.05,
    `the world map opens at MAP_VIEW_RADIUS (measured ${Math.round(measuredRadiusX)} vs ${viewRadius})`);
  assert.ok(Math.abs(measuredRadiusX / measuredRadiusY - mapRect.width / mapRect.height) < 0.05,
    `both axes share one scale, so the canvas aspect is never squashed (${(measuredRadiusX / measuredRadiusY).toFixed(2)} vs ${(mapRect.width / mapRect.height).toFixed(2)})`);
  assert.ok(Math.hypot(centreX - live.x, centreY - live.y) < 600,
    `the map opens on the player (frame centre ${Math.round(centreX)},${Math.round(centreY)} vs camera ${Math.round(live.x)},${Math.round(live.y)})`);
  // …and a click off-centre charts exactly the world point under the cursor.
  const target = await clickAt(0.6, 0.4);
  const expectX = centreX + (0.6 - 0.5) * 2 * measuredRadiusX;
  const expectY = centreY + (0.4 - 0.5) * 2 * measuredRadiusY;
  assert.ok(Math.abs(target.x - expectX) < 40 && Math.abs(target.y - expectY) < 60,
    `world map click charts the world point under the cursor (got ${target.x},${target.y}, expected ~${Math.round(expectX)},${Math.round(expectY)})`);
  await page.getByRole('button', { name: 'Clear waypoint', exact: true }).last().click();
  await page.evaluate(async () => {
    const { sceneCommand } = await import('/src/game/main.ts');
    sceneCommand('togglePanel', null);
    const nav = await import('/src/game/systems/world/NavigationSystem.ts');
    nav.setWaypoint(1000, 0, 'Browser arrival');
    window.rise.teleport(1000, 0);
  });
  await page.getByText('Destination reached', { exact: true }).waitFor();
  assert.equal(await page.locator('.navigation-card').count(), 0, 'arrival clears target');

  // Region fast travel: standing in a region unlocks its waypoint, and the World
  // Map can put the player back on it (RegionTravel → sceneDelegate → movePlayer).
  const unlocked = await page.evaluate(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return [...state.s.world.unlockedFastTravel];
  });
  assert.ok(unlocked.includes('ashen_frontier'), 'standing in a region unlocks its travel point');
  await page.evaluate(async () => {
    const { sceneCommand } = await import('/src/game/main.ts');
    sceneCommand('togglePanel', 'map');
  });
  await map.waitFor();
  const travel = page.getByRole('button', { name: 'Travel to Ashen Village', exact: true });
  await travel.waitFor();
  await travel.click();
  await page.waitForFunction(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return Math.abs(state.s.world.px + 90) < 2 && Math.abs(state.s.world.py - 330) < 2;
  });
  const landed = await page.evaluate(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    return { px: state.s.world.px, py: state.s.world.py };
  });
  assert.deepEqual(landed, { px: -90, py: 330 }, `fast travel lands on the region waypoint (got ${landed.px},${landed.py})`);
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('NAVIGATION BROWSER PASS — minimap click, canvas marker, compass, clear, map click and arrival.');
} finally {
  await browser?.close();
  await server.close();
}
