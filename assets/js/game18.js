/* ── game18.js — 리듬 탭 (비트 싱크 리워크) ── */

Arcade.init({ id: 'game18', title: '리듬 탭', emoji: '🎵', accent: 'pink' });

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const scoreEl = document.getElementById('scoreEl');
const comboEl = document.getElementById('comboEl');
const timerEl = document.getElementById('timerEl');
const overlay = Arcade.overlay('#overlay');

/* ── 레인 설정 ── */
const LANE_W = W / 4;
const HIT_Y  = H - 70;
const HIT_H  = 14;
const NOTE_H = 36;
const HIT_CENTER = HIT_Y + HIT_H / 2;

const LANES = [
  { key: 'KeyD', label: 'D', color: '#06b6d4', glow: 'rgba(6,182,212,0.5)',   freq: 523.25 }, /* C5 */
  { key: 'KeyF', label: 'F', color: '#a78bfa', glow: 'rgba(167,139,250,0.5)', freq: 659.25 }, /* E5 */
  { key: 'KeyJ', label: 'J', color: '#ec4899', glow: 'rgba(236,72,153,0.5)',  freq: 783.99 }, /* G5 */
  { key: 'KeyK', label: 'K', color: '#f59e0b', glow: 'rgba(245,158,11,0.5)',  freq: 987.77 }, /* B5 */
];

/* ── 비트 그리드 ── */
const BPM     = 120;
const BEAT_MS = 60000 / BPM;   // 500ms
const HALF_MS = BEAT_MS / 2;   // 250ms (반박)
const LEAD_MS = 4 * BEAT_MS;   // 4비트 카운트인 (2초)
const PLAY_MS = 60000;         // 실제 플레이 60초
const SONG_MS = LEAD_MS + PLAY_MS;

/* 노트 낙하: 히트라인 도착까지 걸리는 시간 → 위치는 시간에서 역산 */
const APPROACH_MS = 1500;
const PX_PER_MS   = (HIT_CENTER + NOTE_H) / APPROACH_MS;

/* ── 판정 창(ms) ── */
const PERFECT_MS = 60;
const GOOD_MS    = 120;
const TAP_RANGE  = 180; // 이 안에서 GOOD_MS 초과로 치면 MISS(성급/늦은 탭)

/* ── 상태 ── */
let chart = [];         // {time(히트라인 도착 ms), lane, hit, judged}
let particles = [], judgments = [], laneFlash = [0, 0, 0, 0];
let score = 0, combo = 0, maxCombo = 0;
let perfectCount = 0, goodCount = 0, missCount = 0;
let totalNotes = 0;
let running = false;
let animId = 0;

/* ── 곡 시계: 노트/비트 모두 같은 시계에서 파생 → 싱크 보장 ── */
let baseElapsed = 0; // 일시정지까지 누적된 곡 시간
let runStamp = 0;    // 마지막 시작/재개 시점의 performance.now()
function songTime() {
  if (!running) return baseElapsed;
  if (Arcade.pause.active) return baseElapsed;
  return baseElapsed + performance.now() - runStamp;
}

/* ══════════ 차트 생성: 비트 그리드 위에 스냅 ══════════ */
function buildChart() {
  const notes = [];
  const lastTime = SONG_MS - 1000; // 마지막 1초는 여백
  const ticks = Math.floor((lastTime - LEAD_MS) / HALF_MS);
  let lastLane = -1;

  for (let i = 0; i <= ticks; i++) {
    const time = LEAD_MS + i * HALF_MS;          // 정박(짝수 틱)/반박(홀수 틱)에 스냅
    const p = (time - LEAD_MS) / PLAY_MS;        // 진행도 0→1 (밀도 램프)
    const onBeat = i % 2 === 0;
    const prob = onBeat ? 0.68 + 0.27 * p : 0.06 + 0.5 * p;
    if (Math.random() >= prob) continue;

    let lane = Arcade.rand(0, 3);
    if (lane === lastLane) lane = Arcade.rand(0, 3); // 같은 레인 연타 완화
    notes.push({ time: time, lane: lane, hit: false, judged: false });
    lastLane = lane;

    /* 후반부 정박에 2레인 동시 노트 */
    if (onBeat && Math.random() < 0.03 + 0.22 * p) {
      let lane2 = (lane + Arcade.rand(1, 3)) % 4;
      notes.push({ time: time, lane: lane2, hit: false, judged: false });
    }
  }
  return notes;
}

