/* ── Minesweeper — game17.js ── */
(function () {
  const DIFFS = {
    easy:   { cols: 9,  rows: 9,  mines: 10 },
    medium: { cols: 16, rows: 9,  mines: 20 },
    hard:   { cols: 16, rows: 16, mines: 40 }
  };

  let diff = 'easy';
  let board = [], cols, rows, mineCount;
  let gameState = 'idle'; // idle | playing | won | lost
  let flagCount = 0;
  let timerVal = 0, timerInterval = null;
  let firstClick = true;
  let longPressTimer = null;
  let revealQueue = [];

  const gridEl    = document.getElementById('grid');
  const mineEl    = document.getElementById('mineCount');
  const timerEl   = document.getElementById('timerEl');
  const faceBtn   = document.getElementById('faceBtn');
  const resultDiv = document.getElementById('result');
  const resultMsg = document.getElementById('resultMsg');
  const retryBtn  = document.getElementById('retryBtn');

  // ── Difficulty buttons ──
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      diff = btn.dataset.diff;
      initGame();
    });
  });

  faceBtn.addEventListener('click', initGame);
  retryBtn.addEventListener('click', initGame);

  // ── Init ──
  function initGame() {
    const cfg = DIFFS[diff];
    cols = cfg.cols;
    rows = cfg.rows;
    mineCount = cfg.mines;
    flagCount = 0;
    firstClick = true;
    gameState = 'idle';
    stopTimer();
    timerVal = 0;
    timerEl.textContent = '000';
    faceBtn.textContent = '🙂';
    resultDiv.style.display = 'none';
    mineEl.textContent = mineCount;

    board = [];
    for (let r = 0; r < rows; r++) {
      board[r] = [];
      for (let c = 0; c < cols; c++) {
        board[r][c] = { mine: false, revealed: false, flagged: false, adj: 0 };
      }
    }

    renderGrid();
  }

  // ── Place mines after first click ──
  function placeMines(safeRow, safeCol) {
    const safe = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr, nc = safeCol + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          safe.add(nr * cols + nc);
        }
      }
    }

    let placed = 0;
    while (placed < mineCount) {
      const idx = Math.floor(Math.random() * rows * cols);
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      if (!board[r][c].mine && !safe.has(idx)) {
        board[r][c].mine = true;
        placed++;
      }
    }

    // Calculate adjacency
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine) continue;
        let count = 0;
        forNeighbors(r, c, (nr, nc) => { if (board[nr][nc].mine) count++; });
        board[r][c].adj = count;
      }
    }
  }

  function forNeighbors(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) fn(nr, nc);
      }
    }
  }

  // ── Render ──
  function renderGrid() {
    gridEl.innerHTML = '';
    gridEl.style.width = (cols * 34) + 'px';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'ms-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        // Left click
        cell.addEventListener('click', onCellClick);
        // Right click (flag)
        cell.addEventListener('contextmenu', e => { e.preventDefault(); onFlag(r, c); });
        // Mouse down face
        cell.addEventListener('mousedown', () => {
          if (gameState === 'playing' || gameState === 'idle') faceBtn.textContent = '😮';
        });
        cell.addEventListener('mouseup', () => {
          if (gameState === 'playing' || gameState === 'idle') faceBtn.textContent = '🙂';
        });
        // Long press for mobile flag
        cell.addEventListener('touchstart', e => {
          e.preventDefault();
          longPressTimer = setTimeout(() => {
            onFlag(r, c);
            longPressTimer = null;
          }, 500);
        }, { passive: false });
        cell.addEventListener('touchend', e => {
          e.preventDefault();
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            onCellClick.call(cell, { target: cell });
          }
        });

        gridEl.appendChild(cell);
        updateCell(r, c, cell);
      }
    }
  }

  function getCellEl(r, c) {
    return gridEl.children[r * cols + c];
  }

  function updateCell(r, c, el) {
    el = el || getCellEl(r, c);
    if (!el) return;
    const cell = board[r][c];
    el.className = 'ms-cell';
    el.textContent = '';

    if (cell.revealed) {
      el.classList.add('revealed');
      if (cell.mine) {
        el.textContent = '💣';
      } else if (cell.adj > 0) {
        el.textContent = cell.adj;
        el.classList.add('num-' + cell.adj);
      }
    } else if (cell.flagged) {
      el.classList.add('flagged');
      el.textContent = '🚩';
    }
  }

  // ── Click handler ──
  function onCellClick(e) {
    const r = parseInt(e.target.closest('.ms-cell').dataset.r);
    const c = parseInt(e.target.closest('.ms-cell').dataset.c);
    if (gameState === 'won' || gameState === 'lost') return;
    if (board[r][c].flagged || board[r][c].revealed) return;

    if (firstClick) {
      firstClick = false;
      gameState = 'playing';
      placeMines(r, c);
      startTimer();
    }

    if (board[r][c].mine) {
      triggerLose(r, c);
      return;
    }

    revealCell(r, c);
    checkWin();
  }

  function onFlag(r, c) {
    if (gameState === 'won' || gameState === 'lost') return;
    if (board[r][c].revealed) return;
    board[r][c].flagged = !board[r][c].flagged;
    flagCount += board[r][c].flagged ? 1 : -1;
    mineEl.textContent = mineCount - flagCount;
    updateCell(r, c);
  }

  // ── BFS reveal ──
  function revealCell(r, c, delay) {
    delay = delay || 0;
    if (board[r][c].revealed || board[r][c].flagged) return;
    board[r][c].revealed = true;
    const el = getCellEl(r, c);
    setTimeout(() => {
      if (el) {
        el.classList.add('reveal-anim');
        updateCell(r, c, el);
      }
    }, delay);

    if (board[r][c].adj === 0) {
      let d = delay;
      forNeighbors(r, c, (nr, nc) => {
        if (!board[nr][nc].revealed && !board[nr][nc].flagged) {
          d += 15;
          revealCell(nr, nc, d);
        }
      });
    }
  }

  // ── Win / Lose ──
  function checkWin() {
    let unrevealed = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].revealed && !board[r][c].mine) unrevealed++;
      }
    }
    if (unrevealed === 0) {
      gameState = 'won';
      stopTimer();
      faceBtn.textContent = '😎';
      const bestKey = 'ms_best_' + diff;
      const prev = parseInt(localStorage.getItem(bestKey) || '9999');
      let bestMsg = '';
      if (timerVal < prev) {
        localStorage.setItem(bestKey, timerVal);
        bestMsg = ' 🏆 최고 기록!';
      } else {
        bestMsg = ` (최고: ${prev}초)`;
      }
      showResult(`🎉 클리어! 시간: ${timerVal}초${bestMsg}`);
    }
  }

  function triggerLose(hitR, hitC) {
    gameState = 'lost';
    stopTimer();
    faceBtn.textContent = '😵';
    // Reveal all mines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine) {
          board[r][c].revealed = true;
          const el = getCellEl(r, c);
          if (el) {
            el.classList.add('revealed');
            el.textContent = '💣';
            if (r === hitR && c === hitC) el.classList.add('mine-hit');
          }
        }
      }
    }
    showResult('💥 폭발! 다시 도전하세요');
  }

  function showResult(msg) {
    resultMsg.textContent = msg;
    resultDiv.style.display = 'block';
  }

  // ── Timer ──
  function startTimer() {
    stopTimer();
    timerVal = 0;
    timerInterval = setInterval(() => {
      timerVal++;
      timerEl.textContent = String(timerVal).padStart(3, '0');
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  initGame();
})();
