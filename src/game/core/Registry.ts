// ─────────────────────────────────────────────────────────────────────────────
// Generic content Registry — the foundation of the data-driven architecture.
//
// Every content domain (items, enemies, buildings, nodes, ...) funnels
// through this class so IDs are validated once, duplicates throw at load
// time instead of silently winning, and lookups behave identically
// everywhere (`null` on miss, never undefined, never throw).
//
// Usage:
//   import { Registry } from '../core/Registry.ts';
//   export const ENEMIES = new Registry('enemy', { required: ['name', 'hp'] });
//   ENEMIES.defineAll({ wolf: {...}, ... });   // throws on dup / bad id
//   ENEMIES.get('wolf');        // def or null (warns once in dev)
//   ENEMIES.require('wolf');    // def or throws (loading paths)
//   ENEMIES.values();           // frozen array of all defs
//
// Rules:
//   - IDs must be non-empty strings matching /^[A-Za-z0-9_]+$/.
//   - define() on an existing ID throws (no silent last-wins).
//   - get() on a missing ID returns null (safe for gameplay fallbacks).
//   - require() on a missing ID throws (safe for loading/validation).
//   - Stored defs are shallow-frozen; the map itself is sealed after seal().
// ─────────────────────────────────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9_]+$/;

// Missing-ID warnings are rate-limited per registry+id so a per-frame lookup
// of a bad id (e.g. a corrupt save entry) cannot spam the console.
const warned = new Set<string>();

export interface RegistryOpts {
  /** Fields every def must contain. */
  required?: string[];
  /** Suppress duplicate console warnings. */
  quiet?: boolean;
}

export class Registry<TDef extends object = Record<string, any>> {
  name: string;
  required: string[];
  quiet: boolean;
  private _map: Map<string, TDef>;
  private _sealed: boolean;

  /**
   * @param name  Domain name used in error messages (e.g. 'enemy').
   * @param opts  required: fields every def must contain; quiet: suppress warnings.
   */
  constructor(name: string, opts: RegistryOpts = {}) {
    if (!name || typeof name !== 'string') throw new Error('[registry] name is required');
    this.name = name;
    this.required = Array.isArray(opts.required) ? opts.required : [];
    this.quiet = opts.quiet === true;
    this._map = new Map<string, TDef>();
    this._sealed = false;
  }

  /** Validate an ID without registering anything. Returns null or an error string. */
  static checkId(id: string): string | null {
    if (typeof id !== 'string' || id.length === 0) return 'id must be a non-empty string';
    if (!ID_RE.test(id)) return `id "${id}" must match ${ID_RE}`;
    return null;
  }

  /** Register one definition. Throws on bad id, duplicate, or missing fields. */
  define(id: string, def: TDef): this {
    const bad: string | null = Registry.checkId(id);
    if (bad) throw new Error(`[registry:${this.name}] ${bad}`);
    if (def == null || typeof def !== 'object') {
      throw new Error(`[registry:${this.name}] def for "${id}" must be an object`);
    }
    if (this._sealed) throw new Error(`[registry:${this.name}] sealed — cannot define "${id}"`);
    if (this._map.has(id)) {
      throw new Error(`[registry:${this.name}] duplicate id "${id}" (first definition wins, second rejected)`);
    }
    for (const f of this.required) {
      if ((def as Record<string, unknown>)[f] === undefined) {
        throw new Error(`[registry:${this.name}] "${id}" is missing required field "${f}"`);
      }
    }
    this._map.set(id, Object.freeze({ ...def }) as TDef);
    return this;
  }

  /** Register a whole map of id → def. Throws on the first problem. */
  defineAll(map: Record<string, TDef>): this {
    if (map == null || typeof map !== 'object') {
      throw new Error(`[registry:${this.name}] defineAll needs an object map`);
    }
    for (const [id, def] of Object.entries(map)) this.define(id, def);
    return this;
  }

  /**
   * Merge several source maps in order, rejecting cross-file collisions.
   * This replaces the old `Object.assign({}, A, B)` pattern where the later
   * file silently overwrote the earlier one.
   */
  defineSources(sources: Record<string, Record<string, TDef>>): this {
    for (const [label, map] of Object.entries(sources)) {
      if (map == null || typeof map !== 'object') {
        throw new Error(`[registry:${this.name}] source "${label}" is not an object map`);
      }
      for (const [id, def] of Object.entries(map)) {
        if (this._map.has(id)) {
          throw new Error(
            `[registry:${this.name}] collision: "${id}" already defined, redefined by source "${label}"`
          );
        }
        this.define(id, def);
      }
    }
    return this;
  }

  /** Look up a def. Returns the frozen def, or null on miss (never throws). */
  get(id: string): TDef | null {
    // Non-null assertion verified safe by the preceding has() guard.
    if (this._map.has(id)) return this._map.get(id)!;
    if (!this.quiet) {
      const key = `${this.name}:${id}`;
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`[registry:${this.name}] unknown id "${id}" (returning null)`);
      }
    }
    return null;
  }

  /** Look up a def. Returns the def, or throws on miss. */
  require(id: string): TDef {
    const def: TDef | undefined = this._map.get(id);
    if (def === undefined) throw new Error(`[registry:${this.name}] unknown id "${id}"`);
    return def;
  }

  /** True when the id is registered. */
  has(id: string): boolean {
    return this._map.has(id);
  }

  /** All registered IDs (registration order). */
  ids(): string[] {
    return [...this._map.keys()];
  }

  /** All registered defs (registration order). */
  values(): TDef[] {
    return [...this._map.values()];
  }

  /** Number of registered defs. */
  get size(): number {
    return this._map.size;
  }

  /** Seal the registry against further definitions (call after setup). */
  seal(): this {
    this._sealed = true;
    return this;
  }

  /** Frozen plain-object snapshot (for APIs that expect a map). */
  snapshot(): Readonly<Record<string, TDef>> {
    return Object.freeze(Object.fromEntries(this._map));
  }
}
