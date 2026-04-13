/* ── game27.js — 메탈 슬러그 ── */
'use strict';

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovMsg   = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('scoreEl');
const livesEl = document.getElementById('livesEl');
const ammoEl  = document.getElementById('ammoEl');
const waveEl  = document.getElementById('waveEl');

const CW = 560, CH = 320;
canvas.width = CW; canvas.height = CH;

/* ── 지형 상수 ── */
const GROUND_Y  = CH - 60;
const PLATFORM_H = 16;

/* ── 플랫폼 정의 ── */
const PLATFORMS = [
  { x: 0,   y: GROUND_Y, w: CW * 4, h: PLATFORM_H }, // 메인 바닥 (스크롤)
  { x: 150, y: GROUND_Y - 80,  w: 120, h: 16 },
  { x: 400, y: GROUND_Y - 90,  w: 100, h: 16 },
  { x: 680, y: GROUND_Y - 80,  w: 130, h: 16 },
  { x: 900, y: GROUND_Y - 100, w: 110, h: 16 },
  { x: 1200, y: GROUND_Y - 85, w: 140, h: 16 },
  { x: 1500, y: GROUND_Y - 95, w: 120, h: 16 },
];

/* ── 게임 상태 ── */
let score, lives, wave, gameRunning;
let camX = 0;
let bullets = [], grenades = [], explosions = [], particles = [], popups = [];
let enemies = [];
let shootCooldown = 0, grenadeCooldown = 0;
let hurtTimer = 0;
let waveTimer = 0, waveClear = false;
let totalKills = 0;

/* ── 플레이어 ── */
let hero = {};

/* ── 키 ── */
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if ((e.key === 'z' || e.key === 'Z' || e.key === ' ') && gameRunning) {
    if (hero.onGround) { hero.vy = -13; hero.onGround = false; }
  }
  if ((e.key === 'x' || e.key === 'X' || e.key === 'ArrowUp') && gameRunning) { shoot(); }
  if ((e.key === 'c' || e.key === 'C') && gameRunning) { throwGrenade(); }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

/* ── 초기화 ── */
function initGame() {
  score = 0; lives = 3; wave = 1; gameRunning = true;
  camX = 0; bullets = []; grenades = []; explosions = []; particles = []; popups = [];
  shootCooldown = 0; grenadeCooldown = 0; hurtTimer = 0;
  waveClear = false; totalKills = 0;

  hero = { x: 60, y: GROUND_Y - 44, vx: 0, vy: 0, w: 24, h: 44,
           onGround: false, dir: 1, animFrame: 0, animTimer: 0 };

  spawnWave(wave);
  updateHUD();
  overlay.style.display = 'none';
  if (!rafId) loop();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  livesEl.textContent = '❤️'.repeat(Math.max(0, lives));
  ammoEl.textContent  = '∞';
  waveEl.textContent  = wave;
}

/* ── 웨이브 생성 ── */
function spawnWave(w) {
  enemies = [];
  waveClear = false;
  const count = 4 + w * 2;
  for (let i = 0; i < count; i++) {
    const x = CW + 80 + i * (100 + Math.random() * 80);
    const isHeavy = w >= 3 && i % 3 === 0;
    const isTank  = w >= 5 && i % 5 === 0;
    enemies.push(makeEnemy(x, isHeavy, isTank));
  }
}

function makeEnemy(x, heavy = false, tank = false) {
  if (tank) {
    return {
      x, y: GROUND_Y - 48, vx: -0.6, vy: 0, w: 70, h: 48,
      hp: 8, maxHp: 8, onGround: false,
      type: 'tank', shootCd: 80, animTimer: 0
    };
  }
  if (heavy) {
    return {
      x, y: GROUND_Y - 50, vx: -(0.8 + Math.random()*0.4), vy: 0, w: 28, h: 50,
      hp: 3, maxHp: 3, onGround: false,
      type: 'heavy', shootCd: 60 + Math.floor(Math.random()*40), animTimer: 0
    };
  }
  return {
    x, y: GROUND_Y - 40, vx: -(1 + Math.random()*0.8), vy: 0, w: 22, h: 40,
    hp: 1, maxHp: 1, onGround: false,
    type: 'soldier', shootCd: 90 + Math.floor(Math.random()*60), animTimer: 0
  };
}

