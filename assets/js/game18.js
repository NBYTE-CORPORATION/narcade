/* ── game18.js — 리듬 탭 ── */

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const scoreEl  = document.getElementById('scoreEl');
const comboEl  = document.getElementById('comboEl');
const timerEl  = document.getElementById('timerEl');
const overlay  = document.getElementById('overlay');
const ovTitle  = document.getElementById('ovTitle');
const ovMsg    = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const bestInfo = document.getElementById('bestInfo');

/* ── 레인 설정 ── */
const LANE_W    = W / 4;           // 100px
const HIT_Y     = H - 70;          // 히트존 Y
const HIT_H     = 14;              // 히트존 높이
const NOTE_H    = 36;
const NOTE_SPD  = 5.5;             // px/frame
const TRAVEL    = HIT_Y;           // 노트가 이동할 총 거리
const TRAVEL_MS = (TRAVEL / NOTE_SPD) * (1000 / 60); // 화면 끝까지 걸리는 ms

const LANES = [
  { key: 'KeyD',  label: 'D', color: '#06b6d4', glow: 'rgba(6,182,212,0.5)'   },
  { key: 'KeyF',  label: 'F', color: '#a78bfa', glow: 'rgba(167,139,250,0.5)' },
  { key: 'KeyJ',  label: 'J', color: '#ec4899', glow: 'rgba(236,72,153,0.5)'  },
  { key: 'KeyK',  label: 'K', color: '#f59e0b', glow: 'rgba(245,158,11,0.5)'  },
];

/* ── 판정 창 ── */
const PERFECT_MS = 55;
const GOOD_MS    = 110;

/* ── 상태 ── */
let notes, particles, judgments, laneFlash;
let score, combo, maxCombo, perfect, good, miss;
let gameRunning, startTime, endTime;
let animId, spawnTimer, spawnInterval, difficulty;
let perfectCount, goodCount, missCount;

/* ── 노트 패턴 생성 ── */
// 비트에 따라 랜덤 레인에 노트 스폰
const patterns = [
  [0], [1], [2], [3],
  [0,2], [1,3], [0,3], [1,2],
  [0,1], [2,3],
  [0,1,2], [1,2,3],
];

function spawnNotes() {
  const pat = patterns[Math.floor(Math.random() * patterns.length)];
  pat.forEach(laneIdx => {
    notes.push({
      lane: laneIdx,
      y: -NOTE_H,
      spawnTime: performance.now(),
      hit: false,
    });
  });
}

/* ── 파티클 ── */
function addParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + Math.random() * 0.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * (Math.random() * 4 + 1),
      vy: Math.sin(angle) * (Math.random() * 4 + 1) - 1,
      r: Math.random() * 5 + 2,
      color,
      life: 1,
      decay: Math.random() * 0.06 + 0.04,
    });
  }
}

/* ── 판정 팝업 ── */
function addJudgment(lane, text, color) {
  judgments.push({
    x: lane * LANE_W + LANE_W / 2,
    y: HIT_Y - 30,
    text,
    color,
    life: 1,
    vy: -1.2,
  });
}

/* ── 렌더링 ── */
function drawBackground() {
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);

  /* 레인 구분선 */
  for (let i = 1; i < 4; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(i * LANE_W, 0);
    ctx.lineTo(i * LANE_W, H);
    ctx.stroke();
  }

  /* 레인 배경 그라데이션 */
  LANES.forEach((ln, i) => {
    const flash = laneFlash[i];
    if (flash > 0) {
      const grd = ctx.createLinearGradient(i * LANE_W, HIT_Y, i * LANE_W, H);
      grd.addColorStop(0, ln.color + Math.round(flash * 40).toString(16).padStart(2, '0'));
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(i * LANE_W, HIT_Y - 20, LANE_W, H - HIT_Y + 20);
      laneFlash[i] = Math.max(0, flash - 0.08);
    }
  });
}

