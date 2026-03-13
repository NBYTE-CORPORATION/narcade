/* ── game15.js — 벽돌 깨기 ── */

const canvas = document.getElementById('breakoutCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

/* ── UI 요소 ── */
const scoreEl  = document.getElementById('score');
const levelEl  = document.getElementById('level');
const livesEl  = document.getElementById('lives');
const bestEl   = document.getElementById('best');
const overlay  = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMsg   = document.getElementById('overlayMsg');
const startBtn     = document.getElementById('startBtn');

/* ── 벽돌 설정 ── */
const BRICK_COLS   = 8;
const BRICK_ROWS   = 6;
const BRICK_W      = 52;
const BRICK_H      = 20;
const BRICK_PAD    = 5;
const BRICK_OFFSET_X = (W - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;
const BRICK_OFFSET_Y = 50;

/* ── 레벨별 벽돌 색상 & 내구도 ── */
const ROW_DEFS = [
  { color: '#ef4444', hp: 3 }, // 빨강 (3hit)
  { color: '#f97316', hp: 2 }, // 주황 (2hit)
  { color: '#f59e0b', hp: 2 }, // 노랑 (2hit)
  { color: '#10b981', hp: 1 }, // 초록 (1hit)
  { color: '#06b6d4', hp: 1 }, // 청록 (1hit)
  { color: '#a78bfa', hp: 1 }, // 보라 (1hit)
];

/* ── 파티클 ── */
let particles = [];

function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1,
      r: 2 + Math.random() * 3,
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => p.alpha > 0.02);
  particles.forEach(p => {
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.08; // 중력
    p.alpha -= 0.025;
    p.r    *= 0.97;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/* ── 게임 상태 ── */
let paddle, balls, bricks;
let score, lives, level, bestScore;
let gameRunning = false;
let animId;
let mouseX = W / 2;

/* ── 초기화 ── */
function createPaddle() {
  const pw = 80 + Math.max(0, (3 - level) * 10);
  return { x: W / 2 - pw / 2, y: H - 30, w: pw, h: 12 };
}

function createBalls() {
  const speed = 4 + (level - 1) * 0.5;
  return [{
    x: W / 2, y: H - 50,
    vx: (Math.random() > 0.5 ? 1 : -1) * speed * 0.7,
    vy: -speed,
    r: 8,
    trail: [],
  }];
}

function createBricks() {
  const bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    const def = ROW_DEFS[r];
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x:   BRICK_OFFSET_X + c * (BRICK_W + BRICK_PAD),
        y:   BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD),
        w:   BRICK_W,
        h:   BRICK_H,
        color: def.color,
        hp:   def.hp + (level > 2 ? 1 : 0),
        maxHp: def.hp + (level > 2 ? 1 : 0),
        alive: true,
      });
    }
  }
  return bricks;
}

function startGame() {
  if (animId) cancelAnimationFrame(animId);
  particles = [];
  bestScore = parseInt(localStorage.getItem('breakout_best') || '0');

  score = 0;
  lives = 3;
  level = 1;

  paddle     = createPaddle();
  balls      = createBalls();
  bricks     = createBricks();
  gameRunning = true;

  updateUI();
  overlay.style.display = 'none';
  animId = requestAnimationFrame(gameLoop);
}

function updateUI() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  livesEl.textContent = '❤️'.repeat(lives) || '💀';
  bestEl.textContent  = bestScore;
}

/* ── 충돌 판정 ── */
function ballBrickCollision(ball) {
  for (const b of bricks) {
    if (!b.alive) continue;
    if (ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w) continue;
    if (ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h) continue;

    // 어느 면에 충돌했는지 판단
    const overlapL = (ball.x + ball.r) - b.x;
    const overlapR = (b.x + b.w) - (ball.x - ball.r);
    const overlapT = (ball.y + ball.r) - b.y;
    const overlapB = (b.y + b.h) - (ball.y - ball.r);
    const minH = Math.min(overlapL, overlapR);
    const minV = Math.min(overlapT, overlapB);

    if (minH < minV) {
      ball.vx = -ball.vx;
    } else {
      ball.vy = -ball.vy;
    }

    b.hp--;
    if (b.hp <= 0) {
      b.alive = false;
      const pts = b.maxHp * 10 * level;
      score += pts;
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 14);
      showFloatingScore(b.x + b.w / 2, b.y + b.h / 2, pts);
    } else {
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color, 5);
    }

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('breakout_best', bestScore);
    }
    updateUI();
    break;
  }
}

/* ── 플로팅 점수 ── */
let floatingScores = [];
function showFloatingScore(x, y, pts) {
  floatingScores.push({ x, y, pts, alpha: 1, vy: -1 });
}

/* ── 공 업데이트 ── */
function updateBall(ball) {
  // 트레일
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 10) ball.trail.shift();

  ball.x += ball.vx;
  ball.y += ball.vy;

  // 벽 반사
  if (ball.x - ball.r < 0)  { ball.x = ball.r;      ball.vx = Math.abs(ball.vx);  }
  if (ball.x + ball.r > W)  { ball.x = W - ball.r;  ball.vx = -Math.abs(ball.vx); }
  if (ball.y - ball.r < 0)  { ball.y = ball.r;      ball.vy = Math.abs(ball.vy);  }

  // 패들 충돌
  if (
    ball.vy > 0 &&
    ball.y + ball.r >= paddle.y &&
    ball.y + ball.r <= paddle.y + paddle.h + 6 &&
    ball.x >= paddle.x - ball.r &&
    ball.x <= paddle.x + paddle.w + ball.r
  ) {
    const hitPos = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1 ~ 1
    const angle  = hitPos * (Math.PI / 3); // 최대 60도
    const speed  = Math.hypot(ball.vx, ball.vy);
    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));
    ball.y  = paddle.y - ball.r;
  }
}

