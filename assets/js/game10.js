/* ============================================
   game10 — 숫자 순서 클릭
   1~9를 순서대로 최대한 빨리 클릭. 최단 시간 기록.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game10', title: '숫자 순서 클릭', emoji: '🔢', accent: 'cyan' });

  var GAME_ID = 'game10';
  var COUNT = 9;

  var gridEl = document.getElementById('grid');
  var nextEl = document.getElementById('nextNum');
  var timeEl = document.getElementById('time');
  var bestEl = document.getElementById('best');
  var overlay = Arcade.overlay('#overlay');

  var current = 1;
  var running = false;
  var btns = [];

  /* ── 스톱워치 (Esc/탭 전환 시 자동 일시정지) ── */
  var timer = new Arcade.Timer({
    onTick: function (elapsed) {
      timeEl.textContent = Arcade.fmtTime(elapsed);
    }
  });

  Arcade.pause.register({
    isActive: function () { return running && current > 1; }
  });

  function bestMs() {
    var b = Arcade.best.get(GAME_ID);
    if (b && typeof b === 'object') b = b.score;
    return typeof b === 'number' ? b : null;
  }

  function renderBest() {
    var b = bestMs();
    bestEl.textContent = b === null ? '—' : Arcade.fmtTime(b);
  }

  /* ── 그리드 구성 ── */
  function buildGrid() {
    var nums = [];
    for (var i = 1; i <= COUNT; i++) nums.push(i);
    for (var j = nums.length - 1; j > 0; j--) {
      var k = Arcade.rand(0, j);
      var t = nums[j]; nums[j] = nums[k]; nums[k] = t;
    }
    gridEl.innerHTML = '';
    btns = [];
    nums.forEach(function (n) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'num-btn';
      btn.textContent = n;
      btn.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        handlePress(n, btn);
      });
      gridEl.appendChild(btn);
      btns.push(btn);
    });
  }

  function handlePress(n, btn) {
    if (!running || btn.disabled || Arcade.pause.active) return;

    if (n !== current) {
      Arcade.audio.play('hit');
      btn.classList.remove('miss');
      void btn.offsetWidth;
      btn.classList.add('miss');
      setTimeout(function () { btn.classList.remove('miss'); }, 320);
      return;
    }

    if (current === 1) timer.start(); // 1을 누르는 순간부터 측정
    Arcade.audio.play('pop');
    btn.disabled = true;
    btn.classList.add('done');
    current++;

    if (current > COUNT) {
      finish();
    } else {
      nextEl.textContent = current;
    }
  }

  function finish() {
    running = false;
    var elapsed = timer.elapsed;
    timer.stop();
    timeEl.textContent = Arcade.fmtTime(elapsed);
    nextEl.textContent = '✓';

    var res = Arcade.best.submit(GAME_ID, elapsed, { lowerIsBetter: true });
    renderBest();

    Arcade.audio.play('win');
    Arcade.Particles.domBurst(gridEl, { count: 22, colors: ['#22d3ee', '#67e8f9', '#a3e635', '#fbbf24'] });

    setTimeout(function () {
      overlay.show({
        emoji: '🎉',
        title: '성공!',
        isRecord: res.isRecord,
        stats: [
          { label: '시간', value: Arcade.fmtTime(elapsed) },
          { label: '최고 기록', value: Arcade.fmtTime(bestMs()) }
        ],
        btnText: '다시 도전',
        onStart: startGame
      });
    }, 700);
  }

  /* ── 시작/재시작 ── */
  function startGame() {
    timer.stop();
    current = 1;
    running = true;
    nextEl.textContent = '1';
    timeEl.textContent = Arcade.fmtTime(0);
    renderBest();
    buildGrid();
  }

  /* ── 부트 ── */
  renderBest();
  buildGrid();
  var b = bestMs();
  overlay.show({
    emoji: '🔢',
    title: '숫자 순서 클릭',
    msg: '1부터 9까지 순서대로 최대한 빨리 누르세요!\n1을 누르는 순간부터 시간이 측정됩니다.\n잘못 누르면 시간만 손해 — 침착하게!',
    stats: b !== null ? [{ label: '최고 기록', value: Arcade.fmtTime(b) }] : null,
    btnText: '시작하기',
    onStart: startGame
  });
})();
