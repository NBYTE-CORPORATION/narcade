/* ── game26.js — 슈퍼 마리오 ── */
'use strict';

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovMsg   = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('scoreEl');
const coinsEl = document.getElementById('coinsEl');
const livesEl = document.getElementById('livesEl');
const timerEl = document.getElementById('timerEl');

const CW = 560, CH = 320;
canvas.width = CW; canvas.height = CH;

/* ── 타일 상수 ── */
const T  = 32;           // 타일 크기
const GW = 50;           // 맵 가로 타일 수

/* ── 색상 팔레트 ── */
const COL = {
  SKY1: '#5c94fc', SKY2: '#9bb8ff',
  GROUND: '#c84b11', GROUND_TOP: '#84c56a',
  BRICK: '#c84b11', QBLOCK: '#e8c000',
  PIPE_L: '#008000', PIPE_D: '#004d00',
  COIN: '#ffd700', ENEMY: '#c84b11',
  FLAG: '#d4af37',
};

/* ── 맵 정의 (0=빈칸, 1=지면, 2=벽돌, 3=?블록, 4=파이프하단, 5=파이프상단, 6=하늘블록) ── */
const MAP_ROWS = 10;
const MAP = [
  // 맨 위부터 (y=0 ~ y=9 row)
  // row 0-5: 하늘
  Array(GW).fill(0),
  Array(GW).fill(0),
  Array(GW).fill(0),
  // row 3: ? 블록, 벽돌들
  (()=>{ const r=Array(GW).fill(0); r[5]=3; r[7]=2; r[8]=3; r[9]=2; r[10]=3;
         r[20]=3; r[21]=2; r[22]=3; r[30]=3; r[31]=2; r[35]=3; return r; })(),
  Array(GW).fill(0),
  Array(GW).fill(0),
  // row 6: 파이프 상단
  (()=>{ const r=Array(GW).fill(0); r[13]=5; r[14]=5; r[26]=5; r[27]=5; r[38]=5; r[39]=5; return r; })(),
  // row 7: 파이프 하단
  (()=>{ const r=Array(GW).fill(0); r[13]=4; r[14]=4; r[26]=4; r[27]=4; r[38]=4; r[39]=4; return r; })(),
  // row 8: 지면 (gap 포함)
  (()=>{ const r=Array(GW).fill(1);
    // gap 구덩이
    for(let i=16;i<=17;i++) r[i]=0;
    for(let i=32;i<=33;i++) r[i]=0;
    r[GW-3]=0; r[GW-2]=0; // 마지막 gap
    return r;
  })(),
  // row 9: 지면 아래
  Array(GW).fill(1),
];

/* ── 게임 상태 ── */
let score, coins, lives, timeLeft, gameRunning;
let camX = 0;
let particles = [];
let timerInterval = null;

/* ── 마리오 ── */
let mario = {};

/* ── 굼바 초기 위치들 ── */
const GOOMBA_STARTS = [
  { x: 400, y: (MAP_ROWS-2)*T },
  { x: 540, y: (MAP_ROWS-2)*T },
  { x: 700, y: (MAP_ROWS-2)*T },
  { x: 860, y: (MAP_ROWS-2)*T },
  { x: 1000, y: (MAP_ROWS-2)*T },
  { x: 1200, y: (MAP_ROWS-2)*T },
  { x: 1350, y: (MAP_ROWS-2)*T },
];

let goombas = [];

/* ── ? 블록 상태 ── */
let qBlocks = {};    // key = "row,col" → { hit, coinAnim }
let brickParticles = [];

/* ── 코인 아이템 ── */
let coinItems = [];

/* ── 깃발 ── */
const FLAG_X = (GW - 6) * T;

/* ── 키 ── */
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if ((e.key === 'z' || e.key === 'Z' || e.key === ' ' || e.key === 'ArrowUp') && gameRunning) {
    if (mario.onGround) { mario.vy = -14; mario.onGround = false; mario.jumpPressed = true; }
  }
});
document.addEventListener('keyup', e => {
  keys[e.key] = false;
  if (e.key === 'z' || e.key === 'Z' || e.key === ' ' || e.key === 'ArrowUp') mario.jumpPressed = false;
});

/* ── 타일 헬퍼 ── */
function getTile(row, col) {
  if (row < 0 || row >= MAP_ROWS) return row >= MAP_ROWS ? 1 : 0;
  if (col < 0 || col >= GW) return 0;
  const key = `${row},${col}`;
  if (qBlocks[key] && qBlocks[key].hit) return 6; // 사용된 블록
  return MAP[row][col];
}

