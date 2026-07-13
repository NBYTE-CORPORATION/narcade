/* ============================================
   game14 — 테트리스
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game14', title: '테트리스', emoji: '🧱', accent: 'cyan' });

  var GAME_ID = 'game14';

  var canvas = document.getElementById('tetrisCanvas');
  var ctx = canvas.getContext('2d');
  var nextCanvas = document.getElementById('nextCanvas');
  var nextCtx = nextCanvas.getContext('2d');

  var COLS = 10;
  var ROWS = 20;
  var BLOCK = 30;
  var NEXT_SZ = 100;

  /* ── 7가지 테트로미노 (블록 색 = 게임 아트) ── */
  var PIECES = [
    { cells: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#22d3ee' }, // I
    { cells: [[1,1],[1,1]],                              color: '#fbbf24' }, // O
    { cells: [[0,1,0],[1,1,1],[0,0,0]],                  color: '#a78bfa' }, // T
    { cells: [[0,1,1],[1,1,0],[0,0,0]],                  color: '#34d399' }, // S
    { cells: [[1,1,0],[0,1,1],[0,0,0]],                  color: '#f87171' }, // Z
    { cells: [[1,0,0],[1,1,1],[0,0,0]],                  color: '#60a5fa' }, // J
    { cells: [[0,0,1],[1,1,1],[0,0,0]],                  color: '#fb923c' }, // L
  ];

  /* ── 상태 ── */
  var board, piece, nextPiece;
  var score, level, lines, baseline;
  var dropInterval, dropCounter, lastTime, animId = 0;
  var gameRunning = false;

  var scoreEl = document.getElementById('score');
  var levelEl = document.getElementById('level');
  var linesEl = document.getElementById('lines');
  var bestEl = document.getElementById('best');
  var overlay = Arcade.overlay('#overlay');
  var fit = Arcade.fitCanvas(canvas, { paddingV: 240 });

  function bestScore() {
    return Arcade.best.score(GAME_ID) || 0;
  }

  /* ── 유틸 ── */
  function createBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(null));
    return b;
  }

  function randomPiece() {
    var src = PIECES[Arcade.rand(0, PIECES.length - 1)];
    return {
      cells: src.cells.map(function (r) { return r.slice(); }),
      color: src.color,
      x: Math.floor(COLS / 2) - Math.floor(src.cells[0].length / 2),
      y: 0
    };
  }

  function rotateCells(cells) {
    var rows = cells.length, cols = cells[0].length;
    var out = [];
    for (var c = 0; c < cols; c++) out.push(new Array(rows).fill(0));
    for (var r = 0; r < rows; r++)
      for (var c2 = 0; c2 < cols; c2++)
        out[c2][rows - 1 - r] = cells[r][c2];
    return out;
  }

  function isValid(cells, px, py) {
    for (var r = 0; r < cells.length; r++)
      for (var c = 0; c < cells[r].length; c++) {
        if (!cells[r][c]) continue;
        var nx = px + c, ny = py + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && board[ny][nx]) return false;
      }
    return true;
  }

  function lighten(hex, amt) {
    var n = parseInt(hex.replace('#', ''), 16);
    var r = Math.min(255, (n >> 16) + amt);
    var g = Math.min(255, ((n >> 8) & 0xff) + amt);
    var b = Math.min(255, (n & 0xff) + amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* ── 게임 로직 ── */
  function placePiece() {
    for (var r = 0; r < piece.cells.length; r++)
      for (var c = 0; c < piece.cells[r].length; c++) {
        if (!piece.cells[r][c]) continue;
        var ny = piece.y + r;
        if (ny < 0) { endGame(); return; }
        board[ny][piece.x + c] = piece.color;
      }

    clearLines();
    piece = nextPiece;
    nextPiece = randomPiece();
    drawNext();

    if (!isValid(piece.cells, piece.x, piece.y)) endGame();
  }

  function clearLines() {
    var cleared = 0;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(function (c) { return c !== null; })) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (!cleared) return;

    Arcade.audio.play(cleared >= 4 ? 'powerup' : 'coin'); // 테트리스!

    var pts = [0, 100, 300, 500, 800];
    score += (pts[cleared] !== undefined ? pts[cleared] : 800) * level;
    lines += cleared;
    var newLevel = Math.floor(lines / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      Arcade.audio.play('win'); // 레벨 업
    }
    dropInterval = Math.max(80, 1000 - (level - 1) * 95);
    updateUI();
  }

  function updateUI() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
    if (score > bestScore()) Arcade.best.submit(GAME_ID, score); // 진행 중에도 저장
    bestEl.textContent = Math.max(bestScore(), score || 0);
  }

  function getGhostY() {
    var gy = piece.y;
    while (isValid(piece.cells, piece.x, gy + 1)) gy++;
    return gy;
  }

  function moveDown() {
    if (isValid(piece.cells, piece.x, piece.y + 1)) piece.y++;
    else placePiece();
  }

  function tryRotate() {
    var rot = rotateCells(piece.cells);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (isValid(rot, piece.x + kicks[i], piece.y)) {
        piece.cells = rot;
        piece.x += kicks[i];
        Arcade.audio.play('click');
        return true;
      }
    }
    return false;
  }

  function shift(dir) {
    if (isValid(piece.cells, piece.x + dir, piece.y)) {
      piece.x += dir;
      Arcade.audio.tone(240, 30, { type: 'square', gain: 0.05 }); // 낮은 pop
    }
  }

  function hardDrop() {
    var gained = 0;
    while (isValid(piece.cells, piece.x, piece.y + 1)) {
      piece.y++;
      gained += 2;
    }
    Arcade.audio.play('whoosh');
    score += gained;
    placePiece();
    dropCounter = 0;
    updateUI();
  }

  /* ── 렌더링 ── */
  function drawBlock(context, color, x, y, size, alpha) {
    context.globalAlpha = alpha === undefined ? 1 : alpha;
    var grd = context.createLinearGradient(x, y, x + size, y + size);
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
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 0.5;
    var c, r;
    for (c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * BLOCK, 0); ctx.lineTo(c * BLOCK, canvas.height); ctx.stroke();
    }
    for (r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * BLOCK); ctx.lineTo(canvas.width, r * BLOCK); ctx.stroke();
    }

    for (r = 0; r < ROWS; r++)
      for (c = 0; c < COLS; c++)
        if (board[r][c])
          drawBlock(ctx, board[r][c], c * BLOCK, r * BLOCK, BLOCK);

    if (!piece || !gameRunning) return;

    var gy = getGhostY();
    for (r = 0; r < piece.cells.length; r++)
      for (c = 0; c < piece.cells[r].length; c++)
        if (piece.cells[r][c])
          drawBlock(ctx, piece.color, (piece.x + c) * BLOCK, (gy + r) * BLOCK, BLOCK, 0.15);

    for (r = 0; r < piece.cells.length; r++)
      for (c = 0; c < piece.cells[r].length; c++)
        if (piece.cells[r][c])
          drawBlock(ctx, piece.color, (piece.x + c) * BLOCK, (piece.y + r) * BLOCK, BLOCK);
  }

  function drawNext() {
    nextCtx.fillStyle = '#09090b';
    nextCtx.fillRect(0, 0, NEXT_SZ, NEXT_SZ);
    if (!nextPiece) return;

    var cells = nextPiece.cells;
    var bw = cells[0].length, bh = cells.length;
    var sz = 22;
    var ox = Math.floor((NEXT_SZ - bw * sz) / 2);
    var oy = Math.floor((NEXT_SZ - bh * sz) / 2);

    for (var r = 0; r < bh; r++)
      for (var c = 0; c < bw; c++)
        if (cells[r][c])
          drawBlock(nextCtx, nextPiece.color, ox + c * sz, oy + r * sz, sz);
  }

  /* ── 게임 루프 (일시정지 게이트) ── */
  function gameLoop(time) {
    if (!gameRunning) return;
    if (Arcade.pause.active) return; // onResume에서 재시작

    var delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;

    if (dropCounter >= dropInterval) {
      moveDown();
      dropCounter = 0;
    }

    draw();
    animId = requestAnimationFrame(gameLoop);
  }

  Arcade.pause.register({
    isActive: function () { return gameRunning; },
    onPause: function () {
      cancelAnimationFrame(animId);
    },
    onResume: function () {
      if (!gameRunning) return;
      lastTime = performance.now(); // 델타 앵커 리셋
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(gameLoop);
    }
  });

  /* ── 시작 / 종료 ── */
  function startGame() {
    cancelAnimationFrame(animId);

    board = createBoard();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    dropCounter = 0;
    baseline = bestScore();

    piece = randomPiece();
    nextPiece = randomPiece();
    gameRunning = true;

    updateUI();
    drawNext();
    lastTime = performance.now();
    animId = requestAnimationFrame(gameLoop);
  }

  function endGame() {
    gameRunning = false;
    cancelAnimationFrame(animId);
    Arcade.audio.play('lose');

    Arcade.best.submit(GAME_ID, score);
    updateUI();
    draw();

    overlay.show({
      emoji: '💥',
      title: '게임 오버',
      isRecord: score > baseline,
      stats: [
        { label: '점수', value: score },
        { label: '줄 수', value: lines },
        { label: '레벨', value: level },
        { label: '최고', value: bestScore() }
      ],
      btnText: '다시 하기',
      onStart: startGame
    });
  }

  /* ── 키보드 ── */
  document.addEventListener('keydown', function (e) {
    if (!gameRunning || Arcade.pause.active) return;

    switch (e.code) {
      case 'ArrowLeft':
        e.preventDefault();
        shift(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        shift(1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveDown();
        dropCounter = 0;
        score++;
        updateUI();
        break;
      case 'ArrowUp':
      case 'KeyX':
        e.preventDefault();
        tryRotate();
        break;
      case 'Space':
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  /* ── 가상 게임패드 (coarse 포인터 전용) — 기존 키 핸들러 재사용 ── */
  Arcade.touch.buttons(null, [
    { id: 'left',   label: '◀',  key: 'ArrowLeft' },
    { id: 'right',  label: '▶',  key: 'ArrowRight' },
    { id: 'down',   label: '▼',  key: 'ArrowDown' },
    { id: 'rotate', label: '🔄', key: 'ArrowUp' },
    { id: 'drop',   label: '⤓',  key: ' ', code: 'Space' }
  ]);

  /* ── 부트 ── */
  board = createBoard();
  draw();
  drawNext();
  bestEl.textContent = bestScore();
  var b = bestScore();
  overlay.show({
    emoji: '🧱',
    title: '테트리스',
    msg: '방향키로 이동, ↑ 또는 X 로 회전,\n스페이스바로 즉시 낙하!\n10줄마다 레벨이 올라 점점 빨라져요.',
    stats: b > 0 ? [{ label: '최고 점수', value: b }] : null,
    btnText: '시작하기',
    onStart: startGame
  });
})();
