// ─────────────────────────────────────────────────────────────────────────────
// InputSystem — keyboard/mouse wiring, remappable action binds, camera zoom,
// pause/panel toggles.
//
// Extracted from WorldScene (Phase 3, final god-class slice). Scene-context
// functions; per-scene mutable state (keys, bindKeys, _boundActions) lives
// on the scene object as before.
//
// NOTE: this module imports Phaser for KeyCodes (like entities/ do). Input
// is inherently engine-bound, so unlike the other extracted systems this one
// is browser-only and has no headless unit tests — verification is the live
// key/mouse matrix + build.
// ─────────────────────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import GameState from '../core/GameState.ts';
import { Bus, CH } from '../core/EventBus.ts';
import { getSetting, updateSettings, movementKey } from '../systems/SettingsSystem.ts';
import { updateBuildGhost } from './BuildSystem.ts';
import type { BuildScene } from './BuildSystem.ts';

/** KeyCodes as a plain lookup table (Phaser ships it as a namespace). */
const KEY_CODE_TABLE = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;

/** One registered action binding (kept so rebinds can be torn down). */
interface BoundAction {
  code: string;
  fn: () => void;
}

/** Minimal scene surface consumed by the input wiring. */
export type InputScene = BuildScene & {
  keys?: any;
  bindKeys?: any;
  primaryKeys?: string[];
  _boundActions?: Record<string, BoundAction>;
  pointerWorld?: any;
  buildGhost?: any;
  doGather(): void;
  togglePanel(name: string): void;
  togglePause(): void;
  placeBuild(pos: { x: number; y: number }): void;
  player: any;
  enemies: any[];
  floats: any;
};

/**
 * Phase E: player-remappable keys. WASD + arrows always move (fallbacks);
 * `bindKeys` holds the player's own movement/dodge/sprint alternatives and
 * `registerActionBinds()` wires the action keys. Unknown codes fall back
 * to defaults so a bad bind can never lock the player out.
 */
export function bindCode(action: string, fallback: string): string {
  const name: string = GameState.s?.settings?.keybinds?.[action] || fallback;
  return KEY_CODE_TABLE[name] != null ? name : fallback;
}

export function buildBindKeys(scene: InputScene): Record<string, Phaser.Input.Keyboard.Key> {
  const kb = scene.input.keyboard;
  const out: Record<string, Phaser.Input.Keyboard.Key> = {};
  if (!kb) return out;
  const actions: [string, string][] = [['up', 'W'], ['down', 'S'], ['left', 'A'], ['right', 'D'], ['dodge', 'SPACE'], ['sprint', 'SHIFT']];
  for (const [action, fb] of actions) {
    try { out[action] = kb.addKey(KEY_CODE_TABLE[bindCode(action, fb)] ?? KEY_CODE_TABLE[fb]!); }
    catch { try { out[action] = kb.addKey(KEY_CODE_TABLE[fb]!); } catch { /* ignore */ } }
  }
  return out;
}

export function registerActionBinds(scene: InputScene): void {
  const kb = scene.input.keyboard;
  if (!kb) return;
  // Tear down the previous round (rebinds from settings).
  if (scene._boundActions) {
    for (const { code, fn } of Object.values(scene._boundActions)) {
      try { kb.off(`keydown-${code}`, fn); } catch { /* ignore */ }
    }
  }
  const defs: [string, string, () => void][] = [
    ['gather', 'E', () => { if (!GameState.session.uiPanel) scene.doGather(); }],
    ['inventory', 'I', () => scene.togglePanel('inventory')],
    ['crafting', 'C', () => scene.togglePanel('crafting')],
    ['map', 'M', () => scene.togglePanel('map')],
    ['journal', 'J', () => scene.togglePanel('journal')],
    ['kingdom', 'K', () => scene.togglePanel('kingdom')],
    ['build', 'B', () => scene.togglePanel('build')],
    ['skills', 'P', () => scene.togglePanel('skills')],
    ['pause', 'ESC', () => scene.togglePause()],
    ['dodge', 'SPACE', () => { scene.player.wantDodge = true; }],
  ];
  scene._boundActions = {};
  for (const [action, fb, fn] of defs) {
    const code = bindCode(action, fb);
    kb.on(`keydown-${code}`, fn);
    scene._boundActions[action] = { code, fn };
  }
}

