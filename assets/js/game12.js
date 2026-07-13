/* ============================================
   game12 — 2048
   타일을 밀어 합쳐 2048을 만드는 퍼즐.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game12', title: '2048', emoji: '🧩', accent: 'amber' });

  var GAME_ID = 'game12';
  var SIZE = 4;

  var boardWrapEl = document.getElementById('boardWrap');
  var boardEl = document.getElementById('board');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var overlay = Arcade.overlay('#overlay');

  var board, score, won, over, baseline;

  function bestScore() {
    return Arcade.best.score(GAME_ID) || 0;
  }

  /* ── 보드 ── */
  function newGame() {
    board = [];
    for (var r = 0; r < SIZE; r++) board.push([0, 0, 0, 0]);
    score = 0;
    won = false;
    over = false;
    baseline = bestScore();
    overlay.hide();
    addTile();
    addTile();
    render();
  }

  function addTile() {
    var empty = [];
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++)
        if (board[r][c] === 0) empty.push([r, c]);
    if (!empty.length) return;
    var pick = empty[Arcade.rand(0, empty.length - 1)];
    board[pick[0]][pick[1]] = Math.random() < 0.85 ? 2 : 4;
  }

  function tileClass(val) {
    if (val === 0) return '';
    if (val <= 2048) return 't-' + val;
    return 't-high';
  }

  function render() {
    var bw = boardWrapEl.offsetWidth;
    var gap = 10;
    var pad = 10;
    var cellSize = (bw - pad * 2 - gap * (SIZE - 1)) / SIZE;

    boardEl.innerHTML = '';
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) continue;
        var tile = document.createElement('div');
        tile.className = 'tile ' + tileClass(board[r][c]);
        tile.textContent = board[r][c];
        tile.style.width = cellSize + 'px';
        tile.style.height = cellSize + 'px';
        tile.style.left = (pad + c * (cellSize + gap)) + 'px';
        tile.style.top = (pad + r * (cellSize + gap)) + 'px';
        boardEl.appendChild(tile);
      }
    }

    scoreEl.textContent = score;
    bestEl.textContent = Math.max(bestScore(), score);
  }

  /* ── 한 줄 왼쪽으로 밀기 ── */
  function slideLeft(row) {
    var arr = row.filter(function (v) { return v !== 0; });
    var gained = 0;
    for (var i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        gained += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < SIZE) arr.push(0);
    return { arr: arr, gained: gained };
  }

  function move(dir) {
    if (over || Arcade.pause.active) return;

    var changed = false;
    var gained = 0;

    function rotate(b) {
      return b[0].map(function (_, c) {
        return b.map(function (row) { return row[c]; }).reverse();
      });
    }

    var b = board.map(function (r) { return r.slice(); });
    var turns = { left: 0, up: 3, right: 2, down: 1 }[dir];
    var i;

    for (i = 0; i < turns; i++) b = rotate(b);
    for (var r = 0; r < SIZE; r++) {
      var res = slideLeft(b[r]);
      if (res.arr.join() !== b[r].join()) changed = true;
      b[r] = res.arr;
      gained += res.gained;
    }
    for (i = 0; i < (4 - turns) % 4; i++) b = rotate(b);

    if (!changed) return;

    board = b;
    score += gained;
    if (score > bestScore()) Arcade.best.submit(GAME_ID, score); // 진행 중에도 저장

    Arcade.audio.play(gained > 0 ? 'coin' : 'pop'); // 이동당 1회

    addTile();
    render();

    // 2048 달성 (최초 1회)
    if (!won && board.some(function (row) { return row.indexOf(2048) !== -1; })) {
      won = true;
      Arcade.audio.play('win');
      Arcade.best.submit(GAME_ID, score);
      Arcade.Particles.domBurst(boardWrapEl, { count: 26, colors: ['#fbbf24', '#fcd34d', '#a78bfa', '#22d3ee'] });
      overlay.show({
        emoji: '🏆',
        title: '2048 달성!',
        isRecord: score > baseline,
        msg: '대단해요! 계속해서 더 큰 타일에 도전할 수 있어요.',
        stats: [
          { label: '점수', value: score },
          { label: '최고', value: bestScore() }
        ],
        btnText: '계속하기',
        onStart: function () { render(); }
      });
      return;
    }

    // 게임 오버
    if (!hasMove()) {
      over = true;
      Arcade.audio.play('lose');
      Arcade.best.submit(GAME_ID, score);
      render();
      overlay.show({
        emoji: '😢',
        title: '게임 오버',
        isRecord: score > baseline,
        stats: [
          { label: '점수', value: score },
          { label: '최고', value: bestScore() }
        ],
        btnText: '다시하기',
        onStart: newGame
      });
    }
  }

  function hasMove() {
    for (var r = 0; r < SIZE; r++)
      for (var c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) return true;
        if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return true;
        if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return true;
      }
    return false;
  }

  /* ── 입력 ── */
  document.addEventListener('keydown', function (e) {
    var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (map[e.key]) {
      e.preventDefault();
      move(map[e.key]);
    }
  });

  // 보드 스와이프 (스크롤 방지 포함)
  Arcade.touch.swipe(boardWrapEl, function (dir) { move(dir); }, { threshold: 24 });

  document.getElementById('newGameBtn').addEventListener('click', function () {
    Arcade.audio.play('click');
    newGame();
  });

  window.addEventListener('resize', function () { if (board) render(); });

  /* ── 부트 ── */
  newGame();
  var b = bestScore();
  overlay.show({
    emoji: '🧩',
    title: '2048',
    msg: '방향키 또는 스와이프로 타일을 밀어\n같은 숫자를 합쳐 2048을 만들어 보세요!',
    stats: b > 0 ? [{ label: '최고 점수', value: b }] : null,
    btnText: '시작하기',
    onStart: newGame
  });
})();
