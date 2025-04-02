let startTime, timeoutId;
const message = document.getElementById('message');

function startTest() {
  message.textContent = "초록색으로 바뀌면 클릭하세요!";
  document.body.style.backgroundColor = "#222";

  const delay = Math.random() * 3000 + 2000;

  timeoutId = setTimeout(() => {
    document.body.style.backgroundColor = "#4caf50";
    message.textContent = "지금 클릭!";
    startTime = new Date();
    document.body.onclick = recordReaction;
  }, delay);
}

function recordReaction() {
  if (!startTime) return;
  const reactionTime = new Date() - startTime;
  message.textContent = `반응 속도: ${reactionTime}ms`;
  document.body.style.backgroundColor = "#222";
  document.body.onclick = null;
}

function resetTest() {
  clearTimeout(timeoutId);
  startTime = null;
  message.textContent = "버튼을 눌러 시작하세요!";
  document.body.style.backgroundColor = "#222";
  document.body.onclick = null;
}
