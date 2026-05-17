# 🚀 SpaceVoid

A browser-based Space Shooter game controlled entirely by your hand position and gestures using your webcam! — no installs, no Python, just open and play.

Built with **MediaPipe Hands** + vanilla JavaScript.

---

## 📁 Project Structure

```
hand-gesture-game/
├── index.html          # Main entry point
├── css/
│   └── style.css       # All styles (dark cyberpunk theme)
└── js/
    ├── gestures.js     # Hand landmark → gesture detection logic
    ├── game.js         # Space shooter game engine (Canvas 2D)
    ├── camera.js       # MediaPipe Hands + webcam setup
    └── main.js         # Wires everything together
```

---

## 🚀 How to Run

### Option A – Live Server (recommended for VS Code)
1. Install the **Live Server** extension in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. Allow camera access in the browser prompt

### Option B – Any local server
```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .
```
Then open `http://localhost:8080`

> ⚠️ **Must be served over HTTP/HTTPS** — MediaPipe won't work with `file://` URLs due to browser security restrictions.

---

## 🎮 Gesture Controls

| Gesture      | Emoji | Action       |
|-------------|-------|--------------|
| Fist         | ✊    | Move Left    |
| Open Palm    | 🖐    | Move Right   |
| Point Up     | ☝️    | Move Up      |
| Three Fingers| 3️⃣    | Move Down    |
| Peace / V    | ✌️    | Shoot        |
| Thumbs Up    | 👍    | Shield       |
| Pinch        | 🤏    | Boost        |
| Call Me      | 🤙    | Pause        |
| *Custom*     | 💣    | Screen Bomb! |

---

## ⌨️ Keyboard Fallback (no camera needed)

Use keyboard controls to test without a webcam:

| Key         | Action       |
|-------------|--------------|
| `←` / `A`    | Move Left    |
| `→` / `D`    | Move Right   |
| `↑` / `W`    | Move Up      |
| `↓` / `S`    | Move Down    |
| `Space`      | Shoot        |
| `S`          | Shield       |
| `B`          | Boost        |
| `P`          | Pause        |
| `D`          | Debug panel  |

---

## 🛠 Customising Gestures

Edit `js/gestures.js` to add your own gestures:

```js
// In the detect() function, add a new rule:
if (index && !middle && ring && !pinky) return 'my_gesture';

// In toGameAction(), map it to a game action:
my_gesture: { action: 'bomb', label: '💣 Bomb' },
```

Then handle `'bomb'` in `js/game.js` inside `applyAction()`.

---

## 🔧 Adjusting Sensitivity

In `js/camera.js` → `hands.setOptions()`:
```js
minDetectionConfidence: 0.7,  // lower = detects hand further away
minTrackingConfidence:  0.5,  // lower = faster but jittery
```

In `js/gestures.js` → `isFingerExtended()`:
```js
return landmarks[tipIdx].y < landmarks[baseIdx].y - 0.04;
//                                                    ↑ increase for stricter detection
```

---

## 📦 Dependencies (CDN — no npm needed)

- [@mediapipe/hands](https://cdn.jsdelivr.net/npm/@mediapipe/hands/)
- [@mediapipe/camera_utils](https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/)
- [@mediapipe/drawing_utils](https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/)

All loaded via CDN in `index.html` — no `package.json` or build step required.

---

## 💡 Completed Features

- [x] High score leaderboard (localStorage)
- [x] Different game modes (endless, timed, boss rush)
- [x] Gesture recorder (Record custom gestures for Screen Bomb!)

## 💡 Next Steps / Ideas

- [ ] Mobile support with `@mediapipe/tasks-vision`
- [ ] Sound effects using the Web Audio API
