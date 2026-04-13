/* ============================
   과일 박스 (Fruit Box)
   ============================ */

const MODES = {
  vertical:   { cols: 10, rows: 17 },
  horizontal: { cols: 17, rows: 10 }
};
const TIME_LIMIT = 120; // 2분

let COLS = 17;
let ROWS = 10;
let currentMode = 'horizontal';

const board = document.getElementById('board');
const selBox = document.getElementById('selBox');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMsg = document.getElementById('overlayMsg');
const startBtn = document.getElementById('startBtn');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const bestEl = document.getElementById('best');
const sumIndicator = document.getElementById('sumIndicator');
const modeSelect = document.getElementById('modeSelect');

let grid = [];       // 2D array of numbers (0 = empty)
let cells = [];      // 2D array of DOM elements
let score = 0;
let bestScore = parseInt(localStorage.getItem('fruitbox_best')) || 0;
let timeLeft = TIME_LIMIT;
let timerInterval = null;
let dragging = false;
let startX = 0, startY = 0;
let running = false;

bestEl.textContent = bestScore;

/* ── Mode Selection ── */
modeSelect.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  currentMode = btn.dataset.mode;
  modeSelect.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyMode();
  generateBoard();
});

function applyMode() {
  COLS = MODES[currentMode].cols;
  ROWS = MODES[currentMode].rows;
  board.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  if (currentMode === 'horizontal') {
    board.style.setProperty('--cell-size', '32px');
    board.style.setProperty('--cell-font', '0.95rem');
  } else {
    board.style.setProperty('--cell-size', '36px');
    board.style.setProperty('--cell-font', '1.05rem');
  }
}

applyMode();

// Generate initial board so the container has size
generateBoard();

/* ── Generate Board ── */
function generateBoard() {
  grid = [];
  cells = [];
  board.innerHTML = '';

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    const cellRow = [];
    for (let c = 0; c < COLS; c++) {
      const val = Math.floor(Math.random() * 9) + 1;
      row.push(val);

      const el = document.createElement('div');
      el.className = 'cell';
      el.textContent = val;
      el.dataset.row = r;
      el.dataset.col = c;
      board.appendChild(el);
      cellRow.push(el);
    }
    grid.push(row);
    cells.push(cellRow);
  }
}

/* ── Timer ── */
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function startTimer() {
  timerEl.textContent = formatTime(timeLeft);
  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = formatTime(timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 1000);
}

/* ── Selection Logic ── */
function getBoardRect() {
  return board.getBoundingClientRect();
}

function getCellSize() {
  const rect = getBoardRect();
  return {
    w: rect.width / COLS,
    h: rect.height / ROWS
  };
}

function getSelectedCells(x1, y1, x2, y2) {
  const rect = getBoardRect();
  const cellSize = getCellSize();

  // Convert to board-local coordinates
  const lx1 = Math.min(x1, x2) - rect.left;
  const ly1 = Math.min(y1, y2) - rect.top;
  const lx2 = Math.max(x1, x2) - rect.left;
  const ly2 = Math.max(y1, y2) - rect.top;

  const colStart = Math.max(0, Math.floor(lx1 / cellSize.w));
  const colEnd = Math.min(COLS - 1, Math.floor(lx2 / cellSize.w));
  const rowStart = Math.max(0, Math.floor(ly1 / cellSize.h));
  const rowEnd = Math.min(ROWS - 1, Math.floor(ly2 / cellSize.h));

  const selected = [];
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      if (grid[r][c] > 0) {
        selected.push({ r, c, val: grid[r][c] });
      }
    }
  }
  return selected;
}

function highlightCells(selected) {
  // Clear previous
  document.querySelectorAll('.cell.selected').forEach(el => el.classList.remove('selected'));
  selected.forEach(({ r, c }) => {
    cells[r][c].classList.add('selected');
  });
}

function updateSumIndicator(selected) {
  const sum = selected.reduce((acc, s) => acc + s.val, 0);
  sumIndicator.textContent = `합: ${sum}`;
  sumIndicator.classList.remove('perfect', 'over');
  if (sum === 10 && selected.length > 0) {
    sumIndicator.classList.add('perfect');
  } else if (sum > 10) {
    sumIndicator.classList.add('over');
  }
}

function removeCells(selected) {
  selected.forEach(({ r, c }) => {
    grid[r][c] = 0;
    const el = cells[r][c];
    el.classList.remove('selected');
    el.classList.add('matched');
    setTimeout(() => {
      el.classList.add('empty');
      el.classList.remove('matched');
      el.textContent = '';
    }, 400);
  });

  score += selected.length;
  scoreEl.textContent = score;
}

