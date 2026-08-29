// Settings screen (spec §59, §58): volumes, toggles, accessibility, difficulty.
import React, { useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';

export default function SettingsPanel({ onBack }) {
  const s = useGameState([CH.SETTINGS], () => GameState.s?.settings);
  if (!s) return null;
  const set = (mut) => {
    mut(s);
    GameState.notify(CH.SETTINGS);
    import('../../game/systems/AudioSystem.js').then((a) => a.applyVolumes());
    import('../../game/core/EventBus.js').then(({ Bus }) => Bus.emit('refresh-ui'));
  };
  const setV = (k, v) => set((x) => { x.volumes[k] = v; });
  const setT = (k, v) => set((x) => { x.toggles[k] = v; });

  return (
    <div className="panel settings-panel">
      <h2>Settings</h2>
      <div className="setting-group">
        <h4>Audio</h4>
        <label>Master <Slider v={s.volumes.master} onV={(v) => setV('master', v)} /></label>
        <label>Music <Slider v={s.volumes.music} onV={(v) => setV('music', v)} /></label>
        <label>SFX <Slider v={s.volumes.sfx} onV={(v) => setV('sfx', v)} /></label>
        <label><input type="checkbox" checked={s.toggles.musicOn !== false} onChange={(e) => setT('musicOn', e.target.checked)} /> Music enabled</label>
        <label><input type="checkbox" checked={s.toggles.sfxOn !== false} onChange={(e) => setT('sfxOn', e.target.checked)} /> SFX enabled</label>
      </div>
      <div className="setting-group">
        <h4>Graphics & Feel</h4>
        <label><input type="checkbox" checked={s.toggles.screenShake !== false} onChange={(e) => setT('screenShake', e.target.checked)} /> Screen shake</label>
        <label><input type="checkbox" checked={s.toggles.reducedMotion !== true} onChange={(e) => setT('reducedMotion', e.target.checked)} /> Reduced motion</label>
        <label>Particles
          <select value={s.particles} onChange={(e) => set((x) => { x.particles = e.target.value; })}>
            <option value="high">High</option><option value="med">Medium</option><option value="low">Low</option>
          </select>
        </label>
        <label>UI Scale <Slider v={s.uiScale} min={0.8} max={1.4} onV={(v) => set((x) => { x.uiScale = v; })} /></label>
      </div>
      <div className="setting-group">
        <h4>Gameplay</h4>
        <label>Difficulty
          <select value={s.difficulty} onChange={(e) => set((x) => { x.difficulty = e.target.value; })}>
            <option value="story">Story</option><option value="normal">Normal</option>
            <option value="hard">Hard</option><option value="legendary">Legendary</option>
          </select>
        </label>
        <label><input type="checkbox" checked={s.autosave !== false} onChange={(e) => set((x) => { x.autosave = e.target.checked; })} /> Auto-save</label>
      </div>
      {onBack && <button className="btn btn-menu btn-small" onClick={onBack}>BACK</button>}
    </div>
  );
}

function Slider({ v, onV, min = 0, max = 1 }) {
  return <input type="range" min={min} max={max} step={0.05} value={v} onChange={(e) => onV(parseFloat(e.target.value))} />;
}
