// The screenshot scenes behind ?shot=start|chase|drive|mission. Each one sets the
// real world to a state a player could reach, then plays the real rules forward
// for a fixed number of steps, steered by a simple autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. The cover (chase) shows the most at once: a car chase, the wanted
// level, the minimap and a mission objective on the HUD.

import { CITY, STEP } from './config.js';
import { nearestStreet } from './city.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { makeCar, CAR_SPORTS } from './vehicles.js';
import { makeRng } from './random.js';

/** A fake input object for the autopilot: it answers moveX/moveY from a function. */
function autopilotInput(fn) {
  return {
    moveX: () => fn().x,
    moveY: () => fn().y,
    running: () => false,
    takeActions: () => 0,
    takeClick: () => false,
    mouse: () => ({ x: 0, y: 0 }),
    mouseDown: () => false,
    anyMove: () => true,
  };
}

/** Steer a car along its street: return the move axes that keep it on the road. */
function driveAlongRoad(state) {
  const car = state.player.inCar;
  if (!car) return { x: 0, y: 0 };
  const street = nearestStreet(car.x, car.y);
  // Desired heading: along the street, toward the mission place when there is one.
  const place = state.missionPlace;
  let desired;
  if (street.vertical) {
    desired = place && place.y < car.y ? -Math.PI / 2 : Math.PI / 2;
    // Keep the car on the street's centre line.
    const off = car.x - street.pos;
    if (Math.abs(off) > 26) desired += (off > 0 ? -1 : 1) * 0.5;
  } else {
    desired = place && place.x < car.x ? Math.PI : 0;
    const off = car.y - street.pos;
    if (Math.abs(off) > 26) desired += (off > 0 ? -1 : 1) * 0.5;
  }
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  return { x: steer, y: -1 };
}

/** Put the player in a fresh sports car on a street. */
function giveSportsCar(world, x, y, angle) {
  const state = world.state;
  const rng = makeRng(99);
  const car = makeCar(rng, x, y, angle, CAR_SPORTS, { id: 9001 });
  car.parked = false;
  car.stolen = true;
  state.cars.push(car);
  state.player.inCar = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  return car;
}

function simulate(world, seconds, inputFn) {
  const input = autopilotInput(inputFn);
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, input, 0, null);
  }
}

/**
 * Set `world` to the named scene (start, chase, drive or mission; any other name
 * is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'chase') {
    // The cover: a three-star chase down a downtown street, mid-mission.
    state.attract = false;
    state.missions.index = 2;
    startMission(state.missions);
    // A long straight run east down the 1000 street. The car starts already at
    // speed, the road ahead is cleared of every car, and the two police cars
    // are placed behind it, chasing — so the frame is a chase, not a pile-up
    // at an intersection (police that spawn in front block the player).
    const car = giveSportsCar(world, 1200, 1000, 0);
    car.speed = 500;
    addWanted(state.wanted, 3, 0.9);
    // The road ahead is cleared of every car except the player's own, so the
    // chase can build speed — the filter must keep the player car itself.
    state.cars = state.cars.filter((c) => c === car || !(Math.abs(c.y - 1000) < 80 && c.x > 1000));
    const rng = makeRng(42);
    for (let i = 0; i < 2; i += 1) {
      const cop = makeCar(rng, 1200 - 220 - i * 160, 1000 + (i % 2 ? 24 : -24), 0, 4, { id: 9100 + i });
      cop.speed = 470;
      state.cops.cars.push(cop);
    }
    simulate(world, 4, () => driveAlongRoad(state));
    // The cover is a three-star chase: a sideswipe during the run may have added
    // heat, so the level is set back to the scene's three stars.
    state.wanted.stars = 3;
    state.wanted.timer = 9;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    // A sunset drive along the beach road, traffic around, no heat.
    state.attract = false;
    state.clock = 17.5 * 3600;
    const car = giveSportsCar(world, 1400, 2200, 0);
    // A clear run along the beach road, keeping the player's own car.
    state.cars = state.cars.filter((c) => c === car || c.parked || Math.hypot(c.x - 1400, c.y - 2200) > 500);
    simulate(world, 6, () => driveAlongRoad(state));
    // A clean sunset drive: any heat picked up from a sideswipe is cleared.
    state.wanted.stars = 0;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // On foot at the docks, mission two's intro showing, the beacon ahead.
    state.attract = false;
    state.missions.index = 1;
    startMission(state.missions);
    state.player.x = 420;
    state.player.y = 1800;
    state.player.angle = 0;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    simulate(world, 3, () => ({ x: 0, y: 0 }));
    return { screen: SCREEN_PLAY };
  }
  // Start: the title over the living city.
  state.attract = true;
  for (let i = 0; i < 5 / STEP; i += 1) {
    world.step(STEP, autopilotInput(() => ({ x: 0, y: 0 })), 0, null);
  }
  return { screen: SCREEN_TITLE };
}
