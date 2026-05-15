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

const CW = 640, CH = 360;
canvas.width = CW; canvas.height = CH;
ctx.imageSmoothingEnabled = false;

/* ── 타일 상수 ── */
const T  = 32;
const GW = 130;       // 맵 가로 타일 수
const MAP_ROWS = 11;  // 맵 세로 타일 수

/* ── 색상 팔레트 ── */
const COL = {
  SKY_TOP:    '#7ec0ff',
  SKY_BOT:    '#cae8ff',
  MOUNTAIN:   '#6b9a3d',
  MOUNTAIN_D: '#4d7a2b',
  GROUND_TOP: '#7cc752',
  GROUND_MID: '#5ca834',
  GROUND_BOT: '#8a5a2b',
  GROUND_DK:  '#6b4220',
  BRICK_LT:   '#e6913a',
  BRICK:      '#c46b1c',
  BRICK_DK:   '#8c4a10',
  Q_LT:       '#ffd72a',
  Q:          '#e9b000',
  Q_DK:       '#a87400',
  PIPE_LT:    '#3fdc40',
  PIPE:       '#1bb02a',
  PIPE_DK:    '#0d6a18',
  CLOUD:      '#ffffff',
  HILL_LT:    '#a4d97a',
  HILL_DK:    '#5fa83a',
};

/* ── 맵 정의
   0=빈칸, 1=지면, 2=벽돌, 3=?블록(코인),
   4=파이프하단, 5=파이프상단, 6=비활성블록,
   7=?블록(파워업), 8=하드블록(돌), 9=?블록(스타) ── */

function makeMap() {
  const M = [];
  for (let r = 0; r < MAP_ROWS; r++) M.push(Array(GW).fill(0));

  // 지면 (row 9, 10)
  for (let c = 0; c < GW; c++) { M[9][c] = 1; M[10][c] = 1; }

  // 구덩이 (gap) — 모두 2~3타일, 점프로 통과 가능
  const gaps = [[18,19], [38,39], [62,63], [80,81], [98,99]];
  for (const [a, b] of gaps) {
    for (let c = a; c <= b; c++) { M[9][c] = 0; M[10][c] = 0; }
  }

  // 마지막 영역 (깃발 앞) 안전한 평지
  for (let c = GW - 18; c < GW; c++) { M[9][c] = 1; M[10][c] = 1; }

  // ? 블록 + 벽돌 줄들 (row 5)
  const r5 = [
    [8,3], [10,2], [11,3], [12,2], [13,3],
    [22,2], [23,7], [24,2],
    [33,3], [34,2], [35,3],
    [46,2], [47,2], [48,9], [49,2], [50,2],  // 스타 블록!
    [56,3], [58,3],
    [70,2], [71,3], [72,2],
    [85,3], [86,2], [87,7], [88,2], [89,3],  // 파워업
    [103,3], [104,2], [105,3],
  ];
  for (const [c, t] of r5) M[5][c] = t;

  // 파이프 (높이 1) — 점프로 넘기 쉬움
  const pipes1 = [27, 75];
  for (const c of pipes1) { M[7][c] = 5; M[7][c+1] = 5; M[8][c] = 4; M[8][c+1] = 4; }
  // 파이프 (높이 2) — 달리기 점프 권장
  const pipes2 = [54, 109];
  for (const c of pipes2) {
    M[6][c] = 5; M[6][c+1] = 5;
    M[7][c] = 4; M[7][c+1] = 4;
    M[8][c] = 4; M[8][c+1] = 4;
  }

  // 계단 (오르막)
  function stairUp(startCol, max) {
    for (let i = 0; i < max; i++) {
      const c = startCol + i;
      for (let h = 0; h < i + 1; h++) M[8 - h][c] = 8;
    }
  }
  stairUp(113, 4);      // 깃발 직전 오르막 4단 (이후 점프로 내려와 깃발로)

  // 부유 벽돌 플랫폼 (row 4) — 달리기 점프 필요
  const platforms = [
    [29, 31], [42, 44], [65, 68], [99, 102],
  ];
  for (const [a, b] of platforms) {
    for (let c = a; c <= b; c++) M[4][c] = 2;
  }

  return M;
}

let MAP = makeMap();

/* ── 코인 (수집 가능 아이템) 배치 ── */
function makeCoins() {
  // {col, row} 형식 — 매 게임 시작 시 entity로 변환
  return [
    {c: 6, r: 7}, {c: 7, r: 7},
    {c: 14, r: 4}, {c: 15, r: 4}, {c: 16, r: 4},
    {c: 19, r: 4}, // 구덩이 위 위험 코인
    {c: 29, r: 3}, {c: 30, r: 3}, {c: 31, r: 3},
    {c: 39, r: 4}, // 구덩이 위
    {c: 42, r: 3}, {c: 43, r: 3}, {c: 44, r: 3},
    {c: 53, r: 7}, {c: 54, r: 5},
    {c: 65, r: 3}, {c: 66, r: 3}, {c: 67, r: 3}, {c: 68, r: 3},
    {c: 78, r: 7}, {c: 79, r: 7},
    {c: 92, r: 7}, {c: 93, r: 6}, {c: 94, r: 5}, {c: 95, r: 4},
    {c: 99, r: 3}, {c: 100, r: 3}, {c: 101, r: 3}, {c: 102, r: 3},
    {c: 113, r: 7}, {c: 114, r: 6}, {c: 115, r: 5}, {c: 116, r: 4},  // 깃발 직전 계단 옆 코인
    {c: 120, r: 7}, {c: 121, r: 7},
  ];
}

/* ── 게임 상태 ── */
let score, coins, lives, timeLeft, gameRunning, gameState; // 'playing'|'clear'|'gameover'|'dying'
let camX = 0;
let particles = [];
let scorePops = [];
let coinBumps = [];   // ?블록 안에서 튀어나오는 코인 애니
let brickParticles = [];
let timerInterval = null;
let frameCount = 0;

/* ── 마리오 ── */
let mario = {};
let hurtCooldown = 0;
let starTimer = 0;
let coyote = 0;        // 코요테 타임
let jumpBuffer = 0;    // 점프 버퍼
let flagAnim = null;   // 깃발 클리어 애니

/* ── 적 ── */
let goombas = [];
let koopas  = [];
let powerUps = [];     // 버섯, 스타
let coinEntities = []; // 월드 코인

/* ── ? 블록 상태 ── */
let qBlocks = {};      // "row,col" → { hit, bumpY, bumpVy }

/* ── 깃발 ── */
const FLAG_X   = (GW - 6) * T;
const FLAG_TOP = 0 * T;
const FLAG_BOT = 8 * T;

/* ── 키 ── */
const keys = {};
const KMAP = {
  left:  ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  jump:  ['z', 'Z', ' ', 'ArrowUp', 'w', 'W'],
  run:   ['Shift', 'x', 'X'],
};

function isKey(name) {
  return KMAP[name].some(k => keys[k]);
}

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if (KMAP.jump.includes(e.key)) jumpBuffer = 8;
});
document.addEventListener('keyup', e => {
  keys[e.key] = false;
  if (KMAP.jump.includes(e.key)) mario.jumpHeld = false;
});

/* ── 터치 컨트롤 ── */
function setupTouch() {
  const btn = id => document.getElementById(id);
  const bind = (el, dir) => {
    if (!el) return;
    const on  = e => { e.preventDefault(); keys[dir.activate] = true;  if (dir.buffer) jumpBuffer = 8; };
    const off = e => { e.preventDefault(); keys[dir.activate] = false; if (dir.heldRelease) mario.jumpHeld = false; };
    el.addEventListener('touchstart', on, {passive:false});
    el.addEventListener('touchend',   off, {passive:false});
    el.addEventListener('touchcancel',off, {passive:false});
    el.addEventListener('mousedown',  on);
    el.addEventListener('mouseup',    off);
    el.addEventListener('mouseleave', off);
  };
  bind(btn('btnLeft'),  { activate: 'ArrowLeft' });
  bind(btn('btnRight'), { activate: 'ArrowRight' });
  bind(btn('btnJump'),  { activate: 'z', buffer: true, heldRelease: true });
  bind(btn('btnRun'),   { activate: 'Shift' });
}

