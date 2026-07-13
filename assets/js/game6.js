/* ============================================
   game6 — 반응속도 테스트 (5회 세션)
   Arcade 공통 런타임 사용
   ============================================ */
'use strict';

Arcade.init({ id: 'game6', title: '반응속도 테스트', emoji: '⚡', accent: 'cyan' });

(function () {
  var TRIALS = 5;

  var arena = document.getElementById('arena');
  var arenaEmoji = document.getElementById('arenaEmoji');
  var arenaText = document.getElementById('arenaText');
  var arenaSub = document.getElementById('arenaSub');
  var trialNum = document.getElementById('trialNum');
  var chipsEl = document.getElementById('trialChips');
  var overlay = Arcade.overlay('#overlay');

  /* 상태: idle | waiting(빨강, 대기) | ready(초록, 측정 중) | between(트라이얼 사이) | suspended(탭 이탈) */
  var state = 'idle';
  var times = [];
  var greenAt = 0;
  var waitTid = 0;
  var nextTid = 0;

  function clearTimers() {
    clearTimeout(waitTid);
    clearTimeout(nextTid);
  }

  function setArena(cls, emoji, text, sub) {
    arena.className = 'rt-arena' + (cls ? ' ' + cls : '');
    arenaEmoji.textContent = emoji;
    arenaText.textContent = text;
    arenaSub.textContent = sub;
  }

  function renderHud() {
    trialNum.textContent = Math.min(times.length + 1, TRIALS);
    var html = '';
    for (var i = 0; i < TRIALS; i++) {
      if (i < times.length) {
        html += '<span class="rt-chip done">' + times[i] + 'ms</span>';
      } else {
        html += '<span class="rt-chip' + (i === times.length && state !== 'idle' ? ' current' : '') + '">—</span>';
      }
    }
    chipsEl.innerHTML = html;
  }

  /* ── 트라이얼 진행 ── */
  function armTrial() {
    clearTimers();
    state = 'waiting';
    renderHud();
    setArena('waiting', '✋', '대기…', '초록색이 되면 터치!');
    waitTid = setTimeout(function () {
      state = 'ready';
      greenAt = performance.now();
      setArena('ready', '⚡', '지금!', '최대한 빨리 터치하세요');
      Arcade.audio.play('tick');
    }, Arcade.rand(800, 2500));
  }

  function falseStart() {
    clearTimers();
    state = 'between';
    Arcade.audio.play('hit');
    setArena('false-start', '⚠️', '너무 빨라요!', '초록색이 될 때까지 기다리세요 — 다시 시도합니다');
    nextTid = setTimeout(armTrial, 950);
  }

  function validTap() {
    var ms = Math.max(1, Math.round(performance.now() - greenAt));
    state = 'between';
    times.push(ms);
    Arcade.audio.play('pop');
    setArena('result', '✅', ms + 'ms', times.length + '번째 측정 완료');
    renderHud();
    nextTid = setTimeout(times.length >= TRIALS ? finishSession : armTrial, 950);
  }

  function onArenaDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    if (state === 'waiting') falseStart();
    else if (state === 'ready') validTap();
  }

  arena.addEventListener('pointerdown', onArenaDown);
  arena.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* 탭 이탈 시 진행 중 트라이얼 무효화 후 복귀 시 재시작 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (state === 'waiting' || state === 'ready') {
        clearTimers();
        state = 'suspended';
      }
    } else if (state === 'suspended') {
      armTrial();
    }
  });

  /* ── 세션 ── */
  function startSession() {
    clearTimers();
    times = [];
    state = 'between';
    renderHud();
    setArena('', '👆', '준비…', '곧 시작합니다');
    nextTid = setTimeout(armTrial, 700);
  }

  function gradeOf(avg) {
    if (avg < 220) return { emoji: '⚡', label: '초인적' };
    if (avg < 270) return { emoji: '🚀', label: '매우 빠름' };
    if (avg < 320) return { emoji: '👍', label: '빠름' };
    if (avg < 400) return { emoji: '🙂', label: '보통' };
    return { emoji: '🐢', label: '느긋함' };
  }

  function graphHTML(list) {
    var max = Math.max.apply(null, list);
    var min = Math.min.apply(null, list);
    var bestDone = false;
    var html = '<div class="rt-graph">';
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var pct = Math.max(12, Math.round(t / max * 100));
      var isBest = !bestDone && t === min;
      if (isBest) bestDone = true;
      html += '<div class="rt-bar-col">' +
        '<span class="rt-bar-val">' + t + '</span>' +
        '<div class="rt-bar-track"><div class="rt-bar' + (isBest ? ' best' : '') +
        '" style="height:' + pct + '%"></div></div>' +
        '<span class="rt-bar-idx">' + (i + 1) + '회</span></div>';
    }
    return html + '</div>';
  }

  function finishSession() {
    clearTimers();
    state = 'idle';
    var sum = 0;
    var min = Infinity;
    var max = 0;
    for (var i = 0; i < times.length; i++) {
      sum += times[i];
      if (times[i] < min) min = times[i];
      if (times[i] > max) max = times[i];
    }
    var avg = Math.round(sum / times.length);
    var grade = gradeOf(avg);
    var result = Arcade.best.submit('game6', avg, { lowerIsBetter: true });

    if (result.isRecord) {
      Arcade.audio.play('coin');
      setTimeout(function () { Arcade.audio.play('win'); }, 250);
      Arcade.Particles.domBurst(arena, { count: 22 });
    } else {
      Arcade.audio.play('win');
    }

    setArena('result', grade.emoji, avg + 'ms', '평균 반응속도 — ' + grade.label);
    renderHud();

    overlay.show({
      emoji: grade.emoji,
      title: grade.label,
      isRecord: result.isRecord,
      msg: '5회 측정 결과입니다.',
      stats: [
        { label: '평균', value: avg + 'ms' },
        { label: '최고', value: min + 'ms' },
        { label: '최악', value: max + 'ms' }
      ],
      extraHTML: graphHTML(times),
      btnText: '다시하기',
      onStart: startSession
    });
  }

  /* ── 시작 화면 ── */
  function showStart() {
    var best = Arcade.best.get('game6');
    var bestScore = (best && typeof best === 'object') ? best.score : best;
    var bestLine = (typeof bestScore === 'number' && isFinite(bestScore))
      ? '\n\n🏆 최고 기록(평균): ' + Math.round(bestScore) + 'ms'
      : '';
    overlay.show({
      emoji: '⚡',
      title: '반응속도 테스트',
      msg: '화면이 초록색으로 바뀌는 순간\n최대한 빨리 터치하세요!\n\n총 5회 측정한 평균으로 등급이 결정됩니다.\n너무 빨리 누르면 그 회차는 다시 측정해요.' + bestLine,
      btnText: '시작하기',
      onStart: startSession
    });
  }

  renderHud();
  showStart();
})();
