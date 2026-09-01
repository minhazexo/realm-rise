// Phaser game bootstrap (spec §56). The game canvas lives behind a transparent
// React overlay; switching `screen` flips scenes via this controller.
import Phaser from 'phaser';
import GameState from './core/GameState.js';
import { Bus, CH } from './core/EventBus.js';
import MenuScene from './scenes/MenuScene.js';
import WorldScene from './scenes/WorldScene.js';
import { initAudio, installAudioBus, playSfx, applyVolumes } from './systems/AudioSystem.js';
import { installBridge } from './core/BridgeSystem.js';
import { recompute } from './systems/ProgressionSystem.js';
import { refresh as kingdomRefresh } from './systems/KingdomSystem.js';
import { installSettingsSystem, applySettings, withPrefs, clearMenuCache } from './systems/SettingsSystem.js';

export let game = null;
export let currentSceneKey = 'MenuScene';

export function createGame(containerId = 'game-container') {
  const el = document.getElementById(containerId);
  game = new Phaser.Game({
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
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scene: [MenuScene, WorldScene]
  });

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
  installBridge();
  Bus.on('play-sound', (name) => playSfx(name));

  window.addEventListener('resize', () => {
    if (game) game.scale.refresh();
  });

  return game;
}

/** React asks to jump to a screen: world | menu. */
export function setScreen(screen) {
  const S = GameState.s;
  if (screen === 'world') {
    // Don't restart WorldScene if it's already running (e.g. intro → world)
    const ws = game?.scene?.getScene('WorldScene');
    if (!ws || !ws.scene.isActive()) {
      game.scene.start('WorldScene');
    }
    currentSceneKey = 'WorldScene';
    GameState.session.screen = 'world';
    GameState.session.uiPanel = null;
    kingdomRefresh();
  } else {
    const ms = game?.scene?.getScene('MenuScene');
    if (!ms || !ms.scene.isActive()) {
      game.scene.start('MenuScene');
    }
    currentSceneKey = 'MenuScene';
    GameState.session.screen = 'menu';
  }
  GameState.notify(CH.SCREEN);
}

/** Start a brand-new game from character creation. */
export function startNewGame(seed, charOpts, difficulty) {
  GameState.newGame(seed, charOpts, difficulty);
  // The save's settings take over from the menu-time cache.
  clearMenuCache();
  // Apply settings (merge browser prefs over the freshly-created defaults) so
  // that uiScale, textSize, audio etc. take effect immediately on world entry.
  applySettings(withPrefs(GameState.s?.settings), { busNotify: false });
  recompute();
  setScreen('world');
}

/** Load an existing save into the world. */
export function loadGameIntoWorld(saveData) {
  if (saveData) GameState.load(saveData);
  // The save's settings take over from the menu-time cache.
  clearMenuCache();
  // Re-apply prefs over the loaded save: prefs (browser-level) win unless the
  // save explicitly set them.
  applySettings(withPrefs(GameState.s?.settings), { busNotify: false });
  recompute();
  setScreen('world');
}

/** React dispatches a scene command from UI actions. */
export function sceneCommand(cmd, arg) {
  switch (cmd) {
    case 'gather': game.scene.getScene('WorldScene')?.doGather?.(); break;
    case 'placeBuild': setPendingBuild(arg); break;
    case 'togglePanel': game.scene.getScene('WorldScene')?.togglePanel?.(arg); break;
    case 'togglePause': game.scene.getScene('WorldScene')?.togglePause?.(); break;
    case 'float': break;
    case 'playSfx': playSfx(arg); break;
    default: break;
  }
}

function setPendingBuild(key) {
  const s = GameState.session;
  s.uiPanel = null;
  s.pendingBuild = { key };
  game.scene.getScene('WorldScene')?.enterBuildMode?.(key);
}

/** Returns the live world scene if running. */
export function worldScene() {
  try {
    return game?.scene?.getScene('WorldScene');
  } catch {
    return null;
  }
}
