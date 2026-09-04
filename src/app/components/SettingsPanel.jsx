// Settings screen (spec §59): volumes, video, accessibility, gameplay,
// controls. Single source of UI mutators → SettingsSystem.updateSettings()
// which performs validation, persistence, DOM/audio/bus side-effects.
import React from 'react';
import GameState from '../../game/core/GameState.js';
import { CH } from '../../game/core/EventBus.js';
import { useGameState } from '../../hooks/useGameState.js';
import {
  updateSettings,
  resetSettings,
  SETTINGS_LIMITS,
  SETTINGS_DEFAULTS,
  KEYBINDS_DEFAULT,
  lastApplied
} from '../../game/systems/SettingsSystem.js';
import { playSfx } from '../../game/systems/AudioSystem.js';

const BIND_LABELS = {
  up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right',
  dodge: 'Dodge roll', sprint: 'Sprint',
  gather: 'Gather / interact', inventory: 'Inventory', crafting: 'Crafting',
  map: 'Map', journal: 'Journal', kingdom: 'Kingdom', build: 'Build mode',
  skills: 'Skills', pause: 'Pause',
};

/** Map a KeyboardEvent to a Phaser KeyCodes name (null = unsupported). */
function eventToCodeName(e) {
  if (e.key === ' ') return 'SPACE';
  if (typeof e.key === 'string' && e.key.startsWith('Arrow')) return e.key.slice(5).toUpperCase();
  if (e.key && e.key.length === 1) {
    const c = e.key.toUpperCase();
    if (/^[A-Z]$/.test(c)) return c;
    const digits = { 0: 'ZERO', 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE', 6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE' };
    if (/^[0-9]$/.test(c)) return digits[c];
    const sym = { ';': 'SEMICOLON', '=': 'EQUALS', ',': 'COMMA', '.': 'PERIOD', '/': 'FORWARD_SLASH', '\\': 'BACK_SLASH', "'": 'QUOTES', '[': 'OPEN_BRACKET', ']': 'CLOSED_BRACKET', '-': 'MINUS', '`': 'BACKTICK' };
    return sym[e.key] || null;
  }
  const named = { Shift: 'SHIFT', Control: 'CTRL', Alt: 'ALT', Escape: 'ESC', Enter: 'ENTER', Tab: 'TAB', Backspace: 'BACKSPACE', Delete: 'DELETE', CapsLock: 'CAPS_LOCK', Insert: 'INSERT', Home: 'HOME', End: 'END', PageUp: 'PAGE_UP', PageDown: 'PAGE_DOWN' };
  return named[e.key] || null;
}