/* ── 메인 루프 ── */
function gameLoop() {
  update();
  draw();
  animId = requestAnimationFrame(gameLoop);
}

function update() {
  if (!gameRunning) return;

  // 패들 이동 (마우스/터치 따라가기)
  const target = mouseX - paddle.w / 2;
  paddle.x += (target - paddle.x) * 0.18;
  paddle.x  = Math.max(0, Math.min(W - paddle.w, paddle.x));

  // 공 업데이트
  balls.forEach(updateBall);

  // 벽돌 충돌
  balls.forEach(ballBrickCollision);

  // 공 아래로 빠짐
  balls = balls.filter(ball => {
    if (ball.y - ball.r > H) {
      spawnParticles(ball.x, H - 10, '#ef4444', 16);
      return false;
    }
    return true;
  });

  if (balls.length === 0) {
    lives--;
    updateUI();
    if (lives <= 0) {
      endGame(false);
    } else {
      balls = createBalls();
    }
  }

  // 파티클
  updateParticles();

  // 플로팅 점수
  floatingScores = floatingScores.filter(f => f.alpha > 0.02);
  floatingScores.forEach(f => { f.y += f.vy; f.alpha -= 0.022; });

  // 모든 벽돌 클리어 → 다음 레벨
  if (bricks.every(b => !b.alive)) {
    level++;
    levelEl.textContent = level;
    paddle = createPaddle();
    balls  = createBalls();
    bricks = createBricks();
    particles = [];
  }
}

function draw() {
  /* 배경 */
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);

  /* 격자 */
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  /* 벽돌 */
  bricks.forEach(b => {
    if (!b.alive) return;
    const ratio  = b.hp / b.maxHp;
    const grd = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    grd.addColorStop(0, lighten(b.color, 35));
    grd.addColorStop(1, b.color);
    ctx.globalAlpha = 0.5 + ratio * 0.5;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 5);
    ctx.fill();

    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(b.x + 3, b.y + 3, b.w - 6, 4, 3);
    ctx.fill();

    // HP > 1이면 금 테두리
    if (b.hp > 1) {
      ctx.strokeStyle = 'rgba(245,158,11,0.7)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  /* 공 트레일 & 공 */
  balls.forEach(ball => {
    ball.trail.forEach((t, i) => {
      const a = (i / ball.trail.length) * 0.3;
      ctx.globalAlpha = a;
      ctx.fillStyle   = '#ec4899';
      ctx.beginPath();
      ctx.arc(t.x, t.y, ball.r * (i / ball.trail.length) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const grd = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, ball.r);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(0.4, '#f9a8d4');
    grd.addColorStop(1, '#ec4899');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(ball.x - 2.5, ball.y - 2.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  /* 패들 */
  const pg = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y + paddle.h);
  pg.addColorStop(0, '#f9a8d4');
  pg.addColorStop(1, '#ec4899');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.roundRect(paddle.x + 4, paddle.y + 2, paddle.w - 8, 4, 4);
  ctx.fill();

  /* 패들 글로우 */
  ctx.shadowColor  = '#ec4899';
  ctx.shadowBlur   = 18;
  ctx.strokeStyle  = 'rgba(236,72,153,0.6)';
  ctx.lineWidth    = 1;
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 6);
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* 파티클 */
  drawParticles();

  /* 플로팅 점수 */
  floatingScores.forEach(f => {
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle   = '#f59e0b';
    ctx.font        = 'bold 14px system-ui';
    ctx.textAlign   = 'center';
    ctx.fillText(`+${f.pts}`, f.x, f.y);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';

  /* 바닥 위험선 */
  const dangerY = H - 24;
  const grad = ctx.createLinearGradient(0, dangerY, W, dangerY);
  grad.addColorStop(0,   'transparent');
  grad.addColorStop(0.2, 'rgba(239,68,68,0.15)');
  grad.addColorStop(0.8, 'rgba(239,68,68,0.15)');
  grad.addColorStop(1,   'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, dangerY, W, 2);
}

/* ── 종료 ── */
function endGame(win = false) {
  gameRunning = false;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = win ? '클리어! 🎉' : '게임 오버';
  overlayMsg.innerHTML = `점수: <strong>${score}</strong><br>최고기록: <strong>${bestScore}</strong>`;
  startBtn.textContent = '다시 하기';
  overlay.style.display = 'flex';
}

/* ── 유틸 ── */
function lighten(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, (n >> 16)         + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff)        + amt);
  return `rgb(${r},${g},${b})`;
}

/* ── 입력 ── */
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  mouseX = (e.clientX - rect.left) * scaleX;
});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  mouseX = (e.touches[0].clientX - rect.left) * scaleX;
}, { passive: false });

startBtn.addEventListener('click', startGame);

/* ── 초기 최고기록 ── */
bestEl.textContent = localStorage.getItem('breakout_best') || 0;
