// CharacterPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { RARITY, getItem } from '../../../game/data/items.ts';
import { equip, unequip } from '../../../game/systems/combat/InventorySystem.ts';
import { spendStat, xpToNext } from '../../../game/systems/combat/ProgressionSystem.ts';
import type { EquippedItem } from './types.ts';
import { Icon } from './shared.tsx';
import { drawHumanoidFrame } from '../../../game/assets/sheetsHuman.ts';
import { CH_FRAME_W, CH_FRAME_H } from '../../../game/assets/artCore.ts';
import { artScale } from '../../../game/core/VisualProfile.ts';

/**
 * Portrait density: the canvas is authored at the profile's scale and drawn in
 * native 26×34 coordinates, while the CSS box stays 104×136 for every display.
 * At density 1 the two agree after a 2× pixelated upscale (pixel-art profile).
 */
const PORTRAIT_SCALE: number = Math.max(1, Math.round(artScale()));
import { useEffect, useRef } from 'react';

/* ── Character ────────────────────────────────────────────────────────── */
interface CharacterSnapshot {
  name: string;
  level: number;
  xp: number;
  xpNext: number;
  statPoints: number;
  gold: number;
  reputation: number;
  hp: number;
  maxHp?: number;
  stamina: number;
  maxStamina?: number;
  alloc: Record<string, number>;
  profs: { k: string; lv: number }[];
  dmg: number;
  redux: number;
  gender: string;
  personality: string;
  appearance: { skin: string; hairStyle: string; hairColor: string; outfitTier: number };
  hunger: number;
  thirst: number;
  cold: number;
  derived: Record<string, any>;
  eq: Record<string, EquippedItem | undefined>;
}

