// Phaser game bootstrap (spec §56). The game canvas lives behind a transparent
// React overlay; switching `screen` flips scenes via this controller.
import Phaser from 'phaser';
import GameState from './core/GameState.ts';
import { Bus, CH } from './core/EventBus.ts';
import MenuScene from './scenes/MenuScene.ts';
import WorldScene from './scenes/WorldScene.ts';
import { initAudio, installAudioBus, playSfx, applyVolumes } from './systems/AudioSystem.ts';
import { installBridge } from './core/BridgeSystem.ts';
import { recompute } from './systems/ProgressionSystem.ts';
import { refresh as kingdomRefresh } from './systems/KingdomSystem.ts';
import { installSettingsSystem, applySettings, withPrefs, clearMenuCache, currentSettings } from './systems/SettingsSystem.ts';
import type { CharOpts, GameSettings } from './core/stateFactory.ts';
import type { DifficultyKey } from './core/Constants.ts';

/** Scene handle with the game-specific fields the debug console touches. */
export type WorldSceneHandle = Phaser.Scene & { [key: string]: any };

/** Settings shape read by the FPS cap (settings.fpsCap). */
interface FpsCapSettings {
  fpsCap?: number;
}

/** Phase E: apply the FPS cap to Phaser's loop (0 = display default 60). */
export function applyFpsCap(settings?: unknown): void {
  try {
    const cap = (settings as FpsCapSettings | null | undefined)?.fpsCap ?? 0;
    if (game?.loop) game.loop.targetFps = cap > 0 ? cap : 60;
  } catch { /* loop unavailable in tests */ }
}

export let game: Phaser.Game | null = null;
export let currentSceneKey = 'MenuScene';

