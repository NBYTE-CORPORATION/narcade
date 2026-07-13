/* ============================================
   game9 — 사이먼 (색상 기억)
   패드 점등 순서를 기억해 그대로 따라 누르는 게임.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game9', title: '사이먼 — 색상 기억', emoji: '🎨' });

  var GAME_ID = 'game9';

  /* 패드별 고정 톤 (Hz) — E4 / G4 / A4 / C5 */
  var PAD_FREQ = [329.63, 392.0, 440.0, 523.25];

  /* 재생 속도: 620ms/스텝에서 라운드마다 약 4%씩 가속, 바닥 220ms */
  var BASE_STEP = 620;
  var STEP_FLOOR = 220;

  var padEls = [].slice.call(document.querySelectorAll('.pad'));
  var shellEl = document.getElementById('shell');
  var gridEl = document.getElementById('padGrid');
  var roundEl = document.getElementById('round');
  var bestEl = document.getElementById('best');
  var statusEl = document.getElementById('status');
  var overlay = Arcade.overlay('#overlay');

  /* 키보드 매핑: Q W / A S → 좌상 우상 / 좌하 우하 */
  var KEY_MAP = { q: 0, w: 1, a: 2, s: 3 };

  var sequence = [];
  var inputIdx = 0;
  var round = 0;
  var state = 'idle'; // idle | playback | input | wait | over
  var timeouts = [];

  /* ── 타임아웃 일괄 관리 (재시작 시 전부 해제) ── */
  function after(fn, ms) {
    timeouts.push(setTimeout(fn, ms));
  }

  function clearTimeouts() {
    timeouts.forEach(function (id) { clearTimeout(id); });
    timeouts = [];
  }

  /* ── HUD ── */
  function bestScore() {
    var b = Arcade.best.get(GAME_ID);
    if (b && typeof b === 'object') b = b.score;
    return typeof b === 'number' ? b : 0;
  }

  function updateHud() {
    roundEl.textContent = round;
    bestEl.textContent = bestScore();
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }

  /* ── 패드 점등 + 톤 ── */
  function light(idx, litMs, toneMs) {
    var el = padEls[idx];
    el.classList.remove('lit');
    el.classList.add('lit');
    Arcade.audio.tone(PAD_FREQ[idx], toneMs, { type: 'sine', gain: 0.16 });
    after(function () { el.classList.remove('lit'); }, litMs);
  }

  function stepMs(r) {
    return Math.max(STEP_FLOOR, Math.round(BASE_STEP * Math.pow(0.96, r - 1)));
  }

  /* ── 시퀀스 재생 (입력 잠금) ── */
  function playback() {
    state = 'playback';
    gridEl.classList.add('locked');
    setStatus('잘 보세요…', 'watch');
    var step = stepMs(round);
    var litDur = Math.max(120, Math.min(step - 70, 300));
    sequence.forEach(function (padIdx, i) {
      after(function () { light(padIdx, litDur, 250); }, 500 + i * step);
    });
    after(function () {
      state = 'input';
      inputIdx = 0;
      gridEl.classList.remove('locked');
      setStatus('당신 차례!', 'turn');
    }, 500 + sequence.length * step);
  }

  /* ── 라운드 진행 ── */
  function nextRound() {
    round++;
    sequence.push(Arcade.rand(0, 3));
    updateHud();
    if (round >= 5 && round % 5 === 0) surge();
    playback();
  }

  /* 5라운드마다 은은한 강도 상승 (배경 글로우 + 화면 맥동) */
  function surge() {
    var heat = Math.min(3, Math.floor(round / 5));
    shellEl.classList.remove('heat-1', 'heat-2', 'heat-3', 'surge');
    void shellEl.offsetWidth; /* 애니메이션 재트리거 */
    shellEl.classList.add('heat-' + heat, 'surge');
  }

  /* ── 플레이어 입력 ── */
  function pressPad(idx) {
    if (state !== 'input') return;
    if (sequence[inputIdx] === idx) {
      light(idx, 180, 180);
      inputIdx++;
      if (inputIdx === sequence.length) roundClear();
    } else {
      fail(idx);
    }
  }

  function roundClear() {
    state = 'wait';
    gridEl.classList.add('locked');
    after(function () {
      Arcade.audio.play('coin');
      setStatus('성공! 다음 라운드…', 'good');
    }, 230);
    after(nextRound, 900);
  }

  /* ── 게임 오버 ── */
  function fail(wrongIdx) {
    state = 'over';
    var correctIdx = sequence[inputIdx];
    clearTimeouts();
    gridEl.classList.add('locked');
    setStatus('앗, 틀렸어요!', 'bad');

    /* 버저 + 오답 패드 표시 */
    Arcade.audio.tone(110, 400, { type: 'sawtooth', gain: 0.2 });
    var wrongEl = padEls[wrongIdx];
    wrongEl.classList.add('wrong');
    after(function () { wrongEl.classList.remove('wrong'); }, 500);

    /* 정답 패드 깜빡임 (3회) */
    for (var i = 0; i < 3; i++) {
      (function (d) {
        after(function () { padEls[correctIdx].classList.add('lit'); }, d);
        after(function () { padEls[correctIdx].classList.remove('lit'); }, d + 190);
      })(560 + i * 320);
    }

    var reached = round;
    var res = Arcade.best.submit(GAME_ID, reached);
    updateHud();
    after(function () { Arcade.audio.play(res.isRecord ? 'win' : 'lose'); }, 700);
    after(function () { showGameOver(reached, res.isRecord); }, 1750);
  }

  function showGameOver(reached, isRecord) {
    overlay.show({
      emoji: '💥',
      title: '게임 오버',
      isRecord: isRecord,
      msg: reached > 1
        ? (reached - 1) + '라운드까지 완벽하게 기억했어요!'
        : '괜찮아요, 다시 도전해 봐요!',
      stats: [
        { label: '도달 라운드', value: reached },
        { label: '최고 라운드', value: bestScore() }
      ],
      btnText: '다시 도전',
      onStart: startGame
    });
  }

  /* ── 시작/재시작 ── */
  function startGame() {
    clearTimeouts();
    overlay.hide();
    padEls.forEach(function (el) { el.classList.remove('lit', 'wrong'); });
    shellEl.classList.remove('heat-1', 'heat-2', 'heat-3', 'surge');
    gridEl.classList.remove('locked');
    sequence = [];
    round = 0;
    inputIdx = 0;
    state = 'wait';
    updateHud();
    nextRound();
  }

  /* ── 입력 바인딩: pointerdown 단일 경로 (터치 더블파이어 방지) ── */
  padEls.forEach(function (el, idx) {
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      pressPad(idx);
    });
  });

  window.addEventListener('keydown', function (e) {
    if (e.repeat) return;
    var idx = KEY_MAP[(e.key || '').toLowerCase()];
    if (idx === undefined) return;
    e.preventDefault();
    pressPad(idx);
  });

  /* ── 시작 오버레이 ── */
  updateHud();
  overlay.show({
    emoji: '🎨',
    title: '사이먼',
    msg: '패드가 빛나는 순서를 기억했다가\n똑같은 순서로 따라 눌러 주세요.\n라운드마다 한 칸씩 길어지고 점점 빨라져요!',
    btnText: '시작하기',
    onStart: startGame
  });
})();
