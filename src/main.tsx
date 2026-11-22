// React entry point. Creates the Phaser game (behind a live canvas) and mounts
// the React UI overlay that adapts to the current screen.
//
// Storage boots FIRST: in a desktop shell the save file has to be in memory
// before any component reads a slot or a settings pref. On the web this is a
// no-op, so the browser path is unchanged.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from './game/main.ts';
import GameState from './game/core/GameState.ts';
import { randomSeed } from './utils/math.ts';
import { bootDesktopStorage } from './platform/desktop.ts';
import './styles.css';
import App from './app/App.tsx';

// give the game a floating seed for the menu backdrop irrespective of saves
GameState._menuSeed = randomSeed();

/** Boot the Phaser instance as soon as the container exists. */
function boot(): void {
  const el = document.getElementById('game-container');
  if (!el) {
    setTimeout(boot, 50);
    return;
  }
  createGame('game-container');
}

async function start(): Promise<void> {
  await bootDesktopStorage();
  // #root is declared in index.html, so the non-null assertion is verified safe.
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
  boot();
}

void start();
