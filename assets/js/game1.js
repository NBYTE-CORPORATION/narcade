const answer = Math.floor(Math.random() * 100) + 1;

function checkGuess() {
  const guess = parseInt(document.getElementById('guess').value);
  const result = document.getElementById('result');
  
  if (guess === answer) {
    result.textContent = "정답입니다! 🎉";
  } else if (guess > answer) {
    result.textContent = "너무 커요!";
  } else {
    result.textContent = "너무 작아요!";
  }
}