/* ── Input (spec §5, §41) ───────────────────────────────────────────── */
export function setupInput(scene: InputScene): void {
  const kb = scene.input.keyboard;
  if (!kb) return;
  scene.keys = kb.addKeys({
    W: Phaser.Input.Keyboard.KeyCodes.W, A: 'A', S: 'S', D: 'D',
    UP: Phaser.Input.Keyboard.KeyCodes.UP, DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
    LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT, RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT, SPACE: 'SPACE'
  });
  // movementScheme determines which keyset Player.js treats as "primary".
  // Both sets always work; the primary set is what the HUD hint highlights.
  const derivePrimary = (): void => {
    scene.primaryKeys = movementKey() === 'arrows'
      ? ['UP', 'DOWN', 'LEFT', 'RIGHT']
      : ['W', 'A', 'S', 'D'];
  };
  derivePrimary();
  // Re-derive if the player changes movement scheme mid-session.
  scene.bindKeys = buildBindKeys(scene);
  Bus.on('settings-applied', () => {
    derivePrimary();
    scene.bindKeys = buildBindKeys(scene);
    registerActionBinds(scene);
  });
  registerActionBinds(scene);
  kb.on('keydown-F3', (e: any) => {
    try { e.originalEvent.preventDefault(); } catch { /* synthetic events lack originalEvent */ }
    GameState.session.debugVisible = !GameState.session.debugVisible;
    GameState.notify(CH.SCREEN);
  });
  // Camera zoom: mouse wheel + (+/=) in + (-) out, Z/X alternates.
  // Wheel over the canvas only (React panels sit above and swallow theirs).
  scene.input.on('wheel', (pointer: unknown, over: unknown, dx: number, dy: number) => {
    void pointer; void over; void dx;
    if (GameState.session.uiPanel || GameState.session.dialogue) return;
    if (!dy) return;
    nudgeCamZoom(scene, dy < 0 ? 1 : -1);
  });
  for (const key of ['PLUS', 'EQUALS', 'Z']) {
    try { kb.on(`keydown-${key}`, () => nudgeCamZoom(scene, 1)); } catch { /* ignore */ }
  }
  for (const key of ['MINUS', 'X']) {
    try { kb.on(`keydown-${key}`, () => nudgeCamZoom(scene, -1)); } catch { /* ignore */ }
  }

  // attack on left mouse
  scene.input.on('pointerdown', (pointer: any) => {
    if (pointer.rightButtonDown()) return;
    if (GameState.session.uiPanel || GameState.session.buildModeGhost || GameState.session.paused) return;
    const world = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    scene.pointerWorld = world;
    if (GameState.session.pendingBuild) {
      scene.placeBuild({ x: world.x, y: world.y });
      return;
    }
    scene.player.holdStart = performance.now();
    scene.player.tryAttack({ heavy: false }, world, scene.enemies, scene.floats);
  });
  scene.input.on('pointerup', (pointer: any) => {
    if (pointer.rightButtonDown()) return;
    if (GameState.session.uiPanel) return;
    scene.player.requestHeavyRelease?.(scene.pointerWorld, scene.enemies, scene.floats);
  });
  // heavy attack on left mouse hold (with skill) & block on right or shift-space
  scene.input.on('pointerdown', (pointer: any) => {
    if (pointer.rightButtonDown()) {
      if (GameState.session.pendingBuild) {
        GameState.session.pendingBuild = null;
        if (scene.buildGhost) {
          try { scene.buildGhost.destroy(); } catch { /* ignore */ }
          scene.buildGhost = null;
        }
        GameState.notify(CH.SCREEN);
        return;
      }
      if (!GameState.session.uiPanel) {
        GameState.session.mobileBlock = true;
      }
    }
  });
  scene.input.on('pointerup', (pointer: any) => {
    if (pointer.rightButtonDown() === false) GameState.session.mobileBlock = false;
  });
  // NB: dodge/sprint keys come from registerActionBinds()/bindKeys above.
  scene.input.on('pointermove', (pointer: any) => {
    if (GameState.session.pendingBuild) {
      const w = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      updateBuildGhost(scene, w);
      scene.pointerWorld = w;
    } else if (scene.buildGhost) { scene.buildGhost.destroy(); scene.buildGhost = null; }
  });
}

export function togglePause(scene: InputScene): void {
  // If in pendingBuild, cancel build mode first
  if (GameState.session.pendingBuild) {
    GameState.session.pendingBuild = null;
    if (scene.buildGhost) {
      try { scene.buildGhost.destroy(); } catch { /* ignore */ }
      scene.buildGhost = null;
    }
    GameState.notify(CH.SCREEN);
    return;
  }
  // If a UI panel is open, close it instead of opening the pause menu
  if (GameState.session.uiPanel && GameState.session.uiPanel !== 'pause') {
    GameState.session.uiPanel = null;
    GameState.session.paused = false;
    GameState.notify(CH.SCREEN, CH.WORLD);
    return;
  }
  GameState.session.paused = !GameState.session.paused;
  GameState.session.uiPanel = GameState.session.paused ? 'pause' : null;
  void scene;
  GameState.notify(CH.SCREEN);
}

export function togglePanel(scene: InputScene, name: string): void {
  void scene;
  const cur = GameState.session.uiPanel;
  GameState.session.uiPanel = cur === name ? null : name;
  GameState.session.paused = GameState.session.uiPanel != null;
  GameState.notify(CH.SCREEN, CH.WORLD);
}

/* ── Camera zoom (wheel / +/- / Z/X / HUD buttons / settings slider) ── */
export function applyCamZoom(scene: InputScene): number {
  const raw = Number(getSetting('camZoom') ?? 1);
  const base = Math.max(0.6, Math.min(2, Number.isFinite(raw) ? raw : 1));
  // Combat bias: zoom out ~4%
  // during combat so melee arcs and incoming enemies stay in frame. The
  // player's chosen baseline is always the anchor — combat only biases it.
  const combat = GameState.session.inCombat === true;
  const target = combat ? base * 0.96 : base;
  const cur = scene.cameras.main.zoom || base;
  const next = cur + (target - cur) * 0.08; // smooth lerp, no snap
  const z = Math.abs(next - target) < 0.001 ? target : next;
  try { scene.cameras.main.setZoom(z); } catch { /* headless */ }
  return z;
}

export function nudgeCamZoom(scene: InputScene, dir: number): void {
  const cur = Number(getSetting('camZoom') ?? 1) || 1;
  const next = Math.round((Math.max(0.6, Math.min(2, cur + (dir > 0 ? 0.15 : -0.15)))) * 100) / 100;
  try { updateSettings({ camZoom: next }); }
  catch {
    try {
      GameState.s.settings.camZoom = next;
      applyCamZoom(scene);
      GameState.notify(CH.SETTINGS);
    } catch { /* ignore */ }
  }
}
