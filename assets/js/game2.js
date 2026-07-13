/* game2.js — 클릭 게임 */

Arcade.init({ id: 'game2', title: '클릭 게임', emoji: '🖱️', accent: 'pink' });

let score = 0;
let running = false;
let lastSec = 10;

const scoreEl  = document.getElementById('score');
const timerEl  = document.getElementById('timer');
const bestEl   = document.getElementById('best');
const clickBtn = document.getElementById('clickBtn');
const finalMsg = document.getElementById('finalMsg');
const ov = Arcade.overlay('#overlay');

const timer = new Arcade.Timer({
  duration: 10000,
  onTick(left) {
    const sec = Math.ceil(left / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      timerEl.textContent = sec;
      if (sec > 0 && sec <= 3) Arcade.audio.play('tick');
    }
  },
  onEnd: endGame
});

Arcade.pause.register({ isActive: () => running });

function renderBest() {
  const best = Arcade.best.score('game2');
  bestEl.textContent = best === null ? '-' : best;
}

// 클릭 카운팅
clickBtn.addEventListener('click', () => {
  if (!running) return;
  score++;
  scoreEl.textContent = score;
  Arcade.audio.play('pop');
});

function rating(n) {
  if (n >= 70) return '🔥 최고예요!';
  if (n >= 50) return '⚡ 굉장해요!';
  if (n >= 35) return '👍 잘했어요!';
  return '😊 다시 도전!';
}

function endGame() {
  running = false;
  clickBtn.disabled    = true;
  clickBtn.textContent = '종료!';
  const { isRecord } = Arcade.best.submit('game2', score);
  const best = Arcade.best.score('game2');
  finalMsg.textContent = `최종 ${score}번! ${rating(score)}`;
  renderBest();
  Arcade.audio.play('win');
  Arcade.Particles.domBurst(clickBtn, { count: 18 });

  setTimeout(() => {
    ov.show({
      emoji: '🏁',
      title: '시간 종료!',
      isRecord,
      msg: rating(score) + `\n초당 ${(score / 10).toFixed(1)}회 클릭했어요.`,
      stats: [
        { label: '클릭', value: score },
        { label: '최고 기록', value: best === null ? '-' : best }
      ],
      btnText: '다시하기',
      onStart: startGame
    });
  }, 800);
}

function startGame() {
  score   = 0;
  running = true;
  lastSec = 10;
  scoreEl.textContent  = '0';
  timerEl.textContent  = '10';
  finalMsg.textContent = '';
  clickBtn.disabled      = false;
  clickBtn.textContent   = '클릭!';
  timer.start();
}

renderBest();

ov.show({
  emoji: '🖱️',
  title: '클릭 게임',
  msg: '10초 안에 최대한 많이 클릭하세요!\n버튼을 누르면 바로 시작돼요.',
  btnText: '시작하기',
  onStart: startGame
});
