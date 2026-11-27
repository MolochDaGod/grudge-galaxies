/**
 * F interactions.
 *
 * Every frame the game's own candidate (mission terminals, caravans, your cart) is merged with everything else you can
 * act on nearby: townsfolk by role (trainers, merchants, healers, innkeepers, bards, guards, captains, nobles,
 * travellers, labourers), starport and shuttleport pads, your harvesters, corpses to harvest, resource nodes.
 * Candidates are ranked by distance and by how squarely you face them; F uses the best one, Shift+F cycles.
 * Townsfolk open a dialog with role actions (1-4 or click): train, trade, heal, rest, directions, rumours, work.
 */
import { bridge, type Bridge } from '../bridge';

interface Cand {
  key: string;
  label: string;
  verb: string;
  icon: string;
  d: number;
  x: number;
  z: number;
  run: () => void;
}

const css = `
.gg-ix{position:fixed;left:50%;bottom:168px;transform:translateX(-50%);z-index:35;display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px;border-radius:10px;
  background:rgba(14,11,8,.88);border:1px solid rgba(255,214,150,.4);color:#f2e6d0;font:14px system-ui;box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:none;white-space:nowrap}
.gg-ix kbd{display:inline-grid;place-items:center;min-width:28px;height:28px;border-radius:6px;background:linear-gradient(#ffd58a,#d39a3a);color:#21140a;font:800 14px system-ui;box-shadow:inset 0 -2px 0 rgba(0,0,0,.25)}
.gg-ix b{color:#ffd99a;font-weight:700}.gg-ix small{color:#bba98a;font-size:12px;margin-left:4px}.gg-ix .ic{font-size:18px}
#ggDlg{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:45;width:min(560px,calc(100vw - 24px));border-radius:12px;padding:14px 16px 12px;
  background:linear-gradient(180deg,rgba(32,24,16,.97),rgba(18,13,9,.97));border:1px solid rgba(255,214,150,.4);color:#efe2cb;font:15px/1.5 system-ui;box-shadow:0 18px 50px rgba(0,0,0,.55)}
#ggDlg h3{margin:0;font:700 18px var(--cpx-title,Georgia,serif);color:#ffd99a}#ggDlg .role{font:600 11px system-ui;letter-spacing:.16em;text-transform:uppercase;color:#d9b77a}
#ggDlg p{margin:8px 0 10px}#ggDlg .opts{display:grid;gap:6px}
#ggDlg button{text-align:left;font:14px system-ui;padding:8px 10px;border-radius:7px;border:1px solid rgba(255,214,150,.25);background:rgba(255,214,150,.06);color:#f2e6d0;cursor:pointer}
#ggDlg button:hover,#ggDlg button:focus-visible{background:rgba(255,214,150,.16);outline:none;border-color:#ffd99a}#ggDlg button em{font-style:normal;color:#d9b77a;margin-right:8px}
#ggDlg .x{position:absolute;right:10px;top:8px;border:0;background:none;color:#bba98a;font-size:20px;padding:2px 6px}`;

const ROLE_ICON: Record<string, string> = { Trainer: '📜', Merchant: '💰', Guard: '🛡', Captain: '⚑', Priest: '✚', Healer: '✚', Bard: '♪', Artisan: '⚒', Innkeeper: '🍺', Noble: '♛', Traveler: '🧭', Laborer: '⛏', Villager: '💬' };

