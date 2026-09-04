// Death overlay (spec §18): shows when the player dies, offers revive options.
import React from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';

export default function DeathOverlay({ onRespawn }) {
  const handleRespawn = () => {
    // Phase E: use the canonical Player.respawn() (position, visibility,
    // body, vitals, session_dead) — the old hand-rolled version left the
    // sprite invisible, the body disabled and session_dead set, soft-locking
    // the game. Then scatter nearby enemies so there's no instant re-kill.
    import('../../game/main.js').then((m) => {
      const scene = m.worldScene?.();
      if (scene?.player) {
        scene.player.respawn();
        scene.player.iFrames = 2; // grace period
        scene.resetNearbyEnemies(700);
        const S = GameState.s;
        S.world.px = Math.round(scene.player.sprite.x);
        S.world.py = Math.round(scene.player.sprite.y);
        GameState.notify(CH.SCREEN, CH.PLAYER);
      }
    });
    onRespawn?.();
  };

  const handleSurrender = () => {
    // Return to the main menu (was: re-entered the world while dead).
    GameState.session.uiPanel = null;
    GameState.session.paused = false;
    import('../../game/main.js').then((m) => m.setScreen('menu'));
  };

  return (
    <div className="death-overlay">
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <h2 style={{ color: 'var(--blood)', fontFamily: 'Cinzel', fontSize: 36, marginBottom: 12 }}>YOU FELL</h2>
        <p style={{ color: 'var(--parch)', fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>
          The light fades. Your journey is not yet over. Choose how you rise again.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <button className="btn btn-gold" onClick={handleRespawn}>Rise Again</button>
          <button className="btn" onClick={handleSurrender}>Return to Menu</button>
        </div>
      </div>
    </div>
  );
}

