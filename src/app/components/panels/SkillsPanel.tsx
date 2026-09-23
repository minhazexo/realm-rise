// SkillsPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import { useState } from 'react';
import type { CSSProperties, JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { BRANCHES, SKILLS } from '../../../game/data/skills.ts';
import { learnSkill, spendStat } from '../../../game/systems/ProgressionSystem.ts';
import type { SkillDef } from './types.ts';
import type { BranchDef } from './types.ts';

/* ── Skills ─────────────────────────────────────────────────────────────── */
export function SkillsPanel(): JSX.Element {
  const [branch, setBranch] = useState<string>('survival');
  const data = useGameState([CH.PLAYER, CH.INVENTORY], () => ({
    sp: GameState.s?.player?.skillPoints,
    stPts: GameState.s?.player?.statPoints,
    skills: { ...GameState.s?.player?.skills },
    alloc: { ...GameState.s?.player?.alloc },
    level: GameState.s?.player?.level
  })) as { sp: number; stPts: number; skills: Record<string, number>; alloc: Record<string, number>; level?: number };
  const tree = SKILLS.filter((s: SkillDef) => s.branch === branch) as SkillDef[];
  const tSkill = (id: string, def?: unknown, sdata?: unknown): void => {
    if (!sdata) return;
    learnSkill(id);
    void def;
  };
  return (
    <div className="panel skills-panel">
      <h2>Skill Tree <span className="gold">✦ {data.sp} pts</span></h2>
      <div className="branch-tabs">
        {(BRANCHES as BranchDef[]).map((b) => (
          <button key={b.id} className={b.id === branch ? 'on' : ''} style={{ '--branch-c': b.color } as CSSProperties} onClick={() => setBranch(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="skill-list">
        {tree.map((s) => {
          const rank: number = data.skills[s.id] || 0;
          const locked: boolean = !!s.req && Object.entries(s.req).some(([rid, min]: [string, number]) => (data.skills[rid] || 0) < min);
          const maxed: boolean = rank >= s.maxRank;
          return (
            <button key={s.id} className={`skill ${maxed ? 'maxed' : ''} ${!maxed && (locked || data.sp <= 0) ? 'locked' : ''}`}
              onClick={() => !maxed && !locked && tSkill(s.id)}>
              <div className="skill-top">
                <b>{s.name}</b>
                <span className="skill-rank">{'◆'.repeat(rank)}<i>{'◇'.repeat(s.maxRank - rank)}</i></span>
              </div>
              <p>{s.desc}</p>
              {locked && <em className="locked-reason">Requires prerequisite skills</em>}
            </button>
          );
        })}
      </div>
      <h3>Attributes ({data.stPts} to spend)</h3>
      <div className="attr-row">
        {Object.entries(data.alloc).map(([key, v]: [string, number]) => (
          <button key={key} className="attr" onClick={() => spendStat(key)}>
            <b>{STAT_LABEL[key]}</b> <span>{v}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
const STAT_LABEL: Record<string, string> = { strength: 'Might', defense: 'Vitality', agility: 'Agility', intellect: 'Intellect', willpower: 'Charisma' };
