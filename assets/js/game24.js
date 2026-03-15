/* ── game24.js — 핀볼 ── */
'use strict';

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovMsg   = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('scoreEl');
const bestEl  = document.getElementById('bestEl');
const ballsEl = document.getElementById('ballsEl');
const multEl  = document.getElementById('multEl');
const bestInfo = document.getElementById('bestInfo');

/* ── 캔버스 크기 ── */
const CW = 360, CH = 640;
canvas.width  = CW;
canvas.height = CH;

/* ── 물리 상수 ── */
const GRAVITY   = 0.30;
const BALL_R    = 9;
const FRICTION  = 0.995;

/* ── 벽 경계 ── */
const LEFT_WALL   = 22;   // 메인 필드 왼쪽
const RIGHT_WALL  = 338;  // 메인 필드 오른쪽
const TOP_WALL    = 44;   // 상단
const LAUNCH_X    = 318;  // 발사 레인 왼쪽 벽
// 발사 레인: LAUNCH_X ~ RIGHT_WALL(338), 공이 위로 올라감

/* ── 플리퍼 설정 ── */
const FLIP = {
  L: { px: 98,  py: 578, restAngle: 28,  activeAngle: -30, dir: -1 },
  R: { px: 262, py: 578, restAngle: 152, activeAngle: 210, dir:  1 },
};
const FLIP_LEN  = 76;
const FLIP_SPEED = 18;  // deg/frame

/* ── 범퍼 ── */
const BUMPERS = [
  { x: 145, y: 175, r: 22, color: '#06b6d4',  pts: 300 },
  { x: 88,  y: 255, r: 18, color: '#f43f5e',  pts: 200 },
  { x: 202, y: 255, r: 18, color: '#f59e0b',  pts: 200 },
  { x: 145, y: 315, r: 20, color: '#a78bfa',  pts: 250 },
];

/* ── 슬링샷 (좌우 대각 킥 벽) ── */
const SLINGS = [
  // 왼쪽 슬링샷
  { x1: LEFT_WALL, y1: 480, x2: 110, y2: 420, pts: 50 },
  // 오른쪽 슬링샷
  { x1: RIGHT_WALL - (LEFT_WALL - 0), y1: 480, x2: LAUNCH_X - 72, y2: 420, pts: 50 },
];
// 실제 x 계산을 더 정확하게
SLINGS[0] = { x1: LEFT_WALL, y1: 490, x2: 112, y2: 422, pts: 50 };
SLINGS[1] = { x1: LAUNCH_X - 4, y1: 490, x2: 248, y2: 422, pts: 50 };

/* ── 목표물 (드롭 타겟) ── */
const TARGETS_DEF = [
  { x: 80,  y: 120, w: 18, h: 12, pts: 100, color: '#f43f5e' },
  { x: 110, y: 105, w: 18, h: 12, pts: 100, color: '#f59e0b' },
  { x: 145, y: 96,  w: 18, h: 12, pts: 150, color: '#a78bfa' },
  { x: 180, y: 105, w: 18, h: 12, pts: 100, color: '#f59e0b' },
  { x: 210, y: 120, w: 18, h: 12, pts: 100, color: '#f43f5e' },
];

/* ── 상단 아치 가이드 핀 ── */
const GUIDE_PINS = [
  { x: 68,  y: 390 },
  { x: 180, y: 370 },
  { x: 272, y: 390 },
];

/* ── 게임 상태 ── */
let score, best, balls, multiplier, gameRunning;
let plungerCharge = 0, plungerCharging = false;
let particles = [], popups = [];
let bumperFlash = new Array(BUMPERS.length).fill(0);
let targets = [];
let targetsAllHit = false;

/* ── 공 상태 ── */
let ball = { x: 0, y: 0, vx: 0, vy: 0, active: false };

/* ── 플리퍼 상태 ── */
let flipState = { L: false, R: false };
let flipAngle = { L: FLIP.L.restAngle, R: FLIP.R.restAngle };

/* ── 키 상태 ── */
const keys = { z: false, x: false, down: false };

/* ── localStorage ── */
function loadBest() {
  const v = localStorage.getItem('pinball_best');
  return v ? parseInt(v) : 0;
}
function saveBest(v) { localStorage.setItem('pinball_best', v); }

