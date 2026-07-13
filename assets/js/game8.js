/* ============================================
   산수 스트릭 — game8
   제한 시간 안에 4지선다 정답 고르기, 목숨 3개 무한 스트릭
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game8', title: '산수 스트릭', emoji: '➕', accent: 'amber' });

  var rand = Arcade.rand;

  /* ── DOM ── */
  var containerEl = document.querySelector('.game-container');
  var problemEl = document.getElementById('problem');
  var livesEl = document.getElementById('lives');
  var scoreEl = document.getElementById('score');
  var comboMeterEl = document.getElementById('comboMeter');
  var comboMultEl = document.getElementById('comboMult');
  var comboPips = Array.prototype.slice.call(document.querySelectorAll('#comboPips i'));
  var levelTagEl = document.getElementById('levelTag');
  var timebarEl = document.getElementById('timebar');
  var timebarFillEl = document.getElementById('timebarFill');
  var choiceBtns = Array.prototype.slice.call(document.querySelectorAll('#choices .choice'));
  var overlay = Arcade.overlay('#overlay');

  /* ── 상수 ── */
  var MAX_LIVES = 3;
  var COMBO_CAP = 4;      // 배수 상한 ×4
  var BASE_TIME = 6000;   // 첫 문제 제한시간(ms)
  var TIME_STEP = 80;     // 문제당 단축(ms)
  var MIN_TIME = 2500;    // 하한(ms)

  /* ── 상태 ── */
  var running = false;
  var locked = true;       // 입력 잠금(피드백 표시 중)
  var pendingNext = false; // 일시정지 중 다음 문제 대기
  var lives = MAX_LIVES;
  var score = 0;
  var combo = 0;
  var maxCombo = 0;
  var problemNo = 0;       // 출제된 문제 수(난이도 램프 기준)
  var correctCount = 0;    // 맞힌 문제 수
  var answer = 0;
  var duration = BASE_TIME;
  var lastTickSec = 0;
  var nextTid = 0;

  /* ── 문제별 카운트다운 (Esc/탭 전환 시 자동 일시정지) ── */
  var timer = new Arcade.Timer({
    duration: BASE_TIME,
    onTick: function (left) {
      var frac = duration > 0 ? left / duration : 0;
      timebarFillEl.style.width = (frac * 100).toFixed(2) + '%';
      var low = left <= 2000;
      timebarEl.classList.toggle('low', low);
      if (low) {
        var sec = Math.ceil(left / 1000); // 마지막 2초 동안 초당 1회만
        if (sec !== lastTickSec) {
          lastTickSec = sec;
          Arcade.audio.play('tick');
        }
      }
    },
    onEnd: function () {
      if (!running || locked) return;
      locked = true;
      timebarFillEl.style.width = '0%';
      fail(null); // 시간 초과 = 오답 처리
    }
  });

  Arcade.pause.register({
    isActive: function () { return running; },
    onResume: function () {
      if (pendingNext && running) {
        pendingNext = false;
        advance();
      }
    }
  });

  /* ══════════ 문제 생성 ══════════ */
  function levelFor(n) {
    if (n < 5) return 1;
    if (n < 12) return 2;
    if (n < 20) return 3;
    return 4;
  }

  function genProblem(lv) {
    var a, b, c, q, t, r;
    if (lv === 1) { // 1~9 덧셈/뺄셈
      a = rand(1, 9); b = rand(1, 9);
      if (Math.random() < 0.5) return { text: a + ' + ' + b, answer: a + b };
      if (a < b) { t = a; a = b; b = t; }
      return { text: a + ' − ' + b, answer: a - b };
    }
    if (lv === 2) { // 두자리 ±, 한자리 곱셈
      r = Math.random();
      if (r < 0.35) {
        a = rand(10, 99); b = rand(10, 99);
        return { text: a + ' + ' + b, answer: a + b };
      }
      if (r < 0.7) {
        a = rand(10, 99); b = rand(10, 99);
        if (a < b) { t = a; a = b; b = t; }
        return { text: a + ' − ' + b, answer: a - b };
      }
      a = rand(2, 9); b = rand(2, 9);
      return { text: a + ' × ' + b, answer: a * b };
    }
    if (lv === 3) { // 두자리 곱, 정수 나눗셈
      if (Math.random() < 0.5) {
        a = rand(11, 29); b = rand(3, 9);
        return { text: a + ' × ' + b, answer: a * b };
      }
      b = rand(2, 9); q = rand(3, 12); a = b * q;
      return { text: a + ' ÷ ' + b, answer: q };
    }
    // Lv4: 3항식 (표준 연산자 우선순위)
    r = rand(0, 3);
    if (r === 0) { // a + b × c
      a = rand(2, 20); b = rand(2, 9); c = rand(2, 9);
      return { text: a + ' + ' + b + ' × ' + c, answer: a + b * c };
    }
    if (r === 1) { // a − b × c (음수 방지)
      b = rand(2, 9); c = rand(2, 9); a = b * c + rand(1, 30);
      return { text: a + ' − ' + b + ' × ' + c, answer: a - b * c };
    }
    if (r === 2) { // a × b + c
      a = rand(3, 9); b = rand(3, 9); c = rand(2, 30);
      return { text: a + ' × ' + b + ' + ' + c, answer: a * b + c };
    }
    // a + d ÷ b (정수 나눗셈)
    b = rand(2, 9); q = rand(2, 9); a = rand(2, 30);
    return { text: a + ' + ' + (b * q) + ' ÷ ' + b, answer: a + q };
  }

  /* ── 오답 보기: 자릿수 스왑 ── */
  function digitSwap(n) {
    var s = String(n);
    if (s.length < 2) return null;
    var i = rand(0, s.length - 2);
    var arr = s.split('');
    var t = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = t;
    var v = parseInt(arr.join(''), 10);
    return v === n ? null : v;
  }

  /* ── 4지선다 구성: 정답 + 그럴듯한 오답 3개, 셔플 ── */
  function makeChoices(ans, lv) {
    var out = [ans];
    var used = {};
    used[ans] = true;
    var spread = lv >= 4 ? 5 : 10; // Lv4는 더 촘촘한 오답

    var sw = digitSwap(ans);
    if (sw !== null && sw >= 0 && !used[sw]) {
      used[sw] = true;
      out.push(sw);
    }

    var guard = 0;
    while (out.length < 4 && guard++ < 300) {
      var off = rand(1, spread) * (Math.random() < 0.5 ? -1 : 1);
      var d = ans + off;
      if (d < 0 || used[d]) continue;
      used[d] = true;
      out.push(d);
    }
    var extra = 1;
    while (out.length < 4) { // 안전망
      var d2 = ans + spread + extra++;
      if (!used[d2]) { used[d2] = true; out.push(d2); }
    }

    for (var i = out.length - 1; i > 0; i--) {
      var j = rand(0, i);
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  /* ══════════ 렌더링 ══════════ */
  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function renderLives() {
    var html = '';
    for (var i = 0; i < MAX_LIVES; i++) {
      html += i < lives
        ? '<span class="alive">❤️</span>'
        : '<span class="lost">🖤</span>';
    }
    livesEl.innerHTML = html;
  }

  function renderScore() {
    scoreEl.textContent = score;
  }

  function renderCombo() {
    var mult = combo > 0 ? Math.min(COMBO_CAP, combo) : 1;
    comboMultEl.textContent = '×' + mult;
    comboMeterEl.dataset.glow = combo > 0 ? String(mult) : '0';
    for (var i = 0; i < comboPips.length; i++) {
      comboPips[i].classList.toggle('on', i < Math.min(combo, COMBO_CAP));
    }
  }

  function setChoicesDisabled(disabled) {
    choiceBtns.forEach(function (b) { b.disabled = disabled; });
  }

  /* ══════════ 진행 ══════════ */
  function nextProblem() {
    var lv = levelFor(problemNo);
    levelTagEl.textContent = 'LV.' + lv;

    var p = genProblem(lv);
    answer = p.answer;
    problemEl.textContent = p.text + ' = ?';
    restartAnim(problemEl, 'pop');

    var ch = makeChoices(answer, lv);
    choiceBtns.forEach(function (b, i) {
      b.textContent = String(ch[i]);
      b.dataset.val = String(ch[i]);
      b.classList.remove('correct', 'wrong', 'reveal');
      b.disabled = false;
    });

    duration = Math.max(MIN_TIME, BASE_TIME - problemNo * TIME_STEP);
    timer.duration = duration;
    lastTickSec = 0;
    timebarEl.classList.remove('low');
    timebarFillEl.style.width = '100%';
    locked = false;
    timer.start();
  }

  function scheduleNext(delay) {
    clearTimeout(nextTid);
    nextTid = setTimeout(function () {
      if (!running) return;
      if (Arcade.pause.active) { pendingNext = true; return; } // 재개 시 진행
      advance();
    }, delay);
  }

  function advance() {
    if (lives <= 0) gameOver();
    else nextProblem();
  }

  function choose(idx) {
    if (!running || locked || Arcade.pause.active) return;
    var btn = choiceBtns[idx];
    if (!btn || btn.disabled) return;
    locked = true;
    timer.stop();
    Arcade.audio.play('click');
    if (parseInt(btn.dataset.val, 10) === answer) succeed(btn);
    else fail(btn);
  }

  function succeed(btn) {
    problemNo++;
    correctCount++;
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    var mult = Math.min(COMBO_CAP, combo);
    var leftFrac = duration > 0 ? Math.max(0, 1 - timer.elapsed / duration) : 0;
    score += 10 * mult + Math.round(leftFrac * 10); // 기본 10×배수 + 시간 보너스

    Arcade.audio.play('coin');
    if (combo >= 3) Arcade.audio.play('combo', { step: combo });

    btn.classList.add('correct');
    setChoicesDisabled(true);
    renderScore();
    renderCombo();
    restartAnim(scoreEl, 'bump');
    restartAnim(comboMultEl, 'bump');
    if (combo >= 3) {
      Arcade.Particles.domBurst(btn, { count: 8 + mult * 3, colors: ['#f59e0b', '#fcd34d', '#06b6d4'] });
    }
    scheduleNext(550);
  }

  function fail(btn) {
    problemNo++;
    combo = 0;
    lives--;

    Arcade.audio.play('hit');
    if (btn) btn.classList.add('wrong');
    choiceBtns.forEach(function (b) { // 정답 잠깐 공개
      if (parseInt(b.dataset.val, 10) === answer) b.classList.add('reveal');
    });
    setChoicesDisabled(true);
    renderLives();
    renderCombo();
    restartAnim(containerEl, 'hurt');
    scheduleNext(1100);
  }

  /* ══════════ 시작/종료 ══════════ */
  function startGame() {
    clearTimeout(nextTid);
    pendingNext = false;
    timer.stop();
    running = true;
    lives = MAX_LIVES;
    score = 0;
    combo = 0;
    maxCombo = 0;
    problemNo = 0;
    correctCount = 0;
    renderLives();
    renderScore();
    renderCombo();
    nextProblem();
  }

  function gameOver() {
    running = false;
    locked = true;
    timer.stop();
    timebarEl.classList.remove('low');
    Arcade.audio.play('lose');

    var res = Arcade.best.submit('game8', score);
    overlay.show({
      emoji: '💥',
      title: '게임 오버',
      isRecord: res.isRecord,
      stats: [
        { label: '점수', value: score },
        { label: '최대 콤보', value: maxCombo },
        { label: '푼 문제', value: correctCount }
      ],
      btnText: '다시 도전',
      onStart: startGame
    });
  }

  function bestScoreValue() {
    var b = Arcade.best.get('game8');
    if (b && typeof b === 'object') return typeof b.score === 'number' ? b.score : null;
    return typeof b === 'number' ? b : null;
  }

  function showStart() {
    var best = bestScoreValue();
    overlay.show({
      emoji: '➕',
      title: '산수 스트릭',
      msg: '제한 시간 안에 정답 버튼을 고르세요!\n' +
        '연속 정답 콤보로 점수가 최대 ×4까지 커져요.\n' +
        '갈수록 문제는 어려워지고 시간은 짧아집니다.\n' +
        '목숨 3개 — 틀리거나 시간이 끝나면 하나를 잃어요.',
      stats: best !== null ? [{ label: '최고 점수', value: best }] : null,
      btnText: '시작하기',
      onStart: startGame
    });
  }

  /* ══════════ 입력 ══════════ */
  choiceBtns.forEach(function (b, i) {
    b.addEventListener('click', function () { choose(i); });
  });

  window.addEventListener('keydown', function (e) {
    if (e.key >= '1' && e.key <= '4' && !e.repeat) {
      e.preventDefault();
      choose(parseInt(e.key, 10) - 1);
    }
  });

  /* ── 부트 ── */
  renderLives();
  renderScore();
  renderCombo();
  showStart();
})();
