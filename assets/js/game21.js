/* ── game21.js — 에임 트레이너 ── */

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const scoreEl  = document.getElementById('scoreEl');
const timerEl  = document.getElementById('timerEl');
const comboEl  = document.getElementById('comboEl');
const accEl    = document.getElementById('accEl');
const overlay  = document.getElementById('overlay');
const ovTitle  = document.getElementById('ovTitle');
const ovMsg    = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const bestInfo = document.getElementById('bestInfo');

/* ── 타깃 설정 ── */
const TARGET_LIFETIME = 1800; // ms
const MAX_TARGETS     = 4;
const MIN_R = 14, MAX_R = 36;
const MARGIN = 50;

/* ── 상태 ── */
let targets, particles, popups;
let score, combo, maxCombo, hits, totalClicks;
let gameRunning, startTime, timerInterval, animId;
let best = parseInt(localStorage.getItem('aim_best') || '0');

if (best > 0) bestInfo.textContent = `최고기록: ${best.toLocaleString()}`;

/* ── 타깃 ── */
function createTarget() {
  const r   = MIN_R + Math.random() * (MAX_R - MIN_R);
  const x   = MARGIN + r + Math.random() * (W - 2*(MARGIN+r));
  const y   = MARGIN + r + Math.random() * (H - 2*(MARGIN+r));
  return { x, y, r, born: performance.now(), hit: false };
}

function spawnTarget() {
  if (targets.length < MAX_TARGETS) targets.push(createTarget());
}

/* ── 파티클 ── */
function addHitParticles(x, y, big) {
  const count = big ? 16 : 10;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI*2*i/count) + Math.random()*0.4;
    const spd = Math.random()*4+2;
    particles.push({ x, y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
      r:Math.random()*5+2, life:1, decay:Math.random()*0.05+0.04,
      color:['#06b6d4','#a78bfa','#f59e0b','#ec4899'][Math.floor(Math.random()*4)] });
  }
}

/* ── 점수 팝업 ── */
function addPopup(x, y, text, color) {
  popups.push({ x, y, text, color, vy: -1.5, life: 1, decay: 0.04 });
}

/* ── 렌더링 ── */
function draw() {
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);

  /* 배경 그리드 */
  ctx.strokeStyle = 'rgba(124,58,237,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  const now = performance.now();

  /* 타깃 */
  targets.forEach(t => {
    if (t.hit) return;
    const age    = now - t.born;
    const frac   = age / TARGET_LIFETIME;         // 0→1
    const alpha  = Math.min(1, (1-frac) * 2 + 0.1);
    const pulsed = t.r * (1 + Math.sin(age*0.007)*0.06);

    /* 남은 시간 링 */
    ctx.save();
    ctx.globalAlpha = 0.3 * (1 - frac);
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r + 8, -Math.PI/2, -Math.PI/2 + Math.PI*2*(1-frac));
    ctx.stroke();
    ctx.restore();

    /* outer ring */
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.shadowBlur = 20; ctx.shadowColor = '#06b6d4';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, pulsed + 6, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();

    /* main circle */
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 14; ctx.shadowColor = '#06b6d4';
    const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, pulsed);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.3, '#67e8f9');
    g.addColorStop(0.7, '#06b6d4');
    g.addColorStop(1, '#0e7490');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(t.x, t.y, pulsed, 0, Math.PI*2);
    ctx.fill();

    /* crosshair */
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    const cl = pulsed * 0.4;
    ctx.beginPath(); ctx.moveTo(t.x-cl, t.y); ctx.lineTo(t.x+cl, t.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(t.x, t.y-cl); ctx.lineTo(t.x, t.y+cl); ctx.stroke();
    ctx.restore();
  });

  /* 파티클 */
  particles = particles.filter(p => {
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life-=p.decay; p.r*=0.94;
    if (p.life<=0) return false;
    ctx.globalAlpha = p.life;
    const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r);
    g.addColorStop(0,'#fff'); g.addColorStop(0.4,p.color); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
    return true;
  });

  /* 팝업 */
  popups = popups.filter(p => {
    p.y += p.vy; p.life -= p.decay;
    if (p.life <= 0) return false;
    ctx.globalAlpha = p.life;
    ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = p.color; ctx.shadowBlur = 6; ctx.shadowColor = p.color;
    ctx.fillText(p.text, p.x, p.y);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    return true;
  });
}

