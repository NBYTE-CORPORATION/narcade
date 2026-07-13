/* ============================================
   game1 — 숫자 맞추기 (hot/cold)
   1~100 사이 숫자를 8번 안에. 온도 게이지 힌트.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game1', title: '숫자 맞추기', emoji: '🎯', accent: 'cyan' });

  var MAX_TRIES = 8;
  var GAME_ID = 'game1';

  var displayEl = document.getElementById('display');
  var hintEl = document.getElementById('hint');
  var historyEl = document.getElementById('history');
  var triesEl = document.getElementById('tries');
  var coverEl = document.getElementById('tempCover');
  var needleEl = document.getElementById('tempNeedle');
  var keypadEl = document.getElementById('keypad');
  var ov = Arcade.overlay('#overlay');

  var answer = 0;
  var tries = 0;
  var input = '';
  var playing = false;
  var prevDiff = null;
  var guessed = [];

  /* ── 남은 기회 점 생성 ── */
  var dots = [];
  (function buildDots() {
    for (var i = 0; i < MAX_TRIES; i++) {
      var d = document.createElement('span');
      d.className = 'try-dot';
      triesEl.appendChild(d);
      dots.push(d);
    }
  })();

  /* ── 키패드 생성 ── */
  (function buildKeypad() {
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];
    keys.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      if (k === 'back') {
        b.textContent = '←';
        b.className = 'key-back';
        b.setAttribute('aria-label', '지우기');
      } else if (k === 'ok') {
        b.textContent = '확인';
        b.className = 'key-ok';
      } else {
        b.textContent = k;
      }
      b.addEventListener('click', function () { press(k); });
      keypadEl.appendChild(b);
    });
  })();

  /* ── 물리 키보드 ── */
  window.addEventListener('keydown', function (e) {
    if (ov.el.classList.contains('show')) return;
    if (!playing) return;
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      press(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      press('back');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      press('ok');
    }
  });

  /* ── 입력 처리 ── */
  function press(k) {
    if (!playing) return;
    if (k === 'ok') { submitGuess(); return; }
    Arcade.audio.play('click');
    if (k === 'back') input = input.slice(0, -1);
    else if (input.length < 3) input += k;
    renderDisplay();
  }

  function renderDisplay() {
    displayEl.textContent = input || '?';
    displayEl.classList.toggle('empty', input === '');
  }

  function renderTries() {
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('used', i < tries);
    }
  }

  function setHint(text, cls) {
    hintEl.textContent = text;
    hintEl.className = 'hint-text' + (cls ? ' ' + cls : '');
  }

  function flashError(msg) {
    Arcade.audio.play('hit');
    setHint(msg, 'text-danger');
    displayEl.classList.remove('shake');
    void displayEl.offsetWidth; /* 리플로우로 애니메이션 재시작 */
    displayEl.classList.add('shake');
  }

  /* ── 온도 게이지 ── */
  function updateGauge(diff) {
    var pct = Math.round(3 + 94 * (1 - Math.min(diff, 50) / 50));
    coverEl.style.width = (100 - pct) + '%';
    needleEl.style.left = pct + '%';
    needleEl.style.opacity = '1';
  }

  function resetGauge() {
    coverEl.style.width = '100%';
    needleEl.style.opacity = '0';
    needleEl.style.left = '0%';
  }

  function tempHint(diff) {
    if (diff <= 2)  return { text: '🔥 타는 듯이 뜨거워요!', cls: 'text-danger' };
    if (diff <= 5)  return { text: '🔥 뜨거워요!', cls: 'text-danger' };
    if (diff <= 10) return { text: '♨️ 따뜻해요', cls: 'text-warn' };
    if (diff <= 20) return { text: '🌡️ 미지근해요', cls: 'text-warn' };
    if (diff <= 40) return { text: '❄️ 차가워요', cls: 'text-info' };
    return { text: '🧊 꽁꽁 얼겠어요!', cls: 'text-info' };
  }

  /* ── 기록 칩 ── */
  function addChip(n) {
    var up = answer > n; /* 정답이 더 높음 */
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.title = up ? '더 높음' : '더 낮음';
    chip.setAttribute('aria-label', n + ', 정답은 ' + (up ? '더 높음' : '더 낮음'));
    chip.innerHTML =
      '<span class="chip-num">' + n + '</span>' +
      '<span class="chip-dir ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + '</span>';
    historyEl.appendChild(chip);
  }

  /* ── 추측 제출 ── */
  function submitGuess() {
    var n = parseInt(input, 10);
    if (isNaN(n) || n < 1 || n > 100) {
      flashError('1~100 사이 숫자를 입력하세요');
      return;
    }
    if (guessed.indexOf(n) !== -1) {
      flashError('이미 시도한 숫자예요!');
      input = '';
      renderDisplay();
      return;
    }

    guessed.push(n);
    tries++;
    input = '';
    renderDisplay();
    renderTries();
    Arcade.audio.play('pop');

    var diff = Math.abs(n - answer);
    if (diff === 0) { win(); return; }

    addChip(n);
    updateGauge(diff);
    var h = tempHint(diff);
    setHint(h.text, h.cls);

    if (prevDiff !== null && diff < prevDiff) {
      Arcade.audio.play('coin'); /* 점점 뜨거워질 때 */
    }
    prevDiff = diff;

    if (tries >= MAX_TRIES) lose();
  }

  /* ── 라운드 종료 ── */
  function win() {
    playing = false;
    var score = (MAX_TRIES - tries) * 100 + (tries <= 3 ? 500 : 0);
    updateGauge(0);
    setHint('🎉 정답! ' + answer + '을(를) 맞췄어요!', 'text-success');
    Arcade.audio.play('win');
    Arcade.Particles.domBurst(displayEl, { count: 26 });

    var res = Arcade.best.submit(GAME_ID, score);
    var bestScore = (res.best && typeof res.best === 'object') ? res.best.score : res.best;

    setTimeout(function () {
      ov.show({
        emoji: '🎉',
        title: '정답이에요!',
        isRecord: res.isRecord,
        msg: tries <= 3 ? '3번 안에 성공! 보너스 +500점 🎁' : '',
        stats: [
          { label: '정답', value: answer },
          { label: '시도 횟수', value: tries + '회' },
          { label: '점수', value: score },
          { label: '최고 점수', value: bestScore }
        ],
        btnText: '다시하기',
        onStart: startGame
      });
    }, 900);
  }

  function lose() {
    playing = false;
    setHint('💥 실패! 정답은 ' + answer, 'text-danger');
    Arcade.audio.play('lose');

    var best = Arcade.best.get(GAME_ID);
    var bestScore = (best && typeof best === 'object') ? best.score : best;

    setTimeout(function () {
      ov.show({
        emoji: '😵',
        title: '아쉬워요!',
        msg: '8번 안에 못 맞췄어요.\n다음엔 꼭 성공할 수 있을 거예요!',
        stats: [
          { label: '정답', value: answer },
          { label: '시도 횟수', value: tries + '회' },
          { label: '점수', value: 0 },
          { label: '최고 점수', value: bestScore === null ? '-' : bestScore }
        ],
        btnText: '다시하기',
        onStart: startGame
      });
    }, 900);
  }

  /* ── 라운드 시작 ── */
  function startGame() {
    answer = Arcade.rand(1, 100);
    tries = 0;
    input = '';
    prevDiff = null;
    guessed = [];
    playing = true;
    historyEl.innerHTML = '';
    renderDisplay();
    renderTries();
    resetGauge();
    setHint('숫자를 입력하고 확인을 눌러요');
  }

  /* ── 시작 오버레이 ── */
  ov.show({
    emoji: '🎯',
    title: '숫자 맞추기',
    msg: '1부터 100 사이의 숫자를 8번 안에!\n온도 게이지가 정답과의 거리를 알려줘요 🔥❄️\n빨리 맞출수록 점수가 높아요.',
    btnText: '시작하기',
    onStart: startGame
  });
})();
