/**
 * Typed access to the legacy runtime (public/legacy/game.js exposes window.GG_BRIDGE once it has started).
 * Modules read live state through it and wrap runtime functions with B.wrap(name, orig => replacement).
 */
export interface Bridge {
  readonly play: any;
  readonly keys: Set<string>;
  readonly groundWorld: any;
  readonly level: 'galaxy' | 'system' | 'planet' | 'ground';
  readonly groundMode: 'overhead' | 'roam' | 'play';
  readonly kitMeshes: any[];
  readonly G: any;
  readonly cam: any;
  readonly scene: any;
  readonly renderer: any;
  readonly quality: string;
  readonly CH: any;
  readonly rts: any;
  readonly HALF: number;
  readonly EXT: number;
  groundH(w: any, x: number, z: number): number;
  waterDepth(w: any, x: number, z: number): number;
  toast(m: string): void;
  floatMsg(m: string): void;
  wrap(
    name: 'updatePlay' | 'gameTick' | 'buildGround' | 'applyKits' | 'rideUpdate' | 'playCharacter',
    make: (orig: (...a: any[]) => any) => (...a: any[]) => any,
  ): void;
}

export function bridge(): Promise<Bridge> {
  const w = window as unknown as { GG_BRIDGE?: Bridge };
  if (w.GG_BRIDGE) return Promise.resolve(w.GG_BRIDGE);
  return new Promise((res) => addEventListener('gg:bridge', () => res(w.GG_BRIDGE!), { once: true }));
}
