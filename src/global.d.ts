// ─────────────────────────────────────────────────────────────────────────────
// Ambient browser globals used by the game runtime.
//
// Everything the app hangs off `window` is declared here once so the typed
// modules can use it without per-call casts. Kept runtime-free (types only).
// ─────────────────────────────────────────────────────────────────────────────

/** Audio graph stashed on window so HMR module instances share one AudioContext. */
export interface RiseAudioStash {
  ctx: AudioContext;
  masterGain: GainNode;
  musicGain: GainNode;
  comp: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  sfxGain: GainNode;
}

/** One debug-console command (dev-only). Never throws. */
export type RiseDebugCommand = (...args: any[]) => unknown;

declare global {
  interface Window {
    /** Non-standard Safari/older-Chrome constructor for AudioContext. */
    webkitAudioContext?: typeof AudioContext;
    /** Single shared WebAudio graph (survives Vite HMR). */
    __RISE_AUDIO__?: RiseAudioStash;
    /** Live Phaser game handle used by automated playtests. */
    riseGame?: Phaser.Game;
    /** Dev-only debug console (`import.meta.env.DEV` builds only). */
    rise?: Record<string, RiseDebugCommand>;
    /** Dev-only audio diagnostics console. */
    riseAudio?: Record<string, RiseDebugCommand>;
  }
}
