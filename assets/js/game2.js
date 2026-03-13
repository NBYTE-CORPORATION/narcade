/* game2.js — 클릭 게임 */

let score = 0, timeLeft = 10;
let countdown;

const scoreEl  = document.getElementById('score');
const timerEl  = document.getElementById('timer');
const clickBtn = document.getElementById('clickBtn');
const retryBtn = document.getElementById('retryBtn');
const finalMsg = document.getElementById('finalMsg');

// 클릭 카운팅
clickBtn.addEventListener('click', () => {
  if (timeLeft <= 0) return;
  score++;
  scoreEl.textContent = score;
});

function startGame() {
  score    = 0;
  timeLeft = 10;
  scoreEl.textContent  = '0';
  timerEl.textContent  = '10';
  finalMsg.textContent = '';
  retryBtn.style.display = 'none';
  clickBtn.disabled      = false;
  clickBtn.textContent   = '클릭!';
  clearInterval(countdown);

  countdown = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(countdown);
      clickBtn.disabled    = true;
      clickBtn.textContent = '종료!';
      const rating = score >= 70 ? '🔥 최고예요!' : score >= 50 ? '⚡ 굉장해요!' : score >= 35 ? '👍 잘했어요!' : '😊 다시 도전!';
      finalMsg.textContent   = `최종 ${score}번! ${rating}`;
      retryBtn.style.display = 'inline-block';
    }
  }, 1000);
}

retryBtn.addEventListener('click', startGame);
startGame();
