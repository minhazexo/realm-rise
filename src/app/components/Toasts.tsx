// Toast notifications (spec §66: every reward/occurrence gives feedback).
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../game/core/GameState.ts';
import { CH } from '../../game/core/EventBus.ts';
import { useGameState } from '../../hooks/useGameState.ts';

const KIND_STYLE: Record<string, string> = {
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

interface ToastItem {
  id: number | string;
  title: string;
  msg?: string;
  kind: string;
  icon?: string;
  dur?: number;
}

export default function Toasts(): JSX.Element | null {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // GameState carries transient toast plumbing at runtime (game batch owns the type).
  const store = GameState as unknown as Record<string, any>;

  useGameState([CH.TOAST], () => {});

  useEffect(() => {
    const off = store._toastHandler || null;
    void off;
    const handler = (payload: any): void => {
      if (!payload) return;
      const id: number = Date.now() + Math.random();
      setToasts((ts) => [...ts, { ...payload, id }]);
      setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), payload.dur || 3800);
    };
        import('../../game/core/EventBus.ts').then(({ Bus }: any) => {
      store._toastOff = Bus.on(CH.TOAST, handler);
    });
    return () => store._toastOff?.();
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
