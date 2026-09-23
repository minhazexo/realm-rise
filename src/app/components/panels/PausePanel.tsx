// PausePanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { SKILLS } from '../../../game/data/skills.ts';
import { saveToSlot } from '../../../game/systems/SaveSystem.ts';
import { sceneCommand } from '../../../game/main.ts';
import { close } from './shared.tsx';

/* ── Pause ────────────────────────────────────────────────────────────── */
export function PausePanel(): JSX.Element {
  const go = (name: string): void => sceneCommand('togglePanel', name);
  const quit = (): void => {
    GameState.session.uiPanel = null;
    GameState.session.paused = false;
        import('../../../game/main.ts').then((m: any) => m.setScreen('menu'));
  };
  const saveNow = (): void => {
    saveToSlot('auto', GameState.s);
    GameState.toast({ title: 'Game saved', msg: 'Progress secured.', dur: 1800, icon: undefined });
  };
  return (
    <div className="panel pause-panel">
      <h2>Paused</h2>
      <div className="pause-grid">
        <button className="btn btn-menu" onClick={close}>RESUME</button>
        <button className="btn btn-menu" onClick={() => go('inventory')}>INVENTORY</button>
        <button className="btn btn-menu" onClick={() => go('crafting')}>CRAFTING</button>
        <button className="btn btn-menu" onClick={() => go('journal')}>JOURNAL</button>
        <button className="btn btn-menu" onClick={() => go('map')}>MAP</button>
        <button className="btn btn-menu" onClick={() => go('skills')}>SKILLS</button>
        <button className="btn btn-menu" onClick={() => go('kingdom')}>KINGDOM</button>
        <button className="btn btn-menu" onClick={() => go('character')}>CHARACTER</button>
        <button className="btn btn-menu" onClick={() => go('save')}>SAVE / LOAD</button>
        <button className="btn btn-menu" onClick={saveNow}>QUICK SAVE</button>
        <button className="btn btn-menu" onClick={quit}>QUIT TO MENU</button>
      </div>
    </div>
  );
}
