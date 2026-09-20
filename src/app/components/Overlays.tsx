// World interaction: Quest tracker (right side), Minimap (top-right),
// Dialogue modal, boss bar (top center).
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../game/core/GameState.ts';
import { CH } from '../../game/core/EventBus.ts';
import { useGameState } from '../../hooks/useGameState.ts';
import { questStateSnapshot, setFlag } from '../../game/systems/QuestSystem.ts';
import { firstSteps } from '../../game/systems/TutorialSystem.ts';
import { clearWaypoint, navigationSnapshot, setWaypoint } from '../../game/systems/NavigationSystem.ts';

interface FirstStepItem {
  id: string;
  done: boolean;
  text: string;
  need: number;
  have: number | string;
}

interface FirstStepsSnapshot {
  steps: FirstStepItem[];
}

interface QuestStepItem {
  done: boolean;
  text: string;
  have: number | string;
  need: number | string;
}

interface SideQuestItem {
  id: string;
  title: string;
}

interface QuestSnapshot {
  title: string;
  steps: QuestStepItem[];
  side?: SideQuestItem[];
  none?: boolean;
}

interface DialogueAction {
  fn: string;
  arg?: unknown;
  label: string;
}

interface DialogueData {
  npc?: unknown;
  portrait?: string;
  name?: string;
  lines?: string[];
  actions?: DialogueAction[];
}

interface BossSnapshot {
  name?: string;
  hp?: number;
  maxHp?: number;
  phase?: number;
}

interface AchievementData {
  id: string;
  name: string;
  desc: string;
  at?: number;
}

// GameState.session gains dynamic UI-only fields at runtime (game batch owns the type).
type SessionExtras = Record<string, any>;
const uiSession = GameState.session as unknown as SessionExtras;

export function FirstSteps(): JSX.Element | null {
  const snap = useGameState([CH.QUESTS, CH.STORY, CH.PLAYER, CH.INVENTORY, CH.WORLD], (): FirstStepsSnapshot | null => {
    try {
      const S: any = GameState.s;
      if (!S || GameState.session.screen !== 'world') return null;
      if (S.story?.flags?.hide_guide) return null;
      const steps = firstSteps() as FirstStepItem[];
      if (!steps.length || steps.every((s) => s.done)) return null;
      // Graduate the card once the realm exists and the player is established.
      if ((S.meta.playSeconds || 0) > 1800 && S.settlement?.founded) return null;
      return { steps };
    } catch {
      return null;
    }
  }) as FirstStepsSnapshot | null;
  if (!snap) return null;
  const done: number = snap.steps.filter((s) => s.done).length;
  const dismiss = (): void => {
    try {
      setFlag('hide_guide'); // service owns the write + notify
    } catch { /* ignore */ }
  };
  return (
    <div className="first-steps">
      <div className="fs-head">
        <span>✦ First steps {done}/{snap.steps.length}</span>
        <button className="fs-x" onClick={dismiss} title="Dismiss guide" aria-label="Dismiss guide">✕</button>
      </div>
      {snap.steps.map((s) => (
        <div key={s.id} className={`fs-step ${s.done ? 'done' : ''}`}>
          <span className="fs-check">{s.done ? '✔' : '·'}</span>
          <span>{s.text}</span>
          {!s.done && s.need > 1 && <em className="fs-count">{s.have}/{s.need}</em>}
        </div>
      ))}
    </div>
  );
}

export function QuestTracker(): JSX.Element | null {
  const q = useGameState([CH.QUESTS, CH.SCREEN], (): QuestSnapshot | null => {
    try {
      return questStateSnapshot() as QuestSnapshot;
    } catch {
      return null;
    }
  }) as QuestSnapshot | null;
  if (!q || q.none || GameState.session.screen !== 'world') return null;

  return (
    <div className="quest-tracker">
      <div className="qt-title">✦ {q.title}</div>
      {q.steps.map((s, i) => (
        <div key={i} className={`qt-step ${s.done ? 'done' : ''}`}>
          <span className="qt-check">{s.done ? '✔' : '·'}</span>
          <span>{s.text}</span>
          {!s.done && <em className="qt-count">{s.have}/{s.need}</em>}
        </div>
      ))}
      {q.side?.map((sq) => (
        <div key={sq.id} className="qt-side">
          <div className="qt-side-title">{sq.title}</div>
        </div>
      ))}
    </div>
  );
}

