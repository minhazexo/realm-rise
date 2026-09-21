// Run: node tests/item-art-browser.mjs (requires Playwright Chromium).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().includes('/assets/items/') && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole('button', { name: 'NEW GAME', exact: true }).waitFor();
  await page.evaluate(async () => {
    const main = await import('/src/game/main.ts');
    main.startNewGame(1337, { name: 'Art review' }, 'story');
  });
  await page.waitForFunction(() => window.riseGame?.scene.getScene('WorldScene')?.player?.sprite);
  const result = await page.evaluate(async () => {
    const { ITEMS } = await import('/src/game/data/items.ts');
    const { ITEM_ARTWORK, itemArtworkKey } = await import('/src/game/assets/itemArtwork.ts');
    const { iconDataURLs, buildItemIcons } = await import('/src/game/assets/icons.ts');
    const scene = window.riseGame.scene.getScene('WorldScene');
    const atlas = scene.textures.get('item_icons');
    const ctx = atlas.getSourceImage().getContext('2d');
    const failures = [];
    for (const id of Object.keys(ITEMS)) {
      const frame = atlas.get(`${id}_frame`);
      if (frame.width !== 34 || frame.height !== 34) failures.push(`${id}: frame size`);
      const pixels = ctx.getImageData(frame.cutX, frame.cutY, 34, 34).data;
      if (!pixels.some((v, i) => i % 4 === 3 && v > 0)) failures.push(`${id}: blank`);
      if (!iconDataURLs[id]?.startsWith('data:image/png')) failures.push(`${id}: UI image missing`);
      if (ITEM_ARTWORK[id]) {
        if (!scene.textures.exists(itemArtworkKey(id))) { failures.push(`${id}: source missing`); continue; }
        const source = document.createElement('canvas');
        source.width = source.height = 34;
        const sc = source.getContext('2d');
        sc.drawImage(scene.textures.get(itemArtworkKey(id)).getSourceImage(), 0, 0);
        const expected = sc.getImageData(0, 0, 34, 34).data;
        if (!pixels.every((v, i) => v === expected[i])) failures.push(`${id}: source/atlas mismatch`);
      }
    }
    const firstURL = iconDataURLs.axe_iron;
    buildItemIcons(scene);
    if (iconDataURLs.axe_iron !== firstURL) failures.push('idempotence');
    const { default: state } = await import('/src/game/core/GameState.ts');
    const { addItem } = await import('/src/game/systems/InventorySystem.ts');
    for (const id of ['axe_stone', 'axe_iron', 'axe_steel', 'iron_sword', 'short_bow', 'healing_salve', 'raw_fish']) addItem(id, 1);
    state.session.uiPanel = 'inventory';
    state.session.paused = true;
    state.notify('screen', 'inventory');
    return { failures, mapped: Object.keys(ITEM_ARTWORK).length, total: Object.keys(ITEMS).length };
  });
  assert.deepEqual(result.failures, []);
  await page.locator('.inventory-panel').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.inventory-panel img')].every(i => i.complete && i.naturalWidth === 34));
  await mkdir('tests/_artifacts', { recursive: true });
  await page.screenshot({ path: 'tests/_artifacts/item-art-inventory.png' });
  await page.evaluate(async () => {
    const { default: state } = await import('/src/game/core/GameState.ts');
    state.session.uiPanel = 'crafting';
    state.notify('screen');
  });
  await page.locator('.crafting-panel').waitFor();
  await page.screenshot({ path: 'tests/_artifacts/item-art-crafting.png' });
  assert.deepEqual(errors, []);
  console.log(`Item artwork PASS: ${result.mapped} imported icons, ${result.total} nonblank atlas/UI entries; inventory + crafting screenshots saved.`);
} finally {
  await browser?.close();
  await server.close();
}