/* ── 사격 ── */
function shoot() {
  if (shootCooldown > 0) return;
  bullets.push({ x: hero.x + (hero.dir > 0 ? hero.w : 0), y: hero.y + hero.h * 0.35,
                 vx: 14 * hero.dir, vy: 0, owner: 'hero' });
  shootCooldown = 8;
  // 연사 파티클
  particles.push({ x: hero.x + (hero.dir > 0 ? hero.w + 10 : -10), y: hero.y + hero.h * 0.35,
                   vx: hero.dir * 4, vy: -1, life: 0.6, decay: 0.15, size: 4, color: '#fde68a' });
}

function throwGrenade() {
  if (grenadeCooldown > 0) return;
  grenades.push({ x: hero.x + hero.w/2, y: hero.y,
                  vx: 6 * hero.dir, vy: -10, bounces: 0 });
  grenadeCooldown = 45;
}

/* ── 폭발 ── */
function explode(x, y, r = 55) {
  explosions.push({ x, y, r, maxR: r, life: 1 });
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 3,
                     life: 1, decay: 0.025, size: 4+Math.random()*5,
                     color: Math.random() > 0.5 ? '#f97316' : '#fde68a' });
  }
  // 범위 내 적 피해
  for (const e of enemies) {
    const dx = (e.x + e.w/2) - x, dy = (e.y + e.h/2) - y;
    if (Math.sqrt(dx*dx+dy*dy) < r + e.w/2) damageEnemy(e, 3);
  }
}

/* ── 적 피해 ── */
function damageEnemy(e, dmg = 1) {
  if (e.hp <= 0) return;
  e.hp -= dmg;
  if (e.hp <= 0) {
    score += e.type === 'tank' ? 1000 : e.type === 'heavy' ? 400 : 200;
    scoreEl.textContent = score.toLocaleString();
    explodeEnemy(e);
    totalKills++;
  }
}

function explodeEnemy(e) {
  const cx = e.x + e.w/2, cy = e.y + e.h/2;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
    particles.push({ x: cx, y: cy, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2,
                     life: 1, decay: 0.03, size: 3+Math.random()*4,
                     color: Math.random() > 0.4 ? '#ef4444' : '#f97316' });
  }
  popups.push({ x: cx - camX, y: cy - 10, text: e.type === 'tank' ? '1000!' : e.type === 'heavy' ? '400!' : '200!', life: 1, vy: -1.2 });
}

/* ── 물리 ── */
function moveEntityMs(ent) {
  ent.vy += 0.55;
  if (ent.vy > 14) ent.vy = 14;
  ent.x += ent.vx;
  ent.y += ent.vy;
  ent.onGround = false;

  for (const p of PLATFORMS) {
    // 아래에 플랫폼
    if (
      ent.x + ent.w > p.x && ent.x < p.x + p.w &&
      ent.y + ent.h >= p.y && ent.y + ent.h <= p.y + p.h + Math.abs(ent.vy) + 2 &&
      ent.vy >= 0
    ) {
      ent.y = p.y - ent.h;
      ent.vy = 0;
      ent.onGround = true;
      break;
    }
  }
  // 화면 하단 낙사 방지
  if (ent.y > CH + 40 && ent !== hero) ent.hp = -999;
}