export function createGame(containerId = 'game-container'): Phaser.Game {
  const el = document.getElementById(containerId);
  // Phaser-specific render keys (subPixel / mipmap) that this Phaser build
  // accepts at runtime; the intersection keeps them legal in the config.
  const render: Phaser.Types.Core.RenderConfig & Record<string, unknown> = {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    // Sub-pixel rendering on the GPU for sharper, smoother visuals.
    subPixel: true,
    // PowerPreference: prefer high-performance GPU for shader effects.
    powerPreference: 'high-performance',
    // Enable the WebGL pipeline's mipmap generation for textures so
    // distant chunks sample the right LOD.
    mipmap: true
  };
  // The `& Record<string, unknown>` intersection keeps Phaser-specific keys
  // (pipeline) legal without weakening the config type.
  const config: Phaser.Types.Core.GameConfig & Record<string, unknown> = {
    type: Phaser.AUTO,
    parent: containerId,
    width: el ? el.clientWidth : window.innerWidth,
    height: el ? el.clientHeight : window.innerHeight,
    backgroundColor: '#0a0e16',
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false }
    },
    autoRound: false,
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render,
    // Phaser 4 ships the FX pipelines automatically when the camera calls
    // postFX.addXxx(). We also enable the global Light2D pipeline flag
    // so future Phaser versions light dynamically-lit entities for free.
    pipeline: { LightsActive: true },
    scene: [MenuScene, WorldScene]
  };
  game = new Phaser.Game(config);

  // init audio + one-time bus wiring
  if (initAudio()) {
    installAudioBus();
  }
  applyVolumes();
  // Settings system listens for CH.SETTINGS and re-applies DOM/audio every
  // time the panel mutates state.settings. Apply once at boot so the menu
  // already respects browser-level prefs (uiScale, textSize, volumes,
  // reducedMotion) even before a save is loaded.
  installSettingsSystem();
  applySettings(withPrefs(GameState.s?.settings), { busNotify: false });
  applyFpsCap(currentSettings());
  Bus.on('settings-applied', (s: GameSettings) => applyFpsCap(s));
  installBridge();
  Bus.on('play-sound', (name: string) => playSfx(name));

  window.addEventListener('resize', () => {
    if (game) game.scale.refresh();
  });

  // Debug handle for automated playtests (Phase 6 seed): lets verification
  // scripts reach the live scenes without module-graph imports.
  try { window.riseGame = game; } catch { /* non-browser */ }

  // Phase 6b: dev-only debug console. Gated behind import.meta.env.DEV so
  // production builds never expose it (vite statically drops the branch).
  // window.riseGame above stays unconditional — automation depends on it.
  // Every command is defensive (try/catch, never throws). System access uses
  // dynamic import() only — no new static imports here (cycle risk: main.js
  // already statically imports the scenes). Scene access goes through the
  // existing worldScene() helper below.
  if (import.meta.env.DEV) {
    try {
      window.rise = {
        help() {
          try {
            return [
              'rise.help() — this list',
              'rise.give(itemId, qty=1) — add items to inventory',
              'rise.spawnEnemy(key, n=1) — spawn enemies near player',
              'rise.spawnResource(type, n=1) — spawn gather nodes near player',
              'rise.teleport(x, y) — move player + sync GameState',
              'rise.setLevel(n) — award XP until level reached (cap 50)',
              'rise.clearInventory() — empty inventory',
              'rise.state() — one-line summary',
            ].join('\n');
          } catch { return 'help unavailable'; }
        },
        async give(itemId: string, qty = 1) {
          try {
            const n = Math.max(1, Math.floor(Number(qty) || 1));
            const { getItem } = await import('./data/items.ts');
            if (!getItem(itemId)) return `unknown item: ${itemId}`;
            const { addItem, countItem } = await import('./systems/InventorySystem.ts');
            const left = addItem(itemId, n);
            const got = n - left;
            if (got <= 0) return `inventory full — could not add ${itemId}`;
            return `gave ${got}x ${itemId} (have ${countItem(itemId)})`;
          } catch (e) { return `give failed: ${errMsg(e)}`; }
        },
        spawnEnemy(key: string, n = 1) {
          try {
            const ws = worldScene();
            if (!ws || typeof ws.spawnEnemy !== 'function') return 'world scene not running — enter the world first';
            const sp = ws.player?.sprite;
            if (!sp) return 'no player sprite yet';
            const count = Math.max(1, Math.min(20, Math.floor(Number(n) || 1)));
            let ok = 0;
            for (let i = 0; i < count; i++) {
              try {
                if (ws.spawnEnemy(key, sp.x + 60 + i * 40, sp.y + 40 - (i % 3) * 40)) ok++;
              } catch { /* keep spawning the rest */ }
            }
            if (!ok) return `unknown enemy: ${key}`;
            return `spawned ${ok}x ${key} near player`;
          } catch (e) { return `spawnEnemy failed: ${errMsg(e)}`; }
        },
        spawnResource(type: string, n = 1) {
          try {
            const ws = worldScene();
            if (!ws || typeof ws.spawnNode !== 'function') return 'world scene not running — enter the world first';
            const sp = ws.player?.sprite;
            if (!sp) return 'no player sprite yet';
            const count = Math.max(1, Math.min(20, Math.floor(Number(n) || 1)));
            const now = Date.now();
            let ok = 0;
            for (let i = 0; i < count; i++) {
              try {
                if (ws.spawnNode(type, sp.x - 80 - i * 48, sp.y - 60 + (i % 3) * 48, `debug_${now}_${i}`)) ok++;
              } catch { /* keep spawning the rest */ }
            }
            if (!ok) return `unknown resource: ${type}`;
            return `spawned ${ok}x ${type} near player`;
          } catch (e) { return `spawnResource failed: ${errMsg(e)}`; }
        },
        teleport(x: number, y: number) {
          try {
            const ws = worldScene();
            const sp = ws?.player?.sprite;
            if (!sp) return 'world scene not running or no player sprite';
            const nx = Number(x), ny = Number(y);
            if (!Number.isFinite(nx) || !Number.isFinite(ny)) return 'usage: rise.teleport(x, y)';
            try {
              if (sp.body && typeof sp.body.reset === 'function') sp.body.reset(nx, ny);
              else if (typeof sp.setPosition === 'function') sp.setPosition(nx, ny);
              else { sp.x = nx; sp.y = ny; }
            } catch { try { sp.x = nx; sp.y = ny; } catch { /* sprite write failed */ } }
            GameState.s.world.px = Math.round(nx);
            GameState.s.world.py = Math.round(ny);
            return `teleported to (${nx}, ${ny})`;
          } catch (e) { return `teleport failed: ${errMsg(e)}`; }
        },
        async setLevel(n: number) {
          try {
            const target = Math.max(1, Math.min(50, Math.floor(Number(n) || 1)));
            const P = GameState.s?.player;
            if (!P) return 'no player state';
            if (P.level >= target) return `already level ${P.level}`;
            const { awardXP, xpToNext } = await import('./systems/ProgressionXP.ts');
            let guard = 0;
            while (GameState.s.player.level < target && guard++ < 500) {
              awardXP(xpToNext(GameState.s.player.level), 'debug');
            }
            return `level ${GameState.s.player.level} (xp ${GameState.s.player.xp})`;
          } catch (e) { return `setLevel failed: ${errMsg(e)}`; }
        },
        clearInventory() {
          try {
            if (!GameState.s) return 'no game state';
            GameState.s.inventory = [];
            GameState.notify(CH.INVENTORY);
            return 'inventory cleared';
          } catch (e) { return `clearInventory failed: ${errMsg(e)}`; }
        },
        state() {
          try {
            const S = GameState.s;
            if (!S) return 'no game state';
            const P = (S.player || {}) as { name?: string; level?: number; hp?: number; gold?: number };
            const px = S.world?.px ?? '?', py = S.world?.py ?? '?';
            const home = S.settlement?.pos ? `@${S.settlement.pos.x},${S.settlement.pos.y}` : '';
            const settlement = S.settlement?.founded ? `settled${home}` : 'nomad';
            return `${P.name || '?'} lv${P.level ?? '?'} hp${P.hp ?? '?'} gold${P.gold ?? '?'} @(${px},${py}) ${settlement}`;
          } catch (e) { return `state failed: ${errMsg(e)}`; }
        },
      };
    } catch { /* debug console never breaks boot */ }
  }

  return game;
}