/* ── 오디오 (간단 신디 사이즈) ── */
let audioCtx = null;
function audio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  return audioCtx;
}
function beep(freq, dur = 0.08, type = 'square', vol = 0.06, slide = 0) {
  const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain); gain.connect(ac.destination);
  osc.start(t0); osc.stop(t0 + dur);
}
const SFX = {
  jump:    () => beep(520, 0.10, 'square', 0.05, 350),
  coin:    () => { beep(988, 0.05, 'square', 0.05); setTimeout(() => beep(1319, 0.1, 'square', 0.05), 50); },
  stomp:   () => beep(180, 0.10, 'square', 0.07, -100),
  bump:    () => beep(220, 0.04, 'square', 0.05),
  brick:   () => beep(120, 0.10, 'square', 0.06, -80),
  hurt:    () => { beep(330, 0.12, 'sawtooth', 0.08, -150); },
  power:   () => { [262,330,392,523].forEach((f,i) => setTimeout(() => beep(f,0.10,'square',0.05), i*60)); },
  star:    () => { [392,494,587,784].forEach((f,i) => setTimeout(() => beep(f,0.10,'square',0.05), i*50)); },
  clear:   () => { [523,659,784,1047].forEach((f,i) => setTimeout(() => beep(f,0.14,'square',0.06), i*120)); },
  over:    () => { [392,330,262,196].forEach((f,i) => setTimeout(() => beep(f,0.18,'square',0.07), i*150)); },
  kick:    () => beep(440, 0.06, 'square', 0.06, -200),
};

/* ── 타일 헬퍼 ── */
function getTile(row, col) {
  if (row < 0) return 0;
  if (row >= MAP_ROWS) return 1;
  if (col < 0 || col >= GW) return 8;
  const key = `${row},${col}`;
  if (qBlocks[key] && qBlocks[key].hit) return 6;
  return MAP[row][col];
}

function isSolid(t) {
  return t === 1 || t === 2 || t === 3 || t === 4 || t === 5 || t === 6 || t === 7 || t === 8 || t === 9;
}
function isBrick(t) { return t === 2; }
function isQType(t) { return t === 3 || t === 7 || t === 9; }

function tileAt(wx, wy) {
  return getTile(Math.floor(wy / T), Math.floor(wx / T));
}

/* ── AABB 기반 이동 ── */
function moveEntity(ent, grav = 0.6, maxFall = 14) {
  ent.vy += grav;
  if (ent.vy > maxFall) ent.vy = maxFall;

  // 가로
  ent.x += ent.vx;
  const yTop = ent.y + 2, yBot = ent.y + ent.h - 2;
  if (ent.vx > 0) {
    const r = ent.x + ent.w;
    if (isSolid(tileAt(r, yTop)) || isSolid(tileAt(r, yBot))) {
      ent.x = Math.floor(r / T) * T - ent.w;
      ent.vx = 0;
      ent.hitWall = true;
    }
  } else if (ent.vx < 0) {
    if (isSolid(tileAt(ent.x, yTop)) || isSolid(tileAt(ent.x, yBot))) {
      ent.x = Math.ceil(ent.x / T) * T;
      ent.vx = 0;
      ent.hitWall = true;
    }
  }

  // 세로
  ent.y += ent.vy;
  ent.onGround = false;
  const xL = ent.x + 2, xR = ent.x + ent.w - 2;

  if (ent.vy >= 0) {
    const b = ent.y + ent.h;
    if (isSolid(tileAt(xL, b)) || isSolid(tileAt(xR, b))) {
      ent.y = Math.floor(b / T) * T - ent.h;
      ent.vy = 0;
      ent.onGround = true;
    }
  } else {
    const t = ent.y;
    if (isSolid(tileAt(xL, t)) || isSolid(tileAt(xR, t))) {
      ent.y = Math.ceil(t / T) * T;
      ent.vy = 1;
      if (ent === mario) {
        const midX = (xL + xR) / 2;
        hitBlock(Math.floor(t / T), Math.floor(midX / T));
      }
    }
  }
}

/* ── 블록 히트 ── */
function hitBlock(row, col) {
  const t = getTile(row, col);
  const key = `${row},${col}`;
  const wx = col * T, wy = row * T;

  if (isQType(t)) {
    if (!qBlocks[key]) qBlocks[key] = { hit: false, bumpY: 0, bumpVy: 0 };
    if (qBlocks[key].hit) return;
    qBlocks[key].hit = true;
    qBlocks[key].bumpY = 0; qBlocks[key].bumpVy = -6;
    SFX.bump();

    if (t === 3) {
      coins++; score += 200;
      updateHud();
      coinBumps.push({ x: wx + T/2, y: wy, vy: -9, life: 1, t: 0 });
      addScorePop(wx + T/2, wy, '+200');
      SFX.coin();
    } else if (t === 7) {
      // 마리오 상태에 따라: 작으면 버섯, 크면 꽃 (꽃은 단순화하여 또 버섯)
      powerUps.push({ kind: mario.big ? 'flower' : 'mushroom', x: wx, y: wy - T, vx: 1.2, vy: 0, w: 28, h: 28, born: 1, emerge: 16 });
    } else if (t === 9) {
      powerUps.push({ kind: 'star', x: wx + 2, y: wy - T, vx: 1.5, vy: -6, w: 28, h: 28, born: 1, emerge: 16 });
    }
  } else if (t === 2) {
    if (mario.big) {
      MAP[row][col] = 0;
      score += 50; updateHud();
      SFX.brick();
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 3 + Math.random() * 4;
        brickParticles.push({
          x: wx + T/2, y: wy + T/2,
          vx: Math.cos(a)*s, vy: -4 - Math.random()*3,
          life: 1, w: 8 + Math.random()*4, h: 8 + Math.random()*4,
          rot: 0, vrot: (Math.random()-0.5) * 0.3,
        });
      }
    } else {
      // 작으면 부수지 못하고 살짝 튕김
      if (!qBlocks[key]) qBlocks[key] = { hit: false, bumpY: 0, bumpVy: 0 };
      qBlocks[key].bumpY = 0; qBlocks[key].bumpVy = -5;
      SFX.bump();
    }
  }
}

/* ── 점수 팝업 ── */
function addScorePop(x, y, txt) {
  scorePops.push({ x, y, txt, life: 1, vy: -1.2 });
}

/* ── HUD ── */
function updateHud() {
  scoreEl.textContent = score.toLocaleString();
  coinsEl.textContent = coins;
  timerEl.textContent = timeLeft;
  livesEl.textContent = '❤️'.repeat(Math.max(0, lives));
}

/* ── 적: 굼바 ── */
function updateGoombas() {
  for (let i = goombas.length - 1; i >= 0; i--) {
    const g = goombas[i];
    if (g.dead) {
      g.deadTimer--;
      if (g.deadTimer <= 0) goombas.splice(i, 1);
      continue;
    }
    g.vx = g.dir * g.speed;
    g.hitWall = false;
    moveEntity(g, 0.6);
    if (g.hitWall) g.dir *= -1;
    if (g.onGround) {
      const frontX = g.x + (g.dir > 0 ? g.w + 4 : -4);
      const tBelow = tileAt(frontX, g.y + g.h + 4);
      if (!isSolid(tBelow)) g.dir *= -1;
    }
    // 화면 밖 / 낙사
    if (g.y > CH + 100) { goombas.splice(i, 1); continue; }

    // 쉘과의 충돌
    for (const k of koopas) {
      if (k.state === 'shellMove' && rectsOverlap(g, k)) {
        g.dead = true; g.deadTimer = 30;
        addScorePop(g.x + g.w/2, g.y, '+100');
        score += 100; updateHud(); SFX.kick();
      }
    }

    // 마리오와 충돌
    if (rectsOverlap(mario, g) && !g.dead) {
      if (starTimer > 0) {
        g.dead = true; g.deadTimer = 30;
        addScorePop(g.x + g.w/2, g.y, '+200');
        score += 200; updateHud(); SFX.stomp();
        spawnDeathParticles(g.x + g.w/2, g.y, '#a04020');
      } else if (mario.vy > 0 && mario.y + mario.h < g.y + g.h - 6) {
        g.dead = true; g.deadTimer = 30;
        mario.vy = -9;
        if (isKey('jump')) mario.vy = -11;
        score += 100; updateHud();
        addScorePop(g.x + g.w/2, g.y, '+100');
        SFX.stomp();
      } else {
        hurtMario();
      }
    }
  }
}

