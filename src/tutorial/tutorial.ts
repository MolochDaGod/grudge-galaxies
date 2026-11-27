/**
 * Opener + tutorial.
 *
 * A new character (no tutorial record, almost no XP) gets a three-card opener for their race and class, then a guided
 * tutorial that teaches the core loop with real game systems:
 *   move -> look around -> target the training dummy -> attack it -> use a class ability -> defeat it
 *   -> equip the class weapon you were handed -> open your survey device -> open the mission board -> complete.
 * Completion pays credits and XP, upgrades the starter weapon to Superior quality (a crafted perk) and records
 * CH.tutorial = { done, at, race, cls }. Skippable at any time; replayable from the Menu window.
 */
import { bridge, type Bridge } from '../bridge';
import { openerFor } from './openers';

type StepId = 'move' | 'look' | 'target' | 'attack' | 'ability' | 'defeat' | 'equip' | 'survey' | 'missions';
interface Step {
  id: StepId;
  title: string;
  text: string;
  need?: number;
}

const css = `
#ggOpener{position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:radial-gradient(ellipse at center,rgba(10,8,6,.55),rgba(4,3,2,.92));font-family:var(--cpx-body,system-ui)}
#ggOpener .op-card{width:min(640px,calc(100vw - 32px));padding:28px 30px 22px;border:1px solid rgba(255,214,150,.35);border-radius:14px;background:linear-gradient(180deg,rgba(32,24,16,.96),rgba(18,13,9,.96));box-shadow:0 30px 80px rgba(0,0,0,.6);color:#f2e6d0;animation:opIn .5s ease}
@keyframes opIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
#ggOpener .op-eyebrow{font:600 11px system-ui;letter-spacing:.22em;text-transform:uppercase;color:#d9b77a;margin:0 0 6px}
#ggOpener h2{font-family:var(--cpx-title,Georgia,serif);font-size:30px;margin:0 0 12px;color:#ffd99a;letter-spacing:.03em}
#ggOpener p{font-size:16px;line-height:1.55;margin:0 0 10px;color:#efe2cb}
#ggOpener .op-oath{font-style:italic;color:#ffd99a}
#ggOpener .op-foot{display:flex;align-items:center;justify-content:space-between;margin-top:18px;gap:12px}
#ggOpener .op-dots{display:flex;gap:6px}#ggOpener .op-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,214,150,.25)}#ggOpener .op-dots i.on{background:#ffd99a}
#ggOpener button{font:600 14px system-ui;border-radius:8px;padding:10px 18px;cursor:pointer;border:1px solid #d9a24a;background:linear-gradient(#e0a64a,#b9772a);color:#21140a}
#ggOpener button.ghost{background:none;border-color:rgba(255,214,150,.3);color:#d9c6a4}
#ggTut{position:fixed;right:16px;top:calc(50% - 40px);z-index:30;width:min(300px,calc(100vw - 32px));padding:12px 14px;border-radius:10px;border:1px solid rgba(255,214,150,.35);background:rgba(18,13,9,.9);color:#f2e6d0;font:13px/1.45 system-ui;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#ggTut h4{margin:0 0 2px;font:700 12px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#d9b77a}
#ggTut b{display:block;font-size:15px;color:#ffd99a;margin:2px 0 4px}
#ggTut .bar{height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin:8px 0 6px;overflow:hidden}#ggTut .bar i{display:block;height:100%;background:linear-gradient(90deg,#e0a64a,#ffe0a0)}
#ggTut .row{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#bba98a}
#ggTut button{background:none;border:0;color:#bba98a;cursor:pointer;font:11px system-ui;text-decoration:underline}
#ggTut.done{border-color:#7fdc7f}
@media (max-width:700px){#ggTut{top:auto;bottom:150px;right:8px}}`;

