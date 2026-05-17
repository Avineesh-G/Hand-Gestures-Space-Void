/**
 * main.js
 * Entry point – wires up the game, camera, gesture guide, and
 * keyboard fallback. Runs after all other scripts are loaded.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Build gesture guide ──────────────────────────────────
  const list = document.getElementById('gesture-list');
  for (const g of GestureDetector.GESTURE_GUIDE) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="gesture-icon">${g.icon}</span>
      <span class="gesture-name">${g.name}</span>
      <span class="gesture-desc">${g.desc}</span>
    `;
    list.appendChild(li);
  }

  // ── Init subsystems ──────────────────────────────────────
  Game.init();
  Game.bindKeyboard();
  CameraController.init();

  // ── Mode selection ───────────────────────────────────────
  let selectedMode = 'endless';
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      selectedMode = e.target.dataset.mode;
    });
  });

  // ── Start button ─────────────────────────────────────────
  document.getElementById('start-btn').addEventListener('click', () => {
    Game.startGame(selectedMode);
  });

  // ── Record button ────────────────────────────────────────
  document.getElementById('record-btn').addEventListener('click', () => {
    CameraController.startRecordingGesture();
  });

  // ── Debug panel toggle (press D) ─────────────────────────
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyD') {
      const panel = document.getElementById('debug-panel');
      panel.classList.toggle('hidden');
    }
  });

  console.log('%c👋 Hand Gesture Game loaded!', 'color:#4fffb0;font-size:1.2em;font-weight:bold');
  console.log('• Keyboard fallback: ← → ↑ Space S B P');
  console.log('• Press D to toggle debug panel');
});
