// One-off: isolate what draws the black arch shapes at the Keeper's Gate.
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-probe-'));
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

  const info = await win.evaluate(() => {
    const ws = window.riseGame.scene.getScene('WorldScene');
    return { zoom: ws.cameras.main.zoom, scrollX: ws.cameras.main.scrollX, scrollY: ws.cameras.main.scrollY,
      cw: ws.cameras.main.width, ch: ws.cameras.main.height };
  });
  console.log('camera', JSON.stringify(info));

  await win.screenshot({ path: '.review/probe-all.jpg', type: 'jpeg', quality: 70 });
  await win.screenshot({ path: '.review/probe-crop.jpg', type: 'jpeg', quality: 92, clip: { x: 520, y: 300, width: 520, height: 460 } });

  // Hide the ground layer: does the stone structure survive?
  await win.evaluate(() => { window.riseGame.scene.getScene('WorldScene').groundLayer.setVisible(false); });
  await win.waitForTimeout(400);
  await win.screenshot({ path: '.review/probe-noground.jpg', type: 'jpeg', quality: 70 });

  // Restore ground, hide containers (anything not a sprite/Image).
  const dumped = await win.evaluate(() => {
    const ws = window.riseGame.scene.getScene('WorldScene');
    ws.groundLayer.setVisible(true);
    const kinds = {};
    for (const o of ws.children.list) {
      const t = o.constructor?.name || '?';
      kinds[t] = (kinds[t] || 0) + 1;
    }
    for (const o of ws.children.list) {
      const t = o.constructor?.name || '';
      if (t !== 'Image' && t !== 'Sprite' && t !== 'ArcadeSprite' && t !== 'TileSprite' && t !== 'Text' && t !== 'ArcadeImage') o.setVisible(false);
    }
    // Export the chunk texture under the player so we can see what is baked in.
    const px = ws.player.sprite.x, py = ws.player.sprite.y;
    const cx = Math.floor(px / 512), cy = Math.floor(py / 512);
    const tex = ws.textures.get(`chunk_${cx}_${cy}`);
    let data = null;
    try { data = tex.getSourceImage().toDataURL?.('image/png') ?? null; } catch { data = null; }
    return { kinds, chunkKey: `chunk_${cx}_${cy}`, data };
  });
  console.log('kinds:', JSON.stringify(dumped.kinds));
  if (dumped.data) {
    const b64 = dumped.data.split(',')[1];
    fs.writeFileSync('.review/chunk-texture.png', Buffer.from(b64, 'base64'));
    console.log('chunk texture saved:', dumped.chunkKey);
  }
  await win.waitForTimeout(400);
  await win.screenshot({ path: '.review/probe-noncontainers.jpg', type: 'jpeg', quality: 70 });

  // Restore ground, hide every displayed object except entities.
  const hidden = await win.evaluate(() => {
    const ws = window.riseGame.scene.getScene('WorldScene');
    ws.groundLayer.setVisible(true);
    let n = 0;
    for (const o of ws.children.list) {
      if (o === ws.groundLayer) continue;
      if (o.constructor?.name === 'Layer') continue;
      if (!o.texture) continue;
      o.setVisible(false); n++;
    }
    return n;
  });
  console.log('hidden sprites:', hidden);
  await win.waitForTimeout(400);
  await win.screenshot({ path: '.review/probe-sprites-off.jpg', type: 'jpeg', quality: 70 });

  // Quarter-scale the ruin props: if the giant silhouette shrinks with them,
  // it is the same sprite rendering at 4x its declared frame.
  await win.evaluate(() => {
    const ws = window.riseGame.scene.getScene('WorldScene');
    for (const o of ws.children.list) if (o.texture && o.visible) o.setVisible(true);
    for (const p of ws._regions.props) {
      const k = String(p.texture.key);
      if (k === 'ruin_arch' || k === 'wall_seg') p.setScale(p.scaleX * 0.25);
    }
  });
  await win.waitForTimeout(600);
  await win.screenshot({ path: '.review/probe-quarter.jpg', type: 'jpeg', quality: 70 });
  console.log('done');
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
