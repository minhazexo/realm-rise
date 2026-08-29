// ─────────────────────────────────────────────────────────────────────────────
// Asset orchestration (spec §68):
//   Builds the ENTIRE visual identity of the game at runtime.
//   Called from PreloadScene.create(); completes synchronously (< ~400 ms).
//
// This module coordinates every visual asset:
//   • Nature props   — trees, rocks, flora, ruins
//   • Structures     — buildings, farms, military, civic
//   • FX / particles — combat, weather, projectiles, menu
//   • Characters     — player, NPCs, all enemy variants
//   • Item icons     — weapons, resources, consumables (React-facing dataURLs)
// ─────────────────────────────────────────────────────────────────────────────
import { makeHumanoidSheet } from './sheetsHuman.js';
import { makeQuadrupedSheet } from './sheetsQuad.js';
import { buildNatureProps } from './propsNature1.js';
import { buildRockProps, buildFloraProps, buildRuinsProps } from './propsNature2.js';
import { buildStructureProps1 } from './propsStructures1.js';
import { buildStructureProps2 } from './propsStructures2.js';
import { buildStructureProps3 } from './propsStructures3.js';
import { buildFxProps, buildMenuProps } from './propsFx.js';
import { buildItemIcons, iconDataURLs } from './icons.js';
import { ALL_ENEMY_DEFS } from '../data/enemies.js';

// ── Enemy → variant mapping ─────────────────────────────────────────────────
/** Maps enemy keys to their humanoid headgear variant (null = none). */
const ENEMY_VARIANT_MAP = {
  goblin: 'goblin',
  skeleton: 'skeleton',
  bandit_scout: 'mask',
  bandit_archer: 'hood',
  bandit_swordsman: null,
  bandit_brute: 'brute',
  bandit_captain: 'plume',
  bandit_king: 'crown',
};

/**
 * Build all runtime textures for the game.
 *
 * @param {Phaser.Scene} scene  The preload / boot scene that owns the texture manager.
 */
export function buildAllAssets(scene) {
  // ── World props & structures ──────────────────────────────────────────
  buildNatureProps(scene);
  buildRockProps(scene);
  buildFloraProps(scene);
  buildRuinsProps(scene);
  buildStructureProps1(scene);
  buildStructureProps2(scene);
  buildStructureProps3(scene);
  buildFxProps(scene);
  buildMenuProps(scene);

  // ── Player sheet ──────────────────────────────────────────────────────
  // (appearance resolved later via refreshPlayerTexture on equip change)
  makePlayerSheet(scene, {
    skin: '#caa27c',
    hairstyle: 'short',
    hairColor: '#4a3222',
    gender: 'm',
    tierIdx: 0,
  });

  // ── NPC / merchant look ───────────────────────────────────────────────
  makeHumanoidSheet(scene, 'npc_generic', {
    skin: '#c69a72', hairstyle: 'bald', hairColor: '#6d5636',
    gender: 'm', tierIdx: 0, variant: null,
  });
  makeHumanoidSheet(scene, 'npc_merchant', {
    skin: '#caa27c', hairstyle: 'braided', hairColor: '#3f3229',
    gender: 'm', tierIdx: 1, variant: null,
  });

  // ── All enemy sprites (from data definitions) ─────────────────────────
  for (const def of Object.values(ALL_ENEMY_DEFS)) {
    buildEnemySheet(scene, def.key, def);
  }

  // ── Item icon atlas ───────────────────────────────────────────────────
  buildItemIcons(scene);
}

// ── Enemy sheet builder ─────────────────────────────────────────────────────

/**
 * Build a sprite sheet for a single enemy type.
 *
 * Dispatches to the appropriate builder:
 *   • Quadrupeds (wolf, boar, bear) → makeQuadrupedSheet
 *   • Humanoid monsters (goblin, skeleton, golem) → makeHumanoidSheet
 *   • Human bandits / bosses → makeHumanoidSheet
 *
 * @param {Phaser.Scene} scene
 * @param {string}       key  Enemy key (e.g. "bandit_captain").
 * @param {Object}       def  Enemy definition from ALL_ENEMY_DEFS.
 */
export function buildEnemySheet(scene, key, def) {
  const pal = def.palette || {};

  // ── Quadrupeds ────────────────────────────────────────────────────────
  const isQuadruped =
    def.sheetKey.startsWith('en_') &&
    ['wolf', 'boar', 'bear'].some((k) => def.key.includes(k));

  if (isQuadruped) {
    return makeQuadrupedSheet(scene, def.sheetKey, {
      fur: pal.fur || def.palette?.stone || '#7a7060',
      belly: pal.belly || '#b3aa97',
      bulk: def.style === 'brute' ? 1.25 : 1,
      tusks: def.key === 'boar',
      scars: pal.scars,
      eyes: pal.eyes,
    });
  }

  // ── Humanoid monsters ─────────────────────────────────────────────────
  if (def.sheetKey.startsWith('en_')) {
    return makeHumanoidSheet(scene, def.sheetKey, {
      skin: pal.skin || pal.stone || '#5d7a4a',
      hairColor: pal.glow || pal.rune || '#57c4ab',
      hairstyle: 'bald',
      gender: 'm',
      tierIdx: def.boss && def.ruinsBoss ? 4 : 0,
      variant: def.ruinsBoss ? 'brute' : ENEMY_VARIANT_MAP[def.key] ?? null,
    });
  }

  // ── Human bandits / bosses ────────────────────────────────────────────
  return makeHumanoidSheet(scene, def.sheetKey, {
    skin: pal.skin || '#c69a72',
    hairColor: '#3f3229',
    hairstyle: 'short',
    gender: 'm',
    tierIdx: def.key === 'bandit_king' ? 5 : def.key === 'bandit_captain' ? 1 : 0,
    variant: ENEMY_VARIANT_MAP[def.key] ?? null,
  });
}

// ── Player sheet builder ────────────────────────────────────────────────────

/**
 * Rebuild the player texture when equipment tier changes.
 *
 * @param {Phaser.Scene} scene
 * @param {Object} appearance
 * @param {string}  appearance.skin        Skin tone hex.
 * @param {string}  appearance.hairColor   Hair colour hex.
 * @param {string}  [appearance.hairStyle] Hairstyle key.
 * @param {string}  appearance.gender      'm' | 'f'
 * @param {number}  [appearance.outfitTier=0] Equipment tier (0-6).
 * @returns {string[]} Generated frame names.
 */
export function makePlayerSheet(scene, appearance) {
  return makeHumanoidSheet(scene, 'player_char', {
    skin: appearance.skin,
    hairColor: appearance.hairColor,
    hairstyle: appearance.hairStyle,
    gender: appearance.gender,
    tierIdx: appearance.outfitTier ?? 0,
  });
}

/** Re-export for React layer (item icon dataURLs). */
export { iconDataURLs };
