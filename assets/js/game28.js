/* ============================================
   game28 — 과일 박스 (Fruit Box)
   드래그로 합이 10인 사각형을 만들어 사과 제거.
   120초 제한, 3초 내 연속 제거 콤보(×1.5),
   포인터 이벤트 통합 + 2D 프리픽스 합 이동 판정.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game28', title: '과일 박스', emoji: '🍎', accent: 'green' });

  var GAME_ID = 'game28';
  var MODES = {
    vertical:   { cols: 10, rows: 17, cell: 36, font: '1.05rem' },
    horizontal: { cols: 17, rows: 10, cell: 32, font: '0.95rem' }
  };
  var TIME_LIMIT = 120000; // 2분 (ms)
  var COMBO_WINDOW = 3000; // 콤보 유지 시간 (ms)

  var board       = document.getElementById('board');
  var container   = document.getElementById('boardContainer');
  var selBox      = document.getElementById('selBox');
  var selSum      = document.getElementById('selSum');
  var scoreEl     = document.getElementById('score');
  var comboEl     = document.getElementById('combo');
  var timerEl     = document.getElementById('timer');
  var bestEl      = document.getElementById('best');
  var timeFill    = document.getElementById('timeFill');
  var sumIndicator = document.getElementById('sumIndicator');
  var ov = Arcade.overlay('#overlay');

  /* ── 상태 ── */
  var currentMode = Arcade.store.get('mode:' + GAME_ID, 'horizontal');
  if (!MODES[currentMode]) currentMode = 'horizontal';
  var COLS = MODES[currentMode].cols;
  var ROWS = MODES[currentMode].rows;

  var grid = [];       // 2D 숫자 배열 (0 = 빈 칸)
  var cells = [];      // 2D DOM 배열
  var score = 0;
  var clearedCount = 0;
  var combo = 0, maxCombo = 0, lastClearAt = -Infinity;
  var running = false;
  var dragging = false;
  var dragPointer = -1;
  var startX = 0, startY = 0;
  var lastSelCount = -1;
  var lastSelSfx = 0;
  var lastTickSec = -1;

  /* fruitbox_best 레거시 키는 arcade.js가 자동 마이그레이션 */
  function bestScore() { return Arcade.best.score(GAME_ID) || 0; }
  bestEl.textContent = bestScore();

  /* ── 타이머 (Arcade.Timer — Esc/탭 전환 시 자동 일시정지) ── */
  var timer = new Arcade.Timer({
    duration: TIME_LIMIT,
    onTick: function (left) {
      var sec = Math.ceil(left / 1000);
      timerEl.textContent = fmtClock(sec);
      timeFill.style.width = (left / TIME_LIMIT * 100) + '%';
      timeFill.classList.toggle('low', left <= 10000);
      if (left <= 10000 && sec !== lastTickSec) {
        lastTickSec = sec;
        Arcade.audio.play('tick');
      }
      /* 콤보 창이 지나면 HUD 리셋 */
      if (combo > 0 && performance.now() - lastClearAt > COMBO_WINDOW) {
        combo = 0;
        comboEl.textContent = '-';
      }
    },
    onEnd: function () { endGame(false); }
  });

  Arcade.pause.register({
    isActive: function () { return running; },
    onPause: cancelDrag
  });

  function fmtClock(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ── 모드/보드 ── */
  function applyMode() {
    var m = MODES[currentMode];
    COLS = m.cols; ROWS = m.rows;
    board.style.gridTemplateColumns = 'repeat(' + COLS + ', 1fr)';
    board.style.setProperty('--cols', COLS);
    board.style.setProperty('--cell-base', m.cell + 'px');
    board.style.setProperty('--cell-font', m.font);
  }

  function generateBoard() {
    grid = []; cells = [];
    board.innerHTML = '';
    for (var r = 0; r < ROWS; r++) {
      var row = [], cellRow = [];
      for (var c = 0; c < COLS; c++) {
        var val = Math.floor(Math.random() * 9) + 1;
        row.push(val);
        var el = document.createElement('div');
        el.className = 'cell';
        el.textContent = val;
        board.appendChild(el);
        cellRow.push(el);
      }
      grid.push(row);
      cells.push(cellRow);
    }
  }

  /* ── 선택 판정 ── */
  function getSelectedCells(x1, y1, x2, y2) {
    var rect = board.getBoundingClientRect();
    var cw = rect.width / COLS, ch = rect.height / ROWS;
    var lx1 = Math.min(x1, x2) - rect.left;
    var ly1 = Math.min(y1, y2) - rect.top;
    var lx2 = Math.max(x1, x2) - rect.left;
    var ly2 = Math.max(y1, y2) - rect.top;

    var colStart = Math.max(0, Math.floor(lx1 / cw));
    var colEnd   = Math.min(COLS - 1, Math.floor(lx2 / cw));
    var rowStart = Math.max(0, Math.floor(ly1 / ch));
    var rowEnd   = Math.min(ROWS - 1, Math.floor(ly2 / ch));

    var selected = [];
    if (lx2 < 0 || ly2 < 0 || lx1 > rect.width || ly1 > rect.height) return selected;
    for (var r = rowStart; r <= rowEnd; r++) {
      for (var c = colStart; c <= colEnd; c++) {
        if (grid[r][c] > 0) selected.push({ r: r, c: c, val: grid[r][c] });
      }
    }
    return selected;
  }

  function highlightCells(selected) {
    var prev = board.querySelectorAll('.cell.selected');
    for (var i = 0; i < prev.length; i++) prev[i].classList.remove('selected');
    selected.forEach(function (s) { cells[s.r][s.c].classList.add('selected'); });
  }

  function sumOf(selected) {
    return selected.reduce(function (acc, s) { return acc + s.val; }, 0);
  }

  function updateSumUI(selected) {
    var sum = sumOf(selected);
    sumIndicator.textContent = '합: ' + sum;
    selSum.textContent = sum;
    sumIndicator.classList.remove('perfect', 'over');
    selBox.classList.remove('perfect', 'over');
    if (sum === 10 && selected.length > 0) {
      sumIndicator.classList.add('perfect');
      selBox.classList.add('perfect');
    } else if (sum > 10) {
      sumIndicator.classList.add('over');
      selBox.classList.add('over');
    }
    /* 선택 변화 시 은은한 팝 (스로틀) */
    if (selected.length !== lastSelCount) {
      lastSelCount = selected.length;
      var now = performance.now();
      if (selected.length > 0 && now - lastSelSfx > 90) {
        lastSelSfx = now;
        Arcade.audio.tone(420 + selected.length * 40, 30, { type: 'sine', gain: 0.05 });
      }
    }
  }

  /* ── 제거 + 콤보 ── */
  function removeCells(selected) {
    var now = performance.now();
    combo = (now - lastClearAt <= COMBO_WINDOW) ? combo + 1 : 1;
    lastClearAt = now;
    if (combo > maxCombo) maxCombo = combo;

    var gain = selected.length;
    if (combo > 1) gain = Math.round(gain * 1.5);
    score += gain;
    clearedCount += selected.length;
    scoreEl.textContent = score;
    comboEl.textContent = combo > 1 ? '×' + combo : '-';

    if (combo > 1) Arcade.audio.play('combo', { step: combo - 1 });
    else Arcade.audio.play('coin');

    /* 사과 팝 애니메이션 */
    var mid = selected[Math.floor(selected.length / 2)];
    selected.forEach(function (s) {
      var el = cells[s.r][s.c];
      grid[s.r][s.c] = 0;
      el.classList.remove('selected');
      el.classList.add('matched');
    });
    Arcade.schedule(function () {
      selected.forEach(function (s) {
        var el = cells[s.r][s.c];
        el.classList.add('empty');
        el.classList.remove('matched');
        el.textContent = '';
      });
    }, 380);

    /* 콘페티 + 점수 팝업 */
    var midEl = cells[mid.r][mid.c];
    Arcade.Particles.domBurst(midEl, {
      count: Math.min(16, 6 + selected.length * 2),
      colors: ['#f87171', '#fbbf24', '#34d399']
    });
    spawnScorePop(midEl, '+' + gain + (combo > 1 ? ' ×' + combo : ''));
  }

  function spawnScorePop(anchorEl, text) {
    var rect = anchorEl.getBoundingClientRect();
    var cRect = container.getBoundingClientRect();
    var el = document.createElement('span');
    el.className = 'score-pop';
    el.textContent = text;
    el.style.left = (rect.left - cRect.left + rect.width / 2) + 'px';
    el.style.top = (rect.top - cRect.top) + 'px';
    container.appendChild(el);
    el.addEventListener('animationend', function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  /* ── 드래그 (포인터 이벤트 통합) ── */
  function onPointerDown(e) {
    if (!running || Arcade.pause.active || dragging) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    dragPointer = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    lastSelCount = -1;
    try { container.setPointerCapture(e.pointerId); } catch (err) {}
    selBox.style.display = 'block';
    updateSelBox(e.clientX, e.clientY);
    var selected = getSelectedCells(startX, startY, e.clientX, e.clientY);
    highlightCells(selected);
    updateSumUI(selected);
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== dragPointer) return;
    e.preventDefault();
    updateSelBox(e.clientX, e.clientY);
    var selected = getSelectedCells(startX, startY, e.clientX, e.clientY);
    highlightCells(selected);
    updateSumUI(selected);
  }

  function onPointerUp(e) {
    if (!dragging || e.pointerId !== dragPointer) return;
    dragging = false;
    dragPointer = -1;
    selBox.style.display = 'none';
    selBox.classList.remove('perfect', 'over');

    var selected = getSelectedCells(startX, startY, e.clientX, e.clientY);
    var sum = sumOf(selected);
    highlightCells([]);
    resetSumUI();

    if (sum === 10 && selected.length > 0) {
      removeCells(selected);
      /* 더 이상 만들 수 있는 조합이 없으면 조기 종료 */
      if (running && !hasMovesLeft()) endGame(true);
    } else if (selected.length > 0) {
      Arcade.audio.play('hit');
    }
  }

  function cancelDrag() {
    if (!dragging) return;
    dragging = false;
    dragPointer = -1;
    selBox.style.display = 'none';
    highlightCells([]);
    resetSumUI();
  }

  function resetSumUI() {
    sumIndicator.textContent = '합: 0';
    sumIndicator.classList.remove('perfect', 'over');
    lastSelCount = -1;
  }

  function updateSelBox(curX, curY) {
    var cRect = container.getBoundingClientRect();
    var x1 = Math.min(startX, curX) - cRect.left;
    var y1 = Math.min(startY, curY) - cRect.top;
    var x2 = Math.max(startX, curX) - cRect.left;
    var y2 = Math.max(startY, curY) - cRect.top;
    selBox.style.left = x1 + 'px';
    selBox.style.top = y1 + 'px';
    selBox.style.width = (x2 - x1) + 'px';
    selBox.style.height = (y2 - y1) + 'px';
  }

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', cancelDrag);

  /* ── 남은 조합 판정 (2D 프리픽스 합 + 슬라이딩 윈도우) ──
     행 쌍(r1,r2)마다 열 합 배열에 투 포인터: O(ROWS² × COLS) */
  function hasMovesLeft() {
    var P = [];
    var r, c;
    for (r = 0; r <= ROWS; r++) {
      P.push(new Array(COLS + 1).fill(0));
    }
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        P[r + 1][c + 1] = grid[r][c] + P[r][c + 1] + P[r + 1][c] - P[r][c];
      }
    }
    for (var r1 = 0; r1 < ROWS; r1++) {
      for (var r2 = r1; r2 < ROWS; r2++) {
        var sum = 0, left = 0;
        for (var right = 0; right < COLS; right++) {
          sum += P[r2 + 1][right + 1] - P[r2 + 1][right] - P[r1][right + 1] + P[r1][right];
          while (sum > 10) {
            sum -= P[r2 + 1][left + 1] - P[r2 + 1][left] - P[r1][left + 1] + P[r1][left];
            left++;
          }
          if (sum === 10) return true; /* 합 10이면 0 아닌 칸이 반드시 존재 */
        }
      }
    }
    return false;
  }

  /* ── 게임 흐름 ── */
  function startGame() {
    score = 0;
    clearedCount = 0;
    combo = 0; maxCombo = 0;
    lastClearAt = -Infinity;
    lastTickSec = -1;
    scoreEl.textContent = '0';
    comboEl.textContent = '-';
    bestEl.textContent = bestScore();
    resetSumUI();
    timeFill.classList.remove('low');
    timeFill.style.width = '100%';
    timerEl.textContent = fmtClock(TIME_LIMIT / 1000);
    applyMode();
    generateBoard();
    ov.hide();
    running = true;
    timer.start();
  }

  function endGame(boardCleared) {
    if (!running) return;
    running = false;
    timer.stop();
    cancelDrag();

    var res = Arcade.best.submit(GAME_ID, score);
    bestEl.textContent = bestScore();

    if (res.isRecord && score > 0) Arcade.audio.play('win');
    else Arcade.audio.play(boardCleared ? 'win' : 'lose');
    if (score > 0) Arcade.Particles.domBurst(container, { count: 24 });

    Arcade.schedule(function () {
      ov.show({
        emoji: boardCleared ? '🏆' : '🍎',
        title: boardCleared ? '조합 완료!' : '게임 종료!',
        isRecord: res.isRecord && score > 0,
        msg: boardCleared ? '더 이상 만들 수 있는 조합이 없어요.' : '시간이 다 됐어요!',
        stats: [
          { label: '점수', value: score },
          { label: '제거 사과', value: clearedCount },
          { label: '최대 콤보', value: maxCombo > 1 ? '×' + maxCombo : '-' }
        ],
        extraHTML: modeHTML(),
        btnText: '다시 하기',
        onStart: startGame
      });
      wireModePills();
    }, 700);
  }

  /* ── 모드 선택 (가로/세로 · 저장) ── */
  function modeHTML() {
    return '<div class="mode-pick">' +
      '<button type="button" class="mode-btn" data-mode="horizontal">↔ 가로 (17×10)</button>' +
      '<button type="button" class="mode-btn" data-mode="vertical">↕ 세로 (10×17)</button>' +
      '</div>';
  }

  function wireModePills() {
    var btns = ov.el.querySelectorAll('.mode-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === currentMode);
      b.addEventListener('click', function () {
        if (currentMode === b.dataset.mode) return;
        currentMode = b.dataset.mode;
        Arcade.store.set('mode:' + GAME_ID, currentMode);
        btns.forEach(function (x) {
          x.classList.toggle('active', x.dataset.mode === currentMode);
        });
        Arcade.audio.play('click');
        applyMode();
        generateBoard(); /* 배경 미리보기도 새 모드로 */
      });
    });
  }

  function showStart() {
    ov.show({
      emoji: '🍎',
      title: '과일 박스',
      msg: '드래그로 사각형을 그려 합이 10이 되는\n사과들을 제거하세요. 제한 시간 2분!\n3초 안에 연속 제거하면 콤보 ×1.5',
      extraHTML: modeHTML(),
      btnText: '시작하기',
      onStart: startGame
    });
    wireModePills();
  }

  /* ── 부트 ── */
  applyMode();
  generateBoard();
  showStart();
})();
