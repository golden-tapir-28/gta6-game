// Combat: the pistol, the punch, and the bullets between them. Shooting is
// mouse-aimed: the player faces the cursor and a click fires a bullet toward it.
// Bullets are a small pool, allocated once. A punch is a short-range arc in front
// of the player. Both can hurt peds, cops and (for bullets) damage cars.

import { COMBAT, PLAYER } from './config.js';

export function createCombat() {
  const bullets = [];
  for (let i = 0; i < 48; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, friendly: true });
  }
  return { bullets, cooldown: 0, punchTimer: 0, punchArc: 0 };
}

/** Fire a bullet from (x, y) toward (tx, ty). Returns true when one was fired. */
export function fireBullet(combat, x, y, tx, ty, friendly = true) {
  if (combat.cooldown > 0) return false;
  const bullet = combat.bullets.find((b) => !b.active);
  if (!bullet) return false;
  const dx = tx - x;
  const dy = ty - y;
  const d = Math.hypot(dx, dy) || 1;
  bullet.active = true;
  bullet.x = x + (dx / d) * 22;
  bullet.y = y + (dy / d) * 22;
  bullet.vx = (dx / d) * COMBAT.bulletSpeed;
  bullet.vy = (dy / d) * COMBAT.bulletSpeed;
  bullet.life = 0.9;
  bullet.friendly = friendly;
  combat.cooldown = COMBAT.pistolCooldown;
  return true;
}

/** Step bullets; `hit` is called with (bullet, x, y) for each step so the world can test hits. */
export function stepBullets(combat, dt, hit) {
  if (combat.cooldown > 0) combat.cooldown -= dt;
  if (combat.punchTimer > 0) combat.punchTimer -= dt;
  for (const b of combat.bullets) {
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) { b.active = false; continue; }
    if (hit) hit(b);
  }
}

/** Start a punch; returns true when the punch began. */
export function startPunch(combat, player) {
  if (combat.punchTimer > 0) return false;
  combat.punchTimer = PLAYER.punchCooldown;
  combat.punchArc = player.angle;
  return true;
}

/** Is a punch currently swinging? */
export function punching(combat) {
  return combat.punchTimer > PLAYER.punchCooldown - 0.18;
}

/** The punch's reach test: is `target` inside the punch arc? */
export function punchHits(combat, px, py, tx, ty) {
  if (!punching(combat)) return false;
  const dx = tx - px;
  const dy = ty - py;
  const d = Math.hypot(dx, dy);
  if (d > PLAYER.punchRange + 14) return false;
  const ang = Math.atan2(dy, dx);
  let diff = ang - combat.punchArc;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < 1.1;
}
