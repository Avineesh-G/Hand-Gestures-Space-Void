/**
 * camera.js
 * Sets up MediaPipe Hands + webcam and feeds landmark data to the
 * GestureDetector. Draws hand skeleton on #overlay-canvas.
 */

const CameraController = (() => {

  let hands = null;
  let camera = null;
  let overlayCanvas, overlayCtx;

  const HAND_COLOR        = '#4fffb0';
  const HAND_COLOR_JOINT  = '#ff4faa';

  let recordingMode = false;
  let recordCountdown = 3;

  // ── Init ────────────────────────────────────────────────────
  function init() {
    overlayCanvas = document.getElementById('overlay-canvas');
    overlayCtx    = overlayCanvas.getContext('2d');

    // Make overlay same size as video wrapper
    const wrapper = document.getElementById('camera-wrapper');
    const ro = new ResizeObserver(() => {
      overlayCanvas.width  = wrapper.clientWidth;
      overlayCanvas.height = wrapper.clientHeight;
    });
    ro.observe(wrapper);
    overlayCanvas.width  = wrapper.clientWidth;
    overlayCanvas.height = wrapper.clientHeight;

    setupMediaPipe();
  }

  // ── MediaPipe Hands ─────────────────────────────────────────
  function setupMediaPipe() {
    setStatus('Loading MediaPipe…', false);

    hands = new Hands({
      locateFile: file =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands:            2,
      modelComplexity:        1,    // 0=lite, 1=full
      minDetectionConfidence: 0.7,
      minTrackingConfidence:  0.5,
    });

    hands.onResults(onResults);

    startCamera();
  }

  // ── Webcam ──────────────────────────────────────────────────
  function startCamera() {
    const video = document.getElementById('webcam');

    camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({ image: video });
      },
      width:  640,
      height: 480,
    });

    camera.start()
      .then(() => setStatus('Camera active', true))
      .catch(err => {
        console.error('Camera error:', err);
        setStatus('Camera denied – use keyboard fallback', false, true);
      });
  }

  // ── Results callback ────────────────────────────────────────
  function onResults(results) {
    // Clear overlay
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      // No hand in frame
      Game.setGestures([]);
      updateDebug(null);
      return;
    }

    // Sort hands so left on screen (higher x due to mirroring) is player 1
    const sortedHands = [...results.multiHandLandmarks].sort((a, b) => b[0].x - a[0].x);

    // Draw skeleton for each hand
    for (let i = 0; i < sortedHands.length; i++) {
      drawSkeleton(sortedHands[i], i);
    }

    // Detect gestures
    const gestures = sortedHands.map(lm => GestureDetector.detect(lm));
    Game.setGestures(gestures, sortedHands);
    updateDebug({ gestures, landmarks: sortedHands });

    // Handle gesture recording
    if (recordingMode && recordCountdown <= 0) {
      recordingMode = false;
      GestureDetector.saveCustomGesture(sortedHands[0], 'custom_bomb');
      const status = document.getElementById('record-status');
      status.textContent = 'Saved! Do it to clear enemies!';
      setTimeout(() => status.classList.add('hidden'), 3000);
    }
  }

  // ── Draw Skeleton ───────────────────────────────────────────
  const CONNECTIONS = [
    // Thumb
    [0,1],[1,2],[2,3],[3,4],
    // Index
    [0,5],[5,6],[6,7],[7,8],
    // Middle
    [0,9],[9,10],[10,11],[11,12],
    // Ring
    [0,13],[13,14],[14,15],[15,16],
    // Pinky
    [0,17],[17,18],[18,19],[19,20],
    // Palm
    [5,9],[9,13],[13,17],
  ];

  const COLORS = [
    { hand: '#4fffb0', joint: '#ff4faa' }, // P1: Green/Pink
    { hand: '#ff4faa', joint: '#4fffb0' }  // P2: Pink/Green
  ];

  function drawSkeleton(landmarks, index = 0) {
    const W = overlayCanvas.width;
    const H = overlayCanvas.height;

    const handColor  = COLORS[index % COLORS.length].hand;
    const jointColor = COLORS[index % COLORS.length].joint;

    // Landmarks come in normalised [0,1] coords.
    // The video and canvas are mirrored via CSS, so we use raw x coordinates.
    const lx = lm => lm.x * W;
    const ly = lm => lm.y * H;

    overlayCtx.save();

    // Draw connections
    overlayCtx.strokeStyle = handColor;
    overlayCtx.lineWidth   = 2;
    overlayCtx.shadowColor = handColor;
    overlayCtx.shadowBlur  = 6;
    overlayCtx.globalAlpha = 0.8;

    for (const [a, b] of CONNECTIONS) {
      overlayCtx.beginPath();
      overlayCtx.moveTo(lx(landmarks[a]), ly(landmarks[a]));
      overlayCtx.lineTo(lx(landmarks[b]), ly(landmarks[b]));
      overlayCtx.stroke();
    }

    // Draw joints
    overlayCtx.fillStyle   = jointColor;
    overlayCtx.shadowColor = jointColor;
    overlayCtx.shadowBlur  = 8;
    overlayCtx.globalAlpha = 1;

    for (const lm of landmarks) {
      overlayCtx.beginPath();
      overlayCtx.arc(lx(lm), ly(lm), 4, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    // Highlight fingertips
    const TIPS = [4, 8, 12, 16, 20];
    overlayCtx.fillStyle   = '#fff';
    overlayCtx.shadowColor = '#fff';
    overlayCtx.shadowBlur  = 10;
    for (const i of TIPS) {
      overlayCtx.beginPath();
      overlayCtx.arc(lx(landmarks[i]), ly(landmarks[i]), 6, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    overlayCtx.restore();
  }

  // ── Status bar ──────────────────────────────────────────────
  function setStatus(msg, active, error) {
    document.getElementById('status-text').textContent = msg;
    const dot = document.getElementById('status-dot');
    dot.className = active ? 'active' : (error ? 'error' : '');
  }

  // ── Debug panel ─────────────────────────────────────────────
  function updateDebug(data) {
    const el = document.getElementById('debug-output');
    if (!data) { el.textContent = 'No hand detected'; return; }
    const { gestures, landmarks } = data;
    
    let text = '';
    for (let i = 0; i < landmarks.length; i++) {
      const wrist = landmarks[i][0];
      const index = landmarks[i][8];
      text += `P${i+1} Gesture : ${gestures[i]}\n` +
              `P${i+1} Wrist   : (${wrist.x.toFixed(3)}, ${wrist.y.toFixed(3)})\n` +
              `P${i+1} IndexTip: (${index.x.toFixed(3)}, ${index.y.toFixed(3)})\n\n`;
    }
    el.textContent = text.trim();
  }

  // ── Gesture Recorder ────────────────────────────────────────
  function startRecordingGesture() {
    recordingMode = true;
    recordCountdown = 3;
    const status = document.getElementById('record-status');
    status.classList.remove('hidden');
    
    status.textContent = `Recording in ${recordCountdown}... (Hold steady)`;
    const interval = setInterval(() => {
      recordCountdown--;
      if (recordCountdown > 0) {
        status.textContent = `Recording in ${recordCountdown}... (Hold steady)`;
      } else {
        clearInterval(interval);
        status.textContent = 'Capturing...';
      }
    }, 1000);
  }

  return { init, startRecordingGesture };
})();
