// Saving: the player's progress lives in localStorage (this browser only).
// A save holds money, the mission index, the packages found, the pistol, the
// player's spot and the clock. Loading restores them; a missing or broken save
// is simply a fresh start.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.player.money,
      missionIndex: state.missions.index,
      packages: state.packagesFound,
      hasPistol: state.player.hasPistol,
      ammo: state.player.ammo,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      clock: state.clock,
      best: state.best,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; nothing to clear.
  }
}