const MM_ZOOMS: number[] = [0.5, 1, 2, 4];

const MM_ICON_LEGEND: Array<[string, string, string]> = [
  ['▲', '#4ab45a', 'Trees'],
  ['■', '#c8cdd7', 'Rock / ore'],
  ['◆', '#ff6b5a', 'Boss'],
  ['▲', '#ff9a4a', 'Bandit camp'],
  ['●', '#7ae0ff', 'Friend / NPC'],
  ['◆', '#c9a8ff', 'Ruins'],
  ['⌂', '#ffd66b', 'Home'],
];

export function Minimap(): JSX.Element {
  const pos = useGameState([CH.PLAYER, CH.WORLD], (): { x?: number; y?: number } => ({
    x: GameState.s?.world?.px, y: GameState.s?.world?.py
  })) as { x?: number; y?: number };
  const nav = useGameState([CH.MINIMAP, CH.WORLD], navigationSnapshot);
  const [zoom, setZoom] = useState<number>(uiSession.minimapZoom || 1);
  const [legend, setLegend] = useState<boolean>(false);
  const cycle = (dir: number): void => {
    const at: number = MM_ZOOMS.indexOf(zoom);
    const i: number = Math.max(0, at < 0 ? 1 : at);
    const next: number = MM_ZOOMS[Math.min(MM_ZOOMS.length - 1, Math.max(0, i + dir))] ?? zoom;
    setZoom(next);
    uiSession.minimapZoom = next;
  };
  return (
    <div className="minimap">
      <div className="mm-tl">✦ Realm</div>
      <div className="minimap-wrap">
        <canvas id="minimap-canvas" width="480" height="340" title="Click to set a waypoint" onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const radius = 2200 / zoom;
          setWaypoint((pos.x ?? 0) + ((event.clientX - rect.left) / rect.width - 0.5) * radius * 2,
            (pos.y ?? 0) + ((event.clientY - rect.top) / rect.height - 0.5) * radius * 2);
        }} />
        <div className="mm-zoom">
          <button onClick={() => setLegend((v) => !v)} title="Toggle legend" aria-label="Toggle legend">?</button>
          <button onClick={() => cycle(-1)} title="Minimap zoom out">−</button>
          <button onClick={() => cycle(1)} title="Minimap zoom in">+</button>
        </div>
      </div>
      {nav && <div className="navigation-card">
        <span className="navigation-arrow" aria-hidden="true" style={{ transform: `rotate(${nav.bearing}deg)` }}>↑</span>
        <div><strong>{nav.label}</strong><small>{nav.direction} · {nav.distance.toLocaleString()} units away</small></div>
        <button onClick={clearWaypoint} aria-label="Clear waypoint" title="Clear waypoint">×</button>
      </div>}
      {legend && (
        <div className="mm-legend-box">
          {MM_ICON_LEGEND.map(([g, c, n]) => (
            <span key={n}><i style={{ color: c }}>{g}</i>{n}</span>
          ))}
          <span><i style={{ color: '#d33a2e' }}>◆</i>Enemy</span>
          <em>Dark areas are unexplored.</em>
        </div>
      )}
    </div>
  );
}

