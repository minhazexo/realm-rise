// Cinematic intro overlays (spec §87): typewriter-style lore slides that teach
// without walls of text, then drop the player into the world.
import React, { useEffect, useState } from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { INTRO_SLIDES } from '../../game/data/story.js';

export default function IntroOverlay() {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const slide = INTRO_SLIDES[idx];

  useEffect(() => {
    if (!slide) {
      finish();
      return;
    }
    setTyped('');
    const full = slide.body;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(timer);
        GameState._introReady = true;
      }
    }, 24);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const finish = () => {
    GameState.session.screen = 'world';
    GameState._introReady = false;
    GameState.notify(CH.SCREEN);
    import('../../game/main.js').then((m) => m.setScreen('world'));
  };

  const advance = () => {
    if (idx < INTRO_SLIDES.length - 1) setIdx(idx + 1);
    else finish();
  };

  if (!slide) return null;

  return (
    <div className="intro-root" onClick={advance}>
      <div className="intro-card">
        <h2>{slide.title}</h2>
        <p className="intro-body">{typed}<span className="caret">▍</span></p>
        <div className="intro-hint">click to continue — {idx + 1}/{INTRO_SLIDES.length}</div>
      </div>
    </div>
  );
}
