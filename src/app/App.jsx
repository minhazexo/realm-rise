// Top-level React shell (spec §56): renders overlays based on GameState screen
// and session.uiPanel. The Phaser canvas sits behind, always interactive.
import React from 'react';
import GameState from '../game/core/GameState.js';
import { CH } from '../game/core/EventBus.js';
import { useGameState } from '../hooks/useGameState.js';
import MainMenu from './components/MainMenu.jsx';
import CharacterCreation from './components/CharacterCreation.jsx';
import IntroOverlay from './components/IntroOverlay.jsx';
import HUD from './components/HUD.jsx';
import Toasts from './components/Toasts.jsx';
import Dialogue from './components/Dialogue.jsx';
import QuestTracker from './components/QuestTracker.jsx';
import Minimap from './components/Minimap.jsx';
import Panels from './components/Panels.jsx';
import TouchControls from './components/TouchControls.jsx';
import DeathOverlay from './components/DeathOverlay.jsx';
import BossBar from './components/BossBar.jsx';
import AchievementPopup from './components/AchievementPopup.jsx';
import RulerPanel from './components/RulerPanel.jsx';
import DebugPanel from './components/DebugPanel.jsx';

const select = () => ({
  screen: GameState.session?.screen,
  panel: GameState.session?.uiPanel,
  paused: GameState.session?.paused,
  dialogue: GameState.session?.dialogue,
  dead: GameState.s?.session_dead,
  isMobile: GameState.session?.isMobile,
  ending: GameState.session?.ending,
  debugVisible: GameState.session?.debugVisible
});

export default function App() {
  const ui = useGameState([CH.SCREEN, CH.WORLD, CH.DIALOGUE, CH.STORY, CH.PLAYER], select);

  return (
    <div className="app-root">
      <div id="game-container" className="game-canvas" />
      {ui.screen === 'menu' && <MainMenu />}
      {ui.screen === 'creation' && <CharacterCreation />}
      {ui.screen === 'intro' && <IntroOverlay />}
      {ui.screen === 'world' && (
        <>
          <HUD />
          <QuestTracker />
          <Minimap />
          <BossBar />
          <AchievementPopup />
          {ui.panel && <Panels panel={ui.panel} />}
          {ui.dialogue && <Dialogue />}
          {ui.ending && <RulerPanel />}
          {ui.dead && <DeathOverlay />}
          {ui.isMobile && <TouchControls />}
        </>
      )}
      <Toasts />
      <DebugPanel visible={ui.debugVisible} />
    </div>
  );
}