/** World camera zoom widget (wheel / +/- / Z/X do the same). */
export function ZoomControls(): JSX.Element {
  const z = useGameState([CH.SETTINGS], (): number => {
    const raw: number = Number(GameState.s?.settings?.camZoom ?? 1);
    return Math.max(0.6, Math.min(2, Number.isFinite(raw) ? raw : 1));
  }) as number;
  const nudge = (dir: number): void => {
        import('../../game/core/EventBus.ts').then(({ Bus }: any) => Bus.emit('cam-zoom', dir));
  };
  return (
    <div className="camzoom" title="Camera zoom (wheel, +/-, Z/X)">
      <button onClick={() => nudge(-1)} aria-label="Zoom camera out">−</button>
      <span>{Math.round(z * 100)}%</span>
      <button onClick={() => nudge(1)} aria-label="Zoom camera in">+</button>
    </div>
  );
}

export function AchievementPopup(): JSX.Element | null {
  const ach = useGameState([CH.ACHIEVEMENTS], () => uiSession.lastAchievement) as AchievementData | null | undefined;
  useEffect(() => {
    if (!ach) return;
    const t = setTimeout(() => {
      if (uiSession.lastAchievement?.id === ach.id) {
        uiSession.lastAchievement = null;
        GameState.notify(CH.ACHIEVEMENTS);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [ach?.id]);
  if (!ach || Date.now() - (ach.at || 0) > 6000) return null;
  return (
    <div className="achieve-popup">
      <b>🏆 {ach.name}</b>
      <span>{ach.desc}</span>
    </div>
  );
}

export function BossBar(): JSX.Element | null {
  const boss = useGameState([CH.BOSSBAR], (): BossSnapshot => ({
    name: uiSession.activeBoss?.name,
    hp: uiSession.activeBoss?.hp,
    maxHp: uiSession.activeBoss?.maxHp,
    phase: uiSession.activeBoss?.phase
  })) as BossSnapshot | null | undefined;
  if (!boss?.name) return null;
  const pct: number = Math.max(0, Math.min(100, (boss.hp ?? 0) / (boss.maxHp ?? 1) * 100));
  return (
    <div className="bossbar">
      <div className="boss-name">{boss.name}</div>
      <div className="boss-hp"><div style={{ width: pct + '%' }} /></div>
      {(boss.phase ?? 0) > 0 && <div className="boss-phase">PHASE {boss.phase}</div>}
    </div>
  );
}

export function Dialogue(): JSX.Element | null {
  const d = useGameState([CH.DIALOGUE], () => GameState.session.dialogue) as DialogueData | null | undefined;
  useEffect(() => {
    if (d) {
            const off = import('../../game/core/EventBus.ts').then(({ Bus }: any) => Bus.emit('play-sound', 'ui_open'));
      void off;
    }
  }, [d?.npc]);

  if (!d) return null;

  const run = (fn: string, arg?: unknown): void => {
    if (fn === 'offerSideQuest') {
      import('../../game/systems/QuestSystem.ts').then((m: any) => m.offerSideQuest(arg));
    } else if (fn === 'recruitNpc') {
            import('../../game/main.ts').then((m: any) => m.worldScene()?.recruitNpcFrom?.(arg));
    } else if (fn === 'openTrade') {
            import('../../game/main.ts').then((m: any) => m.worldScene()?.openTradeFor?.(arg));
    }
    if (fn !== 'openTrade') {
      GameState.session.dialogue = null;
            import('../../game/core/EventBus.ts').then(({ Bus }: any) => Bus.emit('UI', null));
    }
  };

  return (
    <div className="dialogue-backdrop" onClick={() => { GameState.session.dialogue = null; }}>
      <div className="dialogue" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-portrait" style={{ background: d.portrait }} />
        <div className="dlg-body">
          <div className="dlg-name">{d.name}</div>
          <div className="dlg-lines">{(d.lines ?? []).join('\n')}</div>
          {(d.actions?.length ?? 0) > 0 && (
            <div className="dlg-actions">
              {(d.actions ?? []).map((a, i) => <button key={i} className="btn btn-small" onClick={() => run(a.fn, a.arg)}>{a.label}</button>)}
            </div>
          )}
          <button className="btn btn-small dlg-close" onClick={() => { GameState.session.dialogue = null; }}>Farewell</button>
        </div>
      </div>
    </div>
  );
}
