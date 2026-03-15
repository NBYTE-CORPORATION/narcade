/* ── game24.js — 핀볼 (v2 · 버그픽스 + 난이도 강화) ── */
'use strict';

const canvas   = document.getElementById('c');
const ctx      = canvas.getContext('2d');
const overlay  = document.getElementById('overlay');
const ovTitle  = document.getElementById('ovTitle');
const ovMsg    = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const scoreEl  = document.getElementById('scoreEl');
const bestEl   = document.getElementById('bestEl');
const ballsEl  = document.getElementById('ballsEl');
const multEl   = document.getElementById('multEl');
const bestInfo = document.getElementById('bestInfo');

/* ── 캔버스 ── */
const CW = 360, CH = 640;
canvas.width = CW; canvas.height = CH;

/* ── 물리 상수 ── */
const GRAVITY_BASE = 0.38;   // 기존 0.30 → 더 빠르게
let   gravity      = GRAVITY_BASE;
const BALL_R       = 9;
const FRICTION     = 0.998;
const SPEED_CAP    = 22;
const SUBSTEPS     = 3;      // 터널링 방지 서브스텝

/* ── 필드 경계 ── */
const LW      = 22;    // 메인 필드 왼쪽 벽
const LANE_W  = 316;   // 발사 레인 왼쪽 벽 (메인 필드 오른쪽)
const RW      = 338;   // 발사 레인 오른쪽 벽
const TW      = 44;    // 상단 벽
const LANE_OPEN_Y = TW + 72; // 이 y 위면 레인 ↔ 메인 필드 연통

/* ── 플리퍼 설정 ── */
const FLIP = {
  L: { px: 95,  py: 576, restAngle: 30,  activeAngle: -32 },
  R: { px: 265, py: 576, restAngle: 150, activeAngle: 212 },
};
const FLIP_LEN   = 72;   // 기존 76 → 조금 짧게 (더 어렵)
const FLIP_SPEED = 22;   // 각도/프레임

/* ── 범퍼 (6개로 증가) ── */
const BUMPERS = [
  { x: 145, y: 162, r: 22, color: '#06b6d4', pts: 300 },
  { x: 82,  y: 238, r: 18, color: '#f43f5e', pts: 200 },
  { x: 208, y: 238, r: 18, color: '#f59e0b', pts: 200 },
  { x: 125, y: 305, r: 18, color: '#a78bfa', pts: 250 },
  { x: 185, y: 305, r: 18, color: '#22c55e', pts: 250 },
  { x: 145, y: 372, r: 15, color: '#f43f5e', pts: 150 },
];

/* ── 슬링샷 ── */
const SLINGS = [
  { x1: LW,     y1: 488, x2: 108, y2: 418, pts: 60 },
  { x1: LANE_W, y1: 488, x2: 232, y2: 418, pts: 60 },
];

/* ── 드레인 경사 벽 (충돌 포함) ── */
const DRAIN_WALLS = [
  { x1: LW,     y1: CH - 18, x2: FLIP.L.px - 10, y2: FLIP.L.py + 2 },
  { x1: LANE_W, y1: CH - 18, x2: FLIP.R.px + 10, y2: FLIP.R.py + 2 },
];

/* ── 가이드 핀 (5개로 증가 + 드레인 유도 배치) ── */
const GUIDE_PINS = [
  { x: 70,  y: 390 },
  { x: 100, y: 355 },
  { x: 145, y: 425 },
  { x: 200, y: 355 },
  { x: 240, y: 390 },
];

/* ── 드롭 타겟 ── */
const TARGETS_DEF = [
  { x: 76,  y: 118, w: 18, h: 12, pts: 100, color: '#f43f5e' },
  { x: 108, y: 103, w: 18, h: 12, pts: 100, color: '#f59e0b' },
  { x: 145, y: 95,  w: 18, h: 12, pts: 150, color: '#a78bfa' },
  { x: 182, y: 103, w: 18, h: 12, pts: 100, color: '#f59e0b' },
  { x: 214, y: 118, w: 18, h: 12, pts: 100, color: '#f43f5e' },
];

