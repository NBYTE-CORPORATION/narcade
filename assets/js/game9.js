const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'cyan'];
let sequence = [];
let userInput = [];
let round = 9;

function startGame() {
  sequence = [];
  userInput = [];
  document.getElementById('result').textContent = '';
  document.getElementById('colorOptions').innerHTML = '';
  document.getElementById('colorSequence').innerHTML = '';
  for (let i = 0; i < round; i++) {
    sequence.push(colors[Math.floor(Math.random() * colors.length)]);
  }
  showSequence();
}

function showSequence() {
  const seqDiv = document.getElementById('colorSequence');
  sequence.forEach(color => {
    const box = document.createElement('div');
    box.className = 'color-box';
    box.style.backgroundColor = color;
    seqDiv.appendChild(box);
  });

  setTimeout(() => {
    seqDiv.innerHTML = '';
    showOptions();
  }, 4000);
}

function showOptions() {
  const optionsDiv = document.getElementById('colorOptions');
  colors.forEach(color => {
    const box = document.createElement('div');
    box.className = 'color-box';
    box.style.backgroundColor = color;
    box.onclick = () => selectColor(color);
    optionsDiv.appendChild(box);
  });
}

function selectColor(color) {
  userInput.push(color);
  if (userInput.length === sequence.length) {
    checkResult();
  }
}

function checkResult() {
  const result = document.getElementById('result');
  const isCorrect = sequence.every((c, i) => c === userInput[i]);
  result.textContent = isCorrect ? '정답입니다! 🎉' : '틀렸어요! 😢';
}