/* ── 적 업데이트 ── */
function updateEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) { enemies.splice(i, 1); continue; }
    moveEntityMs(e);

    e.shootCd--;
    if (e.shootCd <= 0) {
      e.shootCd = e.type === 'tank' ? 80 : e.type === 'heavy' ? 55 : 90;
      // 적 사격
      const bvx = e.x > hero.x ? -7 : 7;
      const bvy = e.type === 'tank' ? -1 : 0;
      bullets.push({ x: e.x + (bvx < 0 ? 0 : e.w), y: e.y + e.h * 0.4,
                     vx: bvx, vy: bvy, owner: 'enemy' });
    }

    // 마리오(히어로)와 접촉
    if (rectsOverlap(hero, e)) hurtHero();

    // 방향 전환
    if (e.onGround && e.type !== 'tank') {
      const lookAhead = e.x + (e.vx > 0 ? e.w + 10 : -10);
      const notOnGround = !PLATFORMS.some(p =>
        lookAhead > p.x && lookAhead < p.x + p.w &&
        Math.abs((e.y + e.h) - p.y) < 8
      );
      if (notOnGround || e.x < 0) e.vx *= -1;
    }
  }

  // 웨이브 클리어 체크
  if (enemies.length === 0 && !waveClear) {
    waveClear = true;
    waveTimer = 120;
  }
  if (waveClear) {
    waveTimer--;
    if (waveTimer <= 0) {
      wave++;
      if (wave > 8) {
        doVictory();
        return;
      }
      waveEl.textContent = wave;
      spawnWave(wave);
      popups.push({ x: CW/2, y: CH/2 - 30, text: `WAVE ${wave}!`, life: 1.5, vy: -0.5 });
    }
  }
}

/* ── 총알 업데이트 ── */
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx; b.y += b.vy;
    b.vy += 0.1;

    // 화면 밖
    if (b.x < camX - 20 || b.x > camX + CW + 20 || b.y > CH) {
      bullets.splice(i, 1); continue;
    }

    // 지형 충돌
    if (b.y + 4 >= GROUND_Y) { bullets.splice(i, 1); continue; }

    if (b.owner === 'hero') {
      // 적 맞춤 판정
      let hit = false;
      for (const e of enemies) {
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          damageEnemy(e, 1);
          hit = true;
          // 히트 스파크
          particles.push({ x: b.x, y: b.y, vx: (Math.random()-0.5)*4, vy: -2-Math.random()*2,
                           life: 0.7, decay: 0.1, size: 3, color: '#fde68a' });
          break;
        }
      }
      if (hit) { bullets.splice(i, 1); continue; }
    } else {
      // 플레이어 맞춤
      if (b.x > hero.x && b.x < hero.x + hero.w && b.y > hero.y && b.y < hero.y + hero.h) {
        hurtHero();
        bullets.splice(i, 1); continue;
      }
    }
  }
}

/* ── 수류탄 업데이트 ── */
function updateGrenades() {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.vy += 0.5; g.x += g.vx; g.y += g.vy;
    if (g.y + 8 >= GROUND_Y && g.bounces < 2) {
      g.y = GROUND_Y - 8; g.vy *= -0.5; g.vx *= 0.7; g.bounces++;
    } else if (g.y + 8 >= GROUND_Y || g.bounces >= 2) {
      explode(g.x, g.y);
      grenades.splice(i, 1);
    }
    if (g.x < camX - 100 || g.x > camX + CW + 100) grenades.splice(i, 1);
  }
}

/* ── 피해 ── */
function rectsOverlap(a, b) {
  return a.x < b.x + b.w - 4 && a.x + a.w > b.x + 4 &&
         a.y < b.y + b.h - 4 && a.y + a.h > b.y + 4;
}

function hurtHero() {
  if (hurtTimer > 0) return;
  lives--;
  updateHUD();
  hurtTimer = 100;
  if (lives <= 0) { gameRunning = false; setTimeout(doGameOver, 400); }
}

/* ── 종료 ── */
function doGameOver() {
  setTimeout(() => {
    ovTitle.textContent = 'MISSION FAILED';
    ovMsg.innerHTML = `스코어: <strong>${score.toLocaleString()}</strong><br>웨이브 ${wave} 도달 · 처치: ${totalKills}명`;
    startBtn.textContent = '다시 시작';
    overlay.style.display = 'flex';
  }, 300);
}

function doVictory() {
  gameRunning = false;
  setTimeout(() => {
    ovTitle.textContent = '🏆 MISSION COMPLETE!';
    ovMsg.innerHTML = `최종 스코어: <strong>${score.toLocaleString()}</strong><br>총 처치: ${totalKills}명`;
    startBtn.textContent = '다시 시작';
    overlay.style.display = 'flex';
  }, 400);
}

