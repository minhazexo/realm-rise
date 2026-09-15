// Main menu (spec §40). Animated kingdom backdrop lives in MenuScene; this
// renders the buttons + save slots + settings over it.
import { useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../game/core/GameState.ts';
import { CH } from '../../game/core/EventBus.ts';
import { useGameState } from '../../hooks/useGameState.ts';
import { listSaves } from '../../game/systems/SaveSystem.ts';
import { randomSeed } from '../../utils/math.ts';
import SettingsPanel from './SettingsPanel.tsx';
import HowTo from './HowTo.tsx';
import Credits from './Credits.tsx';

interface SaveSummary {
  name: string;
  level: number;
  stage: number;
  day: number;
  founded: boolean;
}

type SaveMap = Record<string, SaveSummary | undefined>;

// Keep the unused import referenced (menu seed helper for future use).
void randomSeed;

export default function MainMenu(): JSX.Element {
  const [view, setView] = useState<string>('menu'); // menu | new | load | settings | how | credits
  const [difficulty, setDifficulty] = useState<string>('normal');
  const [saves, setSaves] = useState<SaveMap>(() => listSaves() as SaveMap);
  const hasContinue: boolean = !!saves.auto;

  useGameState([CH.SCREEN], () => {});

  const goNew = (): void => {
    GameState.session.screen = 'creation';
    (GameState.session as unknown as Record<string, any>).creationDifficulty = difficulty;
    GameState.notify(CH.SCREEN);
  };

  const continueGame = (): void => {
        import('../../game/systems/SaveSystem.ts').then(({ loadFromSlot }: any) => {
      const data: any = loadFromSlot('auto');
            import('../../game/main.ts').then((m: any) => m.loadGameIntoWorld(data));
    });
  };

  const loadSlot = (slot: string): void => {
        import('../../game/systems/SaveSystem.ts').then(({ loadFromSlot }: any) => {
      const data: any = loadFromSlot(slot);
            if (data) import('../../game/main.ts').then((m: any) => m.loadGameIntoWorld(data));
      else { setSaves(listSaves() as SaveMap); }
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
          <button className="btn btn-menu" onClick={() => { setSaves(listSaves() as SaveMap); setView('load'); }}>LOAD GAME</button>
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