export function CharacterPanel(): JSX.Element | null {
  const c = useGameState([CH.PLAYER, CH.EQUIPMENT], () => {
    const p: any = GameState.s?.player;
    if (!p) return null;
    return {
      name: p.name, level: p.level, xp: p.xp, xpNext: xpToNext(p.level),
      statPoints: p.statPoints ?? 0,
      gold: p.gold, reputation: p.reputation,
      hp: Math.round(p.hp), maxHp: p.derived?.maxHp, stamina: Math.round(p.stamina), maxStamina: p.derived?.maxStamina,
      alloc: { ...p.alloc }, profs: Object.entries(p.professions || {}).map(([k, v]: [string, any]) => ({ k, lv: v?.lv ?? v ?? 1 })),
      dmg: Math.round((p.derived?.meleeDmgMult || 1) * 100), redux: Math.round((p.derived?.damageReduction || 0) * 100),
      gender: p.gender || 'm',
      personality: p.personality || 'bold',
      appearance: { skin: p.appearance?.skin || '#caa27c', hairStyle: p.appearance?.hairStyle || 'short', hairColor: p.appearance?.hairColor || '#4a3222', outfitTier: p.appearance?.outfitTier ?? 0 },
      hunger: Math.round(p.hunger ?? 0), thirst: Math.round(p.thirst ?? 0), cold: Math.round(p.coldExposure ?? 0),
      derived: { ...(p.derived || {}) },
      eq: { ...p.equipment },
    };
  }) as CharacterSnapshot | null;
  if (!c) return null;

  const portraitRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = portraitRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Draw the 26×34 pose at the canvas's own density. A canvas REMEMBERS its
    // transform, so the scale is established from an identity matrix every run:
    // without the reset each re-render (a hairstyle change, an equip) stacked
    // another 4× onto the previous one and the character grew off the frame.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = PORTRAIT_SCALE > 1;
    ctx.scale(PORTRAIT_SCALE, PORTRAIT_SCALE);
    drawHumanoidFrame(ctx, 0, 0, {
      phase: 0, poseDir: 'down', skin: c.appearance.skin, hairColor: c.appearance.hairColor,
      hairstyle: c.appearance.hairStyle, gender: c.gender, tierIdx: c.appearance.outfitTier, variant: null,
    });
  }, [c.appearance, c.gender]);

  const handleUnequip = (slot: string): void => {
    unequip(slot);
    import('../../../game/systems/combat/ProgressionSystem.ts').then((P: any) => P.recompute());
    import('../../../game/main.ts').then((m: any) => m.worldScene()?.refreshPlayerSkin?.());
  };

  return (
    <div className="panel character-panel">
      <div className="character-identity">
        <div className="character-portrait-frame"><canvas ref={portraitRef} width={CH_FRAME_W * PORTRAIT_SCALE} height={CH_FRAME_H * PORTRAIT_SCALE} aria-label="Character portrait" style={{ width: 104, height: 136, imageRendering: PORTRAIT_SCALE > 1 ? 'auto' : 'pixelated' }} /></div>
        <div className="character-identity-copy">
          <h2>{c.name} <span className="gold">Lv {c.level}</span></h2>
          <div className="character-tags"><span>{c.personality}</span><span>{c.gender === 'f' ? 'Female' : 'Male'}</span><span>Outfit Tier {c.appearance.outfitTier + 1}</span></div>
          <div className="character-flavor">A survivor shaped by every journey, wound, skill and choice.</div>
        </div>
      </div>
      <div style={{ margin: '4px 0 10px', fontSize: '12px', color: '#9fb4cc' }}>
        Experience: <b>{c.xp}</b> / <b>{c.xpNext}</b> XP
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden', marginTop: 4 }}>
          <div style={{ background: '#ffd66b', height: '100%', width: `${Math.min(100, Math.round((c.xp / (c.xpNext || 1)) * 100))}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>
      <div className="k-grid">
        <div className="k-stat">❤ <b>{c.hp}/{c.maxHp}</b> <em>Health</em></div>
        <div className="k-stat">⚡ <b>{c.stamina}/{c.maxStamina}</b> <em>Stamina</em></div>
        <div className="k-stat">🪙 <b>{c.gold}</b> <em>Gold</em></div>
        <div className="k-stat">♛ <b>{c.reputation}</b> <em>Renown</em></div>
        <div className="k-stat">⚔ <b>{c.dmg}%</b> <em>Melee</em></div>
        <div className="k-stat">🛡 <b>{c.redux}%</b> <em>Resist</em></div>
      </div>
      <h3>Condition</h3>
      <div className="character-condition">
        <span><b>Hunger</b><i>{c.hunger}%</i></span><span><b>Thirst</b><i>{c.thirst}%</i></span><span><b>Cold</b><i>{c.cold}%</i></span>
      </div>
      <h3>Combat Profile</h3>
      <div className="character-detail-grid">
        <span><b>Armor</b><i>{Math.round(c.derived.armorValue ?? 0)}</i></span>
        <span><b>Crit</b><i>{Math.round((c.derived.critMelee ?? 0) * 100)}%</i></span>
        <span><b>Move</b><i>{Math.round(c.derived.moveSpeed ?? 0)}</i></span>
        <span><b>Dodge</b><i>{Math.round(c.derived.dodgeSpeed ?? 0)}</i></span>
        <span><b>Gather</b><i>×{(c.derived.gatherYield ?? 1).toFixed(2)}</i></span>
        <span><b>XP Gain</b><i>×{(c.derived.xpGainMult ?? 1).toFixed(2)}</i></span>
      </div>
      <h3>Equipped Gear</h3>
      <div className="equip-strip" style={{ marginBottom: 12 }}>
        {['weapon', 'offhand', 'helmet', 'chest', 'gloves', 'boots', 'ring', 'amulet'].map((slot) => {
          const eq: EquippedItem | undefined = c.eq[slot];
          const def: any = eq ? getItem(eq.id) : null;
          return (
            <button key={slot} className="eq-slot" onClick={() => eq && handleUnequip(slot)} title={eq ? `Click to unequip ${def?.name || slot}` : slot}>
              <span className="eq-slot-label">{slot.slice(0, 3).toUpperCase()}</span>
              {def && eq ? <Icon id={eq.id} size={30} /> : <span className="eq-empty">—</span>}
              {def && (
                <span className="drop-hover">
                  <b className="rn">{def.name}</b><br />
                  <span className="rd">{RARITY[def.rarity]?.label || 'Common'}</span>
                  {def.weapon && <><br /><span className="stat-line">⚔ {def.weapon.damage} dmg</span></>}
                  {def.armor != null && def.armor > 0 && <><br /><span className="stat-line">🛡 +{def.armor} armor</span></>}
                  {def.shieldBlock && <><br /><span className="stat-line">🛡 {Math.round(def.shieldBlock * 100)}% block</span></>}
                  <br /><span style={{ fontSize: '10px', color: '#ffb3b3' }}>Click to unequip</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <h3>Attributes {c.statPoints > 0 && <span className="gold">({c.statPoints} unspent points)</span>}</h3>
      <div className="attr-row">
        {Object.entries(c.alloc).map(([k, v]: [string, number]) => (
          <span key={k} className="attr" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <b>{k}</b> <span>{v}</span>
            {c.statPoints > 0 && (
              <button
                className="btn"
                style={{ padding: '2px 7px', fontSize: '11px', lineHeight: 1, minWidth: 'auto', background: '#3b5478', border: '1px solid #6b8bb8' }}
                onClick={() => {
                  spendStat(k);
                  import('../../../game/systems/combat/ProgressionSystem.ts').then((P: any) => P.recompute());
                }}
                title={`Increase ${k}`}
              >+</button>
            )}
          </span>
        ))}
      </div>
      <h3>Professions</h3>
      <div className="attr-row">{c.profs.map((p) => <span key={p.k} className="attr"><b>{p.k}</b> <span>Lv {p.lv}</span></span>)}</div>
    </div>
  );
}
