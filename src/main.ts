/**
 * Grudge Galaxies client entry.
 *
 * Phase 1 (this build): three.js r185 as ES modules. The game runtime still lives in public/legacy/game.js and runs as a
 * classic script on top of src/three-compat.ts; later phases move systems out of it into typed modules under src/
 * (physics, animation, skills, VFX) behind the same deterministic tick.
 */
import './three-compat';
import './combat/runtime';

function loadClassic(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load ' + src));
    document.body.appendChild(s);
  });
}

// phase 2: deterministic 60 Hz simulation tick + Rapier physics. Loaded lazily (Rapier ships its WASM inline) and
// installed as soon as the runtime's bridge is up; ?nophysics in the address keeps the legacy movement for comparison.
if (!/[?&]nophysics\b/.test(location.search)) {
  import('./core/tick').then((m) => m.installFixedTick()).catch((e) => console.warn('fixed tick unavailable', e));
  import('./physics/world').then((m) => m.installPhysics()).catch((e) => console.warn('physics unavailable', e));
}
// F interactions: townsfolk by role, travel pads, harvesters, corpses, nodes, terminals
import('./interact/interact').then((m) => m.installInteract()).catch((e) => console.warn('interactions unavailable', e));
// openers + tutorial for new characters (?notutorial skips it)
import('./tutorial/tutorial').then((m) => m.installTutorial()).catch((e) => console.warn('tutorial unavailable', e));

loadClassic('legacy/game.js').catch((e) => {
  console.error(e);
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = 'The game failed to start. Reload the page to try again.';
    t.hidden = false;
  }
});
