// Visual review capture: teleports to every landmark in the new regions and
// saves a screenshot each, for eyeballing prop density and layering.
//
// Requires the Vite dev server on :3000.
// Run: bun run world:review   (writes .review/*.jpg at quality 68 — PNGs are
// too large to attach for inspection)
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const outDir = path.resolve('.review');
fs.mkdirSync(outDir, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-review-'));

const spots = [
  ['deepwood-camp', -6480, -420],
  ['deepwood-way', -6200, -820],
  ['deepwood-thicket', -5920, -1080],
  ['deepwood-grove', -6540, -1120],
  ['deepwood-den', -6200, -1520],
  ['deepwood-between', -6050, -560],
  ['drowned-bridge', 9200, -880],
  ['drowned-causeway', 9280, -1240],
  ['drowned-ward', 9720, -1440],
  ['drowned-hall', 9620, -620],
  ['drowned-gate', 9200, -1820],
  ['drowned-between', 9260, -1000],
];

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
    await win.waitForTimeout(250);
  }
  await win.waitForFunction(() => !!window.riseGame?.scene?.getScene('WorldScene')?.player?.sprite, null, { timeout: 30000 });
  // Let the first streaming pass settle so terrain and props exist.
  await win.waitForTimeout(2500);

  for (const [name, x, y] of spots) {
    await win.evaluate(([px, py]) => window.rise.teleport(px, py), [x, y]);
    // Wait for the camera to actually be on the player (it follows with a
    // lerp, and this window renders slowly) before judging the frame.
    await win.waitForFunction(([tx, ty]) => {
      const ws = window.riseGame.scene.getScene('WorldScene');
      const cam = ws.cameras.main;
      return Math.hypot(cam.midPoint.x - tx, cam.midPoint.y - ty) < 30;
    }, [x, y], { timeout: 15000, polling: 100 }).catch(() => console.log(`  ! ${name}: camera never settled`));
    await win.waitForTimeout(500);
    await win.screenshot({ path: path.join(outDir, `${name}.jpg`), type: 'jpeg', quality: 68 });
    console.log(`${name} @${x},${y}`);
  }
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
