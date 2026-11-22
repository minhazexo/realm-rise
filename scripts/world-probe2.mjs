// One-off: which object owns the pixel under a screen point?
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-probe2-'));
const app = await electron.launch({
  args: ['.', `--user-data-dir=${userData}`],
  env: { ...process.env, ROTR_DEV_URL: 'http://localhost:3000/' },
});
try {
  const win = await app.firstWindow();
  await win.waitForSelector('text=RISE OF THE REALM', { timeout: 45000 });
  await win.click('text=NEW GAME');
  await win.click('text=SURVIVE THE STORM');
  for (let i = 0; i < 5; i++) {
    const next = win.locator('text=click to continue');
    if (await next.count()) await next.first().click({ timeout: 3000 }).catch(() => {});
    await win.waitForTimeout(200);
  }
  await win.waitForFunction(() => !!window.riseGame?.scene?.getScene('WorldScene')?.player?.sprite, null, { timeout: 30000 });
  await win.evaluate(() => window.rise.teleport(9200, -1820));
  await win.waitForTimeout(2200);

  const rows = await win.evaluate(() => {
    const ws = window.riseGame.scene.getScene('WorldScene');
    const cam = ws.cameras.main;
    const pts = [[600, 470], [1150, 430], [700, 300]];
    const res = {};
    for (const [sx, sy] of pts) {
      const wp = cam.getWorldPoint(sx, sy);
      const hits = [];
      for (const o of ws.children.list) {
        if (!o.texture || !o.getBounds) continue;
        const b = o.getBounds();
        if (wp.x < b.x || wp.x > b.x + b.width || wp.y < b.y || wp.y > b.y + b.height) continue;
        hits.push({ key: String(o.texture.key), x: Math.round(o.x), y: Math.round(o.y),
          w: Math.round(b.width), h: Math.round(b.height), depth: Math.round(o.depth || 0),
          scale: Number((o.scaleX ?? 1).toFixed(2)), tint: o.tintTopLeft?.toString(16),
          alpha: Number((o.alpha ?? 1).toFixed(2)) });
      }
      hits.sort((a, b) => b.depth - a.depth);
      res[`${sx},${sy}`] = { world: { x: Math.round(wp.x), y: Math.round(wp.y) }, hits: hits.slice(0, 6) };
    }
    return res;
  });
  console.log(JSON.stringify(rows, null, 1));
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