/* ── 적: 쿠파 ── */
function updateKoopas() {
  for (let i = koopas.length - 1; i >= 0; i--) {
    const k = koopas[i];
    if (k.state === 'walk') {
      k.vx = k.dir * 1.0;
      k.hitWall = false;
      moveEntity(k, 0.6);
      if (k.hitWall) k.dir *= -1;
      if (k.onGround) {
        const frontX = k.x + (k.dir > 0 ? k.w + 4 : -4);
        const tBelow = tileAt(frontX, k.y + k.h + 4);
        if (!isSolid(tBelow)) k.dir *= -1;
      }
    } else if (k.state === 'shellMove') {
      k.vx = k.dir * 6.5;
      k.hitWall = false;
      moveEntity(k, 0.6);
      if (k.hitWall) { k.dir *= -1; SFX.bump(); }
    } else if (k.state === 'shellStill') {
      k.vx = 0;
      moveEntity(k, 0.6);
      k.stillTimer--;
      if (k.stillTimer <= 0) k.state = 'walk';
    }

    if (k.y > CH + 100) { koopas.splice(i, 1); continue; }

    if (rectsOverlap(mario, k)) {
      if (starTimer > 0) {
        koopas.splice(i, 1);
        addScorePop(k.x + k.w/2, k.y, '+200');
        score += 200; updateHud(); SFX.stomp();
        spawnDeathParticles(k.x + k.w/2, k.y, '#1bb02a');
        continue;
      }
      if (mario.vy > 0 && mario.y + mario.h < k.y + k.h - 4) {
        if (k.state === 'walk') {
          k.state = 'shellStill';
          k.stillTimer = 300;
          k.h = 24; k.y += 8;
          mario.vy = isKey('jump') ? -11 : -9;
          score += 100; updateHud();
          addScorePop(k.x + k.w/2, k.y, '+100');
          SFX.stomp();
        } else if (k.state === 'shellMove') {
          k.state = 'shellStill';
          k.stillTimer = 300;
          mario.vy = isKey('jump') ? -11 : -9;
          SFX.stomp();
        } else if (k.state === 'shellStill') {
          // 발로 차기
          k.state = 'shellMove';
          k.dir = (mario.x + mario.w/2 < k.x + k.w/2) ? 1 : -1;
          mario.vy = isKey('jump') ? -9 : -7;
          SFX.kick();
        }
      } else {
        if (k.state === 'shellStill') {
          // 옆에서 만지면 차기
          k.state = 'shellMove';
          k.dir = (mario.x + mario.w/2 < k.x + k.w/2) ? 1 : -1;
          SFX.kick();
        } else {
          hurtMario();
        }
      }
    }
  }
}

/* ── 파워업 ── */
function updatePowerUps() {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    if (p.emerge > 0) {
      p.emerge--; p.y -= 1;
      if (p.emerge === 0) {
        SFX.power();
      }
      continue;
    }
    if (p.kind === 'mushroom' || p.kind === 'flower') {
      p.hitWall = false;
      moveEntity(p, 0.5);
      if (p.hitWall) p.vx *= -1;
    } else if (p.kind === 'star') {
      moveEntity(p, 0.35, 10);
      if (p.onGround) p.vy = -8;
      if (p.hitWall) p.vx *= -1;
    }
    if (p.y > CH + 100 || p.x < -50 || p.x > GW * T + 50) { powerUps.splice(i, 1); continue; }
    if (rectsOverlap(mario, p)) {
      if (p.kind === 'mushroom' || p.kind === 'flower') {
        if (!mario.big) {
          mario.big = true;
          mario.h = 48; mario.y -= 16;
          mario.growAnim = 18;
        }
        score += 1000; updateHud();
        addScorePop(p.x + p.w/2, p.y, '+1000');
        SFX.power();
      } else if (p.kind === 'star') {
        starTimer = 600;
        score += 1000; updateHud();
        addScorePop(p.x + p.w/2, p.y, '+1000');
        SFX.star();
      }
      powerUps.splice(i, 1);
    }
  }
}

/* ── 코인 (월드 아이템) ── */
function updateCoinEntities() {
  for (let i = coinEntities.length - 1; i >= 0; i--) {
    const c = coinEntities[i];
    c.spin += 0.18;
    if (rectsOverlap(mario, c)) {
      coins++; score += 100;
      updateHud();
      addScorePop(c.x + c.w/2, c.y, '+100');
      SFX.coin();
      coinEntities.splice(i, 1);
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/* ── 마리오 피격 ── */
function hurtMario() {
  if (hurtCooldown > 0 || starTimer > 0 || gameState !== 'playing') return;
  if (mario.big) {
    mario.big = false;
    mario.h = 32; mario.y += 16;
    hurtCooldown = 90;
    SFX.hurt();
    return;
  }
  lives--; updateHud();
  SFX.hurt();
  if (lives <= 0) {
    startDeath(true);
  } else {
    startDeath(false);
  }
}

function startDeath(terminal) {
  gameState = 'dying';
  mario.vy = -12;
  mario.vx = 0;
  mario.dying = true;
  mario.dyingTimer = 70;
  mario.dyingTerminal = terminal;
}

function spawnDeathParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
    particles.push({
      x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2,
      life: 1, decay: 0.04, color, size: 3,
    });
  }
}

/* ── 깃발 클리어 애니 ── */
function startFlagClear() {
  gameState = 'clear';
  flagAnim = { mY: mario.y, descTimer: 60, walkTimer: 60, walked: false };
  mario.vx = 0; mario.vy = 0;
  SFX.clear();
}

/* ── 초기화 ── */
function initGame() {
  score = 0; coins = 0; lives = 3; timeLeft = 300;
  gameState = 'playing'; gameRunning = true;
  camX = 0;
  particles = []; brickParticles = []; coinBumps = []; scorePops = [];
  qBlocks = {};
  hurtCooldown = 0; starTimer = 0;
  coyote = 0; jumpBuffer = 0;
  flagAnim = null;
  frameCount = 0;

  MAP = makeMap();

  mario = {
    x: 50, y: 9 * T - 32,
    vx: 0, vy: 0,
    w: 24, h: 32,
    onGround: false,
    dir: 1, big: false,
    growAnim: 0,
    jumpHeld: false,
    dying: false, dyingTimer: 0, dyingTerminal: false,
  };

  // 굼바
  const goombaPositions = [
    {x: 22*T, dir: -1},
    {x: 25*T, dir: -1},
    {x: 32*T, dir: -1},
    {x: 45*T, dir: -1},
    {x: 60*T, dir: -1},
    {x: 67*T, dir: 1},
    {x: 78*T, dir: -1},
    {x: 84*T, dir: 1},
    {x: 102*T, dir: -1},
    {x: 120*T, dir: -1},
  ];
  goombas = goombaPositions.map(p => ({
    x: p.x, y: 9*T - 28,
    vx: p.dir * 1.2, vy: 0,
    speed: 1.2, dir: p.dir,
    w: 28, h: 28,
    onGround: false, dead: false, deadTimer: 0, hitWall: false,
  }));

  // 쿠파
  const koopaPositions = [
    {x: 36*T},
    {x: 70*T},
    {x: 96*T},
  ];
  koopas = koopaPositions.map(p => ({
    x: p.x, y: 9*T - 36,
    vx: -1.0, vy: 0,
    dir: -1, w: 28, h: 36,
    state: 'walk', stillTimer: 0,
    onGround: false, hitWall: false,
  }));

  // 코인
  coinEntities = makeCoins().map(c => ({
    x: c.c * T + 4, y: c.r * T + 4,
    w: 24, h: 24, spin: 0,
  }));

  powerUps = [];

  updateHud();

  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState !== 'playing') return;
    timeLeft--; updateHud();
    if (timeLeft <= 0) startDeath(true);
  }, 1000);

  overlay.style.display = 'none';
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (!rafId) loop();
}

