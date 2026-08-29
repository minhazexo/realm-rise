// Touch controls (spec §5): virtual joystick, attack, dodge, block, interaction buttons.
import React, { useEffect, useRef, useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';

export default function TouchControls() {
  const [visible, setVisible] = useState(true);
  const joyStickRef = useRef(null);
  const activePointer = useRef(null);
  const centerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handler = () => setVisible(GameState.session.screen === 'world');
    handler();
    GameState.session._onScreenChange = handler;
  }, []);

  const handleJoy = (e) => {
    if (!joyStickRef.current) return;
    const rect = joyStickRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const move = (ev) => {
      const dx = ev.touches ? ev.touches[0].clientX - cx : ev.clientX - cx;
      const dy = ev.touches ? ev.touches[0].clientY - cy : ev.clientY - cy;
      const dist = Math.min(60, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      const pad = { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
      GameState.session.joystick = pad;
    };
    const stop = () => {
      GameState.session.joystick = { x: 0, y: 0 };
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    if (e.type === 'touchstart' || e.type === 'mousedown') {
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', stop);
      if (e.touches) { window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop); }
      move(e.touches ? e.touches[0] : e);
    }
  };

  if (!visible) return null;

  return (
    <div className="touch-controls">
      <div ref={joyStickRef} className="tc-joystick-area" onTouchStart={handleJoy} onMouseDown={handleJoy} />
      <div className="tc-action-btns">
        <button className="tc-btn" onTouchStart={(e) => { e.preventDefault(); GameState.session.mobileInteract = true; }}
          onTouchEnd={() => { GameState.session.mobileInteract = false; }}
          onMouseDown={() => { GameState.session.mobileInteract = true; }}
          onMouseUp={() => { GameState.session.mobileInteract = false; }}
          title="Interact / Attack">⚔️</button>
        <button className="tc-btn" onTouchStart={(e) => { e.preventDefault(); GameState.session.mobileDodge = true; }}
          onTouchEnd={() => { GameState.session.mobileDodge = false; }}
          onMouseDown={() => { GameState.session.mobileDodge = true; }}
          onMouseUp={() => { GameState.session.mobileDodge = false; }}
          title="Dodge">💨</button>
        <button className="tc-btn" onTouchStart={(e) => { e.preventDefault(); GameState.session.mobileBlock = true; }}
          onTouchEnd={() => { GameState.session.mobileBlock = false; }}
          onMouseDown={() => { GameState.session.mobileBlock = true; }}
          onMouseUp={() => { GameState.session.mobileBlock = false; }}
          title="Block">🛡️</button>
        <button className="tc-btn" onClick={() => { GameState.session.uiPanel = GameState.session.uiPanel === 'inventory' ? null : 'inventory'; GameState.notify(CH.SCREEN); }}
          title="Inventory">🎒</button>
      </div>
    </div>
  );
}
