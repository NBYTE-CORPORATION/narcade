let score = 0;
let timeLeft = 10;
let countdown;
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const clickBtn = document.getElementById('clickBtn');
const retryBtn = document.getElementById('retryBtn');

clickBtn.addEventListener('click', () => {
  if (timeLeft > 0) {
    score++;
    scoreDisplay.textContent = score;
  }
});

function startGame() {
  score = 0;
  timeLeft = 10;
  scoreDisplay.textContent = score;
  timerDisplay.textContent = `남은 시간: ${timeLeft}초`;
  retryBtn.style.display = "none";
  clickBtn.disabled = false;

  countdown = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = `남은 시간: ${timeLeft}초`;

    if (timeLeft <= 0) {
      clearInterval(countdown);
      timerDisplay.textContent = `게임 종료! 최종 점수: ${score}`;
      retryBtn.style.display = "inline-block";
      clickBtn.disabled = true;
    }
  }, 1000);
}

retryBtn.addEventListener('click', startGame);

// 첫 시작
startGame();