/* ══════════════════════════════════
   렌더링
══════════════════════════════════ */
function drawBg() {
  // 하늘 (전장 느낌 - 어두운 하늘)
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, '#1a1a2e');
  sky.addColorStop(0.6, '#2d4a6e');
  sky.addColorStop(1, '#4a6741');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  // 먼 산 실루엣
  ctx.fillStyle = '#1e3a2e';
  ctx.beginPath();
  const mOffset = camX * 0.2;
  for (let i = 0; i < 8; i++) {
    const mx = (i * 100 - mOffset % 800 + 800) % 800 - 50;
    const mh = 60 + (i * 37) % 50;
    ctx.moveTo(mx, GROUND_Y - 10);
    ctx.lineTo(mx + 50, GROUND_Y - 10 - mh);
    ctx.lineTo(mx + 100, GROUND_Y - 10);
  }
  ctx.closePath(); ctx.fill();

  // 멀리 보이는 건물 (배경)
  ctx.fillStyle = '#152535';
  for (let i = 0; i < 6; i++) {
    const bx = ((i * 160 - camX * 0.3) % (CW + 200) + CW + 200) % (CW + 200) - 100;
    const bh = 50 + (i * 43) % 60;
    ctx.fillRect(bx, GROUND_Y - bh, 40 + (i*17)%30, bh);
    // 창문
    ctx.fillStyle = Math.random() > 0.7 ? '#fde68a44' : '#0000';
    for (let wy = GROUND_Y - bh + 8; wy < GROUND_Y - 10; wy += 16) {
      for (let wx = bx + 6; wx < bx + 40; wx += 12) {
        ctx.fillRect(wx, wy, 6, 8);
      }
    }
    ctx.fillStyle = '#152535';
  }
}

function drawPlatforms() {
  for (const p of PLATFORMS) {
    const sx = p.x - camX;
    if (sx + p.w < -10 || sx > CW + 10) continue;

    // 콘크리트 플랫폼
    ctx.save();
    ctx.fillStyle = '#6b5c3e';
    ctx.fillRect(sx, p.y, p.w, p.h);
    // 위쪽 밝은 면
    ctx.fillStyle = '#8a7550';
    ctx.fillRect(sx, p.y, p.w, 4);
    // 질감
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let tx = sx; tx < sx + p.w; tx += 24) {
      ctx.beginPath(); ctx.moveTo(tx, p.y); ctx.lineTo(tx, p.y + p.h); ctx.stroke();
    }
    ctx.restore();

    // 모래주머니 장식
    if (p.h === PLATFORM_H && p.w < 200) {
      ctx.fillStyle = '#7a6040';
      for (let bx = sx; bx < sx + p.w - 20; bx += 30) {
        ctx.beginPath(); ctx.ellipse(bx + 15, p.y - 5, 14, 8, 0, 0, Math.PI*2); ctx.fill();
      }
    }
  }
}