/* ── 게임 루프 ── */
function loop() {
  if (!gameRunning) return;

  /* 만료된 타깃 제거 → 미스 */
  const now = performance.now();
  targets = targets.filter(t => {
    if (t.hit) return false;
    if (now - t.born > TARGET_LIFETIME) {
      combo = 0; comboEl.textContent = 0;
      return false;
    }
    return true;
  });

  /* 새 타깃 스폰 */
  if (Math.random() < 0.04 && targets.length < MAX_TARGETS) spawnTarget();

  draw();

  /* 정확도 업데이트 */
  if (totalClicks > 0) {
    accEl.textContent = Math.round((hits / totalClicks) * 100) + '%';
  }

  animId = requestAnimationFrame(loop);
}

/* ── 클릭 처리 ── */
function handleClick(cx, cy) {
  if (!gameRunning) return;
  totalClicks++;

  const rect  = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = cx * scaleX, y = cy * scaleY;

  let hit = false;
  targets.forEach(t => {
    if (t.hit) return;
    const dx = x - t.x, dy = y - t.y;
    if (dx*dx + dy*dy <= t.r*t.r) {
      t.hit = true; hit = true;
      hits++;
      combo++;
      maxCombo = Math.max(maxCombo, combo);

      const age    = performance.now() - t.born;
      const speed  = Math.max(100, 1000 - age);
      const sizeBonus = Math.round((1 - (t.r - MIN_R)/(MAX_R - MIN_R)) * 100);
      const pts    = Math.round(speed * 0.5 + sizeBonus + combo * 15);

      score += pts;
      scoreEl.textContent  = score.toLocaleString();
      comboEl.textContent  = combo;

      const label = combo >= 10 ? `🔥 ${pts}` : combo >= 5 ? `⚡ ${pts}` : `+${pts}`;
      const col   = combo >= 10 ? '#f59e0b' : combo >= 5 ? '#06b6d4' : '#a78bfa';
      addPopup(t.x, t.y - t.r - 10, label, col);
      addHitParticles(t.x, t.y, combo >= 5);
    }
  });

  if (!hit) {
    combo = 0; comboEl.textContent = 0;
    addHitParticles(x, y, false);
  }
}

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  handleClick(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const t = e.changedTouches[0];
  handleClick(t.clientX - rect.left, t.clientY - rect.top);
}, { passive: false });

/* ── 시작 / 종료 ── */
function startGame() {
  if (animId) cancelAnimationFrame(animId);
  clearInterval(timerInterval);

  targets = []; particles = []; popups = [];
  score = 0; combo = 0; maxCombo = 0; hits = 0; totalClicks = 0;
  gameRunning = true;

  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  accEl.textContent   = '—';
  overlay.style.display = 'none';

  let timeLeft = 30;
  timerEl.textContent = timeLeft;

  /* 초기 타깃 몇 개 스폰 */
  for (let i = 0; i < 2; i++) targets.push(createTarget());

  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  startTime = performance.now();
  animId = requestAnimationFrame(loop);
}

function endGame() {
  gameRunning = false;
  clearInterval(timerInterval);
  cancelAnimationFrame(animId);

  if (score > best) { best = score; localStorage.setItem('aim_best', best); }
  bestInfo.textContent = `최고기록: ${best.toLocaleString()}`;

  const acc = totalClicks > 0 ? Math.round((hits/totalClicks)*100) : 0;

  ovTitle.textContent = '결과';
  ovMsg.innerHTML =
    `점수: <strong>${score.toLocaleString()}</strong><br>` +
    `적중률: <strong>${acc}%</strong> &nbsp; 최고콤보: <strong>${maxCombo}</strong><br>` +
    `히트: <strong>${hits}</strong> / 총 클릭: <strong>${totalClicks}</strong>`;
  startBtn.textContent = '다시 하기';
  overlay.style.display = 'flex';
}

startBtn.addEventListener('click', startGame);
