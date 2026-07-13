/* ============================================
   game22 — 슬라이딩 퍼즐 (15-puzzle)
   3×3 / 4×4 / 5×5, 풀 수 있는 셔플 보장.
   클릭·방향키·스와이프 입력, 슬라이드 애니메이션.
   기록: 시간(초, 낮을수록 좋음) + 이동 수 메타.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game22', title: '슬라이딩 퍼즐', emoji: '🔢', accent: 'amber' });

  var GAME_ID = 'game22';
  var SIZES = [
    { id: '3', label: '3×3' },
    { id: '4', label: '4×4' },
    { id: '5', label: '5×5' }
  ];

  var boardEl = document.getElementById('board');
  var innerEl = document.getElementById('boardInner');
  var movesEl = document.getElementById('movesEl');
  var timeEl = document.getElementById('timeEl');
  var bestEl = document.getElementById('bestEl');
  var sizePillsEl = document.getElementById('sizePills');
  var shuffleBtn = document.getElementById('shuffleBtn');
  var hintBtn = document.getElementById('hintBtn');
  var overlay = Arcade.overlay('#overlay');

  var size = 3;         // 보드 한 변 (3/4/5)
  var tiles = [];       // 1D 배열, 0 = 빈 칸
  var emptyIdx = 0;
  var tileEls = {};     // 숫자 → DOM 요소
  var moves = 0;
  var playing = false;  // 보드 조작 가능 여부
  var started = false;  // 첫 이동 이후 (타이머 작동 중)
  var winScheds = [];   // 승리 연출 예약 (재시작 시 취소)

  var timer = new Arcade.Timer({
    onTick: function (ms) { timeEl.textContent = Arcade.fmtTime(ms); }
  });

  /* Esc/탭 전환 일시정지: 진행 중일 때만 */
  Arcade.pause.register({
    isActive: function () { return playing && started; }
  });

  /* ── 사운드 (방향키 홀드 대비 스로틀) ── */
  var lastPop = 0;
  var lastMiss = 0;
  function popSfx() {
    var now = performance.now();
    if (now - lastPop < 70) return;
    lastPop = now;
    Arcade.audio.play('pop');
  }
  function missSfx() {
    var now = performance.now();
    if (now - lastMiss < 160) return;
    lastMiss = now;
    Arcade.audio.play('hit');
  }

  /* ── 최고 기록 ──
     레거시 {moves,time}(time이 기준값) → {score,moves}로 정규화 후 사용 */
  function getBest(n) {
    var v = Arcade.best.get(GAME_ID, { suffix: String(n) });
    if (v && typeof v === 'object' && typeof v.score !== 'number' && typeof v.time === 'number') {
      v = { score: v.time, moves: v.moves };
      Arcade.store.set('best:' + GAME_ID + ':' + n, v);
    }
    return v;
  }

  function bestLabel(n) {
    var v = getBest(n);
    var sec = v && typeof v === 'object' ? v.score : v;
    if (typeof sec !== 'number' || isNaN(sec)) return '—';
    return Arcade.fmtTime(sec * 1000);
  }

  function updateBestHud() {
    bestEl.textContent = bestLabel(size);
  }

  /* ── 셔플 (풀 수 있는 상태 보장) ── */
  function isSolvedArr(arr) {
    for (var i = 0; i < arr.length - 1; i++) if (arr[i] !== i + 1) return false;
    return arr[arr.length - 1] === 0;
  }

  function solvable(arr, n) {
    var inv = 0;
    var flat = arr.filter(function (x) { return x !== 0; });
    for (var i = 0; i < flat.length; i++)
      for (var j = i + 1; j < flat.length; j++)
        if (flat[i] > flat[j]) inv++;
    if (n % 2 === 1) return inv % 2 === 0;
    var emptyRow = n - 1 - Math.floor(arr.indexOf(0) / n);
    return (inv + emptyRow) % 2 === 0;
  }

  function goalArr() {
    var g = [];
    for (var i = 1; i < size * size; i++) g.push(i);
    g.push(0);
    return g;
  }

  function shuffleTiles() {
    var arr;
    do {
      arr = goalArr().sort(function () { return Math.random() - 0.5; });
    } while (!solvable(arr, size) || isSolvedArr(arr));
    return arr;
  }

  /* ── 보드 렌더링 ──
     타일은 절대배치 + transform(translate)로 놓고,
     이동 시 --r/--c만 바꿔 CSS 트랜지션으로 미끄러진다. */
  function fitFont() {
    var w = innerEl.clientWidth || 1;
    boardEl.style.fontSize = Math.round((w / size) * 0.4) + 'px';
  }

  function layout() {
    for (var i = 0; i < tiles.length; i++) {
      var v = tiles[i];
      if (!v) continue;
      var el = tileEls[v];
      el.style.setProperty('--r', Math.floor(i / size));
      el.style.setProperty('--c', i % size);
      el.classList.toggle('correct', v === i + 1);
    }
  }

  function buildBoard() {
    innerEl.innerHTML = '';
    tileEls = {};
    boardEl.style.setProperty('--n', size);
    for (var v = 1; v < size * size; v++) {
      var el = document.createElement('div');
      el.className = 'tile';
      el.textContent = v;
      el.dataset.val = v;
      el.addEventListener('click', onTileClick);
      innerEl.appendChild(el);
      tileEls[v] = el;
    }
    fitFont();
    /* 최초 배치는 애니메이션 없이 */
    boardEl.classList.add('no-anim');
    layout();
    void boardEl.offsetWidth;
    boardEl.classList.remove('no-anim');
  }

  /* ── 이동 (같은 행/열이면 구간 전체 밀기) ── */
  function tryMove(idx) {
    if (!playing || Arcade.pause.active) return false;

    var row = Math.floor(idx / size), col = idx % size;
    var eRow = Math.floor(emptyIdx / size), eCol = emptyIdx % size;
    var from, to, d;

    if (idx === emptyIdx) return false;

    if (row === eRow) {
      d = eCol > col ? 1 : -1;
      for (var c = eCol - d; ; c -= d) {
        from = row * size + c;
        to = from + d;
        tiles[to] = tiles[from];
        if (c === col) break;
      }
    } else if (col === eCol) {
      d = eRow > row ? 1 : -1;
      for (var r = eRow - d; ; r -= d) {
        from = r * size + col;
        to = from + d * size;
        tiles[to] = tiles[from];
        if (r === row) break;
      }
    } else {
      missSfx();
      return false;
    }

    tiles[idx] = 0;
    emptyIdx = idx;
    moves++;
    movesEl.textContent = moves;

    if (!started) {
      started = true;
      timer.start();
    }

    layout();
    popSfx();

    if (isSolvedArr(tiles)) winGame();
    return true;
  }

  function onTileClick() {
    var idx = tiles.indexOf(parseInt(this.dataset.val, 10));
    if (idx >= 0) tryMove(idx);
  }

  /* ── 방향키: 빈칸 반대편 타일이 화살표 방향으로 미끄러진다 ── */
  function moveByDir(dir) {
    var eRow = Math.floor(emptyIdx / size), eCol = emptyIdx % size;
    var target = -1;
    if (dir === 'left' && eCol < size - 1) target = emptyIdx + 1;      // 빈칸 오른쪽 타일 ←
    if (dir === 'right' && eCol > 0) target = emptyIdx - 1;            // 빈칸 왼쪽 타일 →
    if (dir === 'up' && eRow < size - 1) target = emptyIdx + size;     // 빈칸 아래 타일 ↑
    if (dir === 'down' && eRow > 0) target = emptyIdx - size;          // 빈칸 위 타일 ↓
    if (target >= 0) tryMove(target);
    else missSfx();
  }

  var KEY_DIR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

  document.addEventListener('keydown', function (e) {
    var dir = KEY_DIR[e.key];
    if (!dir || !playing || Arcade.pause.active) return;
    e.preventDefault();
    moveByDir(dir);
  });

  /* ── 스와이프: 방향키와 동일한 의미 (스와이프 왼쪽 = 빈칸 오른쪽 타일이 왼쪽으로) ── */
  Arcade.touch.swipe(boardEl, function (dir) {
    if (!playing || Arcade.pause.active) return;
    moveByDir(dir);
  });

  /* ── 힌트: 제자리가 아닌 타일 하나 반짝 ── */
  function showHint() {
    if (!playing) return;
    var wrong = [];
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i] !== 0 && tiles[i] !== i + 1) wrong.push(tiles[i]);
    }
    if (!wrong.length) return;
    var val = wrong[Math.floor(Math.random() * Math.min(3, wrong.length))];
    var el = tileEls[val];
    if (el) {
      el.classList.remove('hint-flash');
      void el.offsetWidth;
      el.classList.add('hint-flash');
    }
    Arcade.audio.play('click');
  }

  /* ── 승리 ── */
  function winGame() {
    playing = false;
    var ms = timer.elapsed;
    timer.stop();

    var sec = Math.round(ms / 100) / 10;
    getBest(size); // 레거시 기록 정규화 후 제출
    var res = Arcade.best.submit(GAME_ID, sec, {
      suffix: String(size),
      lowerIsBetter: true,
      meta: { moves: moves }
    });
    updateBestHud();

    Arcade.audio.play('win');
    Arcade.Particles.domBurst(boardEl, { count: 28 });

    /* 타일이 순서대로 물결치듯 하이라이트 */
    for (var v = 1; v < size * size; v++) {
      (function (val, i) {
        winScheds.push(Arcade.schedule(function () {
          tileEls[val].classList.add('solved');
        }, i * 45));
      })(v, v - 1);
    }

    var sizeLabel = size + '×' + size;
    var recorded = res.isRecord;
    var finalMoves = moves;
    winScheds.push(Arcade.schedule(function () {
      overlay.show({
        emoji: '🎉',
        title: '퍼즐 완성!',
        isRecord: recorded,
        stats: [
          { label: '시간', value: Arcade.fmtTime(ms) },
          { label: '이동 수', value: finalMoves },
          { label: '크기', value: sizeLabel }
        ],
        btnText: '다시하기',
        onStart: newGame
      });
    }, 1000));
  }

  /* ── 게임 시작/재시작 ── */
  function cancelWinFx() {
    winScheds.forEach(function (s) { s.cancel(); });
    winScheds = [];
  }

  function newGame() {
    cancelWinFx();
    overlay.hide();
    moves = 0;
    started = false;
    playing = true;
    timer.stop();
    movesEl.textContent = '0';
    timeEl.textContent = Arcade.fmtTime(0);
    updateBestHud();

    tiles = shuffleTiles();
    emptyIdx = tiles.indexOf(0);
    buildBoard();
  }

  /* ── 크기 선택 ── */
  function mountPagePills() {
    return Arcade.difficulty(sizePillsEl, SIZES, function (id) {
      size = parseInt(id, 10);
      newGame();
    }, { gameId: GAME_ID });
  }

  /* ── 시작 오버레이 (규칙 + 크기 선택) ── */
  function showStartOverlay() {
    playing = false;
    overlay.show({
      emoji: '🔢',
      title: '슬라이딩 퍼즐',
      msg: '타일을 밀어 1부터 순서대로 정렬하세요.\n' +
        '빈칸과 같은 줄의 타일을 누르면 한 번에 밀려요.\n' +
        '방향키·스와이프도 사용할 수 있어요.',
      extraHTML: '<div class="ov-size-row" id="ovSizePills"></div>',
      btnText: '시작하기',
      onStart: function () {
        mountPagePills(); // 오버레이에서 고른 크기와 동기화
        newGame();
      }
    });
    Arcade.difficulty(document.getElementById('ovSizePills'), SIZES, function (id) {
      size = parseInt(id, 10);
      updateBestHud();
    }, { gameId: GAME_ID });
  }

  /* ── 버튼 ── */
  shuffleBtn.addEventListener('click', function () {
    Arcade.audio.play('click');
    newGame();
  });
  hintBtn.addEventListener('click', showHint);

  window.addEventListener('resize', fitFont);
  window.addEventListener('orientationchange', fitFont);

  /* ── 부트: 정답 상태 미리보기 + 시작 오버레이 ── */
  size = parseInt(mountPagePills(), 10);
  updateBestHud();
  tiles = goalArr();
  emptyIdx = tiles.indexOf(0);
  buildBoard();
  showStartOverlay();
})();