function drawHero() {
  const sx = hero.x - camX;
  const sy = hero.y;
  const blink = hurtTimer > 0 && Math.floor(hurtTimer / 6) % 2 === 0;
  if (blink) return;

  ctx.save();
  if (hero.dir < 0) { ctx.translate(sx + hero.w/2, 0); ctx.scale(-1,1); ctx.translate(-(sx + hero.w/2), 0); }

  const x = sx, y = sy, w = hero.w, h = hero.h;

  // 다리
  ctx.fillStyle = '#5c4a2e';
  ctx.fillRect(x + 2,  y + h - 14, 8, 14);
  ctx.fillRect(x + 14, y + h - 14, 8, 14);
  // 부츠
  ctx.fillStyle = '#3a2a10';
  ctx.fillRect(x,      y + h - 6, 12, 6);
  ctx.fillRect(x + 12, y + h - 6, 12, 6);
  // 몸통 (방탄복)
  ctx.fillStyle = '#4a7c3f';
  ctx.fillRect(x + 1, y + 14, w - 2, h * 0.45);
  ctx.fillStyle = '#3a6030';
  ctx.fillRect(x + 4, y + 16, 6, h * 0.38);
  // 팔
  ctx.fillStyle = '#4a7c3f';
  ctx.fillRect(x - 5, y + 14, 8, 18);
  ctx.fillRect(x + w - 3, y + 14, 8, 18);
  // 손
  ctx.fillStyle = '#c8a07a';
  ctx.fillRect(x - 6, y + 28, 7, 6);
  // 총
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x + w - 2, y + 18, 16, 5);
  ctx.fillRect(x + w + 12, y + 15, 4, 11);
  // 총구 불꽃 (발사 직후)
  if (shootCooldown > 4) {
    ctx.fillStyle = '#fde68a';
    ctx.shadowBlur = 8; ctx.shadowColor = '#fde68a';
    ctx.beginPath(); ctx.arc(x + w + 18, y + 20, 4, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  // 얼굴
  ctx.fillStyle = '#c8a07a';
  ctx.fillRect(x + 4, y + 2, w - 8, 14);
  // 헬멧
  ctx.fillStyle = '#3a5030';
  ctx.fillRect(x + 2, y, w - 4, 10);
  ctx.fillRect(x, y + 6, w, 6);
  // 눈
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + w - 9, y + 5, 5, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + w - 8, y + 6, 3, 3);

  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    const sx = e.x - camX;
    if (sx + e.w < -10 || sx > CW + 10) continue;
    ctx.save();

    if (e.type === 'tank') {
      drawTank(sx, e.y, e);
    } else if (e.type === 'heavy') {
      drawSoldier(sx, e.y, '#8b2252', e);
    } else {
      drawSoldier(sx, e.y, '#a34a2a', e);
    }

    // HP 바
    if (e.maxHp > 1) {
      const bw = e.w; const bh = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(sx, e.y - 10, bw, bh);
      ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#22c55e' : '#ef4444';
      ctx.fillRect(sx, e.y - 10, bw * (e.hp / e.maxHp), bh);
    }

    ctx.restore();
  }
}

function drawSoldier(sx, sy, color, e) {
  const w = e.w, h = e.h;
  const facingLeft = e.vx < 0;

  if (!facingLeft) { ctx.translate(sx + w/2, 0); ctx.scale(-1,1); ctx.translate(-(sx + w/2), 0); }

  const x = sx, y = sy;
  // 다리
  ctx.fillStyle = '#5c3a2a';
  ctx.fillRect(x + 2, y + h - 14, 7, 14);
  ctx.fillRect(x + 13, y + h - 14, 7, 14);
  // 몸
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 12, w - 2, h * 0.45);
  // 팔
  ctx.fillStyle = color;
  ctx.fillRect(x - 4, y + 14, 7, 14);
  ctx.fillRect(x + w - 3, y + 14, 7, 14);
  // 총
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x + w - 3, y + 16, 12, 4);
  // 얼굴
  ctx.fillStyle = '#c8a07a';
  ctx.fillRect(x + 3, y + 2, w - 6, 12);
  // 헬멧
  ctx.fillStyle = '#3a3a2a';
  ctx.fillRect(x + 1, y, w - 2, 10);
  // 눈
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + w - 8, y + 4, 4, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + w - 7, y + 5, 2, 3);
}

function drawTank(sx, sy, e) {
  const w = e.w, h = e.h;
  const grd = ctx.createLinearGradient(sx, sy, sx, sy + h);
  grd.addColorStop(0, '#5a6a40'); grd.addColorStop(1, '#3a4a28');
  ctx.fillStyle = grd;
  // 차체
  ctx.fillRect(sx, sy + 20, w, h - 20);
  // 포탑
  ctx.fillStyle = '#4a5a30';
  ctx.beginPath(); ctx.ellipse(sx + w/2, sy + 18, 22, 14, 0, 0, Math.PI*2); ctx.fill();
  // 포신
  ctx.fillStyle = '#2a3020';
  ctx.fillRect(sx + w/2 - 4, sy + 12, 28, 8);
  // 바퀴
  ctx.fillStyle = '#2a2a1a';
  for (let wx = sx + 8; wx < sx + w; wx += 16) {
    ctx.beginPath(); ctx.arc(wx, sy + h - 6, 8, 0, Math.PI*2); ctx.fill();
  }
  // 무한궤도
  ctx.fillStyle = '#1a1a0e';
  ctx.fillRect(sx, sy + h - 14, w, 14);
  ctx.strokeStyle = '#3a3a2a'; ctx.lineWidth = 2;
  for (let tx = sx; tx < sx + w; tx += 8) {
    ctx.beginPath(); ctx.moveTo(tx, sy + h - 14); ctx.lineTo(tx, sy + h); ctx.stroke();
  }
}