/* ── 상태 ── */
let score, best, balls, multiplier, gameRunning;
let multDecayTimer = 0;          // 멀티 감소 타이머
let plungerCharge = 0, plungerCharging = false;
let waitingToLaunch = false;     // 공이 발사 대기 중 (물리 정지)
let particles = [], popups = [];
let bumperFlash = new Array(BUMPERS.length).fill(0);
let targets = [], targetsAllHit = false;
let ball = { x: 0, y: 0, vx: 0, vy: 0, active: false };
let flipState = { L: false, R: false };
let flipAngle  = { L: FLIP.L.restAngle, R: FLIP.R.restAngle };

/* ── localStorage ── */
function loadBest() { const v = localStorage.getItem('pinball_best'); return v ? parseInt(v) : 0; }
function saveBest(v) { localStorage.setItem('pinball_best', v); }

/* ══════════════════════════════════
   초기화
══════════════════════════════════ */
function initGame() {
  score = 0; best = loadBest();
  balls = 3; multiplier = 1;
  gravity = GRAVITY_BASE;
  gameRunning = true;
  multDecayTimer = 0;
  particles = []; popups = [];
  bumperFlash.fill(0);
  targets = TARGETS_DEF.map(t => ({ ...t, hit: false }));
  targetsAllHit = false;
  flipAngle.L = FLIP.L.restAngle;
  flipAngle.R = FLIP.R.restAngle;
  flipState.L = false; flipState.R = false;
  updateHUD();
  spawnBall();
  overlay.style.display = 'none';
  if (!rafId) loop();
}

function spawnBall() {
  const laneCenter = LANE_W + (RW - LANE_W) / 2;
  ball.x = laneCenter; ball.y = CH - 95;
  ball.vx = 0; ball.vy = 0;
  ball.active = true;
  plungerCharge = 0;
  plungerCharging = false;
  waitingToLaunch = true;   // 발사 전까지 물리 정지
}

/* ── HUD ── */
function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  bestEl.textContent  = best.toLocaleString();
  multEl.textContent  = '×' + multiplier;
  ballsEl.querySelectorAll('.pb-ball-dot').forEach((d, i) => {
    d.classList.toggle('used', i >= balls);
  });
}

/* ── 점수 ── */
function addScore(pts) {
  score += pts * multiplier;
  multDecayTimer = 0;   // 점수 획득 시 타이머 리셋
  const newMult = Math.min(6, 1 + Math.floor(score / 1800));
  if (newMult !== multiplier) {
    multiplier = newMult;
    spawnPopup(CW / 2, 280, '×' + multiplier + ' MULTI!');
  }
  // 점수 올라갈수록 중력 강해짐 (최대 0.58)
  gravity = Math.min(0.58, GRAVITY_BASE + score / 40000);
  if (score > best) { best = score; saveBest(best); }
  updateHUD();
}

/* ── 볼 잃음 ── */
function loseBall() {
  ball.active = false;
  balls--;
  updateHUD();
  if (balls <= 0) {
    gameRunning = false;
    setTimeout(() => {
      ovTitle.textContent = 'GAME OVER';
      ovMsg.innerHTML = `최종 점수: <strong>${score.toLocaleString()}</strong><br>`
        + (score >= best ? '<span style="color:#f59e0b">🏆 베스트 스코어!</span>'
                         : `베스트: ${best.toLocaleString()}`);
      bestInfo.textContent = best > 0 ? `최고 기록: ${best.toLocaleString()}` : '';
      startBtn.textContent = '다시 시작';
      overlay.style.display = 'flex';
    }, 500);
  } else {
    setTimeout(spawnBall, 700);
  }
}

/* ══════════════════════════════════
   파티클
══════════════════════════════════ */
function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4.5;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s,
                     life: 1, decay: 0.03 + Math.random()*0.04,
                     size: 2 + Math.random()*3, color });
  }
}
function spawnPopup(x, y, text, color = '#f59e0b') {
  popups.push({ x, y: y - 10, text, life: 1, vy: -0.9, color });
}
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.12;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.y += p.vy; p.life -= 0.02;
    if (p.life <= 0) popups.splice(i, 1);
  }
}

