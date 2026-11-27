// Harbour Lights — keyboard and mouse input.
// One clear job: turn keys and clicks into one plain input object per frame.
// Controls: Arrows steer (Up/Down pitch, Left/Right bank), W/S throttle,
// Space flaps, C camera, R restart, P pause, M mute, Enter start.
// SPDX-License-Identifier: MIT

export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: consumed once per frame
  let onAction = null; // (action: string) => void, for buttons/keys the game owns

  function down(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }
  function up(e) {
    keys.delete(e.code);
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());

  // Mouse: title-screen buttons carry data-action.
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button && onAction) onAction(button.dataset.action);
  });

  return {
    setActionHandler(fn) { onAction = fn; },
    // Read once per frame; returns the input for this frame.
    poll() {
      const input = {
        pitch: (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0),
        roll: (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0),
        throttle: (keys.has('KeyW') || keys.has('KeyE') || keys.has('Equal') ? 1 : 0)
          - (keys.has('KeyS') || keys.has('KeyQ') || keys.has('Minus') ? 1 : 0),
        flaps: keys.has('Space') || keys.has('KeyF'),
        camera: pressed.has('KeyC'),
        restart: pressed.has('KeyR'),
        pause: pressed.has('KeyP') || pressed.has('Escape'),
        mute: pressed.has('KeyM'),
        start: pressed.has('Enter'),
      };
      pressed.clear();
      return input;
    },
  };
}
