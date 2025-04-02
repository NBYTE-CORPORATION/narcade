function rollDice() {
  const user = Math.floor(Math.random() * 6) + 1;
  const cpu = Math.floor(Math.random() * 6) + 1;
  const result = document.getElementById('result');
  let msg = `당신: ${user} vs 컴퓨터: ${cpu} → `;

  if (user > cpu) msg += "승리! 🎉";
  else if (user < cpu) msg += "패배! 😢";
  else msg += "무승부! 🤝";

  result.textContent = msg;
}

function resetGame() {
  document.getElementById('result').textContent = '';
}
