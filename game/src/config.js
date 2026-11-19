// Solmar Nights — every tuning number, colour and city constant in one place.
// The world is a fixed 3600x2600-unit coastal city; the renderer scales a 1280x720
// logical view to the window, so no rule below depends on the screen size.

export const STEP = 1 / 60;

export const VIEW = { width: 1280, height: 720 };

/** The city: streets every 400 units, 90 wide; blocks between them hold buildings. */
export const CITY = {
  width: 3600,
  height: 2600,
  roadWidth: 90,
  streetGap: 400,
  streetsX: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400],
  streetsY: [200, 600, 1000, 1400, 1800, 2200],
  // The beach and sea run along the south edge; the port sits on the west edge.
  beachY: 2280,
  seaY: 2440,
  portX: 320,
};

/** Named places the missions and the HUD point at. */
export const PLACES = {
  garage: { name: "Rico's Garage", x: 1000, y: 600 },
  docks: { name: 'Solmar Docks', x: 300, y: 1800 },
  safehouse: { name: 'Safehouse', x: 3200, y: 1000 },
  bank: { name: 'Solmar National Bank', x: 1800, y: 600 },
  marina: { name: 'Marina Yacht', x: 2600, y: 2320 },
  respray: { name: 'Spray & Shine', x: 2200, y: 1400 },
  hospital: { name: 'St. Marina Hospital', x: 1400, y: 1800 },
  policeStation: { name: 'Solmar PD', x: 1000, y: 1000 },
  gunShop: { name: 'Lock & Load', x: 2600, y: 600 },
  park: { name: 'Palm Park', x: 1600, y: 1200 },
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.45,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  sportsMaxSpeed: 640,
  turnRate: 2.6,
  grip: 6.5,
};

export const PED = {
  radius: 11,
  walkSpeed: 70,
  runSpeed: 190,
  count: 46,
};

export const TRAFFIC = { count: 16, minGap: 130 };

export const POLICE = {
  maxStars: 5,
  // How many police cars hunt at each wanted level (index = stars).
  carsByStars: [0, 1, 2, 3, 4, 6],
  footByStars: [0, 1, 1, 2, 2, 3],
  carSpeed: 560,
  footSpeed: 250,
  bustRange: 46,
  // Seconds out of every cop's sight before the wanted level starts to fall.
  hideSeconds: 6,
  decaySeconds: 9,
};

export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.28,
  bulletSpeed: 900,
};

export const MONEY = {
  start: 250,
  missionReward: [0, 800, 1500, 2500, 4000, 8000],
  packageBonus: 500,
  resprayCost: 100,
  pistolCost: 600,
  bustFine: 300,
  wastedFine: 200,
};

export const SAVE_KEY = 'solmar-nights.save.v1';
export const BEST_KEY = 'solmar-nights.best.v1';

export const PALETTE = {
  // Sun-soaked coastal city: warm asphalt, teal sea, sand, pastel blocks.
  grass: '#7fae62',
  park: '#6da352',
  sidewalk: '#c9bfa8',
  road: '#3d3a38',
  roadLine: '#e8d44d',
  curb: '#8f8672',
  sand: '#e8d39a',
  sea: '#2a9db8',
  seaDeep: '#1e7d99',
  building: ['#e8a87c', '#d9a0a8', '#a8c8d8', '#e8c87c', '#b8a8d8', '#f0b090', '#98c8a8', '#d8b090'],
  buildingRoof: ['#c98a5e', '#b08088', '#88a8b8', '#c8a85e', '#9888b8', '#d09070', '#78a888', '#b89070'],
  player: '#ff5a5a',
  playerDark: '#c93a3a',
  police: '#2a5ad8',
  policeLight: '#7aa8ff',
  taxi: '#f2c94c',
  car: ['#e5534b', '#4fc3f7', '#f2c94c', '#9b59b6', '#2ecc71', '#e67e22', '#ecf0f1', '#34495e'],
  ped: ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#95a5a6', '#fd79a8'],
  text: '#f5f1e8',
  muted: '#b8b0a0',
  panel: 'rgba(20, 18, 24, 0.82)',
  panelBorder: 'rgba(255, 255, 255, 0.14)',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#58d68d',
  blue: '#4fc3f7',
  star: '#ffd94d',
  marker: '#ff5ad8',
  markerRing: 'rgba(255, 90, 216, 0.35)',
  night: 'rgba(10, 12, 40, 0.28)',
  sunset: 'rgba(255, 120, 60, 0.10)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