/* ══════════ 비트 사운드: 룩어헤드 스케줄러 ══════════
   90ms 간격으로 깨어나 220ms 앞까지의 비트를 tone/noise의 delay 옵션으로 예약.
   비트 시각과 노트 도착 시각 모두 songTime() 그리드에서 계산되므로 항상 동기. */
const SCHED_INTERVAL = 90;
const LOOKAHEAD_MS   = 220;
let schedTid = 0;
let nextTick = 0; // 반박 단위 그리드 인덱스

function schedulerTick() {
  if (!running || Arcade.pause.active) return;
  const now = songTime();
  const horizon = now + LOOKAHEAD_MS;
  while (nextTick * HALF_MS <= horizon && nextTick * HALF_MS < SONG_MS) {
    const t = nextTick * HALF_MS;
    const delay = Math.max(0, t - now);
    if (nextTick % 2 === 0) {
      /* 킥: 150→40Hz 스윕 */
      Arcade.audio.tone(150, 100, { type: 'triangle', endFreq: 40, gain: 0.3, delay: delay });
      /* 마디 첫 박 액센트 햇 */
      if (nextTick % 8 === 0) {
        Arcade.audio.noise(40, { freq: 8000, endFreq: 3000, gain: 0.09, delay: delay });
      }
    } else {
      /* 오프비트 클로즈드 햇 */
      Arcade.audio.noise(32, { freq: 6500, endFreq: 2500, gain: 0.06, delay: delay });
    }
    nextTick++;
  }
}
function startScheduler() {
  stopScheduler();
  schedulerTick();
  schedTid = setInterval(schedulerTick, SCHED_INTERVAL);
}
function stopScheduler() {
  if (schedTid) { clearInterval(schedTid); schedTid = 0; }
}

/* ── 일시정지 연동: 시계 동결 + 스케줄러 중단/재개 ── */
Arcade.pause.register({
  isActive: function () { return running; },
  onPause: function () {
    baseElapsed += performance.now() - runStamp;
    stopScheduler();
  },
  onResume: function () {
    runStamp = performance.now();
    startScheduler();
  }
});

/* ══════════ 이펙트 ══════════ */
function addParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + Math.random() * 0.5;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * (Math.random() * 4 + 1),
      vy: Math.sin(angle) * (Math.random() * 4 + 1) - 1,
      r: Math.random() * 5 + 2,
      color: color,
      life: 1,
      decay: Math.random() * 0.06 + 0.04,
    });
  }
}

function addJudgment(lane, text, color) {
  judgments.push({
    x: lane * LANE_W + LANE_W / 2,
    y: HIT_Y - 30,
    text: text,
    color: color,
    life: 1,
    vy: -1.2,
    scale: 1.25,
  });
}

/* ══════════ 렌더링 ══════════ */
function drawBackground(t) {
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);

  for (let i = 1; i < 4; i++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(i * LANE_W, 0);
    ctx.lineTo(i * LANE_W, H);
    ctx.stroke();
  }

  /* 레인 히트 플래시 */
  LANES.forEach(function (ln, i) {
    const flash = laneFlash[i];
    if (flash > 0) {
      const grd = ctx.createLinearGradient(0, HIT_Y - 140, 0, HIT_Y + 10);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, ln.color + Math.round(flash * 60).toString(16).padStart(2, '0'));
      ctx.fillStyle = grd;
      ctx.fillRect(i * LANE_W, HIT_Y - 140, LANE_W, 150);
      laneFlash[i] = Math.max(0, flash - 0.08);
    }
  });
}

