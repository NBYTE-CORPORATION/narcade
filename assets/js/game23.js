/* ── game23.js — 오목 vs AI ── */

const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovMsg   = document.getElementById('ovMsg');
const startBtn = document.getElementById('startBtn');
const turnEl  = document.getElementById('turnEl');
const moveEl  = document.getElementById('moveEl');
const scoreMeEl = document.getElementById('scoreMe');
const scoreAiEl = document.getElementById('scoreAi');
const playerDot = document.getElementById('playerDot');

const N = 15;           // 15×15 보드
const CELL = 28;        // 격자 간격 px
const PAD  = 24;        // 외곽 여백
const SIZE = PAD * 2 + CELL * (N - 1);

canvas.width  = SIZE;
canvas.height = SIZE;

const EMPTY = 0, BLACK = 1, WHITE = 2;

let board, playerStone, aiStone, currentTurn;
let gameOver, moveCount, scoreMe, scoreAi;
let lastMove = null, winLine = null;
let animId;

/* ── 색 팔레트 ── */
const STONE_COLORS = {
  [BLACK]: { fill:'#1a1030', stroke:'#a78bfa', glow:'rgba(167,139,250,0.6)', light:'#d8b4fe' },
  [WHITE]: { fill:'#f8fafc', stroke:'#06b6d4', glow:'rgba(6,182,212,0.5)',   light:'#cffafe' },
};