function isSolid(t) { return t === 1 || t === 2 || t === 3 || t === 4 || t === 5 || t === 6; }

function tileAt(wx, wy) {
  const col = Math.floor(wx / T);
  const row = Math.floor(wy / T);
  return getTile(row, col);
}

/* ── AABB 기반 이동 ── */
function moveEntity(ent, grav = 0.6) {
  ent.vy += grav;
  if (ent.vy > 14) ent.vy = 14;

  ent.x += ent.vx;
  // 수평 충돌
  const left  = ent.x,          right = ent.x + ent.w;
  const yTop  = ent.y + 2,       yBot  = ent.y + ent.h - 2;
  if (ent.vx > 0) {
    if (isSolid(tileAt(right, yTop)) || isSolid(tileAt(right, yBot))) {
      ent.x = Math.floor(right / T) * T - ent.w;
      ent.vx = 0;
    }
  } else if (ent.vx < 0) {
    if (isSolid(tileAt(left, yTop)) || isSolid(tileAt(left, yBot))) {
      ent.x = Math.ceil(left / T) * T;
      ent.vx = 0;
    }
  }

  ent.y += ent.vy;
  ent.onGround = false;

  // 수직 충돌
  const xLeft  = ent.x + 2, xRight = ent.x + ent.w - 2;
  const bottom = ent.y + ent.h;
  const top    = ent.y;

  if (ent.vy >= 0) {
    // 아래로 이동 → 바닥 체크
    const tL = tileAt(xLeft,  bottom);
    const tR = tileAt(xRight, bottom);
    if (isSolid(tL) || isSolid(tR)) {
      ent.y = Math.floor(bottom / T) * T - ent.h;
      ent.vy = 0;
      ent.onGround = true;
    }
  } else {
    // 위로 이동 → 천장 체크
    const tL = tileAt(xLeft,  top);
    const tR = tileAt(xRight, top);
    if (isSolid(tL) || isSolid(tR)) {
      ent.y = Math.ceil(top / T) * T;
      ent.vy = 1;
      // ? 블록 히트
      const hitCol = Math.floor((xLeft + xRight) / 2 / T);
      const hitRow = Math.floor(top / T);
      hitBlock(hitRow, hitCol);
    }
  }
}

/* ── 블록 히트 ── */
function hitBlock(row, col) {
  const t = getTile(row, col);
  if (t === 3) {
    const key = `${row},${col}`;
    if (!qBlocks[key]) qBlocks[key] = { hit: false };
    if (!qBlocks[key].hit) {
      qBlocks[key].hit = true;
      // 코인 +1
      coins++;
      score += 200;
      coinsEl.textContent = coins;
      scoreEl.textContent = score.toLocaleString();
      // 코인 팝업 파티클
      const wx = col * T + T/2, wy = row * T;
      coinItems.push({ x: wx - 6, y: wy, vy: -8, life: 1 });
    }
  } else if (t === 2) {
    // 벽돌 부수기
    MAP[row][col] = 0;
    const wx = col * T, wy = row * T;
    score += 50;
    scoreEl.textContent = score.toLocaleString();
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 4;
      brickParticles.push({ x: wx + T/2, y: wy + T/2, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 3, life: 1, w: 6+Math.random()*6, h: 6+Math.random()*6 });
    }
  }
}

/* ── 굼바 업데이트 ── */
function updateGoombas() {
  for (let i = goombas.length - 1; i >= 0; i--) {
    const g = goombas[i];
    if (g.dead) {
      g.deadTimer--;
      if (g.deadTimer <= 0) goombas.splice(i, 1);
      continue;
    }
    moveEntity(g, 0.6);
    if (g.onGround) g.vy = 0;

    // 방향 전환 (벽 or 절벽)
    const frontX = g.vx > 0 ? g.x + g.w + 2 : g.x - 2;
    const tFront = tileAt(frontX, g.y + g.h - 4);
    const tBelow = tileAt(g.x + (g.vx > 0 ? g.w + 2 : -2), g.y + g.h + 4);
    if (isSolid(tFront) || (!isSolid(tBelow) && g.onGround)) g.vx *= -1;

    // 마리오와 충돌
    if (rectsOverlap(mario, g)) {
      const marioBottom = mario.y + mario.h;
      const goombaTop   = g.y;
      if (mario.vy > 0 && marioBottom < goombaTop + 12) {
        // 밟기
        g.dead = true; g.deadTimer = 30;
        mario.vy = -9;
        score += 200;
        scoreEl.textContent = score.toLocaleString();
        spawnParticles(g.x + g.w/2, g.y, '#c84b11');
      } else {
        hurtMario();
      }
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ── 마리오 피격 ── */
let hurtCooldown = 0;
function hurtMario() {
  if (hurtCooldown > 0) return;
  lives--;
  updateLives();
  if (lives <= 0) {
    setTimeout(doGameOver, 400);
    gameRunning = false;
  } else {
    hurtCooldown = 90;
    mario.x = 50; mario.y = (MAP_ROWS - 3) * T;
    mario.vx = 0; mario.vy = 0;
    camX = 0;
  }
}

function updateLives() {
  livesEl.textContent = '❤️'.repeat(Math.max(0, lives));
}

/* ── 파티클 ── */
function spawnParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2, life: 1, decay: 0.04, color, size: 3 });
  }
}

