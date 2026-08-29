// Debug panel (spec §81): dev-only tools for testing.
import React from 'react';
import GameState from '../../game/core/GameState.js';
import { useGameState } from '../../hooks/useGameState.js';
import { CH } from '../../game/core/EventBus.js';

export default function DebugPanel({ visible }) {
  // Always call hooks first (React rules)
  useGameState([CH.PLAYER, CH.WORLD], () => null);
  if (!visible) return null;
  const S = GameState.s;
  if (!S) return null;
  const D = S.player.derived;

  const btn = (label, fn) => (
    <button onClick={fn} style={{
      padding: '2px 6px', fontSize: 10,
      background: 'rgba(36,29,23,0.6)', color: 'var(--parch)',
      border: '1px solid var(--gold-dim)', borderRadius: 3, cursor: 'pointer'
    }}>{label}</button>
  );

  const grid = [
    { label: 'wood', icon: '🌲' }, { label: 'stone', icon: '🪨' },
    { label: 'food', icon: '🍗' }, { label: 'iron_ore', icon: '⛏' },
    { label: 'gold', icon: '🪙' }, { label: 'herbs', icon: '🌿' }
  ];

  return (
    <div className="debug-panel active" style={{ maxHeight: 400, overflow: 'auto' }}>
      <div style={{ color: '#c9a24b', fontFamily: 'Cinzel', fontSize: 12, marginBottom: 6 }}>DEBUG PANEL</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', fontSize: 10 }}>
        <div>Pos: {Math.round(S.world.px || 0)}, {Math.round(S.world.py || 0)}</div>
        <div>Lv: {S.player.level} | XP: {S.player.xp}/{S.player.derived?.maxXp || '∞'}</div>
        <div>HP: {S.player.hp}/{D.maxHp}</div>
        <div>Stamina: {S.player.stamina}/{D.maxStamina}</div>
        <div>Stage: {S.settlement.stageIndex}/{6}</div>
        <div>Citizens: {S.settlement.citizens.length}</div>
        <div>Owned: {S.world.ownedCamps.length}</div>
        <div>Time: {Math.round((S.world.timeOfDay * 24) * 10) / 10}h</div>
      </div>
      <div style={{ margin: '4px 0', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {grid.map((g) => btn(g.icon + ' ' + g.label, () => {
          import('../../game/systems/InventorySystem.js').then((m) => m.addItem(g.label, 50));
        }))}
                {btn('XP+1k', () => import('../../game/systems/ProgressionXP.js').then((m) => m.awardXP(1000, 'debug')))}
        {btn('Gold+500', () => import('../../game/systems/ProgressionXP.js').then((m) => m.addGold(500)))}
        {btn('Heal', () => { S.player.hp = D.maxHp; GameState.notify('PLAYER'); })}
        {btn('Lvl+5', () => {
          for (let i = 0; i < 5; i++) {
            import('../../game/systems/ProgressionXP.js').then((m) => m.awardXP(9999, 'debug'));
          }
        })}
      </div>
    </div>
  );
}
