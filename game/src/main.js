// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer and
// the HUD paint what is there. The game moves between five screens: title, play,
// paused, busted and wasted. Progress saves to localStorage automatically.
//
// ?seed=N fixes the city's random pattern. ?shot=start|chase|drive|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, MONEY, STEP } from './config.js';
import { makeRng } from './random.js';
import {
  createWorld, EVENT_BUSTED, EVENT_CRIME, EVENT_HIT, EVENT_MISSION,
  EVENT_PACKAGE, EVENT_PICKUP, EVENT_SHOT, EVENT_WASTED,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput,
} from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadGame, saveGame } from './save.js';
import { stagePlace, startMission } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(makeRng(seed));
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

/** Apply a loaded save to the world. */
function applySave(save) {
  const state = world.state;
  state.player.money = save.money;
  state.player.hasPistol = save.hasPistol;
  state.player.ammo = save.ammo;
  state.player.x = save.x;
  state.player.y = save.y;
  state.clock = save.clock;
  state.best = save.best || 0;
  state.missions.index = Math.min(save.missionIndex, 5);
  state.missions.stage = 0;
  state.missions.done = state.missions.index >= 5;
  if (!state.missions.done) startMission(state.missions);
  for (let i = 0; i < save.packages && i < state.packages.length; i += 1) {
    state.packages[i].found = true;
  }
  state.packagesFound = save.packages;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const state = world.state;
  state.missionPlace = stagePlace(state.missions);
  state.hasSave = false;
  // Exposed for debugging the shot framing (positions, camera, wanted).
  window.__solmarWorld = world;
  let painted = 0;
  function paint() {
    renderer.drawWorld(state, scene.screen);
    hud.draw(state, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  const saved = loadGame();
  const state = world.state;
  state.hasSave = !!saved;
  state.saveMoney = saved ? saved.money : 0;
  state.saveMission = saved ? saved.missionIndex + 1 : 1;
  state.best = best;
  // Exposed for debugging (positions, wanted, mission).
  window.__solmarWorld = world;

  function announce(message) {
    status.textContent = message;
  }

  function doSave() {
    state.best = Math.max(best, state.player.money);
    saveGame(state);
    world.state.saveRequested = false;
  }

  function startGame(continueSave) {
    audio.unlock();
    if (continueSave && saved) {
      applySave(saved);
      state.attract = false;
    } else {
      world.reset();
      state.attract = false;
      state.best = best;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Mission 1: Wheels. Steal a car and bring it to Rico\'s Garage.');
  }

  function endRun(kind) {
    audio.unlock();
    if (kind === 'busted') {
      screen = SCREEN_BUSTED;
      audio.busted();
      announce('Busted. The PD caught you.');
    } else {
      screen = SCREEN_WASTED;
      audio.busted();
      announce('Wasted. You went down.');
    }
    if (state.player.money > best) {
      best = state.player.money;
      saveBest(best);
    }
    doSave();
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.gunshot();
    if (events & EVENT_HIT) audio.punch();
    if (events & (EVENT_PACKAGE | EVENT_PICKUP)) audio.pickup();
    if (events & EVENT_MISSION) audio.mission();
    if (events & EVENT_CRIME) audio.click();
    if (events & EVENT_BUSTED) endRun('busted');
    else if (events & EVENT_WASTED) endRun('wasted');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) startGame(!!saved);
    else if ((screen === SCREEN_BUSTED || screen === SCREEN_WASTED) && (actions & ACTION_CONFIRM)) {
      world.respawn(screen === SCREEN_BUSTED ? 'busted' : 'wasted');
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function aimPoint() {
    const m = input.mouse();
    return renderer.screenToWorld(m.x, m.y, state.camera);
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, input, 0, null);
      return;
    }
    const aim = state.player.inCar ? null : aimPoint();
    const events = world.step(STEP, input, actions, aim);
    state.missionPlace = stagePlace(state.missions);
    if (world.state.saveRequested) doSave();
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot actions (enter car, punch, interact) apply to the first step
      // of the frame only; later steps in the same frame get none, so a press
      // is never counted twice (enter then instantly exit, for example).
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // Continuous sounds.
    const car = state.player.inCar;
    audio.engine(car ? Math.abs(car.speed) / 640 : 0);
    const policeNear = state.cops.cars.some((c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 700);
    audio.siren(policeNear && state.wanted.stars > 0, STEP);
    renderer.drawWorld(state, screen);
    hud.draw(state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('beforeunload', () => {
    if (screen === SCREEN_PLAY) doSave();
  });

  announce('Solmar Nights. Press Enter to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
