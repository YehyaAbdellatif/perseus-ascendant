// Keyboard, gamepad and touch input, all mapped to the same named actions.

const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ', 'KeyK'],
  attack: ['KeyX', 'KeyJ'],
  shield: ['KeyC', 'KeyL', 'ShiftLeft', 'ShiftRight'],
  helm: ['KeyV', 'KeyI'],
  gaze: ['KeyB', 'KeyO'],
  nectar: ['KeyQ', 'KeyU'],
  pause: ['Escape', 'KeyP', 'Enter'],
  confirm: ['Enter', 'Space', 'KeyZ', 'KeyX', 'KeyJ', 'KeyK'],
  back: ['Escape', 'Backspace'],
  mute: ['KeyM'],
};
const ACTIONS = Object.keys(KEYS);

const keyDown = new Set();
const touchDown = new Set();
let padDown = new Set();
const prev = {};
export const input = { held: {}, pressed: {}, released: {}, anyPressed: false, usingTouch: false };

const codeToActions = {};
for (const a of ACTIONS) for (const k of KEYS[a]) (codeToActions[k] = codeToActions[k] || []).push(a);

window.addEventListener('keydown', (e) => {
  if (codeToActions[e.code]) e.preventDefault();
  keyDown.add(e.code);
});
window.addEventListener('keyup', (e) => keyDown.delete(e.code));
window.addEventListener('blur', () => { keyDown.clear(); touchDown.clear(); });

// Touch buttons
// Show only the touch buttons that do something right now (relic buttons appear once the relic is won).
export function setTouchButtons(visible) {
  const wrap = document.getElementById('touch');
  if (!wrap || !input.usingTouch) return;
  const key = [...visible].sort().join();
  if (wrap.dataset.shown === key) return;
  wrap.dataset.shown = key;
  for (const el of wrap.querySelectorAll('.tb')) el.style.display = visible.has(el.dataset.a) ? '' : 'none';
}

export function setupTouch() {
  const wrap = document.getElementById('touch');
  if (!wrap) return;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  wrap.classList.add('on');
  input.usingTouch = true;
  const active = new Map();
  const update = (e) => {
    e.preventDefault();
    for (const el of wrap.querySelectorAll('.tb')) el.classList.remove('on');
    touchDown.clear();
    for (const t of e.touches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el && el.dataset && el.dataset.a) {
        touchDown.add(el.dataset.a);
        el.classList.add('on');
      }
    }
    active.clear();
  };
  for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
    wrap.addEventListener(ev, update, { passive: false });
  }
}

function pollPad() {
  padDown = new Set();
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const b = (i) => p.buttons[i] && p.buttons[i].pressed;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (b(14) || ax < -0.4) padDown.add('left');
    if (b(15) || ax > 0.4) padDown.add('right');
    if (b(12) || ay < -0.5) padDown.add('up');
    if (b(13) || ay > 0.5) padDown.add('down');
    if (b(0)) { padDown.add('jump'); padDown.add('confirm'); }
    if (b(2)) { padDown.add('attack'); }
    if (b(1)) { padDown.add('back'); padDown.add('shield'); }
    if (b(5) || b(7)) padDown.add('shield');
    if (b(4)) padDown.add('helm');
    if (b(3) || b(6)) padDown.add('gaze');
    if (b(8)) padDown.add('nectar');
    if (b(9)) padDown.add('pause');
  }
}

export function updateInput() {
  pollPad();
  input.anyPressed = false;
  for (const a of ACTIONS) {
    let h = KEYS[a].some((k) => keyDown.has(k)) || padDown.has(a) || touchDown.has(a);
    if (a === 'confirm' && (touchDown.has('jump') || touchDown.has('attack') || touchDown.has('pause'))) h = true;
    input.pressed[a] = h && !prev[a];
    input.released[a] = !h && prev[a];
    input.held[a] = h;
    if (input.pressed[a]) input.anyPressed = true;
    prev[a] = h;
  }
}

// Clear held state so an action can't bleed across a menu transition.
export function consumeAll() {
  for (const a of ACTIONS) { input.pressed[a] = false; }
}