export async function installTutorial() {
  const B = await bridge();
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  let active: { steps: Step[]; i: number; n: number; start: { x: number; z: number; yaw: number }; dummy: any; weaponId?: string } | null = null;
  let panel: HTMLDivElement | null = null;

  const steps = (race: string, cls: string): Step[] => {
    const { c } = openerFor(race, cls);
    return [
      { id: 'move', title: 'Find your footing', text: 'Walk 20 metres in any direction with W A S D. Hold Shift to run.', need: 20 },
      { id: 'look', title: 'Look around', text: 'Right-click for mouselook, or turn the camera with Q and E.' },
      { id: 'target', title: 'Pick your target', text: 'A training dummy stands in front of you. Press Tab or click it to select it.' },
      { id: 'attack', title: `${c.attackVerb} the dummy`, text: `Press 1 (Attack) to start fighting. ${c.attackHint}`, need: 3 },
      { id: 'ability', title: 'Use an ability', text: c.abilityHint + ' Abilities sit on your hotbar keys 2 to 0.' },
      { id: 'defeat', title: 'Finish it', text: 'Bring the dummy down. Damage, crits, dodges and blocks come from your attributes; see them in your inventory (I).' },
      { id: 'equip', title: 'Arm yourself', text: `Open your inventory (I) and click the ${c.weapon.name} to equip it.` },
      { id: 'survey', title: 'Read the land', text: 'Every planet has resources to survey and harvest. Open your survey device (U).' },
      { id: 'missions', title: 'Find work', text: 'Mission terminals in every city pay credits and XP. Open the Missions window (M at a terminal, or from the menu).' },
    ];
  };

  function render() {
    if (!active) { panel?.remove(); panel = null; return; }
    const s = active.steps[active.i];
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ggTut';
      document.body.appendChild(panel);
    }
    const need = s.need || 1;
    panel.className = '';
    panel.innerHTML = `<h4>Tutorial · ${active.i + 1} / ${active.steps.length}</h4><b>${s.title}</b><div>${s.text}</div>
      <div class="bar"><i style="width:${Math.min(100, (active.n / need) * 100)}%"></i></div>
      <div class="row"><span>${need > 1 ? `${Math.min(need, Math.round(active.n))} / ${need}` : ''}</span><button id="ggTutSkip">Skip tutorial</button></div>`;
    panel.querySelector('#ggTutSkip')!.addEventListener('click', () => finish(true));
  }

  function advance(id: StepId, amount = 1) {
    if (!active) return;
    const s = active.steps[active.i];
    if (s.id !== id) return;
    active.n += amount;
    if (active.n >= (s.need || 1)) {
      active.i++;
      active.n = 0;
      B.floatMsg('Tutorial step complete');
      if (active.i >= active.steps.length) return finish(false);
      if (active.steps[active.i].id === 'target') spawnDummy();
      if (active.steps[active.i].id === 'ability' && !B.knownAbilities().some((a: any) => a.id !== 'attack' && (a.hit || a.heal || a.buff || a.debuff))) {
        B.floatMsg('Combat abilities come from profession trainers in town. Skipping this step for now.');
        active.i++;
      }
      if (active.steps[active.i].id === 'equip') grantWeapon();
    }
    render();
  }

  function spawnDummy() {
    if (!active || active.dummy) return;
    const p = B.play, w = B.groundWorld, e = (B.GD.enemies || []).find((x: any) => x.tier === 1) || B.GD.enemies[0];
    const yaw = p.camYaw || 0, fx = -Math.sin(yaw), fz = Math.cos(yaw);
    // about nine average hits for this character, so the fight teaches the loop without dragging
    const hp = Math.round(Math.max(180, Math.min(900, (B.charStats().dmg || 40) * 9)));
    const d = { t: 'training_dummy', k: 'npc', x: p.x + fx * 9, z: p.z + fz * 9, wild: false,
      g: { kind: 'hostile', enemy: e, cat: e.cat, name: 'Training Dummy', tier: 1, dummy: true, maxHp: hp, hp, dmg: 0 } };
    w.placements.push(d);
    active.dummy = d;
  }

  function grantWeapon() {
    const CH = B.CH;
    if (!active || !CH) return;
    const { c } = openerFor(CH.race, CH.cls);
    const it = { id: 'i' + Date.now().toString(36) + 'tut', kind: 'weapon', slot: 'Main hand', name: c.weapon.name, tier: 1, q: 450, wtype: c.weapon.type,
      attrs: cls2attrs(CH.cls) };
    CH.inv.items.push(it);
    active.weaponId = it.id;
    B.markDirty();
    B.floatMsg(`You receive the ${c.weapon.name} (Good quality)`);
  }

  function finish(skipped: boolean) {
    const CH = B.CH;
    if (CH) {
      CH.tutorial = { done: !skipped, skipped, at: Date.now(), race: CH.race, cls: CH.cls };
      if (!skipped) {
        CH.credits = (CH.credits || 0) + 1500;
        B.gainXP('combat', 250, 'tutorial complete');
        const wpn = CH.inv.items.find((i: any) => i.id === active?.weaponId);
        if (wpn) { wpn.q = 600; wpn.name = wpn.name.replace(/^(Recruit|Apprentice|Acolyte|Hunter|Raider|Pack|Grove|Twin)\b/, 'Veteran'); }
        B.toast('Tutorial complete: +1,500 credits, +250 combat XP, and your weapon is now Superior quality.');
      }
      B.markDirty();
      B.renderHud();
    }
    if (active?.dummy) {
      const w = B.groundWorld, k = w?.placements.indexOf(active.dummy);
      if (k >= 0 && !skipped && active.dummy.dead) w.placements.splice(k, 1);
      else if (k >= 0 && skipped) w.placements.splice(k, 1);
    }
    active = null;
    if (panel) {
      panel.className = 'done';
      panel.innerHTML = skipped ? '' : '<h4>Tutorial</h4><b>Complete</b><div>Your journey starts at the mission terminals and the trainers in town.</div>';
      const p = panel;
      setTimeout(() => { p.remove(); if (panel === p) panel = null; }, skipped ? 0 : 6000);
    }
  }

  function begin() {
    const CH = B.CH, p = B.play;
    if (!CH) return;
    active = { steps: steps(CH.race, CH.cls), i: 0, n: 0, start: { x: p.x, z: p.z, yaw: p.camYaw || 0 }, dummy: null };
    render();
  }

  function opener(then: () => void) {
    const CH = B.CH;
    if (!CH) return;
    const race = B.RACE[CH.race] || { name: CH.race }, cls = B.CLASS[CH.cls] || { name: CH.cls }, fac = B.FACTION[race.faction] || { name: race.faction };
    const { r, c } = openerFor(CH.race, CH.cls);
    const cards = [
      { eye: `${race.name} · ${fac.name || ''}`, title: `From ${r.home}`, body: `<p>${r.hook}</p><p>Trait: <b>${race.trait || ''}</b>. ${race.passive || ''}.</p><p class="op-oath">"${r.oath}"</p>` },
      { eye: `${cls.name}`, title: `You are a ${cls.name}`, body: `<p>A ${c.role}.</p><p>${c.duty}</p>${cls.signature ? `<p>Signature: <b>${cls.signature}</b>.</p>` : ''}` },
      { eye: `${CH.name}`, title: 'Your first day', body: `<p>${r.mentor} is waiting with a training dummy and a ${c.weapon.name}. Learn the basics, earn your first pay, and the galaxy is yours to take.</p><p>Follow the tutorial panel on the right. You can skip it at any time.</p>` },
    ];
    let k = 0;
    const el = document.createElement('div');
    el.id = 'ggOpener';
    const show = () => {
      const cd = cards[k];
      el.innerHTML = `<div class="op-card"><p class="op-eyebrow">${cd.eye}</p><h2>${cd.title}</h2>${cd.body}
        <div class="op-foot"><div class="op-dots">${cards.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>
        <div><button class="ghost" id="opSkip">Skip tutorial</button> <button id="opNext">${k < cards.length - 1 ? 'Continue' : 'Begin'}</button></div></div></div>`;
      el.querySelector('#opNext')!.addEventListener('click', () => { if (++k >= cards.length) { el.remove(); then(); } else show(); });
      el.querySelector('#opSkip')!.addEventListener('click', () => { el.remove(); active = { steps: [], i: 0, n: 0, start: { x: 0, z: 0, yaw: 0 }, dummy: null }; finish(true); });
    };
    show();
    document.body.appendChild(el);
    (el.querySelector('#opNext') as HTMLButtonElement)?.focus();
  }

  /* ---- events from the game ---- */
  addEventListener('gg:hit', (e: Event) => {
    const R = (e as CustomEvent).detail;
    if (active && B.combat.p === active.dummy && R) advance('attack');
  });
  B.wrap('useAbility', (orig) => function (this: unknown, a: any) {
    const r = orig.apply(this, [a]);
    if (a && a.id !== 'attack' && (a.hit || a.cd)) advance('ability');
    return r;
  });
  B.wrap('killNpc', (orig) => function (this: unknown, p: any) {
    const r = orig.apply(this, [p]);
    if (active && p === active.dummy) {
      // the ability step is optional for characters whose profession has no combat ability yet
      if (active.steps[active.i].id === 'ability') advance('ability');
      advance('defeat');
    }
    return r;
  });
  B.wrap('toggleEquip', (orig) => function (this: unknown, it: any) {
    const r = orig.apply(this, [it]);
    if (active && it && it.kind === 'weapon') advance('equip');
    return r;
  });
  B.wrap('openWin', (orig) => function (this: unknown, k: string) {
    const r = orig.apply(this, [k]);
    if (k === 'survey') advance('survey');
    if (k === 'missions') advance('missions');
    if (k === 'menu') setTimeout(menuButton, 0);
    return r;
  });
  // movement and camera are polled
  setInterval(() => {
    if (!active || B.groundMode !== 'play') return;
    const s = active.steps[active.i], p = B.play;
    if (!s) return;
    if (s.id === 'move') {
      const d = Math.hypot(p.x - active.start.x, p.z - active.start.z);
      if (Math.floor(d) !== Math.floor(active.n)) { active.n = d; if (d >= 20) advance('move', 0); else render(); }
    } else if (s.id === 'look') {
      if (Math.abs((p.camYaw || 0) - active.start.yaw) > 0.8 || B.mouselook) advance('look');
    } else if (s.id === 'target') {
      if (!active.dummy) spawnDummy();
      if (B.selPlacement === active.dummy || B.combat.p === active.dummy) advance('target');
    } else if (s.id === 'ability' && active.dummy?.dead) advance('ability');
    if (s.id !== 'look') active.start.yaw = p.camYaw || 0;
  }, 250);

  function menuButton() {
    const body = document.getElementById('gwBody');
    if (!body || body.querySelector('#ggTutReplay') || !B.CH) return;
    const b = document.createElement('button');
    b.id = 'ggTutReplay';
    b.className = 'btn';
    b.textContent = B.CH.tutorial?.done ? 'Replay tutorial' : 'Start tutorial';
    b.style.marginTop = '10px';
    b.onclick = () => { document.querySelector<HTMLButtonElement>('#gwin .x')?.click(); opener(begin); };
    body.appendChild(b);
  }

  // new characters: opener + tutorial once they are standing in the world
  B.wrap('playCharacter', (orig) => async function (this: unknown, ...a: any[]) {
    const r = await orig.apply(this, a);
    const CH = B.CH;
    const xp = CH ? Object.values(CH.xp || {}).reduce((s: number, v: any) => s + (+v || 0), 0) : 0;
    if (CH && !CH.tutorial && xp < 60 && !/[?&]notutorial\b/.test(location.search)) {
      for (let i = 0; i < 120 && !(B.groundMode === 'play' && B.play.model); i++) await new Promise((res) => setTimeout(res, 500));
      if (B.groundMode === 'play') opener(begin);
    }
    return r;
  });

  (window as any).GG_TUTORIAL = { start: () => opener(begin), get state() { return active && { step: active.steps[active.i]?.id, i: active.i, n: active.n }; }, skip: () => finish(true) };
}

/** starter weapon attribute lines by class (feeds the combat math and the tooltip) */
function cls2attrs(cls: string) {
  const m: Record<string, Record<string, number>> = {
    warrior: { Strength: 2, Vitality: 1 }, raider: { Strength: 3 }, mage: { Intellect: 3 }, priest: { Wisdom: 2, Intellect: 1 },
    ranger: { Dexterity: 2, Agility: 1 }, thief: { Agility: 2, Dexterity: 1 }, worge: { Strength: 1, Agility: 1, Wisdom: 1 }, verduror: { Wisdom: 2, Vitality: 1 },
  };
  return m[cls] || { Strength: 1 };
}
