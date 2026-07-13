/* ── game23.js — 오목 vs AI ── */

Arcade.init({ id: 'game23', title: '오목', emoji: '⚫', accent: 'amber' });

const canvas    = document.getElementById('c');
const ctx       = canvas.getContext('2d');
const turnEl    = document.getElementById('turnEl');
const moveEl    = document.getElementById('moveEl');
const scoreMeEl = document.getElementById('scoreMe');
const scoreAiEl = document.getElementById('scoreAi');
const winsEl    = document.getElementById('winsEl');
const playerDot = document.getElementById('playerDot');
const undoBtn   = document.getElementById('undoBtn');
const newBtn    = document.getElementById('newBtn');
const touchHint = document.getElementById('touchHint');

const ov = Arcade.overlay('#overlay');

const N = 15;           // 15×15 보드
const CELL = 28;        // 격자 간격 px
const PAD  = 24;        // 외곽 여백
const SIZE = PAD * 2 + CELL * (N - 1);

canvas.width  = SIZE;
canvas.height = SIZE;

/* 모바일(375px)에서도 보드 전체가 보이도록 CSS 스케일 */
const fit = Arcade.fitCanvas(canvas, { maxScale: 1, padding: 24, paddingV: 270 });

const EMPTY = 0, BLACK = 1, WHITE = 2;

/* ── 난이도 ── */
const DIFF_KO = { easy: '쉬움', normal: '보통', hard: '어려움' };
const DIFF_CONF = {
  easy:   { def: 0.55, topK: 3, combine: false, strict: false },
  normal: { def: 0.9,  topK: 1, combine: false, strict: false },
  hard:   { def: 1.0,  topK: 1, combine: true,  strict: true  }
};

let diff = Arcade.store.get('diff:game23', 'normal');
if (!DIFF_CONF[diff]) diff = 'normal';
let stonePick = Arcade.store.get('stone:game23', 'black');
if (stonePick !== 'black' && stonePick !== 'white') stonePick = 'black';

/* ── 상태 ── */
let board, playerStone, aiStone, currentTurn;
let started = false, gameOver = false;
let moveCount = 0, scoreMe = 0, scoreAi = 0;
let lastMove = null, winLine = null;
let history = [];          // {r, c, stone}
let undoUsed = false;      // 무르기는 판당 1회
let aiPending = null;      // Arcade.schedule 핸들
let preview = null;        // 터치 2단계 착수 미리보기 [r, c]
let hoverCell = null;      // 마우스 호버 고스트 [r, c]

/* ── 색 팔레트 ── */
const STONE_COLORS = {
  [BLACK]: { fill: '#1a1030', stroke: '#a78bfa', glow: 'rgba(167,139,250,0.6)', light: '#d8b4fe' },
  [WHITE]: { fill: '#f8fafc', stroke: '#06b6d4', glow: 'rgba(6,182,212,0.5)',   light: '#cffafe' }
};

function winsFor(d) {
  return Arcade.best.score('game23', { suffix: d }) || 0;
}

/* ── HUD ── */
function updateHUD() {
  moveEl.textContent    = moveCount;
  scoreMeEl.textContent = scoreMe;
  scoreAiEl.textContent = scoreAi;
  winsEl.textContent    = winsFor(diff);

  let thinking = false;
  if (!started)            turnEl.textContent = '대기 중';
  else if (gameOver)       turnEl.textContent = '대국 종료';
  else if (currentTurn === playerStone) turnEl.textContent = '내 차례';
  else { turnEl.textContent = 'AI가 생각 중…'; thinking = true; }
  turnEl.classList.toggle('thinking', thinking);

  playerDot.style.background = (started && !gameOver && currentTurn === playerStone)
    ? (playerStone === BLACK ? '#a78bfa' : '#06b6d4')
    : '#64748b';

  undoBtn.disabled = !canUndo();
}

