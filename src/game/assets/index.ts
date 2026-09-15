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
import { makeHumanoidSheet } from './sheetsHuman.ts';
import { makeQuadrupedSheet } from './sheetsQuad.ts';
import { buildNatureProps } from './propsNature1.ts';
import { buildRockProps, buildFloraProps, buildRuinsProps } from './propsNature2.ts';
import { buildStructureProps1 } from './propsStructures1.ts';
import { buildStructureProps2 } from './propsStructures2.ts';
import { buildStructureProps3 } from './propsStructures3.ts';
import { buildFxProps, buildMenuProps } from './propsFx.ts';
import { buildItemIcons, iconDataURLs } from './icons.ts';
import { ALL_ENEMY_DEFS } from '../data/enemies.ts';
import type * as Phaser from 'phaser';

// ── Enemy → variant mapping ─────────────────────────────────────────────────
/** Maps enemy keys to their humanoid headgear variant (null = none). */
const ENEMY_VARIANT_MAP: Record<string, string | null> = {
  goblin: 'goblin',
  skeleton: 'skeleton',
  bandit_scout: 'mask',
  bandit_archer: 'hood',
  bandit_swordsman: null,
  bandit_brute: 'brute',
  bandit_captain: 'plume',
  bandit_king: 'crown',
};

/** Minimal enemy palette fields consumed by the sheet builders. */
export interface EnemyPalette {
  fur?: string;
  belly?: string;
  stone?: string;
  skin?: string;
  cloth?: string;
  bone?: string;
  glow?: string;
  rune?: string;
  scars?: string;
  eyes?: string;
}

/** Minimal enemy definition fields consumed by {@link buildEnemySheet}. */
export interface EnemyDef {
  key: string;
  sheetKey: string;
  style?: string;
  boss?: boolean;
  ruinsBoss?: boolean;
  palette?: EnemyPalette | null;
}

/**
 * Build all runtime textures for the game.
 *
 * @param scene  The preload / boot scene that owns the texture manager.
 */
export function buildAllAssets(scene: Phaser.Scene): void {
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
  for (const def of Object.values(ALL_ENEMY_DEFS) as EnemyDef[]) {
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
 * @param scene
 * @param key  Enemy key (e.g. "bandit_captain").
 * @param def  Enemy definition from ALL_ENEMY_DEFS.
 */
export function buildEnemySheet(scene: Phaser.Scene, key: string, def: EnemyDef): string[] {
  const pal: EnemyPalette = def.palette || {};

  // ── Quadrupeds ────────────────────────────────────────────────────────
  const isQuadruped =
    def.sheetKey.startsWith('en_') &&
    ['wolf', 'boar', 'bear'].some((k) => def.key.includes(k));

  if (isQuadruped) {
    return makeQuadrupedSheet(scene, def.sheetKey, {
      fur: pal.fur || pal.stone || '#7a7060',
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

/** Player appearance consumed by {@link makePlayerSheet}. */
export interface PlayerAppearance {
  /** Skin tone hex. */
  skin: string;
  /** Hair colour hex. */
  hairColor: string;
  /** Hairstyle key. */
  hairStyle?: string;
  /** 'm' | 'f' */
  gender: string;
  /** Equipment tier (0-6). */
  outfitTier?: number;
  /** Ignored legacy alias (kept so existing call sites typecheck). */
  tierIdx?: number;
  /** Back-compat alias for hairStyle. */
  hairstyle?: string;
}

/**
 * Rebuild the player texture when equipment tier changes.
 *
 * @param scene
 * @param appearance
 * @returns Generated frame names.
 */
export function makePlayerSheet(scene: Phaser.Scene, appearance: PlayerAppearance): string[] {
  return makeHumanoidSheet(scene, 'player_char', {
    skin: appearance.skin,
    hairColor: appearance.hairColor,
    hairstyle: appearance.hairStyle || appearance.hairstyle || 'short',
    gender: appearance.gender,
    tierIdx: appearance.outfitTier ?? 0,
  });
}

/** Re-export for React layer (item icon dataURLs). */
export { iconDataURLs };
