/* ── game25.js — 피카츄 배구 ── */
'use strict';

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovMsg   = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const scorePEl = document.getElementById('scoreP');
const scoreAEl = document.getElementById('scoreA');
const setInfoEl = document.getElementById('setInfo');

const CW = 480, CH = 300;
canvas.width = CW; canvas.height = CH;

/* ── 상수 ── */
const GROUND    = CH - 48;
const NET_X     = CW / 2;
const NET_H     = 60;
const NET_TOP   = GROUND - NET_H;
const GRAVITY   = 0.55;
const BALL_R    = 14;
const CHAR_R    = 26;
const WIN_SCORE = 5;

/* ── 상태 ── */
let scoreP = 0, scoreA = 0;
let setNum = 1;
let gameRunning = false;
let serveLeft = true;   // 서브 방향
let rallyActive = false;
let touchCountP = 0, touchCountA = 0;
let particles = [];
let flashTimer = 0, flashWinner = '';

/* ── 캐릭터 ── */
const player = { x: 110, y: GROUND, vy: 0, vx: 0, onGround: true, facing: 1, isP: true };
const ai     = { x: 370, y: GROUND, vy: 0, vx: 0, onGround: true, facing: -1, isP: false };

/* ── 공 ── */
const ball = { x: 0, y: 0, vx: 0, vy: 0 };

/* ── 키 ── */
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'z' || e.key === 'Z') {
    if (gameRunning && player.onGround) {
      player.vy = -13.5;
      player.onGround = false;
    }
  }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

/* ── 초기화 ── */
function initGame() {
  scoreP = 0; scoreA = 0; setNum = 1;
  serveLeft = true;
  gameRunning = true;
  particles = [];
  updateHUD();
  servePoint();
  overlay.style.display = 'none';
  if (!rafId) loop();
}

function servePoint() {
  rallyActive = false;
  touchCountP = 0; touchCountA = 0;

  // 위치 리셋
  player.x = 110; player.y = GROUND; player.vy = 0; player.vx = 0; player.onGround = true;
  ai.x     = 370; ai.y     = GROUND; ai.vy     = 0; ai.vx     = 0; ai.onGround     = true;

  // 공 서브 위치
  if (serveLeft) {
    ball.x = 130; ball.y = GROUND - 80;
    ball.vx = 4.5; ball.vy = -8;
  } else {
    ball.x = 350; ball.y = GROUND - 80;
    ball.vx = -4.5; ball.vy = -8;
  }

  setTimeout(() => { rallyActive = true; }, 600);
}

function updateHUD() {
  scorePEl.textContent = scoreP;
  scoreAEl.textContent = scoreA;
  setInfoEl.textContent = `SET ${setNum}`;
}

/* ── 파티클 ── */
function spawnParticles(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 2 + Math.random() * 5;
    particles.push({ x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 2,
                     life: 1, decay: 0.03+Math.random()*0.04, size: 3+Math.random()*4, color });
  }
}

/* ── 물리 업데이트 ── */
function updateCharacter(ch) {
  ch.vy += GRAVITY;
  ch.x  += ch.vx;
  ch.y  += ch.vy;
  ch.vx *= 0.85;

  if (ch.y >= GROUND) {
    ch.y = GROUND; ch.vy = 0; ch.onGround = true;
  }

  // 코트 경계
  const minX = CHAR_R + (ch.isP ? 2 : NET_X + 4);
  const maxX = (ch.isP ? NET_X - 4 : CW - 2) - CHAR_R;
  if (ch.x < minX) ch.x = minX;
  if (ch.x > maxX) ch.x = maxX;
}

