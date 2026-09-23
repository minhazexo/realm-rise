// SavePanel — one panel, one file (split out of the Panels.tsx hub 2026-09-23).
import { useState } from 'react';
import type { JSX } from 'react';
import GameState from '../../../game/core/GameState.ts';
import { deleteSlot, exportSlot, importSlotData, listSaves, loadFromSlot, saveToSlot } from '../../../game/systems/SaveSystem.ts';
import type { SaveSummary } from './types.ts';

/* ── Save / Load + export / import ────────────────────────────────────── */
export function SavePanel(): JSX.Element {
  const [saves, setSaves] = useState<Record<string, SaveSummary | undefined>>(() => listSaves() as Record<string, SaveSummary | undefined>);
  const refresh = (): void => setSaves(listSaves() as Record<string, SaveSummary | undefined>);
  const doSave = (slot: string): void => { saveToSlot(slot, GameState.s); refresh(); };
  const doLoad = (slot: string): void => {
    const data: any = loadFromSlot(slot);
        if (data) import('../../../game/main.ts').then((m: any) => m.loadGameIntoWorld(data));
    else refresh();
  };
  const doExport = (slot: string): void => {
    const r: any = exportSlot(slot);
    if (!r.ok) { GameState.toast({ title: 'Export failed', msg: r.msg, kind: 'warn', icon: undefined }); return; }
    const blob = new Blob([r.json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rise-of-the-realm-${slot}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const doImport = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      const r: any = importSlotData(String(reader.result || ''), 'slot1');
      GameState.toast(r.ok
        ? { title: 'Save imported', msg: 'Loaded into Slot 1.', kind: 'quest', icon: undefined }
        : { title: 'Import failed', msg: r.msg, kind: 'warn', icon: undefined });
      refresh();
    };
    reader.readAsText(file);
  };
  return (
    <div className="panel save-panel">
      <h2>Save / Load</h2>
      {['auto', 'slot1', 'slot2', 'slot3'].map((slot) => {
        const s = saves[slot];
        return (
          <div key={slot} className="save-row">
            <div className="save-meta">
              <b>{slot}</b> {s ? <span>· {s.name} · Lv {s.level} · Day {s.day}</span> : <em>Empty</em>}
            </div>
            <div className="save-actions">
              {slot !== 'auto' && <button onClick={() => doSave(slot)}>Save</button>}
              <button onClick={() => doLoad(slot)} disabled={!s}>Load</button>
              <button onClick={() => doExport(slot)} disabled={!s}>Export</button>
              {slot !== 'auto' && <button onClick={() => { deleteSlot(slot); refresh(); }} disabled={!s}>✕</button>}
            </div>
          </div>
        );
      })}
      <label className="import-row">Import save file (→ Slot 1):
        <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); }} />
      </label>
    </div>
  );
}
// ==PANELS_D==
