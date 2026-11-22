// Character creation (spec §6): name, gender, skin, hair, source identity.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { randomSeed } from '../../../utils/math.ts';
import { availableBoons } from '../../../game/systems/narrative/LegacyStore.ts';
import { drawHumanoidFrame } from '../../../game/assets/sheetsHuman.ts';
import { CH_FRAME_W, CH_FRAME_H } from '../../../game/assets/artCore.ts';
import { artScale } from '../../../game/core/VisualProfile.ts';

/** Portrait canvas density — the profile's authoring scale (4× when painterly). */
const PORTRAIT_SCALE: number = Math.max(1, Math.round(artScale()));

const SKINS: string[] = ['#caa27c', '#c69a72', '#b98a63', '#8d6a46', '#e0bb93', '#6b4a32'];
const HAIR_COLORS: string[] = ['#4a3222', '#22150d', '#7c5632', '#d8b74a', '#8a3030', '#e5e0d2'];
const HAIR_STYLES: string[] = ['short', 'long', 'topknot', 'braided', 'bald'];

interface PersonalityOption {
  id: string;
  label: string;
  desc: string;
}

const PERSONALITIES: PersonalityOption[] = [
  { id: 'bold', label: 'Bold', desc: '+1 Might. Headfirst into danger.' },
  { id: 'stoic', label: 'Stoic', desc: '+1 Vitality. Endures what others flee.' },
  { id: 'kind', label: 'Kind', desc: '+1 Charisma. People warm to generous rulers.' },
  { id: 'clever', label: 'Clever', desc: '+1 Intellect. Reads the world like a map.' }
];

interface HeirloomBoon {
  id: string;
  name: string;
  desc: string;
  open?: boolean;
}

interface CharacterPortraitProps {
  gender: string;
  skin: string;
  hair: string;
  hairColor: string;
}

/** Uses the in-world renderer, so the choice screen never promises a look the game cannot deliver. */
function CharacterPortrait({ gender, skin, hair, hairColor }: CharacterPortraitProps): JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Render the same 26×34 game pose at the profile's density (see
    // CharacterPanel): the canvas keeps its transform between runs, so the
    // scale is re-established from an identity matrix — otherwise every
    // appearance change stacked another 4× and the preview ballooned.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(PORTRAIT_SCALE, PORTRAIT_SCALE);
    drawHumanoidFrame(ctx, 0, 0, {
      phase: 1, poseDir: 'down', skin, hairColor, hairstyle: hair,
      gender, tierIdx: 0, variant: null,
    });
    ctx.restore();
  }, [gender, skin, hair, hairColor]);

  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 6, margin: '2px 0 16px' }}>
      <div style={{ minWidth: 132, padding: '10px 28px', border: '1px solid rgba(232,201,75,.38)', borderRadius: 10, background: 'radial-gradient(circle at 50% 30%, rgba(113,177,194,.22), rgba(20,25,30,.78) 68%)', boxShadow: 'inset 0 0 24px rgba(0,0,0,.35)' }}>
        <canvas ref={ref} width={CH_FRAME_W * PORTRAIT_SCALE} height={CH_FRAME_H * PORTRAIT_SCALE} aria-label="Character appearance preview" style={{ display: 'block', width: 156, height: 204, imageRendering: PORTRAIT_SCALE > 1 ? 'auto' : 'pixelated', filter: 'drop-shadow(0 5px 8px rgba(0,0,0,.32))' }} />
      </div>
      <small style={{ color: 'var(--parch-dim)' }}>Your appearance carries into the frontier.</small>
    </div>
  );
}

export default function CharacterCreation(): JSX.Element {
  const [name, setName] = useState<string>('Ash');
  const [gender, setGender] = useState<string>('m');
  const [skin, setSkin] = useState<string>(SKINS[0] ?? '#caa27c');
  const [hair, setHair] = useState<string>(HAIR_STYLES[0] ?? 'short');
  const [hairColor, setHairColor] = useState<string>(HAIR_COLORS[0] ?? '#4a3222');
  const [personality, setPersonality] = useState<string>('bold');
  const [heirloom, setHeirloom] = useState<string | null>(null);
  // Phase E: NG+ heirloom boons unlocked by past victories on this browser.
  const [boons] = useState<HeirloomBoon[]>(() => {
    try { return availableBoons() as HeirloomBoon[]; } catch { return [] as HeirloomBoon[]; }
  });
  const diff: string = (GameState.session as unknown as Record<string, any>).creationDifficulty || 'normal';

  const begin = (): void => {
    import('../../../game/main.ts').then((m: any) => {
      const seed: number = randomSeed();
      m.startNewGame(seed, {
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

  const back = (): void => {
    GameState.session.screen = 'menu';
    GameState.notify(CH.SCREEN);
  };

  return (
    <div className="creation-root">
      <div className="creation-panel">
        <h1>Who Survives the Storm?</h1>
        <CharacterPortrait gender={gender} skin={skin} hair={hair} hairColor={hairColor} />
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
