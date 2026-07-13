/* ============================================
   game13 — 두더지 잡기
   30초 안에 튀어나오는 두더지를 최대한 많이 잡기.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game13', title: '두더지 잡기', emoji: '🔨', accent: 'green' });

  var GAME_ID = 'game13';
  var HOLES = 9;
  var GAME_TIME = 30000; // ms
  var MOLES = ['🐹', '🐭', '🐻'];

  var gridEl = document.getElementById('moleGrid');
  var scoreEl = document.getElementById('score');
  var timerEl = document.getElementById('timer');
  var bestEl = document.getElementById('best');
  var overlay = Arcade.overlay('#overlay');

  var score = 0;
  var whacks = 0;
  var running = false;
  var lastTickSec = 0;
  var holeEls = [];
  var active = {};      // idx -> true
  var hideScheds = {};  // idx -> Arcade.schedule 핸들
  var nextSched = null;

  /* ── 30초 카운트다운 (Esc/탭 전환 시 자동 일시정지) ── */
  var timer = new Arcade.Timer({
    duration: GAME_TIME,
    onTick: function (left) {
      var sec = Math.ceil(left / 1000);
      timerEl.textContent = sec;
      if (left <= 5000 && sec !== lastTickSec) { // 마지막 5초
        lastTickSec = sec;
        Arcade.audio.play('tick');
      }
    },
    onEnd: endGame
  });

  Arcade.pause.register({
    isActive: function () { return running; }
  });

  function bestScore() {
    return Arcade.best.score(GAME_ID) || 0;
  }

  function renderHud() {
    scoreEl.textContent = score;
    bestEl.textContent = bestScore();
  }

  /* ── 그리드 ── */
  function buildGrid() {
    gridEl.innerHTML = '';
    holeEls = [];
    for (var i = 0; i < HOLES; i++) {
      (function (idx) {
        var hole = document.createElement('div');
        hole.className = 'hole';

        var mole = document.createElement('div');
        mole.className = 'mole-char';
        mole.textContent = MOLES[Arcade.rand(0, MOLES.length - 1)];
        hole.appendChild(mole);

        hole.addEventListener('pointerdown', function (e) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          whack(idx);
        });

        gridEl.appendChild(hole);
        holeEls.push(hole);
      })(i);
    }
  }

  /* ── 두더지 등장/퇴장 (일시정지 인지 스케줄) ── */
  function hideMole(idx) {
    if (!active[idx]) return;
    delete active[idx];
    holeEls[idx].classList.remove('active');
    if (hideScheds[idx]) { hideScheds[idx].cancel(); delete hideScheds[idx]; }
  }

  function peekMole() {
    if (!running) return;

    var inactive = [];
    for (var i = 0; i < HOLES; i++) if (!active[i]) inactive.push(i);

    if (inactive.length) {
      var idx = inactive[Arcade.rand(0, inactive.length - 1)];
      var hole = holeEls[idx];
      hole.querySelector('.mole-char').textContent = MOLES[Arcade.rand(0, MOLES.length - 1)];
      active[idx] = true;
      hole.classList.add('active');

      // 시간이 갈수록 살짝 빨라짐
      var frac = Math.max(0, 1 - timer.elapsed / GAME_TIME);
      var peekDur = 620 + frac * 700 + Math.random() * 300;
      hideScheds[idx] = Arcade.schedule(function () { hideMole(idx); }, peekDur);
    }

    var nextDelay = 380 + Math.random() * 520;
    nextSched = Arcade.schedule(peekMole, nextDelay);
  }

  /* ── 타격 ── */
  function whack(idx) {
    if (!running || Arcade.pause.active) return;
    var hole = holeEls[idx];

    if (!active[idx]) { // 빈 구멍
      Arcade.audio.play('hit');
      hole.classList.remove('miss');
      void hole.offsetWidth;
      hole.classList.add('miss');
      setTimeout(function () { hole.classList.remove('miss'); }, 260);
      return;
    }

    hideMole(idx);
    whacks++;
    score += 10;
    renderHud();

    Arcade.audio.play('pop');
    hole.classList.add('hit');
    setTimeout(function () { hole.classList.remove('hit'); }, 300);
    Arcade.Particles.domBurst(hole, { count: 8, colors: ['#34d399', '#6ee7b7', '#fbbf24'] });

    var pop = document.createElement('div');
    pop.className = 'score-pop';
    pop.textContent = '+10';
    hole.appendChild(pop);
    setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 600);
  }

  /* ── 시작/종료 ── */
  function clearScheds() {
    if (nextSched) { nextSched.cancel(); nextSched = null; }
    Object.keys(hideScheds).forEach(function (k) { hideScheds[k].cancel(); });
    hideScheds = {};
  }

  function startGame() {
    clearScheds();
    buildGrid();
    score = 0;
    whacks = 0;
    active = {};
    lastTickSec = 0;
    running = true;
    timerEl.textContent = GAME_TIME / 1000;
    renderHud();
    timer.start();
    nextSched = Arcade.schedule(peekMole, 400);
  }

  function endGame() {
    running = false;
    timer.stop();
    clearScheds();
    Object.keys(active).forEach(function (k) {
      holeEls[k].classList.remove('active');
    });
    active = {};
    timerEl.textContent = '0';

    var res = Arcade.best.submit(GAME_ID, score);
    renderHud();
    Arcade.audio.play('win');

    overlay.show({
      emoji: '🔨',
      title: '게임 종료!',
      isRecord: res.isRecord,
      stats: [
        { label: '점수', value: score },
        { label: '잡은 두더지', value: whacks },
        { label: '최고 점수', value: bestScore() }
      ],
      btnText: '다시 하기',
      onStart: startGame
    });
  }

  /* ── 부트 ── */
  buildGrid();
  renderHud();
  var b = bestScore();
  overlay.show({
    emoji: '🔨',
    title: '두더지 잡기',
    msg: '30초 안에 튀어나오는 두더지를 잡으세요!\n한 마리에 10점 — 빈 구멍을 치면 시간만 낭비돼요.',
    stats: b > 0 ? [{ label: '최고 점수', value: b }] : null,
    btnText: '시작하기',
    onStart: startGame
  });
})();
