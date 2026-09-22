// Tests for ScreenOverlays — the single owner of screen-space overlays.
//
// Why this exists: Phaser applies camera zoom to scrollFactor(0) objects too
// (scrollFactor removes parallax, not zoom), so a full-screen overlay sized to
// the canvas used to render as a centred rectangle covering zoom×100 % of the
// viewport — night in the forest was a hard-edged dark box. The layer cancels
// zoom by placing a container at the camera midpoint with scale 1/zoom. These
// tests fix that contract, plus the two defects found while proving it live: the
// prune that never ran (Phaser 4 has no `.destroyed`) and the prune that sat
// behind the zoom/size early-return.
import assert from 'node:assert/strict';
import {
  screenFit, layerLocal, screenPoint, isDestroyed,
  addScreenOverlay, fitScreenLayer,
} from '../src/game/systems/ScreenOverlays.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('✗ ' + m); } else console.log('✓ ' + m); };

// ── Fake overlay object (records what the layer asked of it) ────────────────
function makeOverlay({ originX = 0, originY = 0 } = {}) {
  const o = {
    originX, originY, x: 0, y: 0, displayWidth: 0, displayHeight: 0, active: true,
    setPosition(x, y) { o.x = x; o.y = y; return o; },
    setDisplaySize(w, h) { o.displayWidth = w; o.displayHeight = h; return o; },
    setSize(w, h) { o.displayWidth = w; o.displayHeight = h; return o; },
    destroy() { o.active = false; },
    // Screen rect: the layer's local space IS screen space translated by the
    // midpoint, so this is where the overlay lands on screen.
    screenRect(w, h) {
      const minX = o.x - o.originX * o.displayWidth + w / 2;
      const minY = o.y - o.originY * o.displayHeight + h / 2;
      return { minX, minY, maxX: minX + o.displayWidth, maxY: minY + o.displayHeight };
    },
  };
  return o;
}

// ── Fake scene with a display-list container ────────────────────────────────
function makeScene(w = 2560, h = 1600, zoom = 1) {
  // A fresh container per call, like Phaser: a destroyed one is never handed back.
  const state = { container: null };
  const createContainer = () => {
    const c = {
      active: true, list: [], x: 0, y: 0, scaleX: 1, scaleY: 1,
      setScrollFactor() { return c; },
      setDepth() { return c; },
      setPosition(x, y) { c.x = x; c.y = y; return c; },
      setScale(s) { c.scaleX = s; c.scaleY = s; return c; },
      sort() { return c; },
      add(o) { c.list.push(o); return c; },
      removeAll() { c.list.length = 0; return c; },
      destroy() { c.active = false; },
    };
    state.container = c;
    return c;
  };
  const scene = {
    scale: { width: w, height: h }, cameras: { main: { zoom } },
    add: { container: () => createContainer() },
  };
  return { scene, get container() { return state.container; } };
}

const covers = (r, w, h) => r.minX <= 0.5 && r.minY <= 0.5 && r.maxX >= w - 0.5 && r.maxY >= h - 0.5;

// ── 1. The transform that cancels zoom ──────────────────────────────────────
for (const zoom of [0.6, 0.96, 1, 1.5, 2]) {
  const f = screenFit(2560, 1600, zoom);
  ok(Math.abs(f.scale - 1 / zoom) < 1e-9 && f.x === 1280 && f.y === 800,
     `screenFit at zoom ${zoom} → midpoint, scale 1/zoom`);
}
for (const bad of [0, -1, NaN, undefined, Infinity]) {
  const f = screenFit(800, 600, bad);
  ok(f.scale === 1 && Number.isFinite(f.x), `screenFit degrades to 1 for zoom ${String(bad)}`);
}

// ── 2. Coverage invariant: a fill overlay spans the viewport at every zoom ──
for (const [w, h] of [[2560, 1600], [1280, 800], [900, 1600]]) {
  for (const zoom of [0.6, 1, 2]) {
    const f = screenFit(w, h, zoom);
    const [lx, ly] = layerLocal(w, h, 0, 0, w, h);
    const r = { minX: lx + f.x, minY: ly + f.y, maxX: lx + f.x + w, maxY: ly + f.y + h };
    ok(covers(r, w, h), `${w}×${h} fill overlay covers viewport at zoom ${zoom}`);
    // The pre-fix math: an overlay left at the origin under zoom z covers only
    // z×w of the viewport, i.e. it under-covers whenever the camera is wide.
    ok(zoom >= 1 || w * zoom < w - 1,
       `(regression) un-cancelled overlay would miss ${Math.round(w * (1 - zoom))}px at zoom ${zoom}`);
  }
}

