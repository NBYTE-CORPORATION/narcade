let numberToRemember = "";

function startGame() {
  numberToRemember = "";
  for (let i = 0; i < 11; i++) {
    numberToRemember += Math.floor(Math.random() * 10);
  }
  const display = document.getElementById('display');
  const input = document.getElementById('userInput');
  const result = document.getElementById('result');

  display.textContent = numberToRemember;
  input.value = '';
  input.disabled = true;
  result.textContent = '';

  setTimeout(() => {
    display.textContent = "숫자를 입력하세요!";
    input.disabled = false;
    input.focus();
  }, 3000);
}

function checkAnswer() {
  const userInput = document.getElementById('userInput').value;
  const result = document.getElementById('result');

  if (userInput === numberToRemember) {
    result.textContent = "정답입니다! 🎉";
  } else {
    result.textContent = `틀렸어요! 정답은 ${numberToRemember}`;
  }
}

document.getElementById('userInput').addEventListener('keyup', function(event) {
  if (event.key === 'Enter') {
    checkAnswer();
  }
});

startGame();
