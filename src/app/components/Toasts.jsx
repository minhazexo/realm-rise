// Toast notifications (spec §66: every reward/occurrence gives feedback).
import React, { useEffect, useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';

const KIND_STYLE = {
  info: 'toast-info',
  warn: 'toast-warn',
  quest: 'toast-quest',
  story: 'toast-story',
  stage: 'toast-stage',
  discover: 'toast-discover',
  achievement: 'toast-achieve',
  skill: 'toast-skill',
  danger: 'toast-danger'
};

export default function Toasts() {
  const [toasts, setToasts] = useState([]);

  useGameState([CH.TOAST], () => {});

  useEffect(() => {
    const off = GameState._toastHandler || null;
    const handler = (payload) => {
      if (!payload) return;
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts, { ...payload, id }]);
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), payload.dur || 3800);
    };
    import('../../game/core/EventBus.js').then(({ Bus }) => {
      GameState._toastOff = Bus.on(CH.TOAST, handler);
    });
    return () => GameState._toastOff?.();
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${KIND_STYLE[t.kind] || 'toast-info'}`}>
          {t.icon && <span className="toast-icon">{t.icon}</span>}
          <div>
            <div className="toast-title">{t.title}</div>
            {t.msg && <div className="toast-msg">{t.msg}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