/* ── 게임 오버 / 클리어 ── */
function doGameOver() {
  gameRunning = false; gameState = 'gameover';
  clearInterval(timerInterval);
  SFX.over();
  setTimeout(() => {
    ovTitle.textContent = 'GAME OVER';
    ovMsg.innerHTML = `스코어: <strong>${score.toLocaleString()}</strong><br>코인: ${coins}개`;
    startBtn.textContent = '다시 시작';
    overlay.style.display = 'flex';
  }, 600);
}

function doClear() {
  gameRunning = false; gameState = 'clear';
  clearInterval(timerInterval);
  const bonus = timeLeft * 50;
  score += bonus; updateHud();
  setTimeout(() => {
    ovTitle.textContent = '🏆 COURSE CLEAR!';
    ovMsg.innerHTML = `최종 스코어: <strong>${score.toLocaleString()}</strong><br>코인: ${coins}개 · 시간 보너스: +${bonus}`;
    startBtn.textContent = '다시 시작';
    overlay.style.display = 'flex';
  }, 1600);
}

/* ── 렌더 ── */
function drawBg() {
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, COL.SKY_TOP);
  sky.addColorStop(1, COL.SKY_BOT);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  // 태양
  const sunX = 540, sunY = 60;
  ctx.fillStyle = 'rgba(255,240,180,0.8)';
  ctx.beginPath(); ctx.arc(sunX, sunY, 32, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,250,210,0.95)';
  ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI*2); ctx.fill();

  // 먼 산 (parallax 0.2)
  const mtnPx = camX * 0.2;
  ctx.fillStyle = COL.MOUNTAIN;
  for (let i = 0; i < 6; i++) {
    const mx = (i * 280) - (mtnPx % 280) - 100;
    drawMountain(mx, CH - 100, 200, 90);
  }
  ctx.fillStyle = COL.MOUNTAIN_D;
  for (let i = 0; i < 8; i++) {
    const mx = (i * 200) - (mtnPx * 1.4 % 200) - 50;
    drawMountain(mx, CH - 80, 140, 60);
  }

  // 구름 (parallax 0.4)
  const cldPx = camX * 0.4;
  ctx.fillStyle = COL.CLOUD;
  const clouds = [
    {x: 60, y: 40, s: 1.0},
    {x: 220, y: 70, s: 0.8},
    {x: 380, y: 30, s: 1.2},
    {x: 540, y: 60, s: 0.9},
    {x: 700, y: 50, s: 1.0},
    {x: 880, y: 35, s: 0.85},
  ];
  for (const c of clouds) {
    const rx = ((c.x - cldPx) % 1000 + 1000) % 1000 - 100;
    drawCloud(rx, c.y, c.s);
  }

  // 풀숲 (parallax 0.8)
  const grassPx = camX * 0.8;
  ctx.fillStyle = COL.HILL_LT;
  for (let i = 0; i < 10; i++) {
    const gx = (i * 180) - (grassPx % 180) - 50;
    drawHill(gx, CH - 70, 100, 30, COL.HILL_LT, COL.HILL_DK);
  }
}

function drawMountain(x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w/2, y - h);
  ctx.lineTo(x + w, y);
  ctx.closePath(); ctx.fill();
  // 눈 덮인 꼭대기
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(x + w/2 - 14, y - h + 22);
  ctx.lineTo(x + w/2, y - h);
  ctx.lineTo(x + w/2 + 14, y - h + 22);
  ctx.lineTo(x + w/2 + 7, y - h + 16);
  ctx.lineTo(x + w/2, y - h + 22);
  ctx.lineTo(x + w/2 - 7, y - h + 14);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawHill(x, y, w, h, c1, c2) {
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.ellipse(x + w/2, y + h, w/2, h, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.ellipse(x + w/2 - 12, y + h, w/4, h/2, 0, Math.PI, 0);
  ctx.fill();
}

function drawCloud(cx, cy, s = 1) {
  const r = 18 * s;
  ctx.beginPath(); ctx.arc(cx,        cy,      r,       0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r*1.2, cy,     r*0.85,  0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r*0.6, cy - r*0.6, r*0.9, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r*1.8, cy - r*0.2, r*0.7, 0, Math.PI*2); ctx.fill();
}

function drawTiles() {
  const startCol = Math.max(0, Math.floor(camX / T));
  const endCol   = Math.min(GW - 1, startCol + Math.ceil(CW / T) + 1);

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const t = MAP[row][col];
      const key = `${row},${col}`;
      const qb = qBlocks[key];
      const used = qb && qb.hit;
      const sx = col * T - camX;
      const bumpOffset = qb ? qb.bumpY : 0;
      const sy = row * T + bumpOffset;
      if (t === 0) continue;
      drawTile(used ? 6 : t, sx, sy, row, col);
    }
  }
}

