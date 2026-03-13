/* ── game14.js — 테트리스 ── */

const canvas     = document.getElementById('tetrisCanvas');
const ctx        = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx    = nextCanvas.getContext('2d');

const COLS  = 10;
const ROWS  = 20;
const BLOCK = 30;

/* ── 7가지 테트로미노 ── */
const PIECES = [
  { cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#06b6d4' }, // I
  { cells: [[1,1],[1,1]],                              color: '#f59e0b' }, // O
  { cells: [[0,1,0],[1,1,1],[0,0,0]],                 color: '#a78bfa' }, // T
  { cells: [[0,1,1],[1,1,0],[0,0,0]],                 color: '#10b981' }, // S
  { cells: [[1,1,0],[0,1,1],[0,0,0]],                 color: '#ef4444' }, // Z
  { cells: [[1,0,0],[1,1,1],[0,0,0]],                 color: '#3b82f6' }, // J
  { cells: [[0,0,1],[1,1,1],[0,0,0]],                 color: '#f97316' }, // L
];

/* ── 상태 ── */
let board, piece, nextPiece;
let score, level, lines, bestScore;
let dropInterval, dropCounter, lastTime, animId;
let gameRunning = false;

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const bestEl  = document.getElementById('best');
const overlay       = document.getElementById('overlay');
const overlayTitle  = document.getElementById('overlayTitle');
const overlayMsg    = document.getElementById('overlayMsg');
const startBtn      = document.getElementById('startBtn');

/* ── 유틸 ── */
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const src = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    cells: src.cells.map(r => [...r]),
    color: src.color,
    x: Math.floor(COLS / 2) - Math.floor(src.cells[0].length / 2),
    y: 0,
  };
}

function rotate(cells) {
  const rows = cells.length, cols = cells[0].length;
  const out = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out[c][rows - 1 - r] = cells[r][c];
  return out;
}

function isValid(cells, px, py) {
  for (let r = 0; r < cells.length; r++)
    for (let c = 0; c < cells[r].length; c++) {
      if (!cells[r][c]) continue;
      const nx = px + c, ny = py + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
  return true;
}

function lighten(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (n >> 16)        + amt);
  const g = Math.min(255, ((n >> 8) & 0xff)+ amt);
  const b = Math.min(255, (n & 0xff)       + amt);
  return `rgb(${r},${g},${b})`;
}

/* ── 게임 로직 ── */
function placePiece() {
  for (let r = 0; r < piece.cells.length; r++)
    for (let c = 0; c < piece.cells[r].length; c++) {
      if (!piece.cells[r][c]) continue;
      const ny = piece.y + r;
      if (ny < 0) { endGame(); return; }
      board[ny][piece.x + c] = piece.color;
    }

  clearLines();
  piece     = nextPiece;
  nextPiece = randomPiece();
  drawNext();

  if (!isValid(piece.cells, piece.x, piece.y)) endGame();
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(c => c !== null)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      r++;
    }
  }
  if (!cleared) return;
  const pts = [0, 100, 300, 500, 800];
  score += (pts[cleared] ?? 800) * level;
  lines += cleared;
  level        = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(80, 1000 - (level - 1) * 95);
  updateUI();
}

function updateUI() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('tetris_best', bestScore);
    bestEl.textContent = bestScore;
  }
}

function getGhostY() {
  let gy = piece.y;
  while (isValid(piece.cells, piece.x, gy + 1)) gy++;
  return gy;
}

function moveDown() {
  if (isValid(piece.cells, piece.x, piece.y + 1)) {
    piece.y++;
  } else {
    placePiece();
  }
}

/* ── 렌더링 ── */
function drawBlock(context, color, x, y, size, alpha = 1) {
  context.globalAlpha = alpha;
  const grd = context.createLinearGradient(x, y, x + size, y + size);
  grd.addColorStop(0, lighten(color, 45));
  grd.addColorStop(1, color);
  context.fillStyle = grd;
  context.beginPath();
  context.roundRect(x + 1, y + 1, size - 2, size - 2, 5);
  context.fill();

  context.fillStyle = 'rgba(255,255,255,0.22)';
  context.beginPath();
  context.roundRect(x + 3, y + 3, size - 6, 5, 3);
  context.fill();
  context.globalAlpha = 1;
}

function draw() {
  /* 배경 */
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  /* 격자 */
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, canvas.height); ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(canvas.width, r * BLOCK); ctx.stroke();
  }

  /* 보드 */
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c])
        drawBlock(ctx, board[r][c], c * BLOCK, r * BLOCK, BLOCK);

  if (!piece || !gameRunning) return;

  /* 고스트 */
  const gy = getGhostY();
  for (let r = 0; r < piece.cells.length; r++)
    for (let c = 0; c < piece.cells[r].length; c++)
      if (piece.cells[r][c])
        drawBlock(ctx, piece.color, (piece.x + c) * BLOCK, (gy + r) * BLOCK, BLOCK, 0.15);

  /* 현재 피스 */
  for (let r = 0; r < piece.cells.length; r++)
    for (let c = 0; c < piece.cells[r].length; c++)
      if (piece.cells[r][c])
        drawBlock(ctx, piece.color, (piece.x + c) * BLOCK, (piece.y + r) * BLOCK, BLOCK);
}

