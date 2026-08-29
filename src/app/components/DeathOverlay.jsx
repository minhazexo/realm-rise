// Death overlay (spec §18): shows when the player dies, offers revive options.
import React from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';

export default function DeathOverlay({ onRespawn }) {
  const handleRespawn = () => {
    const S = GameState.s;
    // Respawn at world origin (or settlement if founded)
    if (S.settlement.founded && S.settlement.pos) {
      S.world.px = S.settlement.pos.x;
      S.world.py = S.settlement.pos.y + 40;
    } else {
      S.world.px = 0;
      S.world.py = 260;
    }
    const D = S.player.derived;
    S.player.hp = Math.round(D.maxHp * 0.4);
    S.player.stamina = D.maxStamina;
    S.player.hunger = Math.max(20, S.player.hunger);
    GameState.session.death = null;
    GameState.session.screen = 'world';
    GameState.notify(CH.SCREEN);
    // Tell Phaser to reset player position
    import('../../game/main.js').then((m) => {
      const scene = m.worldScene?.();
      if (scene && scene.player) {
        scene.player.sprite.setPosition(S.world.px, S.world.py);
      }
    });
    onRespawn?.();
  };

  const handleSurrender = () => {
    GameState.session.death = null;
    GameState.session.screen = 'world';
    GameState.notify(CH.SCREEN);
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