/* ── 초기화 ── */
function initGame() {
  score = 0; coins = 0; lives = 3; timeLeft = 300; gameRunning = true;
  camX = 0; particles = []; brickParticles = []; coinItems = [];
  qBlocks = {};
  hurtCooldown = 0;

  // 맵 복구
  for (const row of MAP) {
    // 벽돌은 MAP 원본 유지 (MAP은 const이므로 실제로는 매 게임마다 재생성)
  }

  mario = { x: 50, y: (MAP_ROWS - 3) * T, vx: 0, vy: 0, w: 24, h: 32, onGround: false, jumpPressed: false, dir: 1, frame: 0, frameTimer: 0 };

  goombas = GOOMBA_STARTS.map(s => ({
    x: s.x, y: s.y - T,
    vx: -1.2, vy: 0,
    w: 28, h: 28,
    onGround: false,
    dead: false, deadTimer: 0,
  }));

  scoreEl.textContent  = '0';
  coinsEl.textContent  = '0';
  timerEl.textContent  = '300';
  updateLives();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) { doGameOver(); }
  }, 1000);

  overlay.style.display = 'none';
  if (!rafId) loop();
}

/* ── 게임 오버 / 클리어 ── */
function doGameOver() {
  gameRunning = false;
  clearInterval(timerInterval);
  setTimeout(() => {
    ovTitle.textContent = 'GAME OVER';
    ovMsg.innerHTML = `스코어: <strong>${score.toLocaleString()}</strong><br>코인: ${coins}개`;
    startBtn.textContent = '다시 시작';
    overlay.style.display = 'flex';
  }, 500);
}

function doClear() {
  gameRunning = false;
  clearInterval(timerInterval);
  score += timeLeft * 50;
  scoreEl.textContent = score.toLocaleString();
  setTimeout(() => {
    ovTitle.textContent = '🏆 COURSE CLEAR!';
    ovMsg.innerHTML = `최종 스코어: <strong>${score.toLocaleString()}</strong><br>코인: ${coins}개 · 남은 시간: ${timeLeft}초`;
    startBtn.textContent = '다시 시작';
    overlay.style.display = 'flex';
  }, 600);
}

/* ── 렌더 ── */
function drawBg() {
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, '#5c94fc');
  sky.addColorStop(1, '#9bb8ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  // 구름
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const clouds = [[80,50],[230,40],[420,55],[580,38],[750,52]];
  for (const [cx, cy] of clouds) {
    const rx = ((cx - camX * 0.3) % (CW + 120) + CW + 120) % (CW + 120) - 60;
    drawCloud(rx, cy);
  }
}

function drawCloud(cx, cy) {
  ctx.beginPath(); ctx.arc(cx,      cy,      24, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+28,   cy,      20, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+14,   cy-16,   18, 0, Math.PI*2); ctx.fill();
}

function drawTiles() {
  const startCol = Math.max(0, Math.floor(camX / T));
  const endCol   = Math.min(GW - 1, startCol + Math.ceil(CW / T) + 1);
  const startRow = 0, endRow = MAP_ROWS - 1;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const t  = getTile(row, col);
      const sx = col * T - camX;
      const sy = row * T;
      if (t === 0) continue;
      drawTile(t, sx, sy, row, col);
    }
  }
}

