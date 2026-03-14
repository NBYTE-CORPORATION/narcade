/* ── game19.js — 카드 짝 맞추기 ── */

const cardGrid  = document.getElementById('cardGrid');
const timeEl    = document.getElementById('timeEl');
const movesEl   = document.getElementById('movesEl');
const comboEl   = document.getElementById('comboEl');
const resultEl  = document.getElementById('result');
const resultMsg = document.getElementById('resultMsg');
const resultIcon = document.getElementById('resultIcon');
const retryBtn  = document.getElementById('retryBtn');
const startBtn  = document.getElementById('startBtn');
const startScreen = document.getElementById('startScreen');
const bestRow   = document.getElementById('bestRow');

/* ── 이모지 풀 (20개) ── */
const EMOJI_POOL = [
  '🦊','🐼','🦁','🐸','🦋','🐬','🦄','🐙',
  '🌸','🍓','🍕','🎸','🚀','⚡','💎','🔮',
  '🎯','🏆','🌈','🎭',
];

/* ── 난이도 ── */
const DIFFS = {
  easy:   { cols: 4, rows: 3, pairs: 6  },
  normal: { cols: 4, rows: 4, pairs: 8  },
  hard:   { cols: 5, rows: 4, pairs: 10 },
};

let currentDiff = 'easy';
let cards = [];
let flipped = [];
let matched = 0;
let moves = 0;
let combo = 0;
let gameRunning = false;
let timerInterval = null;
let seconds = 0;
let lockBoard = false;

/* ── 난이도 버튼 ── */
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDiff = btn.dataset.diff;
    updateBestRow();
  });
});

/* ── 유틸 ── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function updateBestRow() {
  const key  = `memory_best_${currentDiff}`;
  const best = localStorage.getItem(key);
  bestRow.textContent = best
    ? `최고기록: ${JSON.parse(best).moves}번 이동 · ${formatTime(JSON.parse(best).time)}`
    : '';
}

/* ── 게임 시작 ── */
function startGame() {
  const diff = DIFFS[currentDiff];

  /* 상태 초기화 */
  cards = []; flipped = []; matched = 0;
  moves = 0; combo = 0; seconds = 0;
  lockBoard = false; gameRunning = true;

  timeEl.textContent  = '0:00';
  movesEl.textContent = '0';
  comboEl.textContent = '0';
  resultEl.style.display = 'none';
  startScreen.style.display = 'none';

  /* 카드 생성 */
  const chosen = shuffle(EMOJI_POOL).slice(0, diff.pairs);
  const deck   = shuffle([...chosen, ...chosen]);

  cardGrid.innerHTML = '';
  cardGrid.style.maxWidth = `${diff.cols * (getSzBase() + 10) - 10}px`;

  deck.forEach((emoji, idx) => {
    const card = document.createElement('div');
    card.className = `card sz-${currentDiff}`;
    card.dataset.emoji = emoji;
    card.innerHTML = `
      <div class="card-front"></div>
      <div class="card-back">${emoji}</div>
    `;
    card.style.animationDelay = `${idx * 30}ms`;
    card.addEventListener('click', () => onCardClick(card));
    cardGrid.appendChild(card);
    cards.push(card);
  });

  /* 타이머 시작 */
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameRunning) return;
    seconds++;
    timeEl.textContent = formatTime(seconds);
  }, 1000);
}

function getSzBase() {
  return currentDiff === 'easy' ? 76 : currentDiff === 'normal' ? 72 : 66;
}

/* ── 카드 클릭 ── */
function onCardClick(card) {
  if (!gameRunning || lockBoard) return;
  if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

  card.classList.add('flipped');
  flipped.push(card);

  if (flipped.length === 2) {
    lockBoard = true;
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }
}

function checkMatch() {
  const [a, b] = flipped;

  if (a.dataset.emoji === b.dataset.emoji) {
    /* 매치 성공 */
    setTimeout(() => {
      a.classList.add('matched');
      b.classList.add('matched');
      combo++;
      comboEl.textContent = combo;

      /* 콤보 애니메이션 */
      comboEl.classList.remove('bump');
      void comboEl.offsetWidth;
      comboEl.classList.add('bump');

      flipped = [];
      lockBoard = false;
      matched++;

      if (matched === DIFFS[currentDiff].pairs) {
        endGame(true);
      }
    }, 300);
  } else {
    /* 매치 실패 */
    combo = 0;
    comboEl.textContent = '0';
    setTimeout(() => {
      a.classList.remove('flipped');
      b.classList.remove('flipped');
      flipped = [];
      lockBoard = false;
    }, 800);
  }
}

/* ── 게임 종료 ── */
function endGame(win) {
  gameRunning = false;
  clearInterval(timerInterval);

  if (!win) return;

  /* 베스트 기록 업데이트 */
  const key  = `memory_best_${currentDiff}`;
  const prev = localStorage.getItem(key);
  let   isNew = false;

  if (!prev) {
    localStorage.setItem(key, JSON.stringify({ moves, time: seconds }));
    isNew = true;
  } else {
    const p = JSON.parse(prev);
    if (moves < p.moves || (moves === p.moves && seconds < p.time)) {
      localStorage.setItem(key, JSON.stringify({ moves, time: seconds }));
      isNew = true;
    }
  }

  const score = Math.max(0, 10000 - moves * 60 - seconds * 8 + matched * 50 + combo * 30);

  resultIcon.textContent = isNew ? '🏆' : '🎉';
  resultMsg.innerHTML =
    `${isNew ? '<strong style="color:var(--amber)">🆕 신기록!</strong><br>' : ''}` +
    `시간: <strong>${formatTime(seconds)}</strong> &nbsp;|&nbsp; 이동: <strong>${moves}번</strong><br>` +
    `점수: <strong>${score.toLocaleString()}</strong> &nbsp;|&nbsp; 최고콤보: <strong>${combo}</strong>`;

  resultEl.style.display = 'block';
  updateBestRow();
}

/* ── 버튼 ── */
startBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', () => {
  resultEl.style.display = 'none';
  startScreen.style.display = 'block';
  updateBestRow();
});

/* ── 초기화 ── */
updateBestRow();
