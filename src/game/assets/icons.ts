/// <reference lib="dom" />
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
import { ITEMS } from '../data/items.ts';
import { makeCanvas } from './artCore.ts';
import { ITEM_ARTWORK, itemArtworkKey } from './itemArtwork.ts';
import { SHAPES_A } from './iconShapesA.ts';
import { SHAPES_B } from './iconShapesB.ts';
import type { IconDrawer } from './iconPrims.ts';
import type * as Phaser from 'phaser';

/** Cell size for each icon in the atlas (px). */
const CELL = 34;

/** Merged drawer map — shape name → (ctx, colour) drawer function. */
const DRAWERS: Record<string, IconDrawer> = { ...SHAPES_A, ...SHAPES_B };

/** itemId → PNG dataURL (consumed by React). */
export const iconDataURLs: Record<string, string> = {};

// ── Atlas builder ───────────────────────────────────────────────────────────

/**
 * Build the item icon atlas texture and populate `iconDataURLs`.
 *
 * Items are arranged in an 8-column grid on a single canvas.
 * Each item gets a named frame (`{itemId}_frame`) for Phaser-side sprites,
 * and a standalone PNG dataURL for the React HUD.
 *
 * @param scene  Scene that owns the texture manager.
 * @returns Always returns true (idempotent — skips if texture exists).
 */
export function buildItemIcons(scene: Phaser.Scene): true {
  const ids = Object.keys(ITEMS);
  const cols = 8;
  const rows = Math.ceil(ids.length / cols);
  const { canvas, ctx } = makeCanvas(cols * CELL, rows * CELL);

  // Idempotent guard
  if (scene.textures.exists('item_icons')) return true;

  const tex = scene.textures.addCanvas('item_icons', canvas) as Phaser.Textures.CanvasTexture;

  ids.forEach((id, idx) => {
    const def = ITEMS[id] as { icon?: { shape?: string; c1?: string } } | undefined;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const ox = col * CELL;
    const oy = row * CELL;

    ctx.save();
    ctx.translate(ox, oy);
    try {
      const artworkKey = itemArtworkKey(id);
      if (ITEM_ARTWORK[id] && scene.textures.exists(artworkKey)) {
        const image = scene.textures.get(artworkKey).getSourceImage() as HTMLImageElement;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, CELL, CELL);
      } else {
        // Preserve the original 26px drawings, centered at native resolution.
        ctx.translate((CELL - 26) / 2, (CELL - 26) / 2);
        const shape: string | undefined = def?.icon?.shape;
        const drawer: IconDrawer | undefined = shape === undefined ? undefined : DRAWERS[shape];
        if (!drawer) throw new Error(`no drawer for shape "${def?.icon?.shape}"`);
        drawer(ctx, def?.icon?.c1 || '#cccccc');
      }
    } catch (err) {
      console.warn('[icons]', id, err instanceof Error ? err.message : String(err));
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
    const c2ctx = c2.getContext('2d') as CanvasRenderingContext2D;
    c2ctx.drawImage(canvas, ox, oy, CELL, CELL, 0, 0, CELL, CELL);
    iconDataURLs[id] = c2.toDataURL('image/png');
  });

  // CanvasTexture must upload the completed atlas to the GPU, not the blank canvas.
  tex.refresh();
  return true;
}

// ── Frame name helper ───────────────────────────────────────────────────────

/**
 * Returns the Phaser frame name for a given item ID.
 * @param itemId  Item identifier (e.g. "iron_sword").
 * @returns Frame name (e.g. "iron_sword_frame").
 */
export const iconFrame = (itemId: string): string => `${itemId}_frame`;
