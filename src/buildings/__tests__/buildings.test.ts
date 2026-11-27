import { describe, expect, it } from 'vitest';
import { generate, kindOf, STYLES, WORLD_STYLE, type Kind } from '../generate';
import { validate } from '../validate';

const KINDS: Kind[] = ['cantina', 'hospital', 'armoury', 'market', 'temple', 'guild', 'bank', 'house'];
const FOOTPRINTS: [number, number][] = [[0, 0], [6, 6], [10, 9], [16, 14], [22, 18], [40, 40], [9, 30], [30, 9]];

describe('generated buildings', () => {
  it('every planet has a style', () => {
    for (const s of Object.values(WORLD_STYLE)) expect(STYLES[s], s).toBeTruthy();
  });
  it('classifies world placement types', () => {
    expect(kindOf('object/building/tatooine/cantina_tatooine.iff')).toBe('cantina');
    expect(kindOf('hospital_naboo')).toBe('hospital');
    expect(kindOf('filler_building_tatt_style01_01')).toBe('house');
    expect(kindOf('wall_straight')).toBeNull();
  });
  for (const kind of KINDS)
    for (const style of Object.keys(STYLES))
      it(`${kind} / ${style}: walkable, usable, valid across seeds and footprints`, () => {
        const fails: string[] = [];
        for (let seed = 1; seed <= 25; seed++)
          for (const [w, d] of FOOTPRINTS) {
            const b = generate(kind, style, w, d, seed * 7919 + w * 31 + d);
            const r = validate(b);
            if (!r.ok) fails.push(`seed ${seed} ${w}x${d}: ${r.errors.slice(0, 3).join('; ')}`);
            if (r.stats.reachedShare < 0.5) fails.push(`seed ${seed} ${w}x${d}: only ${(r.stats.reachedShare * 100).toFixed(0)}% of the floor reached`);
          }
        expect(fails.slice(0, 8)).toEqual([]);
      });
  it('is deterministic', () => {
    expect(JSON.stringify(generate('cantina', 'sarrak', 18, 15, 42))).toBe(JSON.stringify(generate('cantina', 'sarrak', 18, 15, 42)));
  });
  it('service buildings have what their name promises', () => {
    const has = (k: Kind, f: (b: ReturnType<typeof generate>) => boolean) => expect(f(generate(k, 'coraxis', 18, 15, 3)), k).toBe(true);
    has('cantina', (b) => b.slots.some((s) => s.npc === 'bartender') && b.slots.some((s) => s.kind === 'terminal'));
    has('hospital', (b) => b.slots.some((s) => s.npc === 'medic') && b.slots.some((s) => s.kind === 'bed'));
    has('armoury', (b) => b.slots.some((s) => s.npc === 'vendor_weapons') && b.slots.some((s) => s.kind === 'rack'));
    has('temple', (b) => b.slots.some((s) => s.kind === 'altar') && b.slots.some((s) => s.npc === 'priest'));
    has('bank', (b) => b.slots.some((s) => s.npc === 'banker'));
    has('market', (b) => b.slots.filter((s) => s.kind === 'vendor').length >= 2);
  });
});

describe('the validator itself catches faults', () => {
  it('a box in the front door is caught', () => {
    const b = generate('cantina', 'coraxis', 18, 15, 1);
    b.boxes.push({ x: 0, y: 1, z: b.d / 2 - 0.2, hx: 1.2, hy: 1, hz: 0.3, mat: 'wood', solid: true });
    const r = validate(b);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/blocks the door|cannot be walked through/);
  });
  it('a sealed back room is caught', () => {
    const b = generate('bank', 'coraxis', 14, 12, 1);
    const inner = b.doors.find((d) => !d.exterior)!;
    b.boxes.push({ x: inner.x, y: 1.2, z: inner.z, hx: inner.w / 2 + 0.1, hy: 1.2, hz: 0.2, mat: 'wall', solid: true });
    expect(validate(b).errors.join(' ')).toMatch(/Vault" cannot be reached/);
  });
  it('a narrow door is caught', () => {
    const b = generate('house', 'talvern', 10, 9, 1);
    b.doors[0].w = 0.8;
    expect(validate(b).errors.join(' ')).toMatch(/wide/);
  });
});
