/* ── game20.js — 엔드리스 러너 ── */

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const scoreEl  = document.getElementById('scoreEl');
const bestEl   = document.getElementById('bestEl');
const speedEl  = document.getElementById('speedEl');
const overlay  = document.getElementById('overlay');
const ovTitle  = document.getElementById('ovTitle');
const ovMsg    = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');

const GROUND_Y   = H - 56;
const GRAVITY    = 0.6;
const JUMP_FORCE = -13;

/* ── 상태 ── */
let player, obstacles, particles, bgLayers;
let score, speed, animId, gameRunning, frame;
let best = parseInt(localStorage.getItem('runner_best') || '0');

bestEl.textContent = best;

/* ── 배경 레이어 ── */
function initBg() {
  bgLayers = [
    /* 별 */
    { items: Array.from({length:60}, () => ({ x:Math.random()*W, y:Math.random()*(GROUND_Y-30), r:Math.random()*1.2+0.3, a:Math.random()*0.6+0.2 })), speed:0.3, type:'stars' },
    /* 먼 산 */
    { pts: makeMountain(8, 0.25, 0.55), offset:0, speed:0.5, color:'rgba(60,30,120,0.5)', type:'poly' },
    /* 가까운 산 */
    { pts: makeMountain(6, 0.45, 0.72), offset:0, speed:1.0, color:'rgba(40,20,90,0.7)', type:'poly' },
  ];
}

function makeMountain(count, yMin, yMax) {
  const pts = [];
  const step = W / count;
  for (let i = 0; i <= count; i++) {
    pts.push({ x: i * step, y: GROUND_Y * (yMin + Math.random() * (yMax - yMin)) });
  }
  return pts;
}

/* ── 플레이어 ── */
function createPlayer() {
  return {
    x: 80, y: GROUND_Y - 32,
    w: 28, h: 32,
    vy: 0, jumps: 0, maxJumps: 2,
    onGround: true,
    squash: 1, squashVy: 0,
    trailTimer: 0,
  };
}

function playerJump() {
  if (!gameRunning || player.jumps >= player.maxJumps) return;
  player.vy = JUMP_FORCE - (player.jumps * 1.5);
  player.jumps++;
  player.onGround = false;
  player.squash = 0.6;
  addDustParticles(player.x + player.w/2, player.y + player.h);
}

function updatePlayer() {
  player.vy += GRAVITY;
  player.y += player.vy;

  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    player.jumps = 0;
  }

  /* squash & stretch */
  player.squash += (1 - player.squash) * 0.22;

  /* trail */
  player.trailTimer++;
  if (player.trailTimer % 3 === 0) {
    particles.push({ x: player.x + player.w/2, y: player.y + player.h/2, vx: -speed*0.5, vy: 0, r: 8, life: 1, decay: 0.07, color: '#7c3aed', type:'trail' });
  }
}

function drawPlayer() {
  const cx = player.x + player.w/2;
  const cy = player.y + player.h/2;
  const sx = 1 / player.squash;
  const sy = player.squash;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sx, sy);

  /* glow */
  ctx.shadowBlur = 16;
  ctx.shadowColor = '#a78bfa';

  /* body */
  const g = ctx.createLinearGradient(-player.w/2, -player.h/2, player.w/2, player.h/2);
  g.addColorStop(0, '#c4b5fd');
  g.addColorStop(1, '#7c3aed');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-player.w/2, -player.h/2, player.w, player.h, 7);
  ctx.fill();

  /* visor */
  ctx.fillStyle = '#06b6d4';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(-player.w/2+4, -player.h/2+6, player.w-8, 9, 4);
  ctx.fill();

  /* legs animation */
  const legAnim = player.onGround ? Math.sin(frame * 0.4) * 5 : 0;
  ctx.fillStyle = '#5b21b6';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.roundRect(-player.w/2+2, player.h/2-8, 10, 8+legAnim, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(player.w/2-12, player.h/2-8, 10, 8-legAnim, 3);
  ctx.fill();

  ctx.restore();
}

/* ── 장애물 ── */
const OBS_TYPES = [
  { w:22, h:44, color:'#ef4444', glow:'rgba(239,68,68,0.6)', shape:'spike' },
  { w:32, h:32, color:'#f59e0b', glow:'rgba(245,158,11,0.6)', shape:'box'   },
  { w:18, h:62, color:'#ec4899', glow:'rgba(236,72,153,0.6)', shape:'tall'  },
  { w:50, h:22, color:'#06b6d4', glow:'rgba(6,182,212,0.6)',  shape:'wide'  },
];

function spawnObstacle() {
  const t = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
  /* floating obstacles at higher scores */
  const floatOk = score > 300 && Math.random() < 0.25;
  const yOffset = floatOk ? -(Math.random() * 60 + 30) : 0;
  obstacles.push({
    x: W + 20, y: GROUND_Y - t.h + yOffset,
    w: t.w, h: t.h,
    color: t.color, glow: t.glow, shape: t.shape,
  });
}

function drawObstacle(o) {
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = o.glow;

  if (o.shape === 'spike') {
    const g = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.3, o.color);
    g.addColorStop(1, o.color + '88');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w/2, o.y);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.lineTo(o.x, o.y + o.h);
    ctx.closePath();
    ctx.fill();
  } else {
    const g = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
    g.addColorStop(0, o.color + 'cc');
    g.addColorStop(1, o.color + '44');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, o.w, o.h, 5);
    ctx.fill();

    /* shine */
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(o.x + 3, o.y + 3, o.w - 6, 4);
  }
  ctx.restore();
}

