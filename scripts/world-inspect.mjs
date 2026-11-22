// One-off diagnostics: dump what is actually rendered around a point, and how
// fast chunks stream after a long teleport.
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'rotr-inspect-'));
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
  await win.waitForTimeout(2000);

  const dump = async (label, x, y) => {
    await win.evaluate(([px, py]) => window.rise.teleport(px, py), [x, y]);
    const samples = [];
    for (const ms of [250, 750, 1500, 3000]) {
      await win.waitForTimeout(ms);
      samples.push(await win.evaluate(() => {
        const ws = window.riseGame.scene.getScene('WorldScene');
        return { chunks: ws.activeChunks.size, t: performance.now() | 0 };
      }));
    }
    const objects = await win.evaluate(() => {
      const ws = window.riseGame.scene.getScene('WorldScene');
      const px = ws.player.sprite.x, py = ws.player.sprite.y;
      const near = [];
      for (const o of ws.children.list) {
        if (!o.texture || !o.x) continue;
        const d = Math.hypot(o.x - px, o.y - py);
        if (d > 520) continue;
        near.push({
          key: String(o.texture.key), d: Math.round(d), depth: o.depth,
          w: Math.round(o.displayWidth || 0), h: Math.round(o.displayHeight || 0),
          tint: o.tintTopLeft?.toString(16), alpha: Number(o.alpha?.toFixed(2)),
          band: o.getData?.('band') ?? null,
        });
      }
      const counts = {};
      for (const o of near) counts[o.key] = (counts[o.key] || 0) + 1;
      near.sort((a, b) => b.w * b.h - a.w * a.h);
      return { counts, biggest: near.slice(0, 12) };
    });
    console.log(`\n=== ${label} (${x},${y})`);
    console.log('chunks over time:', JSON.stringify(samples));
    console.log('counts:', JSON.stringify(objects.counts));
    console.log('largest:', JSON.stringify(objects.biggest, null, 0));
  };

  const all = async (label, x, y) => {
    await win.evaluate(([px, py]) => window.rise.teleport(px, py), [x, y]);
    await win.waitForTimeout(1800);
    const rows = await win.evaluate(() => {
      const ws = window.riseGame.scene.getScene('WorldScene');
      const px = ws.player.sprite.x, py = ws.player.sprite.y;
      const out = [];
      for (const o of ws.children.list) {
        const d = Math.hypot((o.x || 0) - px, (o.y || 0) - py);
        if (d > 520 || !(o.displayWidth > 60 || o.displayHeight > 60)) continue;
        out.push({
          type: o.constructor?.name, key: o.texture ? String(o.texture.key) : null,
          d: Math.round(d), w: Math.round(o.displayWidth || 0), h: Math.round(o.displayHeight || 0),
          depth: Math.round(o.depth || 0), alpha: Number((o.alpha ?? 1).toFixed(2)),
          tint: o.tintTopLeft != null ? o.tintTopLeft.toString(16) : null,
        });
      }
      out.sort((a, b) => b.w * b.h - a.w * a.h);
      return out.slice(0, 16);
    });
    console.log(`\n### ${label}`);
    for (const r of rows) console.log(JSON.stringify(r));
  };
  const odd = async (label, x, y) => {
    await win.evaluate(([px, py]) => window.rise.teleport(px, py), [x, y]);
    await win.waitForTimeout(1800);
    const rows = await win.evaluate(() => {
      const ws = window.riseGame.scene.getScene('WorldScene');
      const px = ws.player.sprite.x, py = ws.player.sprite.y;
      const out = [];
      for (const o of ws.children.list) {
        const d = Math.hypot((o.x || 0) - px, (o.y || 0) - py);
        if (d > 700) continue;
        const t = o.constructor?.name;
        if (t === 'Image' || t === 'TileSprite' || t === 'Sprite' || t === 'Text') continue;
        out.push({ type: t, key: o.texture ? String(o.texture.key) : null, d: Math.round(d),
          w: Math.round(o.displayWidth || 0), h: Math.round(o.displayHeight || 0),
          depth: Math.round(o.depth || 0), alpha: Number((o.alpha ?? 1).toFixed(2)),
          children: o.list ? o.list.length : 0 });
      }
      return out.slice(0, 20);
    });
    console.log(`\n### ${label} non-image children`);
    for (const r of rows) console.log(JSON.stringify(r));
  };
  const wide = async (label, x, y) => {
    await win.evaluate(([px, py]) => window.rise.teleport(px, py), [x, y]);
    await win.waitForTimeout(1800);
    const rows = await win.evaluate(() => {
      const ws = window.riseGame.scene.getScene('WorldScene');
      const px = ws.player.sprite.x, py = ws.player.sprite.y;
      const out = [];
      for (const o of ws.children.list) {
        if (!o.texture) continue;
        const w = o.displayWidth || 0, h = o.displayHeight || 0;
        if (w < 120 && h < 120) continue;
        const d = Math.hypot((o.x || 0) - px, (o.y || 0) - py);
        if (d > 1200) continue;
        out.push({ type: o.constructor?.name, key: String(o.texture.key), x: Math.round(o.x), y: Math.round(o.y),
          w: Math.round(w), h: Math.round(h), depth: Math.round(o.depth || 0),
          alpha: Number((o.alpha ?? 1).toFixed(2)), tint: o.tintTopLeft?.toString(16) });
      }
      out.sort((a, b) => b.w * b.h - a.w * a.h);
      return out.slice(0, 14);
    });
    console.log(`\n### ${label} wide images`);
    for (const r of rows) console.log(JSON.stringify(r));
  };
  await wide('Keeper Gate', 9200, -1820);
  await wide('Toll Bridge', 9200, -880);
} finally {
  await app.close().catch(() => {});
  fs.rmSync(userData, { recursive: true, force: true });
}
