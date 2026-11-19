// Vehicles: the car the player drives, the traffic that fills the streets, and
// the parked cars waiting to be stolen. A car is a rectangle with a heading, a
// speed and a type; driving is arcade physics (accelerate, steer, brake, drift).

import { CAR, CITY, PALETTE } from './config.js';
import { collideBuildings, isOnRoad, nearestStreet } from './city.js';
import { int, pick, range } from './random.js';

export const CAR_SEDAN = 0;
export const CAR_TAXI = 1;
export const CAR_SPORTS = 2;
export const CAR_TRUCK = 3;
export const CAR_POLICE = 4;

const TYPE_NAMES = ['Sedan', 'Taxi', 'Sports', 'Truck', 'Police Interceptor'];
const TYPE_COLORS = {
  [CAR_SEDAN]: null, // any of the palette cars
  [CAR_TAXI]: '#f2c94c',
  [CAR_SPORTS]: '#e5534b',
  [CAR_TRUCK]: '#8a8d91',
  [CAR_POLICE]: '#2a5ad8',
};

export function makeCar(rng, x, y, angle, type, opts = {}) {
  const isSports = type === CAR_SPORTS;
  return {
    x, y,
    angle,
    speed: 0,
    type,
    color: TYPE_COLORS[type] ?? pick(rng, PALETTE.car),
    maxSpeed: (isSports ? CAR.sportsMaxSpeed : CAR.maxSpeed) * range(rng, 0.85, 1.05),
    // Traffic state: which street it follows, which way, and its lane offset.
    street: null,
    dir: 1,
    lane: 0,
    parked: opts.parked ?? false,
    driver: opts.driver ?? null, // a pedestrian id, when a ped is driving it
    stolen: false,
    brakeLight: false,
    siren: type === CAR_POLICE,
    sirenPhase: rng() * Math.PI * 2,
    id: opts.id ?? 0,
  };
}

export function carName(car) {
  return TYPE_NAMES[car.type];
}

/** Spawn a parked car on a roadside near a point (for stealing). */
export function spawnParkedCar(rng, city, nearX, nearY, id) {
  const street = nearestStreet(nearX, nearY);
  let x;
  let y;
  let angle;
  if (street.vertical) {
    x = street.pos + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 - 16);
    y = nearY + range(rng, -120, 120);
    angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    y = street.pos + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 - 16);
    x = nearX + range(rng, -120, 120);
    angle = rng() < 0.5 ? 0 : Math.PI;
  }
  const type = pick(rng, [CAR_SEDAN, CAR_SEDAN, CAR_SPORTS, CAR_TAXI, CAR_TRUCK]);
  return makeCar(rng, x, y, angle, type, { parked: true, id });
}

/** Drive the player's car from the input axes; returns true when it moved. */
export function driveCar(car, moveX, moveY, dt) {
  const forward = -moveY; // up = accelerate
  const steer = moveX;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    // Rolling drag.
    car.speed -= car.speed * 0.6 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-140, Math.min(car.maxSpeed, car.speed));
  // Steering bites harder the faster the car goes (up to a point), and reverses in reverse.
  const steerAmount = steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 140 + 0.25);
  car.angle += steerAmount * (car.speed >= 0 ? 1 : -1);
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  let px = car.x + nx * car.speed * dt;
  let py = car.y + ny * car.speed * dt;
  px = Math.max(30, Math.min(CITY.width - 30, px));
  py = Math.max(30, Math.min(CITY.height - 30, py));
  const pushed = collideBuildings({ buildings: [] }, px, py, 0); // buildings handled by caller via car-vs-building
  car.x = pushed.x;
  car.y = pushed.y;
  car.brakeLight = forward < 0 && car.speed > 5;
  return Math.abs(car.speed) > 5;
}

/** Keep a car out of buildings (rectangle vs building, approximated by its centre). */
export function collideCarBuildings(city, car) {
  const half = CAR.length / 2;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(car.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(car.y, b.y + b.h));
    const dx = car.x - cx;
    const dy = car.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < half) {
      if (d === 0) { car.y = b.y - half; }
      else {
        car.x = cx + (dx / d) * half;
        car.y = cy + (dy / d) * half;
      }
      car.speed *= 0.35;
      return true;
    }
  }
  return false;
}

/** A traffic car: pick a street to follow, drive along it, turn at intersections. */
export function stepTrafficCar(car, rng, dt) {
  if (!car.street) {
    const street = nearestStreet(car.x, car.y);
    car.street = street;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.lane = (rng() < 0.5 ? -1 : 1) * 20;
  }
  const target = 170 + rng() * 40;
  car.speed += (target - car.speed) * 0.5 * dt;
  if (car.street.vertical) {
    const want = car.street.vertical ? Math.PI / 2 : 0;
    car.angle = want * car.dir;
    car.x = car.street.pos + car.lane;
    car.y += car.dir * car.speed * dt;
    if (car.y > CITY.height - 60) { car.y = CITY.height - 60; car.dir = -1; }
    if (car.y < 60) { car.y = 60; car.dir = 1; }
  } else {
    car.angle = car.dir > 0 ? 0 : Math.PI;
    car.y = car.street.pos + car.lane;
    car.x += car.dir * car.speed * dt;
    if (car.x > CITY.width - 60) { car.x = CITY.width - 60; car.dir = -1; }
    if (car.x < 60) { car.x = 60; car.dir = 1; }
  }
  // At an intersection, sometimes turn onto the crossing street.
  if (rng() < dt * 0.06 && isOnRoad(car.x, car.y)) {
    car.street = nearestStreet(car.x, car.y);
    car.dir = rng() < 0.5 ? 1 : -1;
    car.lane = (rng() < 0.5 ? -1 : 1) * 20;
  }
}

/** The nearest car to a point within `range`, or null. */
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Random traffic spawn on a street. */
export function spawnTrafficCar(rng, id) {
  const vertical = rng() < 0.5;
  const streets = vertical ? CITY.streetsX : CITY.streetsY;
  const pos = pick(rng, streets);
  const along = range(rng, 100, (vertical ? CITY.height : CITY.width) - 100);
  const type = pick(rng, [CAR_SEDAN, CAR_SEDAN, CAR_TAXI, CAR_SPORTS, CAR_TRUCK]);
  const car = makeCar(rng, vertical ? pos : along, vertical ? along : pos, vertical ? Math.PI / 2 : 0, type, { id });
  car.street = { pos, vertical, d: 0 };
  car.dir = rng() < 0.5 ? 1 : -1;
  car.lane = (rng() < 0.5 ? -1 : 1) * 20;
  car.speed = range(rng, 140, 210);
  return car;
}

export { int };
