/* ============================================
   기억력 게임 (game3) — 라운드제 숫자 기억
   라운드 1 = 3자리, 라운드마다 +1자리. 목숨 3개.
   ============================================ */
(function () {
  'use strict';

  Arcade.init({ id: 'game3', title: '기억력 게임', emoji: '🧠', accent: 'amber' });

  var els = {
    round: document.getElementById('roundVal'),
    lives: document.getElementById('livesVal'),
    best: document.getElementById('bestVal'),
    status: document.getElementById('status'),
    stage: document.getElementById('stage'),
    digitRow: document.getElementById('digitRow'),
    slotRow: document.getElementById('slotRow'),
    compare: document.getElementById('compare'),
    keypad: document.getElementById('keypad')
  };

  var overlay = Arcade.overlay('#overlay');

  var MAX_LIVES = 3;
  var CONFETTI_MIN_DIGITS = 8;

  var state = {
    phase: 'idle',   // idle | show | input | check
    round: 1,
    lives: MAX_LIVES,
    target: '',
    input: '',
    playing: false
  };

  /* ── 일시정지 인지 스케줄 관리 ── */
  var scheds = [];
  function later(fn, ms) {
    var s = Arcade.schedule(fn, ms);
    scheds.push(s);
    if (scheds.length > 64) scheds = scheds.filter(function (x) { return !x.done; });
    return s;
  }
  function clearScheds() {
    scheds.forEach(function (s) { s.cancel(); });
    scheds = [];
  }

  Arcade.pause.register({
    isActive: function () { return state.playing; }
  });

  /* ── 헬퍼 ── */
  function digitsFor() { return state.round + 2; } // 라운드 1 = 3자리
  function makeNumber(len) {
    var s = '';
    for (var i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function setStatus(text, tone) {
    els.status.textContent = text;
    els.status.className = 'status' + (tone ? ' ' + tone : '');
  }

  function updateHud() {
    els.round.textContent = state.round;
    var hearts = '';
    for (var i = 0; i < MAX_LIVES; i++) hearts += i < state.lives ? '❤️' : '🖤';
    els.lives.textContent = hearts;
    var b = Arcade.best.score('game3');
    els.best.textContent = b === null ? '-' : b + '자리';
  }

  /* ── 렌더 ── */
  function buildDigits(str) {
    var html = '';
    for (var i = 0; i < str.length; i++) {
      html += '<div class="digit-cell">' + str[i] + '</div>';
    }
    els.digitRow.innerHTML = html;
  }

  function renderSlots() {
    var html = '';
    for (var i = 0; i < state.target.length; i++) {
      var ch = state.input.charAt(i);
      var cls = 'slot';
      if (ch !== '') cls += ' filled';
      else if (i === state.input.length && state.phase === 'input') cls += ' next';
      html += '<div class="' + cls + '">' + ch + '</div>';
    }
    els.slotRow.innerHTML = html;
  }

  function digitSpans(str, marks) {
    var html = '';
    for (var i = 0; i < str.length; i++) {
      html += '<span' + (marks && marks[i] ? ' class="bad"' : '') + '>' + str[i] + '</span>';
    }
    return html;
  }

  function showCompare() {
    var marks = [];
    for (var i = 0; i < state.target.length; i++) {
      marks[i] = state.input.charAt(i) !== state.target.charAt(i);
    }
    els.compare.innerHTML =
      '<div class="cmp-row answer"><span class="cmp-lbl">정답</span>' +
      '<div class="cmp-digits">' + digitSpans(state.target) + '</div></div>' +
      '<div class="cmp-row yours"><span class="cmp-lbl">입력</span>' +
      '<div class="cmp-digits">' + digitSpans(state.input, marks) + '</div></div>';
    els.slotRow.hidden = true;
    els.digitRow.hidden = true;
    els.compare.hidden = false;
  }

  /* ── 라운드 진행 ── */
  function startRound() {
    var len = digitsFor();
    state.target = makeNumber(len);
    state.input = '';
    state.phase = 'show';

    els.keypad.classList.add('locked');
    els.compare.hidden = true;
    els.slotRow.hidden = true;
    els.slotRow.classList.remove('good', 'shake');
    els.digitRow.hidden = false;
    updateHud();
    setStatus('잘 보세요!');
    buildDigits(state.target);

    var cells = els.digitRow.children;
    for (var i = 0; i < cells.length; i++) {
      (function (cell, idx) {
        later(function () {
          cell.classList.add('on');
          Arcade.audio.play('pop');
        }, 260 + 130 * idx);
      })(cells[i], i);
    }

    // 표시 시간: 700ms + 320ms × 자릿수
    later(beginInput, 700 + 320 * len);
  }

  function beginInput() {
    state.phase = 'input';
    els.digitRow.hidden = true;
    els.slotRow.hidden = false;
    els.keypad.classList.remove('locked');
    setStatus('입력하세요!');
    renderSlots();
  }

  function submit() {
    if (state.input.length < state.target.length) {
      setStatus('모든 칸을 채워주세요!', 'warn');
      els.slotRow.classList.remove('shake');
      void els.slotRow.offsetWidth; // 애니메이션 재시작
      els.slotRow.classList.add('shake');
      return;
    }
    state.phase = 'check';
    els.keypad.classList.add('locked');
    if (state.input === state.target) roundClear();
    else roundFail();
  }

  function roundClear() {
    var len = state.target.length;
    Arcade.audio.play('coin');
    setStatus('정답! 🎉', 'success');
    els.slotRow.classList.add('good');
    if (len >= CONFETTI_MIN_DIGITS) {
      Arcade.Particles.domBurst(els.stage, { count: 26 });
    }
    later(function () {
      state.round++;
      startRound();
    }, 1000);
  }

  function roundFail() {
    state.lives--;
    Arcade.audio.play('hit');
    updateHud();
    showCompare();
    if (state.lives <= 0) {
      setStatus('틀렸어요… 게임 오버', 'danger');
      later(gameOver, 1900);
    } else {
      setStatus('틀렸어요! 새 숫자로 다시 도전!', 'danger');
      later(startRound, 2400); // 같은 라운드, 새 숫자
    }
  }

  function gameOver() {
    state.playing = false;
    state.phase = 'idle';
    var reached = digitsFor();
    var res = Arcade.best.submit('game3', reached);
    Arcade.audio.play(res.isRecord ? 'win' : 'lose');
    updateHud();
    overlay.show({
      emoji: res.isRecord ? '🏆' : '🧠',
      title: '게임 오버',
      msg: reached + '자리 숫자까지 도전했어요!',
      stats: [
        { label: '도달 자릿수', value: reached },
        { label: '라운드 수', value: state.round }
      ],
      isRecord: res.isRecord,
      btnText: '다시하기',
      onStart: startGame
    });
  }

  function startGame() {
    clearScheds();
    state.round = 1;
    state.lives = MAX_LIVES;
    state.playing = true;
    startRound();
  }

  /* ── 입력 처리 ── */
  function press(key) {
    if (!state.playing || state.phase !== 'input' || Arcade.pause.active) return;
    if (key === 'ok') {
      Arcade.audio.play('click');
      submit();
      return;
    }
    if (key === 'back') {
      if (state.input.length > 0) {
        state.input = state.input.slice(0, -1);
        Arcade.audio.play('click');
        renderSlots();
      }
      return;
    }
    if (state.input.length >= state.target.length) return;
    state.input += key;
    Arcade.audio.play('click');
    renderSlots();
  }

  // 화면 키패드 (모바일에서 네이티브 키보드 없이 입력)
  els.keypad.addEventListener('pointerdown', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-key]') : null;
    if (!btn) return;
    e.preventDefault();
    btn.classList.add('pressed');
    setTimeout(function () { btn.classList.remove('pressed'); }, 130);
    press(btn.dataset.key);
  });
  els.keypad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // 물리 키보드
  window.addEventListener('keydown', function (e) {
    if (!state.playing || Arcade.pause.active) return;
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

  /* ── 부트 ── */
  updateHud();
  overlay.show({
    emoji: '🧠',
    title: '기억력 게임',
    msg: '화면에 나타나는 숫자를 순서대로 기억하세요.\n라운드 1은 3자리, 라운드마다 한 자리씩 늘어나요.\n틀리면 목숨이 하나 줄고 같은 자릿수의 새 숫자로 재도전!\n기회는 3번입니다.',
    btnText: '시작하기',
    onStart: startGame
  });
})();
