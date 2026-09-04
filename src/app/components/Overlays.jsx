// World interaction: Quest tracker (right side), Minimap (top-right),
// Dialogue modal, boss bar (top center).
import React, { useEffect } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import { questStateSnapshot } from '../../game/systems/QuestSystem.js';

export function QuestTracker() {
  const q = useGameState([CH.QUESTS, CH.SCREEN], () => {
    try {
      return questStateSnapshot();
    } catch {
      return null;
    }
  });
  if (!q || q.none || GameState.session.screen !== 'world') return null;

  return (
    <div className="quest-tracker">
      <div className="qt-title">✦ {q.title}</div>
      {q.steps.map((s, i) => (
        <div key={i} className={`qt-step ${s.done ? 'done' : ''}`}>
          <span className="qt-check">{s.done ? '✔' : '·'}</span>
          <span>{s.text}</span>
          {!s.done && <em className="qt-count">{s.have}/{s.need}</em>}
        </div>
      ))}
      {q.side?.map((sq) => (
        <div key={sq.id} className="qt-side">
          <div className="qt-side-title">{sq.title}</div>
        </div>
      ))}
    </div>
  );
}

const MM_ZOOMS = [0.5, 1, 2, 4];

export function Minimap() {
  const pos = useGameState([CH.PLAYER, CH.WORLD], () => ({
    x: GameState.s?.world?.px, y: GameState.s?.world?.py
  }));
  const [zoom, setZoom] = React.useState(GameState.session.minimapZoom || 1);
  const cycle = (dir) => {
    const i = Math.max(0, MM_ZOOMS.indexOf(zoom) < 0 ? 1 : MM_ZOOMS.indexOf(zoom));
    const next = MM_ZOOMS[Math.min(MM_ZOOMS.length - 1, Math.max(0, i + dir))];
    setZoom(next);
    GameState.session.minimapZoom = next;
  };
  return (
    <div className="minimap">
      <div className="mm-tl">✦</div>
      <div className="minimap-wrap">
        <canvas id="minimap-canvas" width="200" height="140" />
        <div className="mm-zoom">
          <button onClick={() => cycle(-1)} title="Zoom out">−</button>
          <button onClick={() => cycle(1)} title="Zoom in">+</button>
        </div>
      </div>
    </div>
  );
}

export function AchievementPopup() {
  const ach = useGameState([CH.ACHIEVEMENTS], () => GameState.session.lastAchievement);
  React.useEffect(() => {
    if (!ach) return;
    const t = setTimeout(() => {
      if (GameState.session.lastAchievement?.id === ach.id) {
        GameState.session.lastAchievement = null;
        GameState.notify(CH.ACHIEVEMENTS);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [ach?.id]);
  if (!ach || Date.now() - (ach.at || 0) > 6000) return null;
  return (
    <div className="achieve-popup">
      <b>🏆 {ach.name}</b>
      <span>{ach.desc}</span>
    </div>
  );
}

export function BossBar() {
  const boss = useGameState([CH.BOSSBAR], () => ({
    name: GameState.session.activeBoss?.name,
    hp: GameState.session.activeBoss?.hp,
    maxHp: GameState.session.activeBoss?.maxHp,
    phase: GameState.session.activeBoss?.phase
  }));
  if (!boss?.name) return null;
  const pct = Math.max(0, Math.min(100, boss.hp / boss.maxHp * 100));
  return (
    <div className="bossbar">
      <div className="boss-name">{boss.name}</div>
      <div className="boss-hp"><div style={{ width: pct + '%' }} /></div>
      {boss.phase > 0 && <div className="boss-phase">PHASE {boss.phase}</div>}
    </div>
  );
}

export function Dialogue() {
  const d = useGameState([CH.DIALOGUE], () => GameState.session.dialogue);
  useEffect(() => {
    if (d) {
      const off = import('../../game/core/EventBus.js').then(({ Bus }) => Bus.emit('play-sound', 'ui_open'));
    }
  }, [d?.npc]);

  if (!d) return null;

  const run = (fn, arg) => {
    if (fn === 'offerSideQuest') {
      import('../../game/systems/QuestSystem.js').then((m) => m.offerSideQuest(arg));
    } else if (fn === 'recruitNpc') {
      import('../../game/main.js').then((m) => m.worldScene()?.recruitNpcFrom?.(arg));
    } else if (fn === 'openTrade') {
      import('../../game/main.js').then((m) => m.worldScene()?.openTradeFor?.(arg));
    }
    if (fn !== 'openTrade') {
      GameState.session.dialogue = null;
      import('../../game/core/EventBus.js').then(({ Bus }) => Bus.emit('UI', null));
    }
  };

  return (
    <div className="dialogue-backdrop" onClick={() => { GameState.session.dialogue = null; }}>
      <div className="dialogue" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-portrait" style={{ background: d.portrait }} />
        <div className="dlg-body">
          <div className="dlg-name">{d.name}</div>
          <div className="dlg-lines">{d.lines.join('\n')}</div>
          {d.actions?.length > 0 && (
            <div className="dlg-actions">
              {d.actions.map((a, i) => <button key={i} className="btn btn-small" onClick={() => run(a.fn, a.arg)}>{a.label}</button>)}
            </div>
          )}
          <button className="btn btn-small dlg-close" onClick={() => { GameState.session.dialogue = null; }}>Farewell</button>
        </div>
      </div>
    </div>
  );
}
