const phrases = ["빠르게 입력해보세요", "타이핑 속도를 테스트합니다", "게임을 즐겨보세요"];
let startTime = 0;

function startGame() {
  const target = phrases[Math.floor(Math.random() * phrases.length)];
  document.getElementById("targetText").textContent = target;
  document.getElementById("userInput").value = "";
  document.getElementById("result").textContent = "";
  document.getElementById("userInput").focus();
  startTime = new Date().getTime();
}

function checkTyping() {
  const input = document.getElementById("userInput").value;
  const target = document.getElementById("targetText").textContent;
  const result = document.getElementById("result");

  if (input === target) {
    const elapsed = (new Date().getTime() - startTime) / 1000;
    result.textContent = `정확히 입력했습니다! ⏱️ 걸린 시간: ${elapsed.toFixed(2)}초`;
  } else {
    result.textContent = "틀렸어요! 다시 시도해보세요.";
  }
}

document.getElementById("userInput").addEventListener("keyup", function (e) {
  if (e.key === "Enter") checkTyping();
});

startGame();
