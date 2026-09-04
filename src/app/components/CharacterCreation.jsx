// Character creation (spec §6): name, gender, skin, hair, source identity.
import React, { useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { randomSeed } from '../../utils/math.js';
import { availableBoons } from '../../game/systems/LegacyStore.js';

const SKINS = ['#caa27c', '#c69a72', '#b98a63', '#8d6a46', '#e0bb93', '#6b4a32'];
const HAIR_COLORS = ['#4a3222', '#22150d', '#7c5632', '#d8b74a', '#8a3030', '#e5e0d2'];
const HAIR_STYLES = ['short', 'long', 'topknot', 'braided', 'bald'];
const PERSONALITIES = [
  { id: 'bold', label: 'Bold', desc: '+1 Might. Headfirst into danger.' },
  { id: 'stoic', label: 'Stoic', desc: '+1 Vitality. Endures what others flee.' },
  { id: 'kind', label: 'Kind', desc: '+1 Charisma. People warm to generous rulers.' },
  { id: 'clever', label: 'Clever', desc: '+1 Intellect. Reads the world like a map.' }
];

export default function CharacterCreation() {
  const [name, setName] = useState('Ash');
  const [gender, setGender] = useState('m');
  const [skin, setSkin] = useState(SKINS[0]);
  const [hair, setHair] = useState(HAIR_STYLES[0]);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0]);
  const [personality, setPersonality] = useState('bold');
  const [heirloom, setHeirloom] = useState(null);
  // Phase E: NG+ heirloom boons unlocked by past victories on this browser.
  const [boons] = useState(() => {
    try { return availableBoons(); } catch { return []; }
  });
  const diff = GameState.session.creationDifficulty || 'normal';

  const begin = () => {
    import('../../game/main.js').then(({ startNewGame }) => {
      const seed = randomSeed();
      startNewGame(seed, {
        name: name.trim() || 'Stranger',
        gender,
        personality,
        heirloom,
        appearance: { skin, hairStyle: hair, hairColor, outfitTier: 0 }
      }, diff);
      GameState.session.screen = 'intro';
      GameState.notify(CH.SCREEN);
    });
  };

  const back = () => {
    GameState.session.screen = 'menu';
    GameState.notify(CH.SCREEN);
  };

  return (
    <div className="creation-root">
      <div className="creation-panel">
        <h1>Who Survives the Storm?</h1>
        <label className="field">
          <span>Name</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>Gender</span>
          <div className="seg">
            <button className={gender === 'm' ? 'on' : ''} onClick={() => setGender('m')}>Male</button>
            <button className={gender === 'f' ? 'on' : ''} onClick={() => setGender('f')}>Female</button>
          </div>
        </div>
        <div className="field">
          <span>Skin</span>
          <div className="swatches">
            {SKINS.map((c) => <button key={c} className={c === skin ? 'sw sw-on' : 'sw'} style={{ background: c }} onClick={() => setSkin(c)} />)}
          </div>
        </div>
        <div className="field">
          <span>Hair</span>
          <div className="seg">
            {HAIR_STYLES.map((h) => <button key={h} className={h === hair ? 'on' : ''} onClick={() => setHair(h)}>{h}</button>)}
          </div>
        </div>
        <div className="field">
          <span>Hair Colour</span>
          <div className="swatches">
            {HAIR_COLORS.map((c) => <button key={c} className={c === hairColor ? 'sw sw-on' : 'sw'} style={{ background: c }} onClick={() => setHairColor(c)} />)}
          </div>
        </div>
        <div className="field">
          <span>Personality</span>
          <div className="persona-col">
            {PERSONALITIES.map((p) => (
              <button key={p.id} className={p.id === personality ? 'persona on' : 'persona'} onClick={() => setPersonality(p.id)}>
                <b>{p.label}</b> — {p.desc}
              </button>
            ))}
          </div>
        </div>
        {boons.some((b) => b.open) && (
          <div className="field">
            <span>Heirloom (past victories)</span>
            <div className="persona-col">
              <button className={!heirloom ? 'persona on' : 'persona'} onClick={() => setHeirloom(null)}>
                <b>None</b> — a fresh start.
              </button>
              {boons.filter((b) => b.open).map((b) => (
                <button key={b.id} className={heirloom === b.id ? 'persona on' : 'persona'} onClick={() => setHeirloom(b.id)}>
                  <b>{b.name}</b> — {b.desc}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="creation-actions">
          <button className="btn btn-menu" onClick={back}>BACK</button>
          <button className="btn btn-menu btn-gold" onClick={begin}>SURVIVE THE STORM</button>
        </div>
      </div>
    </div>
  );
}
