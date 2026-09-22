// ─────────────────────────────────────────────────────────────────────────────
// ElementalSystem — elements, resistances and status effects for ARPG combat.
//
// Pure module (zero Phaser imports) so the damage math is unit-testable and
// the combat path stays thin: entities call in, this decides the numbers.
//
// Design (docs/improvements/09-ARPG-TRANSFORMATION-PLAN.md):
//   • Weapon defs carry `element` + `special`; enemy defs carry `weak`/`resist`
//     arrays. Defaults keep every existing enemy/weapon valid unchanged.
//   • Status effects (burn/chill/shock/poison) are simple per-enemy timers the
//     victim ticks down — no scene dependencies, no tweens, deterministic.
// ─────────────────────────────────────────────────────────────────────────────

export type Element =
  | 'physical' | 'fire' | 'ice' | 'lightning' | 'poison' | 'shadow' | 'holy';

/** Visual + gameplay identity of each element. Data, not logic. */
export interface ElementInfo {
  /** Floater + FX color. */
  color: string;
  /** Tint applied to the victim sprite while the element lands. */
  tint: number;
  /** Status effect this element can inflict. */
  status: StatusKind | null;
}

export type StatusKind = 'burn' | 'chill' | 'shock' | 'poison';

export interface StatusInstance {
  kind: StatusKind;
  /** Seconds remaining. */
  t: number;
  /** Damage per tick (burn/poison) or effect strength (chill/shock). */
  power: number;
}

/** Per-enemy status bookkeeping (owned by the Enemy instance). */
export interface StatusState {
  list: StatusInstance[];
  /** Accumulator so status ticks land on a steady 0.5s beat. */
  acc: number;
  /** While > 0, movement multiplier is reduced (chill). */
  chillT: number;
  chillMult: number;
  /** While > 0, all damage taken is amplified (shock). */
  shockT: number;
}

export function newStatusState(): StatusState {
  return { list: [], acc: 0, chillT: 0, chillMult: 1, shockT: 0 };
}

export const ELEMENTS: Readonly<Record<Element, ElementInfo>> = Object.freeze({
  physical:  { color: '#ffffff', tint: 0xffffff, status: null },
  fire:      { color: '#ff8a4a', tint: 0xff9a5c, status: 'burn' },
  ice:       { color: '#9fdcff', tint: 0x9fdcff, status: 'chill' },
  lightning: { color: '#ffe86b', tint: 0xffe86b, status: 'shock' },
  poison:    { color: '#9fe86b', tint: 0x9fe86b, status: 'poison' },
  shadow:    { color: '#b48aff', tint: 0xb48aff, status: null },
  holy:      { color: '#fff3c9', tint: 0xfff3c9, status: null },
});

export function isElement(v: unknown): v is Element {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ELEMENTS, v);
}

/** Multiplier when the defender is weak to / resistant to an element. */
export const WEAK_MULT = 1.35;
export const RESIST_MULT = 0.65;

/**
 * Final damage for one hit of `element` against a defender profile.
 * Weak/Resist are arrays on enemy defs; absent = neutral (×1).
 */
export function elementalDamage(
  base: number,
  element: Element,
  def: { weak?: string[]; resist?: string[] } | null | undefined
): { dmg: number; mult: number } {
  let mult = 1;
  if (def?.weak?.includes(element)) mult *= WEAK_MULT;
  if (def?.resist?.includes(element)) mult *= RESIST_MULT;
  return { dmg: base * mult, mult };
}

/** Does this hit inflict a status, and how strong? */
export function statusFor(
  element: Element,
  baseDmg: number,
  opts?: { force?: boolean }
): StatusInstance | null {
  const kind = ELEMENTS[element].status;
  if (!kind) return null;
  // ~45% chance per hit; guaranteed on crits (caller passes force=crit).
  if (!opts?.force && Math.random() > 0.45) return null;
  // Damage-over-time scales with the hit; control effects use flat power.
  const power = kind === 'burn' || kind === 'poison'
    ? Math.max(2, Math.round(baseDmg * 0.18))
    : 1;
  const dur = kind === 'burn' ? 3 : kind === 'poison' ? 5 : kind === 'chill' ? 2.5 : 1.5;
  return { kind, t: dur, power };
}

/** Apply (or stack-refresh) a status onto a victim's state. Returns true if new. */
export function applyStatus(state: StatusState, inst: StatusInstance): boolean {
  // Chill drives the movement multiplier and shock the damage-taken amp —
  // arm their timers here so the very next tickStatuses() applies them
  // (list entries alone are inert bookkeeping).
  if (inst.kind === 'chill') state.chillT = Math.max(state.chillT, inst.t);
  if (inst.kind === 'shock') state.shockT = Math.max(state.shockT, inst.t);
  const existing = state.list.find((s) => s.kind === inst.kind);
  if (existing) {
    existing.t = Math.max(existing.t, inst.t);
    existing.power = Math.max(existing.power, inst.power);
    return false;
  }
  state.list.push(inst);
  return true;
}

/**
 * Tick statuses on a 0.5s beat. Returns damage dealt this call (0 most frames)
 * and mutates movement multipliers for chill. Caller owns dt.
 */
export function tickStatuses(state: StatusState, dt: number): { dot: number; kind: StatusKind | null } {
  let dot = 0;
  let kind: StatusKind | null = null;
  state.chillT = Math.max(0, state.chillT - dt);
  state.chillMult = state.chillT > 0 ? 0.55 : 1;
  state.shockT = Math.max(0, state.shockT - dt);
  for (const s of state.list) s.t -= dt;
  state.list = state.list.filter((s) => s.t > 0);
  state.acc += dt;
  while (state.acc >= 0.5) {
    state.acc -= 0.5;
    for (const s of state.list) {
      if (s.kind === 'burn' || s.kind === 'poison') {
        dot += s.power;
        kind = s.kind;
      }
    }
  }
  return { dot, kind };
}

/** Movement speed multiplier from active statuses (chill only). */
export function statusMoveMult(state: StatusState): number {
  return state.chillMult;
}

/** Damage-taken multiplier from active statuses (shock only). */
export function damageTakenMult(state: StatusState): number {
  return state.shockT > 0 ? 1.15 : 1;
}

/** Serialized form for boss/save needs later — keep minimal now. */
export function statusSummary(state: StatusState): StatusKind[] {
  return state.list.map((s) => s.kind);
}
