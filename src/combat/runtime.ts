/**
 * Puts the combat math on window.GG_COMBAT before the game runtime starts, so every hit in public/legacy/game.js
 * (auto-attack, abilities, hunting, enemy hits, heals) and every tooltip resolves through src/combat/math.ts.
 * Attack speed from Agility/haste scales the auto-attack timer; cooldown recovery from Tactics shortens ability cooldowns.
 */
import * as M from './math';

(window as unknown as { GG_COMBAT: typeof M }).GG_COMBAT = M;
export default M;
