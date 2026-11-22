// One-off: top-level display list at the Keeper's Gate.
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-probe4-'));
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

  const rows = await win.evaluate(() => {
    const ws = window.riseGame.scene.getScene('WorldScene');
    const out = [];
    for (const p of ws._regions.props) {
      if (!p || !p.active) continue;
      const k = String(p.texture.key);
      if (k !== 'ruin_arch' && k !== 'wall_seg' && k !== 'cage_frame') continue;
      out.push({ key: k, x: Math.round(p.x), y: Math.round(p.y),
        frame: [p.frame.width, p.frame.height], tex: [p.texture.source[0].width, p.texture.source[0].height],
        display: [Math.round(p.displayWidth), Math.round(p.displayHeight)], scale: p.scaleX });
    }
    return out;
  });
  console.log(JSON.stringify(rows, null, 1));
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
