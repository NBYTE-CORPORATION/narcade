let correctAnswer = 0;
let currentOperator = '+';

function newQuestion() {
  const a = Math.floor(Math.random() * 900) + 100;
  const b = Math.floor(Math.random() * 900) + 100;
  const operators = ['+', '-', '*', '/'];
  currentOperator = operators[Math.floor(Math.random() * operators.length)];

  let question = `${a} ${currentOperator} ${b}`;
  switch (currentOperator) {
    case '+': correctAnswer = a + b; break;
    case '-': correctAnswer = a - b; break;
    case '*': correctAnswer = a * b; break;
    case '/': 
      correctAnswer = Math.floor(a / b);
      question = `${a} ÷ ${b} (몫)`;  // 몫만 구하게
      break;
  }

  document.getElementById("question").textContent = question + " = ?";
  document.getElementById("answer").value = "";
  document.getElementById("result").textContent = "";
  document.getElementById("answer").focus();
}

function checkAnswer() {
  const userAnswer = parseInt(document.getElementById("answer").value);
  const result = document.getElementById("result");

  if (userAnswer === correctAnswer) {
    result.textContent = "정답입니다! 🎉";
  } else {
    result.textContent = `틀렸어요! 정답은 ${correctAnswer} 입니다.`;
  }
}

document.getElementById("answer").addEventListener("keyup", function (e) {
  if (e.key === "Enter") checkAnswer();
});

newQuestion();