/* ══════════════════════════════════
   초기화
══════════════════════════════════ */
function initGame() {
  score = 0;
  best  = loadBest();
  balls = 3;
  multiplier = 1;
  gameRunning = true;
  particles = [];
  popups = [];
  bumperFlash.fill(0);
  targets = TARGETS_DEF.map(t => ({ ...t, hit: false }));
  targetsAllHit = false;
  flipAngle.L = FLIP.L.restAngle;
  flipAngle.R = FLIP.R.restAngle;

  updateHUD();
  spawnBall();
  overlay.style.display = 'none';
  if (!rafId) loop();
}

function spawnBall() {
  ball.x  = LAUNCH_X + (RIGHT_WALL - LAUNCH_X) / 2;
  ball.y  = CH - 100;
  ball.vx = 0;
  ball.vy = 0;
  ball.active = true;
  plungerCharge = 0;
  plungerCharging = false;
}

/* ══════════════════════════════════
   HUD 업데이트
══════════════════════════════════ */
function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  bestEl.textContent  = best.toLocaleString();
  multEl.textContent  = '×' + multiplier;

  const dots = ballsEl.querySelectorAll('.pb-ball-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('used', i >= balls);
  });
}

/* ══════════════════════════════════
   파티클
══════════════════════════════════ */
function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.03 + Math.random() * 0.04,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function spawnPopup(x, y, text) {
  popups.push({ x, y: y - 10, text, life: 1, vy: -0.8 });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.1;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.y += p.vy;
    p.life -= 0.022;
    if (p.life <= 0) popups.splice(i, 1);
  }
}

/* ══════════════════════════════════
   플리퍼 물리
══════════════════════════════════ */
function updateFlippers() {
  const step = FLIP_SPEED;

  // 왼쪽 플리퍼
  const targetL = flipState.L ? FLIP.L.activeAngle : FLIP.L.restAngle;
  const diffL   = targetL - flipAngle.L;
  flipAngle.L += Math.sign(diffL) * Math.min(step, Math.abs(diffL));

  // 오른쪽 플리퍼
  const targetR = flipState.R ? FLIP.R.activeAngle : FLIP.R.restAngle;
  const diffR   = targetR - flipAngle.R;
  flipAngle.R += Math.sign(diffR) * Math.min(step, Math.abs(diffR));
}

function flipperSegment(side) {
  const f   = FLIP[side];
  const ang = flipAngle[side] * Math.PI / 180;
  return {
    px: f.px, py: f.py,
    ex: f.px + Math.cos(ang) * FLIP_LEN,
    ey: f.py + Math.sin(ang) * FLIP_LEN,
    angularVel: (side === 'L' ? -1 : 1) *
      (flipState[side] ? 8 : -2),
  };
}

/* ══════════════════════════════════
   충돌 헬퍼
══════════════════════════════════ */
function closestPointOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, t: 0 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { x: ax + t * dx, y: ay + t * dy, t };
}

function circleSegCollide(bx, by, vx, vy, ax, ay, ex, ey, radius, restitution = 0.65, extraImpulse = 0) {
  const { x: cx, y: cy, t } = closestPointOnSeg(bx, by, ax, ay, ex, ey);
  const dx = bx - cx, dy = by - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > radius || dist < 0.001) return false;

  // 법선 벡터
  const nx = dx / dist, ny = dy / dist;
  // 겹침 해소
  ball.x = cx + nx * (radius + 0.5);
  ball.y = cy + ny * (radius + 0.5);

  // 반사 + 반발
  const dot = ball.vx * nx + ball.vy * ny;
  ball.vx -= (1 + restitution) * dot * nx + extraImpulse * nx;
  ball.vy -= (1 + restitution) * dot * ny + extraImpulse * ny;
  return true;
}

