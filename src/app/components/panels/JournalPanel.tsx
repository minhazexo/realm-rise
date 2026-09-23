// JournalPanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import type { JSX } from 'react';
import { CH } from '../../../game/core/EventBus.ts';
import { useGameState } from '../../../hooks/useGameState.ts';
import { questStateSnapshot } from '../../../game/systems/QuestSystem.ts';
import type { JournalSnapshot } from './types.ts';

/* ── Journal ──────────────────────────────────────────────────────────── */
export function JournalPanel(): JSX.Element {
  const snap = useGameState([CH.QUESTS, CH.STORY], (): JournalSnapshot => {
    try { return questStateSnapshot() as JournalSnapshot; } catch { return { none: true } as JournalSnapshot; }
  }) as JournalSnapshot;
  if (snap.none) return <div className="panel journal-panel"><h2>Journal</h2><em>No active quest.</em></div>;
  return (
    <div className="panel journal-panel">
      <h2>Journal</h2>
      <div className="quest-main">
        <b>{snap.chapter ? `Ch. ${snap.chapter} — ` : ''}{snap.title}</b>
        <ul>{snap.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}>{s.done ? '✓' : '○'} {s.text} ({s.have}/{s.need})</li>)}</ul>
      </div>
      {(snap.side?.length ?? 0) > 0 && (<><h3>Side quests</h3>
        {(snap.side ?? []).map((q) => (
          <div key={q.id} className="quest-main"><b>{q.title}</b>
            <ul>{q.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}>{s.done ? '✓' : '○'} {s.text} ({s.have}/{s.need})</li>)}</ul>
          </div>
        ))}
      </>)}
    </div>
  );
}
