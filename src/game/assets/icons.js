// ─────────────────────────────────────────────────────────────────────────────
// Item icon atlas builder + React-facing dataURL store.
//
// Builds a single-canvas atlas of all item icons (arranged in an 8-column
// grid) and registers individual named frames for Phaser-side use.
// Also generates standalone PNG dataURLs consumed by the React HUD layer.
//
// Icon shapes are defined in iconShapesA.js (weapons/armour) and
// iconShapesB.js (resources/food/consumables).
// ─────────────────────────────────────────────────────────────────────────────
import { ITEMS } from '../data/items.js';
import { makeCanvas } from './artCore.js';
import { SHAPES_A } from './iconShapesA.js';
import { SHAPES_B } from './iconShapesB.js';

/** Cell size for each icon in the atlas (px). */
const CELL = 26;

/** Merged drawer map — shape name → (ctx, colour) drawer function. */
const DRAWERS = { ...SHAPES_A, ...SHAPES_B };

/** @type {Record<string, string>} itemId → PNG dataURL (consumed by React). */
export const iconDataURLs = {};

// ── Atlas builder ───────────────────────────────────────────────────────────

/**
 * Build the item icon atlas texture and populate `iconDataURLs`.
 *
 * Items are arranged in an 8-column grid on a single canvas.
 * Each item gets a named frame (`{itemId}_frame`) for Phaser-side sprites,
 * and a standalone PNG dataURL for the React HUD.
 *
 * @param {Phaser.Scene} scene  Scene that owns the texture manager.
 * @returns {true} Always returns true (idempotent — skips if texture exists).
 */
export function buildItemIcons(scene) {
  const ids = Object.keys(ITEMS);
  const cols = 8;
  const rows = Math.ceil(ids.length / cols);
  const { canvas, ctx } = makeCanvas(cols * CELL, rows * CELL);

  // Idempotent guard
  if (scene.textures.exists('item_icons')) return true;

  const tex = scene.textures.addCanvas('item_icons', canvas);

  ids.forEach((id, idx) => {
    const def = ITEMS[id];
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const ox = col * CELL;
    const oy = row * CELL;

    ctx.save();
    ctx.translate(ox, oy);
    try {
      const drawer = DRAWERS[def.icon?.shape];
      if (!drawer) throw new Error(`no drawer for shape "${def.icon?.shape}"`);
      drawer(ctx, def.icon?.c1 || '#cccccc');
    } catch (err) {
      console.warn('[icons]', id, err.message);
    }
    ctx.restore();

    // Register named frame for Phaser
    if (!tex.has(`${id}_frame`)) {
      tex.add(`${id}_frame`, 0, ox, oy, CELL, CELL);
    }

    // Crop into standalone PNG dataURL for the React layer
    const c2 = document.createElement('canvas');
    c2.width = CELL;
    c2.height = CELL;
    c2.getContext('2d').drawImage(canvas, ox, oy, CELL, CELL, 0, 0, CELL, CELL);
    iconDataURLs[id] = c2.toDataURL('image/png');
  });

  return true;
}

// ── Frame name helper ───────────────────────────────────────────────────────

/**
 * Returns the Phaser frame name for a given item ID.
 * @param {string} itemId  Item identifier (e.g. "iron_sword").
 * @returns {string} Frame name (e.g. "iron_sword_frame").
 */
export const iconFrame = (itemId) => `${itemId}_frame`;
