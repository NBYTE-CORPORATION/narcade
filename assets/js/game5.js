/* game5.js — 동전 던지기 (짝수/홀수) */

// ── 상태 ──
let wins = 0, losses = 0, total = 0;
let flipping = false;

// ── DOM ──
const coin       = document.getElementById('coin');
const shadow     = document.getElementById('coinShadow');
const resultZone = document.getElementById('resultZone');
const replayBtn  = document.getElementById('replayBtn');
const btnEven    = document.getElementById('btnEven');
const btnOdd     = document.getElementById('btnOdd');
const statWin    = document.getElementById('statWin');
const statLose   = document.getElementById('statLose');
const statTotal  = document.getElementById('statTotal');

// ── UI 헬퍼 ──
function setButtons(enabled) {
  btnEven.disabled = !enabled;
  btnOdd.disabled  = !enabled;
}

// ── 동전 던지기 ──
function flipCoin(choice) {
  if (flipping) return;
  flipping = true;
  setButtons(false);

  // 유휴 애니메이션 중지
  coin.classList.remove('idle');
  coin.getAnimations().forEach(a => a.cancel());
  shadow.getAnimations().forEach(a => a.cancel());

  resultZone.textContent = '';
  resultZone.className   = 'result-zone';
  replayBtn.style.display = 'none';

  // 결과 계산 (1~100 랜덤)
  const num    = Math.floor(Math.random() * 100) + 1;
  const isEven = num % 2 === 0;

  // 회전 횟수: 4~6번 전체 회전
  const extraTurns = (4 + Math.floor(Math.random() * 3)) * 360;
  // 짝수=앞면(rotateX의 360 배수), 홀수=뒷면(+180)
  // 음수 방향으로 회전 (동전이 앞으로 넘어가는 느낌)
  const finalX = isEven ? -extraTurns : -(extraTurns + 180);

  // ── 동전 토스 애니메이션 (Web Animations API) ──
  const coinAnim = coin.animate([
    { transform: 'translateY(0px)   rotateX(0deg)',                   offset: 0    },
    { transform: `translateY(-90px)  rotateX(${finalX * 0.30}deg)`,  offset: 0.28 },
    { transform: `translateY(-130px) rotateX(${finalX * 0.52}deg)`,  offset: 0.45 },
    { transform: `translateY(-150px) rotateX(${finalX * 0.65}deg)`,  offset: 0.55 },
    { transform: `translateY(-80px)  rotateX(${finalX * 0.82}deg)`,  offset: 0.72 },
    { transform: `translateY(14px)   rotateX(${finalX * 0.97}deg)`,  offset: 0.90 },  // 바닥 충격
    { transform: `translateY(-5px)   rotateX(${finalX}deg)`,         offset: 0.95 },  // 튕김
    { transform: `translateY(0px)    rotateX(${finalX}deg)`,          offset: 1    },
  ], {
    duration: 1900,
    easing: 'ease-in',
    fill: 'forwards',
  });

  // ── 그림자 애니메이션 (올라갈수록 줄어들고, 내려올수록 커짐) ──
  shadow.animate([
    { width: '90px',  opacity: 0.35, filter: 'blur(7px)',  offset: 0    },
    { width: '38px',  opacity: 0.13, filter: 'blur(3px)',  offset: 0.50 },
    { width: '105px', opacity: 0.50, filter: 'blur(9px)',  offset: 0.90 },
    { width: '80px',  opacity: 0.30, filter: 'blur(6px)',  offset: 1    },
  ], {
    duration: 1900,
    easing: 'ease-in',
    fill: 'forwards',
  });

  coinAnim.onfinish = () => {
    total++;
    statTotal.textContent = total;

    const correct = (choice === 'even' && isEven) || (choice === 'odd' && !isEven);
    const label   = isEven ? '짝수' : '홀수';

    if (correct) {
      wins++;
      statWin.textContent = wins;
      resultZone.textContent = `🎉 정답! ${num}은(는) ${label}`;
      resultZone.className   = 'result-zone correct';
    } else {
      losses++;
      statLose.textContent = losses;
      resultZone.textContent = `😢 틀렸어요! ${num}은(는) ${label}`;
      resultZone.className   = 'result-zone wrong';
    }

    flipping = false;
    replayBtn.style.display = 'inline-block';
  };
}

// ── 다시 던지기 ──
function replay() {
  // 모든 Web Animation 취소 후 초기 상태 복원
  coin.getAnimations().forEach(a => a.cancel());
  shadow.getAnimations().forEach(a => a.cancel());

  coin.style.transform = '';
  shadow.style.cssText = 'width:90px;height:14px;background:rgba(0,0,0,0.35);border-radius:50%;filter:blur(7px);margin-top:6px;';

  resultZone.textContent  = '';
  resultZone.className    = 'result-zone';
  replayBtn.style.display = 'none';

  // 잠시 후 유휴 애니메이션 + 버튼 활성화
  setTimeout(() => {
    coin.classList.add('idle');
    setButtons(true);
  }, 80);
}

// ── 이벤트 연결 ──
btnEven.addEventListener('click',  () => flipCoin('even'));
btnOdd.addEventListener('click',   () => flipCoin('odd'));
replayBtn.addEventListener('click', replay);

// ── 초기 상태 ──
coin.classList.add('idle');
setButtons(true);
