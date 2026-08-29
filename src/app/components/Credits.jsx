// Credits screen (spec §40): attribution and acknowledgements.
import React from 'react';

const entries = [
  { role: 'Design & Code', name: 'Rise of the Realm Team' },
  { role: 'Procedural Art', name: 'Runtime Canvas Renderer' },
  { role: 'Audio', name: 'WebAudio Generative Engine' },
  { role: 'Engine', name: 'Phaser 4 · React 19 · Vite' },
  { role: 'Special Thanks', name: 'Every wanderer who lights the first fire.' },
];

export default function Credits({ onBack }) {
  return (
    <div className="panel" style={{ left: '50%', transform: 'translateX(-50%)', maxWidth: 420, textAlign: 'center' }}>
      <h2 style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', marginBottom: 16 }}>CREDITS</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {entries.map((e, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: 'var(--parch-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>{e.role}</div>
            <div style={{ fontSize: 14, color: 'var(--parch)' }}>{e.name}</div>
          </div>
        ))}
      </div>
      <button className="btn btn-menu btn-small" onClick={onBack}>BACK</button>
    </div>
  );
}
