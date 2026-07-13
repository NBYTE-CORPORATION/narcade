/* ── game21.js — 에임 트레이너 ── */
'use strict';

Arcade.init({ id: 'game21', title: '에임 트레이너', emoji: '🎯', accent: 'pink' });

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const scoreEl = document.getElementById('scoreEl');
const timerEl = document.getElementById('timerEl');
const comboEl = document.getElementById('comboEl');
const accEl = document.getElementById('accEl');

const ov = Arcade.overlay('#overlay');
const fit = Arcade.fitCanvas(canvas, { padding: 28, paddingV: 210 });

/* ── 설정 ── */
const COARSE = Arcade.touch.isCoarse();
const SIZE_MUL = COARSE ? 1.4 : 1;      // 터치 기기: 타깃 확대
const MAX_TARGETS = COARSE ? 3 : 4;     // 터치 기기: 동시 타깃 축소
const TARGET_LIFETIME = 1800;           // ms
const POP_IN = 160;                     // 등장 애니메이션 ms
const FADE_OUT = 300;                   // 만료 페이드 ms
const MIN_R = 14 * SIZE_MUL, MAX_R = 36 * SIZE_MUL;
const MARGIN = 30;
const GAME_DURATION = 30000;

/* ── 상태 ── */
let targets = [];       // {x, y, r, born}
let dying = [];         // 만료된 타깃 페이드용 {x, y, r, at}
let popups = [];        // 점수 팝업
let rings = [];         // 히트 링 버스트
const particles = new Arcade.Particles(ctx);

let running = false;
let score = 0, combo = 0, maxCombo = 0, hits = 0, totalClicks = 0;
let reactionTimes = [];
let animId = 0;
let lastTickSec = -1;
let pausedAt = 0;

/* ── 타이머 (Esc/탭 전환 자동 일시정지) ── */
const timer = new Arcade.Timer({
  duration: GAME_DURATION,
  onTick: function (left) {
    const sec = Math.ceil(left / 1000);
    if (sec !== lastTickSec) {
      lastTickSec = sec;
      timerEl.textContent = sec;
      timerEl.classList.toggle('urgent', sec <= 5);
      if (sec <= 5 && sec >= 1) Arcade.audio.play('tick');
    }
  },
  onEnd: function () { endGame(); }
});

/* 일시정지 동안 타깃 수명(born 타임스탬프)도 함께 멈추도록 보정 */
Arcade.pause.register({
  isActive: function () { return running; },
  onPause: function () { pausedAt = performance.now(); },
  onResume: function () {
    const d = performance.now() - pausedAt;
    targets.forEach(function (t) { t.born += d; });
    dying.forEach(function (t) { t.at += d; });
  }
});

/* ── 타깃 ── */
function spawnTarget() {
  if (targets.length >= MAX_TARGETS) return;
  const r = MIN_R + Math.random() * (MAX_R - MIN_R);
  const x = MARGIN + r + Math.random() * (W - 2 * (MARGIN + r));
  const y = MARGIN + r + Math.random() * (H - 2 * (MARGIN + r));
  targets.push({ x: x, y: y, r: r, born: performance.now() });
  Arcade.audio.tone(480, 45, { type: 'sine', gain: 0.04, endFreq: 840 }); // 은은한 pop
}

/* ── 이펙트 ── */
function addPopup(x, y, text, color) {
  popups.push({ x: x, y: y, text: text, color: color, vy: -1.5, life: 1, decay: 0.04 });
}

