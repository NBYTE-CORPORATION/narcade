/* ============================================================
   game7 — 퀵 타이핑 (60초 타임어택)
   60초 동안 문장을 최대한 많이 입력. CPM(타/분) 기준 기록.
   한국어 IME 조합 중인 글자는 판정을 보류(관대 처리)한다.
   ============================================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game7', title: '퀵 타이핑', emoji: '⌨️', accent: 'cyan' });

  var DURATION = 60000;

  /* ── 문장 풀 ── */
  var SENTENCES = {
    ko: [
      // 속담
      '가는 말이 고와야 오는 말이 곱다',
      '천 리 길도 한 걸음부터',
      '호랑이도 제 말 하면 온다',
      '등잔 밑이 어둡다',
      '백지장도 맞들면 낫다',
      '원숭이도 나무에서 떨어진다',
      '티끌 모아 태산',
      '금강산도 식후경',
      '고생 끝에 낙이 온다',
      '구슬이 서 말이라도 꿰어야 보배',
      // 일상 문장
      '오늘 저녁 메뉴는 치킨이 좋겠어',
      '주말에 같이 영화 보러 갈래?',
      '커피 한 잔의 여유를 즐겨요',
      '내일은 오늘보다 나을 거야',
      '지금 이 순간을 즐기자',
      '버스보다 지하철이 빠를 것 같아',
      '비 오는 날엔 부침개가 최고지',
      // 아케이드 감성
      '나케이드에서 신기록에 도전하세요',
      '동전 넣고 스타트 버튼을 누르세요',
      '콤보를 이어가면 점수가 두 배!',
      '보스전은 언제나 심장이 두근두근',
      '최고 점수의 주인공은 바로 당신',
      '게임 오버는 새로운 시작일 뿐'
    ],
    en: [
      'The quick brown fox jumps over the lazy dog',
      'Pack my box with five dozen liquor jugs',
      'How vexingly quick daft zebras jump',
      'Sphinx of black quartz judge my vow',
      'Practice makes perfect every single day',
      'Typing fast is a superpower in disguise',
      'Insert coin to continue the adventure',
      'A new high score is waiting for you',
      'Stay calm and keep on typing',
      'Every expert was once a beginner',
      'The arcade lights glow all night long',
      'Speed is nothing without accuracy',
      'One more game before we go home',
      'Level up your fingers with practice',
      'Fortune favors the fast and the bold',
      'Do not look at the keyboard'
    ]
  };

  /* ── DOM ── */
  var targetEl = document.getElementById('targetText');
  var input = document.getElementById('userInput');
  var timeVal = document.getElementById('timeVal');
  var timeStat = document.getElementById('timeStat');
  var cpmVal = document.getElementById('cpmVal');
  var accVal = document.getElementById('accVal');
  var doneVal = document.getElementById('doneVal');
  var ov = Arcade.overlay('#overlay');

  if (Arcade.touch.isCoarse()) {
    document.getElementById('coarseNote').hidden = false;
  }

  /* ── 상태 ── */
  var state = {
    playing: false,
    advancing: false,          // 문장 전환 중 재진입 방지
    lang: 'ko',
    target: '',
    spans: [],
    evalFlags: [],             // 위치별 1회 평가 플래그(정확도용)
    queue: [],
    completed: 0,
    doneStrokes: 0,            // 완성 문장 누적 타수
    curStrokes: 0,             // 현재 문장 정타 타수
    totalEval: 0,              // 평가된 총 글자 수
    wrong: 0,                  // 오타 수
    composing: false,
    lastHit: 0,                // 'hit' 사운드 스로틀
    lastTickSec: -1,
    elapsedMs: 0
  };

  var timer = new Arcade.Timer({
    duration: DURATION,
    onTick: onTick,
    onEnd: endGame
  });

  Arcade.pause.register({
    isActive: function () { return state.playing; },
    onPause: function () { input.blur(); },
    onResume: function () { input.focus(); }
  });

  /* ── 한글 타수(2벌식 기준 자모 스트로크) 계산 ──
     복모음(ㅘㅙㅚㅝㅞㅟㅢ) 2타, 복받침(ㄳㄵㄶㄺ…ㅄ) 2타, 그 외 자모 1타 */
  var COMPOUND_JUNG = { 9: 1, 10: 1, 11: 1, 14: 1, 15: 1, 16: 1, 19: 1 };
  var COMPOUND_JONG = { 3: 1, 5: 1, 6: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1, 15: 1, 18: 1 };

  function strokesOf(ch) {
    var code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      var c = code - 0xAC00;
      var jong = c % 28;
      var jung = ((c - jong) / 28) % 21;
      var n = 2; // 초성 1 + 중성 1
      if (COMPOUND_JUNG[jung]) n++;
      if (jong) n += COMPOUND_JONG[jong] ? 2 : 1;
      return n;
    }
    return 1;
  }

  function sentenceStrokes(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) n += strokesOf(str[i]);
    return n;
  }

  /* ── 문장 큐 ── */
  function refillQueue() {
    var q = SENTENCES[state.lang].slice();
    for (var i = q.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = q[i]; q[i] = q[j]; q[j] = t;
    }
    // 직전 문장과 바로 이어지는 중복 방지 (pop은 뒤에서 꺼냄)
    if (q.length > 1 && q[q.length - 1] === state.target) {
      q.unshift(q.pop());
    }
    state.queue = q;
  }

  function nextSentence() {
    if (!state.queue.length) refillQueue();
    state.target = state.queue.pop();
    renderTarget();
  }

  function renderTarget() {
    targetEl.innerHTML = '';
    targetEl.classList.remove('overflow');
    state.spans = [];
    state.evalFlags = [];
    for (var i = 0; i < state.target.length; i++) {
      var s = document.createElement('span');
      s.className = 'qt-char' + (i === 0 ? ' cur' : '');
      s.textContent = state.target[i];
      targetEl.appendChild(s);
      state.spans.push(s);
    }
  }

  /* ── 판정 ── */
  function markEval(i, isWrong) {
    if (state.evalFlags[i]) return false; // 위치당 1회만 집계
    state.evalFlags[i] = true;
    state.totalEval++;
    if (isWrong) { state.wrong++; return true; }
    return false;
  }

  function playHitThrottled() {
    var now = performance.now();
    if (now - state.lastHit > 200) {
      state.lastHit = now;
      Arcade.audio.play('hit');
    }
  }

  function evaluate(val, composing) {
    if (!state.playing || state.advancing) return;

    // 완성: 조합 중이어도 값이 일치하면 즉시 다음 문장
    if (val === state.target) { completeSentence(); return; }

    var t = state.target;
    for (var i = 0; i < t.length; i++) {
      var span = state.spans[i];
      span.className = 'qt-char';
      if (i < val.length) {
        var isComposingChar = composing && i === val.length - 1;
        if (val[i] === t[i]) {
          span.classList.add('ok');
          if (!isComposingChar) markEval(i, false);
        } else if (isComposingChar) {
          span.classList.add('compose'); // 조합 중 — 판정 보류
        } else {
          span.classList.add('bad');
          if (markEval(i, true)) playHitThrottled();
        }
      } else if (i === val.length) {
        span.classList.add('cur');
      }
    }

    // 목표보다 길게 입력한 초과분도 오타 처리
    for (var j = t.length; j < val.length; j++) {
      if (!(composing && j === val.length - 1)) {
        if (markEval(j, true)) playHitThrottled();
      }
    }
    targetEl.classList.toggle('overflow', val.length > t.length);

    // 현재 문장 정타 타수(라이브 CPM용)
    var cs = 0;
    var n = Math.min(val.length, t.length);
    for (var k = 0; k < n; k++) {
      if (val[k] === t[k]) cs += strokesOf(t[k]);
    }
    state.curStrokes = cs;
    updateStats();
  }

  function completeSentence() {
    state.advancing = true;
    // 아직 평가 안 된 위치는 전부 정타 처리(조합 중 완성 케이스)
    for (var i = 0; i < state.target.length; i++) markEval(i, false);
    state.completed++;
    state.doneStrokes += sentenceStrokes(state.target);
    state.curStrokes = 0;

    Arcade.audio.play('coin');
    Arcade.Particles.domBurst(targetEl, { count: 14, colors: ['#67e8f9', '#06b6d4', '#10b981'] });

    // blur→clear→focus 로 IME 조합 상태를 확실히 초기화
    input.blur();
    input.value = '';
    state.composing = false;
    nextSentence();
    updateStats();
    input.focus();
    state.advancing = false;
  }

  /* ── 통계 ── */
  function updateStats() {
    var strokes = state.doneStrokes + state.curStrokes;
    var cpm = Math.round(strokes * 60000 / Math.max(state.elapsedMs, 5000));
    cpmVal.textContent = cpm;
    var acc = state.totalEval
      ? Math.max(0, Math.round((state.totalEval - state.wrong) / state.totalEval * 100))
      : 100;
    accVal.textContent = acc + '%';
    doneVal.textContent = state.completed;
  }

  function finalCPM() {
    // 정확히 60초 경과 → 총 정타 타수가 곧 타/분
    return state.doneStrokes + state.curStrokes;
  }

  function finalAcc() {
    return state.totalEval
      ? Math.max(0, Math.round((state.totalEval - state.wrong) / state.totalEval * 100))
      : 100;
  }

  /* ── 타이머 ── */
  function onTick(left) {
    state.elapsedMs = DURATION - left;
    timeVal.textContent = (left / 1000).toFixed(1);
    var sec = Math.ceil(left / 1000);
    if (sec !== state.lastTickSec) {
      state.lastTickSec = sec;
      if (sec === 10 || (sec <= 5 && sec >= 1)) Arcade.audio.play('tick');
      timeStat.classList.toggle('urgent', sec <= 10);
    }
    updateStats();
  }

  /* ── 게임 흐름 ── */
  function start() {
    state.playing = true;
    state.advancing = false;
    state.completed = 0;
    state.doneStrokes = 0;
    state.curStrokes = 0;
    state.totalEval = 0;
    state.wrong = 0;
    state.composing = false;
    state.lastTickSec = -1;
    state.elapsedMs = 0;
    state.queue = [];
    state.target = '';

    timeStat.classList.remove('urgent');
    timeVal.textContent = '60.0';
    input.disabled = false;
    input.value = '';
    nextSentence();
    updateStats();
    timer.start();
    input.focus();
  }

  function endGame() {
    if (!state.playing) return;
    state.playing = false;
    input.disabled = true;
    input.blur();
    timeVal.textContent = '0.0';
    Arcade.audio.play('win');

    var cpm = finalCPM();
    var acc = finalAcc();
    var res = Arcade.best.submit('game7', cpm);
    var g = grade(cpm);

    Arcade.schedule(function () {
      ov.show({
        emoji: g.emoji,
        title: '타임 업!',
        isRecord: res.isRecord,
        msg: g.msg + '\n🏆 최고 기록: ' + Arcade.best.score('game7') + ' 타/분',
        stats: [
          { label: '타/분', value: cpm },
          { label: '정확도', value: acc + '%' },
          { label: '완성 문장', value: state.completed }
        ],
        extraHTML: '<div class="qt-lang" id="langPills"></div>',
        btnText: '다시하기',
        onStart: start
      });
      mountLangPills();
    }, 600);
  }

  function grade(cpm) {
    if (cpm >= 500) return { emoji: '🚀', msg: '로켓급 손가락! 타자의 신이에요' };
    if (cpm >= 400) return { emoji: '⚡', msg: '번개 같은 속도! 정말 빨라요' };
    if (cpm >= 300) return { emoji: '👍', msg: '훌륭한 타자 실력이에요' };
    if (cpm >= 200) return { emoji: '🙂', msg: '좋아요! 조금만 더 연습해봐요' };
    return { emoji: '🐢', msg: '천천히, 꾸준히 하면 빨라져요' };
  }

  /* ── 언어 선택 (Arcade.difficulty 재사용, 선택은 store에 저장됨) ── */
  function mountLangPills() {
    var holder = ov.el.querySelector('#langPills');
    if (!holder) return;
    state.lang = Arcade.difficulty(holder, [
      { id: 'ko', label: '한글' },
      { id: 'en', label: 'English' }
    ], function (lang) {
      state.lang = lang;
    }, { gameId: 'game7:lang' });
  }

  /* ── 시작 오버레이 ── */
  function showStart() {
    var best = Arcade.best.score('game7');
    ov.show({
      emoji: '⌨️',
      title: '퀵 타이핑',
      msg: '60초 동안 문장을 최대한 많이 입력하세요!\n' +
        '맞은 글자는 초록, 틀린 글자는 빨강으로 표시돼요.\n' +
        'Esc 키로 일시정지할 수 있어요.' +
        (best !== null ? '\n\n🏆 최고 기록: ' + best + ' 타/분' : ''),
      extraHTML: '<div class="qt-lang" id="langPills"></div>',
      btnText: '시작하기',
      onStart: start
    });
    mountLangPills();
  }

  /* ── 입력 이벤트 (한글 IME 대응: input 값 기준 비교) ── */
  input.addEventListener('compositionstart', function () {
    state.composing = true;
  });
  input.addEventListener('compositionend', function () {
    state.composing = false;
    // 조합 확정된 글자를 즉시 최종 판정
    evaluate(input.value, false);
  });
  input.addEventListener('input', function (e) {
    evaluate(input.value, e.isComposing || state.composing);
  });
  input.addEventListener('paste', function (e) { e.preventDefault(); });

  // 플레이 중 포커스를 잃으면 되돌린다 (일시정지 제외)
  input.addEventListener('blur', function () {
    if (!state.playing || state.advancing || Arcade.pause.active) return;
    Arcade.schedule(function () {
      if (state.playing && !Arcade.pause.active && !input.disabled) input.focus();
    }, 60);
  });

  showStart();
})();