/* ── 파티클 ── */
function addDustParticles(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({ x, y, vx:(Math.random()-0.5)*4, vy:-Math.random()*3-1, r:4, life:1, decay:0.08, color:'#a78bfa', type:'dust' });
  }
}

function addExplosion(x, y) {
  for (let i = 0; i < 20; i++) {
    const a = (Math.PI*2*i/20) + Math.random()*0.3;
    particles.push({ x, y, vx:Math.cos(a)*( Math.random()*5+2), vy:Math.sin(a)*(Math.random()*5+2), r:Math.random()*6+2, life:1, decay:Math.random()*0.05+0.03, color:['#ef4444','#f59e0b','#ec4899','#a78bfa'][i%4], type:'exp' });
  }
}

/* ── 지면 장식 ── */
let groundOffset = 0;
function drawGround() {
  /* base line */
  ctx.strokeStyle = 'rgba(124,58,237,0.6)';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#7c3aed';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* dashes */
  groundOffset = (groundOffset + speed) % 40;
  ctx.strokeStyle = 'rgba(124,58,237,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([20, 20]);
  ctx.lineDashOffset = -groundOffset;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y + 8);
  ctx.lineTo(W, GROUND_Y + 8);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* ── 배경 ── */
function drawBg() {
  /* sky gradient */
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#03010a');
  sky.addColorStop(1, '#0d0520');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y);

  bgLayers.forEach(layer => {
    if (layer.type === 'stars') {
      layer.items.forEach(s => {
        s.x -= layer.speed;
        if (s.x < 0) s.x = W + s.r;
        ctx.globalAlpha = s.a;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else if (layer.type === 'poly') {
      layer.offset = (layer.offset + layer.speed * speed / 6) % W;
      drawMountain(layer);
    }
  });

  /* floor */
  ctx.fillStyle = 'rgba(10,5,25,0.9)';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
}

function drawMountain(layer) {
  const { pts, offset, color } = layer;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);

  pts.forEach((p, i) => {
    const x = ((p.x - offset + W) % W);
    const xPrev = ((pts[i > 0 ? i-1 : pts.length-1].x - offset + W) % W);
    if (i === 0) {
      ctx.lineTo(x, p.y);
    } else {
      const mx = (xPrev + x) / 2;
      ctx.quadraticCurveTo(xPrev, pts[i-1].y, mx, (pts[i-1].y + p.y)/2);
    }
  });

  ctx.lineTo(W, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

/* ── 충돌 체크 ── */
function checkCollision() {
  const px = player.x + 4, py = player.y + 4;
  const pw = player.w - 8, ph = player.h - 4;
  for (const o of obstacles) {
    if (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y) {
      return true;
    }
  }
  return false;
}

/* ── 게임 루프 ── */
let lastObstacle = 0;
function loop() {
  frame++;

  /* 점수·속도 */
  score += speed * 0.1;
  speed = 5 + Math.floor(score / 200) * 0.4;
  speed = Math.min(speed, 14);

  scoreEl.textContent = Math.floor(score);
  speedEl.textContent = (speed / 5).toFixed(1) + 'x';

  /* 그리기 */
  drawBg();
  drawGround();

  /* 파티클 */
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    if (p.type !== 'trail') p.vy += 0.15;
    p.life -= p.decay; p.r *= 0.95;
    if (p.life <= 0) return false;

    ctx.globalAlpha = p.type === 'trail' ? p.life * 0.3 : p.life;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, p.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r*2, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return true;
  });

  /* 장애물 */
  lastObstacle++;
  const spawnGap = Math.max(55, 110 - Math.floor(score / 100) * 3);
  if (lastObstacle > spawnGap) {
    spawnObstacle();
    lastObstacle = 0;
  }
  obstacles = obstacles.filter(o => { o.x -= speed; drawObstacle(o); return o.x + o.w > -10; });

  /* 플레이어 */
  updatePlayer();
  drawPlayer();

  /* 충돌 */
  if (checkCollision()) {
    addExplosion(player.x + player.w/2, player.y + player.h/2);
    endGame();
    return;
  }

  animId = requestAnimationFrame(loop);
}

/* ── 시작 / 종료 ── */
function startGame() {
  if (animId) cancelAnimationFrame(animId);
  player = createPlayer();
  obstacles = []; particles = [];
  score = 0; speed = 5; frame = 0; lastObstacle = 0;
  gameRunning = true;
  initBg();
  overlay.style.display = 'none';
  animId = requestAnimationFrame(loop);
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animId);
  /* draw final explosion */
  function drawExplosionFrame() {
    particles = particles.filter(p => {
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life-=p.decay; p.r*=0.93;
      if (p.life<=0) return false;
      ctx.globalAlpha=p.life;
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*2,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      return true;
    });
    if (particles.length>0) requestAnimationFrame(drawExplosionFrame);
    else showGameOver();
  }
  drawExplosionFrame();
}

function showGameOver() {
  const s = Math.floor(score);
  if (s > best) { best = s; localStorage.setItem('runner_best', best); bestEl.textContent = best; }
  ovTitle.textContent = '게임 오버';
  ovMsg.innerHTML = `점수: <strong>${s.toLocaleString()}</strong><br>최고기록: <strong>${best.toLocaleString()}</strong>`;
  startBtn.textContent = '다시 하기';
  overlay.style.display = 'flex';
}

/* ── 입력 ── */
document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); gameRunning ? playerJump() : null; }
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (gameRunning) playerJump();
}, { passive: false });
canvas.addEventListener('mousedown', () => { if (gameRunning) playerJump(); });
startBtn.addEventListener('click', startGame);
