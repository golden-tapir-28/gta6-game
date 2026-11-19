// Keyboard and mouse input. Held keys give movement and driving; one-shot presses
// (confirm, pause, enter car, punch, interact) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// The mouse position is tracked in screen pixels and converted to a world aim point
// by the renderer (see main.js).

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_INTERACT = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['Space']);
const INTERACT = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) event.preventDefault();
      return;
    }
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || PUNCH.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  target.addEventListener('pointerdown', (event) => {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function axis(neg, pos) {
    return (held.has([...pos][0]) || [...pos].some((c) => held.has(c)) ? 1 : 0) - (held.has([...neg][0]) || [...neg].some((c) => held.has(c)) ? 1 : 0);
  }

  return {
    /** Movement axes, each -1, 0 or 1. */
    moveX() { return axis(LEFT, RIGHT); },
    moveY() { return axis(UP, DOWN); },
    /** True while a run key is held. */
    running() { return [...RUN].some((c) => held.has(c)); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Mouse position in canvas CSS pixels. */
    mouse() { return { x: mouseX, y: mouseY }; },
    /** True while the mouse button is held. */
    mouseDown() { return mouseDown; },
    /** True once after a click, until taken. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** True while any movement key is held. */
    anyMove() {
      return [...UP, ...DOWN, ...LEFT, ...RIGHT].some((c) => held.has(c));
    },
  };
}