function drawNext() {
  nextCtx.fillStyle = '#07070f';
  nextCtx.fillRect(0, 0, 120, 120);
  if (!nextPiece) return;

  const cells = nextPiece.cells;
  const bw = cells[0].length, bh = cells.length;
  const sz = 24;
  const ox = Math.floor((120 - bw * sz) / 2);
  const oy = Math.floor((120 - bh * sz) / 2);

  for (let r = 0; r < bh; r++)
    for (let c = 0; c < bw; c++)
      if (cells[r][c])
        drawBlock(nextCtx, nextPiece.color, ox + c * sz, oy + r * sz, sz);
}

/* ── 게임 루프 ── */
function gameLoop(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;

  if (dropCounter >= dropInterval) {
    moveDown();
    dropCounter = 0;
  }

  draw();
  animId = requestAnimationFrame(gameLoop);
}

/* ── 시작 / 종료 ── */
function startGame() {
  if (animId) cancelAnimationFrame(animId);

  board        = createBoard();
  score        = 0;
  level        = 1;
  lines        = 0;
  dropInterval = 1000;
  dropCounter  = 0;
  lastTime     = 0;
  bestScore    = parseInt(localStorage.getItem('tetris_best') || '0');

  piece     = randomPiece();
  nextPiece = randomPiece();
  gameRunning = true;

  updateUI();
  bestEl.textContent = bestScore;
  drawNext();
  overlay.style.display = 'none';
  animId = requestAnimationFrame(gameLoop);
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = '게임 오버';
  overlayMsg.innerHTML = `점수: <strong>${score}</strong><br>최고기록: <strong>${bestScore}</strong>`;
  startBtn.textContent = '다시 하기';
  overlay.style.display = 'flex';
}

/* ── 키보드 ── */
document.addEventListener('keydown', e => {
  if (!gameRunning) return;

  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      if (isValid(piece.cells, piece.x - 1, piece.y)) piece.x--;
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (isValid(piece.cells, piece.x + 1, piece.y)) piece.x++;
      break;
    case 'ArrowDown':
      e.preventDefault();
      moveDown();
      dropCounter = 0;
      score++;
      scoreEl.textContent = score;
      break;
    case 'ArrowUp':
    case 'KeyX': {
      e.preventDefault();
      const rot = rotate(piece.cells);
      if      (isValid(rot, piece.x,     piece.y)) { piece.cells = rot; }
      else if (isValid(rot, piece.x - 1, piece.y)) { piece.cells = rot; piece.x--; }
      else if (isValid(rot, piece.x + 1, piece.y)) { piece.cells = rot; piece.x++; }
      else if (isValid(rot, piece.x - 2, piece.y)) { piece.cells = rot; piece.x -= 2; }
      break;
    }
    case 'Space': {
      e.preventDefault();
      let hardDropScore = 0;
      while (isValid(piece.cells, piece.x, piece.y + 1)) {
        piece.y++;
        hardDropScore += 2;
      }
      placePiece();
      dropCounter = 0;
      score += hardDropScore;
      scoreEl.textContent = score;
      break;
    }
  }
});

/* ── 터치 컨트롤 ── */
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (!gameRunning) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const adx = Math.abs(dx), ady = Math.abs(dy);

  if (adx < 10 && ady < 10) {
    // 탭 → 회전
    const rot = rotate(piece.cells);
    if      (isValid(rot, piece.x,     piece.y)) { piece.cells = rot; }
    else if (isValid(rot, piece.x - 1, piece.y)) { piece.cells = rot; piece.x--; }
    else if (isValid(rot, piece.x + 1, piece.y)) { piece.cells = rot; piece.x++; }
  } else if (adx > ady) {
    const steps = Math.round(adx / BLOCK);
    const dir   = dx > 0 ? 1 : -1;
    for (let i = 0; i < steps; i++)
      if (isValid(piece.cells, piece.x + dir, piece.y)) piece.x += dir;
  } else if (dy > 40) {
    // 아래 스와이프 → 하드 드롭
    while (isValid(piece.cells, piece.x, piece.y + 1)) piece.y++;
    placePiece();
    dropCounter = 0;
  }
}, { passive: true });

/* ── 버튼 ── */
startBtn.addEventListener('click', startGame);

/* ── 초기 최고기록 표시 ── */
bestEl.textContent = localStorage.getItem('tetris_best') || 0;
