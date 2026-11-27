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
  readonly combat: { p: any; cd: number; ecd: number };
  readonly hunt: any;
  selPlacement: any;
  readonly mouselook: boolean;
  readonly GD: any;
  readonly RACE: Record<string, any>;
  readonly CLASS: Record<string, any>;
  readonly FACTION: Record<string, any>;
  readonly WORLDS: any[];
  readonly PLANET_FACTION: Record<string, string>;
  markDirty(): void;
  renderHud(): void;
  gainXP(type: string, n: number, why?: string): void;
  openWin(kind: string): void;
  toonOneShot(model: any, kind: string): void;
  charStats(): any;
  knownAbilities(): any[];
  interact: { label: string; run: () => void } | null;
  readonly promptEl: HTMLElement;
  readonly nodeNear: any;
  readonly npcToons: Map<number, any>;
  readonly terminals: any[];
  readonly TERMINALS: Record<string, any>;
  readonly gwHidden: boolean;
  readonly buffs: any[];
  readonly fn: {
    startGather(): void; harvestCorpse(p: any, k: string): void; addBuff(id: string, name: string, secs: number, mods: Record<string, number>, icon?: string): void;
    setWaypoint(x: number, z: number, label: string): void; nearTravel(): any; travelPoints(w: any): any[]; setVendor(n: string): void; combatLevel(): number;
    hamMax(): { h: number; a: number; m: number }; selectPlacement(i: number): void; mmHud(): void; setMissionTerminal(t: any): void;
    npcStrike(p: any, u: any): any; npcCallPack(c: any, p: any, r: number): void; isNight(): boolean; standing(f: string): number;
    creatureFaction(cat: string): string | undefined; mmLog(m: string, kind?: string): void; toonOneShot(o: any, k: string): void; incapacitated(): boolean;
  };
  planetName(w: any): string;
  nearestPoi(w: any, x: number, z: number): any;
  floatMsg(m: string): void;
  wrap(
    name:
      | 'updatePlay' | 'gameTick' | 'buildGround' | 'applyKits' | 'rideUpdate' | 'playCharacter' | 'thinkCreature'
      | 'useAbility' | 'killNpc' | 'huntKill' | 'openWin' | 'toggleEquip' | 'startSample' | 'tickInteract',
    make: (orig: (...a: any[]) => any) => (...a: any[]) => any,
  ): void;
}

export function bridge(): Promise<Bridge> {
  const w = window as unknown as { GG_BRIDGE?: Bridge };
  if (w.GG_BRIDGE) return Promise.resolve(w.GG_BRIDGE);
  return new Promise((res) => addEventListener('gg:bridge', () => res(w.GG_BRIDGE!), { once: true }));
}