/* ── 렌더링 ── */
function render() {
  /* 배경 */
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, '#0d0820');
  bg.addColorStop(1, '#070512');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  /* 격자 */
  ctx.strokeStyle = 'rgba(124,58,237,0.25)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < N; i++) {
    const x = PAD + i * CELL, y = PAD + i * CELL;
    ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, PAD + (N - 1) * CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(PAD + (N - 1) * CELL, y); ctx.stroke();
  }

  /* 화점 (star points) */
  const stars = [3, 7, 11];
  stars.forEach(r => stars.forEach(c => {
    ctx.fillStyle = 'rgba(124,58,237,0.5)';
    ctx.beginPath();
    ctx.arc(PAD + c * CELL, PAD + r * CELL, 3, 0, Math.PI * 2);
    ctx.fill();
  }));

  /* 터치 미리보기: 행/열 크로스헤어 */
  if (preview && started && !gameOver) {
    const [pr, pc] = preview;
    ctx.save();
    ctx.strokeStyle = 'rgba(245,158,11,0.5)';
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(245,158,11,0.6)';
    ctx.beginPath();
    ctx.moveTo(PAD + pc * CELL, PAD);
    ctx.lineTo(PAD + pc * CELL, PAD + (N - 1) * CELL);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PAD, PAD + pr * CELL);
    ctx.lineTo(PAD + (N - 1) * CELL, PAD + pr * CELL);
    ctx.stroke();
    ctx.restore();
  }

  /* 승리 라인 하이라이트 */
  if (winLine) {
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 16; ctx.shadowColor = '#f59e0b';
    ctx.globalAlpha = 0.8;
    const [r0, c0] = winLine[0], [r1, c1] = winLine[4];
    ctx.beginPath();
    ctx.moveTo(PAD + c0 * CELL, PAD + r0 * CELL);
    ctx.lineTo(PAD + c1 * CELL, PAD + r1 * CELL);
    ctx.stroke();
    ctx.restore();
  }

  /* 돌 그리기 */
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board && board[r][c] !== EMPTY) drawStone(r, c, board[r][c], 1);
    }
  }

  /* 고스트 돌 (터치 미리보기 / 마우스 호버) */
  const ghost = preview || hoverCell;
  if (ghost && started && !gameOver && currentTurn === playerStone && !aiPending &&
      board[ghost[0]][ghost[1]] === EMPTY) {
    drawStone(ghost[0], ghost[1], playerStone, preview ? 0.55 : 0.35);
    if (preview) {
      /* 확정 대기 링 */
      ctx.save();
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(PAD + ghost[1] * CELL, PAD + ghost[0] * CELL, CELL * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* 마지막 착수 표시 */
  if (lastMove) {
    const [lr, lc] = lastMove;
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8; ctx.shadowColor = '#f59e0b';
    ctx.beginPath();
    ctx.arc(PAD + lc * CELL, PAD + lr * CELL, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(PAD + lc * CELL, PAD + lr * CELL, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawStone(r, c, stone, alpha) {
  const x = PAD + c * CELL, y = PAD + r * CELL;
  const R = CELL * 0.44;
  const col = STONE_COLORS[stone];

  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.shadowBlur = 10; ctx.shadowColor = col.glow;

  /* 그림자 */
  ctx.beginPath();
  ctx.arc(x + 2, y + 2, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  /* 본체 */
  const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R);
  g.addColorStop(0, col.light);
  g.addColorStop(0.5, col.fill === '#f8fafc' ? '#e2e8f0' : '#2e1065');
  g.addColorStop(1, col.fill);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();

  /* 테두리 */
  ctx.strokeStyle = col.stroke + '88';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* 광택 */
  const shine = ctx.createRadialGradient(x - R * 0.3, y - R * 0.4, 0, x, y, R * 0.8);
  shine.addColorStop(0, 'rgba(255,255,255,0.35)');
  shine.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ── 착수 ── */
function place(r, c, stone) {
  board[r][c] = stone;
  history.push({ r: r, c: c, stone: stone });
  lastMove = [r, c];
  moveCount++;
  render();
}

/* ── 승리 체크 ── */
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function checkWin(r, c, stone) {
  for (const [dr, dc] of DIRS) {
    const line = [[r, c]];
    for (let d = 1; d < 5; d++) {
      const nr = r + dr * d, nc = c + dc * d;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N || board[nr][nc] !== stone) break;
      line.push([nr, nc]);
    }
    for (let d = 1; d < 5; d++) {
      const nr = r - dr * d, nc = c - dc * d;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N || board[nr][nc] !== stone) break;
      line.unshift([nr, nc]);
    }
    if (line.length >= 5) {
      winLine = line.slice(0, 5);
      return true;
    }
  }
  return false;
}

/* ── AI (휴리스틱) ── */
const SCORE_TABLE = [0, 1, 10, 100, 1000, 100000];

function evalLine(stone, r, c, dr, dc) {
  let mine = 0, opp = 0;
  for (let d = -4; d <= 4; d++) {
    const nr = r + dr * d, nc = c + dc * d;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) { opp++; continue; }
    const v = board[nr][nc];
    if (v === stone) mine++;
    else if (v !== EMPTY) opp++;
  }
  if (opp > 0) return 0;
  return SCORE_TABLE[Math.min(mine, 5)];
}

function scoreCell(r, c, stone) {
  if (board[r][c] !== EMPTY) return -1;
  let s = 0;
  for (const [dr, dc] of DIRS) s += evalLine(stone, r, c, dr, dc);
  return s;
}

function aiMove() {
  if (gameOver || !started) return;

  const conf = DIFF_CONF[diff];
  const cands = [];
  let winCand = null, blockCand = null;

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] !== EMPTY) continue;
      const off = scoreCell(r, c, aiStone);
      const def = scoreCell(r, c, playerStone);
      const total = conf.combine ? off + def * conf.def : Math.max(off, def * conf.def);
      cands.push({ r: r, c: c, s: total });
      if (!winCand && off >= 100000)   winCand   = { r: r, c: c };
      if (!blockCand && def >= 100000) blockCand = { r: r, c: c };
    }
  }
  cands.sort((a, b) => b.s - a.s);

  let bestR, bestC;
  if (moveCount === 0) {
    bestR = 7; bestC = 7;                        /* 첫 수 → 중앙 */
  } else if (moveCount === 1 && cands.length && cands[0].s < 10) {
    bestR = 7 + (Math.random() < 0.5 ? 1 : -1);  /* 둘째 수 → 중앙 근처 */
    bestC = 7 + (Math.random() < 0.5 ? 1 : -1);
    if (board[bestR][bestC] !== EMPTY) { bestR = 7; bestC = 8; }
  } else if (conf.strict && winCand) {
    bestR = winCand.r; bestC = winCand.c;        /* 하드: 즉시 승리 */
  } else if (conf.strict && blockCand) {
    bestR = blockCand.r; bestC = blockCand.c;    /* 하드: 즉시 차단 */
  } else if (cands.length) {
    const k = Math.min(conf.topK, cands.length);
    const pick = cands[(Math.random() * k) | 0]; /* 쉬움: 상위 후보 중 랜덤 */
    bestR = pick.r; bestC = pick.c;
  }

  if (bestR === undefined) { /* 폴백 */
    outer:
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (board[r][c] === EMPTY) { bestR = r; bestC = c; break outer; }
    }
  }

  place(bestR, bestC, aiStone);
  Arcade.audio.tone(300, 60, { type: 'sine', gain: 0.08 }); /* AI 착수음 */

  if (checkWin(bestR, bestC, aiStone)) { render(); endGame(false); return; }
  if (moveCount >= N * N)              { endGame(null); return; }

  currentTurn = playerStone;
  updateHUD();
  render();
}

