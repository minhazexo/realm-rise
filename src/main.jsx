// React entry point. Creates the Phaser game (behind a live canvas) and mounts
// the React UI overlay that adapts to the current screen.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from './game/main.js';
import GameState from './game/core/GameState.js';
import { randomSeed } from './utils/math.js';
import './styles.css';
import App from './app/App.jsx';

// give the game a floating seed for the menu backdrop irrespective of saves
GameState._menuSeed = randomSeed();

const root = createRoot(document.getElementById('root'));
root.render(<App />);

// Boot the Phaser instance as soon as the container exists.
function boot() {
  const el = document.getElementById('game-container');
  if (!el) {
    setTimeout(boot, 50);
    return;
  }
  createGame('game-container');
}
boot();