/* ══════════════════════════════════
   공 물리 업데이트
══════════════════════════════════ */
function updateBall() {
  if (!ball.active) return;

  /* 플런저 (발사 레인에 있을 때) */
  if (plungerCharging) {
    plungerCharge = Math.min(1, plungerCharge + 0.025);
    ball.x = LAUNCH_X + (RIGHT_WALL - LAUNCH_X) / 2;
    ball.y = CH - 100;
    return;
  }

  /* 중력 */
  ball.vy += GRAVITY;
  ball.vx *= FRICTION;
  ball.vy *= FRICTION;

  /* 속도 상한 */
  const spd = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
  if (spd > 18) {
    ball.vx = ball.vx / spd * 18;
    ball.vy = ball.vy / spd * 18;
  }

  ball.x += ball.vx;
  ball.y += ball.vy;

  /* ── 벽 충돌 ── */
  // 왼쪽 메인 벽
  if (ball.x - BALL_R < LEFT_WALL) {
    ball.x = LEFT_WALL + BALL_R;
    ball.vx = Math.abs(ball.vx) * 0.7;
  }
  // 오른쪽 - 발사 레인 왼쪽 벽 (공이 그 안에 있으면 bounce)
  if (ball.x > LAUNCH_X - BALL_R && ball.x < RIGHT_WALL) {
    // 발사 레인 내에서 메인 필드 진입 방지 (위 탈출구 제외)
    if (ball.y > TOP_WALL + 60) {
      ball.x = LAUNCH_X - BALL_R - 1;
      ball.vx = -Math.abs(ball.vx) * 0.7;
    }
  }
  // 오른쪽 외벽
  if (ball.x + BALL_R > LAUNCH_X) {
    if (ball.y > TOP_WALL + 60) {
      ball.x = LAUNCH_X - BALL_R;
      ball.vx = -Math.abs(ball.vx) * 0.7;
    }
  }
  // 상단 벽
  if (ball.y - BALL_R < TOP_WALL) {
    ball.y = TOP_WALL + BALL_R;
    ball.vy = Math.abs(ball.vy) * 0.6;
  }

  /* ── 드레인 감지 (하단 탈출) ── */
  if (ball.y > CH + 20) {
    loseBall();
    return;
  }

  /* ── 플리퍼 충돌 ── */
  for (const side of ['L', 'R']) {
    const seg = flipperSegment(side);
    const prevMoving = flipState[side];
    const angVelImpulse = prevMoving ? 3.5 : 0;
    circleSegCollide(
      ball.x, ball.y, ball.vx, ball.vy,
      seg.px, seg.py, seg.ex, seg.ey,
      BALL_R, 0.6, angVelImpulse
    );
  }

  /* ── 슬링샷 충돌 ── */
  for (const sl of SLINGS) {
    const hit = circleSegCollide(
      ball.x, ball.y, ball.vx, ball.vy,
      sl.x1, sl.y1, sl.x2, sl.y2,
      BALL_R, 1.1, 4
    );
    if (hit) {
      addScore(sl.pts);
      spawnParticles(ball.x, ball.y, '#f59e0b', 6);
    }
  }

  /* ── 범퍼 충돌 ── */
  for (let i = 0; i < BUMPERS.length; i++) {
    const b = BUMPERS[i];
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < b.r + BALL_R) {
      // 겹침 해소
      const nx = dx / dist, ny = dy / dist;
      ball.x = b.x + nx * (b.r + BALL_R + 1);
      ball.y = b.y + ny * (b.r + BALL_R + 1);
      // 튕겨내기 (반발 계수 크게)
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = nx * 7 - ball.vx * 0.2;
      ball.vy = ny * 7 - ball.vy * 0.2;

      addScore(b.pts);
      bumperFlash[i] = 8;
      spawnParticles(ball.x, ball.y, b.color, 10);
      spawnPopup(b.x, b.y - b.r - 10, '+' + (b.pts * multiplier));
    }
  }

  /* ── 드롭 타겟 충돌 ── */
  for (const t of targets) {
    if (t.hit) continue;
    if (
      ball.x + BALL_R > t.x - t.w / 2 &&
      ball.x - BALL_R < t.x + t.w / 2 &&
      ball.y + BALL_R > t.y - t.h / 2 &&
      ball.y - BALL_R < t.y + t.h / 2
    ) {
      t.hit = true;
      ball.vy = -Math.abs(ball.vy) * 0.8;
      addScore(t.pts);
      spawnParticles(t.x, t.y, t.color, 8);
      spawnPopup(t.x, t.y - 14, '+' + (t.pts * multiplier));

      // 전부 맞추면 보너스
      if (targets.every(tt => tt.hit)) {
        if (!targetsAllHit) {
          addScore(1000);
          spawnPopup(CW / 2, CH / 2, 'BONUS +1000!');
          targetsAllHit = true;
          // 리셋 (1.5초 후)
          setTimeout(() => {
            targets.forEach(tt => tt.hit = false);
            targetsAllHit = false;
          }, 1500);
        }
      }
    }
  }

  /* ── 가이드 핀 충돌 ── */
  for (const pin of GUIDE_PINS) {
    const dx = ball.x - pin.x, dy = ball.y - pin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const pinR = 5;
    if (dist < pinR + BALL_R) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = pin.x + nx * (pinR + BALL_R + 0.5);
      ball.y = pin.y + ny * (pinR + BALL_R + 0.5);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 1.5 * dot * nx;
      ball.vy -= 1.5 * dot * ny;
    }
  }
}