function drawHitZone() {
  LANES.forEach((ln, i) => {
    const x = i * LANE_W;
    const grd = ctx.createLinearGradient(x, HIT_Y - 2, x + LANE_W, HIT_Y + HIT_H + 2);
    grd.addColorStop(0, ln.color + '99');
    grd.addColorStop(0.5, ln.color + 'ff');
    grd.addColorStop(1, ln.color + '99');

    ctx.shadowBlur = 12;
    ctx.shadowColor = ln.glow;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(x + 6, HIT_Y, LANE_W - 12, HIT_H, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawLaneKeys() {
  LANES.forEach((ln, i) => {
    const cx = i * LANE_W + LANE_W / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(cx - 18, HIT_Y + HIT_H + 10, 36, 36, 9);
    ctx.fill();

    ctx.strokeStyle = ln.color + '55';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx - 18, HIT_Y + HIT_H + 10, 36, 36, 9);
    ctx.stroke();

    ctx.fillStyle = ln.color;
    ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ln.label, cx, HIT_Y + HIT_H + 28);
  });
}

function drawNotes() {
  notes.forEach(n => {
    if (n.hit) return;
    const ln = LANES[n.lane];
    const x = n.lane * LANE_W + 6;
    const w = LANE_W - 12;

    /* glow */
    ctx.shadowBlur = 16;
    ctx.shadowColor = ln.glow;

    /* note body */
    const grd = ctx.createLinearGradient(x, n.y, x, n.y + NOTE_H);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(0.3, ln.color);
    grd.addColorStop(1, ln.color + '88');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(x, n.y, w, NOTE_H, 9);
    ctx.fill();

    /* shine */
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(x + 4, n.y + 4, w - 8, 6, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawParticles() {
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.15;
    p.life -= p.decay; p.r *= 0.95;
    if (p.life <= 0) return false;

    ctx.globalAlpha = p.life;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, p.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return true;
  });
}

function drawJudgments() {
  judgments = judgments.filter(j => {
    j.y += j.vy;
    j.life -= 0.035;
    if (j.life <= 0) return false;

    ctx.globalAlpha = j.life;
    ctx.font = `bold 18px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = j.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = j.color;
    ctx.fillText(j.text, j.x, j.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    return true;
  });
}

function drawProgressBar() {
  if (!startTime) return;
  const elapsed = performance.now() - startTime;
  const total   = 60000;
  const prog    = Math.min(1, elapsed / total);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, H - 6, W, 6);

  const grd = ctx.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, '#7c3aed');
  grd.addColorStop(1, '#06b6d4');
  ctx.fillStyle = grd;
  ctx.fillRect(0, H - 6, W * prog, 6);
}

/* ── 게임 루프 ── */
function loop() {
  const now = performance.now();

  /* 타이머 */
  if (gameRunning && startTime) {
    const elapsed = now - startTime;
    const remain  = Math.max(0, Math.ceil((60000 - elapsed) / 1000));
    timerEl.textContent = remain;
    if (elapsed >= 60000) { endGame(); return; }
  }

  /* 노트 스폰 */
  if (gameRunning && startTime) {
    spawnTimer -= 1;
    if (spawnTimer <= 0) {
      spawnNotes();
      spawnTimer = spawnInterval;
      /* 점점 빨라짐 */
      spawnInterval = Math.max(20, spawnInterval - 0.3);
    }
  }

  /* 그리기 */
  drawBackground();
  drawHitZone();
  drawNotes();
  drawParticles();
  drawJudgments();
  drawLaneKeys();
  drawProgressBar();

  /* 노트 이동 & 미스 체크 */
  notes = notes.filter(n => {
    if (n.hit) return false;
    n.y += NOTE_SPD;
    if (n.y > HIT_Y + HIT_H + 20) {
      /* 미스 */
      miss++;
      missCount++;
      combo = 0;
      comboEl.textContent = 0;
      addJudgment(n.lane, 'MISS', '#ef4444');
      return false;
    }
    return true;
  });

  animId = requestAnimationFrame(loop);
}

/* ── 키 입력 ── */
function handleLanePress(laneIdx) {
  if (!gameRunning || !startTime) return;
  const ln  = LANES[laneIdx];
  laneFlash[laneIdx] = 1;

  const now  = performance.now();
  let   best = null;
  let   bestDist = Infinity;

  notes.forEach(n => {
    if (n.hit || n.lane !== laneIdx) return;
    /* 히트존 중앙까지의 거리를 시간으로 변환 */
    const noteCenter  = n.y + NOTE_H / 2;
    const hitCenter   = HIT_Y + HIT_H / 2;
    const distPx      = Math.abs(noteCenter - hitCenter);
    const distMs      = (distPx / NOTE_SPD) * (1000 / 60);
    if (distMs < bestDist) { bestDist = distMs; best = n; }
  });

  if (!best || bestDist > GOOD_MS * 1.5) {
    /* 빈 탭 — 패널티 없음 */
    return;
  }

  best.hit = true;
  const cx = laneIdx * LANE_W + LANE_W / 2;
  const cy = HIT_Y + HIT_H / 2;

  if (bestDist <= PERFECT_MS) {
    const pts = 300 + Math.floor(combo * 8);
    score += pts;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    perfectCount++;
    addParticles(cx, cy, ln.color, 12);
    addJudgment(laneIdx, '✦ PERFECT', ln.color);
  } else {
    const pts = 150 + Math.floor(combo * 3);
    score += pts;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    goodCount++;
    addParticles(cx, cy, ln.color, 6);
    addJudgment(laneIdx, 'GOOD', '#94a3b8');
  }

  scoreEl.textContent = score.toLocaleString();
  comboEl.textContent = combo;
}

document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  LANES.forEach((ln, i) => {
    if (e.code === ln.key) { e.preventDefault(); handleLanePress(i); }
  });
});

/* 터치 */
canvas.addEventListener('touchstart', e => {
  if (!gameRunning) return;
  Array.from(e.changedTouches).forEach(t => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const tx = (t.clientX - rect.left) * scaleX;
    const laneIdx = Math.floor(tx / LANE_W);
    if (laneIdx >= 0 && laneIdx < 4) handleLanePress(laneIdx);
  });
  e.preventDefault();
}, { passive: false });

/* ── 시작 / 종료 ── */
function startGame() {
  if (animId) cancelAnimationFrame(animId);

  notes = []; particles = []; judgments = [];
  laneFlash = [0, 0, 0, 0];
  score = 0; combo = 0; maxCombo = 0;
  perfectCount = 0; goodCount = 0; missCount = 0;
  spawnTimer = 50;
  spawnInterval = 50;
  startTime = null;
  gameRunning = true;

  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  timerEl.textContent = '60';
  overlay.style.display = 'none';

  /* 3초 카운트다운 후 시작 */
  let count = 3;
  timerEl.textContent = count;

  const cd = setInterval(() => {
    count--;
    if (count > 0) {
      timerEl.textContent = count;
    } else {
      clearInterval(cd);
      timerEl.textContent = '60';
      startTime = performance.now();
      animId = requestAnimationFrame(loop);
    }
  }, 1000);
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animId);

  const best = Math.max(score, parseInt(localStorage.getItem('rhythm_best') || '0'));
  localStorage.setItem('rhythm_best', best);

  const acc = perfectCount + goodCount > 0
    ? Math.round((perfectCount / (perfectCount + goodCount + missCount)) * 100)
    : 0;

  ovTitle.textContent = '결과';
  ovMsg.innerHTML =
    `점수: <strong>${score.toLocaleString()}</strong><br>` +
    `최고콤보: <strong>${maxCombo}</strong> &nbsp;|&nbsp; 정확도: <strong>${acc}%</strong><br>` +
    `✦ Perfect <strong>${perfectCount}</strong> &nbsp; Good <strong>${goodCount}</strong> &nbsp; Miss <strong>${missCount}</strong>`;
  bestInfo.textContent = `최고기록: ${best.toLocaleString()}`;
  startBtn.textContent = '다시 하기';
  overlay.style.display = 'flex';
}

startBtn.addEventListener('click', startGame);

/* 초기 최고기록 */
const savedBest = localStorage.getItem('rhythm_best');
if (savedBest) bestInfo.textContent = `최고기록: ${parseInt(savedBest).toLocaleString()}`;