export async function installInteract() {
  const B = await bridge();
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  const prompt = document.createElement('div');
  prompt.className = 'gg-ix';
  prompt.hidden = true;
  document.body.appendChild(prompt);
  let cands: Cand[] = [];
  let pick = 0;
  let lastKey = '';
  let lastScan = 0;
  let dlg: HTMLDivElement | null = null;
  const talked = new Set<string>();

  const facing = (x: number, z: number) => {
    const p = B.play, yaw = p.yaw ?? p.camYaw ?? 0;
    const fx = -Math.sin(yaw), fz = Math.cos(yaw), dx = x - p.x, dz = z - p.z, L = Math.hypot(dx, dz) || 1;
    return (fx * dx + fz * dz) / L; // 1 = straight ahead
  };

  function gather(): Cand[] {
    const p = B.play, w = B.groundWorld, out: Cand[] = [];
    if (!w || B.groundMode !== 'play' || B.rts?.on) return out;
    // townsfolk
    for (const [i, obj] of B.npcToons as Map<number, any>) {
      const pl = w.placements[i], u = obj.userData;
      if (!pl || !pl.g || pl.g.kind !== 'friendly' || pl.dead || !u.pos) continue;
      const d = Math.hypot(u.pos.x - p.x, u.pos.z - p.z);
      if (d > 4.5) continue;
      const role = pl.g.role || (pl.trainer ? 'Trainer' : 'Villager');
      out.push({ key: 'npc' + i, label: pl.g.name || role, verb: role === 'Trainer' ? 'Train with' : role === 'Merchant' ? 'Trade with' : 'Talk to', icon: ROLE_ICON[role] || '💬', d, x: u.pos.x, z: u.pos.z, run: () => talk(pl, u, role) });
    }
    // townsfolk whose model has not streamed in yet still answer from their placement
    const seen = new Set(out.map((c) => c.key));
    for (let i = 0; i < w.placements.length; i++) {
      const pl = w.placements[i];
      if (!pl.g || pl.g.kind !== 'friendly' || pl.dead || seen.has('npc' + i)) continue;
      const dx = pl.x - p.x, dz = pl.z - p.z;
      if (dx * dx + dz * dz > 20) continue;
      const role = pl.g.role || (pl.trainer ? 'Trainer' : 'Villager');
      out.push({ key: 'npc' + i, label: pl.g.name || role, verb: role === 'Trainer' ? 'Train with' : role === 'Merchant' ? 'Trade with' : 'Talk to', icon: ROLE_ICON[role] || '💬', d: Math.sqrt(dx * dx + dz * dz), x: pl.x, z: pl.z, run: () => talk(pl, null, role) });
    }
    // travel pads
    const tp = B.fn.nearTravel();
    if (tp) out.push({ key: 'travel' + tp.name, label: `${tp.star ? 'Starport' : 'Shuttleport'} · ${tp.name}`, verb: 'Travel from', icon: '✈', d: Math.max(3, Math.hypot(tp.x - p.x, tp.z - p.z) * 0.15), x: tp.x, z: tp.z, run: () => B.openWin('travel') });
    // your harvesters on this planet
    for (const h of B.CH?.harvesters || []) {
      if (h.planet && h.planet !== w.id) continue;
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d < 8) out.push({ key: 'harv' + h.x + h.z, label: `Harvester · ${h.res}`, verb: 'Manage', icon: '⚙', d, x: h.x, z: h.z, run: () => B.openWin('harvesters') });
    }
    // corpses
    for (const pl of w.placements) {
      if (!pl.corpse || !pl.dead || Date.now() - pl.corpse.t > 120000) continue;
      const d = Math.hypot(pl.x - p.x, pl.z - p.z);
      if (d < 5) out.push({ key: 'corpse' + pl.x + pl.z, label: pl.g?.name || 'Corpse', verb: 'Harvest', icon: '🦴', d, x: pl.x, z: pl.z, run: () => corpseDialog(pl) });
    }
    // resource node (also on R)
    const n = B.nodeNear;
    if (n) out.push({ key: 'node' + n.x + n.z, label: `${n.r?.n || 'Resource'} (${n.c}%)`, verb: 'Gather', icon: '⛏', d: Math.hypot(n.x - p.x, n.z - p.z), x: n.x, z: n.z, run: () => B.fn.startGather() });
    // the game's own candidate: terminals, caravans, cart
    const L = B.interact;
    if (L) {
      const m = /^F · (.*)$/.exec(L.label || '');
      out.push({ key: 'legacy' + L.label, label: m ? m[1] : L.label, verb: '', icon: /terminal/i.test(L.label) ? '🖥' : /cart/i.test(L.label) ? '🛒' : '🤝', d: 1.5, x: p.x, z: p.z, run: L.run });
    }
    for (const c of out) c.d = c.d - facing(c.x, c.z) * 1.5; // prefer what you are looking at
    return out.sort((a, b) => a.d - b.d);
  }

  function show() {
    const c = cands[pick % Math.max(1, cands.length)];
    if (!c || dlg || !B.gwHidden) {
      prompt.hidden = true;
      return;
    }
    prompt.hidden = false;
    prompt.innerHTML = `<kbd>F</kbd><span class="ic">${c.icon}</span><span>${c.verb ? c.verb + ' ' : ''}<b>${esc(c.label)}</b></span>${cands.length > 1 ? `<small>Shift+F: next (${(pick % cands.length) + 1}/${cands.length})</small>` : ''}`;
  }

  B.wrap('tickInteract', (orig) => function (this: unknown) {
    orig.call(this);
    B.promptEl.hidden = true; // our prompt replaces the old text line
    const now = performance.now();
    if (now - lastScan > 200 || !B.gwHidden) { lastScan = now; cands = B.gwHidden ? gather() : []; }
    const top = cands[pick % Math.max(1, cands.length)];
    if (top && top.key !== lastKey) lastKey = top.key;
    if (!cands.length) pick = 0;
    B.interact = top ? { label: top.label, run: top.run } : null;
    show();
  });
  addEventListener('keydown', (e: KeyboardEvent) => {
    if (dlg) {
      // the F press that opened the dialog reaches this listener too: only a later F closes it
      if (e.key === 'Escape' || (e.key.toLowerCase() === 'f' && performance.now() - openT > 250)) { closeDlg(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      const n = +e.key;
      if (n >= 1 && n <= 9) {
        const b = dlg.querySelectorAll<HTMLButtonElement>('.opts button')[n - 1];
        if (b) { b.click(); e.preventDefault(); e.stopImmediatePropagation(); }
      }
      return;
    }
    if (e.key === 'F' && e.shiftKey && cands.length > 1 && B.groundMode === 'play') {
      pick = (pick + 1) % cands.length;
      show();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  /* ---- dialogs ---- */
  let openT = 0;
  function closeDlg() { dlg?.remove(); dlg = null; }
  function dialog(title: string, role: string, text: string, opts: [string, () => void][]) {
    closeDlg();
    openT = performance.now();
    dlg = document.createElement('div');
    dlg.id = 'ggDlg';
    dlg.setAttribute('role', 'dialog');
    dlg.innerHTML = `<button class="x" aria-label="Close">×</button><div class="role">${esc(role)}</div><h3>${esc(title)}</h3><p>${text}</p><div class="opts"></div>`;
    const box = dlg.querySelector('.opts')!;
    opts.concat([['Goodbye', () => {}]]).forEach(([label, fn], i) => {
      const b = document.createElement('button');
      b.innerHTML = `<em>${i + 1}</em>${label}`;
      b.onclick = () => { closeDlg(); fn(); };
      box.appendChild(b);
    });
    dlg.querySelector('.x')!.addEventListener('click', closeDlg);
    document.body.appendChild(dlg);
    (box.querySelector('button') as HTMLButtonElement)?.focus();
  }

  const CH = () => B.CH;
  const lvl = () => B.fn.combatLevel();
  const pay = (n: number, what: string) => {
    if ((CH().credits || 0) < n) { B.toast(`${what} costs ${n.toLocaleString()} credits.`); return false; }
    CH().credits -= n; B.markDirty(); B.renderHud(); return true;
  };
  const greet = (race: string) => ({ human: 'Well met.', orc: 'Speak quickly.', elf: 'The stars keep you.', dwarf: 'Aye?', undead: '...You still breathe. Interesting.', barbarian: 'Ha! A fighter.' } as Record<string, string>)[race] || 'Hello, traveller.';

  function nearest<T extends { x: number; z: number }>(list: T[]): T | null {
    const p = B.play;
    let best: T | null = null, bd = Infinity;
    for (const t of list) { const d = Math.hypot(t.x - p.x, t.z - p.z); if (d < bd) { bd = d; best = t; } }
    return best;
  }
  const way = (t: { x: number; z: number } | null, label: string) => {
    if (!t) return B.floatMsg('Nobody here knows of one nearby.');
    B.fn.setWaypoint(t.x, t.z, label);
    B.floatMsg(`Waypoint set: ${label} (${Math.round(Math.hypot(t.x - B.play.x, t.z - B.play.z))} m)`);
  };

  function talk(pl: any, u: any, role: string) {
    const g = pl.g, name = g.name || role, w = B.groundWorld;
    if (u && u.toonObj) B.toonOneShot(u.toonObj, 'wave');
    const hello = greet(g.race);
    const directions: [string, () => void] = ['Where can I find…', () => dialog(name, role, 'What are you looking for?', [
      ['The starport', () => way(nearest(B.fn.travelPoints(w).filter((t: any) => t.star)), 'Starport')],
      ['A mission terminal', () => way(nearest(B.terminals), 'Mission terminal')],
      ['A trainer', () => way(nearest(w.placements.filter((q: any) => q.g && q.g.kind === 'friendly' && (q.trainer || q.g.role === 'Trainer'))), 'Trainer')],
      ['Trouble (hostiles)', () => way(nearest(w.pois.filter((q: any) => /military|camp|ruin|crash/.test(q.cat))), 'Hostiles')],
    ])];
    const L = lvl();
    switch (role) {
      case 'Trainer':
        return dialog(name, 'Trainer', `${hello} I teach the ${pl.trainer ? esc(String(pl.trainer)) : 'trade'} skills. Bring me experience and I will turn it into skill.`, [
          ['Show me what you can teach', () => B.openWin('skills')], directions]);
      case 'Merchant':
      case 'Artisan':
        return dialog(name, role, `${hello} Coin for goods, goods for coin. Resources sell by quality.`, [
          ['Browse wares', () => { B.fn.setVendor(name); B.openWin('vendor'); }], ['Crafting bench', () => B.openWin('craft')], directions]);
      case 'Healer':
      case 'Priest': {
        const cost = 20 * L;
        return dialog(name, role, `${hello} You carry wounds. I can mend them for ${cost} credits.`, [
          [`Heal me fully (${cost} cr)`, () => { if (pay(cost, 'Healing')) { CH().hp = B.fn.hamMax().h; B.floatMsg('Your wounds close.'); B.renderHud(); } }],
          ['Bless me (+10% health regen, 10 min, 60 cr)', () => { if (pay(60, 'A blessing')) B.fn.addBuff('blessed', 'Blessed', 600, { regen: 1.1 }, '✚'); }], directions]);
      }
      case 'Innkeeper':
        return dialog(name, 'Innkeeper', `${hello} A bed, a meal, and you will learn faster tomorrow.`, [
          ['Rest here (+10% XP for 20 min, 80 cr)', () => { if (pay(80, 'A room')) { B.fn.addBuff('rested', 'Well Rested', 1200, { xp: 1.1 }, '🍺'); CH().hp = B.fn.hamMax().h; B.renderHud(); } }],
          ['Hear the local news', () => rumour(pl, name)], directions]);
      case 'Bard':
        return dialog(name, 'Bard', `${hello} A song for the road?`, [
          ['Request a song (+10% XP, 5 min, 40 cr)', () => { if (pay(40, 'A song')) B.fn.addBuff('inspire', 'Inspired', 300, { xp: 1.1 }, '♪'); }],
          ['Hear a tale', () => rumour(pl, name)]]);
      case 'Guard':
      case 'Captain':
        return dialog(name, role, `${hello} Keep your weapon sheathed in town. Trouble's out past the walls.`, [directions,
          ['Any bounties?', () => { const q: any = nearest(w.pois.filter((q: any) => /military|camp|ruin|crash/.test(q.cat))); way(q, q ? `Bounty: ${q.name}` : 'Bounty'); if (q) B.floatMsg('Clear it out and the mission terminals will pay for proof.'); }]]);
      case 'Noble':
        return dialog(name, 'Noble', `${hello} Influence is earned. The faction terminal keeps the ledger.`, [
          ['Directions to the faction terminal', () => way(nearest(B.terminals.filter((t: any) => t.kind === 'faction')) || nearest(B.terminals), 'Faction terminal')], directions]);
      default:
        return dialog(name, role, `${hello}`, [['Heard any rumours?', () => rumour(pl, name)], directions]);
    }
  }

  function rumour(pl: any, name: string) {
    const w = B.groundWorld, p = B.play;
    const far = w.pois.filter((q: any) => q.cat !== 'city' && !(B.CH.discovered || []).includes(q.name)).sort((a: any, b: any) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const q = far[Math.floor(Math.random() * Math.min(4, far.length))];
    if (!q) return B.floatMsg(`${name} has nothing new to tell you.`);
    const k = name + q.name;
    way(q, q.name);
    B.floatMsg(`${name}: "They say there's something worth seeing at ${q.name}."`);
    if (!talked.has(k)) { talked.add(k); B.gainXP('scout', 15, 'rumour'); }
  }

  function corpseDialog(pl: any) {
    dialog(pl.g?.name || 'Corpse', 'Harvest', 'Choose what to take. Creature resources sell well and feed crafters.', [
      ['Meat', () => B.fn.harvestCorpse(pl, 'meat')], ['Hide', () => B.fn.harvestCorpse(pl, 'hide')], ['Bone', () => B.fn.harvestCorpse(pl, 'bone')]]);
  }

  (window as any).GG_INTERACT = { get candidates() { return cands.map((c) => ({ key: c.key, label: c.label, verb: c.verb, d: +c.d.toFixed(1) })); }, talk };
}

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