function drawTile(t, sx, sy, row, col) {
  ctx.save();
  switch (t) {
    case 1: { // 지면
      const isTop = (row === 0 || !isSolid(getTile(row - 1, col)));
      if (isTop) {
        ctx.fillStyle = '#84c56a';
        ctx.fillRect(sx, sy, T, 8);
        ctx.fillStyle = '#64a842';
        ctx.fillRect(sx, sy + 8, T, T - 8);
      } else {
        ctx.fillStyle = '#7b5c3e';
        ctx.fillRect(sx, sy, T, T);
      }
      // 그리드 라인
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx, sy, T, T);
      break;
    }
    case 2: { // 벽돌
      ctx.fillStyle = '#c84b11';
      ctx.fillRect(sx, sy, T, T);
      ctx.fillStyle = '#8b3209';
      ctx.fillRect(sx, sy + T/2 - 2, T, 4);
      ctx.fillRect(sx + T/2 - 2, sy, 4, T/2 - 2);
      ctx.fillRect(sx + 2, sy + T/2 + 2, T/2 - 2, T/2 - 4);
      ctx.fillRect(sx + T/2 + 2, sy + T/2 + 2, T/2 - 4, T/2 - 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.5; ctx.strokeRect(sx, sy, T, T);
      break;
    }
    case 3: { // ? 블록
      ctx.fillStyle = '#e8c000';
      ctx.fillRect(sx, sy, T, T);
      ctx.fillStyle = '#f4d000';
      ctx.fillRect(sx + 2, sy + 2, T - 4, T/2 - 2);
      ctx.fillStyle = '#a88000';
      ctx.fillRect(sx, sy + T - 4, T, 4);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${T-8}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', sx + T/2, sy + T/2);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1; ctx.strokeRect(sx, sy, T, T);
      break;
    }
    case 6: { // 사용된 ? 블록
      ctx.fillStyle = '#b8a070';
      ctx.fillRect(sx, sy, T, T);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1; ctx.strokeRect(sx, sy, T, T);
      break;
    }
    case 4: { // 파이프 하단
      const grd = ctx.createLinearGradient(sx, 0, sx + T*2, 0);
      grd.addColorStop(0, '#00a000'); grd.addColorStop(0.4, '#00c800'); grd.addColorStop(1, '#005000');
      ctx.fillStyle = grd;
      ctx.fillRect(sx, sy, T*2, T);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1; ctx.strokeRect(sx, sy, T*2, T);
      break;
    }
    case 5: { // 파이프 상단 (캡)
      const grd2 = ctx.createLinearGradient(sx - 4, 0, sx + T*2 + 4, 0);
      grd2.addColorStop(0, '#00a000'); grd2.addColorStop(0.3, '#00c800'); grd2.addColorStop(1, '#004000');
      ctx.fillStyle = grd2;
      ctx.fillRect(sx - 4, sy, T*2 + 8, T);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1; ctx.strokeRect(sx - 4, sy, T*2 + 8, T);
      break;
    }
  }
  ctx.restore();
}

function drawMario() {
  const sx = mario.x - camX;
  const sy = mario.y;
  const w = mario.w, h = mario.h;
  const blink = hurtCooldown > 0 && Math.floor(hurtCooldown / 5) % 2 === 0;
  if (blink) return;

  ctx.save();
  if (mario.dir < 0) { ctx.translate(sx + w/2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + w/2), 0); }

  // 몸 (파란 오버롤)
  ctx.fillStyle = '#003fb5';
  ctx.fillRect(sx + 2, sy + 14, w - 4, h - 14);

  // 셔츠 (빨간)
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(sx + 2, sy + 10, w - 4, 10);

  // 얼굴
  ctx.fillStyle = '#ffaa7f';
  ctx.fillRect(sx + 4, sy + 4, w - 8, 12);

  // 모자 (빨간)
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(sx + 2, sy, w - 2, 8);
  ctx.fillRect(sx, sy + 6, w + 2, 4);

  // 수염
  ctx.fillStyle = '#7a4000';
  ctx.fillRect(sx + 6, sy + 11, 12, 3);

  // 눈
  ctx.fillStyle = '#000';
  ctx.fillRect(sx + w - 10, sy + 6, 3, 3);

  // 신발 (갈색)
  ctx.fillStyle = '#7a4000';
  ctx.fillRect(sx + 1,  sy + h - 8, 10, 8);
  ctx.fillRect(sx + 13, sy + h - 8, 10, 8);

  // 팔
  ctx.fillStyle = '#ffaa7f';
  ctx.fillRect(sx - 4, sy + 10, 6, 10);
  ctx.fillRect(sx + w - 2, sy + 10, 6, 10);

  ctx.restore();
}