function setAiTurn(delay) {
  currentTurn = aiStone;
  preview = null;
  updateHUD();
  render();
  /* schedule: UI가 먼저 그려지고, 일시정지도 인지한다 */
  aiPending = Arcade.schedule(() => { aiPending = null; aiMove(); }, delay);
}

/* ── 플레이어 착수 ── */
function playerPlace(r, c) {
  place(r, c, playerStone);
  Arcade.audio.play('pop');

  if (checkWin(r, c, playerStone)) { render(); endGame(true); return; }
  if (moveCount >= N * N)          { endGame(null); return; }

  setAiTurn(300);
}

/* ── 입력 (마우스: 직접 클릭 + 호버 고스트 / 터치: 2단계 확정) ── */
function cellFromEvent(e) {
  const p = fit.toCanvasXY(e);
  const c = Math.round((p.x - PAD) / CELL);
  const r = Math.round((p.y - PAD) / CELL);
  if (r < 0 || r >= N || c < 0 || c >= N) return null;
  return [r, c];
}

canvas.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  if (!started || gameOver || currentTurn !== playerStone) return;
  const cell = cellFromEvent(e);
  const changed = !hoverCell !== !cell ||
    (cell && hoverCell && (cell[0] !== hoverCell[0] || cell[1] !== hoverCell[1]));
  hoverCell = cell && board[cell[0]][cell[1]] === EMPTY ? cell : null;
  if (changed) render();
});

