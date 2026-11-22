// One-off: what is inside the ground layer?
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-probe3-'));
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
    const px = ws.player.sprite.x, py = ws.player.sprite.y;
    const out = [];
    for (const o of ws.groundLayer.list) {
      const d = Math.hypot((o.x || 0) - px, (o.y || 0) - py);
      if (d > 900) continue;
      out.push({ type: o.constructor?.name, key: o.texture ? String(o.texture.key) : null,
        x: Math.round(o.x), y: Math.round(o.y), w: Math.round(o.displayWidth || 0),
        h: Math.round(o.displayHeight || 0), alpha: Number((o.alpha ?? 1).toFixed(2)) });
    }
    return { count: ws.groundLayer.list.length, near: out.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 10) };
  });
  console.log(JSON.stringify(rows, null, 1));
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
