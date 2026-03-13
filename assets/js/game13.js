const HOLES = 9;
const GAME_TIME = 30;
const MOLES = ['🐹', '🐭', '🐻'];

let score, timeLeft, running;
let showTimers = [];
let countdownTimer;
let activeHoles = new Set();

function buildGrid() {
  const grid = document.getElementById('moleGrid');
  grid.innerHTML = '';
  for (let i = 0; i < HOLES; i++) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    hole.dataset.idx = i;

    const mole = document.createElement('div');
    mole.className = 'mole-char';
    mole.textContent = MOLES[Math.floor(Math.random() * MOLES.length)];

    hole.appendChild(mole);
    hole.addEventListener('click', () => whack(hole, i));
    grid.appendChild(hole);
  }
}

function whack(hole, idx) {
  if (!running || !activeHoles.has(idx)) return;

  activeHoles.delete(idx);
  hole.classList.remove('active');
  hole.classList.add('hit');
  setTimeout(() => hole.classList.remove('hit'), 300);

  score += 10;
  document.getElementById('score').textContent = score;

  // Score popup
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = '+10';
  hole.appendChild(pop);
  setTimeout(() => pop.remove(), 600);

  // Clear scheduled hide
  clearTimeout(showTimers[idx]);
  showTimers[idx] = null;
}

function peekMole() {
  if (!running) return;

  // Pick a random hole that isn't already active
  const inactive = [];
  for (let i = 0; i < HOLES; i++) {
    if (!activeHoles.has(i)) inactive.push(i);
  }
  if (!inactive.length) return;

  const idx = inactive[Math.floor(Math.random() * inactive.length)];
  const hole = document.querySelector(`.hole[data-idx="${idx}"]`);
  if (!hole) return;

  // Randomize mole emoji
  hole.querySelector('.mole-char').textContent = MOLES[Math.floor(Math.random() * MOLES.length)];

  activeHoles.add(idx);
  hole.classList.add('active');

  const peekDuration = 800 + Math.random() * 700;
  showTimers[idx] = setTimeout(() => {
    if (activeHoles.has(idx)) {
      activeHoles.delete(idx);
      hole.classList.remove('active');
    }
  }, peekDuration);

  // Next mole
  const nextDelay = 500 + Math.random() * 600;
  setTimeout(peekMole, nextDelay);
}

function startGame() {
  buildGrid();
  score = 0;
  timeLeft = GAME_TIME;
  running = true;
  activeHoles.clear();
  showTimers = Array(HOLES).fill(null);

  document.getElementById('score').textContent = 0;
  document.getElementById('timer').textContent = GAME_TIME;
  document.getElementById('overlay').classList.add('hidden');

  // Start mole peeking
  setTimeout(peekMole, 300);
  setTimeout(peekMole, 700);

  // Countdown
  countdownTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  running = false;
  clearInterval(countdownTimer);
  showTimers.forEach(t => clearTimeout(t));
  activeHoles.clear();

  // Hide all moles
  document.querySelectorAll('.hole').forEach(h => h.classList.remove('active'));

  const overlay = document.getElementById('overlay');
  document.getElementById('overlayTitle').textContent = '게임 종료!';
  document.getElementById('overlayMsg').textContent = `최종 점수: ${score}점`;
  document.querySelector('#overlay button').textContent = '다시 하기';
  overlay.classList.remove('hidden');
}

// Init
buildGrid();