/* ══════════════════════════════════
   플리퍼
══════════════════════════════════ */
function updateFlippers() {
  for (const side of ['L', 'R']) {
    const target = flipState[side] ? FLIP[side].activeAngle : FLIP[side].restAngle;
    const diff   = target - flipAngle[side];
    flipAngle[side] += Math.sign(diff) * Math.min(FLIP_SPEED, Math.abs(diff));
  }
}

function flipperEndpoint(side) {
  const ang = flipAngle[side] * Math.PI / 180;
  return {
    px: FLIP[side].px, py: FLIP[side].py,
    ex: FLIP[side].px + Math.cos(ang) * FLIP_LEN,
    ey: FLIP[side].py + Math.sin(ang) * FLIP_LEN,
  };
}

/* ══════════════════════════════════
   충돌 헬퍼
══════════════════════════════════ */
function closestPtOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx-ax, dy = by-ay, lenSq = dx*dx + dy*dy;
  if (lenSq < 0.001) return { x: ax, y: ay };
  const t = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
  return { x: ax + t*dx, y: ay + t*dy };
}

/* 선분과 원 충돌 - true 반환 시 ball.x/y/vx/vy 수정됨 */
function collideSeg(ax, ay, bx, by, restitution = 0.68, extraPush = 0) {
  const { x: cx, y: cy } = closestPtOnSeg(ball.x, ball.y, ax, ay, bx, by);
  const dx = ball.x - cx, dy = ball.y - cy;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist > BALL_R || dist < 0.001) return false;

  const nx = dx / dist, ny = dy / dist;
  // 겹침 해소
  ball.x = cx + nx * (BALL_R + 0.8);
  ball.y = cy + ny * (BALL_R + 0.8);
  // 반사
  const dot = ball.vx * nx + ball.vy * ny;
  if (dot > 0) return false;  // 이미 멀어지는 중이면 무시
  ball.vx -= (1 + restitution) * dot * nx;
  ball.vy -= (1 + restitution) * dot * ny;
  if (extraPush > 0) {
    ball.vx += nx * extraPush;
    ball.vy += ny * extraPush;
  }
  return true;
}

/* ══════════════════════════════════
   공 물리 (서브스텝)
══════════════════════════════════ */
function updateBall() {
  if (!ball.active) return;

  /* 발사 대기 중 (아직 ArrowDown / Space 안 눌림) */
  if (waitingToLaunch) {
    ball.x = LANE_W + (RW - LANE_W) / 2;
    ball.y = CH - 95;
    return;
  }

  /* 플런저 충전 중 */
  if (plungerCharging) {
    plungerCharge = Math.min(1, plungerCharge + 0.022);
    ball.x = LANE_W + (RW - LANE_W) / 2;
    ball.y = CH - 95;
    return;
  }

  /* 속도 상한 */
  const spd0 = Math.sqrt(ball.vx**2 + ball.vy**2);
  if (spd0 > SPEED_CAP) {
    ball.vx = ball.vx / spd0 * SPEED_CAP;
    ball.vy = ball.vy / spd0 * SPEED_CAP;
  }

  /* 서브스텝 */
  const dt = 1 / SUBSTEPS;
  for (let step = 0; step < SUBSTEPS; step++) {
    ball.vy += gravity * dt;
    ball.vx *= Math.pow(FRICTION, dt);
    ball.vy *= Math.pow(FRICTION, dt);
    ball.x  += ball.vx * dt;
    ball.y  += ball.vy * dt;

    wallCollisions();
    flipperCollisions();
  }

  /* 드레인 */
  if (ball.y > CH + 30) { loseBall(); return; }

  /* 범퍼, 슬링샷, 드롭타겟, 핀 (서브스텝 바깥에서 한 번만) */
  bumperCollisions();
  slingCollisions();
  targetCollisions();
  pinCollisions();
}