/* ── Drag Handling ── */
function getPointerPos(e) {
  if (e.touches) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

function onDragStart(e) {
  if (!running) return;
  if (e.target.closest('.overlay')) return;
  e.preventDefault();
  dragging = true;
  const pos = getPointerPos(e);
  startX = pos.x;
  startY = pos.y;
  selBox.style.display = 'block';
  updateSelBox(pos.x, pos.y);
}

function onDragMove(e) {
  if (!dragging) return;
  e.preventDefault();
  const pos = getPointerPos(e);
  updateSelBox(pos.x, pos.y);

  const selected = getSelectedCells(startX, startY, pos.x, pos.y);
  highlightCells(selected);
  updateSumIndicator(selected);
}

function onDragEnd(e) {
  if (!dragging) return;
  dragging = false;
  selBox.style.display = 'none';

  const pos = e.changedTouches ? {
    x: e.changedTouches[0].clientX,
    y: e.changedTouches[0].clientY
  } : { x: e.clientX, y: e.clientY };

  const selected = getSelectedCells(startX, startY, pos.x, pos.y);
  const sum = selected.reduce((acc, s) => acc + s.val, 0);

  document.querySelectorAll('.cell.selected').forEach(el => el.classList.remove('selected'));

  if (sum === 10 && selected.length > 0) {
    removeCells(selected);
  }

  sumIndicator.textContent = '합: 0';
  sumIndicator.classList.remove('perfect', 'over');

  // Check if any moves are possible
  if (running && !hasMovesLeft()) {
    clearInterval(timerInterval);
    endGame();
  }
}

function updateSelBox(curX, curY) {
  const containerRect = board.parentElement.getBoundingClientRect();
  const x1 = Math.min(startX, curX) - containerRect.left;
  const y1 = Math.min(startY, curY) - containerRect.top;
  const x2 = Math.max(startX, curX) - containerRect.left;
  const y2 = Math.max(startY, curY) - containerRect.top;

  selBox.style.left = x1 + 'px';
  selBox.style.top = y1 + 'px';
  selBox.style.width = (x2 - x1) + 'px';
  selBox.style.height = (y2 - y1) + 'px';
}

/* ── Check Possible Moves ── */
function hasMovesLeft() {
  // Check all possible rectangles for sum=10
  for (let r1 = 0; r1 < ROWS; r1++) {
    for (let c1 = 0; c1 < COLS; c1++) {
      if (grid[r1][c1] === 0) continue;
      let sum = 0;
      for (let r2 = r1; r2 < ROWS; r2++) {
        for (let c2 = (r2 === r1 ? c1 : 0); c2 < COLS; c2++) {
          // Calculate sum of rectangle [r1,c1] to [r2,c2]
          let rectSum = 0;
          let hasCell = false;
          for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
              rectSum += grid[r][c];
              if (grid[r][c] > 0) hasCell = true;
            }
          }
          if (hasCell && rectSum === 10) return true;
          if (rectSum > 10) break; // prune: sum can only grow
        }
      }
    }
  }
  return false;
}

/* ── Game Flow ── */
function startGame() {
  score = 0;
  timeLeft = TIME_LIMIT;
  scoreEl.textContent = '0';
  sumIndicator.textContent = '합: 0';
  sumIndicator.classList.remove('perfect', 'over');
  applyMode();
  generateBoard();
  overlay.classList.add('hidden');
  running = true;
  startTimer();
}

function endGame() {
  running = false;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('fruitbox_best', bestScore);
    bestEl.textContent = bestScore;
  }

  const total = COLS * ROWS;
  const remaining = grid.flat().filter(v => v > 0).length;
  const cleared = total - remaining;

  overlayTitle.textContent = '게임 종료!';
  overlayMsg.innerHTML = `
    🍎 제거한 사과: <strong>${cleared}</strong>개<br>
    남은 사과: ${remaining}개<br>
    ${score > bestScore - 1 ? '🎉 새 최고 기록!' : ''}
  `;
  startBtn.textContent = '다시 하기';
  overlay.classList.remove('hidden');
}

/* ── Events ── */
startBtn.addEventListener('click', startGame);

const container = board.parentElement;
container.addEventListener('mousedown', onDragStart);
window.addEventListener('mousemove', onDragMove);
window.addEventListener('mouseup', onDragEnd);

container.addEventListener('touchstart', onDragStart, { passive: false });
window.addEventListener('touchmove', onDragMove, { passive: false });
window.addEventListener('touchend', onDragEnd);