function addRing(x, y, r) {
  rings.push({ x: x, y: y, r: r * 0.7, max: r * 2.3, life: 1 });
}

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/* ── 렌더링 ── */
function draw() {
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);

  /* 배경 그리드 */
  ctx.strokeStyle = 'rgba(236,72,153,0.05)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 50) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 50) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

  const now = performance.now();

  /* 만료 페이드 (미스 틴트) */
  dying = dying.filter(function (t) {
    const f = (now - t.at) / FADE_OUT;
    if (f >= 1) return false;
    ctx.save();
    ctx.globalAlpha = (1 - f) * 0.5;
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = 'rgba(239,68,68,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r * (1 + f * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return true;
  });

  /* 타깃 */
  targets.forEach(function (t) {
    const age = now - t.born;
    const frac = age / TARGET_LIFETIME;                     // 0→1
    const popScale = age < POP_IN ? easeOutBack(Math.min(1, age / POP_IN)) : 1;
    const alpha = Math.min(1, (1 - frac) * 2 + 0.1);
    const pulsed = t.r * popScale * (1 + Math.sin(age * 0.007) * 0.06);

    /* 남은 시간 링 */
    if (age >= POP_IN) {
      ctx.save();
      ctx.globalAlpha = 0.35 * (1 - frac);
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - frac));
      ctx.stroke();
      ctx.restore();
    }

    /* outer ring */
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.shadowBlur = 20; ctx.shadowColor = '#06b6d4';
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, pulsed + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    /* main circle */
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 14; ctx.shadowColor = '#06b6d4';
    const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, Math.max(1, pulsed));
    g.addColorStop(0, '#fff');
    g.addColorStop(0.3, '#67e8f9');
    g.addColorStop(0.7, '#06b6d4');
    g.addColorStop(1, '#0e7490');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(t.x, t.y, Math.max(1, pulsed), 0, Math.PI * 2);
    ctx.fill();

    /* crosshair */
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    const cl = pulsed * 0.4;
    ctx.beginPath(); ctx.moveTo(t.x - cl, t.y); ctx.lineTo(t.x + cl, t.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(t.x, t.y - cl); ctx.lineTo(t.x, t.y + cl); ctx.stroke();
    ctx.restore();
  });

  /* 히트 링 버스트 */
  rings = rings.filter(function (r) {
    r.r += (r.max - r.r) * 0.22;
    r.life -= 0.06;
    if (r.life <= 0) return false;
    ctx.save();
    ctx.globalAlpha = r.life * 0.8;
    ctx.strokeStyle = '#f9a8d4';
    ctx.shadowBlur = 12; ctx.shadowColor = '#ec4899';
    ctx.lineWidth = 3 * r.life;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return true;
  });

  /* 파티클 */
  particles.update();
  particles.draw();

  /* 점수 팝업 */
  popups = popups.filter(function (p) {
    p.y += p.vy; p.life -= p.decay;
    if (p.life <= 0) return false;
    ctx.globalAlpha = p.life;
    ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = p.color; ctx.shadowBlur = 6; ctx.shadowColor = p.color;
    ctx.fillText(p.text, p.x, p.y);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    return true;
  });
}

/* ── 게임 루프 ── */
function loop() {
  if (!running) return;
  animId = requestAnimationFrame(loop);
  if (Arcade.pause.active) return; // 일시정지: 스폰/수명/렌더 모두 정지

  const now = performance.now();

  /* 만료 타깃 → 미스 */
  targets = targets.filter(function (t) {
    if (now - t.born > TARGET_LIFETIME) {
      dying.push({ x: t.x, y: t.y, r: t.r, at: now });
      breakCombo();
      Arcade.audio.play('hit');
      return false;
    }
    return true;
  });

  /* 스폰: 빈 화면이면 즉시, 아니면 확률 스폰 */
  if (targets.length === 0 || (Math.random() < 0.045 && targets.length < MAX_TARGETS)) {
    spawnTarget();
  }

  draw();
}

/* ── HUD ── */
function updateAcc() {
  accEl.textContent = totalClicks > 0 ? Math.round((hits / totalClicks) * 100) + '%' : '—';
}

function breakCombo() {
  if (combo > 0) {
    combo = 0;
    comboEl.textContent = '0';
  }
}

