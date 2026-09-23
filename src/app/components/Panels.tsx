// ─────────────────────────────────────────────────────────────────────────────
// Panel hub (spec §39–43): picks the panel the session asked for and frames it.
//
// The panels themselves live in ./panels/<Name>.tsx — one file each, so a
// maintainer can find the inventory without reading the map. This file owns the
// frame and the dispatch, nothing else.
// ─────────────────────────────────────────────────────────────────────────────
import type { JSX } from 'react';
import GameState from '../../game/core/GameState.ts';
import { CH } from '../../game/core/EventBus.ts';
import * as panels from './panels/index.ts';

interface PanelsProps {
  panel: string | null | undefined;
}

const BY_NAME: Record<string, () => JSX.Element | null> = {
  inventory: panels.InventoryPanel,
  crafting: panels.CraftingPanel,
  skills: panels.SkillsPanel,
  build: panels.BuildPanel,
  kingdom: panels.KingdomPanel,
  map: panels.MapPanel,
  journal: panels.JournalPanel,
  character: panels.CharacterPanel,
  save: panels.SavePanel,
  trade: panels.TradePanel,
  pause: panels.PausePanel
};

export default function Panels({ panel }: PanelsProps): JSX.Element | null {
  const Panel = panel ? BY_NAME[panel] : undefined;
  if (!Panel) return null;
  const close = (): void => {
    GameState.session.uiPanel = null;
    GameState.session.paused = false;
    GameState.notify(CH.SCREEN);
    import('../../game/core/EventBus.ts').then(({ Bus }: any) => Bus.emit('play-sound', 'ui_click'));
  };
  return (
    <div className="panel-layer">
      <div className="panel-wrap">
        <Panel />
        <button className="panel-close" onClick={close} aria-label="Close panel">✕</button>
      </div>
    </div>
  );
}
