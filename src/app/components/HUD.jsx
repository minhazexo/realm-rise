// In-game HUD (spec §39): health/stamina/food/water/gold bars, hotbar, panel toggles.
import React from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import { sceneCommand } from '../../game/main.js';
import { formatNum } from '../../utils/math.js';
import { DIFFICULTY } from '../../game/core/Constants.js';

const select = () => {
  const S = GameState.s;
  const D = S?.player?.derived;
  return {
    hp: S?.player?.hp, maxHp: D?.maxHp || 100,
    stam: S?.player?.stamina, maxStam: D?.maxStamina || 100,
    hunger: S?.player?.hunger, thirst: S?.player?.thirst,
    gold: S?.player?.gold, level: S?.player?.level, xp: S?.player?.xp,
    name: S?.player?.name, rep: S?.player?.reputation,
    difficulty: S?.settings?.difficulty, stage: S?.settlement?.founded ? S?.settlement?.stageIndex : -1,
    time: S?.world?.timeOfDay, day: S?.world?.dayCount,
    weather: S?.world?.activeWeather, panel: GameState.session?.uiPanel
  };
};

export default function HUD() {
  const h = useGameState([CH.PLAYER, CH.INVENTORY, CH.SETTLEMENT, CH.TIME, CH.WEATHER, CH.SCREEN], select);
  if (!h || h.hp === undefined) return null;

  const pct = (v, m) => Math.max(0, Math.min(100, (v / (m || 1)) * 100));
  const stageName = ['Wanderer','Camp','Village','Town','City','Kingdom','Empire'][Math.max(0, h.stage + 1)];

  const toggle = (p) => sceneCommand('togglePanel', GameState.session.uiPanel === p ? null : p);

  return (
    <div className="hud-root pointer-none">
      {/* top bars */}
      <div className="hud-top">
        <div className="vitals">
          <div className="stat-row hp"><div className="stat-fill" style={{ width: pct(h.hp, h.maxHp) + '%' }} /><span>❤ {Math.ceil(h.hp)}/{h.maxHp}</span></div>
          <div className="stat-row stam"><div className="stat-fill" style={{ width: pct(h.stam, h.maxStam) + '%' }} /><span>⚡ {Math.ceil(h.stam)}</span></div>
          <div className="stat-row food"><div className="stat-fill" style={{ width: pct(h.hunger, 100) + '%' }} /><span>🍖 {Math.ceil(h.hunger)}</span></div>
          <div className="stat-row water"><div className="stat-fill" style={{ width: pct(h.thirst, 100) + '%' }} /><span>💧 {Math.ceil(h.thirst)}</span></div>
        </div>
        <div className="hud-meter">
          <div className="level-pill">Lv {h.level}</div>
          <div className="xp-bar"><div className="xp-fill" style={{ width: (h.xp / xpNeed(h.level) * 100) + '%' }} /></div>
          <div className="resource-pill">🪙 {formatNum(h.gold)}</div>
        </div>
        <div className="ambience"><span>{h.day && `Day ${h.day}`} · {timeStr(h.time)}</span> · {weatherIcon(h.weather)}</div>
      </div>

      {/* bottom hotbar + panel toggles */}
      <div className="hud-bottom">
        <div className="hotbar">
          {['I','C','M','J','K','B','P'].map(([key], i) => null)}
          {[
            ['I', 'inventory', '🎒'], ['C', 'crafting', '⚒'], ['B', 'build', '🏗'],
            ['M', 'map', '🗺'], ['J', 'journal', '📜'], ['K', 'kingdom', '🏰'], ['P', 'skills', '✦'], ['T', 'character', '🛡']
          ].map(([key, panel, icon]) => (
            <button key={key} className={`hotbar-btn ${h.panel === panel ? 'on' : ''}`} onClick={() => toggle(panel)}>
              <span className="hb-icon">{icon}</span>
              <span className="hb-key">{key}</span>
            </button>
          ))}
        </div>
        <div className="hud-footer">
          <span className="diff-pill">{DIFFICULTY[h.difficulty]?.label}</span>
          <span className="stage-pill">{stageName}</span>
          <span className="rep-pill">♛ {h.rep}</span>
        </div>
      </div>

      <div className="hud-controls-hint hide-tablet">
        WASD move · Mouse click attack · E gather · Shift sprint · Space dodge · Right-click block
      </div>
    </div>
  );
}

function xpNeed(lv) {
  return Math.round(58 + Math.pow(lv, 1.62) * 17);
}
function timeStr(t) {
  const total = t * 24;
  const hh = Math.floor(total);
  const mm = Math.floor((total - hh) * 60);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}
function weatherIcon(w) {
  return { clear: '☀', drizzle: '🌦', storm: '⛈', fog: '🌫', snow: '❄', heat: '☀🔥' }[w] || '☁';
}