/* ── 입력 (pointerdown: 마우스/터치/펜 통합) ── */
canvas.addEventListener('pointerdown', function (e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (!running || Arcade.pause.active) return;
  e.preventDefault();

  const p = fit.toCanvasXY(e);
  totalClicks++;

  let hitTarget = null;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const dx = p.x - t.x, dy = p.y - t.y;
    if (dx * dx + dy * dy <= t.r * t.r) { hitTarget = t; break; }
  }

  if (hitTarget) {
    const t = hitTarget;
    targets.splice(targets.indexOf(t), 1);
    hits++;
    combo++;
    maxCombo = Math.max(maxCombo, combo);

    const rt = performance.now() - t.born;
    reactionTimes.push(rt);

    const speed = Math.max(100, 1000 - rt);
    const sizeBonus = Math.round((1 - (t.r - MIN_R) / (MAX_R - MIN_R)) * 100);
    const pts = Math.round(speed * 0.5 + sizeBonus + combo * 15);
    score += pts;

    scoreEl.textContent = score.toLocaleString();
    comboEl.textContent = combo;

    const label = combo >= 10 ? '🔥 ' + pts : combo >= 5 ? '⚡ ' + pts : '+' + pts;
    const col = combo >= 10 ? '#f59e0b' : combo >= 5 ? '#06b6d4' : '#f9a8d4';
    addPopup(t.x, t.y - t.r - 10, label, col);
    addRing(t.x, t.y, t.r);
    particles.burst(t.x, t.y, {
      count: combo >= 5 ? 18 : 12,
      colors: ['#f9a8d4', '#ec4899', '#67e8f9', '#f59e0b'],
      speed: 4,
      gravity: 0.12
    });

    Arcade.audio.play('coin');
    if (combo % 5 === 0) Arcade.audio.play('combo', { step: combo / 5 });
  } else {
    /* 빈 곳 클릭 → 미스 */
    breakCombo();
    particles.burst(p.x, p.y, { count: 6, colors: ['#64748b'], speed: 2, gravity: 0.1 });
    Arcade.audio.play('hit');
  }

  updateAcc();
});

canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

/* ── 시작 / 종료 ── */
function startGame() {
  cancelAnimationFrame(animId);

  targets = []; dying = []; popups = []; rings = [];
  particles.clear();
  score = 0; combo = 0; maxCombo = 0; hits = 0; totalClicks = 0;
  reactionTimes = [];
  lastTickSec = -1;
  running = true;

  scoreEl.textContent = '0';
  comboEl.textContent = '0';
  accEl.textContent = '—';
  timerEl.textContent = '30';
  timerEl.classList.remove('urgent');

  for (let i = 0; i < 2; i++) spawnTarget();

  timer.start();
  animId = requestAnimationFrame(loop);
}

function rtGraphHTML() {
  const last = reactionTimes.slice(-10);
  if (!last.length) return '';
  const max = Math.max.apply(null, last);
  const min = Math.min.apply(null, last);
  let html = '<div class="rt-graph"><div class="rt-title">최근 반응속도 (ms)</div><div class="rt-bars">';
  let fastMarked = false;
  last.forEach(function (ms) {
    const h = Math.max(10, Math.round((ms / max) * 100));
    const isFast = !fastMarked && ms === min;
    if (isFast) fastMarked = true;
    html += '<div class="rt-bar' + (isFast ? ' fast' : '') + '" style="height:' + h + '%">' +
      '<span>' + Math.round(ms) + '</span></div>';
  });
  html += '</div></div>';
  return html;
}

function endGame() {
  running = false;
  timer.stop();
  cancelAnimationFrame(animId);
  draw();

  Arcade.audio.play('win');

  const acc = totalClicks > 0 ? Math.round((hits / totalClicks) * 100) : 0;
  const avg = reactionTimes.length
    ? Math.round(reactionTimes.reduce(function (a, b) { return a + b; }, 0) / reactionTimes.length)
    : 0;
  const res = Arcade.best.submit('game21', score);

  ov.show({
    emoji: res.isRecord ? '🏆' : '🎯',
    title: '게임 종료!',
    isRecord: res.isRecord,
    stats: [
      { label: '점수', value: score.toLocaleString() },
      { label: '명중률', value: acc + '%' },
      { label: '평균 반응', value: avg ? avg + 'ms' : '—' },
      { label: '최대 콤보', value: maxCombo }
    ],
    extraHTML: rtGraphHTML(),
    btnText: '다시하기',
    onStart: startGame
  });
}

function showStart() {
  const b = Arcade.best.score('game21');
  ov.show({
    emoji: '🎯',
    title: '에임 트레이너',
    msg: '나타나는 타깃을 빠르고 정확하게!\n30초 동안 최고 점수에 도전하세요.\n빗나가거나 타깃을 놓치면 콤보가 끊깁니다.',
    stats: b !== null ? [{ label: '최고 기록', value: b.toLocaleString() }] : [],
    btnText: '시작하기',
    onStart: startGame
  });
}

draw();
showStart();