/* ── 벽 충돌 ── */
function wallCollisions() {
  const inLane = ball.x + BALL_R > LANE_W;

  if (inLane) {
    /* 발사 레인 내부 */
    if (ball.x - BALL_R < LANE_W && ball.y > LANE_OPEN_Y) {
      ball.x = LANE_W + BALL_R + 0.5;
      ball.vx = Math.abs(ball.vx) * 0.75;
    }
    if (ball.x + BALL_R > RW) {
      ball.x = RW - BALL_R - 0.5;
      ball.vx = -Math.abs(ball.vx) * 0.78;
    }
  } else {
    /* 메인 필드 */
    if (ball.x - BALL_R < LW) {
      ball.x = LW + BALL_R + 0.5;
      ball.vx = Math.abs(ball.vx) * 0.75;
    }
    if (ball.x + BALL_R > LANE_W) {
      ball.x = LANE_W - BALL_R - 0.5;
      ball.vx = -Math.abs(ball.vx) * 0.75;
    }
  }

  /* 상단 벽 */
  if (ball.y - BALL_R < TW) {
    ball.y = TW + BALL_R + 0.5;
    ball.vy = Math.abs(ball.vy) * 0.65;
  }

  /* 드레인 경사 벽 충돌 */
  for (const dw of DRAIN_WALLS) {
    collideSeg(dw.x1, dw.y1, dw.x2, dw.y2, 0.55, 0);
  }
}

/* ── 플리퍼 충돌 ── */
function flipperCollisions() {
  for (const side of ['L', 'R']) {
    const seg     = flipperEndpoint(side);
    const isActive = flipState[side];
    const hit = collideSeg(seg.px, seg.py, seg.ex, seg.ey, 0.65, 0);
    if (hit && isActive) {
      /* 플리퍼 각속도 → 공 임펄스 */
      const ang = flipAngle[side] * Math.PI / 180;
      const nx  = -Math.sin(ang), ny = Math.cos(ang);
      const impulse = side === 'L' ? 4.5 : 4.5;
      ball.vx += nx * impulse * (side === 'L' ? -1 : 1);
      ball.vy -= impulse * 0.5;
    }
  }
}

/* ── 범퍼 충돌 ── */
function bumperCollisions() {
  for (let i = 0; i < BUMPERS.length; i++) {
    const b = BUMPERS[i];
    const dx = ball.x - b.x, dy = ball.y - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > b.r + BALL_R || dist < 0.001) continue;

    const nx = dx / dist, ny = dy / dist;
    ball.x = b.x + nx * (b.r + BALL_R + 1);
    ball.y = b.y + ny * (b.r + BALL_R + 1);
    // 강하게 튕기기
    const spd = Math.max(7.5, Math.sqrt(ball.vx**2 + ball.vy**2));
    ball.vx = nx * spd;
    ball.vy = ny * spd;

    addScore(b.pts);
    bumperFlash[i] = 10;
    spawnParticles(ball.x, ball.y, b.color, 12);
    spawnPopup(b.x, b.y - b.r - 12, '+' + (b.pts * multiplier), b.color);
  }
}

/* ── 슬링샷 충돌 ── */
function slingCollisions() {
  for (const sl of SLINGS) {
    const hit = collideSeg(sl.x1, sl.y1, sl.x2, sl.y2, 1.15, 5);
    if (hit) {
      addScore(sl.pts);
      spawnParticles(ball.x, ball.y, '#f59e0b', 8);
      spawnPopup(ball.x, ball.y - 12, '+' + (sl.pts * multiplier));
    }
  }
}

/* ── 드롭 타겟 충돌 ── */
function targetCollisions() {
  for (const t of targets) {
    if (t.hit) continue;
    if (
      ball.x + BALL_R > t.x - t.w/2 &&
      ball.x - BALL_R < t.x + t.w/2 &&
      ball.y + BALL_R > t.y - t.h/2 &&
      ball.y - BALL_R < t.y + t.h/2
    ) {
      t.hit = true;
      ball.vy = -Math.abs(ball.vy) * 0.85;
      addScore(t.pts);
      spawnParticles(t.x, t.y, t.color, 10);
      spawnPopup(t.x, t.y - 16, '+' + (t.pts * multiplier), t.color);

      if (targets.every(tt => tt.hit) && !targetsAllHit) {
        targetsAllHit = true;
        addScore(1500);
        spawnPopup(CW / 2, CH / 2, 'BONUS +1500!');
        setTimeout(() => { targets.forEach(tt => tt.hit = false); targetsAllHit = false; }, 1800);
      }
    }
  }
}

