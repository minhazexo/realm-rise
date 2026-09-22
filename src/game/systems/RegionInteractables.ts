// ─────────────────────────────────────────────────────────────────────────────
// RegionInteractables — the region's clickable world objects and what each one
// does: chests (the shipped chest path), savepoints, lore, the crystal
// sequence, rescues, and the region's own crafting station.
//
// Owns: which interactables are placed (`interactPlaced`) and the crystal
// puzzle's progress. Pointer-based, matching the chest/NPC convention.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { saveToSlot } from './SaveSystem.ts';
import { idleReason } from './CraftingSystem.ts';
import { regionState, setStoryFlag } from './RegionState.ts';
import { puzzleStep } from '../data/region.ts';
import type { RegionScene } from './RegionState.ts';
import type { Interactable, RegionDef } from '../data/region.ts';

/** Place the area's clickables (flag-gated ones wait for their flag). */
export function placeInteractables(scene: RegionScene, region: RegionDef, areaId: string): void {
  const st = regionState(scene);
  for (const it of region.interactables) {
    if (it.area !== areaId || st.interactPlaced.has(it.id)) continue;
    if (it.requiresFlag && !GameState.s.story.flags[it.requiresFlag]) continue;
    st.interactPlaced.add(it.id);
    if (it.kind === 'chest') {
      // Reuse the shipped chest path (pools, toast, sound, persistence).
      scene.spawnChest?.(it.x, it.y, it.tier || 'wooden_chest', it.id);
      continue;
    }
    const img: Phaser.GameObjects.Image = scene.add.image(it.x, it.y, it.tex)
      .setDepth(Math.round(it.y))
      .setInteractive({ useHandCursor: true });
    if (it.scale) img.setScale(it.scale);
    if (it.tint) img.setTint(it.tint);
    // Interaction highlight — the only "UI" the world needs.
    img.on('pointerover', () => img.setTint(0xffe9c9));
    img.on('pointerout', () => { img.setTint(it.tint ?? 0xffffff); });
    img.on('pointerdown', () => useInteractable(scene, region, it, img));
  }
}

/** Flag-gated objects whose flag has since been set (the vault, the reward). */
export function placeFlaggedInteractables(scene: RegionScene, region: RegionDef): void {
  const st = regionState(scene);
  for (const it of region.interactables) {
    if (!it.requiresFlag || st.interactPlaced.has(it.id)) continue;
    if (!st.placed.has(it.area) || !GameState.s.story.flags[it.requiresFlag]) continue;
    placeInteractables(scene, region, it.area);
  }
}

