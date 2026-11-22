// One-off: recursive scene walk, report objects covering screen (700, 450).
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-probe5-'));
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
  await win.waitForTimeout(1500);

  const out = await win.evaluate(() => {
    const ws = window.riseGame.scene.getScene('WorldScene');
    const cam = ws.cameras.main;
    const z = cam.zoom;
    const targets = [[700, 450], [1180, 420], [300, 250]];
    const res = {};
    const all = [];
    const walk = (obj) => {
      all.push(obj);
      if (obj.list && obj.list.length) for (const c of obj.list) walk(c);
    };
    for (const c of ws.children.list) walk(c);
    for (const [sx, sy] of targets) {
      const wx = cam.scrollX + sx / z;
      const wy = cam.scrollY + sy / z;
      const hits = [];
      for (const o of all) {
        if (!o.getBounds) continue;
        const b = o.getBounds();
        if (wx < b.x || wx > b.x + b.width || wy < b.y || wy > b.y + b.height) continue;
        if (!o.visible) continue;
        hits.push({ type: o.constructor?.name, key: o.texture ? String(o.texture.key) : null,
          w: Math.round(b.width), h: Math.round(b.height), depth: Math.round(o.depth || 0),
          scale: Number((o.scaleX ?? 1).toFixed(2)), alpha: Number((o.alpha ?? 1).toFixed(2)),
          tint: o.tintTopLeft?.toString(16) });
      }
      hits.sort((a, b) => b.depth - a.depth);
      res[`${sx},${sy}`] = { w: Math.round(wx), h: Math.round(wy), hits: hits.slice(0, 4) };
    }
    res.total = all.length;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
