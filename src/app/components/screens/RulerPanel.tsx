// Ruler Panel (spec §7): display the player's ruler persona and realm legacy.
// Doubles as the realm's two decisive decisions: the Chapter IV banner bargain
// (three faction offers with real consequences) and the Chapter VIII council at
// the Forsaken Shrine (three governments, each gated and each with a cost).
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { readLegacy } from '../../../game/systems/narrative/LegacyStore.ts';
import { applyChoice, crownChoiceReady } from '../../../game/systems/narrative/QuestSystem.ts';
import { endingOptions, policyLean } from '../../../game/systems/narrative/StorySystem.ts';
import { BANNER_POLICIES } from '../../../game/data/policies.ts';
import { applyBannerPolicy, bannerBargain } from '../../../game/systems/economy/PolicySystem.ts';
import { setScreen } from '../../../game/main.ts';

interface RulerPanelProps {
  onBack?: () => void;
}

interface EndingData {
  oath?: string;
  title?: string;
  body?: string;
}

const REQ_MARK = (ok: boolean): string => (ok ? '✓' : '·');

export default function RulerPanel({ onBack }: RulerPanelProps = {}): JSX.Element {
  // Re-render on story/standing/screen changes (bargain made, oath chosen, ending published).
  useGameState([CH.STORY, CH.SCREEN, CH.FACTIONS], () => (GameState.session as unknown as { ending?: unknown }).ending ?? null);
  const S: any = GameState.s;
  const P: any = S.player;
  const leg: any = readLegacy();
  const endings: string[] = leg.endingsSeen || [];
  const ending = (GameState.session as unknown as { ending?: EndingData | null }).ending;
  const coronationReady: boolean = (() => {
    try {
      return !ending && crownChoiceReady();
    } catch {
      return false;
    }
  })();
  const bargain = (() => {
    try {
      return bannerBargain();
    } catch {
      return { ready: false, chosen: null } as ReturnType<typeof bannerBargain>;
    }
  })();
  const options = (() => {
    try {
      return endingOptions();
    } catch {
      return [];
    }
  })();

  const titles: string[] = ['Chieftain', 'Warlord', 'Lord', 'King', 'High King'];
  const title: string = titles[Math.min(Math.floor(S.player.level / 10), titles.length - 1)] ?? 'Chieftain';

  const banners: string[] = ['🐉 Dragon', '🦅 Eagle', '🐺 Wolf', '🦁 Lion', '🕊️ Dove', '🌹 Rose'];
  const banner: string = P.legacyBanner || banners[0];

  const realmProgress: number = S.world.ownedCamps.length + (S.settlement.founded ? 1 : 0);
  const realmMax = 18;
  const pct: number = Math.round((realmProgress / realmMax) * 100);

  const closeEnding = (): void => {
    (GameState.session as unknown as { ending?: unknown }).ending = null;
    GameState.notify(CH.SCREEN);
  };
  const newGamePlus = (): void => {
    (GameState.session as unknown as { ending?: unknown }).ending = null;
    setScreen('menu');
  };

  return (
    <div className="panel ruler-content" style={{ position: 'static', margin: '0 auto' }}>
      <h2 style={{ color: 'var(--gold)', fontFamily: 'Cinzel', fontSize: 28, marginBottom: 16 }}>Crown of the Realm</h2>

      {ending && (
        <div style={{ marginBottom: 20, padding: 12, border: '1px solid var(--gold)', borderRadius: 8 }}>
          <h3 style={{ color: 'var(--gold)', fontFamily: 'Cinzel', marginBottom: 8 }}>{ending.title || 'A NEW AGE'}</h3>
          <div style={{ fontSize: 14, color: 'var(--parch)', lineHeight: 1.6, marginBottom: 12 }}>{ending.body || ''}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-small" onClick={closeEnding}>CONTINUE RULING</button>
            <button className="btn btn-small" onClick={newGamePlus}>NEW GAME+ (MENU)</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--parch-dim)', marginTop: 8 }}>
            Your oath is recorded — heirloom boons await in character creation.
          </div>
        </div>
      )}

      {!ending && bargain.ready && (
        <div style={{ marginBottom: 20, padding: 12, border: '1px solid var(--emerald)', borderRadius: 8 }}>
          <h3 style={{ color: 'var(--emerald)', fontFamily: 'Cinzel', marginBottom: 8 }}>The Banner’s Bargain</h3>
          <div style={{ fontSize: 13, color: 'var(--parch-dim)', marginBottom: 12 }}>
            Three powers have offered to hold your banner up. Each of them intends to hold the hand that carries it.
            You can take one bargain. Chapter V begins when you do.
          </div>
          {BANNER_POLICIES.map((p) => (
            <button
              key={p.id}
              className="btn btn-small"
              style={{ display: 'block', width: '100%', marginBottom: 10, textAlign: 'left' }}
              onClick={() => applyBannerPolicy(p.idx)}
            >
              <b>{p.label}</b>
              <span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>{p.patron} — {p.offer}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--emerald)', marginTop: 4 }}>{p.benefit}</span>
              <span style={{ display: 'block', fontSize: 12, color: '#e08a72', marginTop: 2 }}>{p.cost}</span>
            </button>
          ))}
        </div>
      )}

      {!ending && coronationReady && (
        <div style={{ marginBottom: 20, padding: 12, border: '1px solid var(--gold)', borderRadius: 8 }}>
          <h3 style={{ color: 'var(--gold)', fontFamily: 'Cinzel', marginBottom: 8 }}>The Council at the Forsaken Shrine</h3>
          <div style={{ fontSize: 13, color: 'var(--parch-dim)', marginBottom: 12 }}>
            The anchor is raised and the surviving powers have come. The shrine asks for the Crown Ember inside you.
            Every government closes the barrier. What changes is who carries it afterwards, and what it costs.
          </div>
          {options.map((o) => (
            <button
              key={o.id}
              className="btn btn-small"
              disabled={!o.eligible}
              style={{ display: 'block', width: '100%', marginBottom: 10, textAlign: 'left', opacity: o.eligible ? 1 : 0.55 }}
              onClick={() => applyChoice('coronation', o.idx)}
            >
              <b>{o.title}</b>
              <span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>{o.tagline}</span>
              <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                {o.requirements.map((r) => `${REQ_MARK(r.ok)} ${r.label}`).join('   ')}
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#e08a72', marginTop: 2 }}>Cost: {o.cost}</span>
            </button>
          ))}
        </div>
      )}

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
        <b style={{ color: 'var(--parch)' }}>Banner:</b> {policyLean()}
        <div style={{ marginTop: 6 }}>
          <b style={{ color: 'var(--parch)' }}>Legacy Oath:</b> {leg.legacyOath || 'None yet — complete the story to choose your oath.'}
        </div>
      </div>

      {onBack && <button className="btn btn-small" onClick={onBack}>BACK</button>}
    </div>
  );
}