/* ── 가이드 핀 충돌 ── */
function pinCollisions() {
  for (const pin of GUIDE_PINS) {
    const dx = ball.x - pin.x, dy = ball.y - pin.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const r = 5;
    if (dist > r + BALL_R || dist < 0.001) continue;
    const nx = dx/dist, ny = dy/dist;
    ball.x = pin.x + nx * (r + BALL_R + 0.5);
    ball.y = pin.y + ny * (r + BALL_R + 0.5);
    const dot = ball.vx*nx + ball.vy*ny;
    if (dot < 0) {
      ball.vx -= 1.6 * dot * nx;
      ball.vy -= 1.6 * dot * ny;
    }
  }
}

/* ══════════════════════════════════
   렌더링
══════════════════════════════════ */
function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#080520'); bg.addColorStop(1, '#06031a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

  // 필드 내부
  ctx.fillStyle = 'rgba(124,58,237,0.04)';
  ctx.fillRect(LW, TW, LANE_W - LW, CH - TW);

  // 도트 패턴
  ctx.fillStyle = 'rgba(124,58,237,0.07)';
  for (let y = TW + 22; y < CH - 18; y += 32) {
    for (let x = LW + 16; x < LANE_W - 4; x += 32) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill();
    }
  }
}

function drawWalls() {
  ctx.save();

  const glow = (color, blur) => { ctx.shadowBlur = blur; ctx.shadowColor = color; };

  /* 왼쪽 외벽 */
  ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3;
  glow('rgba(124,58,237,0.5)', 12);
  ctx.beginPath(); ctx.moveTo(LW, TW); ctx.lineTo(LW, CH - 18); ctx.stroke();

  /* 발사 레인 왼쪽 벽 */
  ctx.beginPath(); ctx.moveTo(LANE_W, LANE_OPEN_Y); ctx.lineTo(LANE_W, CH - 18); ctx.stroke();

  /* 발사 레인 오른쪽 벽 */
  ctx.strokeStyle = 'rgba(124,58,237,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(RW, TW); ctx.lineTo(RW, CH - 18); ctx.stroke();

  /* 상단 곡선 벽 */
  ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3;
  glow('rgba(124,58,237,0.5)', 12);
  ctx.beginPath();
  ctx.moveTo(LW, TW);
  ctx.quadraticCurveTo(CW/2 - 18, TW - 12, LANE_W, LANE_OPEN_Y);
  ctx.stroke();

  /* 슬링샷 */
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 4;
  glow('rgba(245,158,11,0.5)', 14);
  for (const sl of SLINGS) {
    ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2); ctx.stroke();
  }

  /* 드레인 경사 벽 */
  ctx.strokeStyle = 'rgba(124,58,237,0.5)'; ctx.lineWidth = 2.5;
  glow('rgba(124,58,237,0.3)', 8);
  for (const dw of DRAIN_WALLS) {
    ctx.beginPath(); ctx.moveTo(dw.x1, dw.y1); ctx.lineTo(dw.x2, dw.y2); ctx.stroke();
  }

  ctx.restore();
}