function drawTile(t, sx, sy, row, col) {
  switch (t) {
    case 1: { // 지면
      const isTop = row === 0 || !isSolid(getTile(row - 1, col));
      if (isTop) {
        ctx.fillStyle = COL.GROUND_TOP;
        ctx.fillRect(sx, sy, T, 10);
        ctx.fillStyle = COL.GROUND_MID;
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(sx + i * 8, sy + 4 + (i%2)*3, 4, 4);
        }
        ctx.fillStyle = COL.GROUND_BOT;
        ctx.fillRect(sx, sy + 10, T, T - 10);
        ctx.fillStyle = COL.GROUND_DK;
        ctx.fillRect(sx + 4,  sy + 16, 4, 4);
        ctx.fillRect(sx + 20, sy + 22, 5, 4);
        ctx.fillRect(sx + 12, sy + 26, 3, 3);
      } else {
        ctx.fillStyle = COL.GROUND_BOT;
        ctx.fillRect(sx, sy, T, T);
        ctx.fillStyle = COL.GROUND_DK;
        ctx.fillRect(sx + 4,  sy + 4, 5, 4);
        ctx.fillRect(sx + 18, sy + 14, 4, 4);
        ctx.fillRect(sx + 10, sy + 24, 5, 4);
      }
      break;
    }
    case 2: { // 벽돌
      ctx.fillStyle = COL.BRICK;
      ctx.fillRect(sx, sy, T, T);
      ctx.fillStyle = COL.BRICK_LT;
      ctx.fillRect(sx, sy, T, 2);
      ctx.fillRect(sx, sy, 2, T);
      ctx.fillStyle = COL.BRICK_DK;
      ctx.fillRect(sx, sy + T - 2, T, 2);
      ctx.fillRect(sx + T - 2, sy, 2, T);
      // 벽돌 라인
      ctx.fillStyle = COL.BRICK_DK;
      ctx.fillRect(sx, sy + T/2 - 1, T, 2);
      ctx.fillRect(sx + T/2 - 1, sy + 2, 2, T/2 - 2);
      ctx.fillRect(sx + T/4, sy + T/2 + 1, 2, T/2 - 2);
      ctx.fillRect(sx + T*3/4, sy + T/2 + 1, 2, T/2 - 2);
      break;
    }
    case 3:    // ? 코인
    case 7:    // ? 파워업
    case 9: {  // ? 스타
      const pulse = Math.sin(frameCount * 0.15) * 0.5 + 0.5;
      const c1 = t === 9 ? '#ff5577' : COL.Q_LT;
      const c2 = t === 9 ? '#dd2244' : COL.Q;
      const c3 = t === 9 ? '#881122' : COL.Q_DK;
      ctx.fillStyle = c2;
      ctx.fillRect(sx, sy, T, T);
      ctx.fillStyle = c1;
      ctx.fillRect(sx + 2, sy + 2, T - 4, T/2 - 2);
      ctx.fillStyle = c3;
      ctx.fillRect(sx, sy + T - 4, T, 4);
      ctx.fillRect(sx, sy, 2, T);
      ctx.fillRect(sx + T - 2, sy, 2, T);
      // 광택 (반짝임)
      ctx.fillStyle = `rgba(255,255,255,${0.3 + pulse * 0.4})`;
      ctx.fillRect(sx + 4, sy + 4, 4, 4);
      ctx.fillRect(sx + 10, sy + 4, 2, 2);
      // ?
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${T-10}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', sx + T/2, sy + T/2 + 2);
      ctx.fillStyle = c3;
      ctx.font = `bold ${T-10}px serif`;
      ctx.fillText('?', sx + T/2 + 1, sy + T/2 + 3);
      ctx.fillStyle = '#fff';
      ctx.fillText('?', sx + T/2, sy + T/2 + 2);
      break;
    }
    case 6: { // 사용된 ? 블록
      ctx.fillStyle = '#a36a30';
      ctx.fillRect(sx, sy, T, T);
      ctx.fillStyle = '#7a4a1c';
      ctx.fillRect(sx, sy + T - 4, T, 4);
      ctx.fillRect(sx + T - 3, sy, 3, T);
      ctx.fillStyle = '#c08440';
      ctx.fillRect(sx, sy, T, 3);
      ctx.fillRect(sx, sy, 3, T);
      // 리벳
      ctx.fillStyle = '#5a3414';
      ctx.fillRect(sx + 4,        sy + 4,        3, 3);
      ctx.fillRect(sx + T - 7,    sy + 4,        3, 3);
      ctx.fillRect(sx + 4,        sy + T - 7,    3, 3);
      ctx.fillRect(sx + T - 7,    sy + T - 7,    3, 3);
      break;
    }
    case 4:
    case 5: { // 파이프
      const isTop = t === 5;
      const isLeft = MAP[row][col - 1] !== t && MAP[row][col - 1] !== (t === 5 ? 5 : 4);
      const isRight = MAP[row][col + 1] !== t && MAP[row][col + 1] !== (t === 5 ? 5 : 4);
      const isFirstOfPair = MAP[row][col - 1] !== t;
      if (!isFirstOfPair) break; // 오른쪽 칸은 왼쪽 칸이 그림

      const w = T * 2;
      let x = sx, y = sy;
      let drawW = w;
      if (isTop) { x -= 4; drawW = w + 8; }

      // 본체
      const grd = ctx.createLinearGradient(x, 0, x + drawW, 0);
      grd.addColorStop(0,    COL.PIPE_DK);
      grd.addColorStop(0.15, COL.PIPE_LT);
      grd.addColorStop(0.5,  COL.PIPE);
      grd.addColorStop(0.85, COL.PIPE_DK);
      grd.addColorStop(1,    '#062c08');
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, drawW, T);
      // 테두리
      ctx.fillStyle = '#062c08';
      ctx.fillRect(x, y, drawW, 2);
      ctx.fillRect(x, y + T - 2, drawW, 2);
      if (isTop) {
        ctx.fillRect(x, y, 2, T);
        ctx.fillRect(x + drawW - 2, y, 2, T);
      }
      // 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x + 6, y + 4, 4, T - 8);
      break;
    }
    case 8: { // 하드 블록 (스테어)
      ctx.fillStyle = '#a8682a';
      ctx.fillRect(sx, sy, T, T);
      ctx.fillStyle = '#8c4e16';
      ctx.fillRect(sx, sy + T - 4, T, 4);
      ctx.fillRect(sx + T - 3, sy, 3, T);
      ctx.fillStyle = '#c6884a';
      ctx.fillRect(sx, sy, T, 3);
      ctx.fillRect(sx, sy, 3, T);
      ctx.fillStyle = '#5a3414';
      ctx.fillRect(sx + 4,        sy + 4,        3, 3);
      ctx.fillRect(sx + T - 7,    sy + 4,        3, 3);
      ctx.fillRect(sx + 4,        sy + T - 7,    3, 3);
      ctx.fillRect(sx + T - 7,    sy + T - 7,    3, 3);
      break;
    }
  }
}

/* ── 마리오 그리기 (픽셀 아트 스타일) ── */
function drawMario() {
  if (hurtCooldown > 0 && Math.floor(hurtCooldown / 4) % 2 === 0) return;

  const sx = mario.x - camX;
  const sy = mario.y;
  const w = mario.w, h = mario.h;

  // 별 무적 - 무지개 색
  let starColor = null;
  if (starTimer > 0) {
    const hue = (frameCount * 24) % 360;
    starColor = `hsl(${hue}, 90%, 60%)`;
  }

  ctx.save();
  if (mario.dir < 0) {
    ctx.translate(sx + w/2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(sx + w/2), 0);
  }

  if (mario.dying) {
    drawMarioDying(sx, sy, w, h);
    ctx.restore();
    return;
  }

  // 자세 판단
  const walking = Math.abs(mario.vx) > 0.3 && mario.onGround;
  const jumping = !mario.onGround;
  const skidding = mario.onGround && Math.abs(mario.vx) > 0.5 && ((mario.vx > 0 && isKey('left')) || (mario.vx < 0 && isKey('right')));

  let walkFrame = 0;
  if (walking) {
    const speed = Math.max(0.5, Math.abs(mario.vx) / 4);
    walkFrame = Math.floor(frameCount * speed * 0.25) % 3;
  }

  if (mario.big) {
    drawMarioBig(sx, sy, walkFrame, jumping, skidding, starColor);
  } else {
    drawMarioSmall(sx, sy, walkFrame, jumping, skidding, starColor);
  }

  ctx.restore();
}

function drawMarioDying(sx, sy, w, h) {
  // 빙글빙글 도는 작은 마리오
  ctx.translate(sx + w/2, sy + h/2);
  ctx.rotate(mario.dyingTimer * 0.2);
  ctx.translate(-(sx + w/2), -(sy + h/2));
  drawMarioSmall(sx, sy, 0, true, false, null);
}

function drawMarioSmall(sx, sy, walkFrame, jumping, skidding, starColor) {
  const HAT  = starColor || '#e83c1f';
  const HAT_D= starColor || '#aa1208';
  const SKIN = '#ffcc99';
  const SKIN_D = '#d49770';
  const SHIRT= starColor || '#e83c1f';
  const PANT = starColor || '#1a39c4';
  const PANT_D = starColor || '#10246f';
  const SHOE = '#552200';
  const HAIR = '#3a1a08';
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(sx + x, sy + y, w, h); };

  // 모자
  px(4, 0, 16, 2, HAT);
  px(2, 2, 20, 4, HAT);
  px(2, 6, 4, 2, HAT);
  px(20, 6, 2, 2, HAT_D);

  // 얼굴
  px(6, 6, 14, 8, SKIN);
  // 머리 / 구레나룻
  px(4, 6, 2, 6, HAIR);
  // 귀
  px(6, 10, 2, 2, SKIN_D);
  // 눈
  px(14, 8, 2, 4, '#222');
  // 코
  px(16, 10, 4, 2, SKIN_D);
  // 콧수염
  px(10, 12, 10, 2, HAIR);
  // 입
  px(12, 14, 4, 1, '#222');

  // 셔츠 + 어깨
  px(4, 14, 16, 2, SHIRT);
  // 셔츠 본체
  px(6, 16, 12, 4, SHIRT);

  // 멜빵
  px(8, 16, 2, 2, PANT);
  px(14, 16, 2, 2, PANT);

  // 단추
  px(10, 18, 1, 1, '#ffd72a');
  px(13, 18, 1, 1, '#ffd72a');

  // 팔
  if (jumping) {
    px(0, 14, 4, 6, SKIN);
    px(20, 14, 4, 6, SKIN);
  } else if (skidding) {
    px(0, 16, 4, 4, SKIN);
    px(20, 12, 4, 4, SKIN);
  } else if (walkFrame === 1) {
    px(2, 16, 4, 4, SKIN);
    px(18, 16, 4, 4, SKIN);
  } else {
    px(2, 18, 4, 4, SKIN);
    px(18, 18, 4, 4, SKIN);
  }

  // 바지
  px(6, 20, 12, 6, PANT);
  px(8, 22, 2, 4, PANT_D);
  px(14, 22, 2, 4, PANT_D);

  // 다리
  if (jumping) {
    px(4, 26, 6, 4, PANT);
    px(14, 26, 6, 4, PANT);
    // 신발
    px(2, 28, 8, 4, SHOE);
    px(14, 28, 8, 4, SHOE);
  } else if (walkFrame === 0) {
    px(6, 26, 6, 4, PANT);
    px(12, 26, 6, 4, PANT);
    px(4, 28, 8, 4, SHOE);
    px(12, 28, 8, 4, SHOE);
  } else if (walkFrame === 1) {
    px(4, 26, 6, 4, PANT);
    px(14, 26, 6, 4, PANT);
    px(2, 28, 8, 4, SHOE);
    px(14, 28, 8, 4, SHOE);
  } else {
    px(8, 26, 6, 4, PANT);
    px(10, 26, 6, 4, PANT);
    px(6, 28, 8, 4, SHOE);
    px(10, 28, 8, 4, SHOE);
  }
}

