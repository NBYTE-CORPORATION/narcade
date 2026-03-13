/* game4.js — 3D 주사위 게임 */

// ── 상태 ──
let scorePlayer = 0, scoreCpu = 0, rolling = false;

// ── DOM ──
const cubePlayer  = document.getElementById('cubePlayer');
const cubeCpu     = document.getElementById('cubeCpu');
const numPlayer   = document.getElementById('numPlayer');
const numCpu      = document.getElementById('numCpu');
const scoreP      = document.getElementById('scorePlayer');
const scoreC      = document.getElementById('scoreCpu');
const resultBadge = document.getElementById('resultBadge');
const roundText   = document.getElementById('roundText');
const rollBtn     = document.getElementById('rollBtn');

// ── 각 면의 점 배치 (3×3 그리드, 1~9 위치) ──
// 1=상좌, 2=상중, 3=상우, 4=중좌, 5=중중, 6=중우, 7=하좌, 8=하중, 9=하우
const DOT_POSITIONS = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

// ── CSS 클래스 → 면 숫자 (표준 주사위: 마주보는 면의 합 = 7) ──
const FACE_VALUE = {
  front: 1, back: 6,
  right: 2, left: 5,
  top: 3, bottom: 4,
};

// ── 각 숫자를 정면으로 보이기 위한 큐브 회전각 [rotateX, rotateY] ──
const FACE_ROT = {
  1: [0,    0  ],
  2: [0,   -90 ],
  3: [-90,  0  ],
  4: [90,   0  ],
  5: [0,    90 ],
  6: [0,    180],
};

// ── 면에 점 그리기 ──
function buildFace(faceEl, value) {
  faceEl.innerHTML = '';
  const activeDots = DOT_POSITIONS[value] || [];
  for (let i = 1; i <= 9; i++) {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;align-items:center;justify-content:center;';
    if (activeDots.includes(i)) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      cell.appendChild(dot);
    }
    faceEl.appendChild(cell);
  }
}

// ── 두 주사위 초기화 ──
function initDice() {
  [cubePlayer, cubeCpu].forEach(cube => {
    ['front','back','right','left','top','bottom'].forEach(cls => {
      buildFace(cube.querySelector('.' + cls), FACE_VALUE[cls]);
    });
  });
}

// ── 주사위 굴리기 애니메이션 (Promise 반환) ──
function rollCubeTo(cube, value, delay = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      const [bx, by] = FACE_ROT[value];
      // 2~3번 추가 회전으로 자연스러운 굴림감
      const extraTurns = (2 + Math.floor(Math.random() * 2)) * 360;

      // 즉시 원점으로 리셋
      cube.style.transition = 'none';
      cube.style.transform  = 'rotateX(0deg) rotateY(0deg)';

      // 리플로우 강제
      cube.offsetHeight;

      // 타겟으로 부드럽게 회전
      const dur = 0.85 + Math.random() * 0.35;
      cube.style.transition = `transform ${dur}s cubic-bezier(0.15, 0.82, 0.25, 1)`;
      cube.style.transform  = `rotateX(${bx + extraTurns}deg) rotateY(${by + extraTurns}deg)`;

      setTimeout(resolve, dur * 1000 + 50);
    }, delay);
  });
}

// ── 게임 로직 ──
async function rollDice() {
  if (rolling) return;
  rolling = true;
  rollBtn.disabled = true;

  resultBadge.textContent = '';
  resultBadge.className   = 'result-badge';
  numPlayer.textContent   = '?';
  numCpu.textContent      = '?';
  roundText.textContent   = '굴리는 중…';

  const pVal = Math.ceil(Math.random() * 6);
  const cVal = Math.ceil(Math.random() * 6);

  // 두 주사위 동시 굴리기 (CPU는 살짝 딜레이)
  await Promise.all([
    rollCubeTo(cubePlayer, pVal, 0),
    rollCubeTo(cubeCpu,    cVal, 90),
  ]);

  numPlayer.textContent = pVal;
  numCpu.textContent    = cVal;

  if (pVal > cVal) {
    scorePlayer++;
    scoreP.textContent = scorePlayer;
    // 점수 팝 애니메이션
    scoreP.style.transform = 'scale(1.4)';
    setTimeout(() => scoreP.style.transform = '', 250);
    resultBadge.textContent = '🎉 승리!';
    resultBadge.className   = 'result-badge win';
    roundText.textContent   = `${pVal} vs ${cVal} — 당신이 이겼습니다!`;
  } else if (pVal < cVal) {
    scoreCpu++;
    scoreC.textContent = scoreCpu;
    scoreC.style.transform = 'scale(1.4)';
    setTimeout(() => scoreC.style.transform = '', 250);
    resultBadge.textContent = '😢 패배';
    resultBadge.className   = 'result-badge lose';
    roundText.textContent   = `${pVal} vs ${cVal} — CPU가 이겼습니다`;
  } else {
    resultBadge.textContent = '🤝 무승부';
    resultBadge.className   = 'result-badge draw';
    roundText.textContent   = `${pVal} vs ${cVal} — 무승부!`;
  }

  rolling = false;
  rollBtn.disabled = false;
}

function resetGame() {
  if (rolling) return;
  scorePlayer = 0; scoreCpu = 0;
  scoreP.textContent = '0'; scoreC.textContent = '0';
  numPlayer.textContent = '—'; numCpu.textContent = '—';
  resultBadge.textContent = '';
  resultBadge.className   = 'result-badge';
  roundText.textContent   = '버튼을 눌러 시작하세요';
  [cubePlayer, cubeCpu].forEach(cube => {
    cube.style.transition = 'transform 0.6s ease';
    cube.style.transform  = 'rotateX(-22deg) rotateY(28deg)';
  });
}

// ── 이벤트 ──
rollBtn.addEventListener('click', rollDice);
document.getElementById('resetBtn').addEventListener('click', resetGame);

// ── 시작 ──
initDice();
