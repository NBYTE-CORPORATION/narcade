let current = 1;
let startTime = 0;

function startGame() {
  const grid = document.getElementById('grid');
  const result = document.getElementById('result');
  result.textContent = '';
  current = 1;
  startTime = 0;

  const numbers = Array.from({ length: 9 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  grid.innerHTML = '';
  numbers.forEach(n => {
    const btn = document.createElement('button');
    btn.textContent = n;
    btn.className = 'grid-btn';
    btn.onclick = () => handleClick(n, btn);
    grid.appendChild(btn);
  });
}

function handleClick(number, btn) {
  if (number === current) {
    if (current === 1) {
      startTime = new Date().getTime();
    }
    btn.disabled = true;
    current++;
    if (current > 9) {
      const timeTaken = ((new Date().getTime() - startTime) / 1000).toFixed(2);
      document.getElementById('result').textContent = `성공! ⏱️ ${timeTaken}초 걸렸어요`;
    }
  } else {
    document.getElementById('result').textContent = '틀렸어요! 😢';
  }
}

startGame();
