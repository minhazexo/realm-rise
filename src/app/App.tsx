// Top-level React shell (spec §56): renders overlays based on GameState screen
// and session.uiPanel. The Phaser canvas sits behind, always interactive.
import type { JSX } from 'react';
import GameState from '../game/core/GameState.ts';
import { CH } from '../game/core/EventBus.ts';
import { useGameState } from '../hooks/useGameState.ts';
import MainMenu from './components/MainMenu.tsx';
import CharacterCreation from './components/CharacterCreation.tsx';
import IntroOverlay from './components/IntroOverlay.tsx';
import HUD from './components/HUD.tsx';
import Toasts from './components/Toasts.tsx';
import Dialogue from './components/Dialogue.ts';
import QuestTracker from './components/QuestTracker.ts';
import { FirstSteps } from './components/Overlays.tsx';
import { ZoomControls } from './components/Overlays.tsx';
import Minimap from './components/Minimap.ts';
import Panels from './components/Panels.tsx';
import TouchControls from './components/TouchControls.tsx';
import DeathOverlay from './components/DeathOverlay.tsx';
import BossBar from './components/BossBar.ts';
import AchievementPopup from './components/AchievementPopup.ts';
import RulerPanel from './components/RulerPanel.tsx';
import DebugPanel from './components/DebugPanel.tsx';

interface AppUiSnapshot {
  screen?: string;
  panel?: string | null;
  paused?: boolean;
  dialogue?: unknown;
  dead?: unknown;
  isMobile?: boolean;
  ending?: unknown;
  debugVisible?: boolean;
}

// GameState.session gains dynamic UI-only fields at runtime (game batch owns the type).
type SessionExtras = Record<string, any>;
const uiSession = GameState.session as unknown as SessionExtras;

const select = (): AppUiSnapshot => ({
  screen: GameState.session?.screen,
  panel: GameState.session?.uiPanel,
  paused: GameState.session?.paused,
  dialogue: GameState.session?.dialogue,
  dead: GameState.s?.session_dead,
  isMobile: uiSession.isMobile,
  ending: uiSession.ending,
  debugVisible: GameState.session?.debugVisible
});

export default function App(): JSX.Element {
  const ui = useGameState([CH.SCREEN, CH.WORLD, CH.DIALOGUE, CH.STORY, CH.PLAYER], select) as AppUiSnapshot;

  return (
    <div className="app-root">
      <div id="game-container" className="game-canvas" />
      <div className="ui-scale-wrapper">
        {ui.screen === 'menu' && <MainMenu />}
        {ui.screen === 'creation' && <CharacterCreation />}
        {ui.screen === 'intro' && <IntroOverlay />}
        {ui.screen === 'world' && (
          <>
            <HUD />
            <QuestTracker />
            <FirstSteps />
            <Minimap />
            <ZoomControls />
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
    </div>
  );
}