function useInteractable(scene: RegionScene, region: RegionDef, it: Interactable, img: Phaser.GameObjects.Image): void {
  const S = GameState.s;

  switch (it.kind) {
    case 'savepoint': {
      useSavepoint(scene, it);
      break;
    }
    case 'lore': {
      if (it.flag) setStoryFlag(it.flag);
      GameState.toast({ title: it.label, msg: it.text || '', kind: 'dialogue', dur: 7600 });
      Bus.emit('play-sound', 'ui_click');
      break;
    }
    case 'station': {
      // The region's own forging station. It is NOT a second upgrade system:
      // BuildSystem already answered "is this station in reach?" for the
      // settlement forge, and the crafting panel is the same panel either way.
      // Here we only open it (and say why when there is nothing to do).
      // Open, never toggle: a station is a place, and world pointer input stays
      // live while a panel is up, so a second click would otherwise close the
      // panel it just opened. The panel already being open also means the
      // player is looking at it — repeating the advice would just stack toasts.
      const alreadyOpen: boolean = GameState.session.uiPanel === 'crafting';
      if (!alreadyOpen) scene.togglePanel?.('crafting');
      Bus.emit('play-sound', 'ui_open');
      scene.floats?.add?.(it.x, it.y - 34, '⚒', '#ffd66b', 1.2);
      if (alreadyOpen) break;
      const why: string | null = idleReason(it.station || '');
      if (why) {
        GameState.toast({ title: it.label, msg: `Nothing to forge here — ${why.toLowerCase()}.`, kind: 'info', dur: 4200 });
      } else if (it.flag && !S.story.flags[it.flag]) {
        // Flavour once, then the station is just a station.
        setStoryFlag(it.flag);
        GameState.toast({ title: it.label, msg: it.text || '', kind: 'dialogue', dur: 6400 });
      }
      break;
    }
    case 'crystal': {
      const puzzle = region.puzzle;
      if (!puzzle) break;
      const st = regionState(scene);
      const res = puzzleStep(st.puzzle, it.crystal || '', puzzle.sequence);
      st.puzzle = res.progress;
      if (res.solved) {
        setStoryFlag(puzzle.flag);
        Bus.emit('play-sound', 'boss_roar');
        GameState.toast({ title: 'THE SEAL BREAKS', msg: puzzle.doneText, kind: 'stage', dur: 5200 });
        scene.floats?.add?.(it.x, it.y - 34, 'SEAL', '#c9a0ff', 1.4);
        // The vault and its reward only exist once the seal is broken.
        placeInteractables(scene, region, it.area);
      } else if (res.failed) {
        GameState.toast({ title: 'THE CRYSTALS DIM', msg: puzzle.failText, kind: 'info', dur: 5200 });
        Bus.emit('play-sound', 'hit_flesh');
      } else {
        GameState.toast({ title: it.label, msg: puzzle.prompt, kind: 'info', dur: 2600 });
        Bus.emit('play-sound', 'ui_click');
      }
      break;
    }
    case 'hostage': {
      useHostage(scene, it, img);
      break;
    }
    default:
      break;
  }
}

/**
 * The rest point (savepoint kind). Exported because a World Event raises the
 * same shrine: one rest path, whether the shrine was authored or rolled.
 */
export function useSavepoint(scene: RegionScene, it: Interactable): void {
  const S = GameState.s;
  const heal: number = Math.round((S.player.derived?.maxHp || 100) * 0.35);
  S.player.hp = Math.min(S.player.derived?.maxHp || S.player.hp, S.player.hp + heal);
  S.player.stamina = S.player.derived?.maxStamina || S.player.stamina;
  // Tell the UI: the HUD only re-reads on a channel notification, so a heal
  // that skipped this left the health bar showing the pre-rest value.
  GameState.notify(CH.PLAYER);
  saveToSlot('auto', S);
  Bus.emit('play-sound', 'craft_done');
  scene.floats?.add?.(it.x, it.y - 30, `+${heal}`, '#8aff9f', 1);
  GameState.toast({ title: it.label.toUpperCase(), msg: 'You rest. The realm remembers you here.', kind: 'discover', dur: 4200 });
}

/**
 * The hostage (rescue) interaction: a cage that will not open while its guards
 * are alive. Exported for the same reason — a rolled rescue is the shipped one.
 * The guard test is the cage's own radius, so it works wherever a cage stands.
 */
export function useHostage(scene: RegionScene, it: Interactable, img: Phaser.GameObjects.Image): void {
  const S = GameState.s;
  const guards: any[] = (scene.enemies || []).filter((e: any) =>
    !e.dead && e.sprite && Math.hypot(e.sprite.x - it.x, e.sprite.y - it.y) < 460);
  if (guards.length) {
    GameState.toast({ title: it.label, msg: 'The guards still watch the cage. Clear the camp first.', kind: 'info', dur: 3600 });
    return;
  }
  if (it.flag) setStoryFlag(it.flag);
  S.player.gold = (S.player.gold || 0) + 40;
  GameState.notify(CH.PLAYER);
  scene.floats?.add?.(it.x, it.y - 34, '+40 gold', '#ffd66b', 1.2);
  GameState.toast({ title: 'FREED', msg: it.text || '', kind: 'stage', dur: 6000 });
  img.setAlpha(0.45);
  Bus.emit('play-sound', 'craft_done');
}
