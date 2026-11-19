// The world: the whole simulation with no drawing and no browser in it — the
// player, the city, the cars and traffic, the pedestrians, the police and the
// wanted level, the missions and the story, the combat, the side work (taxi,
// packages, respray, gun shop) and the clock. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react (sounds,
// screens, saves) without the world knowing about them.

import {
  CAR, CITY, COMBAT, MONEY, PALETTE, PED, PLAYER, PLACES, POLICE, STEP, TRAFFIC,
} from './config.js';
import { buildCity, collideBuildings, insideBuilding, isOnRoad, nearestStreet } from './city.js';
import { makeRng, pick, range } from './random.js';
import { createPlayer, healPlayer, hurtPlayer, stepPlayer } from './player.js';
import {
  CAR_POLICE, CAR_TAXI, collideCarBuildings, driveCar, makeCar, nearestCar,
  spawnParkedCar, spawnTrafficCar, stepTrafficCar,
} from './vehicles.js';
import {
  PED_CALM, PED_DOWN, knockPed, makePed, recoverPed, spawnPed, stepPed,
} from './pedestrians.js';
import {
  addWanted, clearWanted, createWanted, makeFootCop, spawnPoliceCar, stepPolice,
} from './police.js';
import {
  advanceStage, createMissionState, currentMission, currentStage, objectiveText,
  stagePlace, startMission,
} from './missions.js';
import { createCombat, fireBullet, punchHits, startPunch, stepBullets } from './combat.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_PACKAGE = 8;
export const EVENT_CRIME = 16;
export const EVENT_SHOT = 32;
export const EVENT_HIT = 64;
export const EVENT_PICKUP = 128;

/** The ten hidden packages, at fixed spots around the city. */
const PACKAGE_SPOTS = [
  { x: 1600, y: 1200 }, { x: 2600, y: 2320 }, { x: 300, y: 1800 },
  { x: 200, y: 400 }, { x: 3400, y: 1000 }, { x: 2200, y: 1400 },
  { x: 2600, y: 600 }, { x: 1400, y: 1800 }, { x: 600, y: 2200 },
  { x: 3200, y: 2200 },
];