canvas.addEventListener('pointerleave', () => {
  if (hoverCell) { hoverCell = null; render(); }
});

canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (!started || gameOver || currentTurn !== playerStone || aiPending) return;

  const cell = cellFromEvent(e);
  if (!cell || board[cell[0]][cell[1]] !== EMPTY) {
    if (preview) { preview = null; render(); }
    return;
  }

  const twoStep = e.pointerType !== 'mouse' && Arcade.touch.isCoarse();
  if (twoStep) {
    if (preview && preview[0] === cell[0] && preview[1] === cell[1]) {
      preview = null;
      playerPlace(cell[0], cell[1]);   /* 같은 자리 두 번째 탭 → 확정 */
    } else {
      preview = cell;                  /* 다른 자리 탭 → 미리보기 이동 */
      Arcade.audio.play('tick');
      render();
    }
  } else {
    playerPlace(cell[0], cell[1]);
  }
});

/* ── 무르기 (판당 1회): 내 마지막 수 + AI 응수를 되돌린다 ── */
function canUndo() {
  return started && !gameOver && !undoUsed && !aiPending &&
    currentTurn === playerStone && history.length >= 2 &&
    history[history.length - 1].stone === aiStone &&
    history[history.length - 2].stone === playerStone;
}

function undo() {
  if (!canUndo()) return;
  const a = history.pop(); board[a.r][a.c] = EMPTY;
  const p = history.pop(); board[p.r][p.c] = EMPTY;
  moveCount -= 2;
  lastMove = history.length
    ? [history[history.length - 1].r, history[history.length - 1].c]
    : null;
  winLine = null;
  preview = null;
  undoUsed = true;
  Arcade.audio.play('whoosh');
  updateHUD();
  render();
}

undoBtn.addEventListener('click', undo);

/* ── 종료 ── */
function burstWinLine() {
  if (!winLine) return;
  const rect = canvas.getBoundingClientRect();
  winLine.forEach((pt, i) => {
    const x = rect.left + (PAD + pt[1] * CELL) * (rect.width / SIZE);
    const y = rect.top  + (PAD + pt[0] * CELL) * (rect.height / SIZE);
    Arcade.schedule(() => {
      Arcade.Particles.domBurst({ x: x, y: y }, {
        count: 10,
        colors: ['#f59e0b', '#fcd34d', '#a78bfa', '#06b6d4']
      });
    }, i * 90);
  });
}

