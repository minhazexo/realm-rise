// Cinematic intro overlays (spec §87): typewriter-style lore slides that teach
// without walls of text, then drop the player into the world.
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../game/core/GameState.ts';
import { CH } from '../../game/core/EventBus.ts';
import { INTRO_SLIDES } from '../../game/data/story.ts';

interface IntroSlide {
  title: string;
  body: string;
}

// GameState carries the transient intro flag at runtime (game batch owns the type).
const store = GameState as unknown as { _introReady?: boolean };

export default function IntroOverlay(): JSX.Element | null {
  const [idx, setIdx] = useState<number>(0);
  const [typed, setTyped] = useState<string>('');
  const slide: IntroSlide | undefined = INTRO_SLIDES[idx];

  useEffect(() => {
    if (!slide) {
      finish();
      return;
    }
    setTyped('');
    const full: string = slide.body;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(timer);
        store._introReady = true;
      }
    }, 24);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const finish = (): void => {
    GameState.session.screen = 'world';
    store._introReady = false;
    GameState.notify(CH.SCREEN);
    import('../../game/main.ts').then((m: any) => m.setScreen('world'));
  };

  const advance = (): void => {
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