/* ══════════════════════════════════
   점수 추가
══════════════════════════════════ */
function addScore(pts) {
  score += pts * multiplier;
  // 멀티플라이어: 1000점당 +1 (최대 ×5)
  const newMult = Math.min(5, 1 + Math.floor(score / 2000));
  if (newMult !== multiplier) {
    multiplier = newMult;
    spawnPopup(CW / 2, 300, '×' + multiplier + ' MULTI!');
  }
  if (score > best) {
    best = score;
    saveBest(best);
  }
  updateHUD();
}

/* ══════════════════════════════════
   볼 잃음
══════════════════════════════════ */
function loseBall() {
  ball.active = false;
  balls--;
  updateHUD();

  if (balls <= 0) {
    setTimeout(gameOver, 400);
  } else {
    setTimeout(spawnBall, 600);
  }
}

function gameOver() {
  gameRunning = false;
  ovTitle.textContent = 'GAME OVER';
  ovMsg.innerHTML =
    `최종 점수: <strong>${score.toLocaleString()}</strong><br>` +
    (score >= best ? '<span style="color:#f59e0b">🏆 베스트 스코어!</span>' : `베스트: ${best.toLocaleString()}`);
  bestInfo.textContent = best > 0 ? `최고 기록: ${best.toLocaleString()}` : '';
  startBtn.textContent = '다시 시작';
  overlay.style.display = 'flex';
}