function drawHitZone(t) {
  /* 비트에 맞춰 히트라인이 맥동 */
  const beatPhase = ((t % BEAT_MS) + BEAT_MS) % BEAT_MS / BEAT_MS;
  const pulse = Math.max(0, 1 - beatPhase * 3);
  LANES.forEach(function (ln, i) {
    const x = i * LANE_W;
    const grd = ctx.createLinearGradient(x, HIT_Y - 2, x + LANE_W, HIT_Y + HIT_H + 2);
    grd.addColorStop(0, ln.color + '99');
    grd.addColorStop(0.5, ln.color + 'ff');
    grd.addColorStop(1, ln.color + '99');

    ctx.shadowBlur = 10 + pulse * 14;
    ctx.shadowColor = ln.glow;
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(x + 6, HIT_Y - pulse * 1.5, LANE_W - 12, HIT_H + pulse * 3, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function drawLaneKeys() {
  LANES.forEach(function (ln, i) {
    const cx = i * LANE_W + LANE_W / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(cx - 18, HIT_Y + HIT_H + 10, 36, 36, 9);
    ctx.fill();

    ctx.strokeStyle = ln.color + '55';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx - 18, HIT_Y + HIT_H + 10, 36, 36, 9);
    ctx.stroke();

    ctx.fillStyle = ln.color;
    ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ln.label, cx, HIT_Y + HIT_H + 28);
  });
}

function drawNotes(t) {
  for (let i = 0; i < chart.length; i++) {
    const n = chart[i];
    if (n.hit || n.judged) continue;
    const y = HIT_CENTER - NOTE_H / 2 - (n.time - t) * PX_PER_MS;
    if (y < -NOTE_H || y > H) continue;
    const ln = LANES[n.lane];
    const x = n.lane * LANE_W + 6;
    const w = LANE_W - 12;

    ctx.shadowBlur = 16;
    ctx.shadowColor = ln.glow;

    const grd = ctx.createLinearGradient(x, y, x, y + NOTE_H);
    grd.addColorStop(0, '#fff');
    grd.addColorStop(0.3, ln.color);
    grd.addColorStop(1, ln.color + '88');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(x, y, w, NOTE_H, 9);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, w - 8, 6, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawParticles() {
  particles = particles.filter(function (p) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.15;
    p.life -= p.decay; p.r *= 0.95;
    if (p.life <= 0) return false;

    ctx.globalAlpha = p.life;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, p.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return true;
  });
}

function drawJudgments() {
  judgments = judgments.filter(function (j) {
    j.y += j.vy;
    j.life -= 0.035;
    j.scale = Math.max(1, j.scale - 0.02);
    if (j.life <= 0) return false;

    ctx.globalAlpha = j.life;
    ctx.font = 'bold ' + Math.round(18 * j.scale) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = j.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = j.color;
    ctx.fillText(j.text, j.x, j.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    return true;
  });
}

function drawCountIn(t) {
  if (t >= LEAD_MS) return;
  const n = 4 - Math.floor(t / BEAT_MS);
  const phase = (t % BEAT_MS) / BEAT_MS;
  ctx.globalAlpha = 1 - phase * 0.7;
  ctx.font = 'bold ' + Math.round(72 - phase * 16) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f9a8d4';
  ctx.shadowBlur = 24;
  ctx.shadowColor = 'rgba(236,72,153,0.6)';
  ctx.fillText(String(n), W / 2, H * 0.38);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawProgressBar(t) {
  const prog = Arcade.clamp(t / SONG_MS, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, H - 6, W, 6);

  const grd = ctx.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, '#ec4899');
  grd.addColorStop(1, '#06b6d4');
  ctx.fillStyle = grd;
  ctx.fillRect(0, H - 6, W * prog, 6);
}

/* ══════════ HUD ══════════ */
function updateCombo() {
  comboEl.textContent = combo;
  comboEl.classList.remove('glow1', 'glow2', 'glow3');
  if (combo >= 30) comboEl.classList.add('glow3');
  else if (combo >= 20) comboEl.classList.add('glow2');
  else if (combo >= 10) comboEl.classList.add('glow1');
}

/* ══════════ 게임 루프 ══════════ */
function loop() {
  if (!running) return;
  animId = requestAnimationFrame(loop);
  if (Arcade.pause.active) return;

  const t = songTime();

  timerEl.textContent = Arcade.clamp(Math.ceil((SONG_MS - t) / 1000), 0, 60);
  if (t >= SONG_MS + 300) { endGame(); return; }

  /* 지나간 노트 MISS 판정 */
  for (let i = 0; i < chart.length; i++) {
    const n = chart[i];
    if (n.hit || n.judged) continue;
    if (t - n.time > GOOD_MS + 40) {
      n.judged = true;
      missCount++;
      combo = 0;
      updateCombo();
      addJudgment(n.lane, 'MISS', '#ef4444');
      Arcade.audio.play('hit'); /* 둔탁한 미스 사운드 */
    }
  }

  drawBackground(t);
  drawHitZone(t);
  drawNotes(t);
  drawParticles();
  drawJudgments();
  drawLaneKeys();
  drawCountIn(t);
  drawProgressBar(t);
}

/* ══════════ 입력 → 판정 ══════════ */
function handleLanePress(laneIdx) {
  if (!running || Arcade.pause.active) return;
  const ln = LANES[laneIdx];
  laneFlash[laneIdx] = 1;

  const t = songTime();
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < chart.length; i++) {
    const n = chart[i];
    if (n.hit || n.judged || n.lane !== laneIdx) continue;
    const dist = Math.abs(n.time - t);
    if (dist < bestDist) { bestDist = dist; best = n; }
  }

  if (!best || bestDist > TAP_RANGE) return; /* 빈 탭 — 패널티 없음 */

  best.hit = true;
  best.judged = true;
  const cx = laneIdx * LANE_W + LANE_W / 2;

  if (bestDist <= PERFECT_MS) {
    score += 300 + Math.floor(combo * 8);
    combo++;
    perfectCount++;
    addParticles(cx, HIT_CENTER, ln.color, 12);
    addJudgment(laneIdx, '✦ PERFECT', ln.color);
    /* 레인 음정 + 밝은 배음 */
    Arcade.audio.tone(ln.freq, 130, { type: 'triangle', gain: 0.14 });
    Arcade.audio.tone(ln.freq * 2, 90, { type: 'sine', gain: 0.08 });
  } else if (bestDist <= GOOD_MS) {
    score += 150 + Math.floor(combo * 3);
    combo++;
    goodCount++;
    addParticles(cx, HIT_CENTER, ln.color, 6);
    addJudgment(laneIdx, 'GOOD', '#67e8f9');
    Arcade.audio.tone(ln.freq, 100, { type: 'triangle', gain: 0.1 });
  } else {
    /* 판정 창 밖(성급/늦은 탭) → MISS */
    missCount++;
    combo = 0;
    updateCombo();
    addJudgment(laneIdx, 'MISS', '#ef4444');
    Arcade.audio.play('hit');
    return;
  }

  maxCombo = Math.max(maxCombo, combo);
  if (combo > 0 && combo % 10 === 0) {
    Arcade.audio.play('combo', { step: combo / 10 });
  }
  scoreEl.textContent = score.toLocaleString();
  updateCombo();
}

window.addEventListener('keydown', function (e) {
  if (!running || e.repeat) return;
  for (let i = 0; i < LANES.length; i++) {
    if (e.code === LANES[i].key) {
      e.preventDefault();
      handleLanePress(i);
      return;
    }
  }
});

/* 캔버스 직접 탭 (멀티터치 대응: pointerdown은 터치별로 발생) */
canvas.addEventListener('pointerdown', function (e) {
  if (!running) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const laneIdx = Math.floor((e.clientX - rect.left) * (W / rect.width) / LANE_W);
  if (laneIdx >= 0 && laneIdx < 4) handleLanePress(laneIdx);
});

/* 하단 터치존 (모바일) */
document.querySelectorAll('.touch-zone').forEach(function (z) {
  const lane = parseInt(z.dataset.lane, 10);
  z.style.setProperty('--zone-color', LANES[lane].color);
  z.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    z.classList.add('pressed');
    handleLanePress(lane);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    z.addEventListener(ev, function () { z.classList.remove('pressed'); });
  });
  z.addEventListener('contextmenu', function (e) { e.preventDefault(); });
});

/* ══════════ 시작 / 종료 ══════════ */
function startGame() {
  if (animId) cancelAnimationFrame(animId);
  stopScheduler();

  chart = buildChart();
  totalNotes = chart.length;
  particles = []; judgments = []; laneFlash = [0, 0, 0, 0];
  score = 0; combo = 0; maxCombo = 0;
  perfectCount = 0; goodCount = 0; missCount = 0;

  scoreEl.textContent = '0';
  timerEl.textContent = '60';
  updateCombo();

  running = true;
  baseElapsed = 0;
  runStamp = performance.now();
  nextTick = 0; /* 킥 4번 = 카운트인 */

  startScheduler();
  animId = requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  stopScheduler();
  cancelAnimationFrame(animId);

  const judged = perfectCount + goodCount + missCount;
  const acc = judged > 0
    ? Math.round(((perfectCount + goodCount * 0.5) / totalNotes) * 100)
    : 0;

  const res = Arcade.best.submit('game18', score);
  Arcade.audio.play(res.isRecord || acc >= 70 ? 'win' : 'lose');

  overlay.show({
    emoji: '🎵',
    title: '연주 종료!',
    isRecord: res.isRecord,
    msg: '✦ Perfect ' + perfectCount + ' · Good ' + goodCount + ' · Miss ' + missCount +
      '\n최고 기록 ' + Arcade.best.score('game18').toLocaleString(),
    stats: [
      { label: '점수', value: score.toLocaleString() },
      { label: '최대 콤보', value: maxCombo },
      { label: '정확도', value: acc + '%' },
    ],
    btnText: '다시 하기',
    onStart: startGame,
  });
}

/* ── 시작 오버레이 ── */
function showStart() {
  const bs = Arcade.best.score('game18');
  overlay.show({
    emoji: '🎵',
    title: '리듬 탭',
    msg: '비트에 맞춰 내려오는 네온 노트!\n히트라인에 닿는 순간 정확히 탭하세요.\n키보드 D · F · J · K 또는 하단 터치 · 60초',
    extraHTML:
      '<div class="key-guide">' +
      '<span class="key-chip" data-color="cyan">D</span>' +
      '<span class="key-chip" data-color="purple">F</span>' +
      '<span class="key-chip" data-color="pink">J</span>' +
      '<span class="key-chip" data-color="amber">K</span>' +
      '</div>' +
      (bs !== null ? '<div class="best-info">최고 기록 ' + bs.toLocaleString() + '</div>' : ''),
    btnText: '시작하기',
    onStart: startGame,
  });
}

/* ── 캔버스 스케일 (375px 대응, 모바일은 하단 터치존 공간 확보) ── */
Arcade.fitCanvas(canvas, {
  padding: 28,
  paddingV: Arcade.touch.isCoarse() ? Math.round(window.innerHeight * 0.25) + 170 : 170,
});

/* 초기 화면: 정지 상태 렌더 + 시작 오버레이 */
drawBackground(0);
drawHitZone(0);
drawLaneKeys();
showStart();
