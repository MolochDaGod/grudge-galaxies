/**
 * Grudge Galaxies client entry.
 *
 * Phase 1 (this build): three.js r185 as ES modules. The game runtime still lives in public/legacy/game.js and runs as a
 * classic script on top of src/three-compat.ts; later phases move systems out of it into typed modules under src/
 * (physics, animation, skills, VFX) behind the same deterministic tick.
 */
import './three-compat';

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

loadClassic('legacy/game.js').catch((e) => {
  console.error(e);
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = 'The game failed to start. Reload the page to try again.';
    t.hidden = false;
  }
});