// ── 3. Placement modes ──────────────────────────────────────────────────────
{
  const { scene } = makeScene(800, 600, 1);
  const fill = makeOverlay();
  addScreenOverlay(scene, fill, 10, { mode: 'fill', scale: 2 });
  ok(fill.displayWidth === 1600 && fill.displayHeight === 1200, 'fill honours its scale factor');

  const pin = makeOverlay({ originX: 0.5, originY: 0.5 });
  addScreenOverlay(scene, pin, 11, { mode: 'pin', at: (w) => [w - 100, 70] });
  const pr = pin.screenRect(800, 600);
  ok(Math.abs((pr.minX + pr.maxX) / 2 - 700) < 1e-6 && Math.abs((pr.minY + pr.maxY) / 2 - 70) < 1e-6,
     'pin lands its origin on the requested screen point');

  const anchor = makeOverlay();
  addScreenOverlay(scene, anchor, 12, { mode: 'anchor' });
  ok(anchor.x === -400 && anchor.y === -300, 'anchor maps local space to the viewport top-left');
  ok(screenPoint(800, 600, [anchor.x, anchor.y]).join(',') === '0,0', 'screenPoint inverts anchor placement');
}

// ── 4. Zoom + resize refit through the layer, not the call sites ────────────
{
  const { scene } = makeScene(2560, 1600, 1);
  const a = makeOverlay();
  addScreenOverlay(scene, a, 10);
  for (const zoom of [0.6, 2]) {
    scene.cameras.main.zoom = zoom;
    fitScreenLayer(scene);
    const r = a.screenRect(2560, 1600);
    ok(scene._screenOverlays.layer.scaleX === 1 / zoom && covers(r, 2560, 1600),
       `overlay still covers the viewport after zoom → ${zoom}`);
  }
  scene.scale.width = 1280; scene.scale.height = 800;
  fitScreenLayer(scene, true);
  ok(covers(a.screenRect(1280, 800), 1280, 800), 'resize refit re-covers the new viewport');
}

// ── 5. Prune: destroyed overlays leave the layer, even at a stable zoom ────
{
  const { scene } = makeScene(2560, 1600, 1);
  const live = makeOverlay(), dead = makeOverlay();
  addScreenOverlay(scene, live, 10);
  addScreenOverlay(scene, dead, 11);
  ok(scene._screenOverlays.entries.length === 2, 'both overlays registered');
  dead.destroy();
  fitScreenLayer(scene);                       // same zoom/size: the old fast path
  ok(scene._screenOverlays.entries.length === 1, 'destroyed overlay pruned without a zoom change');
  ok(scene._screenOverlays.layer.list.length === 1 && scene._screenOverlays.layer.list[0] === live,
     'container list rebuilt without the dead overlay');
  ok(scene._screenOverlays.entries[0].obj === live, 'surviving overlay keeps its registration');
}

// ── 6. Scene restart rebuilds the layer (Phaser 4 has no `.destroyed`) ─────
{
  const { scene } = makeScene(2560, 1600, 1);
  addScreenOverlay(scene, makeOverlay(), 10);
  const oldLayer = scene._screenOverlays.layer;
  oldLayer.destroy();                           // what a scene restart does
  const fresh = makeOverlay();
  addScreenOverlay(scene, fresh, 10);
  ok(scene._screenOverlays.layer !== oldLayer && scene._screenOverlays.layer.active,
     'a destroyed container is not reused after a scene restart');
  ok(scene._screenOverlays.entries.length === 1 && scene._screenOverlays.entries[0].obj === fresh,
     'entries reset with the rebuilt layer');
}

// ── 7. Destroyed-object semantics (the trap that made pruning dead code) ───
{
  ok(isDestroyed({ active: false }) && !isDestroyed({ active: true }),
     'isDestroyed reads `active`, the flag Phaser 4 actually clears');
  ok(!isDestroyed({ active: true, destroyed: undefined }),
     '(regression) a live object with an undefined `.destroyed` is NOT destroyed');
  ok(isDestroyed(null) && isDestroyed(undefined), 'isDestroyed treats missing objects as gone');
}

// ── 8. A headless scene (no display list) must not throw ───────────────────
{
  const headless = { scale: { width: 800, height: 600 }, cameras: { main: { zoom: 1 } }, add: {} };
  const o = makeOverlay();
  const returned = addScreenOverlay(headless, o, 10);
  fitScreenLayer(headless, true);
  ok(returned === o && headless._screenOverlays === undefined, 'headless scene: registration is a no-op, no throw');
}

console.log(fails === 0 ? '✅ OVERLAYS PASS — screen-space layer math verified.' : `❌ OVERLAYS FAIL — ${fails} failure(s)`);
process.exit(fails === 0 ? 0 : 1);