/* ══════════════════════════════════
   렌더링
══════════════════════════════════ */
function drawBackground() {
  // 배경 그라디언트
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#080520');
  bg.addColorStop(1, '#060316');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // 필드 내부 약간 밝게
  const field = ctx.createLinearGradient(LEFT_WALL, TOP_WALL, LAUNCH_X, CH);
  field.addColorStop(0, 'rgba(124,58,237,0.05)');
  field.addColorStop(1, 'rgba(124,58,237,0.02)');
  ctx.fillStyle = field;
  ctx.fillRect(LEFT_WALL, TOP_WALL, LAUNCH_X - LEFT_WALL, CH - TOP_WALL);

  // 격자 도트 패턴
  ctx.fillStyle = 'rgba(124,58,237,0.08)';
  for (let y = TOP_WALL + 20; y < CH - 20; y += 30) {
    for (let x = LEFT_WALL + 15; x < LAUNCH_X - 5; x += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWalls() {
  ctx.save();
  ctx.strokeStyle = 'rgba(124,58,237,0.7)';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(124,58,237,0.5)';

  // 왼쪽 외벽
  ctx.beginPath();
  ctx.moveTo(LEFT_WALL, TOP_WALL);
  ctx.lineTo(LEFT_WALL, CH - 20);
  ctx.stroke();

  // 오른쪽 메인 필드 벽 (발사 레인 왼쪽)
  ctx.beginPath();
  ctx.moveTo(LAUNCH_X, TOP_WALL + 60);
  ctx.lineTo(LAUNCH_X, CH - 20);
  ctx.stroke();

  // 발사 레인 오른쪽 벽
  ctx.strokeStyle = 'rgba(124,58,237,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(RIGHT_WALL, TOP_WALL);
  ctx.lineTo(RIGHT_WALL, CH - 20);
  ctx.stroke();

  // 상단 곡선 벽
  ctx.strokeStyle = 'rgba(124,58,237,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(LEFT_WALL, TOP_WALL);
  ctx.quadraticCurveTo(CW / 2 - 20, TOP_WALL - 10, LAUNCH_X, TOP_WALL + 60);
  ctx.stroke();

  // 슬링샷
  ctx.strokeStyle = 'rgba(245,158,11,0.6)';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(245,158,11,0.4)';
  for (const sl of SLINGS) {
    ctx.beginPath();
    ctx.moveTo(sl.x1, sl.y1);
    ctx.lineTo(sl.x2, sl.y2);
    ctx.stroke();
  }

  // 하단 출구 (드레인)
  ctx.strokeStyle = 'rgba(124,58,237,0.4)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 0;
  // 왼쪽 드레인 경사
  ctx.beginPath();
  ctx.moveTo(LEFT_WALL, CH - 20);
  ctx.lineTo(FLIP.L.px - 12, FLIP.L.py);
  ctx.stroke();
  // 오른쪽 드레인 경사
  ctx.beginPath();
  ctx.moveTo(LAUNCH_X, CH - 20);
  ctx.lineTo(FLIP.R.px + 12, FLIP.R.py);
  ctx.stroke();

  ctx.restore();
}

function drawBumpers() {
  for (let i = 0; i < BUMPERS.length; i++) {
    const b = BUMPERS[i];
    const flash = bumperFlash[i] > 0;
    if (bumperFlash[i] > 0) bumperFlash[i]--;

    ctx.save();
    ctx.shadowBlur = flash ? 30 : 14;
    ctx.shadowColor = b.color;

    // 외부 링
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = b.color + (flash ? 'ff' : '99');
    ctx.lineWidth = 3;
    ctx.stroke();

    // 내부 채우기
    const grd = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
    grd.addColorStop(0, flash ? b.color + 'cc' : b.color + '44');
    grd.addColorStop(1, flash ? b.color + '66' : b.color + '11');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    // 중앙 도트
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = flash ? '#fff' : b.color;
    ctx.fill();

    ctx.restore();
  }
}

function drawTargets() {
  for (const t of targets) {
    if (t.hit) continue;
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = t.color;
    ctx.fillStyle = t.color + 'cc';
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawGuidePins() {
  for (const pin of GUIDE_PINS) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#a78bfa44';
    ctx.strokeStyle = '#a78bfa99';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawFlippers() {
  for (const side of ['L', 'R']) {
    const f   = FLIP[side];
    const seg = flipperSegment(side);
    const active = flipState[side];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowBlur = active ? 18 : 8;
    ctx.shadowColor = active ? '#a78bfa' : 'rgba(124,58,237,0.4)';

    // 그림자/아웃라인
    ctx.beginPath();
    ctx.moveTo(seg.px, seg.py);
    ctx.lineTo(seg.ex, seg.ey);
    ctx.strokeStyle = active ? '#a78bfa' : '#6d28d9';
    ctx.lineWidth = 14;
    ctx.stroke();

    // 내부 밝은 선
    ctx.beginPath();
    ctx.moveTo(seg.px, seg.py);
    ctx.lineTo(seg.ex, seg.ey);
    ctx.strokeStyle = active ? '#ddd6fe' : '#8b5cf6';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.restore();
  }
}

function drawBall() {
  if (!ball.active) return;

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(167,139,250,0.8)';

  // 공 그라디언트
  const grd = ctx.createRadialGradient(
    ball.x - BALL_R * 0.35, ball.y - BALL_R * 0.35, 0,
    ball.x, ball.y, BALL_R
  );
  grd.addColorStop(0, '#ddd6fe');
  grd.addColorStop(0.4, '#8b5cf6');
  grd.addColorStop(1, '#4c1d95');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  // 광택
  const shine = ctx.createRadialGradient(
    ball.x - BALL_R * 0.3, ball.y - BALL_R * 0.4, 0,
    ball.x, ball.y, BALL_R * 0.8
  );
  shine.addColorStop(0, 'rgba(255,255,255,0.4)');
  shine.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlunger() {
  if (!plungerCharging && plungerCharge === 0) return;
  const px = LAUNCH_X + (RIGHT_WALL - LAUNCH_X) / 2;
  const py = CH - 80;

  // 충전 바
  const barW = 18, barH = 60;
  const barX = px - barW / 2, barY = py + 10;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.roundRect(barX, barY, barW, barH, 4);
  ctx.fill();

  const fillH = barH * plungerCharge;
  const color = plungerCharge > 0.7 ? '#f43f5e' : plungerCharge > 0.4 ? '#f59e0b' : '#a78bfa';
  ctx.fillStyle = color;
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.roundRect(barX, barY + barH - fillH, barW, fillH, 4);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowBlur = 6;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPopups() {
  ctx.save();
  ctx.font = 'bold 13px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#f59e0b';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
}

function drawLaunchArrow() {
  if (!plungerCharging && !ball.active) return;
  if (ball.active && ball.y < CH - 80) return;
  if (!plungerCharging) return;

  // 발사 방향 화살표
  const px = LAUNCH_X + (RIGHT_WALL - LAUNCH_X) / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(167,139,250,0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(px, CH - 110);
  ctx.lineTo(px, TOP_WALL + 80);
  ctx.stroke();
  ctx.restore();
}

/* ══════════════════════════════════
   메인 루프
══════════════════════════════════ */
let rafId = null;

function loop() {
  if (!gameRunning) { rafId = null; return; }

  updateFlippers();
  updateBall();
  updateParticles();

  /* 렌더 */
  ctx.clearRect(0, 0, CW, CH);
  drawBackground();
  drawWalls();
  drawBumpers();
  drawTargets();
  drawGuidePins();
  drawFlippers();
  drawBall();
  drawPlunger();
  drawLaunchArrow();
  drawParticles();
  drawPopups();

  rafId = requestAnimationFrame(loop);
}

/* ══════════════════════════════════
   입력 처리
══════════════════════════════════ */
document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') { keys.z = true; flipState.L = true; }
  if (e.key === 'x' || e.key === 'X') { keys.x = true; flipState.R = true; }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!gameRunning) return;
    if (ball.active && !plungerCharging && ball.y > CH - 120 && ball.x > LAUNCH_X) {
      plungerCharging = true;
    }
  }
});

document.addEventListener('keyup', e => {
  if (e.key === 'z' || e.key === 'Z') { keys.z = false; flipState.L = false; }
  if (e.key === 'x' || e.key === 'X') { keys.x = false; flipState.R = false; }
  if (e.key === 'ArrowDown') {
    if (plungerCharging) {
      // 발사!
      ball.vy = -(plungerCharge * 17 + 5);
      ball.vx = 0;
      plungerCharging = false;
      plungerCharge = 0;
    }
  }
});

/* ── 모바일 터치 (좌/우 탭 → 플리퍼) ── */
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const tx = t.clientX - rect.left;
    const ty = t.clientY - rect.top;
    // 하단 절반 터치만
    if (ty < CH * 0.5) continue;
    if (tx < CW / 2) flipState.L = true;
    else              flipState.R = true;
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const tx = t.clientX - rect.left;
    if (tx < CW / 2) flipState.L = false;
    else              flipState.R = false;
  }
}, { passive: false });

/* 모바일 플런저: 화면 위쪽 탭 */
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!gameRunning) return;
  for (const t of e.changedTouches) {
    const rect = canvas.getBoundingClientRect();
    const ty = t.clientY - rect.top;
    if (ty > CH * 0.7 && ball.active && !plungerCharging) {
      if (ball.y > CH - 120) plungerCharging = true;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (plungerCharging) {
    ball.vy = -(plungerCharge * 17 + 5);
    ball.vx = 0;
    plungerCharging = false;
    plungerCharge = 0;
  }
}, { passive: false });

/* ══════════════════════════════════
   시작 버튼
══════════════════════════════════ */
startBtn.addEventListener('click', () => {
  initGame();
});

/* ── 초기 화면 ── */
best = loadBest();
bestEl.textContent  = best.toLocaleString();
bestInfo.textContent = best > 0 ? `최고 기록: ${best.toLocaleString()}` : '';
scoreEl.textContent = '0';
multEl.textContent  = '×1';

// 초기 렌더 (오버레이 뒤에 배경 보이게)
ctx.clearRect(0, 0, CW, CH);
drawBackground();
drawWalls();
drawBumpers();
drawTargets();
drawGuidePins();
