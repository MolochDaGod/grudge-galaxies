/**
 * Data-driven finite state machine.
 *
 * A machine is a table of states. Each state can:
 *  - onEnter(ctx) / onExit(ctx)
 *  - tick(ctx, dt) -> next state name (or nothing to stay)
 *  - on: { eventName: 'nextState' | (ctx, payload) => nextState | undefined }   (attacked, zeroHealth, lostTarget...)
 * plus a machine-wide `any` table of event transitions checked first (e.g. zeroHealth -> death from every state).
 * States are plain objects, so behaviours are composed from data and small functions, and a state graph can be
 * printed, validated or edited without touching the engine. Deterministic: no timers outside tick().
 */
export type Next<C> = string | void | undefined | ((ctx: C, payload?: unknown) => string | void | undefined);

export interface StateDef<C> {
  onEnter?(ctx: C): void;
  onExit?(ctx: C): void;
  tick?(ctx: C, dt: number): string | void | undefined;
  on?: Record<string, Next<C>>;
}

export interface MachineDef<C> {
  initial: string;
  states: Record<string, StateDef<C>>;
  any?: Record<string, Next<C>>;
}

export class Machine<C> {
  state: string;
  t = 0; // seconds in the current state
  history: string[] = [];
  constructor(readonly def: MachineDef<C>, readonly ctx: C) {
    this.state = def.initial;
    if (!def.states[this.state]) throw new Error(`FSM: unknown initial state ${this.state}`);
    def.states[this.state].onEnter?.(ctx);
  }
  go(next: string | void | undefined) {
    if (!next || next === this.state) return;
    const to = this.def.states[next];
    if (!to) throw new Error(`FSM: unknown state ${next} (from ${this.state})`);
    this.def.states[this.state].onExit?.(this.ctx);
    this.history.push(this.state);
    if (this.history.length > 16) this.history.shift();
    this.state = next;
    this.t = 0;
    to.onEnter?.(this.ctx);
  }
  private resolve(n: Next<C> | undefined, payload?: unknown) {
    return typeof n === 'function' ? n(this.ctx, payload) : n;
  }
  send(event: string, payload?: unknown) {
    const a = this.def.any?.[event];
    if (a !== undefined) {
      const r = this.resolve(a, payload);
      if (r) return this.go(r);
    }
    const s = this.def.states[this.state].on?.[event];
    if (s !== undefined) this.go(this.resolve(s, payload));
  }
  tick(dt: number) {
    this.t += dt;
    this.go(this.def.states[this.state].tick?.(this.ctx, dt));
  }
  /** a readable list of transitions, for docs and debugging */
  describe() {
    const out: string[] = [];
    for (const [name, s] of Object.entries(this.def.states)) for (const [ev, n] of Object.entries(s.on || {})) out.push(`${name} --${ev}--> ${typeof n === 'function' ? '(script)' : n}`);
    for (const [ev, n] of Object.entries(this.def.any || {})) out.push(`* --${ev}--> ${typeof n === 'function' ? '(script)' : n}`);
    return out;
  }
}