function drawMarioBig(sx, sy, walkFrame, jumping, skidding, starColor) {
  const HAT  = starColor || '#e83c1f';
  const HAT_D= starColor || '#aa1208';
  const SKIN = '#ffcc99';
  const SKIN_D = '#d49770';
  const SHIRT= starColor || '#e83c1f';
  const PANT = starColor || '#1a39c4';
  const PANT_D = starColor || '#10246f';
  const SHOE = '#552200';
  const HAIR = '#3a1a08';
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(sx + x, sy + y, w, h); };

  // 모자
  px(4, 0, 16, 2, HAT);
  px(2, 2, 20, 4, HAT);
  // 챙
  px(2, 6, 22, 2, HAT);
  px(2, 8, 4, 2, HAT);
  px(20, 8, 2, 2, HAT_D);

  // 얼굴
  px(6, 8, 14, 12, SKIN);
  px(4, 8, 2, 10, HAIR);
  // 귀
  px(6, 14, 2, 2, SKIN_D);
  // 눈
  px(14, 10, 2, 6, '#222');
  // 코
  px(16, 14, 4, 2, SKIN_D);
  // 콧수염
  px(10, 16, 10, 2, HAIR);
  // 입
  px(12, 18, 4, 1, '#222');

  // 목
  px(10, 20, 4, 2, SKIN);

  // 셔츠 + 어깨
  px(4, 22, 16, 4, SHIRT);
  // 멜빵 시작
  px(8, 22, 2, 6, PANT);
  px(14, 22, 2, 6, PANT);

  // 단추
  px(10, 24, 1, 1, '#ffd72a');
  px(13, 24, 1, 1, '#ffd72a');

  // 셔츠 측면
  px(4, 26, 4, 4, SHIRT);
  px(16, 26, 4, 4, SHIRT);

  // 멜빵 바지 본체
  px(6, 28, 12, 8, PANT);

  // 팔
  if (jumping) {
    px(0, 22, 4, 8, SKIN);
    px(20, 22, 4, 8, SKIN);
  } else if (skidding) {
    px(0, 26, 4, 6, SKIN);
    px(20, 22, 4, 6, SKIN);
  } else if (walkFrame === 1) {
    px(2, 24, 4, 6, SKIN);
    px(18, 24, 4, 6, SKIN);
  } else {
    px(2, 26, 4, 6, SKIN);
    px(18, 26, 4, 6, SKIN);
  }

  // 다리
  if (jumping) {
    px(4, 36, 7, 6, PANT);
    px(13, 36, 7, 6, PANT);
    px(2, 42, 9, 6, SHOE);
    px(13, 42, 9, 6, SHOE);
  } else if (walkFrame === 0) {
    px(6, 36, 6, 6, PANT);
    px(12, 36, 6, 6, PANT);
    px(4, 42, 8, 6, SHOE);
    px(12, 42, 8, 6, SHOE);
  } else if (walkFrame === 1) {
    px(4, 36, 6, 6, PANT);
    px(14, 36, 6, 6, PANT);
    px(2, 42, 8, 6, SHOE);
    px(14, 42, 8, 6, SHOE);
  } else {
    px(8, 36, 6, 6, PANT);
    px(10, 36, 6, 6, PANT);
    px(6, 42, 8, 6, SHOE);
    px(10, 42, 8, 6, SHOE);
  }
}

/* ── 굼바 ── */
function drawGoombas() {
  for (const g of goombas) {
    const sx = g.x - camX;
    if (sx + g.w < -10 || sx > CW + 10) continue;
    if (g.dead) {
      // 납작해진 굼바
      ctx.fillStyle = '#88370c';
      ctx.fillRect(sx, g.y + g.h - 10, g.w, 10);
      ctx.fillStyle = '#5a2400';
      ctx.fillRect(sx, g.y + g.h - 4, g.w, 4);
      // 눈 (X)
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx + 6,  g.y + g.h - 8); ctx.lineTo(sx + 10, g.y + g.h - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 10, g.y + g.h - 8); ctx.lineTo(sx + 6,  g.y + g.h - 4); ctx.stroke();
      continue;
    }
    drawGoomba(sx, g.y, g.w, g.h);
  }
}

