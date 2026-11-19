// Pedestrians: the people who fill Solmar's sidewalks. They walk along the
// pavement, cross at intersections, wait at the kerb, and flee when the player
// shoots, punches or drives at them. A frightened crowd is what makes a crime
// feel like a crime — and what raises the wanted level when the police see it.

import { CITY, PALETTE, PED } from './config.js';
import { isOnRoad, isSidewalk, nearestStreet } from './city.js';
import { pick, range } from './random.js';

export const PED_CALM = 0;
export const PED_FLEE = 1;
export const PED_DOWN = 2;

export function makePed(rng, x, y, id) {
  return {
    id,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    color: pick(rng, PALETTE.ped),
    speed: range(rng, PED.walkSpeed * 0.8, PED.walkSpeed * 1.2),
    state: PED_CALM,
    // A sidewalk waypoint to walk toward.
    tx: x,
    ty: y,
    wait: range(rng, 0, 3),
    panic: 0,
    down: false,
  };
}

/** Spawn a pedestrian on a sidewalk near a point. */
export function spawnPed(rng, x, y, id) {
  const street = nearestStreet(x, y);
  let px;
  let py;
  if (street.vertical) {
    px = street.pos + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + 18);
    py = y + range(rng, -160, 160);
  } else {
    py = street.pos + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + 18);
    px = x + range(rng, -160, 160);
  }
  px = Math.max(30, Math.min(CITY.width - 30, px));
  py = Math.max(30, Math.min(CITY.height - 30, py));
  return makePed(rng, px, py, id);
}

/** Pick a new sidewalk waypoint near the ped. */
function newTarget(ped, rng) {
  const street = nearestStreet(ped.x, ped.y);
  const along = range(rng, -260, 260);
  if (street.vertical) {
    ped.tx = street.pos + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + 18);
    ped.ty = Math.max(60, Math.min(CITY.height - 60, ped.y + along));
  } else {
    ped.ty = street.pos + (rng() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + 18);
    ped.tx = Math.max(60, Math.min(CITY.width - 60, ped.x + along));
  }
  ped.wait = 0;
}

/** Step one pedestrian; `threat` is {x, y, radius} or null (what they flee from). */
export function stepPed(ped, rng, dt, threat) {
  if (ped.state === PED_DOWN) return;
  if (threat) {
    const d = Math.hypot(ped.x - threat.x, ped.y - threat.y);
    if (d < threat.radius) {
      ped.state = PED_FLEE;
      ped.panic = 2.5;
    }
  }
  if (ped.panic > 0) {
    ped.panic -= dt;
    if (ped.panic <= 0) ped.state = PED_CALM;
  }
  const speed = ped.state === PED_FLEE ? PED.runSpeed : ped.speed;
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) {
    if (ped.state === PED_FLEE) {
      // Keep running away from the threat's last direction: pick a far waypoint.
      ped.tx = Math.max(60, Math.min(CITY.width - 60, ped.x + (ped.x - (threat ? threat.x : ped.x)) * 0.5 + range(rng, -200, 200)));
      ped.ty = Math.max(60, Math.min(CITY.height - 60, ped.y + (ped.y - (threat ? threat.y : ped.y)) * 0.5 + range(rng, -200, 200)));
    } else if (ped.wait > 0) {
      ped.wait -= dt;
    } else {
      newTarget(ped, rng);
      if (rng() < 0.25) ped.wait = range(rng, 0.5, 2.5);
    }
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / d) * speed * dt;
  ped.y += (dy / d) * speed * dt;
  ped.x = Math.max(20, Math.min(CITY.width - 20, ped.x));
  ped.y = Math.max(20, Math.min(CITY.height - 20, ped.y));
}

/** Knock a pedestrian down (they stay down a while, then get up and flee). */
export function knockPed(ped) {
  ped.state = PED_DOWN;
  ped.panic = 6;
}

/** A downed ped gets up after their panic fades. */
export function recoverPed(ped, dt) {
  if (ped.state !== PED_DOWN) return;
  ped.panic -= dt;
  if (ped.panic <= 0) {
    ped.state = PED_FLEE;
    ped.panic = 2;
  }
}

export { isOnRoad, isSidewalk };
