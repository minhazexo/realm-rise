// Touch controls (spec §5): virtual joystick, attack, dodge, block, interaction buttons.
import { useEffect, useRef, useState } from 'react';
import type { JSX, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import GameState from '../../game/core/GameState.ts';
import { CH } from '../../game/core/EventBus.ts';

export default function TouchControls(): JSX.Element | null {
  const [visible, setVisible] = useState<boolean>(true);
  const joyStickRef = useRef<HTMLDivElement | null>(null);
  const activePointer = useRef<unknown>(null);
  void activePointer;
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  void centerRef;
  // GameState.session carries dynamic mobile/session fields at runtime (game batch owns the type).
  const uiSession = GameState.session as unknown as Record<string, any>;

  useEffect(() => {
    const handler = (): void => setVisible(GameState.session.screen === 'world');
    handler();
    uiSession._onScreenChange = handler;
  }, []);

  const handleJoy = (e: ReactTouchEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>): void => {
    if (!joyStickRef.current) return;
    const rect: DOMRect = joyStickRef.current.getBoundingClientRect();
    const cx: number = rect.left + rect.width / 2;
    const cy: number = rect.top + rect.height / 2;
    const move = (ev: any): void => {
      const dx: number = ev.touches ? ev.touches[0].clientX - cx : ev.clientX - cx;
      const dy: number = ev.touches ? ev.touches[0].clientY - cy : ev.clientY - cy;
      const dist: number = Math.min(60, Math.hypot(dx, dy));
      const angle: number = Math.atan2(dy, dx);
      const pad = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
      uiSession.joystick = pad;
    };
    const stop = (): void => {
      uiSession.joystick = { x: 0, y: 0 };
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    if (e.type === 'touchstart' || e.type === 'mousedown') {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
      if ('touches' in e && e.touches) { window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop); }
      move('touches' in e ? e.touches[0] : e);
    }
  };

  if (!visible) return null;

  return (
    <div className="touch-controls">
      <div ref={joyStickRef} className="tc-joystick-area" onTouchStart={handleJoy} onMouseDown={handleJoy} />
      <div className="tc-action-btns">
        <button className="tc-btn" onTouchStart={(e) => { e.preventDefault(); uiSession.mobileInteract = true; }}
          onTouchEnd={() => { uiSession.mobileInteract = false; }}
          onMouseDown={() => { uiSession.mobileInteract = true; }}
          onMouseUp={() => { uiSession.mobileInteract = false; }}
          title="Interact / Attack">⚔️</button>
        <button className="tc-btn" onTouchStart={(e) => { e.preventDefault(); uiSession.mobileDodge = true; }}
          onTouchEnd={() => { uiSession.mobileDodge = false; }}
          onMouseDown={() => { uiSession.mobileDodge = true; }}
          onMouseUp={() => { uiSession.mobileDodge = false; }}
          title="Dodge">💨</button>
        <button className="tc-btn" onTouchStart={(e) => { e.preventDefault(); uiSession.mobileBlock = true; }}
          onTouchEnd={() => { uiSession.mobileBlock = false; }}
          onMouseDown={() => { uiSession.mobileBlock = true; }}
          onMouseUp={() => { uiSession.mobileBlock = false; }}
          title="Block">🛡️</button>
        <button className="tc-btn" onClick={() => { uiSession.uiPanel = uiSession.uiPanel === 'inventory' ? null : 'inventory'; GameState.notify(CH.SCREEN); }}
          title="Inventory">🎒</button>
      </div>
    </div>
  );
}