function drawGoombas() {
  for (const g of goombas) {
    const sx = g.x - camX;
    if (sx + g.w < -10 || sx > CW + 10) continue;
    ctx.save();
    if (g.dead) {
      ctx.globalAlpha = 0.7;
      // 납작해진 굼바
      ctx.fillStyle = '#c84b11';
      ctx.fillRect(sx, g.y + g.h - 10, g.w, 10);
    } else {
      // 몸
      ctx.fillStyle = '#c84b11';
      ctx.beginPath(); ctx.ellipse(sx + g.w/2, g.y + g.h*0.6, g.w/2, g.h*0.55, 0, 0, Math.PI*2); ctx.fill();
      // 발 (걷기 애니)
      ctx.fillStyle = '#7a2a00';
      const step = Math.floor(Date.now() / 150) % 2;
      ctx.fillRect(sx + (step?2:8),  g.y + g.h - 10, 10, 10);
      ctx.fillRect(sx + (step?14:6), g.y + g.h - 10, 10, 10);
      // 눈
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 5, g.y + 6, 8, 7);
      ctx.fillRect(sx + 17, g.y + 6, 8, 7);
      ctx.fillStyle = '#000';
      ctx.fillRect(sx + 10, g.y + 7, 4, 5);
      ctx.fillRect(sx + 22, g.y + 7, 4, 5);
      // 눈썹
      ctx.fillStyle = '#000';
      ctx.save();
      ctx.translate(sx + 9, g.y + 6);
      ctx.rotate(-0.3); ctx.fillRect(-4, 0, 8, 2); ctx.restore();
      ctx.save();
      ctx.translate(sx + 21, g.y + 6);
      ctx.rotate(0.3); ctx.fillRect(-4, 0, 8, 2); ctx.restore();
    }
    ctx.restore();
  }
}

function drawFlag() {
  const sx = FLAG_X - camX;
  if (sx < -20 || sx > CW + 20) return;

  ctx.save();
  // 기둥
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(sx, CH - MAP_ROWS * T + 16, 6, CH);

  // 깃발
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(sx + 6, CH - MAP_ROWS * T + 16);
  ctx.lineTo(sx + 40, CH - MAP_ROWS * T + 36);
  ctx.lineTo(sx + 6,  CH - MAP_ROWS * T + 56);
  ctx.closePath(); ctx.fill();

  // 꼭대기 공
  ctx.fillStyle = '#d4af37';
  ctx.beginPath(); ctx.arc(sx + 3, CH - MAP_ROWS * T + 16, 8, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawParticlesAll() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - camX, p.y, p.size, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  for (const b of brickParticles) {
    ctx.save();
    ctx.globalAlpha = b.life;
    ctx.fillStyle = '#c84b11';
    ctx.fillRect(b.x - camX, b.y, b.w, b.h);
    ctx.restore();
  }
  for (const c of coinItems) {
    ctx.save();
    ctx.globalAlpha = c.life;
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 8; ctx.shadowColor = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪙', c.x - camX, c.y);
    ctx.restore();
  }
}

/* ── 메인 루프 ── */
let rafId = null;

function loop() {
  if (!gameRunning) { rafId = null; return; }

  /* 입력 */
  if (keys['ArrowLeft'])  { mario.vx = -4.5; mario.dir = -1; }
  else if (keys['ArrowRight']) { mario.vx = 4.5; mario.dir = 1; }
  else mario.vx *= 0.7;

  /* 마리오 이동 */
  moveEntity(mario, 0.55);
  if (hurtCooldown > 0) hurtCooldown--;

  /* 카메라 */
  camX = Math.max(0, mario.x - CW * 0.35);
  camX = Math.min(camX, GW * T - CW);

  /* 굼바 */
  updateGoombas();

  /* 구덩이 낙사 */
  if (mario.y > CH + 60) hurtMario();

  /* 깃발 도달 */
  if (mario.x + mario.w > FLAG_X && mario.x < FLAG_X + 30) {
    doClear();
    return;
  }

  /* 파티클 */
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = brickParticles.length - 1; i >= 0; i--) {
    const b = brickParticles[i]; b.x += b.vx; b.y += b.vy; b.vy += 0.2; b.life -= 0.025;
    if (b.life <= 0) brickParticles.splice(i, 1);
  }
  for (let i = coinItems.length - 1; i >= 0; i--) {
    const c = coinItems[i]; c.y += c.vy; c.vy += 0.4; c.life -= 0.025;
    if (c.life <= 0) coinItems.splice(i, 1);
  }

  /* 렌더 */
  ctx.clearRect(0, 0, CW, CH);
  drawBg();
  drawTiles();
  drawFlag();
  drawParticlesAll();
  drawGoombas();
  drawMario();

  rafId = requestAnimationFrame(loop);
}

/* ── 시작 버튼 ── */
startBtn.addEventListener('click', initGame);

/* ── 초기 렌더 ── */
ctx.clearRect(0, 0, CW, CH);
(()=>{
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, '#5c94fc'); sky.addColorStop(1, '#9bb8ff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
})();