export function createWorld(random) {
  const city = buildCity(1337);
  const player = createPlayer(PLACES.safehouse.x, PLACES.safehouse.y + 120);
  const wanted = createWanted();
  const combat = createCombat();
  const missions = createMissionState();
  const state = {
    seed: 1337,
    city,
    player,
    wanted,
    combat,
    missions,
    cars: [],
    peds: [],
    cops: { cars: [], foot: [] },
    packages: PACKAGE_SPOTS.map((p) => ({ ...p, found: false })),
    packagesFound: 0,
    taxi: { active: false, passenger: null, pickup: null, dropoff: null, fare: 0, timer: 0 },
    clock: 9 * 3600, // 09:00 in the morning
    elapsed: 0,
    best: 0,
    camera: { x: player.x, y: player.y, zoom: 1, shake: 0 },
    effects: [],
    floats: [],
    toast: null,
    toastTimer: 0,
    banner: null,
    bannerTimer: 0,
    resprayCooldown: 0,
    gunPrompt: null,
    saveTimer: 0,
    attract: true,
    attractAngle: 0,
    crashed: 0,
  };

  function reset() {
    player.x = PLACES.safehouse.x;
    player.y = PLACES.safehouse.y + 120;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.money = MONEY.start;
    player.hasPistol = false;
    player.ammo = 0;
    player.inCar = null;
    player.punchTimer = 0;
    player.hurtTimer = 0;
    clearWanted(wanted);
    wanted.busted = false;
    wanted.wasted = false;
    state.cars = [];
    state.peds = [];
    state.cops = { cars: [], foot: [] };
    state.packages = PACKAGE_SPOTS.map((p) => ({ ...p, found: false }));
    state.packagesFound = 0;
    state.taxi = { active: false, passenger: null, pickup: null, dropoff: null, fare: 0, timer: 0 };
    state.clock = 9 * 3600;
    state.elapsed = 0;
    state.effects = [];
    state.floats = [];
    state.toast = null;
    state.toastTimer = 0;
    state.banner = null;
    state.bannerTimer = 0;
    state.resprayCooldown = 0;
    state.resprayUsedThisStage = false;
    state.gunPrompt = null;
    state.saveTimer = 0;
    state.attract = true;
    // Parked cars worth stealing, scattered near the safehouse and downtown.
    const rng = makeRng(state.seed + 7);
    const spots = [
      [PLACES.safehouse.x + 60, PLACES.safehouse.y + 40],
      [PLACES.safehouse.x - 40, PLACES.safehouse.y - 80],
      [1000, 700], [1400, 500], [1800, 700], [2200, 500],
      [2600, 700], [600, 1000], [1000, 1400], [1800, 1200],
      [2600, 1200], [3000, 1400], [600, 1800], [1400, 2000],
    ];
    spots.forEach(([x, y], i) => {
      state.cars.push(spawnParkedCar(rng, city, x, y, i + 1));
    });
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      state.cars.push(spawnTrafficCar(rng, 100 + i));
    }
    for (let i = 0; i < PED.count; i += 1) {
      const x = range(rng, 200, CITY.width - 200);
      const y = range(rng, 200, CITY.height - 200);
      state.peds.push(spawnPed(rng, x, y, i + 1));
    }
    missions.index = 0;
    missions.stage = 0;
    missions.done = false;
    missions.started = false;
    startMission(missions);
    state.camera.x = player.x;
    state.camera.y = player.y;
    state.camera.zoom = 1;
  }

  function addFloat(x, y, text, color) {
    state.floats.push({ x, y, text, color, life: 1.6 });
    if (state.floats.length > 12) state.floats.shift();
  }

  function addEffect(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      state.effects.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color, size: 2 + Math.random() * 3 });
    }
    if (state.effects.length > 220) state.effects.splice(0, state.effects.length - 220);
  }

  function setToast(text, seconds = 3) {
    state.toast = text;
    state.toastTimer = seconds;
  }

  /** A crime the player commits; stars only count when someone can report it. */
  function commitCrime(stars, witnessRadius) {
    let witnessed = false;
    for (const cop of [...state.cops.cars, ...state.cops.foot]) {
      if (Math.hypot(cop.x - player.x, cop.y - player.y) < witnessRadius) { witnessed = true; break; }
    }
    if (!witnessed) {
      for (const ped of state.peds) {
        if (ped.state !== PED_DOWN && Math.hypot(ped.x - player.x, ped.y - player.y) < witnessRadius * 0.55) { witnessed = true; break; }
      }
    }
    if (witnessed) {
      addWanted(wanted, stars);
      return true;
    }
    return false;
  }

  /** Put the player in a car (stealing it if it is parked or driven). */
  function enterCar(car) {
    if (car.driver) {
      const ped = state.peds.find((p) => p.id === car.driver);
      if (ped) { knockPed(ped); ped.x = car.x + 40; ped.y = car.y + 40; }
      car.driver = null;
      commitCrime(1, 420);
    } else if (car.parked) {
      commitCrime(1, 420);
    }
    car.parked = false;
    car.stolen = true;
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    return true;
  }

  /** Step the traffic and the pedestrians (also used for the title backdrop). */
  function stepAmbient(rng, dt) {
    for (const car of state.cars) {
      if (car === player.inCar || car.type === CAR_POLICE) continue;
      if (car.parked) continue;
      stepTrafficCar(car, rng, dt);
    }
    for (const ped of state.peds) {
      if (ped.state === PED_DOWN) { recoverPed(ped, dt); continue; }
      stepPed(ped, rng, dt, null);
    }
  }

  /** Resolve a bullet hit against peds, cops and cars. Returns true when it hit. */
  function bulletHit(bullet) {
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.state === PED_DOWN) continue;
      if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 16) {
        bullet.active = false;
        knockPed(ped);
        addEffect(ped.x, ped.y, '#e5534b', 8, 160);
        commitCrime(1, 500);
        return true;
      }
    }
    // Foot cops.
    for (const cop of state.cops.foot) {
      if (Math.hypot(cop.x - bullet.x, cop.y - bullet.y) < 18) {
        bullet.active = false;
        addEffect(cop.x, cop.y, '#2a5ad8', 8, 160);
        addWanted(wanted, 1, 0.4);
        return true;
      }
    }
    // Cars (damage them; a wrecked car stops and smokes).
    for (const car of state.cars) {
      const dx = bullet.x - car.x;
      const dy = bullet.y - car.y;
      const along = Math.abs(dx * Math.cos(car.angle) + dy * Math.sin(car.angle));
      const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along < 30 && across < 16) {
        bullet.active = false;
        car.health = (car.health ?? 100) - COMBAT.pistolDamage;
        addEffect(bullet.x, bullet.y, '#f2c94c', 6, 200);
        if (car.health <= 0 && car.speed !== 0) {
          car.speed = 0;
          addEffect(car.x, car.y, '#888888', 16, 120);
        }
        return true;
      }
    }
    return false;
  }

  /** Check the current mission stage; returns true when the mission completed. */
  function updateMission(dt) {
    const stage = currentStage(missions);
    if (!stage) return false;
    // The respray flag only counts for a respray stage; a respray used on an
    // earlier stage must not complete a later one.
    if (stage.target !== 'respray') state.resprayUsedThisStage = false;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    let done = false;
    if (stage.target === 'stealCar') {
      done = !!player.inCar;
    } else if (stage.target === 'wanted3') {
      if (missions.stageTimer === 0 && stage.setWanted) addWanted(wanted, stage.setWanted, 0.8);
      done = wanted.stars >= 3;
    } else if (stage.target === 'loseWanted') {
      done = wanted.stars === 0;
    } else if (stage.target === 'hold') {
      const place = PLACES[stage.place];
      if (Math.hypot(px - place.x, py - place.y) < stage.radius) {
        missions.stageTimer += dt;
        if (missions.stageTimer >= stage.holdSeconds) done = true;
      } else {
        missions.stageTimer = Math.max(0, missions.stageTimer - dt * 0.5);
      }
    } else if (stage.target === 'respray') {
      done = state.resprayUsedThisStage === true;
    } else if (stage.place) {
      const place = PLACES[stage.place];
      if (stage.setWanted && missions.stageTimer === 0) addWanted(wanted, stage.setWanted, 0.8);
      done = Math.hypot(px - place.x, py - place.y) < stage.radius;
    }
    if (stage.target === 'hold' && missions.stageTimer > 0 && missions.stageTimer < stage.holdSeconds && wanted.stars < 2) {
      // Robbing the bank draws the police.
      addWanted(wanted, 1, 0.3);
    }
    if (!done) return false;
    const mission = currentMission(missions);
    const completed = advanceStage(missions);
    if (completed && mission) {
      player.money += mission.reward;
      addFloat(player.x, player.y - 30, `+$${mission.reward}  ${mission.title} complete`, PALETTE.gold);
      setToast(`Mission complete: ${mission.title} — +$${mission.reward}`, 4);
      state.banner = { title: 'Mission Complete', text: `${mission.title} — $${mission.reward}`, timer: 3.5 };
      if (missions.index < 5) {
        startMission(missions);
      }
      return true;
    }
    return false;
  }

  /** Respawn after being busted or wasted. */
  function respawn(kind) {
    const spot = kind === 'busted' ? PLACES.policeStation : PLACES.hospital;
    player.x = spot.x;
    player.y = spot.y + 100;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.inCar = null;
    clearWanted(wanted);
    wanted.busted = false;
    wanted.wasted = false;
    state.cops = { cars: [], foot: [] };
    state.camera.x = player.x;
    state.camera.y = player.y;
  }

  /**
   * One fixed step. `input` is the input object, `actions` its one-shot flags,
   * `aim` the world point the mouse points at (or null). Returns event flags.
   */
  function step(dt, input, actions, aim) {
    const rng = makeRng((state.seed + Math.floor(state.elapsed * 60)) >>> 0);
    let events = 0;
    state.elapsed += dt;
    state.clock = (state.clock + dt * 90) % 86400; // a day lasts ~16 minutes
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.banner && state.banner.timer > 0) state.banner.timer -= dt;
    if (state.resprayCooldown > 0) state.resprayCooldown -= dt;
    if (player.hurtTimer > 0) player.hurtTimer -= dt;
    if (player.punchTimer > 0) player.punchTimer -= dt;
    if (state.camera.shake > 0) state.camera.shake = Math.max(0, state.camera.shake - dt * 2.2);

    // Title-screen backdrop: the city lives on its own.
    if (state.attract) {
      stepAmbient(rng, dt);
      state.attractAngle += dt * 0.05;
      state.camera.x = CITY.width / 2 + Math.cos(state.attractAngle) * 500;
      state.camera.y = CITY.height / 2 + Math.sin(state.attractAngle * 0.7) * 320;
      return 0;
    }

    // --- Player on foot or driving ---
    const moveX = input.moveX();
    const moveY = input.moveY();
    const running = input.running();
    if (player.inCar) {
      const car = player.inCar;
      driveCar(car, moveX, moveY, dt);
      collideCarBuildings(city, car);
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      // Running over a pedestrian.
      for (const ped of state.peds) {
        if (ped.state === PED_DOWN) continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 90) {
          knockPed(ped);
          commitCrime(1, 500);
          car.speed *= 0.7;
          addEffect(ped.x, ped.y, '#e5534b', 10, 180);
          state.camera.shake = 0.5;
          events |= EVENT_HIT;
        }
      }
      // Ramming a traffic car.
      for (const other of state.cars) {
        if (other === car || other.parked) continue;
        const d = Math.hypot(other.x - car.x, other.y - car.y);
        if (d < 46) {
          const push = (46 - d) / 2;
          const nx = (other.x - car.x) / (d || 1);
          const ny = (other.y - car.y) / (d || 1);
          other.x += nx * push;
          other.y += ny * push;
          car.speed *= 0.82;
          other.speed *= 0.6;
          if (Math.abs(car.speed) > 240) {
            addEffect(car.x, car.y, '#f2c94c', 8, 200);
            state.camera.shake = 0.4;
          }
        }
      }
      // Exit the car.
      if (actions & 4) { // ACTION_ENTER
        player.inCar = null;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
        const pushed = collideBuildings(city, player.x, player.y, PLAYER.radius);
        player.x = pushed.x;
        player.y = pushed.y;
      }
    } else {
      stepPlayer(player, city, moveX, moveY, running, dt);
      // Aim at the mouse; punch with Space, shoot with a click.
      if (aim) player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
      if (actions & 8) { // ACTION_PUNCH
        if (startPunch(combat, player)) {
          for (const ped of state.peds) {
            if (ped.state === PED_DOWN) continue;
            if (punchHits(combat, player.x, player.y, ped.x, ped.y)) {
              knockPed(ped);
              commitCrime(1, 420);
              events |= EVENT_HIT;
            }
          }
          for (const cop of state.cops.foot) {
            if (punchHits(combat, player.x, player.y, cop.x, cop.y)) {
              addWanted(wanted, 1, 0.5);
              events |= EVENT_HIT;
            }
          }
        }
      }
      if (input.takeClick() && player.hasPistol && player.ammo > 0 && aim) {
        if (fireBullet(combat, player.x, player.y, aim.x, aim.y, true)) {
          player.ammo -= 1;
          events |= EVENT_SHOT;
          state.camera.shake = Math.max(state.camera.shake, 0.15);
          if (commitCrime(1, 800)) events |= EVENT_CRIME;
        }
      }
      // Enter the nearest car.
      if (actions & 4) { // ACTION_ENTER
        const car = nearestCar(state.cars, player.x, player.y, 64);
        if (car) enterCar(car);
      }
    }

    // --- Traffic, pedestrians, bullets ---
    stepAmbient(rng, dt);
    stepBullets(combat, dt, bulletHit);
    // A traffic car hitting the player on foot hurts them.
    if (!player.inCar) {
      for (const car of state.cars) {
        if (car.parked) continue;
        if (Math.hypot(car.x - player.x, car.y - player.y) < 34 && Math.abs(car.speed) > 60) {
          if (hurtPlayer(player, 18)) {
            events |= EVENT_WASTED;
            wanted.wasted = true;
          } else {
            events |= EVENT_HIT;
            state.camera.shake = 0.5;
          }
          car.speed *= 0.4;
        }
      }
    }

    // --- Police ---
    const bust = stepPolice(state.cops, wanted, player, player.inCar, rng, dt);
    if (bust === 'busted') {
      events |= EVENT_BUSTED;
      wanted.busted = true;
      player.money = Math.max(0, player.money - MONEY.bustFine);
    }
    if (player.health <= 0 && !wanted.wasted) {
      events |= EVENT_WASTED;
      wanted.wasted = true;
      player.money = Math.max(0, player.money - MONEY.wastedFine);
    }

    // --- Missions ---
    if (missions.started && !missions.done) {
      if (updateMission(dt)) events |= EVENT_MISSION;
    }
    // The mission target, for the beacon, the minimap and the autopilot.
    state.missionPlace = stagePlace(missions);

    // --- Packages ---
    for (const pkg of state.packages) {
      if (pkg.found) continue;
      if (Math.hypot(pkg.x - player.x, pkg.y - player.y) < 34) {
        pkg.found = true;
        state.packagesFound += 1;
        player.money += MONEY.packageBonus;
        addFloat(pkg.x, pkg.y - 20, `+$${MONEY.packageBonus} Package`, PALETTE.gold);
        setToast(`Hidden package found (${state.packagesFound}/10) — +$${MONEY.packageBonus}`, 3);
        events |= EVENT_PACKAGE;
      }
    }

    // --- Respray: drive in with heat and cash, drive out clean. ---
    const respray = PLACES.respray;
    const inRespray = player.inCar && Math.hypot(player.inCar.x - respray.x, player.inCar.y - respray.y) < 90;
    if (inRespray && wanted.stars > 0 && player.money >= MONEY.resprayCost && state.resprayCooldown <= 0) {
      player.money -= MONEY.resprayCost;
      clearWanted(wanted);
      player.inCar.color = pick(rng, PALETTE.car);
      state.resprayCooldown = 4;
      state.resprayUsedThisStage = true;
      setToast(`Resprayed — heat cleared ($${MONEY.resprayCost})`, 3);
      addEffect(player.inCar.x, player.inCar.y, '#4fc3f7', 14, 140);
      events |= EVENT_PICKUP;
    }

    // --- Gun shop: press F near it to buy a pistol or refill ammo. ---
    const gun = PLACES.gunShop;
    const nearGun = !player.inCar && Math.hypot(player.x - gun.x, player.y - gun.y) < 80;
    state.gunPrompt = null;
    if (nearGun) {
      if (!player.hasPistol) state.gunPrompt = `Press F — Buy Pistol $${MONEY.pistolCost}`;
      else state.gunPrompt = `Press F — Refill Ammo $${100} (you have ${player.ammo})`;
      if (actions & 16) { // ACTION_INTERACT
        if (!player.hasPistol && player.money >= MONEY.pistolCost) {
          player.money -= MONEY.pistolCost;
          player.hasPistol = true;
          player.ammo = 60;
          setToast('Pistol bought — aim with the mouse, click to fire', 3);
          events |= EVENT_PICKUP;
        } else if (player.hasPistol && player.money >= 100) {
          player.money -= 100;
          player.ammo += 60;
          setToast('Ammo refilled (+60)', 3);
          events |= EVENT_PICKUP;
        }
      }
    }

    // --- Taxi fares: drive a taxi, pick up a rider, drop them off. ---
    const taxi = state.taxi;
    if (player.inCar && player.inCar.type === CAR_TAXI) {
      taxi.timer -= dt;
      if (!taxi.active && taxi.timer <= 0) {
        const a = range(rng, 0, Math.PI * 2);
        const px = Math.max(80, Math.min(CITY.width - 80, player.x + Math.cos(a) * 420));
        const py = Math.max(80, Math.min(CITY.height - 80, player.y + Math.sin(a) * 420));
        const street = nearestStreet(px, py);
        taxi.pickup = street.vertical
          ? { x: street.pos + 60, y: py }
          : { x: px, y: street.pos + 60 };
        taxi.active = true;
        taxi.passenger = null;
        setToast('Taxi fare: pick up the rider (pink marker)', 3);
      }
      if (taxi.active && !taxi.passenger && taxi.pickup) {
        if (Math.hypot(player.x - taxi.pickup.x, player.y - taxi.pickup.y) < 60) {
          taxi.passenger = true;
          const places = Object.values(PLACES);
          taxi.dropoff = pick(rng, places);
          taxi.fare = 80 + Math.floor(Math.hypot(taxi.dropoff.x - taxi.pickup.x, taxi.dropoff.y - taxi.pickup.y) / 12);
          setToast(`Rider aboard — take them to ${taxi.dropoff.name}`, 3);
        }
      } else if (taxi.active && taxi.passenger && taxi.dropoff) {
        if (Math.hypot(player.x - taxi.dropoff.x, player.y - taxi.dropoff.y) < 80) {
          player.money += taxi.fare;
          addFloat(player.x, player.y - 30, `+$${taxi.fare} Fare`, PALETTE.gold);
          setToast(`Fare paid: $${taxi.fare}`, 3);
          taxi.active = false;
          taxi.passenger = null;
          taxi.pickup = null;
          taxi.dropoff = null;
          taxi.timer = 6;
          events |= EVENT_PICKUP;
        }
      }
    } else if (taxi.active) {
      taxi.active = false;
      taxi.passenger = null;
      taxi.pickup = null;
      taxi.dropoff = null;
      taxi.timer = 5;
    }

    // --- Camera, effects, floats ---
    const focus = player.inCar || player;
    const lookX = Math.cos(player.angle) * (player.inCar ? 60 : 26);
    const lookY = Math.sin(player.angle) * (player.inCar ? 60 : 26);
    const targetZoom = player.inCar ? 0.82 : 1;
    state.camera.zoom += (targetZoom - state.camera.zoom) * 0.06;
    state.camera.x += (focus.x + lookX - state.camera.x) * 0.12;
    state.camera.y += (focus.y + lookY - state.camera.y) * 0.12;
    for (const e of state.effects) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
    }
    state.effects = state.effects.filter((e) => e.life > 0);
    for (const f of state.floats) {
      f.y -= 26 * dt;
      f.life -= dt;
    }
    state.floats = state.floats.filter((f) => f.life > 0);
    if (missions.banner && missions.banner.timer > 0) {
      missions.banner.timer -= dt;
      if (missions.banner.timer <= 0) missions.banner = null;
    }

    // Autosave every 20 seconds of play.
    state.saveTimer += dt;
    if (state.saveTimer > 20) {
      state.saveTimer = 0;
      state.saveRequested = true;
    }
    return events;
  }

  reset();
  return { state, reset, step, respawn, setToast, addFloat };
}

export { CAR_POLICE, CAR_TAXI, STEP };
