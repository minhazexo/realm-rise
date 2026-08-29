// Main menu (spec §40). Animated kingdom backdrop lives in MenuScene; this
// renders the buttons + save slots + settings over it.
import React, { useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import { listSaves } from '../../game/systems/SaveSystem.js';
import { randomSeed } from '../../utils/math.js';
import SettingsPanel from './SettingsPanel.jsx';
import HowTo from './HowTo.jsx';
import Credits from './Credits.jsx';

export default function MainMenu() {
  const [view, setView] = useState('menu'); // menu | new | load | settings | how | credits
  const [difficulty, setDifficulty] = useState('normal');
  const [saves, setSaves] = useState(() => listSaves());
  const hasContinue = !!saves.auto;

  useGameState([CH.SCREEN], () => {});

  const goNew = () => {
    GameState.session.screen = 'creation';
    GameState.session.creationDifficulty = difficulty;
    GameState.notify(CH.SCREEN);
  };

  const continueGame = () => {
    import('../../game/systems/SaveSystem.js').then(({ loadFromSlot }) => {
      const data = loadFromSlot('auto');
      import('../../game/main.js').then((m) => m.loadGameIntoWorld(data));
    });
  };

  const loadSlot = (slot) => {
    import('../../game/systems/SaveSystem.js').then(({ loadFromSlot }) => {
      const data = loadFromSlot(slot);
      if (data) import('../../game/main.js').then((m) => m.loadGameIntoWorld(data));
      else { setSaves(listSaves()); }
    });
  };

  return (
    <div className="menu-root">
      <div className="menu-title-wrap">
        <h1 className="menu-title">RISE OF THE REALM</h1>
        <div className="menu-subtitle">A Kingdom Adventure</div>
      </div>

      {view === 'menu' && (
        <div className="menu-panel">
          <button className="btn btn-menu btn-gold" disabled={!hasContinue} onClick={continueGame}>CONTINUE</button>
          <button className="btn btn-menu" onClick={goNew}>NEW GAME</button>
          <button className="btn btn-menu" onClick={() => { setSaves(listSaves()); setView('load'); }}>LOAD GAME</button>
          <button className="btn btn-menu" onClick={() => setView('settings')}>SETTINGS</button>
          <button className="btn btn-menu" onClick={() => setView('how')}>HOW TO PLAY</button>
          <button className="btn btn-menu" onClick={() => setView('credits')}>CREDITS</button>
          <div className="menu-difficulty">
            <label>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="story">Story</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>
        </div>
      )}

      {view === 'load' && (
        <div className="menu-panel">
          <h2>Load Game</h2>
          {['auto', 'slot1', 'slot2', 'slot3'].map((slot) => {
            const s = saves[slot];
            return (
              <button key={slot} className="save-slot" onClick={() => loadSlot(slot)} disabled={!s}>
                {s
                  ? <span className="save-meta">
                      <b>{s.name}</b> · Lv {s.level} · {['','Camp','Village','Town','City','Kingdom','Empire'][Math.max(0, s.stage + 1)] || '—'} · Day {s.day} · ♥ {s.founded ? 'home' : 'wanderer'}
                    </span>
                  : <em>Empty slot</em>}
              </button>
            );
          })}
          <button className="btn btn-menu btn-small" onClick={() => setView('menu')}>BACK</button>
        </div>
      )}

      {view === 'settings' && <SettingsPanel onBack={() => setView('menu')} />}
      {view === 'how' && <HowTo onBack={() => setView('menu')} />}
      {view === 'credits' && <Credits onBack={() => setView('menu')} />}
    </div>
  );
}