function drawBumpers() {
  for (let i = 0; i < BUMPERS.length; i++) {
    const b = BUMPERS[i];
    const flash = bumperFlash[i] > 0;
    if (bumperFlash[i] > 0) bumperFlash[i]--;

    ctx.save();
    ctx.shadowBlur = flash ? 36 : 16; ctx.shadowColor = b.color;

    /* 외부 링 */
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.strokeStyle = b.color + (flash ? 'ff' : '88');
    ctx.lineWidth = flash ? 4 : 2.5; ctx.stroke();

    /* 내부 */
    const grd = ctx.createRadialGradient(b.x - b.r*.3, b.y - b.r*.3, 0, b.x, b.y, b.r);
    grd.addColorStop(0, flash ? b.color + 'ee' : b.color + '44');
    grd.addColorStop(1, flash ? b.color + '55' : b.color + '0a');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();

    /* 중앙 점 */
    ctx.beginPath(); ctx.arc(b.x, b.y, flash ? 6 : 4, 0, Math.PI*2);
    ctx.fillStyle = flash ? '#fff' : b.color; ctx.fill();

    /* 점수 텍스트 */
    ctx.font = `bold ${b.r < 18 ? 9 : 10}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = flash ? '#fff' : b.color + 'bb';
    ctx.fillText(b.pts, b.x, b.y + b.r + 10);
    ctx.restore();
  }
}

function drawTargets() {
  for (const t of targets) {
    if (t.hit) continue;
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = t.color;
    ctx.fillStyle = t.color + 'cc';
    ctx.strokeStyle = t.color; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(t.x - t.w/2, t.y - t.h/2, t.w, t.h, 3);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function drawGuidePins() {
  for (const pin of GUIDE_PINS) {
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = '#a78bfa';
    ctx.beginPath(); ctx.arc(pin.x, pin.y, 5, 0, Math.PI*2);
    ctx.fillStyle = '#a78bfa33';
    ctx.strokeStyle = '#a78bfa88'; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

function drawFlippers() {
  for (const side of ['L', 'R']) {
    const seg    = flipperEndpoint(side);
    const active = flipState[side];

    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowBlur = active ? 22 : 10;
    ctx.shadowColor = active ? '#a78bfa' : 'rgba(124,58,237,0.4)';

    ctx.beginPath();
    ctx.moveTo(seg.px, seg.py); ctx.lineTo(seg.ex, seg.ey);
    ctx.strokeStyle = active ? '#7c3aed' : '#4c1d95';
    ctx.lineWidth = 15; ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(seg.px, seg.py); ctx.lineTo(seg.ex, seg.ey);
    ctx.strokeStyle = active ? '#c4b5fd' : '#7c3aed';
    ctx.lineWidth = 7; ctx.stroke();

    ctx.restore();
  }
}

function drawBall() {
  if (!ball.active) return;
  ctx.save();
  ctx.shadowBlur = 20; ctx.shadowColor = 'rgba(167,139,250,0.9)';

  const grd = ctx.createRadialGradient(
    ball.x - BALL_R*.35, ball.y - BALL_R*.35, 0,
    ball.x, ball.y, BALL_R
  );
  grd.addColorStop(0, '#ede9fe');
  grd.addColorStop(0.4, '#7c3aed');
  grd.addColorStop(1, '#3b0764');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2); ctx.fill();

  /* 광택 */
  const sh = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, BALL_R*.8);
  sh.addColorStop(0, 'rgba(255,255,255,0.45)');
  sh.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawPlunger() {
  /* 발사 대기 중 → 펄싱 힌트 */
  if (waitingToLaunch) {
    const lc = LANE_W + (RW - LANE_W) / 2;
    const t  = Date.now() / 400;
    const alpha = 0.5 + 0.5 * Math.sin(t);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10; ctx.shadowColor = '#a78bfa';
    ctx.fillText('SPACE', lc, CH - 115);
    ctx.fillText('↓  ↑  발사', lc, CH - 103);
    ctx.restore();
    return;
  }
  if (!plungerCharging && plungerCharge < 0.01) return;
  const laneCenter = LANE_W + (RW - LANE_W) / 2;
  const barW = 16, barH = 60;
  const barX = laneCenter - barW/2, barY = CH - 68;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();

  const fillH = barH * plungerCharge;
  const col = plungerCharge > 0.72 ? '#f43f5e' : plungerCharge > 0.44 ? '#f59e0b' : '#a78bfa';
  ctx.fillStyle = col; ctx.shadowBlur = 12; ctx.shadowColor = col;
  ctx.roundRect(barX, barY + barH - fillH, barW, fillH, 4); ctx.fill();

  ctx.fillStyle = col + 'aa';
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('POWER', laneCenter, barY - 4);
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowBlur = 8; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawPopups() {
  ctx.save();
  for (const p of popups) {
    ctx.globalAlpha = Math.min(1, p.life * 1.5);
    ctx.fillStyle = p.color || '#f59e0b';
    ctx.shadowBlur = 10; ctx.shadowColor = p.color || '#f59e0b';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
}

function drawMultiDecay() {
  if (multiplier <= 1) return;
  /* 멀티 감소까지 남은 시간 시각화 */
  const pct = 1 - multDecayTimer / 600;
  ctx.save();
  ctx.strokeStyle = multiplier >= 4 ? '#f43f5e' : '#a78bfa';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(LANE_W + (RW - LANE_W)/2, 30, 12, -Math.PI/2, -Math.PI/2 + Math.PI*2*pct);
  ctx.stroke();
  ctx.restore();
}

/* ══════════════════════════════════
   메인 루프
══════════════════════════════════ */
let rafId = null;
let frameCount = 0;

function loop() {
  if (!gameRunning) { rafId = null; return; }

  frameCount++;

  /* 멀티플라이어 자동 감소 (10초 이상 점수 없으면) */
  if (multiplier > 1) {
    multDecayTimer++;
    if (multDecayTimer >= 600) {   // 60fps × 10초
      multiplier--;
      multDecayTimer = 0;
      updateHUD();
      spawnPopup(CW/2, 260, 'MULTI DOWN...', '#64748b');
    }
  }

  updateFlippers();
  updateBall();
  updateParticles();

  ctx.clearRect(0, 0, CW, CH);
  drawBackground();
  drawWalls();
  drawBumpers();
  drawTargets();
  drawGuidePins();
  drawFlippers();
  drawBall();
  drawPlunger();
  drawParticles();
  drawPopups();
  drawMultiDecay();

  rafId = requestAnimationFrame(loop);
}

/* ══════════════════════════════════
   입력
══════════════════════════════════ */
function startPlunger() {
  if (!gameRunning || !ball.active || plungerCharging) return;
  if (waitingToLaunch) {
    waitingToLaunch = false;
    plungerCharging = true;
    return;
  }
  if (ball.y > CH - 130 && ball.x > LANE_W - BALL_R) plungerCharging = true;
}

function releasePlunger() {
  if (plungerCharging) {
    ball.vy = -(plungerCharge * 18 + 6);
    ball.vx = 0;
    plungerCharging = false;
    plungerCharge = 0;
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') flipState.L = true;
  if (e.key === 'x' || e.key === 'X') flipState.R = true;
  if (e.key === 'ArrowLeft')  { e.preventDefault(); flipState.L = true; }
  if (e.key === 'ArrowRight') { e.preventDefault(); flipState.R = true; }
  if (e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    startPlunger();
  }
});

document.addEventListener('keyup', e => {
  if (e.key === 'z' || e.key === 'Z') flipState.L = false;
  if (e.key === 'x' || e.key === 'X') flipState.R = false;
  if (e.key === 'ArrowLeft')  flipState.L = false;
  if (e.key === 'ArrowRight') flipState.R = false;
  if (e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    releasePlunger();
  }
});

/* 모바일 터치 */
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleY = CH / rect.height;
  for (const t of e.changedTouches) {
    const tx = (t.clientX - rect.left) * (CW / rect.width);
    const ty = (t.clientY - rect.top)  * scaleY;
    if (ty > CH * 0.55) {
      if (tx < CW / 2) flipState.L = true;
      else              flipState.R = true;
    } else if (ty > CH * 0.7 && ball.active && !plungerCharging && ball.y > CH - 130) {
      plungerCharging = true;
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const tx = (t.clientX - rect.left) * (CW / rect.width);
    if (tx < CW / 2) flipState.L = false;
    else              flipState.R = false;
  }
  if (plungerCharging) {
    ball.vy = -(plungerCharge * 18 + 6);
    ball.vx = 0;
    plungerCharging = false;
    plungerCharge = 0;
  }
}, { passive: false });

/* ── 시작 ── */
startBtn.addEventListener('click', initGame);

best = loadBest();
bestEl.textContent  = best.toLocaleString();
bestInfo.textContent = best > 0 ? `최고 기록: ${best.toLocaleString()}` : '';
scoreEl.textContent = '0';
multEl.textContent  = '×1';

ctx.clearRect(0, 0, CW, CH);
drawBackground(); drawWalls(); drawBumpers(); drawTargets(); drawGuidePins();