/** Error → message string (typed-safe catch helper). */
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** React asks to jump to a screen: world | menu. */
export function setScreen(screen: string): void {
  const S = GameState.s;
  void S;
  if (screen === 'world') {
    // Stop MenuScene so its backdrop, camera and particles don't render over WorldScene
    const ms = game?.scene?.getScene('MenuScene');
    if (ms && ms.scene.isActive()) {
      game?.scene.stop('MenuScene');
    }
    // Don't restart WorldScene if it's already running (e.g. intro → world)
    const ws = game?.scene?.getScene('WorldScene');
    if (!ws || !ws.scene.isActive()) {
      game?.scene.start('WorldScene');
    }
    currentSceneKey = 'WorldScene';
    GameState.session.screen = 'world';
    GameState.session.uiPanel = null;
    kingdomRefresh();
  } else {
    // Stop WorldScene so its world streaming, combat and update loop pause while in menu
    const ws = game?.scene?.getScene('WorldScene');
    if (ws && ws.scene.isActive()) {
      game?.scene.stop('WorldScene');
    }
    const ms = game?.scene?.getScene('MenuScene');
    if (!ms || !ms.scene.isActive()) {
      game?.scene.start('MenuScene');
    }
    currentSceneKey = 'MenuScene';
    GameState.session.screen = 'menu';
  }
  GameState.notify(CH.SCREEN);
}

/** Start a brand-new game from character creation. */
export function startNewGame(seed: number, charOpts: CharOpts, difficulty: DifficultyKey): void {
  GameState.newGame(seed, charOpts, difficulty);
  // The save's settings take over from the menu-time cache.
  clearMenuCache();
  // Apply settings (merge browser prefs over the freshly-created defaults) so
  // that uiScale, textSize, audio etc. take effect immediately on world entry.
  applySettings(withPrefs(GameState.s?.settings), { busNotify: false });
  recompute();
  game?.scene.stop('MenuScene');
  game?.scene.stop('WorldScene');
  game?.scene.start('WorldScene');
  currentSceneKey = 'WorldScene';
  GameState.session.screen = 'world';
  GameState.session.uiPanel = null;
  kingdomRefresh();
  GameState.notify(CH.SCREEN);
}

/** Load an existing save into the world. */
export function loadGameIntoWorld(saveData?: unknown): void {
  if (saveData) GameState.load(saveData);
  // The save's settings take over from the menu-time cache.
  clearMenuCache();
  // Re-apply prefs over the loaded save: prefs (browser-level) win unless the
  // save explicitly set them.
  applySettings(withPrefs(GameState.s?.settings), { busNotify: false });
  recompute();
  // Always stop MenuScene and cleanly start/restart WorldScene with the loaded save
  game?.scene.stop('MenuScene');
  game?.scene.stop('WorldScene');
  game?.scene.start('WorldScene');
  currentSceneKey = 'WorldScene';
  GameState.session.screen = 'world';
  GameState.session.uiPanel = null;
  kingdomRefresh();
  GameState.notify(CH.SCREEN);
  // Reboarding: returning players get a one-line recap, not a cold map.
  try {
    if ((GameState.s?.meta?.playSeconds || 0) > 600) {
      import('./systems/TutorialSystem.ts').then((m) => {
        try { GameState.toast({ title: '◈ The realm remembers', msg: m.welcomeBackText(), kind: 'quest', dur: 7000 }); }
        catch { /* toast only */ }
      }).catch(() => {});
    }
  } catch { /* recap never blocks loading */ }
}

/** React dispatches a scene command from UI actions. */
export function sceneCommand(cmd: string, arg?: unknown): void {
  switch (cmd) {
    case 'gather': (game?.scene.getScene('WorldScene') as WorldSceneHandle | null)?.doGather?.(); break;
    case 'placeBuild': setPendingBuild(arg as string); break;
    case 'togglePanel': (game?.scene.getScene('WorldScene') as WorldSceneHandle | null)?.togglePanel?.(arg); break;
    case 'togglePause': (game?.scene.getScene('WorldScene') as WorldSceneHandle | null)?.togglePause?.(); break;
    case 'float': break;
    case 'playSfx': playSfx(arg as string); break;
    default: break;
  }
}

function setPendingBuild(key: string): void {
  const s = GameState.session;
  s.uiPanel = null;
  s.pendingBuild = { key };
  (game?.scene.getScene('WorldScene') as WorldSceneHandle | null)?.enterBuildMode?.(key);
}

/** Returns the live world scene if running. */
export function worldScene(): WorldSceneHandle | null {
  try {
    return (game?.scene?.getScene('WorldScene') as WorldSceneHandle | undefined) ?? null;
  } catch {
    return null;
  }
}
