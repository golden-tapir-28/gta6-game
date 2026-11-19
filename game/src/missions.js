// The story: five missions from Rico, a fixer in Solmar, plus the side work that
// fills the city between them. Each mission is a list of stages; a stage names a
// target place (or a condition) and the line the contact says when it starts.
// The world calls `update` every step with its state and gets back events.

import { MONEY, PLACES } from './config.js';

export const MISSION_COUNT = 5;

const CONTACT = 'Rico';

function stage(target, text, opts = {}) {
  return { target, text, ...opts };
}

export const MISSIONS = [
  {
    id: 1,
    title: 'Wheels',
    contact: CONTACT,
    intro: "Rico: Kid, you need wheels in this town. Jack a car — any car — and bring it to my garage. Don't let the cops see you take it.",
    stages: [
      stage('stealCar', 'Steal a car (walk up to one and press E).'),
      stage('garage', 'Drive the car to Rico\'s Garage.', { place: 'garage', radius: 90 }),
    ],
    reward: MONEY.missionReward[1],
  },
  {
    id: 2,
    title: 'The Pickup',
    contact: CONTACT,
    intro: "Rico: A crate came in at the docks. Go get it and drop it at the marina. The port's crawling with patrols — keep it smooth.",
    stages: [
      stage('docks', 'Go to the Solmar Docks.', { place: 'docks', radius: 90 }),
      stage('marina', 'Deliver the crate to the Marina Yacht.', { place: 'marina', radius: 90 }),
    ],
    reward: MONEY.missionReward[2],
  },
  {
    id: 3,
    title: 'Hot Pursuit',
    contact: CONTACT,
    intro: "Rico: The PD's onto you, kid. Lose them — all of them — then get to the safehouse. No stars, no tail, then you're clear.",
    stages: [
      stage('wanted3', 'The cops are coming. Get to 3 stars, then lose them.', { setWanted: 3 }),
      stage('loseWanted', 'Lose the heat (stay out of sight until the stars fall).', { needWanted: 0 }),
      stage('safehouse', 'Reach the Safehouse.', { place: 'safehouse', radius: 90 }),
    ],
    reward: MONEY.missionReward[3],
  },
  {
    id: 4,
    title: 'Payday',
    contact: CONTACT,
    intro: "Rico: The National Bank. Walk in, hold the floor for ten seconds, grab the cash and run. Then get the car resprayed — they'll be looking for it.",
    stages: [
      stage('bank', 'Get to the Solmar National Bank.', { place: 'bank', radius: 90 }),
      stage('hold', 'Hold the bank floor — stay inside the marker for 10 seconds.', { place: 'bank', radius: 90, holdSeconds: 10 }),
      stage('respray', 'Get to Spray & Shine and clear the heat.', { place: 'respray', radius: 90, needRespray: true }),
    ],
    reward: MONEY.missionReward[4],
  },
  {
    id: 5,
    title: 'King of Solmar',
    contact: CONTACT,
    intro: "Rico: Last job, kid. A package for the yacht, and the whole PD will be on you. Drive like the city is yours — because after this, it is.",
    stages: [
      stage('marina', 'Deliver the package to the Marina Yacht — with 4 stars on you.', { place: 'marina', radius: 90, setWanted: 4 }),
    ],
    reward: MONEY.missionReward[5],
  },
];

export function createMissionState() {
  return {
    index: 0, // 0-based into MISSIONS; MISSION_COUNT means the story is done
    stage: 0,
    stageTimer: 0,
    done: false,
    banner: null, // {title, text, timer} shown on the HUD
    started: false,
  };
}

export function currentMission(state) {
  if (state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

export function currentStage(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.stages[state.stage] || null;
}

/** The place the current stage points at (for the minimap and the beacon). */
export function stagePlace(state) {
  const s = currentStage(state);
  if (!s || !s.place) return null;
  return { ...PLACES[s.place], key: s.place };
}

/** Start the current mission (shows its intro as a banner). */
export function startMission(state) {
  const mission = currentMission(state);
  if (!mission) return;
  state.stage = 0;
  state.stageTimer = 0;
  state.started = true;
  state.banner = { title: `Mission ${mission.id}: ${mission.title}`, text: mission.intro, timer: 6 };
}

/** Advance to the next stage; returns true when the mission is complete. */
export function advanceStage(state) {
  const mission = currentMission(state);
  if (!mission) return false;
  state.stage += 1;
  state.stageTimer = 0;
  if (state.stage >= mission.stages.length) {
    state.index += 1;
    state.stage = 0;
    state.done = state.index >= MISSIONS.length;
    return true;
  }
  const next = mission.stages[state.stage];
  state.banner = { title: 'Next step', text: next.text, timer: 4 };
  return false;
}

/** The objective line the HUD shows for the current stage. */
export function objectiveText(state) {
  const mission = currentMission(state);
  if (!mission) return 'Story complete — Solmar is yours. Free roam, collect packages, or start over.';
  const s = currentStage(state);
  if (!s) return '';
  return `${mission.title}: ${s.text}`;
}

export { CONTACT };
