const canvas = document.getElementById('snakeCanvas');
const ctx = canvas.getContext('2d');

const GRID = 20;
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;

let snake, dir, nextDir, food, score, bestScore, running, loop;

const COLORS = {
  head:  '#a78bfa',
  body:  '#7c3aed',
  food:  '#f59e0b',
  grid:  'rgba(255,255,255,0.03)',
};

function init() {
  snake = [
    { x: 10, y: 10 },
    { x: 9,  y: 10 },
    { x: 8,  y: 10 },
  ];
  dir     = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score   = 0;
  bestScore = parseInt(localStorage.getItem('snake_best') || '0');
  updateScore();
  placeFood();
}

function placeFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

function updateScore() {
  document.getElementById('score').textContent = score;
  document.getElementById('bestScore').textContent = bestScore;
}

function drawGrid() {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * GRID, 0);
    ctx.lineTo(x * GRID, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * GRID);
    ctx.lineTo(canvas.width, y * GRID);
    ctx.stroke();
  }
}

function drawSnake() {
  snake.forEach((seg, i) => {
    const r = 5;
    const x = seg.x * GRID + 1;
    const y = seg.y * GRID + 1;
    const w = GRID - 2;

    ctx.fillStyle = i === 0 ? COLORS.head : COLORS.body;
    ctx.globalAlpha = i === 0 ? 1 : 0.85 - (i / snake.length) * 0.4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, w, r);
    ctx.fill();

    // Eye on head
    if (i === 0) {
      ctx.fillStyle = '#07070f';
      ctx.globalAlpha = 1;
      const ex = x + (dir.x === -1 ? 4 : dir.x === 1 ? w - 8 : w / 2 - 4);
      const ey = y + (dir.y === -1 ? 4 : dir.y === 1 ? w - 8 : w / 2 - 4);
      ctx.beginPath();
      ctx.arc(ex + 2, ey + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

function drawFood() {
  const x = food.x * GRID + GRID / 2;
  const y = food.y * GRID + GRID / 2;
  const r = GRID / 2 - 2;

  // Glow
  ctx.shadowColor = COLORS.food;
  ctx.shadowBlur = 14;
  ctx.fillStyle = COLORS.food;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
}

function tick() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    return gameOver();
  }
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    return gameOver();
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('snake_best', bestScore);
    }
    updateScore();
    placeFood();
  } else {
    snake.pop();
  }

  render();
}

function gameOver() {
  running = false;
  clearInterval(loop);

  const overlay = document.getElementById('overlay');
  document.getElementById('overlayTitle').textContent = '게임 오버';
  document.getElementById('overlayMsg').textContent = `점수: ${score}`;
  document.getElementById('startBtn').textContent = '다시 하기';
  overlay.classList.remove('hidden');
}

function startGame() {
  init();
  render();
  document.getElementById('overlay').classList.add('hidden');
  running = true;
  clearInterval(loop);
  loop = setInterval(tick, 120);
}

function setDir(x, y) {
  if (!running) return;
  if (x === -dir.x && y === -dir.y) return;
  nextDir = { x, y };
}

document.addEventListener('keydown', e => {
  const map = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  const mapped = map[e.key];
  if (mapped) {
    e.preventDefault();
    setDir(...mapped);
  }
});

// Init display
init();
render();
