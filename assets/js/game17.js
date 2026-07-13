/* ── Minesweeper — game17.js ── */
'use strict';

Arcade.init({ id: 'game17', title: '지뢰 찾기', emoji: '💣', accent: 'green' });

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
  let firstClick = true;
  let flagMode = false;
  let endSched = null;

  const gridEl      = document.getElementById('grid');
  const boardEl     = document.getElementById('board');
  const mineEl      = document.getElementById('mineCount');
  const timerEl     = document.getElementById('timerEl');
  const bestEl      = document.getElementById('bestEl');
  const faceBtn     = document.getElementById('faceBtn');
  const flagModeBtn = document.getElementById('flagModeBtn');

  const ov = Arcade.overlay('#overlay');

  /* ── 타이머 (스톱워치, Esc/탭 전환 자동 일시정지) ── */
  let lastSec = -1;
  const timer = new Arcade.Timer({
    onTick: function (elapsed) {
      const sec = Math.min(999, Math.floor(elapsed / 1000));
      if (sec !== lastSec) {
        lastSec = sec;
        timerEl.textContent = String(sec).padStart(3, '0');
      }
    }
  });

  Arcade.pause.register({
    isActive: function () { return gameState === 'playing'; }
  });

  /* ── 난이도 (레거시 ms_best_* 키와 같은 id 유지: easy/medium/hard) ── */
  diff = Arcade.difficulty(
    document.getElementById('diffPills'),
    [
      { id: 'easy',   label: '쉬움' },
      { id: 'medium', label: '보통' },
      { id: 'hard',   label: '어려움' }
    ],
    function (id) { diff = id; initGame(); },
    { gameId: 'game17' }
  );

  /* ── 깃발 모드 토글 ── */
  flagModeBtn.addEventListener('click', function () {
    flagMode = !flagMode;
    flagModeBtn.classList.toggle('active', flagMode);
    flagModeBtn.setAttribute('aria-pressed', flagMode ? 'true' : 'false');
    Arcade.audio.play('click');
  });

  faceBtn.addEventListener('click', function () {
    Arcade.audio.play('click');
    initGame();
  });

  /* ── 최고 기록 표시 ── */
  function updateBestDisplay() {
    const b = Arcade.best.score('game17', { suffix: diff });
    bestEl.textContent = b !== null ? b + '초' : '—';
  }

  /* ── Init ── */
  function initGame() {
    const cfg = DIFFS[diff];
    cols = cfg.cols;
    rows = cfg.rows;
    mineCount = cfg.mines;
    flagCount = 0;
    firstClick = true;
    gameState = 'idle';
    timer.stop();
    lastSec = -1;
    timerEl.textContent = '000';
    faceBtn.textContent = '🙂';
    mineEl.textContent = mineCount;
    if (endSched) { endSched.cancel(); endSched = null; }
    ov.hide();
    updateBestDisplay();

    board = [];
    for (let r = 0; r < rows; r++) {
      board[r] = [];
      for (let c = 0; c < cols; c++) {
        board[r][c] = { mine: false, revealed: false, flagged: false, adj: 0 };
      }
    }

    renderGrid();
  }

  /* ── 첫 클릭 후 지뢰 배치 ── */
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

  /* ── Render ── */
  function renderGrid() {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = 'repeat(' + cols + ', var(--cell))';
    gridEl.classList.toggle('compact', cols > 12);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'ms-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        bindCell(cell, r, c);
        gridEl.appendChild(cell);
        updateCell(r, c, cell);
      }
    }
  }

  function bindCell(cell, r, c) {
    /* 스크롤 드래그 판별 (보드 가로 스크롤과 충돌 방지) */
    let downX = 0, downY = 0, moved = false;
    cell.addEventListener('pointerdown', function (e) {
      downX = e.clientX; downY = e.clientY; moved = false;
    });
    cell.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - downX) > 10 || Math.abs(e.clientY - downY) > 10) moved = true;
    });

    /* 롱프레스(450ms) → 깃발, 짧은 탭 → 열기 (포인터 통합) */
    Arcade.touch.hold(cell, function () {
      if (moved) return;                  // 스크롤 중이면 무시
      onFlag(r, c);
    }, function (e, held) {
      if (e.type !== 'pointerup') return; // 이탈/취소는 무시
      if (held || moved) return;          // 롱프레스로 처리됨 / 스크롤 제스처
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (flagMode) onFlag(r, c);
      else onReveal(r, c);
    }, { delay: 450 });

    /* 데스크톱 우클릭 깃발 (컨텍스트 메뉴 억제) */
    cell.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      onFlag(r, c);
    });

    /* 누르는 동안 얼굴 표정 */
    cell.addEventListener('pointerdown', function () {
      if (gameState === 'playing' || gameState === 'idle') faceBtn.textContent = '😮';
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      cell.addEventListener(ev, function () {
        if (gameState === 'playing' || gameState === 'idle') faceBtn.textContent = '🙂';
      });
    });
  }

  function getCellEl(r, c) {
    return gridEl.children[r * cols + c];
  }

  function updateCell(r, c, el) {
    el = el || getCellEl(r, c);
    if (!el) return;
    const cell = board[r][c];
    const wasAnim = el.classList.contains('reveal-anim');
    el.className = 'ms-cell' + (wasAnim ? ' reveal-anim' : '');
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

  /* ── 열기 ── */
  function onReveal(r, c) {
    if (gameState === 'won' || gameState === 'lost') return;
    if (Arcade.pause.active) return;
    if (board[r][c].flagged || board[r][c].revealed) return;

    if (firstClick) {
      firstClick = false;
      gameState = 'playing';
      placeMines(r, c);
      timer.start();
    }

    if (board[r][c].mine) {
      triggerLose(r, c);
      return;
    }

    const opened = revealCell(r, c, 0);
    Arcade.audio.play(opened > 8 ? 'coin' : 'click');
    checkWin();
  }

  function onFlag(r, c) {
    if (gameState === 'won' || gameState === 'lost') return;
    if (Arcade.pause.active) return;
    if (board[r][c].revealed) return;
    board[r][c].flagged = !board[r][c].flagged;
    flagCount += board[r][c].flagged ? 1 : -1;
    mineEl.textContent = mineCount - flagCount;
    Arcade.audio.play('pop');
    updateCell(r, c);
  }

  /* ── 연쇄 열기 (열린 칸 수 반환) ── */
  function revealCell(r, c, delay) {
    if (board[r][c].revealed || board[r][c].flagged) return 0;
    board[r][c].revealed = true;
    let opened = 1;
    const el = getCellEl(r, c);
    setTimeout(function () {
      if (el) {
        el.classList.add('reveal-anim');
        updateCell(r, c, el);
      }
    }, delay);

    if (board[r][c].adj === 0) {
      let d = delay;
      forNeighbors(r, c, function (nr, nc) {
        if (!board[nr][nc].revealed && !board[nr][nc].flagged) {
          d += 15;
          opened += revealCell(nr, nc, d);
        }
      });
    }
    return opened;
  }

  /* ── Win / Lose ── */
  function checkWin() {
    let unrevealed = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].revealed && !board[r][c].mine) unrevealed++;
      }
    }
    if (unrevealed !== 0) return;

    gameState = 'won';
    timer.stop();
    faceBtn.textContent = '😎';
    Arcade.audio.play('win');
    Arcade.Particles.domBurst(boardEl, {
      count: 24,
      colors: ['#34d399', '#6ee7b7', '#fbbf24', '#f472b6']
    });

    const seconds = Math.floor(timer.elapsed / 1000);
    const res = Arcade.best.submit('game17', seconds, { suffix: diff, lowerIsBetter: true });
    updateBestDisplay();

    endSched = Arcade.schedule(function () {
      ov.show({
        emoji: res.isRecord ? '🏆' : '🎉',
        title: '클리어!',
        isRecord: res.isRecord,
        stats: [
          { label: '시간', value: seconds + '초' },
          { label: '최고 기록', value: Arcade.best.score('game17', { suffix: diff }) + '초' }
        ],
        btnText: '다시 하기',
        onStart: initGame
      });
    }, 900);
  }

  function triggerLose(hitR, hitC) {
    gameState = 'lost';
    timer.stop();
    faceBtn.textContent = '😵';
    Arcade.audio.play('explosion');

    /* 화면 흔들림 */
    boardEl.classList.remove('shake');
    void boardEl.offsetWidth; // 리플로우로 애니메이션 재시작
    boardEl.classList.add('shake');

    /* 밟은 지뢰 즉시, 나머지는 순차 공개 */
    board[hitR][hitC].revealed = true;
    const hitEl = getCellEl(hitR, hitC);
    if (hitEl) {
      updateCell(hitR, hitC, hitEl);
      hitEl.classList.add('mine-hit');
    }

    const mines = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r][c].mine && !(r === hitR && c === hitC)) mines.push([r, c]);
      }
    }
    mines.sort(function (a, b) {
      const da = Math.abs(a[0] - hitR) + Math.abs(a[1] - hitC);
      const db = Math.abs(b[0] - hitR) + Math.abs(b[1] - hitC);
      return da - db;
    });
    mines.forEach(function (m, i) {
      Arcade.schedule(function () {
        if (gameState !== 'lost') return;
        board[m[0]][m[1]].revealed = true;
        const el = getCellEl(m[0], m[1]);
        if (el) {
          el.classList.add('reveal-anim');
          updateCell(m[0], m[1], el);
        }
      }, 60 + i * 45);
    });

    endSched = Arcade.schedule(function () {
      ov.show({
        emoji: '💥',
        title: '폭발!',
        msg: '지뢰를 밟았습니다.\n다시 도전해 보세요!',
        btnText: '다시 하기',
        onStart: initGame
      });
    }, Math.max(900, 60 + mines.length * 45 + 300));
  }

  initGame();
})();