function endGame(playerWon) {
  gameOver = true;
  preview = null;
  hoverCell = null;
  render();

  if (playerWon === true) {
    scoreMe++;
    /* 난이도별 누적 승수를 최고기록으로 저장 */
    const total = winsFor(diff) + 1;
    Arcade.best.submit('game23', total, { suffix: diff });
    Arcade.audio.play('win');
    burstWinLine();
  } else if (playerWon === false) {
    scoreAi++;
    Arcade.audio.play('lose');
  } else {
    Arcade.audio.tone(440, 250, { type: 'sine', gain: 0.1 }); /* 무승부 */
  }

  updateHUD();
  Arcade.schedule(() => showEnd(playerWon), 1000);
}

/* ── 오버레이 (시작/종료) ── */
function setupHTML() {
  return '<div class="color-pick">' +
    '<button type="button" class="pick-btn" data-stone="black">⚫ 흑 (선공)</button>' +
    '<button type="button" class="pick-btn" data-stone="white">⚪ 백 (후공)</button>' +
    '</div><div class="ov-diff"></div>';
}

function wireSetup() {
  diff = Arcade.difficulty(ov.el.querySelector('.ov-diff'), ['easy', 'normal', 'hard'], d => {
    diff = d;
    updateHUD();
  }, { gameId: 'game23' });

  ov.el.querySelectorAll('.pick-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.stone === stonePick);
    b.addEventListener('click', () => {
      if (stonePick === b.dataset.stone) return;
      stonePick = b.dataset.stone;
      Arcade.store.set('stone:game23', stonePick);
      ov.el.querySelectorAll('.pick-btn').forEach(x =>
        x.classList.toggle('active', x.dataset.stone === stonePick));
      Arcade.audio.play('click');
    });
  });
}

function showStart() {
  if (aiPending) { aiPending.cancel(); aiPending = null; }
  ov.show({
    emoji: '⚫',
    title: '오목',
    msg: '가로·세로·대각선으로 돌 5개를 먼저 이으면 승리!\n흑이 선공이며, 무르기는 판당 1번입니다.',
    extraHTML: setupHTML(),
    btnText: '대국 시작',
    onStart: startGame
  });
  wireSetup();
}

function showEnd(playerWon) {
  const won  = playerWon === true;
  const lost = playerWon === false;
  ov.show({
    emoji: won ? '🏆' : lost ? '😔' : '🤝',
    title: won ? '승리!' : lost ? '패배' : '무승부',
    msg: won ? moveCount + '수 만에 승리! 축하해요.'
       : lost ? 'AI가 이겼습니다. 다시 도전해 보세요!'
       : '보드가 가득 찼어요. 무승부!',
    stats: [
      { label: '수', value: moveCount },
      { label: '난이도', value: DIFF_KO[diff] },
      { label: '누적 승리', value: winsFor(diff) }
    ],
    extraHTML: setupHTML(),
    btnText: '다시하기',
    onStart: startGame
  });
  wireSetup();
}

/* ── 게임 시작 ── */
function startGame() {
  if (aiPending) { aiPending.cancel(); aiPending = null; }
  board = Array.from({ length: N }, () => Array(N).fill(EMPTY));
  history = [];
  started = true;
  gameOver = false;
  moveCount = 0;
  lastMove = null;
  winLine = null;
  preview = null;
  hoverCell = null;
  undoUsed = false;

  playerStone = stonePick === 'black' ? BLACK : WHITE;
  aiStone     = playerStone === BLACK ? WHITE : BLACK;
  currentTurn = BLACK; /* 흑 선공 */

  updateHUD();
  render();

  if (currentTurn === aiStone) setAiTurn(600);
}

newBtn.addEventListener('click', () => {
  Arcade.audio.play('click');
  showStart();
});

/* ── 일시정지 연동 (Esc / 탭 전환) ── */
Arcade.pause.register({
  isActive: () => started && !gameOver && !ov.el.classList.contains('show')
});

/* ── 초기 화면 ── */
touchHint.hidden = !Arcade.touch.isCoarse();
render();
updateHUD();
showStart();
