function choose(choice) {
  const num = Math.floor(Math.random() * 100);
  const actual = num % 2 === 0 ? 'even' : 'odd';
  const result = document.getElementById('result');
  const label = actual === 'even' ? '짝수' : '홀수';

  if (choice === actual) {
    result.textContent = `숫자 ${num} → 정답입니다! (${label}) 🎉`;
  } else {
    result.textContent = `숫자 ${num} → 틀렸어요! (${label}) 😢`;
  }
}

function resetGame() {
  document.getElementById('result').textContent = '';
}