function updateBall() {
  if (!rallyActive) return;

  ball.vy += GRAVITY * 0.8;
  ball.x  += ball.vx;
  ball.y  += ball.vy;

  // 속도 제한
  const spd = Math.sqrt(ball.vx**2 + ball.vy**2);
  if (spd > 22) { ball.vx = ball.vx/spd*22; ball.vy = ball.vy/spd*22; }

  // 좌우 벽
  if (ball.x - BALL_R < 2)         { ball.x = 2 + BALL_R;      ball.vx =  Math.abs(ball.vx)*0.8; }
  if (ball.x + BALL_R > CW - 2)    { ball.x = CW - 2 - BALL_R; ball.vx = -Math.abs(ball.vx)*0.8; }
  // 상단 벽
  if (ball.y - BALL_R < 20)        { ball.y = 20 + BALL_R;     ball.vy =  Math.abs(ball.vy)*0.7; }

  // 네트 충돌
  if (
    ball.x + BALL_R > NET_X - 5 &&
    ball.x - BALL_R < NET_X + 5 &&
    ball.y + BALL_R > NET_TOP
  ) {
    // 어느 쪽에서 왔는지 기준 반사
    if (ball.x < NET_X) { ball.x = NET_X - 5 - BALL_R; ball.vx = -Math.abs(ball.vx)*0.6; }
    else                 { ball.x = NET_X + 5 + BALL_R; ball.vx =  Math.abs(ball.vx)*0.6; }
    ball.vy *= 0.5;
  }

  // 캐릭터 충돌
  ballCharCollide(player, true);
  ballCharCollide(ai, false);

  // 땅에 닿으면 포인트 결정
  if (ball.y + BALL_R >= GROUND) {
    rallyActive = false;
    spawnParticles(ball.x, GROUND, '#f59e0b');
    if (ball.x < NET_X) {
      // 플레이어 코트에 떨어짐 → AI 득점
      scoreA++;
      serveLeft = false;
      flashWinner = 'AI';
    } else {
      // AI 코트에 떨어짐 → 플레이어 득점
      scoreP++;
      serveLeft = true;
      flashWinner = 'P';
    }
    flashTimer = 60;
    updateHUD();
    checkWin();
  }
}

function ballCharCollide(ch, isPlayer) {
  const dx = ball.x - ch.x;
  const dy = ball.y - (ch.y - CHAR_R * 0.6);
  const dist = Math.sqrt(dx*dx + dy*dy);
  const minDist = BALL_R + CHAR_R;

  if (dist < minDist && dist > 0.1) {
    const nx = dx / dist, ny = dy / dist;
    // 겹침 해소
    ball.x = ch.x + nx * (minDist + 1);
    ball.y = (ch.y - CHAR_R * 0.6) + ny * (minDist + 1);

    // 튕기기 - 캐릭터 속도 전달
    const relVx = ball.vx - ch.vx;
    const relVy = ball.vy - ch.vy;
    const dot = relVx * nx + relVy * ny;
    ball.vx -= 1.8 * dot * nx;
    ball.vy -= 1.8 * dot * ny;

    // 최소 위 방향 보장
    if (ball.vy > -2) ball.vy = -8;

    // 터치 카운트
    if (isPlayer) {
      touchCountP++;
      spawnParticles(ball.x, ball.y, '#facc15');
    } else {
      touchCountA++;
      spawnParticles(ball.x, ball.y, '#f87171');
    }
  }
}

/* ── 승리 판정 ── */
function checkWin() {
  if (scoreP >= WIN_SCORE || scoreA >= WIN_SCORE) {
    const pWon = scoreP >= WIN_SCORE;
    gameRunning = false;
    setTimeout(() => {
      ovTitle.textContent = pWon ? '🏆 승리!' : '😔 패배';
      ovMsg.innerHTML = pWon
        ? `축하해요! ${scoreP} : ${scoreA} 로 이겼습니다!`
        : `AI가 이겼습니다. ${scoreP} : ${scoreA}<br>다시 도전!`;
      startBtn.textContent = '다시 시작';
      overlay.style.display = 'flex';
    }, 800);
  } else {
    setTimeout(servePoint, 900);
  }
}

/* ── AI 로직 ── */
function updateAI() {
  if (!rallyActive) return;

  const target = ball.x;
  const diff   = target - ai.x;
  const speed  = 3.5;

  if (Math.abs(diff) > 8) {
    ai.vx = Math.sign(diff) * Math.min(speed, Math.abs(diff) * 0.15);
    ai.facing = Math.sign(diff);
  }

  // 점프 판단: 공이 AI 코트에 있고 내려오는 중이면 점프
  if (
    ball.x > NET_X &&
    ball.vy > 0 &&
    ball.y < GROUND - 60 &&
    Math.abs(ball.x - ai.x) < 80 &&
    ai.onGround
  ) {
    ai.vy = -13;
    ai.onGround = false;
  }
}