function drawGoomba(sx, sy, w, h) {
  const step = Math.floor(frameCount / 10) % 2;
  // 몸 (둥근 머리)
  ctx.fillStyle = '#a3471e';
  ctx.beginPath();
  ctx.ellipse(sx + w/2, sy + h*0.45, w*0.5, h*0.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#7d2f10';
  ctx.fillRect(sx + 2, sy + h*0.45, w - 4, h*0.3);
  // 발
  ctx.fillStyle = '#3a1a08';
  if (step) {
    ctx.fillRect(sx + 2,  sy + h - 8, 10, 8);
    ctx.fillRect(sx + w - 12, sy + h - 8, 10, 8);
  } else {
    ctx.fillRect(sx + 4,  sy + h - 8, 10, 8);
    ctx.fillRect(sx + w - 14, sy + h - 8, 10, 8);
  }
  // 눈 흰자
  ctx.fillStyle = '#fff';
  ctx.fillRect(sx + 4,  sy + 6, 8, 8);
  ctx.fillRect(sx + w - 12, sy + 6, 8, 8);
  // 눈동자
  ctx.fillStyle = '#000';
  ctx.fillRect(sx + 8, sy + 8, 4, 5);
  ctx.fillRect(sx + w - 8, sy + 8, 4, 5);
  // 눈썹 (찡그림)
  ctx.fillStyle = '#3a1a08';
  ctx.save();
  ctx.translate(sx + 8, sy + 5); ctx.rotate(-0.4);
  ctx.fillRect(-4, 0, 9, 2);
  ctx.restore();
  ctx.save();
  ctx.translate(sx + w - 8, sy + 5); ctx.rotate(0.4);
  ctx.fillRect(-4, 0, 9, 2);
  ctx.restore();
}

/* ── 쿠파 ── */
function drawKoopas() {
  for (const k of koopas) {
    const sx = k.x - camX;
    if (sx + k.w < -10 || sx > CW + 10) continue;
    if (k.state === 'walk') drawKoopaWalk(sx, k.y, k.w, k.h, k.dir);
    else drawKoopaShell(sx, k.y, k.w, k.h, k.state === 'shellMove');
  }
}

function drawKoopaWalk(sx, sy, w, h, dir) {
  const step = Math.floor(frameCount / 8) % 2;
  ctx.save();
  if (dir > 0) { ctx.translate(sx + w/2, 0); ctx.scale(-1, 1); ctx.translate(-(sx + w/2), 0); }
  // 등딱지
  ctx.fillStyle = COL.PIPE;
  ctx.fillRect(sx + 4, sy + 12, w - 8, h - 20);
  ctx.fillStyle = COL.PIPE_DK;
  ctx.fillRect(sx + 4, sy + 12, w - 8, 3);
  ctx.fillRect(sx + 4, sy + h - 11, w - 8, 3);
  ctx.fillStyle = COL.PIPE_LT;
  ctx.fillRect(sx + 6, sy + 14, 4, 3);
  // 등 무늬
  ctx.fillStyle = COL.PIPE_DK;
  ctx.fillRect(sx + 10, sy + 18, 4, 4);
  ctx.fillRect(sx + 16, sy + 18, 4, 4);
  ctx.fillRect(sx + 13, sy + 24, 4, 4);
  // 머리
  ctx.fillStyle = '#f2c668';
  ctx.beginPath();
  ctx.ellipse(sx + 8, sy + 8, 8, 8, 0, 0, Math.PI*2);
  ctx.fill();
  // 눈
  ctx.fillStyle = '#fff'; ctx.fillRect(sx + 4, sy + 5, 5, 6);
  ctx.fillStyle = '#000'; ctx.fillRect(sx + 4, sy + 7, 3, 4);
  // 부리/입
  ctx.fillStyle = '#aa6600'; ctx.fillRect(sx, sy + 10, 5, 3);
  // 다리
  ctx.fillStyle = '#f2c668';
  if (step) {
    ctx.fillRect(sx + 6, sy + h - 6, 6, 6);
    ctx.fillRect(sx + w - 12, sy + h - 4, 6, 4);
  } else {
    ctx.fillRect(sx + 6, sy + h - 4, 6, 4);
    ctx.fillRect(sx + w - 12, sy + h - 6, 6, 6);
  }
  ctx.restore();
}

function drawKoopaShell(sx, sy, w, h, spinning) {
  ctx.save();
  if (spinning) {
    ctx.translate(sx + w/2, sy + h/2);
    ctx.rotate(frameCount * 0.4);
    ctx.translate(-(sx + w/2), -(sy + h/2));
  }
  // 둥근 쉘
  ctx.fillStyle = COL.PIPE;
  ctx.beginPath(); ctx.ellipse(sx + w/2, sy + h/2 + 2, w/2 - 1, h/2, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = COL.PIPE_LT;
  ctx.fillRect(sx + 4, sy + 4, w - 8, 4);
  ctx.fillStyle = COL.PIPE_DK;
  ctx.fillRect(sx + 4, sy + h - 6, w - 8, 3);
  // 무늬
  ctx.fillStyle = COL.PIPE_DK;
  ctx.fillRect(sx + 8, sy + 10, 4, 4);
  ctx.fillRect(sx + w - 12, sy + 10, 4, 4);
  ctx.fillRect(sx + w/2 - 2, sy + 14, 4, 4);
  ctx.restore();
}

/* ── 파워업 그리기 ── */
function drawPowerUps() {
  for (const p of powerUps) {
    const sx = p.x - camX;
    if (sx + p.w < -10 || sx > CW + 10) continue;
    if (p.emerge > 0) {
      // 블록 위에서 솟아오르는 중 - 일부만 보임
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, p.y + p.emerge * 2, p.w, p.h);
      ctx.clip();
      drawPowerUpSprite(p, sx);
      ctx.restore();
    } else {
      drawPowerUpSprite(p, sx);
    }
  }
}

function drawPowerUpSprite(p, sx) {
  if (p.kind === 'mushroom' || p.kind === 'flower') {
    // 빨간 버섯
    ctx.fillStyle = '#e83c1f';
    ctx.beginPath();
    ctx.ellipse(sx + p.w/2, p.y + p.h*0.4, p.w*0.5, p.h*0.45, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#aa1208';
    ctx.fillRect(sx + 2, p.y + p.h*0.4, p.w - 4, 4);
    // 점박이
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx + 8, p.y + 10, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 20, p.y + 8, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 14, p.y + 4, 3, 0, Math.PI*2); ctx.fill();
    // 줄기
    ctx.fillStyle = '#ffe4b8';
    ctx.fillRect(sx + 6, p.y + p.h*0.55, p.w - 12, p.h*0.45);
    // 눈
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 10, p.y + 16, 2, 4);
    ctx.fillRect(sx + 16, p.y + 16, 2, 4);
  } else if (p.kind === 'star') {
    const hue = (frameCount * 18) % 360;
    ctx.save();
    ctx.translate(sx + p.w/2, p.y + p.h/2);
    ctx.rotate(frameCount * 0.1);
    ctx.fillStyle = `hsl(${hue}, 90%, 60%)`;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI/2 + i * Math.PI * 2/5;
      const x = Math.cos(a) * 14, y = Math.sin(a) * 14;
      ctx.lineTo(x, y);
      const a2 = a + Math.PI/5;
      const x2 = Math.cos(a2) * 6, y2 = Math.sin(a2) * 6;
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
    // 눈
    ctx.fillStyle = '#000';
    ctx.fillRect(-5, -2, 2, 3);
    ctx.fillRect(3, -2, 2, 3);
    ctx.restore();
  }
}

