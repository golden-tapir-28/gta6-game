// The player on foot: movement, health, money, weapons and the punch.
// The player is a circle in the world; when they enter a car, vehicles.js owns them.

import { CITY, PLAYER } from './config.js';
import { collideBuildings } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    health: PLAYER.health,
    money: 250,
    hasPistol: false,
    ammo: 0,
    punchTimer: 0,
    hurtTimer: 0,
    inCar: null,
    moving: false,
    walkPhase: 0,
  };
}

/** Move the player on foot from the input axes; returns true when they moved. */
export function stepPlayer(player, city, moveX, moveY, running, dt) {
  if (player.inCar) return false;
  const len = Math.hypot(moveX, moveY);
  if (len === 0) {
    player.moving = false;
    player.speed = 0;
    return false;
  }
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const nx = moveX / len;
  const ny = moveY / len;
  player.angle = Math.atan2(ny, nx);
  let px = player.x + nx * speed * dt;
  let py = player.y + ny * speed * dt;
  px = Math.max(PLAYER.radius, Math.min(CITY.width - PLAYER.radius, px));
  py = Math.max(PLAYER.radius, Math.min(CITY.height - PLAYER.radius, py));
  const pushed = collideBuildings(city, px, py, PLAYER.radius);
  player.x = pushed.x;
  player.y = pushed.y;
  player.speed = speed;
  player.moving = true;
  player.walkPhase += dt * (running ? 14 : 9);
  return true;
}

/** Hurt the player; returns true when they died. */
export function hurtPlayer(player, damage) {
  if (player.hurtTimer > 0 || player.inCar) return false;
  player.health = Math.max(0, player.health - damage);
  player.hurtTimer = 0.6;
  return player.health <= 0;
}

/** Heal the player (hospital respawn and pickups). */
export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.health, player.health + amount);
}