/* ── 플레이어 입력 ── */
function updatePlayer() {
  const spd = 4.5;
  if (keys['ArrowLeft'])  { player.vx = -spd; player.facing = -1; }
  if (keys['ArrowRight']) { player.vx =  spd; player.facing =  1; }
}

/* ── 렌더링 ── */
function drawBg() {
  // 하늘
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#0d1b4b');
  sky.addColorStop(1, '#1a3a6b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, GROUND);

  // 구름
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  [[60,50,40],[160,30,55],[300,45,45],[400,25,50]].forEach(([cx,cy,r]) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+30, cy+10, r*0.7, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx-25, cy+8, r*0.6, 0, Math.PI*2); ctx.fill();
  });

  // 코트 바닥
  const ground = ctx.createLinearGradient(0, GROUND, 0, CH);
  ground.addColorStop(0, '#1e8c3a');
  ground.addColorStop(0.3, '#166b2e');
  ground.addColorStop(1, '#0f4a1f');
  ctx.fillStyle = ground;
  ctx.fillRect(0, GROUND, CW, CH - GROUND);

  // 코트 라인
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2, GROUND); ctx.lineTo(CW-2, GROUND); ctx.stroke();
  // 센터 라인 (점선)
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.moveTo(NET_X, GROUND + 5); ctx.lineTo(NET_X, CH); ctx.stroke();
  ctx.setLineDash([]);
}

function drawNet() {
  // 네트 기둥
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(NET_X - 4, NET_TOP, 8, NET_H);

  // 네트 줄
  ctx.strokeStyle = 'rgba(229,231,235,0.6)';
  ctx.lineWidth = 1;
  for (let y = NET_TOP + 8; y < GROUND; y += 10) {
    ctx.beginPath();
    ctx.moveTo(NET_X - 4, y);
    ctx.lineTo(NET_X + 4, y);
    ctx.stroke();
  }

  // 상단 흰 띠
  ctx.fillStyle = '#fff';
  ctx.fillRect(NET_X - 5, NET_TOP, 10, 6);
}

