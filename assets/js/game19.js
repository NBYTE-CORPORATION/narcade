/* ── game19.js — 카드 짝 맞추기 ── */
'use strict';

Arcade.init({ id: 'game19', title: '카드 짝 맞추기', emoji: '🃏', accent: 'pink' });

const cardGrid    = document.getElementById('cardGrid');
const timeEl      = document.getElementById('timeEl');
const movesEl     = document.getElementById('movesEl');
const comboEl     = document.getElementById('comboEl');
const startBtn    = document.getElementById('startBtn');
const startScreen = document.getElementById('startScreen');
const bestRow     = document.getElementById('bestRow');

const ov = Arcade.overlay('#overlay');

/* ── 이모지 풀 (20개) ── */
const EMOJI_POOL = [
  '🦊','🐼','🦁','🐸','🦋','🐬','🦄','🐙',
  '🌸','🍓','🍕','🎸','🚀','⚡','💎','🔮',
  '🎯','🏆','🌈','🎭',
];

/* ── 난이도 (레거시 memory_best_* 키와 같은 id 유지) ── */
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
let maxCombo = 0;
let gameRunning = false;
let seconds = 0;
let lockBoard = false;

currentDiff = Arcade.difficulty(
  document.getElementById('diffBtns'),
  [
    { id: 'easy',   label: '쉬움 3×4' },
    { id: 'normal', label: '보통 4×4' },
    { id: 'hard',   label: '어려움 4×5' },
  ],
  diff => {
    currentDiff = diff;
    updateBestRow();
    if (gameRunning) startGame(); /* 플레이 중 변경 → 새 판 */
  },
  { gameId: 'game19' }
);

/* ── 타이머 (Esc/탭 전환 자동 일시정지) ── */
const gameTimer = new Arcade.Timer({
  onTick(ms) {
    const s = Math.floor(ms / 1000);
    if (s !== seconds) {
      seconds = s;
      timeEl.textContent = formatTime(s);
    }
  },
});

Arcade.pause.register({ isActive: () => gameRunning });

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

/* 최고 기록: 레거시 {moves,time}과 신규 {score,moves} 모두 지원 */
function bestInfo(diff) {
  const v = Arcade.best.get('game19', { suffix: diff });
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return { time: v, moves: null };
  if (typeof v === 'object') {
    if (typeof v.score === 'number') return { time: v.score, moves: v.moves }; // 신규
    if (typeof v.time === 'number')  return { time: v.time,  moves: v.moves }; // 레거시
  }
  return null;
}

function updateBestRow() {
  const b = bestInfo(currentDiff);
  bestRow.textContent = b
    ? `최고기록: ${formatTime(b.time)}` + (b.moves != null ? ` · ${b.moves}번 이동` : '')
    : '';
}

/* ── 게임 시작 ── */
function startGame() {
  const diff = DIFFS[currentDiff];

  /* 상태 초기화 */
  cards = []; flipped = []; matched = 0;
  moves = 0; combo = 0; maxCombo = 0; seconds = 0;
  lockBoard = false; gameRunning = true;

  timeEl.textContent  = '0:00';
  movesEl.textContent = '0';
  comboEl.textContent = '0';
  startScreen.style.display = 'none';
  ov.hide();

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

  gameTimer.start();
}

function getSzBase() {
  return currentDiff === 'easy' ? 76 : currentDiff === 'normal' ? 72 : 66;
}

/* ── 카드 클릭 ── */
function onCardClick(card) {
  if (!gameRunning || lockBoard || Arcade.pause.active) return;
  if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

  card.classList.add('flipped');
  Arcade.audio.play('pop');
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
    Arcade.schedule(() => {
      a.classList.add('matched');
      b.classList.add('matched');
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      comboEl.textContent = combo;

      Arcade.audio.play('coin');
      if (combo >= 2) Arcade.audio.play('combo', { step: combo });

      /* 콤보 애니메이션 */
      comboEl.classList.remove('bump');
      void comboEl.offsetWidth;
      comboEl.classList.add('bump');

      flipped = [];
      lockBoard = false;
      matched++;

      if (matched === DIFFS[currentDiff].pairs) {
        endGame();
      }
    }, 300);
  } else {
    /* 매치 실패 */
    combo = 0;
    comboEl.textContent = '0';
    Arcade.audio.play('hit');
    Arcade.schedule(() => {
      a.classList.remove('flipped');
      b.classList.remove('flipped');
      flipped = [];
      lockBoard = false;
    }, 800);
  }
}

/* ── 게임 종료 ── */
function endGame() {
  gameRunning = false;
  gameTimer.stop();

  const finalTime = seconds;
  const res = Arcade.best.submit('game19', finalTime, {
    suffix: currentDiff,
    lowerIsBetter: true,
    meta: { moves: moves },
  });

  Arcade.audio.play('win');
  Arcade.Particles.domBurst(cardGrid, {
    count: 26,
    colors: ['#f472b6', '#f9a8d4', '#fbbf24', '#22d3ee'],
  });

  updateBestRow();
  const b = bestInfo(currentDiff);

  Arcade.schedule(() => {
    ov.show({
      emoji: res.isRecord ? '🏆' : '🎉',
      title: '클리어!',
      isRecord: res.isRecord,
      stats: [
        { label: '시간', value: formatTime(finalTime) },
        { label: '이동', value: moves + '번' },
        { label: '최대 콤보', value: maxCombo },
        { label: '최고 기록', value: b ? formatTime(b.time) : '—' },
      ],
      btnText: '다시 하기',
      onStart: startGame,
    });
  }, 700);
}

/* ── 버튼 ── */
startBtn.addEventListener('click', () => {
  Arcade.audio.play('click');
  startGame();
});

/* ── 초기화 ── */
updateBestRow();
