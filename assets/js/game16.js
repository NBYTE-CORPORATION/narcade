/* ── Space Shooter — game16.js ── */
(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const overlay  = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const ovTitle  = document.getElementById('ovTitle');
  const ovMsg    = document.getElementById('ovMsg');
  const scoreEl  = document.getElementById('scoreEl');
  const waveEl   = document.getElementById('waveEl');
  const livesEl  = document.getElementById('livesEl');
  const bestEl   = document.getElementById('bestEl');

  let best = parseInt(localStorage.getItem('shooter_best') || '0');
  bestEl.textContent = best;

  // ── State ──
  let running = false, raf = null;
  let score, wave, lives, invincible, invTimer, shieldTimer;
  let player, bullets, enemies, particles, powerups;
  let stars = [];
  let fireTimer = 0;
  let waveClearing = false;
  let waveDelay = 0;

  // ── Keys / touch ──
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.key] = true; });
  window.addEventListener('keyup',   e => { keys[e.key] = false; });

  // Touch drag
  let touchX = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchX = e.touches[0].clientX;
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (touchX === null) return;
    const dx = e.touches[0].clientX - touchX;
    touchX = e.touches[0].clientX;
    if (player) player.x = Math.max(20, Math.min(W - 20, player.x + dx));
  }, { passive: false });
  canvas.addEventListener('touchend', () => { touchX = null; });

  // ── Utility ──
  function lightenColor(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    const r = Math.min(255, (num >> 16) + amt);
    const g = Math.min(255, ((num >> 8) & 0xff) + amt);
    const b = Math.min(255, (num & 0xff) + amt);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function rnd(min, max) { return Math.random() * (max - min) + min; }
  function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }

  // ── Stars ──
  function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: rnd(0, W), y: rnd(0, H),
        r: rnd(0.5, 2),
        speed: rnd(0.3, 1.2),
        alpha: rnd(0.3, 1)
      });
    }
  }

  function updateStars() {
    stars.forEach(s => {
      s.y += s.speed;
      if (s.y > H) { s.y = 0; s.x = rnd(0, W); }
    });
  }

  function drawStars() {
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
      ctx.fill();
    });
  }

  // ── Player ──
  function createPlayer() {
    return { x: W / 2, y: H - 60, r: 18, speed: 5, hasShield: false };
  }

  function drawPlayer() {
    const p = player;
    const blink = invincible && Math.floor(invTimer / 6) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Glow
    if (p.hasShield) {
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6,182,212,0.5)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Engine flame
    const flameGrad = ctx.createLinearGradient(0, 8, 0, 28);
    flameGrad.addColorStop(0, '#f59e0b');
    flameGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.moveTo(-7, 10);
    ctx.lineTo(0, 28);
    ctx.lineTo(7, 10);
    ctx.fillStyle = flameGrad;
    ctx.fill();

    // Ship body gradient
    const grad = ctx.createLinearGradient(-18, -18, 18, 18);
    grad.addColorStop(0, '#a78bfa');
    grad.addColorStop(1, '#7c3aed');
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(18, 12);
    ctx.lineTo(10, 8);
    ctx.lineTo(0, 14);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.shadowColor = '#7c3aed';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -4, 5, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,182,212,0.8)';
    ctx.fill();

    ctx.restore();
  }

  // ── Bullets ──
  function fireBullets() {
    const double = score > 3000;
    if (double) {
      bullets.push({ x: player.x - 8, y: player.y - 20, r: 3, vy: -12, color: '#06b6d4' });
      bullets.push({ x: player.x + 8, y: player.y - 20, r: 3, vy: -12, color: '#06b6d4' });
    } else {
      bullets.push({ x: player.x, y: player.y - 20, r: 3, vy: -12, color: '#06b6d4' });
    }
  }

  function drawBullets() {
    bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = b.color || '#06b6d4';
      ctx.shadowColor = b.color || '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  // ── Enemies ──
  const ENEMY_TYPES = [
    { hp: 1, score: 100, color: '#ef4444', r: 14 },
    { hp: 2, score: 200, color: '#f59e0b', r: 16 },
    { hp: 3, score: 400, color: '#ec4899', r: 18 }
  ];

  function hexPath(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      i === 0 ? ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a))
               : ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    ctx.closePath();
  }

  function spawnWave() {
    enemies = [];
    const count = Math.min(4 + wave, 10);
    const cols  = Math.min(count, 5);
    const rows  = Math.ceil(count / cols);
    const typeIndex = Math.min(wave - 1, 2);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (enemies.length >= count) break;
        const t = ENEMY_TYPES[Math.min(typeIndex, 2)];
        const pattern = wave < 2 ? 'straight' : wave < 4 ? 'zigzag' : 'dive';
        enemies.push({
          x: 40 + col * ((W - 80) / (cols - 1 || 1)),
          y: -60 - row * 50,
          r: t.r,
          hp: t.hp,
          maxHp: t.hp,
          score: t.score,
          color: t.color,
          pattern: pattern,
          vy: 1.2 + wave * 0.15,
          vx: 0,
          zigzagT: Math.random() * Math.PI * 2,
          diveTarget: player ? player.x : W / 2,
          fireTimer: rndInt(60, 180),
          bullets: []
        });
      }
    }
  }

  function updateEnemies() {
    enemies.forEach(e => {
      e.y += e.vy;
      e.zigzagT += 0.04;

      if (e.pattern === 'zigzag') {
        e.x += Math.sin(e.zigzagT) * 2;
        e.x = Math.max(e.r, Math.min(W - e.r, e.x));
      } else if (e.pattern === 'dive') {
        const dx = player.x - e.x;
        e.x += dx * 0.015;
      }

      // Enemy shooting
      if (wave >= 2) {
        e.fireTimer--;
        if (e.fireTimer <= 0) {
          e.fireTimer = rndInt(80, 200);
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          e.bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3 });
        }
      }

      // Update enemy bullets
      e.bullets = e.bullets.filter(b => {
        b.x += b.vx;
        b.y += b.vy;
        return b.y < H + 10 && b.x > -10 && b.x < W + 10;
      });
    });
  }

  function drawEnemies() {
    enemies.forEach(e => {
      ctx.save();
      hexPath(ctx, e.x, e.y, e.r);
      const grad = ctx.createRadialGradient(e.x, e.y - 4, 2, e.x, e.y, e.r);
      grad.addColorStop(0, lightenColor(e.color, 60));
      grad.addColorStop(1, e.color);
      ctx.fillStyle = grad;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.strokeStyle = lightenColor(e.color, 80);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // HP bar
      if (e.maxHp > 1) {
        const bw = e.r * 2;
        const bh = 3;
        const bx = e.x - e.r;
        const by = e.y + e.r + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = e.color;
        ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
      }

      // Enemy bullets
      e.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      ctx.restore();
    });
  }

  // ── Particles ──
  function spawnExplosion(x, y, color) {
    const count = rndInt(12, 16);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + rnd(-0.3, 0.3);
      const speed = rnd(1.5, 5);
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: rnd(2, 5),
        color,
        alpha: 1,
        life: rnd(0.6, 1)
      });
    }
  }

  function updateParticles() {
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha -= 0.025 / p.life;
      return p.alpha > 0;
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
    });
  }

  // ── Power-ups ──
  function trySpawnPowerup(x, y) {
    if (Math.random() < 0.12) {
      const type = Math.random() < 0.5 ? 'shield' : 'score';
      powerups.push({
        x, y,
        vy: 1.5,
        r: 10,
        type,
        color: type === 'shield' ? '#06b6d4' : '#f59e0b',
        t: 0
      });
    }
  }

  function updatePowerups() {
    powerups = powerups.filter(p => {
      p.y += p.vy;
      p.t++;
      return p.y < H + 20;
    });
  }

  function drawPowerups() {
    powerups.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 0.04);
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + '33';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.type === 'shield' ? '#06b6d4' : '#f59e0b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.type === 'shield' ? '🛡' : '⭐', 0, 0);
      ctx.restore();
    });
  }

  // ── HUD update ──
  function updateHUD() {
    scoreEl.textContent = score;
    waveEl.textContent  = wave;
    livesEl.textContent = '❤️'.repeat(Math.max(0, lives));
    bestEl.textContent  = best;
  }

  // ── Collision ──
  function checkCollisions() {
    // Player bullets vs enemies
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (dist(b, e) < b.r + e.r) {
          bullets.splice(bi, 1);
          e.hp--;
          spawnExplosion(b.x, b.y, e.color);
          if (e.hp <= 0) {
            score += e.score;
            spawnExplosion(e.x, e.y, e.color);
            trySpawnPowerup(e.x, e.y);
            enemies.splice(ei, 1);
          }
          break;
        }
      }
    }

    // Enemy bullets vs player
    if (!invincible) {
      for (let ei = 0; ei < enemies.length; ei++) {
        const e = enemies[ei];
        for (let bi = e.bullets.length - 1; bi >= 0; bi--) {
          const b = e.bullets[bi];
          if (dist(b, player) < 3 + player.r) {
            e.bullets.splice(bi, 1);
            hitPlayer();
          }
        }
      }
    }

    // Enemies vs player (ram)
    if (!invincible) {
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (dist(e, player) < e.r + player.r) {
          spawnExplosion(e.x, e.y, e.color);
          enemies.splice(ei, 1);
          hitPlayer();
        }
      }
    }

    // Enemies past bottom
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      if (enemies[ei].y > H + 40) {
        enemies.splice(ei, 1);
      }
    }

    // Power-ups vs player
    for (let pi = powerups.length - 1; pi >= 0; pi--) {
      const p = powerups[pi];
      if (dist(p, player) < p.r + player.r) {
        if (p.type === 'shield') {
          player.hasShield = true;
          shieldTimer = 400;
        } else {
          score += 500;
        }
        powerups.splice(pi, 1);
      }
    }
  }

  function hitPlayer() {
    if (player.hasShield) {
      player.hasShield = false;
      shieldTimer = 0;
      return;
    }
    spawnExplosion(player.x, player.y, '#a78bfa');
    lives--;
    invincible = true;
    invTimer = 80;
    updateHUD();
    if (lives <= 0) endGame();
  }

  // ── Game loop ──
  function update() {
    if (!running) return;

    // Player movement
    const speed = player.speed;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += speed;
    player.x = Math.max(20, Math.min(W - 20, player.x));

    // Auto-fire
    fireTimer++;
    if (fireTimer >= 14) { // ~220ms at 60fps
      fireBullets();
      fireTimer = 0;
    }

    // Invincibility
    if (invincible) {
      invTimer--;
      if (invTimer <= 0) invincible = false;
    }

    // Shield timer
    if (player.hasShield) {
      shieldTimer--;
      if (shieldTimer <= 0) player.hasShield = false;
    }

    // Wave delay
    if (waveDelay > 0) {
      waveDelay--;
      if (waveDelay === 0) spawnWave();
    }

    // Update bullets
    bullets = bullets.filter(b => {
      b.y += b.vy;
      return b.y > -10;
    });

    updateStars();
    updateEnemies();
    updateParticles();
    updatePowerups();
    checkCollisions();

    // Wave clear
    if (enemies.length === 0 && waveDelay === 0 && !waveClearing) {
      waveClearing = true;
      wave++;
      waveDelay = 90;
      waveClearing = false;
      updateHUD();
    }

    updateHUD();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, W, H);

    drawStars();
    drawParticles();
    drawPowerups();
    drawEnemies();
    drawBullets();
    drawPlayer();
  }

  function loop() {
    update();
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  // ── Start / End ──
  function startGame() {
    score = 0; wave = 1; lives = 3;
    invincible = false; invTimer = 0; shieldTimer = 0;
    bullets = []; particles = []; powerups = [];
    waveDelay = 0; waveClearing = false; fireTimer = 0;
    player = createPlayer();
    initStars();
    spawnWave();
    updateHUD();
    overlay.classList.add('hidden');
    running = true;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem('shooter_best', best);
      bestEl.textContent = best;
    }
    ovTitle.textContent = '게임 오버';
    ovMsg.innerHTML = `
      <div class="ov-score">${score.toLocaleString()}</div>
      <div class="ov-sub">Wave ${wave} 도달 · 최고기록 ${best.toLocaleString()}</div>
    `;
    startBtn.textContent = '다시 하기';
    overlay.classList.remove('hidden');
  }

  startBtn.addEventListener('click', startGame);

  // Initial star draw
  initStars();
  draw();
})();