function drawPikachu(x, y, color, facing, isAI) {
  ctx.save();
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);

  const fy = -CHAR_R * 1.1;  // 몸 중심 y (발 기준 위로)

  // 꼬리
  ctx.save();
  ctx.strokeStyle = color === 'yellow' ? '#f59e0b' : '#dc2626';
  ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, fy + 4);
  ctx.quadraticCurveTo(-28, fy - 8, -22, fy - 22);
  ctx.quadraticCurveTo(-14, fy - 30, -4, fy - 20);
  ctx.stroke();

  // 귀
  const earColor = color === 'yellow' ? '#facc15' : '#fca5a5';
  const earTip   = '#1a1a1a';
  // 왼쪽 귀
  ctx.fillStyle = earTip;
  ctx.beginPath();
  ctx.moveTo(-10, fy - CHAR_R);
  ctx.lineTo(-16, fy - CHAR_R - 28);
  ctx.lineTo(-4,  fy - CHAR_R - 20);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = earColor;
  ctx.beginPath();
  ctx.moveTo(-10, fy - CHAR_R + 2);
  ctx.lineTo(-14, fy - CHAR_R - 20);
  ctx.lineTo(-5,  fy - CHAR_R - 14);
  ctx.closePath(); ctx.fill();
  // 오른쪽 귀
  ctx.fillStyle = earTip;
  ctx.beginPath();
  ctx.moveTo(10, fy - CHAR_R);
  ctx.lineTo(16, fy - CHAR_R - 28);
  ctx.lineTo(4,  fy - CHAR_R - 20);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = earColor;
  ctx.beginPath();
  ctx.moveTo(10, fy - CHAR_R + 2);
  ctx.lineTo(14, fy - CHAR_R - 20);
  ctx.lineTo(5,  fy - CHAR_R - 14);
  ctx.closePath(); ctx.fill();

  // 몸통
  const bodyColor = color === 'yellow' ? '#facc15' : '#fca5a5';
  ctx.fillStyle = bodyColor;
  ctx.shadowBlur = 8;
  ctx.shadowColor = color === 'yellow' ? 'rgba(250,204,21,0.5)' : 'rgba(252,165,165,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, fy + 6, CHAR_R * 0.75, CHAR_R * 0.85, 0, 0, Math.PI*2);
  ctx.fill();

  // 얼굴
  ctx.shadowBlur = 0;
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.arc(0, fy, CHAR_R, 0, Math.PI*2);
  ctx.fill();

  // 볼 빨간 원
  ctx.fillStyle = color === 'yellow' ? '#f87171' : '#fbbf24';
  ctx.beginPath(); ctx.ellipse(12, fy + 4, 6, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-12, fy + 4, 6, 4, 0, 0, Math.PI*2); ctx.fill();

  // 눈
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(7, fy - 4, 3.5, 4, 0, 0, Math.PI*2); ctx.fill();
  // 눈 광택
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(8.5, fy - 5.5, 1.2, 0, Math.PI*2); ctx.fill();

  // 코
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(3, fy + 1, 2, 1.5, 0, 0, Math.PI*2); ctx.fill();

  // 입
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, fy + 5);
  ctx.quadraticCurveTo(3, fy + 9, 8, fy + 5);
  ctx.stroke();

  // 전기 효과 (AI는 빨간색)
  if (!isAI) {
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) {
      const bx = -20 + i * 20, by = fy - 15 - i * 5;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx+5, by-5); ctx.lineTo(bx+2, by-10); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawBall() {
  ctx.save();
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(ball.x, GROUND + 4, BALL_R * 0.8, 4, 0, 0, Math.PI*2); ctx.fill();

  // 배구공
  ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(255,255,255,0.4)';
  const grad = ctx.createRadialGradient(ball.x - 4, ball.y - 4, 0, ball.x, ball.y, BALL_R);
  grad.addColorStop(0, '#fff9e6');
  grad.addColorStop(0.6, '#fde68a');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2); ctx.fill();

  // 배구공 라인
  ctx.strokeStyle = 'rgba(180,100,0,0.5)';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2); ctx.stroke();
  // 수직선
  ctx.beginPath(); ctx.moveTo(ball.x, ball.y - BALL_R); ctx.lineTo(ball.x, ball.y + BALL_R); ctx.stroke();
  // 곡선
  ctx.beginPath();
  ctx.arc(ball.x + 5, ball.y, BALL_R - 2, -Math.PI*0.4, Math.PI*0.4);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 6; ctx.shadowColor = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawFlash() {
  if (flashTimer <= 0) return;
  const alpha = (flashTimer / 60) * 0.3;
  ctx.fillStyle = flashWinner === 'P'
    ? `rgba(250,204,21,${alpha})`
    : `rgba(248,113,113,${alpha})`;
  ctx.fillRect(0, 0, CW, CH);

  // 득점 텍스트
  if (flashTimer > 30) {
    ctx.save();
    ctx.font = 'bold 28px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillStyle = flashWinner === 'P' ? '#facc15' : '#f87171';
    ctx.shadowBlur = 20; ctx.shadowColor = ctx.fillStyle;
    ctx.fillText(flashWinner === 'P' ? '득점! ⚡' : 'AI 득점!', CW / 2, CH / 2 - 10);
    ctx.restore();
  }
}

/* ── 메인 루프 ── */
let rafId = null;

function loop() {
  if (!gameRunning) { rafId = null; return; }

  // 업데이트
  updatePlayer();
  updateAI();
  updateCharacter(player);
  updateCharacter(ai);
  updateBall();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.2;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  if (flashTimer > 0) flashTimer--;

  // 렌더
  ctx.clearRect(0, 0, CW, CH);
  drawBg();
  drawNet();
  drawParticles();
  drawPikachu(player.x, player.y, 'yellow', player.facing, false);
  drawPikachu(ai.x,     ai.y,     'red',    ai.facing,     true);
  drawBall();
  drawFlash();

  rafId = requestAnimationFrame(loop);
}

/* ── 시작 버튼 ── */
startBtn.addEventListener('click', initGame);

/* ── 초기 렌더 ── */
ctx.clearRect(0, 0, CW, CH);
drawBg();
drawNet();
drawPikachu(110, GROUND, 'yellow', 1, false);
drawPikachu(370, GROUND, 'red', -1, true);
