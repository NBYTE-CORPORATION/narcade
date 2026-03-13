const SIZE = 4;
let board, score, best, moved;

function newGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  best = parseInt(localStorage.getItem('2048_best') || '0');
  document.getElementById('resultOverlay').classList.add('hidden');
  addTile();
  addTile();
  render();
}

function addTile() {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  board[r][c] = Math.random() < 0.85 ? 2 : 4;
}

function tileClass(val) {
  if (val === 0) return '';
  if (val <= 2048) return `t-${val}`;
  return 't-high';
}

function render() {
  const bw = document.querySelector('.board-wrap').offsetWidth;
  const gap = 10;
  const pad = 10;
  const cellSize = (bw - pad * 2 - gap * (SIZE - 1)) / SIZE;

  const bd = document.getElementById('board');
  bd.innerHTML = '';

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) continue;
      const tile = document.createElement('div');
      tile.className = `tile ${tileClass(board[r][c])}`;
      tile.textContent = board[r][c];
      tile.style.width  = cellSize + 'px';
      tile.style.height = cellSize + 'px';
      tile.style.left   = (pad + c * (cellSize + gap)) + 'px';
      tile.style.top    = (pad + r * (cellSize + gap)) + 'px';
      bd.appendChild(tile);
    }
  }

  document.getElementById('score').textContent = score;
  document.getElementById('best').textContent  = best;
}

// Slide one row/col left, return { row, gained, merged }
function slideLeft(row) {
  let arr = row.filter(v => v !== 0);
  let gained = 0;
  let merged = false;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      gained += arr[i];
      arr.splice(i + 1, 1);
      merged = true;
    }
  }
  while (arr.length < SIZE) arr.push(0);
  return { arr, gained };
}

function move(dir) {
  let changed = false;
  let gained = 0;

  const rotate = (b) => b[0].map((_, c) => b.map(r => r[c]).reverse());

  let b = board.map(r => [...r]);

  if (dir === 'left') {
    for (let r = 0; r < SIZE; r++) {
      const res = slideLeft(b[r]);
      if (res.arr.join() !== b[r].join()) changed = true;
      b[r] = res.arr; gained += res.gained;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < SIZE; r++) {
      const rev = [...b[r]].reverse();
      const res = slideLeft(rev);
      const final = res.arr.reverse();
      if (final.join() !== b[r].join()) changed = true;
      b[r] = final; gained += res.gained;
    }
  } else if (dir === 'up') {
    b = rotate(rotate(rotate(b)));
    for (let r = 0; r < SIZE; r++) {
      const res = slideLeft(b[r]);
      if (res.arr.join() !== b[r].join()) changed = true;
      b[r] = res.arr; gained += res.gained;
    }
    b = rotate(b);
  } else if (dir === 'down') {
    b = rotate(b);
    for (let r = 0; r < SIZE; r++) {
      const res = slideLeft(b[r]);
      if (res.arr.join() !== b[r].join()) changed = true;
      b[r] = res.arr; gained += res.gained;
    }
    b = rotate(rotate(rotate(b)));
  }

  if (!changed) return;

  board = b;
  score += gained;
  if (score > best) {
    best = score;
    localStorage.setItem('2048_best', best);
  }

  addTile();
  render();

  // Check 2048
  if (board.some(r => r.includes(2048))) {
    showResult('win');
    return;
  }

  // Check game over
  if (!hasMove()) showResult('lose');
}

function hasMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (r < SIZE - 1 && board[r][c] === board[r+1][c]) return true;
      if (c < SIZE - 1 && board[r][c] === board[r][c+1]) return true;
    }
  return false;
}

function showResult(type) {
  const overlay = document.getElementById('resultOverlay');
  document.getElementById('resultEmoji').textContent  = type === 'win' ? '🏆' : '😢';
  document.getElementById('resultTitle').textContent  = type === 'win' ? '2048 달성!' : '게임 오버';
  document.getElementById('resultScore').textContent  = `점수: ${score}`;
  overlay.classList.remove('hidden');
}

// Keyboard
document.addEventListener('keydown', e => {
  const map = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
  if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
});

// Touch swipe
let tx, ty;
document.addEventListener('touchstart', e => {
  tx = e.touches[0].clientX;
  ty = e.touches[0].clientY;
});
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
});

newGame();
window.addEventListener('resize', render);