function drawBullets() {
  for (const b of bullets) {
    const sx = b.x - camX;
    ctx.save();
    if (b.owner === 'hero') {
      ctx.fillStyle = '#fde68a';
      ctx.shadowBlur = 6; ctx.shadowColor = '#fde68a';
    } else {
      ctx.fillStyle = '#f87171';
      ctx.shadowBlur = 4; ctx.shadowColor = '#f87171';
    }
    ctx.fillRect(sx - 4, b.y - 2, 10, 4);
    ctx.restore();
  }
}

function drawGrenades() {
  for (const g of grenades) {
    const sx = g.x - camX;
    ctx.save();
    ctx.fillStyle = '#374151';
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, g.y, 6, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    // 핀
    ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx + 2, g.y - 6); ctx.lineTo(sx + 5, g.y - 10); ctx.stroke();
    ctx.restore();
  }
}

function drawExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.life -= 0.04;
    if (ex.life <= 0) { explosions.splice(i, 1); continue; }
    const sx = ex.x - camX;
    ctx.save();
    ctx.globalAlpha = ex.life * 0.8;
    const grd = ctx.createRadialGradient(sx, ex.y, 0, sx, ex.y, ex.r * (1 - ex.life * 0.3));
    grd.addColorStop(0, '#fff7aa');
    grd.addColorStop(0.3, '#f97316');
    grd.addColorStop(0.7, '#ef4444aa');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(sx, ex.y, ex.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 4; ctx.shadowColor = p.color;
    ctx.beginPath(); ctx.arc(p.x - camX, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  for (const p of popups) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life);
    ctx.fillStyle = '#fde68a';
    ctx.shadowBlur = 8; ctx.shadowColor = '#fde68a';
    ctx.font = 'bold 14px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}

function drawWaveMsg() {
  if (!waveClear) return;
  const alpha = Math.min(1, waveTimer / 30);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#22c55e';
  ctx.shadowBlur = 20; ctx.shadowColor = '#22c55e';
  ctx.font = 'bold 28px "Segoe UI"';
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE ${wave} CLEAR!`, CW/2, CH/2 - 20);
  ctx.restore();
}

/* ── 메인 루프 ── */
let rafId = null;

function loop() {
  if (!gameRunning) { rafId = null; return; }

  /* 입력 */
  if (keys['ArrowLeft'])  { hero.vx = -4; hero.dir = -1; }
  else if (keys['ArrowRight']) { hero.vx = 4; hero.dir = 1; }
  else hero.vx *= 0.7;

  if ((keys['x'] || keys['X'] || keys['ArrowUp']) && shootCooldown <= 0) shoot();

  /* 쿨다운 */
  if (shootCooldown > 0) shootCooldown--;
  if (grenadeCooldown > 0) grenadeCooldown--;
  if (hurtTimer > 0) hurtTimer--;

  /* 히어로 물리 */
  moveEntityMs(hero);
  if (hero.y > CH + 40) hurtHero();

  /* 카메라 - 히어로 앞쪽 따라가기 */
  const targetCam = hero.x - CW * 0.3 + hero.dir * CW * 0.15;
  camX += (targetCam - camX) * 0.08;
  camX = Math.max(0, camX);

  /* 업데이트 */
  updateEnemies();
  updateBullets();
  updateGrenades();

  /* 파티클 */
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.y += p.vy; p.life -= 0.018;
    if (p.life <= 0) popups.splice(i, 1);
  }

  /* 렌더 */
  ctx.clearRect(0, 0, CW, CH);
  drawBg();
  drawPlatforms();
  drawExplosions();
  drawParticles();
  drawGrenades();
  drawBullets();
  drawEnemies();
  drawHero();
  drawWaveMsg();

  rafId = requestAnimationFrame(loop);
}

/* ── 시작 버튼 ── */
startBtn.addEventListener('click', initGame);

/* ── 초기 렌더 ── */
ctx.clearRect(0, 0, CW, CH);
(()=>{
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, '#1a1a2e'); sky.addColorStop(1, '#4a6741');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
})();
