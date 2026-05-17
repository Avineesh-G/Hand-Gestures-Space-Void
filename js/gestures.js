/**
 * gestures.js
 * Detects hand gestures from MediaPipe 21-landmark data.
 *
 * Landmark indices (key ones):
 *   0  = Wrist
 *   4  = Thumb tip
 *   8  = Index tip    (5 = index MCP base)
 *   12 = Middle tip   (9 = middle MCP base)
 *   16 = Ring tip     (13 = ring MCP base)
 *   20 = Pinky tip    (17 = pinky MCP base)
 */

const GestureDetector = (() => {

  // ── Custom Gestures ─────────────────────────────────────────
  let customGestures = {};

  // ── Helpers ────────────────────────────────────────────────

  /** Euclidean distance between two landmarks (x,y only) */
  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /**
   * Returns true if a finger is "extended".
   * tipIdx   = landmark index of finger tip
   * baseIdx  = landmark index of MCP knuckle (base)
   * landmarks = array of 21 {x,y,z} objects
   */
  function isFingerExtended(tipIdx, baseIdx, landmarks) {
    // Tip should be higher than base (smaller y = higher on screen)
    return landmarks[tipIdx].y < landmarks[baseIdx].y - 0.04;
  }

  // ── Public API ─────────────────────────────────────────────

  /**
   * Detect gesture from one hand's landmarks.
   * @param {Array} landmarks  Array of 21 {x, y, z}
   * @returns {string} gesture name
   */
  function detect(landmarks) {
    if (!landmarks || landmarks.length < 21) return 'none';

    // ── Check Custom Gestures First ────────────────────────────
    const norm = normalizeLandmarks(landmarks);
    for (const [name, data] of Object.entries(customGestures)) {
      if (compareLandmarks(norm, data) < 0.25) {
        return name;
      }
    }

    const thumb  = isThumbExtended(landmarks);
    const index  = isFingerExtended(8,  5,  landmarks);
    const middle = isFingerExtended(12, 9,  landmarks);
    const ring   = isFingerExtended(16, 13, landmarks);
    const pinky  = isFingerExtended(20, 17, landmarks);

    const extended = [thumb, index, middle, ring, pinky];
    const count = extended.filter(Boolean).length;

    // ── Gesture Rules ──────────────────────────────

    // FIST – all fingers closed
    if (count === 0) return 'fist';

    // OPEN PALM – all fingers open
    if (count === 5) return 'open';

    // POINT UP – only index extended, pointing upward
    if (index && !middle && !ring && !pinky) {
      if (landmarks[8].y < landmarks[5].y - 0.15) return 'point_up';
      // Index pointing left or right
      const dx = landmarks[8].x - landmarks[5].x;
      if (dx < -0.1) return 'point_right'; // mirrored
      if (dx >  0.1) return 'point_left';
      return 'point_up';
    }

    // PEACE / V – index + middle extended
    if (index && middle && !ring && !pinky) return 'peace';

    // THREE – index + middle + ring
    if (index && middle && ring && !pinky) return 'three';

    // THUMBS UP – only thumb extended, fist shape
    if (thumb && !index && !middle && !ring && !pinky) return 'thumbs_up';

    // PINCH – thumb tip close to index tip
    if (dist(landmarks[4], landmarks[8]) < 0.07) return 'pinch';

    // CALL ME – thumb + pinky extended
    if (thumb && !index && !middle && !ring && pinky) return 'call';

    // SWIPE direction heuristic using wrist vs middle base
    // (basic left/right from palm orientation)

    return 'unknown';
  }

  /** Special thumb check (horizontal, so different axis) */
  function isThumbExtended(landmarks) {
    // Thumb goes sideways; compare tip x vs IP joint x
    const tipX  = landmarks[4].x;
    const ipX   = landmarks[3].x;
    const mcpX  = landmarks[2].x;
    return Math.abs(tipX - mcpX) > 0.08;
  }

  // ── Custom Gesture Recording ─────────────────────────────────

  function normalizeLandmarks(landmarks) {
    const wrist = landmarks[0];
    const dx = landmarks[9].x - wrist.x;
    const dy = landmarks[9].y - wrist.y;
    const dz = landmarks[9].z - wrist.z;
    const scale = Math.hypot(dx, dy, dz) || 0.1;

    return landmarks.map(lm => ({
      x: (lm.x - wrist.x) / scale,
      y: (lm.y - wrist.y) / scale,
      z: (lm.z - wrist.z) / scale,
    }));
  }

  function compareLandmarks(lm1, lm2) {
    let sum = 0;
    for (let i = 0; i < 21; i++) {
      sum += Math.hypot(lm1[i].x - lm2[i].x, lm1[i].y - lm2[i].y, lm1[i].z - lm2[i].z);
    }
    return sum / 21;
  }

  function saveCustomGesture(landmarks, name) {
    customGestures[name] = normalizeLandmarks(landmarks);
  }

  /**
   * Map a gesture to a game action.
   * Customize this to add/remove controls.
   * @returns {{ action: string, label: string }}
   */
  function toGameAction(gesture) {
    const map = {
      open:       { action: 'rapid_fire', label: '🔥 Rapid Fire' },
      fist:       { action: 'shield',     label: '🛡 Shield'    },
      pinch:      { action: 'boost',      label: '⚡ Boost'     },
      peace:      { action: 'pause',      label: '⏸ Pause'     },
      custom_bomb:{ action: 'bomb',       label: '💣 Bomb'      },
    };
    return map[gesture] || { action: 'none', label: '' };
  }

  /** Catalogue used to build the on-screen gesture guide */
  const GESTURE_GUIDE = [
    { icon: '✋', name: 'Move Hand',  desc: 'Steer Ship',   gesture: 'none'      },
    { icon: '🖐',  name: 'Open Palm', desc: 'Rapid Fire',   gesture: 'open'      },
    { icon: '✊', name: 'Fist',       desc: 'Shield',       gesture: 'fist'      },
    { icon: '🤏', name: 'Pinch',      desc: 'Boost',        gesture: 'pinch'     },
    { icon: '✌️', name: 'Peace',      desc: 'Pause',        gesture: 'peace'     },
  ];

  return { detect, toGameAction, GESTURE_GUIDE, saveCustomGesture };
})();
