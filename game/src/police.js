// The wanted level and the Solmar PD. Crimes raise stars; the police respond in
// proportion: foot cops and patrol cars at one star, roadblocks and a swarm at
// five. Cops chase on foot or by car, ram the player's car, and bust the player
// when they get close on foot. Out of every cop's sight, the heat cools and the
// stars fall; a respray clears them at once.

import { CAR, CITY, POLICE } from './config.js';
import { isOnRoad, nearestStreet } from './city.js';
import { makeCar, CAR_POLICE } from './vehicles.js';
import { range } from './random.js';

export function createWanted() {
  return {
    stars: 0,
    heat: 0, // 0..1, how "hot" the player is right now (drives police aggression)
    hiddenTimer: 0, // seconds since any cop last saw the player
    decayTimer: 0,
    busted: false,
    wasted: false,
    flash: 0,
  };
}

/** Add stars for a crime; returns the new level. */
export function addWanted(wanted, stars, heat = 0.6) {
  wanted.stars = Math.min(POLICE.maxStars, wanted.stars + stars);
  wanted.heat = Math.min(1, wanted.heat + heat);
  wanted.hiddenTimer = 0;
  wanted.decayTimer = 0;
  wanted.flash = 1.2;
  return wanted.stars;
}

export function clearWanted(wanted) {
  wanted.stars = 0;
  wanted.heat = 0;
  wanted.hiddenTimer = 0;
  wanted.decayTimer = 0;
}

/** A police officer on foot (chases the player, busts on contact). */
export function makeFootCop(rng, x, y, id) {
  return {
    id, kind: 'foot',
    x, y,
    angle: 0,
    speed: POLICE.footSpeed,
    state: 'chase',
  };
}

/** Spawn a police car on a street near the player. */
export function spawnPoliceCar(rng, px, py, id) {
  const street = nearestStreet(px, py);
  const along = range(rng, -420, 420);
  let x;
  let y;
  if (street.vertical) {
    x = street.pos + (rng() < 0.5 ? -1 : 1) * 18;
    y = Math.max(80, Math.min(CITY.height - 80, py + along));
  } else {
    y = street.pos + (rng() < 0.5 ? -1 : 1) * 18;
    x = Math.max(80, Math.min(CITY.width - 80, px + along));
  }
  const car = makeCar(rng, x, y, 0, CAR_POLICE, { id });
  car.speed = POLICE.carSpeed * 0.7;
  return car;
}

/**
 * Step the police: keep the right number of cars and foot cops for the wanted
 * level, chase the player, and report busts. `cops` holds {cars: [], foot: []}.
 * Returns 'busted' when a foot cop reaches the player, else null.
 */
export function stepPolice(cops, wanted, player, playerCar, rng, dt) {
  if (wanted.flash > 0) wanted.flash -= dt;
  const wantCars = POLICE.carsByStars[wanted.stars] || 0;
  const wantFoot = POLICE.footByStars[wanted.stars] || 0;
  // Spawn what is missing (a few at a time, off-screen-ish near the player).
  while (cops.cars.length < wantCars) {
    cops.cars.push(spawnPoliceCar(rng, player.x, player.y, 1000 + cops.cars.length));
  }
  while (cops.foot.length < wantFoot) {
    const a = range(rng, 0, Math.PI * 2);
    cops.foot.push(makeFootCop(rng, player.x + Math.cos(a) * 320, player.y + Math.sin(a) * 320, 2000 + cops.foot.length));
  }
  while (cops.cars.length > wantCars) cops.cars.pop();
  while (cops.foot.length > wantFoot) cops.foot.pop();

  const target = playerCar || player;
  const tx = target.x;
  const ty = target.y;
  // Do any cops see the player? (Within 520 and roughly in front, or very close.)
  let seen = false;
  for (const car of cops.cars) {
    const d = Math.hypot(car.x - tx, car.y - ty);
    if (d < 520) seen = true;
    // Chase: steer toward the player, faster than traffic, ramming when close.
    const wantAngle = Math.atan2(ty - car.y, tx - car.x);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    const targetSpeed = d > 260 ? POLICE.carSpeed : POLICE.carSpeed * 0.55;
    car.speed += (targetSpeed - car.speed) * 0.8 * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(CITY.width - 30, car.x));
    car.y = Math.max(30, Math.min(CITY.height - 30, car.y));
    car.sirenPhase += dt * 6;
    // Ram the player's car to slow it.
    if (playerCar && d < 52) {
      playerCar.speed *= 0.92;
    }
  }
  for (const cop of cops.foot) {
    const d = Math.hypot(cop.x - player.x, cop.y - player.y);
    if (d < 480) seen = true;
    const wantAngle = Math.atan2(player.y - cop.y, player.x - cop.x);
    cop.angle = wantAngle;
    cop.x += Math.cos(wantAngle) * cop.speed * dt;
    cop.y += Math.sin(wantAngle) * cop.speed * dt;
    if (d < POLICE.bustRange && !playerCar) return 'busted';
  }
  // Heat: seen resets the hiding clock; hidden long enough, stars decay.
  if (wanted.stars > 0) {
    if (seen) {
      wanted.hiddenTimer = 0;
      wanted.decayTimer = 0;
    } else {
      wanted.hiddenTimer += dt;
      if (wanted.hiddenTimer > POLICE.hideSeconds) {
        wanted.decayTimer += dt;
        if (wanted.decayTimer > POLICE.decaySeconds) {
          wanted.stars -= 1;
          wanted.decayTimer = 0;
          wanted.hiddenTimer = 0;
          wanted.heat = Math.max(0, wanted.heat - 0.3);
        }
      }
    }
  }
  return null;
}

/** How "hot" the screen edge should flash (0..1) for the wanted level. */
export function wantedFlash(wanted) {
  return wanted.stars > 0 ? 0.25 + 0.1 * wanted.stars : 0;
}

export { isOnRoad };