/* ── 선택 버튼 ── */
document.querySelectorAll('.pick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pick-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

/* ── 보드 초기화 ── */
function initGame() {
  board = Array.from({length:N}, () => Array(N).fill(EMPTY));
  gameOver = false; moveCount = 0; lastMove = null; winLine = null;

  const pickBtn = document.querySelector('.pick-btn.active');
  playerStone   = pickBtn.dataset.stone === 'black' ? BLACK : WHITE;
  aiStone       = playerStone === BLACK ? WHITE : BLACK;
  currentTurn   = BLACK; // 흑 선공

  overlay.style.display = 'none';
  updateHUD();
  render();

  /* AI가 먼저면 AI 착수 */
  if (currentTurn === aiStone) setTimeout(aiMove, 600);
}

/* ── HUD ── */
function updateHUD() {
  const isMyTurn = currentTurn === playerStone;
  turnEl.textContent  = isMyTurn ? '내 차례' : 'AI 생각중...';
  playerDot.style.background = isMyTurn
    ? (playerStone === BLACK ? '#a78bfa' : '#06b6d4')
    : '#64748b';
  moveEl.textContent  = moveCount;
  scoreMeEl.textContent = scoreMe;
  scoreAiEl.textContent = scoreAi;
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
  for (let i = 0; i < N; i++) {
    const x = PAD + i * CELL, y = PAD + i * CELL;
    ctx.strokeStyle = 'rgba(124,58,237,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, PAD+(N-1)*CELL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(PAD+(N-1)*CELL, y); ctx.stroke();
  }

  /* 화점 (star points) */
  const stars = N===15 ? [3,7,11] : [3,9];
  stars.forEach(r => stars.forEach(c => {
    ctx.fillStyle = 'rgba(124,58,237,0.5)';
    ctx.beginPath();
    ctx.arc(PAD+c*CELL, PAD+r*CELL, 3, 0, Math.PI*2);
    ctx.fill();
  }));

  /* 승리 라인 하이라이트 */
  if (winLine) {
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 16; ctx.shadowColor = '#f59e0b';
    ctx.globalAlpha = 0.8;
    const [r0,c0] = winLine[0], [r1,c1] = winLine[4];
    ctx.beginPath();
    ctx.moveTo(PAD+c0*CELL, PAD+r0*CELL);
    ctx.lineTo(PAD+c1*CELL, PAD+r1*CELL);
    ctx.stroke();
    ctx.restore();
  }

  /* 돌 그리기 */
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c] === EMPTY) continue;
      drawStone(r, c, board[r][c]);
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
    ctx.arc(PAD+lc*CELL, PAD+lr*CELL, 5, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawStone(r, c, stone) {
  const x = PAD + c * CELL, y = PAD + r * CELL;
  const R = CELL * 0.44;
  const col = STONE_COLORS[stone];

  ctx.save();
  ctx.shadowBlur = 10; ctx.shadowColor = col.glow;

  /* 그림자 */
  ctx.beginPath();
  ctx.arc(x+2, y+2, R, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();

  /* 본체 */
  const g = ctx.createRadialGradient(x-R*0.3, y-R*0.3, 0, x, y, R);
  g.addColorStop(0, col.light);
  g.addColorStop(0.5, col.fill === '#f8fafc' ? '#e2e8f0' : '#2e1065');
  g.addColorStop(1, col.fill);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI*2);
  ctx.fill();

  /* 테두리 */
  ctx.strokeStyle = col.stroke + '88';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* 광택 */
  const shine = ctx.createRadialGradient(x-R*0.3, y-R*0.4, 0, x, y, R*0.8);
  shine.addColorStop(0, 'rgba(255,255,255,0.35)');
  shine.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

/* ── 착수 ── */
function place(r, c, stone) {
  board[r][c] = stone;
  lastMove = [r, c];
  moveCount++;
  render();
}

/* ── 승리 체크 ── */
const DIRS = [[0,1],[1,0],[1,1],[1,-1]];

function checkWin(r, c, stone) {
  for (const [dr, dc] of DIRS) {
    const line = [[r,c]];
    for (let d=1;d<5;d++) {
      const nr=r+dr*d, nc=c+dc*d;
      if (nr<0||nr>=N||nc<0||nc>=N||board[nr][nc]!==stone) break;
      line.push([nr,nc]);
    }
    for (let d=1;d<5;d++) {
      const nr=r-dr*d, nc=c-dc*d;
      if (nr<0||nr>=N||nc<0||nc>=N||board[nr][nc]!==stone) break;
      line.unshift([nr,nc]);
    }
    if (line.length >= 5) {
      winLine = line.slice(0,5);
      return true;
    }
  }
  return false;
}

/* ── AI (휴리스틱) ── */
const SCORE_TABLE = [0, 1, 10, 100, 1000, 100000];

function evalLine(stone, r, c, dr, dc) {
  let mine=0, opp=0;
  for (let d=-4;d<=4;d++) {
    const nr=r+dr*d, nc=c+dc*d;
    if (nr<0||nr>=N||nc<0||nc>=N) { opp++; continue; }
    const v=board[nr][nc];
    if (v===stone) mine++;
    else if (v!==EMPTY) opp++;
  }
  if (opp>0) return 0;
  return SCORE_TABLE[Math.min(mine,5)];
}

function scoreCell(r, c, stone) {
  if (board[r][c] !== EMPTY) return -1;
  let s = 0;
  for (const [dr,dc] of DIRS) s += evalLine(stone, r, c, dr, dc);
  return s;
}

function aiMove() {
  if (gameOver) return;

  let bestScore = -1, bestR = -1, bestC = -1;

  /* 1. 내가 5연승 가능한 자리 */
  /* 2. 상대 4연속 막기 */
  /* 3. 최고 점수 자리 */
  for (let r=0;r<N;r++) {
    for (let c=0;c<N;c++) {
      if (board[r][c] !== EMPTY) continue;

      const offScore = scoreCell(r, c, aiStone);
      const defScore = scoreCell(r, c, playerStone) * 0.9;
      const total    = Math.max(offScore, defScore);

      if (total > bestScore) { bestScore=total; bestR=r; bestC=c; }
    }
  }

  /* 첫 수 → 중앙 근처 */
  if (moveCount === 0) { bestR=7; bestC=7; }
  else if (moveCount === 1 && bestScore < 10) {
    bestR = 7 + (Math.random()<0.5?1:-1);
    bestC = 7 + (Math.random()<0.5?1:-1);
  }

  if (bestR < 0) { /* 폴백 */
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) if (board[r][c]===EMPTY) { bestR=r; bestC=c; break; }
  }

  place(bestR, bestC, aiStone);

  if (checkWin(bestR, bestC, aiStone)) {
    render(); endGame(false); return;
  }
  if (moveCount >= N*N) { endGame(null); return; }

  currentTurn = playerStone;
  updateHUD();
  render();
}

/* ── 클릭 처리 ── */
function handleClick(cx, cy) {
  if (gameOver || currentTurn !== playerStone) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = SIZE / rect.width, scaleY = SIZE / rect.height;
  const px = (cx * scaleX - PAD + CELL/2) / CELL;
  const py = (cy * scaleY - PAD + CELL/2) / CELL;
  const c  = Math.floor(px), r = Math.floor(py);

  if (r<0||r>=N||c<0||c>=N||board[r][c]!==EMPTY) return;

  place(r, c, playerStone);

  if (checkWin(r, c, playerStone)) { render(); endGame(true); return; }
  if (moveCount >= N*N)             { endGame(null); return; }

  currentTurn = aiStone;
  updateHUD(); render();
  setTimeout(aiMove, 300);
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  handleClick(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const t = e.changedTouches[0];
  handleClick(t.clientX - rect.left, t.clientY - rect.top);
}, { passive: false });

/* ── 종료 ── */
function endGame(playerWon) {
  gameOver = true;
  render();

  if (playerWon === true)       { scoreMe++; scoreMeEl.textContent = scoreMe; }
  else if (playerWon === false) { scoreAi++; scoreAiEl.textContent = scoreAi; }

  setTimeout(() => {
    ovTitle.textContent = playerWon === true ? '승리! 🏆' : playerWon === false ? '패배 😔' : '무승부 🤝';
    ovMsg.innerHTML     = playerWon === true
      ? `축하해요! ${moveCount}수 만에 승리!<br>스코어: <strong>${scoreMe} : ${scoreAi}</strong>`
      : playerWon === false
      ? `AI가 이겼습니다. 다시 도전!<br>스코어: <strong>${scoreMe} : ${scoreAi}</strong>`
      : `꽉 찬 보드 — 무승부!<br>스코어: <strong>${scoreMe} : ${scoreAi}</strong>`;
    startBtn.textContent = '다시 대국';
    overlay.style.display = 'flex';
  }, 800);
}

startBtn.addEventListener('click', () => {
  scoreMe = scoreMe || 0; scoreAi = scoreAi || 0;
  initGame();
});

/* ── 초기 화면 ── */
scoreMe = 0; scoreAi = 0;
scoreMeEl.textContent = '0'; scoreAiEl.textContent = '0';
render();
