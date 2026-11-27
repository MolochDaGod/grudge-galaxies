/**
 * Deterministic simulation tick.
 *
 * The legacy loop called gameTick(dt) once per rendered frame with a clamped variable dt, so every timer, cooldown,
 * AI decision and status tick depended on the frame rate, and under 20 fps the whole game ran in slow motion.
 *
 * Now gameTick (combat, AI, status, cooldowns, projectiles, harvesting, whales, weather...) runs in fixed 1/60 s steps
 * from an accumulator measured in real time:
 *  - same inputs -> same steps -> same results, on any monitor (30, 60, 144 Hz)
 *  - a slow frame runs up to MAX_STEPS catch-up steps; beyond that, time is dropped (a stall never causes a spiral)
 *  - inside a step, Math.random is a seeded generator (mulberry32) whose state advances only with simulation steps,
 *    so a recorded seed + input log replays exactly. Rendering, VFX and UI outside the step keep the native random.
 *  - `alpha` (0..1, how far the render sits between the last two steps) is exposed for interpolation.
 */
import { bridge } from '../bridge';

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
const MAX_STEPS = 5;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, get state() { return a; }, set state(v: number) { a = v >>> 0; } };
}

export const Sim = {
  step: 0,
  alpha: 0,
  dropped: 0,
  seed: (Date.now() ^ 0x9e3779b9) >>> 0,
  rng: mulberry32(0),
  /** reseed the simulation stream (replays, multiplayer rooms, tests) */
  reseed(seed: number) {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
    this.step = 0;
  },
};
Sim.rng = mulberry32(Sim.seed);

export async function installFixedTick() {
  const B = await bridge();
  const nativeRandom = Math.random;
  let acc = 0;
  let last = performance.now();
  B.wrap('gameTick', (orig) => function (this: unknown) {
    const now = performance.now();
    let real = (now - last) / 1000;
    last = now;
    if (real > 0.25) real = 0.25; // tab was hidden / long load: don't fast-forward minutes of simulation
    acc += real;
    let n = 0;
    Math.random = Sim.rng.next;
    try {
      while (acc >= SIM_DT && n < MAX_STEPS) {
        orig.call(this, SIM_DT);
        acc -= SIM_DT;
        Sim.step++;
        n++;
      }
    } finally {
      Math.random = nativeRandom;
    }
    if (acc >= SIM_DT) {
      Sim.dropped += acc;
      acc = acc % SIM_DT;
    }
    Sim.alpha = acc / SIM_DT;
  });
  (window as any).GG_SIM = Sim;
}
