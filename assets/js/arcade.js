/* ============================================================
   나케이드 공통 런타임 — window.Arcade
   모든 게임 페이지에서 gameN.js보다 먼저 로드한다.
   의존성 없음, 빌드 없음. localStorage 불가 환경에서도 동작.
   ============================================================ */
(function () {
  'use strict';

  var NS = 'narcade:';

  /* ── ctx.roundRect 폴리필 (구형 Safari) ── */
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      else if (Array.isArray(r)) {
        if (r.length === 1) r = [r[0], r[0], r[0], r[0]];
        else if (r.length === 2) r = [r[0], r[1], r[0], r[1]];
      } else r = [0, 0, 0, 0];
      this.moveTo(x + r[0], y);
      this.lineTo(x + w - r[1], y);
      this.arcTo(x + w, y, x + w, y + r[1], r[1]);
      this.lineTo(x + w, y + h - r[2]);
      this.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
      this.lineTo(x + r[3], y + h);
      this.arcTo(x, y + h, x, y + h - r[3], r[3]);
      this.lineTo(x, y + r[0]);
      this.arcTo(x, y, x + r[0], y, r[0]);
      this.closePath();
      return this;
    };
  }

  /* ══════════════════════════ store ══════════════════════════ */
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(NS + key);
        if (raw === null) return fallback !== undefined ? fallback : null;
        try { return JSON.parse(raw); } catch (e) { return raw; }
      } catch (e) { return fallback !== undefined ? fallback : null; }
    },
    set: function (key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch (e) {}
    },
    remove: function (key) {
      try { localStorage.removeItem(NS + key); } catch (e) {}
    }
  };

  /* ══════════════════════════ best (최고기록) ══════════════════════════ */
  function bestKey(gameId, suffix) {
    return 'best:' + gameId + (suffix ? ':' + suffix : '');
  }
  function scoreOf(v) {
    if (v && typeof v === 'object') return typeof v.score === 'number' ? v.score : NaN;
    return typeof v === 'number' ? v : NaN;
  }
  var best = {
    get: function (gameId, opts) {
      opts = opts || {};
      return store.get(bestKey(gameId, opts.suffix), null);
    },
    /** 숫자 점수만 필요할 때: number | null (객체 저장분은 .score 추출) */
    score: function (gameId, opts) {
      var v = this.get(gameId, opts);
      var s = scoreOf(v);
      return isNaN(s) ? null : s;
    },
    /** submit(gameId, score, {suffix, lowerIsBetter, meta}) -> {best, isRecord} */
    submit: function (gameId, score, opts) {
      opts = opts || {};
      var key = bestKey(gameId, opts.suffix);
      var prev = store.get(key, null);
      var prevScore = scoreOf(prev);
      var isRecord = isNaN(prevScore) ||
        (opts.lowerIsBetter ? score < prevScore : score > prevScore);
      if (isRecord) {
        store.set(key, opts.meta ? Object.assign({ score: score }, opts.meta) : score);
      }
      var cur = store.get(key, null);
      return { best: cur, isRecord: isRecord };
    }
  };

  /* ── 레거시 localStorage 키 마이그레이션 ──
     구버전 게임들이 쓰던 키를 narcade:best:* 로 복사 후 삭제.
     접미사형 키(ms_best_easy 등)는 prefix 스캔으로 처리. */
  var LEGACY_PLAIN = {
    'snake_best': 'best:game11',
    '2048_best': 'best:game12',
    'tetris_best': 'best:game14',
    'breakout_best': 'best:game15',
    'shooter_best': 'best:game16',
    'rhythm_best': 'best:game18',
    'runner_best': 'best:game20',
    'aim_best': 'best:game21',
    'pinball_best': 'best:game24',
    'fruitbox_best': 'best:game28'
  };
  var LEGACY_PREFIX = [
    { prefix: 'ms_best_', target: 'best:game17:' },
    { prefix: 'memory_best_', target: 'best:game19:' },
    { prefix: 'slide_best_', target: 'best:game22:' }
  ];
  function migrateLegacy() {
    try {
      if (localStorage.getItem(NS + 'migrated')) return;
      var moves = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        if (LEGACY_PLAIN[k]) moves.push([k, LEGACY_PLAIN[k]]);
        else {
          for (var j = 0; j < LEGACY_PREFIX.length; j++) {
            var p = LEGACY_PREFIX[j];
            if (k.indexOf(p.prefix) === 0) moves.push([k, p.target + k.slice(p.prefix.length)]);
          }
        }
      }
      moves.forEach(function (m) {
        var raw = localStorage.getItem(m[0]);
        if (raw === null) return;
        var val;
        try { val = JSON.parse(raw); } catch (e) { val = raw; }
        if (typeof val === 'string' && val !== '' && !isNaN(+val)) val = +val;
        if (localStorage.getItem(NS + m[1]) === null) {
          localStorage.setItem(NS + m[1], JSON.stringify(val));
        }
        localStorage.removeItem(m[0]);
      });
      localStorage.setItem(NS + 'migrated', '1');
    } catch (e) {}
  }

  /* ══════════════════════════ audio ══════════════════════════ */
  var audio = (function () {
    var ctx = null;
    var master = null;
    var noiseBuf = null;
    var muted = store.get('muted', false) === true;

    function ensureCtx() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume().catch(function () {});
        return ctx;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }

    // 첫 사용자 제스처에서 컨텍스트 준비 (autoplay 정책)
    function unlock() { ensureCtx(); }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, unlock, { once: true, passive: true });
    });

    function getNoise() {
      if (!ctx) return null;
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return noiseBuf;
    }

    /** 단일 톤. opts: {type, gain, endFreq(스윕), delay} */
    function tone(freq, durMs, opts) {
      if (muted || !ensureCtx()) return;
      opts = opts || {};
      var t0 = ctx.currentTime + (opts.delay || 0) / 1000;
      var dur = (durMs || 100) / 1000;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = opts.type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), t0 + dur);
      var vol = opts.gain !== undefined ? opts.gain : 0.15;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    }

    function noise(durMs, opts) {
      if (muted || !ensureCtx()) return;
      opts = opts || {};
      var t0 = ctx.currentTime + (opts.delay || 0) / 1000;
      var dur = (durMs || 200) / 1000;
      var src = ctx.createBufferSource();
      src.buffer = getNoise();
      src.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(opts.freq || 1200, t0);
      if (opts.endFreq) f.frequency.exponentialRampToValueAtTime(Math.max(10, opts.endFreq), t0 + dur);
      var g = ctx.createGain();
      var vol = opts.gain !== undefined ? opts.gain : 0.25;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    }

    var PRESETS = {
      click:     function () { tone(660, 50, { type: 'square', gain: 0.08 }); },
      hit:       function () { tone(220, 70, { type: 'square', gain: 0.12, endFreq: 110 }); },
      coin:      function () { tone(988, 70, { type: 'sine', gain: 0.12 }); tone(1319, 180, { type: 'sine', gain: 0.12, delay: 70 }); },
      explosion: function () { noise(350, { freq: 900, endFreq: 60, gain: 0.35 }); tone(90, 250, { type: 'triangle', gain: 0.2, endFreq: 30 }); },
      win:       function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 140, { type: 'triangle', gain: 0.14, delay: i * 110 }); }); },
      lose:      function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 180, { type: 'sawtooth', gain: 0.1, delay: i * 130 }); }); },
      combo:     function (opts) { var step = (opts && opts.step) || 0; tone(440 * Math.pow(2, Math.min(step, 24) / 12), 80, { type: 'square', gain: 0.1 }); },
      tick:      function () { tone(1000, 30, { type: 'sine', gain: 0.05 }); },
      powerup:   function () { tone(300, 250, { type: 'sawtooth', gain: 0.12, endFreq: 1200 }); },
      pop:       function () { tone(500, 40, { type: 'sine', gain: 0.1, endFreq: 900 }); },
      whoosh:    function () { noise(180, { freq: 2500, endFreq: 300, gain: 0.12 }); }
    };

    function updateToggleBtns() {
      var btns = document.querySelectorAll('.sound-toggle');
      for (var i = 0; i < btns.length; i++) {
        btns[i].textContent = muted ? '🔇' : '🔊';
        btns[i].setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
      }
    }

    return {
      play: function (name, opts) { if (PRESETS[name]) PRESETS[name](opts); },
      tone: tone,
      noise: noise,
      get muted() { return muted; },
      setMuted: function (m) { muted = !!m; store.set('muted', muted); updateToggleBtns(); },
      toggleMute: function () { this.setMuted(!muted); return muted; },
      _updateToggleBtns: updateToggleBtns
    };
  })();

  /* ══════════════════════════ pause ══════════════════════════ */
  var pauseHub = (function () {
    var handlers = [];   // {onPause, onResume, isActive}
    var timers = [];     // 실행 중 Timer 자동 일시정지용
    var active = false;
    var overlayEl = null;

    function anyActive() {
      if (!handlers.length) return false;
      for (var i = 0; i < handlers.length; i++) {
        var h = handlers[i];
        if (!h.isActive || h.isActive()) return true;
      }
      return false;
    }

    function ensureOverlay() {
      if (overlayEl) return overlayEl;
      overlayEl = document.createElement('div');
      overlayEl.className = 'pause-overlay';
      overlayEl.innerHTML =
        '<div class="pause-inner"><div class="pause-icon">⏸️</div>' +
        '<h2>일시정지</h2><p>Esc 키 또는 버튼으로 계속하기</p>' +
        '<button type="button" class="pause-resume">계속하기</button></div>';
      overlayEl.querySelector('.pause-resume').addEventListener('click', function () {
        audio.play('click');
        api.resume();
      });
      document.body.appendChild(overlayEl);
      return overlayEl;
    }

    var scheduled = []; // 일시정지 인지 setTimeout: {fn, remaining, startedAt, tid, done}

    var api = {
      get active() { return active; },
      register: function (opts) {
        handlers.push(opts || {});
      },
      _bindTimer: function (t) {
        if (timers.length > 32) timers = timers.filter(function (x) { return !x._disposed; });
        timers.push(t);
      },
      _bindSched: function (s) {
        if (scheduled.length > 64) scheduled = scheduled.filter(function (x) { return !x.done; });
        scheduled.push(s);
      },
      pause: function () {
        if (active || !anyActive()) return;
        active = true;
        ensureOverlay().classList.add('show');
        handlers.forEach(function (h) { if (h.onPause) h.onPause(); });
        timers.forEach(function (t) { if (t._running && !t._paused) { t.pause(); t._autoPaused = true; } });
        scheduled.forEach(function (s) {
          if (s.done) return;
          clearTimeout(s.tid);
          s.remaining -= performance.now() - s.startedAt;
        });
      },
      resume: function () {
        if (!active) return;
        active = false;
        if (overlayEl) overlayEl.classList.remove('show');
        timers.forEach(function (t) { if (t._autoPaused) { t.resume(); t._autoPaused = false; } });
        scheduled.forEach(function (s) {
          if (s.done) return;
          s.startedAt = performance.now();
          s.tid = setTimeout(s.fire, Math.max(0, s.remaining));
        });
        handlers.forEach(function (h) { if (h.onResume) h.onResume(); });
      },
      toggle: function () { active ? this.resume() : this.pause(); }
    };

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && handlers.length) {
        e.preventDefault();
        api.toggle();
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) api.pause();
    });

    return api;
  })();

  /* ══════════════════════════ Timer ══════════════════════════ */
  /** new Arcade.Timer({duration, onTick, onEnd})  — duration(ms) 있으면 카운트다운, 없으면 스톱워치.
      onTick(countdown: 남은 ms / stopwatch: 경과 ms) 매 프레임 호출. */
  function Timer(opts) {
    opts = opts || {};
    this.duration = opts.duration || 0;
    this.onTick = opts.onTick || null;
    this.onEnd = opts.onEnd || null;
    this._elapsed = 0;
    this._last = 0;
    this._running = false;
    this._paused = false;
    this._raf = 0;
    this._autoPaused = false;
    pauseHub._bindTimer(this);
  }
  Timer.prototype._loop = function () {
    if (!this._running || this._paused) return;
    var now = performance.now();
    this._elapsed += now - this._last;
    this._last = now;
    if (this.duration > 0) {
      var left = Math.max(0, this.duration - this._elapsed);
      if (this.onTick) this.onTick(left);
      if (left <= 0) {
        this._running = false;
        if (this.onEnd) this.onEnd();
        return;
      }
    } else if (this.onTick) {
      this.onTick(this._elapsed);
    }
    var self = this;
    this._raf = requestAnimationFrame(function () { self._loop(); });
  };
  Timer.prototype.start = function () {
    this.stop();
    this._elapsed = 0;
    this._running = true;
    this._paused = false;
    this._last = performance.now();
    this._loop();
    return this;
  };
  Timer.prototype.pause = function () {
    if (!this._running || this._paused) return;
    this._paused = true;
    cancelAnimationFrame(this._raf);
  };
  Timer.prototype.resume = function () {
    if (!this._running || !this._paused) return;
    this._paused = false;
    this._last = performance.now();
    this._loop();
  };
  Timer.prototype.stop = function () {
    this._running = false;
    this._paused = false;
    cancelAnimationFrame(this._raf);
  };
  /** 다시 쓰지 않을 타이머는 dispose — pause 허브에서 정리 대상이 된다 */
  Timer.prototype.dispose = function () {
    this.stop();
    this._disposed = true;
  };
  Object.defineProperty(Timer.prototype, 'elapsed', {
    get: function () { return this._elapsed; }
  });

  /* ── 일시정지 인지 setTimeout ──
     Arcade.schedule(fn, delayMs) → {cancel()}
     Esc/탭 전환 일시정지 시 남은 시간을 보존했다가 재개 후 이어서 실행.
     setTimeout 체인으로 시퀀스를 만드는 게임(사이먼 재생 등)에 사용. */
  function schedule(fn, delay) {
    var item = {
      fn: fn,
      remaining: delay,
      startedAt: performance.now(),
      tid: 0,
      done: false
    };
    item.fire = function () {
      if (item.done) return;
      item.done = true;
      item.fn();
    };
    item.cancel = function () {
      item.done = true;
      clearTimeout(item.tid);
    };
    if (pauseHub.active) {
      // 일시정지 중 예약되면 재개 시점부터 카운트
      item.startedAt = performance.now();
    } else {
      item.tid = setTimeout(item.fire, delay);
    }
    pauseHub._bindSched(item);
    return item;
  }

  /* ══════════════════════════ Particles ══════════════════════════ */
  /** 캔버스용: new Arcade.Particles(ctx) → burst()/update(dt)/draw() */
  function Particles(ctx) {
    this.ctx = ctx;
    this.list = [];
  }
  Particles.prototype.burst = function (x, y, opts) {
    opts = opts || {};
    var count = opts.count || 14;
    var colors = opts.colors || [opts.color || '#a78bfa'];
    var speed = opts.speed || 3.5;
    for (var i = 0; i < count; i++) {
      var a = (opts.angle !== undefined && opts.spread !== undefined)
        ? opts.angle + (Math.random() - 0.5) * opts.spread
        : Math.random() * Math.PI * 2;
      var v = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: opts.size ? opts.size * (0.5 + Math.random()) : 1.5 + Math.random() * 2.5,
        life: 1,
        decay: opts.decay || (0.015 + Math.random() * 0.02),
        gravity: opts.gravity !== undefined ? opts.gravity : 0.08,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  };
  Particles.prototype.update = function (dt) {
    var mul = dt === undefined ? 1 : dt * 60 / 1000;
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.x += p.vx * mul;
      p.y += p.vy * mul;
      p.vy += p.gravity * mul;
      p.life -= p.decay * mul;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  };
  Particles.prototype.draw = function () {
    var c = this.ctx;
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  };
  Particles.prototype.clear = function () { this.list.length = 0; };

  /** DOM 콘페티: 비캔버스 게임용. Arcade.Particles.domBurst(el, {emoji|colors, count}) */
  Particles.domBurst = function (target, opts) {
    opts = opts || {};
    var rect = typeof target.getBoundingClientRect === 'function'
      ? target.getBoundingClientRect()
      : { left: target.x || 0, top: target.y || 0, width: 0, height: 0 };
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var count = opts.count || 12;
    var colors = opts.colors || ['#a78bfa', '#06b6d4', '#ec4899', '#f59e0b'];
    for (var i = 0; i < count; i++) {
      var el = document.createElement('span');
      el.className = 'arcade-confetti';
      if (opts.emoji) {
        el.textContent = opts.emoji;
        el.style.fontSize = (10 + Math.random() * 12) + 'px';
      } else {
        el.style.background = colors[(Math.random() * colors.length) | 0];
        var s = 4 + Math.random() * 6;
        el.style.width = s + 'px';
        el.style.height = s + 'px';
      }
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      var a = Math.random() * Math.PI * 2;
      var d = 40 + Math.random() * 80;
      el.style.setProperty('--cf-x', (Math.cos(a) * d) + 'px');
      el.style.setProperty('--cf-y', (Math.sin(a) * d - 40) + 'px');
      el.style.setProperty('--cf-r', ((Math.random() - 0.5) * 540) + 'deg');
      document.body.appendChild(el);
      el.addEventListener('animationend', function () {
        if (this.parentNode) this.parentNode.removeChild(this);
      });
    }
  };

  /* ══════════════════════════ touch ══════════════════════════ */
  var touch = {
    isCoarse: function () {
      return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    },
    /** swipe(el, dir => {}, {threshold}) — dir: 'left'|'right'|'up'|'down' */
    swipe: function (el, cb, opts) {
      opts = opts || {};
      var th = opts.threshold || 30;
      var sx = 0, sy = 0, tracking = false;
      el.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        tracking = true;
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }, { passive: true });
      el.addEventListener('touchmove', function (e) {
        if (opts.preventScroll !== false) e.preventDefault();
      }, { passive: false });
      el.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var dx = e.changedTouches[0].clientX - sx;
        var dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) < th && Math.abs(dy) < th) return;
        cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      });
    },
    tap: function (el, cb) {
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        cb(e);
      });
    },
    /** hold(el, onHold, onRelease, {delay}) — 롱프레스 */
    hold: function (el, onHold, onRelease, opts) {
      opts = opts || {};
      var delay = opts.delay || 450;
      var tid = 0, held = false;
      el.addEventListener('pointerdown', function (e) {
        held = false;
        tid = setTimeout(function () { held = true; onHold(e); }, delay);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        el.addEventListener(ev, function (e) {
          clearTimeout(tid);
          if (onRelease) onRelease(e, held);
          held = false;
        });
      });
      return { wasHeld: function () { return held; } };
    },
    /** buttons(container, specs) — 가상 게임패드. keydown/keyup 합성으로 기존
        키보드 핸들러를 재사용한다. spec: {id, label, key, code?, wide?}
        container가 null이면 body에 fixed 패드 생성. coarse 포인터에서만 렌더. */
    buttons: function (container, specs, opts) {
      opts = opts || {};
      if (!opts.force && !touch.isCoarse()) return null;
      var pad = document.createElement('div');
      pad.className = 'touch-pad' + (opts.className ? ' ' + opts.className : '');
      specs.forEach(function (spec) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'touch-btn' + (spec.wide ? ' wide' : '');
        b.textContent = spec.label;
        b.dataset.key = spec.key;
        function fire(type) {
          var evInit = {
            key: spec.key,
            code: spec.code || spec.key,
            bubbles: true,
            cancelable: true
          };
          window.dispatchEvent(new KeyboardEvent(type, evInit));
          document.dispatchEvent(new KeyboardEvent(type, evInit));
        }
        b.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          b.classList.add('pressed');
          if (spec.onDown) spec.onDown();
          fire('keydown');
        });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
          b.addEventListener(ev, function () {
            if (!b.classList.contains('pressed')) return;
            b.classList.remove('pressed');
            if (spec.onUp) spec.onUp();
            fire('keyup');
          });
        });
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        pad.appendChild(b);
      });
      (container || document.body).appendChild(pad);
      return pad;
    }
  };

  /* ══════════════════════════ fitCanvas ══════════════════════════ */
  /** 내부 해상도(canvas.width/height)를 유지한 채 CSS로 스케일.
      opts: {maxW, maxH, padding} — 반환: {scale, toCanvasXY(evt)} */
  function fitCanvas(canvas, opts) {
    opts = opts || {};
    var state = { scale: 1 };
    function refit() {
      var aw = canvas.width, ah = canvas.height;
      var maxW = opts.maxW || (window.innerWidth - (opts.padding !== undefined ? opts.padding : 24));
      var maxH = opts.maxH || (window.innerHeight - (opts.paddingV !== undefined ? opts.paddingV : 140));
      var scale = Math.min(maxW / aw, maxH / ah, opts.maxScale || 1);
      if (scale <= 0) scale = 0.1;
      canvas.style.width = Math.round(aw * scale) + 'px';
      canvas.style.height = Math.round(ah * scale) + 'px';
      state.scale = scale;
    }
    state.refit = refit;
    state.toCanvasXY = function (e) {
      var rect = canvas.getBoundingClientRect();
      var cx = (e.touches && e.touches.length ? e.touches[0].clientX
        : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0].clientX : e.clientX));
      var cy = (e.touches && e.touches.length ? e.touches[0].clientY
        : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0].clientY : e.clientY));
      return {
        x: (cx - rect.left) * (canvas.width / rect.width),
        y: (cy - rect.top) * (canvas.height / rect.height)
      };
    };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    refit();
    return state;
  }

  /* ══════════════════════════ overlay ══════════════════════════ */
  var DIFF_LABELS = { easy: '쉬움', normal: '보통', hard: '어려움' };

  function overlay(selector) {
    var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) {
      el = document.createElement('div');
      el.className = 'overlay';
      document.body.appendChild(el);
    }
    el.classList.add('overlay');
    var api = {
      el: el,
      /** show({emoji,title,msg,btnText,onStart,stats:[{label,value}],isRecord,extraHTML}) */
      show: function (o) {
        o = o || {};
        var html = '<div class="overlay-inner">';
        if (o.emoji) html += '<div class="ov-emoji">' + o.emoji + '</div>';
        if (o.title) html += '<h2 class="ov-title">' + o.title + '</h2>';
        if (o.isRecord) html += '<div class="record-badge">🏆 신기록!</div>';
        if (o.msg) html += '<p class="ov-msg">' + o.msg + '</p>';
        if (o.stats && o.stats.length) {
          html += '<div class="ov-stats">';
          o.stats.forEach(function (s) {
            html += '<div class="ov-stat"><span class="ov-stat-val">' + s.value +
              '</span><span class="ov-stat-lbl">' + s.label + '</span></div>';
          });
          html += '</div>';
        }
        if (o.extraHTML) html += o.extraHTML;
        if (o.btnText !== null) {
          html += '<button type="button" class="ov-btn">' + (o.btnText || '시작하기') + '</button>';
        }
        html += '</div>';
        el.innerHTML = html;
        var btn = el.querySelector('.ov-btn');
        if (btn && o.onStart) {
          btn.addEventListener('click', function () {
            audio.play('click');
            api.hide();
            o.onStart();
          });
        }
        el.classList.add('show');
        return api;
      },
      hide: function () { el.classList.remove('show'); return api; }
    };
    return api;
  }

  /* ══════════════════════════ difficulty ══════════════════════════ */
  /** difficulty(containerEl, levels, onChange, {gameId, labels}) → 현재 선택값 반환.
      levels: ['easy','normal','hard'] 혹은 [{id,label}] */
  function difficulty(container, levels, onChange, opts) {
    opts = opts || {};
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    var norm = levels.map(function (l) {
      return typeof l === 'string' ? { id: l, label: DIFF_LABELS[l] || l } : l;
    });
    var saved = opts.gameId ? store.get('diff:' + opts.gameId, null) : null;
    var current = norm.some(function (l) { return l.id === saved; }) ? saved : norm[0].id;
    el.classList.add('diff-pills');
    el.innerHTML = '';
    norm.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'diff-pill' + (l.id === current ? ' active' : '');
      b.textContent = l.label;
      b.dataset.diff = l.id;
      b.addEventListener('click', function () {
        if (current === l.id) return;
        current = l.id;
        var act = el.querySelector('.diff-pill.active');
        if (act) act.classList.remove('active');
        b.classList.add('active');
        if (opts.gameId) store.set('diff:' + opts.gameId, current);
        audio.play('click');
        if (onChange) onChange(current);
      });
      el.appendChild(b);
    });
    return current;
  }

  /* ══════════════════════════ init (페이지 부트) ══════════════════════════ */
  function recordPlay(id) {
    var plays = store.get('plays', {});
    plays[id] = (plays[id] || 0) + 1;
    store.set('plays', plays);
    var recent = store.get('recent', []);
    recent = recent.filter(function (r) { return r.id !== id; });
    recent.unshift({ id: id, at: Date.now() });
    store.set('recent', recent.slice(0, 10));
  }

  function init(opts) {
    opts = opts || {};
    migrateLegacy();

    // 기존 개별 back-btn 제거 후 표준 헤더 주입
    var old = document.querySelector('a.back-btn');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    if (!document.querySelector('.arcade-header')) {
      var header = document.createElement('header');
      header.className = 'arcade-header';
      header.innerHTML =
        '<a href="../index.html" class="back-btn">← 목록</a>' +
        '<div class="header-title">' +
        (opts.emoji ? '<span class="header-emoji">' + opts.emoji + '</span>' : '') +
        '<span class="header-name">' + (opts.title || '') + '</span></div>' +
        '<button type="button" class="sound-toggle" aria-label="소리 끄기">🔊</button>';
      document.body.prepend(header);
      header.querySelector('.sound-toggle').addEventListener('click', function () {
        audio.toggleMute();
        if (!audio.muted) audio.play('click');
      });
      audio._updateToggleBtns();
    }

    if (opts.title) document.title = opts.title + ' — 나케이드';
    if (opts.accent) document.body.dataset.accent = opts.accent;
    if (opts.id) recordPlay(opts.id);
  }

  /* ══════════════════════════ utils ══════════════════════════ */
  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  /** ms → '1:23.4' (분:초.십분의초) 혹은 '23.4초' */
  function fmtTime(ms, opts) {
    opts = opts || {};
    var totalSec = ms / 1000;
    var m = Math.floor(totalSec / 60);
    var s = totalSec - m * 60;
    if (m > 0) return m + ':' + (s < 10 ? '0' : '') + s.toFixed(opts.decimals !== undefined ? opts.decimals : 1);
    return s.toFixed(opts.decimals !== undefined ? opts.decimals : 1) + '초';
  }

  /* ══════════════════════════ export ══════════════════════════ */
  window.Arcade = {
    init: init,
    audio: audio,
    store: store,
    best: best,
    migrateLegacy: migrateLegacy,
    overlay: overlay,
    pause: pauseHub,
    Timer: Timer,
    schedule: schedule,
    Particles: Particles,
    touch: touch,
    fitCanvas: fitCanvas,
    difficulty: difficulty,
    rand: rand,
    clamp: clamp,
    fmtTime: fmtTime
  };
})();