/* ── 코인 (월드 아이템) ── */
function drawCoinEntities() {
  for (const c of coinEntities) {
    const sx = c.x - camX + c.w/2;
    if (sx < -20 || sx > CW + 20) continue;
    const sy = c.y + c.h/2;
    const scale = Math.abs(Math.sin(c.spin));
    const w2 = c.w/2 * (0.3 + scale * 0.7);
    // 코인 본체
    const grd = ctx.createLinearGradient(sx - w2, sy, sx + w2, sy);
    grd.addColorStop(0, '#a87400');
    grd.addColorStop(0.5, '#ffd72a');
    grd.addColorStop(1, '#a87400');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.ellipse(sx, sy, w2, c.h/2 - 2, 0, 0, Math.PI*2); ctx.fill();
    // 광택
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(sx - w2 + 4, sy - 4, Math.max(1, w2/3), 2);
    // 글씨
    if (scale > 0.5) {
      ctx.fillStyle = '#8a5e00';
      ctx.font = `bold ${Math.floor(scale * 14)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', sx, sy + 1);
    }
  }

  // ?블록에서 튀어나온 코인
  for (const cb of coinBumps) {
    const sx = cb.x - camX;
    const sy = cb.y;
    ctx.save();
    ctx.globalAlpha = cb.life;
    ctx.translate(sx, sy);
    const scale = Math.abs(Math.sin(cb.t * 0.4));
    ctx.scale(scale * 0.7 + 0.3, 1);
    ctx.fillStyle = '#ffd72a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

/* ── 깃발 ── */
function drawFlag() {
  const sx = FLAG_X - camX;
  if (sx < -20 || sx > CW + 60) return;

  // 기둥
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(sx + 12, FLAG_TOP + 8, 4, FLAG_BOT - FLAG_TOP + 12);
  // 꼭대기 공
  ctx.fillStyle = '#dcdcdc';
  ctx.beginPath(); ctx.arc(sx + 14, FLAG_TOP + 8, 7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.arc(sx + 14, FLAG_TOP + 8, 4, 0, Math.PI*2); ctx.fill();

  // 깃발 위치 (클리어 애니 중이면 내려가야 함)
  let flagY = FLAG_TOP + 20;
  if (gameState === 'clear' && flagAnim) {
    const t = (60 - flagAnim.descTimer) / 60;
    flagY = FLAG_TOP + 20 + t * (FLAG_BOT - FLAG_TOP - 30);
  }
  // 깃발
  ctx.fillStyle = '#e83c1f';
  ctx.beginPath();
  ctx.moveTo(sx + 16, flagY);
  ctx.lineTo(sx + 36, flagY + 8);
  ctx.lineTo(sx + 16, flagY + 16);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(sx + 19, flagY + 6, 4, 4);

  // 성 (깃발 뒤편)
  drawCastle(sx + 60, FLAG_BOT - 80);
}

function drawCastle(x, y) {
  // 기단
  ctx.fillStyle = '#888';
  ctx.fillRect(x, y + 30, 110, 50);
  ctx.fillStyle = '#666';
  ctx.fillRect(x, y + 76, 110, 4);
  // 입구
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 44, y + 50, 22, 30);
  ctx.fillStyle = '#aa1208';
  ctx.beginPath();
  ctx.arc(x + 55, y + 60, 11, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.fillRect(x + 44, y + 60, 22, 20);
  // 본관 탑
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(x + 40, y, 30, 36);
  // 톱니 (요철)
  ctx.fillStyle = '#888';
  ctx.fillRect(x + 40, y - 6, 6, 6);
  ctx.fillRect(x + 52, y - 6, 6, 6);
  ctx.fillRect(x + 64, y - 6, 6, 6);
  // 양옆 탑
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(x + 4, y + 10, 24, 26);
  ctx.fillRect(x + 82, y + 10, 24, 26);
  ctx.fillStyle = '#888';
  ctx.fillRect(x + 4, y + 4, 6, 6);
  ctx.fillRect(x + 16, y + 4, 6, 6);
  ctx.fillRect(x + 82, y + 4, 6, 6);
  ctx.fillRect(x + 94, y + 4, 6, 6);
  // 작은 창문들
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 12, y + 16, 6, 8);
  ctx.fillRect(x + 90, y + 16, 6, 8);
  ctx.fillRect(x + 50, y + 12, 10, 16);
}

/* ── 파티클 ── */
function drawParticlesAll() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - camX, p.y, p.size, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const b of brickParticles) {
    ctx.save();
    ctx.globalAlpha = b.life;
    ctx.translate(b.x - camX, b.y);
    ctx.rotate(b.rot);
    ctx.fillStyle = COL.BRICK;
    ctx.fillRect(-b.w/2, -b.h/2, b.w, b.h);
    ctx.fillStyle = COL.BRICK_DK;
    ctx.fillRect(-b.w/2, -b.h/2, b.w, 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  for (const s of scorePops) {
    ctx.save();
    ctx.globalAlpha = s.life;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(s.txt, s.x - camX, s.y);
    ctx.fillText(s.txt, s.x - camX, s.y);
    ctx.restore();
  }
}

/* ── 마리오 입력 + 물리 ── */
function updateMario() {
  if (mario.dying) {
    mario.dyingTimer--;
    if (mario.dyingTimer > 50) mario.vy = -12;
    else mario.vy += 0.7;
    mario.y += mario.vy;
    if (mario.dyingTimer <= 0) {
      if (mario.dyingTerminal) doGameOver();
      else {
        // 부활
        mario = {
          x: Math.max(50, camX + 100), y: 9 * T - 32,
          vx: 0, vy: 0, w: 24, h: 32,
          onGround: false, dir: 1, big: false, growAnim: 0,
          jumpHeld: false, dying: false, dyingTimer: 0,
        };
        hurtCooldown = 90;
        gameState = 'playing';
      }
    }
    return;
  }

  if (gameState !== 'playing') return;

  // 입력
  const left = isKey('left'), right = isKey('right'), run = isKey('run');
  const targetMax = run ? 6.5 : 4.0;
  const accel = 0.35, friction = 0.25;

  if (left)  { mario.vx -= accel; mario.dir = -1; }
  else if (right) { mario.vx += accel; mario.dir = 1; }
  else {
    if (Math.abs(mario.vx) < friction) mario.vx = 0;
    else mario.vx -= Math.sign(mario.vx) * friction;
  }
  if (mario.vx > targetMax) mario.vx = targetMax;
  if (mario.vx < -targetMax) mario.vx = -targetMax;

  // 점프 (코요테 + 버퍼)
  if (mario.onGround) coyote = 6; else if (coyote > 0) coyote--;
  if (jumpBuffer > 0) jumpBuffer--;

  if (jumpBuffer > 0 && coyote > 0) {
    mario.vy = -10.5 - Math.min(2, Math.abs(mario.vx) / 4); // 빠르면 약간 더 높음
    coyote = 0; jumpBuffer = 0;
    mario.onGround = false;
    mario.jumpHeld = true;
    SFX.jump();
  }

  // 가변 점프 — 점프 키를 떼면 상승 속도를 즉시 잘라줌
  if (mario.jumpHeld && !isKey('jump')) {
    mario.jumpHeld = false;
    if (mario.vy < -3) mario.vy = -3;
  }

  mario.hitWall = false;
  moveEntity(mario, 0.55, 14);

  if (hurtCooldown > 0) hurtCooldown--;
  if (starTimer > 0) {
    starTimer--;
    // 별 파티클
    if (frameCount % 3 === 0) {
      const hue = (frameCount * 24) % 360;
      particles.push({
        x: mario.x + mario.w/2 + (Math.random() - 0.5) * 20,
        y: mario.y + mario.h/2 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2,
        life: 1, decay: 0.04,
        color: `hsl(${hue}, 90%, 65%)`, size: 3,
      });
    }
  }
  if (mario.growAnim > 0) mario.growAnim--;

  // 카메라
  const camTarget = mario.x - CW * 0.4;
  camX = Math.max(camX, camTarget);  // 카메라는 뒤로 가지 않음
  camX = Math.max(0, camX);
  camX = Math.min(camX, GW * T - CW);

  // 낙사
  if (mario.y > CH + 100) {
    if (mario.big) {
      // 큰 상태에서도 구덩이는 즉사
    }
    lives--; updateHud(); SFX.hurt();
    if (lives <= 0) startDeath(true);
    else startDeath(false);
  }

  // 깃발 도달
  if (mario.x + mario.w > FLAG_X + 12 && gameState === 'playing') {
    startFlagClear();
  }
}

/* ── 메인 루프 ── */
let rafId = null;

function loop() {
  rafId = requestAnimationFrame(loop);
  frameCount++;

  if (gameState === 'clear' && flagAnim) {
    // 클리어 애니 진행
    if (flagAnim.descTimer > 0) {
      flagAnim.descTimer--;
      // 마리오도 깃발을 따라 내려옴
      mario.y = Math.min(9 * T - mario.h, mario.y + 3);
    } else if (!flagAnim.walked) {
      // 걸어서 성으로
      mario.vx = 2.5; mario.dir = 1;
      mario.x += mario.vx;
      if (mario.x > FLAG_X + 180) {
        flagAnim.walked = true;
        setTimeout(doClear, 100);
      }
    }
  } else if (gameState === 'playing' || gameState === 'dying') {
    updateMario();
    if (gameState === 'playing') {
      updateGoombas();
      updateKoopas();
      updatePowerUps();
      updateCoinEntities();
    }
  }

  // ? 블록 범프 애니
  for (const key in qBlocks) {
    const qb = qBlocks[key];
    if (qb.bumpVy !== 0 || qb.bumpY !== 0) {
      qb.bumpY += qb.bumpVy;
      qb.bumpVy += 0.8;
      if (qb.bumpY >= 0) { qb.bumpY = 0; qb.bumpVy = 0; }
    }
  }

  // 파티클
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = brickParticles.length - 1; i >= 0; i--) {
    const b = brickParticles[i];
    b.x += b.vx; b.y += b.vy; b.vy += 0.4;
    b.rot += b.vrot;
    b.life -= 0.018;
    if (b.life <= 0) brickParticles.splice(i, 1);
  }
  for (let i = coinBumps.length - 1; i >= 0; i--) {
    const c = coinBumps[i];
    c.y += c.vy; c.vy += 0.6; c.t++;
    c.life -= 0.04;
    if (c.life <= 0) coinBumps.splice(i, 1);
  }
  for (let i = scorePops.length - 1; i >= 0; i--) {
    const s = scorePops[i]; s.y += s.vy; s.vy *= 0.94; s.life -= 0.015;
    if (s.life <= 0) scorePops.splice(i, 1);
  }

  // 렌더
  ctx.clearRect(0, 0, CW, CH);
  drawBg();
  drawTiles();
  drawCoinEntities();
  drawFlag();
  drawPowerUps();
  drawParticlesAll();
  drawGoombas();
  drawKoopas();
  drawMario();

  // 별 모드 화면 효과
  if (starTimer > 0 && starTimer < 120 && Math.floor(starTimer / 6) % 2 === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, CW, CH);
  }
}

/* ── 시작 ── */
startBtn.addEventListener('click', () => {
  audio(); // 사용자 제스처로 오디오 활성화
  initGame();
});

setupTouch();

/* ── 초기 렌더 (오버레이 상태) ── */
(function initialPaint() {
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, COL.SKY_TOP);
  sky.addColorStop(1, COL.SKY_BOT);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
})();
