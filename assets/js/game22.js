/* ── game22.js — 슬라이딩 퍼즐 ── */

const boardEl   = document.getElementById('board');
const movesEl   = document.getElementById('movesEl');
const timeEl    = document.getElementById('timeEl');
const bestEl    = document.getElementById('bestEl');
const shuffleBtn = document.getElementById('shuffleBtn');
const hintBtn   = document.getElementById('hintBtn');
const winPanel  = document.getElementById('winPanel');
const winMsg    = document.getElementById('winMsg');
const nextBtn   = document.getElementById('nextBtn');

let size = 3;           // 현재 보드 크기 (3×3, 4×4, 5×5)
let tiles = [];         // 1D 배열, 0 = 빈 칸
let moves = 0;
let seconds = 0;
let timerInterval = null;
let gameRunning = false;
let emptyIdx = 0;       // 빈 칸 인덱스

/* ── 난이도 버튼 ── */
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    size = parseInt(btn.dataset.size);
    updateBest();
    initGame();
  });
});

/* ── 유틸 ── */
function formatTime(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

function bestKey() { return `slide_best_${size}`; }

function updateBest() {
  const b = localStorage.getItem(bestKey());
  bestEl.textContent = b ? JSON.parse(b).moves + '수' : '—';
}

function isSolved() {
  for (let i = 0; i < tiles.length - 1; i++) if (tiles[i] !== i + 1) return false;
  return tiles[tiles.length - 1] === 0;
}

/* ── 셔플 (풀 수 있는 상태 보장) ── */
function solvable(arr, n) {
  let inv = 0;
  const flat = arr.filter(x => x !== 0);
  for (let i = 0; i < flat.length; i++)
    for (let j = i+1; j < flat.length; j++)
      if (flat[i] > flat[j]) inv++;
  if (n % 2 === 1) return inv % 2 === 0;
  const emptyRow = n - 1 - Math.floor(arr.indexOf(0) / n);
  return (inv + emptyRow) % 2 === 0;
}

function shuffleTiles() {
  const goal = [...Array(size*size-1).keys()].map(i=>i+1).concat([0]);
  let arr;
  do {
    arr = [...goal].sort(() => Math.random()-0.5);
  } while (!solvable(arr, size) || isSolvedArr(arr));
  return arr;
}

function isSolvedArr(arr) {
  for (let i=0;i<arr.length-1;i++) if(arr[i]!==i+1) return false;
  return arr[arr.length-1]===0;
}

/* ── 게임 초기화 ── */
function initGame() {
  clearInterval(timerInterval);
  winPanel.style.display = 'none';
  moves = 0; seconds = 0; gameRunning = true;

  movesEl.textContent = '0';
  timeEl.textContent  = '0:00';
  updateBest();

  tiles = shuffleTiles();
  emptyIdx = tiles.indexOf(0);

  renderBoard();

  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    seconds++;
    timeEl.textContent = formatTime(seconds);
  }, 1000);
}

/* ── 보드 렌더링 ── */
function renderBoard() {
  const tileSize = Math.min(80, Math.floor(340 / size));
  const gap = 6;

  boardEl.style.gridTemplateColumns = `repeat(${size}, ${tileSize}px)`;
  boardEl.style.gap = `${gap}px`;
  boardEl.innerHTML = '';

  tiles.forEach((val, idx) => {
    const div = document.createElement('div');
    div.className = 'tile' + (val === 0 ? ' empty' : '');
    div.style.width  = tileSize + 'px';
    div.style.height = tileSize + 'px';
    div.style.fontSize = Math.round(tileSize * 0.38) + 'px';

    if (val !== 0) {
      div.textContent = val;
      /* 제자리에 있는 타일 표시 */
      if (val === idx + 1) div.classList.add('correct');
      div.addEventListener('click', () => tryMove(idx));
    }
    boardEl.appendChild(div);
  });
}

/* ── 이동 ── */
function tryMove(idx) {
  if (!gameRunning) return;

  const row = Math.floor(idx / size), col = idx % size;
  const eRow = Math.floor(emptyIdx / size), eCol = emptyIdx % size;

  /* 같은 행: 빈칸 방향으로 여러 타일 슬라이드 */
  if (row === eRow) {
    const dir = eCol > col ? 1 : -1;
    for (let c = col; c !== eCol; c += dir) {
      const from = row * size + c;
      const to   = row * size + c + dir;
      [tiles[from], tiles[to]] = [tiles[to], tiles[from]];
    }
    emptyIdx = idx;
    moves++;
  } else if (col === eCol) {
    const dir = eRow > row ? 1 : -1;
    for (let r = row; r !== eRow; r += dir) {
      const from = r * size + col;
      const to   = (r + dir) * size + col;
      [tiles[from], tiles[to]] = [tiles[to], tiles[from]];
    }
    emptyIdx = idx;
    moves++;
  } else {
    return; // 이동 불가
  }

  movesEl.textContent = moves;
  renderBoard();

  if (isSolved()) winGame();
}

/* ── 키보드 ── */
document.addEventListener('keydown', e => {
  if (!gameRunning) return;
  const eRow = Math.floor(emptyIdx / size), eCol = emptyIdx % size;
  let target = -1;

  if (e.key === 'ArrowUp'    && eRow < size-1) target = emptyIdx + size;
  if (e.key === 'ArrowDown'  && eRow > 0)      target = emptyIdx - size;
  if (e.key === 'ArrowLeft'  && eCol < size-1) target = emptyIdx + 1;
  if (e.key === 'ArrowRight' && eCol > 0)      target = emptyIdx - 1;

  if (target >= 0) { e.preventDefault(); tryMove(target); }
});

/* ── 힌트 ── */
function showHint() {
  if (!gameRunning) return;
  /* 제자리에 없는 타일 중 하나에 flash 효과 */
  const wrongTiles = [];
  tiles.forEach((v, i) => { if (v !== 0 && v !== i+1) wrongTiles.push(i); });
  if (wrongTiles.length === 0) return;

  const pick = wrongTiles[Math.floor(Math.random() * Math.min(3, wrongTiles.length))];
  const el = boardEl.children[pick];
  if (el) { el.classList.remove('hint-flash'); void el.offsetWidth; el.classList.add('hint-flash'); }
}

/* ── 승리 ── */
function winGame() {
  gameRunning = false;
  clearInterval(timerInterval);

  const key  = bestKey();
  const prev = localStorage.getItem(key);
  let isNew  = false;

  if (!prev || moves < JSON.parse(prev).moves) {
    localStorage.setItem(key, JSON.stringify({ moves, time: seconds }));
    isNew = true;
  }

  updateBest();

  winMsg.innerHTML =
    `${isNew ? '<strong style="color:var(--amber)">🏆 신기록!</strong><br>' : ''}` +
    `이동: <strong>${moves}번</strong> &nbsp;|&nbsp; 시간: <strong>${formatTime(seconds)}</strong>`;
  winPanel.style.display = 'block';

  /* 정답 타일 반짝이기 */
  [...boardEl.children].forEach((el, i) => {
    setTimeout(() => {
      el.style.transition = 'background 0.3s';
      el.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(6,182,212,0.2))';
      el.style.borderColor = 'rgba(16,185,129,0.6)';
    }, i * 30);
  });
}

/* ── 버튼 ── */
shuffleBtn.addEventListener('click', initGame);
hintBtn.addEventListener('click', showHint);
nextBtn.addEventListener('click', () => { winPanel.style.display='none'; initGame(); });

/* ── 시작 ── */
updateBest();
initGame();