export default function SettingsPanel({ onBack }) {
  // Read the canonical "last applied" settings snapshot. This works whether
  // we are at the main menu (no save loaded) or inside a run, because
  // SettingsSystem keeps the snapshot up to date on every applySettings().
  const live = useGameState(
    [CH.SETTINGS, 'settings-applied', 'refresh-ui'],
    () => lastApplied()
  );
  const s = live || SETTINGS_DEFAULTS;

  const onV = (key, v) => updateSettings({ volumes: { [key]: v } });
  const onT = (key, v) => updateSettings({ toggles: { [key]: v } });
  const onScalar = (key, v) => updateSettings({ [key]: v });

  const muteAll = s.toggles.musicOn === false && s.toggles.sfxOn === false;
  const toggleMute = () => {
    onT('musicOn', muteAll);
    onT('sfxOn', muteAll);
  };

  return (
    <div className="panel settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button
          type="button"
          className="btn btn-ghost btn-small settings-reset"
          onClick={() => { resetSettings(); playSfx?.('ui_click'); }}
        >
          Reset to defaults
        </button>
      </div>

      {/* ── Audio ──────────────────────────────────────────────────────── */}
      <Section
        title="Audio"
        hint="Volumes blend in real time. They also save into the save file."
      >
        <Row label="Master" hint="Master volume for everything.">
          <Slider value={s.volumes.master} min={0} max={1} onChange={(v) => onV('master', v)} />
        </Row>
        <Row label="Music" hint="Procedural ambience + per-biome music.">
          <Slider value={s.volumes.music} min={0} max={1} onChange={(v) => onV('music', v)} />
        </Row>
        <Row label="SFX" hint="Combat, gathering, UI clicks, ambient layers.">
          <Slider value={s.volumes.sfx} min={0} max={1} onChange={(v) => onV('sfx', v)} />
        </Row>
        <Toggle label="Music enabled" checked={s.toggles.musicOn !== false} onChange={(v) => onT('musicOn', v)} />
        <Toggle label="SFX enabled" checked={s.toggles.sfxOn !== false} onChange={(v) => onT('sfxOn', v)} />
        <button type="button" className="btn btn-small btn-ghost settings-mute" onClick={toggleMute}>
          {muteAll ? 'Unmute all' : 'Mute all audio'}
        </button>
      </Section>

      {/* ── Video / Quality ────────────────────────────────────────────── */}
      <Section title="Video & Quality" hint="Lower these on slower hardware or for a calmer look.">
        <Row label="Graphics quality" hint="Master preset. Controls bloom, fog, aberration, and particle density.">
          <PillSelect
            value={s.graphicsQuality || 'med'}
            options={SETTINGS_LIMITS.graphicsQuality.allowed}
            onChange={(v) => onScalar('graphicsQuality', v)}
            labels={{ low: 'Low', med: 'Med', high: 'High', ultra: 'Ultra' }}
          />
        </Row>
        <Row label="Particles" hint="Reduces on-screen sparks, smoke, fireflies.">
          <PillSelect
            value={s.particles}
            options={SETTINGS_LIMITS.particles.allowed}
            onChange={(v) => onScalar('particles', v)}
          />
        </Row>
        <Toggle label="Shadows" hint="Ground shadow ellipses under entities." checked={s.shadows !== false} onChange={(v) => onScalar('shadows', v)} />
        <Toggle label="Distance fog" hint="Faraway terrain fades into the horizon. Disable on slow hardware." checked={s.distanceFog !== false} onChange={(v) => onScalar('distanceFog', v)} />
        <Row label="FPS cap" hint="Lower to 30 on weak hardware or hot laptops. Auto = display default.">
          <PillSelect
            value={s.fpsCap ?? 0}
            options={SETTINGS_LIMITS.fpsCap.allowed}
            onChange={(v) => onScalar('fpsCap', v)}
            labels={{ 0: 'Auto', 30: '30', 60: '60', 120: '120' }}
          />
        </Row>
        <Row label="Fullscreen" hint="Immersive borderless play. ESC exits (browser).">
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => {
              try {
                if (document.fullscreenElement) document.exitFullscreen?.();
                else document.documentElement.requestFullscreen?.();
              } catch { /* unsupported */ }
            }}
          >Toggle fullscreen</button>
        </Row>
        <Row label="UI scale" hint="Zoom the entire game UI.">
          <Slider
            value={s.uiScale}
            min={SETTINGS_LIMITS.uiScale.min}
            max={SETTINGS_LIMITS.uiScale.max}
            step={SETTINGS_LIMITS.uiScale.step}
            onChange={(v) => onScalar('uiScale', v)}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Row>
      </Section>

      {/* ── Accessibility ──────────────────────────────────────────────── */}
      <Section title="Accessibility" hint="Make the game easier on the eyes and brain.">
        <Toggle label="Reduced motion" hint="Disables camera shake and slow pulses." checked={s.toggles.reducedMotion === true} onChange={(v) => onT('reducedMotion', v)} />
        <Toggle label="Screen shake" hint="Hit / damage camera shake." checked={s.toggles.screenShake !== false} onChange={(v) => onT('screenShake', v)} />
        <Toggle label="Photosensitivity-safe" hint="No fullscreen flashes, bloom pulses, chromatic aberration or shake." checked={s.toggles.photosensitive === true} onChange={(v) => onT('photosensitive', v)} />
        <Toggle label="Damage numbers" hint="Float damage values when hitting enemies." checked={s.toggles.damageNumbers !== false} onChange={(v) => onT('damageNumbers', v)} />
        <Toggle label="HP bars above enemies" hint="Always-on enemy HP bars instead of hover-only." checked={s.toggles.hpBarsAbove !== false} onChange={(v) => onT('hpBarsAbove', v)} />
        <Toggle label="Colorblind-friendly HUD" hint="Uses higher-contrast shapes & icons for status." checked={s.toggles.colorblindHints === true} onChange={(v) => onT('colorblindHints', v)} />
        <Row label="Text size" hint="Scales all in-game text and tooltips.">
          <Slider
            value={s.textSize}
            min={SETTINGS_LIMITS.textSize.min}
            max={SETTINGS_LIMITS.textSize.max}
            step={SETTINGS_LIMITS.textSize.step}
            onChange={(v) => onScalar('textSize', v)}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Row>
      </Section>

      {/* ── Gameplay ───────────────────────────────────────────────────── */}
      <Section title="Gameplay" hint="Difficulty changes loot, damage, and survival drain mid-run.">
        <div className="setting-test-flag">
          <strong>⚠ Test only</strong>
          <span>These options affect game balance and survival. Use for debugging or stress-testing systems.</span>
        </div>
        <Row label="Immortal (god mode)" hint="Player cannot die from combat or survival drains. Damage is clamped to 1 hp. Saves regardless.">
          <OnOffButton
            value={s.immortal === true}
            onChange={(v) => onScalar('immortal', v)}
            onLabel="ON"
            offLabel="OFF"
            danger
          />
        </Row>
        <Row label="Difficulty" hint="Affects enemy power, resource yields, and survival pressure.">
          <PillSelect
            value={s.difficulty}
            options={SETTINGS_LIMITS.difficulty.allowed}
            onChange={(v) => onScalar('difficulty', v)}
            labels={{ story: 'Story', normal: 'Normal', hard: 'Hard', legendary: 'Legendary' }}
          />
        </Row>
        <Toggle label="Auto-save" hint="Save your progress automatically every few minutes." checked={s.autosave !== false} onChange={(v) => onScalar('autosave', v)} />
        {s.autosave !== false && (
          <Row label="Auto-save every" hint="Time between automatic saves (seconds).">
            <Slider
              value={s.autosaveSec}
              min={SETTINGS_LIMITS.autosaveSec.min}
              max={SETTINGS_LIMITS.autosaveSec.max}
              step={SETTINGS_LIMITS.autosaveSec.step}
              onChange={(v) => onScalar('autosaveSec', v)}
              format={(v) => `${v}s`}
            />
          </Row>
        )}
      </Section>

      {/* ── Controls ───────────────────────────────────────────────────── */}
      <Section title="Controls" hint="WASD + arrows always move. Click a binding, then press a key.">
        <Row label="Movement keys" hint="Highlighted in the on-screen hints.">
          <PillSelect
            value={s.movementScheme}
            options={SETTINGS_LIMITS.movementScheme.allowed}
            onChange={(v) => onScalar('movementScheme', v)}
            labels={{ wasd: 'WASD', arrows: 'Arrows' }}
          />
        </Row>
        <KeybindList binds={s.keybinds || {}} />
      </Section>

      {onBack && (
        <button className="btn btn-menu btn-small settings-back" onClick={onBack}>BACK</button>
      )}
    </div>
  );
}

