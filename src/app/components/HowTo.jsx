// "How to Play" + "Credits".
import React from 'react';

export default function HowTo({ onBack }) {
  return (
    <div className="panel howto-panel">
      <h2>How to Survive & Rise</h2>
      <div className="howto-grid">
        <div><b>Keyboard</b><p>WASD/Arrows move · Mouse click attack · E gather · Shift sprint · Space dodge · Right-click block</p></div>
        <div><b>Panels</b><p>I Inventory · C Crafting · B Build · M Map · J Journal · K Kingdom · P Skills · ESC Pause</p></div>
        <div><b>Loop</b><p>Gather → Craft → Fight → Loot → Recruit → Build → Protect → Expand → Crown</p></div>
        <div><b>Survival</b><p>Stay fed & watered. Nights are darker and hungrier. Craft torches and campfires.</p></div>
        <div><b>Your realm</b><p>Place a Town Hall to found your settlement. Huts house people, farms feed them.</p></div>
        <div><b>Progression</b><p>Combat grants XP; practice grows professions. Spend points in the skill tree (P).</p></div>
      </div>
      {onBack && <button className="btn btn-menu btn-small" onClick={onBack}>BACK</button>}
    </div>
  );
}

export function Credits({ onBack }) {
  return (
    <div className="panel credits-panel">
      <h2>Credits</h2>
      <p>A solo-built kingdom adventure.</p>
      <p>All art, audio and music are <b>procedurally generated in-browser</b> — no stock assets.</p>
      <p>Built with React, Vite, Phaser & WebAudio.</p>
      {onBack && <button className="btn btn-menu btn-small" onClick={onBack}>BACK</button>}
    </div>
  );
}
