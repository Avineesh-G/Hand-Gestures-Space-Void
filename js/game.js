/**
 * game.js
 * A simple Space Shooter game controlled entirely by hand gestures.
 * Renders on #game-canvas using the Canvas 2D API.
 */

const Game = (() => {

  // ── State ──────────────────────────────────────────────────
  let canvas, ctx;
  let animId = null;
  let state  = 'idle'; // idle | playing | paused | gameover
  let currentMode = 'endless'; // endless | timed | boss

  const S = {
    score: 0,
    level: 1,
    lives: 3,
    timeLeft: 0,
    currentGestures: [],
    currentActions:  [],
  };

  // Game objects
  let players = [], bullets = [], enemies = [], particles = [], stars = [];
  let boss = null, enemyBullets = [];

  // Leaderboard
  let highScores = JSON.parse(localStorage.getItem('gestureGameHighScores')) || [];

  // Timing
  let lastTime      = 0;
  let enemyTimer    = 0;
  let enemyInterval = 1400; // ms between enemy spawns

  // ── Init ───────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('game-canvas');
    ctx    = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    buildStars();
    updateHighScoreDisplay();
    renderLeaderboard();
    showOverlay('Ready?', 'Select a mode and show your hand to the camera', 'Start Game');
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  || 800;
    canvas.height = rect.height || 500;
    for (let p of players) {
      p.x = clamp(p.x, 0, canvas.width);
      p.y = canvas.height - 60;
    }
  }

  function updateHighScoreDisplay() {
    const best = highScores.length > 0 ? highScores[0].score : 0;
    document.getElementById('high-score').textContent = best;
  }

  function saveScore(newScore) {
    if (newScore <= 0) return;
    highScores.push({ score: newScore, date: new Date().toLocaleDateString(), mode: currentMode });
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5); // Keep top 5
    localStorage.setItem('gestureGameHighScores', JSON.stringify(highScores));
    updateHighScoreDisplay();
  }

  function renderLeaderboard() {
    const lbContainer = document.getElementById('leaderboard');
    const lbList = document.getElementById('leaderboard-list');
    lbList.innerHTML = '';
    
    if (highScores.length === 0) {
      lbContainer.classList.add('hidden');
      return;
    }
    
    lbContainer.classList.remove('hidden');
    highScores.forEach((entry, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>#${idx + 1}</span> <strong>${entry.score}</strong> <span style="font-size:0.7em;color:var(--muted);">${entry.mode} - ${entry.date}</span>`;
      lbList.appendChild(li);
    });
  }

  // ── Stars background ───────────────────────────────────────
  function buildStars() {
    stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 1000,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.6 + 0.1,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  function drawStars(dt) {
    ctx.save();
    for (const s of stars) {
      s.y += s.speed;
      if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle   = '#fff';
      ctx.beginPath();
      ctx.arc(s.x % canvas.width, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Players ────────────────────────────────────────────────
  function createPlayers() {
    return [
      {
        id: 1,
        x: canvas.width * 0.35, y: canvas.height - 60,
        targetX: canvas.width * 0.35, targetY: canvas.height - 60,
        w: 36, h: 44,
        speed: 400,
        shield: false, shieldTimer: 0,
        color: '#4fffb0',
        boostActive: false,
        shootCooldown: 0
      },
      {
        id: 2,
        x: canvas.width * 0.65, y: canvas.height - 60,
        targetX: canvas.width * 0.65, targetY: canvas.height - 60,
        w: 36, h: 44,
        speed: 400,
        shield: false, shieldTimer: 0,
        color: '#ff4faa',
        boostActive: false,
        shootCooldown: 0
      }
    ];
  }

  function drawPlayers() {
    for (const p of players) {
      const { x, y, w, h, color, shield } = p;
      ctx.save();

      if (shield) {
        ctx.shadowColor = color;
        ctx.shadowBlur  = 24;
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, w + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle   = color;
      ctx.shadowColor = color;
      ctx.shadowBlur  = 14;
      ctx.beginPath();
      ctx.moveTo(x,      y - h / 2);
      ctx.lineTo(x - w / 2, y + h / 2);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle   = '#080a12';
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle   = '#ffe066';
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.ellipse(x, y + h / 2, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ── Bullets ────────────────────────────────────────────────
  function spawnBullet(p, isRapid = false) {
    const bColor = p.color === '#4fffb0' ? '#ffe066' : '#4fc3ff';
    if (isRapid) {
      bullets.push({ x: p.x - 10, y: p.y - 20, speed: 600, r: 4, color: bColor });
      bullets.push({ x: p.x + 10, y: p.y - 20, speed: 600, r: 4, color: bColor });
    } else {
      bullets.push({ x: p.x, y: p.y - 20, speed: 520, r: 4, color: bColor });
    }
  }

  function drawBullets(dt) {
    ctx.save();
    for (const b of bullets) {
      b.y -= b.speed * dt;
      ctx.fillStyle   = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur  = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    bullets = bullets.filter(b => b.y > -10);
  }

  // ── Normal Enemies ─────────────────────────────────────────
  function spawnEnemy() {
    const size  = rand(20, 36);
    const speed = rand(80, 120) + S.level * 12;
    const types = ['hexagon', 'diamond', 'square', 'circle', 'triangle'];
    enemies.push({
      x:     rand(size, canvas.width - size),
      y:     -size,
      r:     size,
      speed,
      hp:    1 + Math.floor(S.level / 3),
      color: randColor(),
      type:  types[Math.floor(Math.random() * types.length)],
      angle: 0,
      spin:  rand(-3, 3)
    });
  }

  function drawEnemies(dt) {
    for (const e of enemies) {
      e.y += e.speed * dt;
      e.angle += e.spin * dt;

      ctx.save();
      ctx.fillStyle   = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur  = 10;
      
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      
      ctx.beginPath();
      
      if (e.type === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const px = e.r * Math.cos(a);
          const py = e.r * Math.sin(a);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
      } else if (e.type === 'diamond') {
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r, 0);
        ctx.lineTo(0, e.r);
        ctx.lineTo(-e.r, 0);
      } else if (e.type === 'square') {
        ctx.rect(-e.r / 1.3, -e.r / 1.3, (e.r / 1.3) * 2, (e.r / 1.3) * 2);
      } else if (e.type === 'circle') {
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
      } else if (e.type === 'triangle') {
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r, e.r * 0.8);
        ctx.lineTo(-e.r, e.r * 0.8);
      }
      
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    enemies = enemies.filter(e => e.y <= canvas.height + e.r);
  }

  // ── Boss ───────────────────────────────────────────────────
  function spawnBoss() {
    boss = {
      x: canvas.width / 2, y: 100,
      w: 120 + S.level * 10, h: 80,
      hp: 30 + S.level * 20, maxHp: 30 + S.level * 20,
      speed: 100 + S.level * 15,
      dir: 1,
      fireTimer: 0,
      color: '#ff4f4f'
    };
  }

  function updateAndDrawBoss(dt) {
    if (!boss) return;
    
    boss.x += boss.speed * boss.dir * dt;
    if (boss.x < boss.w/2) { boss.dir = 1; boss.x = boss.w/2; }
    if (boss.x > canvas.width - boss.w/2) { boss.dir = -1; boss.x = canvas.width - boss.w/2; }

    boss.fireTimer += dt;
    if (boss.fireTimer > Math.max(0.3, 1.2 - S.level * 0.1)) {
      boss.fireTimer = 0;
      enemyBullets.push({ x: boss.x - 30, y: boss.y + 20, vx: -50, vy: 300, r: 6, color: '#ff4f4f' });
      enemyBullets.push({ x: boss.x + 30, y: boss.y + 20, vx: 50, vy: 300, r: 6, color: '#ff4f4f' });
      enemyBullets.push({ x: boss.x, y: boss.y + 30, vx: 0, vy: 350, r: 8, color: '#ff4f4f' });
    }

    ctx.save();
    ctx.fillStyle = boss.color;
    ctx.shadowColor = boss.color;
    ctx.shadowBlur = 20;
    
    // Draw Boss
    ctx.beginPath();
    ctx.moveTo(boss.x - boss.w/2, boss.y - boss.h/2);
    ctx.lineTo(boss.x + boss.w/2, boss.y - boss.h/2);
    ctx.lineTo(boss.x + boss.w/3, boss.y + boss.h/2);
    ctx.lineTo(boss.x - boss.w/3, boss.y + boss.h/2);
    ctx.closePath();
    ctx.fill();

    // Core
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, 15, 0, Math.PI*2);
    ctx.fill();
    
    // Health bar
    ctx.fillStyle = '#ff4f4f';
    ctx.fillRect(boss.x - boss.w/2, boss.y - boss.h/2 - 20, boss.w * (boss.hp / boss.maxHp), 6);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(boss.x - boss.w/2, boss.y - boss.h/2 - 20, boss.w, 6);
    ctx.restore();
  }

  function drawEnemyBullets(dt) {
    ctx.save();
    for (const b of enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    enemyBullets = enemyBullets.filter(b => b.y < canvas.height + 20 && b.x > -20 && b.x < canvas.width + 20);
  }

  // ── Particles ──────────────────────────────────────────────
  function explode(x, y, color, large=false) {
    const count = large ? 40 : 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(60, large ? 400 : 200);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r:  rand(2, large ? 8 : 5),
        alpha: 1,
        color,
      });
    }
  }

  function drawParticles(dt) {
    ctx.save();
    particles = particles.filter(p => p.alpha > 0.02);
    for (const p of particles) {
      p.x     += p.vx * dt;
      p.y     += p.vy * dt;
      p.alpha -= dt * 1.8;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Collision ──────────────────────────────────────────────
  function checkCollisions() {
    // Normal Enemies
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (dist2(b.x, b.y, e.x, e.y) < e.r * e.r) {
          bullets.splice(bi, 1);
          e.hp--;
          if (e.hp <= 0) {
            explode(e.x, e.y, e.color);
            enemies.splice(ei, 1);
            addScore(10 * S.level);
          }
          break;
        }
      }
      for (const p of players) {
        if (enemies.includes(e) && dist2(p.x, p.y, e.x, e.y) < (e.r + 20) ** 2) {
          if (!p.shield) {
            explode(e.x, e.y, e.color);
            enemies.splice(ei, 1);
            loseLife();
          }
        }
      }
    }

    // Boss Collisions
    if (boss) {
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (b.x > boss.x - boss.w/2 && b.x < boss.x + boss.w/2 && b.y > boss.y - boss.h/2 && b.y < boss.y + boss.h/2) {
          bullets.splice(bi, 1);
          boss.hp--;
          if (boss.hp <= 0) {
            explode(boss.x, boss.y, boss.color, true);
            addScore(500 * S.level);
            S.level++;
            boss = null;
            setTimeout(spawnBoss, 2000); // next boss
          }
        }
      }
      for (const p of players) {
        if (p.x > boss.x - boss.w/2 && p.x < boss.x + boss.w/2 && p.y > boss.y - boss.h/2 && p.y < boss.y + boss.h/2) {
          if (!p.shield) { loseLife(); p.shield = true; p.shieldTimer = 1.0; } // iframe
        }
      }
    }

    // Enemy Bullets Collisions
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
      const b = enemyBullets[bi];
      for (const p of players) {
        if (dist2(p.x, p.y, b.x, b.y) < (b.r + 15)**2) {
          enemyBullets.splice(bi, 1);
          if (!p.shield) {
            loseLife();
            p.shield = true; p.shieldTimer = 1.0; // iframe
          }
          break;
        }
      }
    }
  }

  // ── Actions ────────────────────────────────────────────────
  function applyAction(p, action, dt, isKeyboard = false) {
    const spd = p.speed * (p.boostActive ? 2 : 1);

    if (isKeyboard) {
      if (action === 'move_left') p.targetX -= spd * dt;
      if (action === 'move_right') p.targetX += spd * dt;
      if (action === 'jump') p.targetY -= spd * dt;
      if (action === 'move_down') p.targetY += spd * dt;
    }

    switch (action) {
      case 'rapid_fire':
        if (p.shootCooldown <= 0) {
          spawnBullet(p, true);
          p.shootCooldown = 0.12;
        }
        break;
      case 'shield':
        if(!p.shield) {
           p.shield = true;
           p.shieldTimer = 0.8;
        }
        break;
      case 'boost':
        if(!p.boostActive) {
           p.boostActive = true;
           setTimeout(() => p.boostActive = false, 600);
        }
        break;
      case 'bomb':
        if (p.shootCooldown <= 0) {
           p.shootCooldown = 2.0; 
           explode(p.x, p.y, '#ffffff', true);
           for (const e of enemies) {
              explode(e.x, e.y, e.color);
              addScore(10 * S.level);
           }
           enemies = [];
           if (boss) {
             boss.hp -= 20;
             if (boss.hp <= 0) {
               explode(boss.x, boss.y, boss.color, true);
               addScore(500 * S.level);
               S.level++; boss = null;
               setTimeout(spawnBoss, 2000);
             }
           }
        }
        break;
    }
  }

  // ── Scoring / Lives ────────────────────────────────────────
  function addScore(n) {
    S.score += n;
    document.getElementById('score').textContent = S.score;
    if (currentMode !== 'boss') {
      S.level = 1 + Math.floor(S.score / 150);
      document.getElementById('level').textContent = S.level;
      enemyInterval = Math.max(400, 1400 - S.level * 80);
    } else {
      document.getElementById('level').textContent = S.level;
    }
  }

  function loseLife() {
    S.lives = Math.max(0, S.lives - 1);
    document.getElementById('lives').textContent = '❤️'.repeat(S.lives) || '💀';
    if (S.lives === 0) endGame();
  }

  // ── Game Loop ──────────────────────────────────────────────
  function loop(ts) {
    if (state !== 'playing') return;
    animId     = requestAnimationFrame(loop);
    const dt   = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime   = ts;

    // Mode specific logic
    if (currentMode === 'timed') {
      S.timeLeft -= dt;
      document.getElementById('time').textContent = Math.max(0, S.timeLeft).toFixed(1) + 's';
      if (S.timeLeft <= 0) {
        endGame();
        return;
      }
    }

    // Background
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars(dt);

    if (currentMode === 'boss') {
      updateAndDrawBoss(dt);
      drawEnemyBullets(dt);
    } else {
      enemyTimer += dt * 1000;
      if (enemyTimer >= enemyInterval) { spawnEnemy(); enemyTimer = 0; }
      drawEnemies(dt);
    }

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      p.shootCooldown = Math.max(0, p.shootCooldown - dt);
      
      if (p.shieldTimer > 0) {
        p.shieldTimer -= dt;
        if (p.shieldTimer <= 0) p.shield = false;
      }
      
      const action = S.currentActions[i] || 'none';
      if (action === 'pause') {
        togglePause();
        return;
      }
      
      const isKeyboard = S.currentGestures[i] === 'keyboard';
      applyAction(p, action, dt, isKeyboard);
      
      // Auto Shoot!
      if (p.shootCooldown <= 0 && action !== 'rapid_fire') {
         spawnBullet(p, false);
         p.shootCooldown = 0.3; // standard fire rate
      }
      
      // Smooth movement tracking
      p.x += (p.targetX - p.x) * 12 * dt;
      p.y += (p.targetY - p.y) * 12 * dt;
      
      // Clamping
      p.targetX = clamp(p.targetX, p.w / 2, canvas.width - p.w / 2);
      p.targetY = clamp(p.targetY, 40, canvas.height - 20);
      p.x = clamp(p.x, p.w / 2, canvas.width - p.w / 2);
      p.y = clamp(p.y, 40, canvas.height - 20);
    }

    drawBullets(dt);
    drawParticles(dt);
    drawPlayers();
    checkCollisions();
  }

  // ── Controls ───────────────────────────────────────────────
  function setGestures(gestures, landmarksArray) {
    S.currentGestures = gestures;
    S.currentActions = gestures.map(g => GestureDetector.toGameAction(g).action);
    
    // Hand tracking positional movement
    if (state === 'playing' && landmarksArray) {
      for (let i = 0; i < Math.min(players.length, landmarksArray.length); i++) {
        const hand = landmarksArray[i];
        // Use the index finger MCP joint (landmark 5) as the tracking point
        const pt = hand[5] || hand[0];
        // Flip the X coordinate so the ship follows the hand on the mirrored screen
        players[i].targetX = (1 - pt.x) * canvas.width;
        players[i].targetY = pt.y * canvas.height;
      }
    }
    
    if (state === 'paused' && S.currentActions.some(a => ['move_left', 'move_right', 'jump', 'move_down'].includes(a))) {
      togglePause();
    }

    const el = document.getElementById('gesture-label');
    const displayGestures = gestures.map((g, i) => {
      const label = GestureDetector.toGameAction(g).label;
      return label ? `P${i+1} ${label}` : '';
    }).filter(Boolean);
    
    el.textContent = displayGestures.join(' | ') || 'No Hand Detected';
    el.style.color = displayGestures.length ? 'var(--accent)' : 'var(--muted)';
    
    if (state === 'playing' && gestures.length > players.length) {
       for (let i = players.length; i < gestures.length && i < 2; i++) {
           players.push(createPlayers()[i]);
       }
    }
  }

  // ── State Machine ──────────────────────────────────────────
  function startGame(mode = 'endless') {
    currentMode = mode;
    S.score  = 0;
    S.level  = 1;
    S.lives  = 3;
    S.timeLeft = mode === 'timed' ? 60 : 1;
    
    document.getElementById('score').textContent = '0';
    document.getElementById('level').textContent = '1';
    document.getElementById('lives').textContent = '❤️❤️❤️';
    document.getElementById('time').textContent = mode === 'timed' ? '60.0s' : '∞';

    players = createPlayers();
    if (S.currentGestures.length > 0) {
      players = players.slice(0, Math.max(1, S.currentGestures.length));
    } else {
      players = players.slice(0, 1);
    }

    bullets = []; enemies = []; particles = []; enemyBullets = [];
    boss = null; enemyTimer = 0;

    if (mode === 'boss') spawnBoss();

    hideOverlay();
    document.getElementById('leaderboard').classList.add('hidden');
    state    = 'playing';
    lastTime = performance.now();
    animId   = requestAnimationFrame(loop);
  }

  function endGame() {
    state = 'gameover';
    cancelAnimationFrame(animId);
    saveScore(S.score);
    renderLeaderboard();
    showOverlay('GAME OVER', `Final Score: ${S.score}`, 'Play Again');
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      cancelAnimationFrame(animId);
      showOverlay('PAUSED', 'Make a fist or open palm to resume', 'Resume');
    } else if (state === 'paused') {
      hideOverlay();
      state    = 'playing';
      lastTime = performance.now();
      animId   = requestAnimationFrame(loop);
    }
  }

  function showOverlay(title, sub, btn) {
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-sub').textContent   = sub;
    document.getElementById('start-btn').textContent     = btn;
    document.getElementById('overlay-screen').classList.remove('hidden');
  }
  function hideOverlay() {
    document.getElementById('overlay-screen').classList.add('hidden');
  }

  function bindKeyboard() {
    const keyMap = {
      // Player 1
      ArrowLeft:  { p: 0, a: 'move_left' },
      ArrowRight: { p: 0, a: 'move_right' },
      ArrowUp:    { p: 0, a: 'jump' },
      ArrowDown:  { p: 0, a: 'move_down' },
      Space:      { p: 0, a: 'rapid_fire' },
      Slash:      { p: 0, a: 'rapid_fire' },
      Period:     { p: 0, a: 'shield' },
      Comma:      { p: 0, a: 'boost' },
      KeyP:       { p: 0, a: 'pause' },
      KeyC:       { p: 0, a: 'bomb' },
      
      // Player 2
      KeyA:       { p: 1, a: 'move_left' },
      KeyD:       { p: 1, a: 'move_right' },
      KeyW:       { p: 1, a: 'jump' },
      KeyS:       { p: 1, a: 'move_down' },
      ShiftLeft:  { p: 1, a: 'rapid_fire' },
      KeyE:       { p: 1, a: 'shield' },
      KeyQ:       { p: 1, a: 'boost' },
    };
    const held = new Set();
    window.addEventListener('keydown', e => {
      const binding = keyMap[e.code];
      if (binding && !held.has(e.code)) {
        held.add(e.code);
        if (state === 'playing' || state === 'paused') {
          S.currentActions[binding.p] = binding.a;
          S.currentGestures[binding.p] = 'keyboard';
          
          if (state === 'paused' && ['move_left', 'move_right', 'jump', 'move_down'].includes(binding.a)) {
            togglePause();
          }
          
          if (binding.p === 1 && players.length === 1 && state === 'playing') {
             players.push(createPlayers()[1]);
          }
        }
      }
    });
    window.addEventListener('keyup', e => {
      held.delete(e.code);
      const binding = keyMap[e.code];
      if (binding) {
        let stillHeld = false;
        for (let code of held) {
          if (keyMap[code] && keyMap[code].p === binding.p) {
            S.currentActions[binding.p] = keyMap[code].a;
            stillHeld = true;
            break;
          }
        }
        if (!stillHeld) S.currentActions[binding.p] = 'none';
      }
    });
  }

  // ── Utilities ──────────────────────────────────────────────
  function dist2(x1, y1, x2, y2) { return (x1-x2)**2 + (y1-y2)**2; }
  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  const COLORS = ['#ff4faa','#ff6b35','#ffe066','#4fffb0','#4fc3ff','#c57bff'];
  function randColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

  return { init, startGame, setGestures, bindKeyboard, getState: () => state };
})();
