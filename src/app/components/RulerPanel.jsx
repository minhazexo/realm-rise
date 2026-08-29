// Ruler Panel (spec §7): display the player's ruler persona and realm legacy.
import React from 'react';
import GameState from '../../game/core/GameState.js';
import { readLegacy } from '../../game/systems/LegacyStore.js';

export default function RulerPanel({ onBack }) {
  const S = GameState.s;
  const P = S.player;
  const leg = readLegacy();
  const endings = leg.endingsSeen || [];

  const titles = ['Chieftain', 'Warlord', 'Lord', 'King', 'High King'];
  const title = titles[Math.min(Math.floor(S.player.level / 10), titles.length - 1)];

  const banners = ['🐉 Dragon', '🦅 Eagle', '🐺 Wolf', '🦁 Lion', '🕊️ Dove', '🌹 Rose'];
  const banner = P.legacyBanner || banners[0];

  const realmProgress = S.world.ownedCamps.length + (S.settlement.founded ? 1 : 0);
  const realmMax = 18;
  const pct = Math.round((realmProgress / realmMax) * 100);

  return (
    <div className="panel ruler-content" style={{ position: 'static', margin: '0 auto' }}>
      <h2 style={{ color: 'var(--gold)', fontFamily: 'Cinzel', fontSize: 28, marginBottom: 16 }}>Crown of the Realm</h2>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{banner.split(' ')[0]}</div>
        <div style={{ color: 'var(--gold)', fontFamily: 'Cinzel', fontSize: 20 }}>{P.name}, {title} of the {banner.split(' ')[1] || 'Realm'}</div>
        <div style={{ color: 'var(--parch-dim)', fontSize: 13, marginTop: 8 }}>
          Level {P.level} · Reputation {P.reputation} · Gold {P.gold} 🪙
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: 'var(--steel)', marginBottom: 8 }}>Territory</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 16, background: 'rgba(36,29,23,0.5)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--gold), #e8c94b)', transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--parch-dim)' }}>{pct}%</span>
        </div>
      </div>

      {endings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: 'var(--twilight)', marginBottom: 8 }}>Endings Achieved</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {endings.map((e) => <span key={e} style={{ fontSize: 12, color: 'var(--emerald)' }}>✦ {e}</span>)}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--parch-dim)', lineHeight: 1.5 }}>
        <b style={{ color: 'var(--parch)' }}>Legacy Oath:</b> {leg.legacyOath || 'None yet — complete the story to choose your oath.'}
      </div>

      {onBack && <button className="btn btn-small" onClick={onBack}>BACK</button>}
    </div>
  );
}