/* ── Key rebinding (Phase E) ─────────────────────────────────────────── */

function KeybindList({ binds }) {
  const [capturing, setCapturing] = React.useState(null); // action being rebound
  React.useEffect(() => {
    if (!capturing) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = eventToCodeName(e);
      if (code) updateSettings({ keybinds: { [capturing]: code } });
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing]);
  const reset = () => updateSettings({ keybinds: { ...KEYBINDS_DEFAULT } });
  return (
    <div className="settings-keybinds">
      <div className="settings-keybinds-title">
        Key bindings
        <button type="button" className="btn btn-small btn-ghost" onClick={reset}>Reset keys</button>
      </div>
      <ul>
        {Object.keys(BIND_LABELS).map((action) => (
          <li key={action}>
            <span>{BIND_LABELS[action]}</span>
            <button
              type="button"
              className={`keybind-cap ${capturing === action ? 'capturing' : ''}`}
              onClick={() => setCapturing(action)}
            >
              <kbd>{capturing === action ? 'press key…' : (binds[action] || KEYBINDS_DEFAULT[action])}</kbd>
            </button>
          </li>
        ))}
      </ul>
      <em className="setting-row-hint">Mouse: LMB attack (hold = heavy) · RMB block.</em>
    </div>
  );
}

/* ── Atoms ─────────────────────────────────────────────────────────────── */

function Section({ title, hint, children }) {
  return (
    <div className="setting-group">
      <div className="setting-group-head">
        <h4>{title}</h4>
        {hint && <p className="setting-hint">{hint}</p>}
      </div>
      <div className="setting-group-body">{children}</div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="setting-row">
      <div className="setting-row-text">
        <span className="setting-label">{label}</span>
        {hint && <em className="setting-row-hint">{hint}</em>}
      </div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="setting-toggle">
      <span className="setting-toggle-text">
        <span className="setting-label">{label}</span>
        {hint && <em className="setting-row-hint">{hint}</em>}
      </span>
      <span className={`setting-toggle-switch ${checked ? 'on' : 'off'}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="setting-toggle-knob" />
      </span>
    </label>
  );
}

/**
 * Real <button>-based ON/OFF switch. Unlike Toggle (which uses an invisible
 * checkbox), this renders a real button element with role="switch" so right-
 * click context menus behave normally and screen readers announce the state.
 * Used for the Immortal god-mode flag where accidental right-clicks must not
 * interfere with the toggle.
 */
function OnOffButton({ value, onChange, onLabel = 'ON', offLabel = 'OFF', danger }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={`setting-onoff ${value ? 'on' : 'off'} ${danger ? 'danger' : ''}`}
      onClick={() => onChange(!value)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="setting-onoff-track">
        <span className="setting-onoff-knob" />
      </span>
      <span className="setting-onoff-label">{value ? onLabel : offLabel}</span>
    </button>
  );
}

/** Themed slider with live percentage badge. */
function Slider({ value, onChange, min = 0, max = 1, step = 0.05, format }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fmt = format ? format(value) : value.toFixed(2);
  return (
    <div className="setting-slider">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ '--fill': `${pct * 100}%` }}
      />
      <span className="setting-slider-readout">{fmt}</span>
    </div>
  );
}

/** Compact pill-style segmented control for short option lists. */
function PillSelect({ value, options, onChange, labels }) {
  return (
    <div className="setting-pills" role="radiogroup">
      {options.map((o) => {
        const label = (labels && labels[o]) || o;
        const active = o === value;
        return (
          <button
            type="button"
            key={o}
            role="radio"
            aria-checked={active}
            className={`setting-pill ${active ? 'active' : ''}`}
            onClick={() => onChange(o)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Touch SETTINGS_DEFAULTS so the import isn't unused (kept for future presets).
void SETTINGS_DEFAULTS;