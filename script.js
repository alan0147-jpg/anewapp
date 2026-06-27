const questions = [
  {
    text: "哪個數字加上自己，再乘以自己，會得到 36？",
    choices: ["3", "4", "5", "6"],
    answer: "3",
    note: "3 + 3 = 6，6 x 6 = 36。",
  },
  {
    text: "一個時鐘 3:15 時，時針和分針大約相差幾度？",
    choices: ["0 度", "7.5 度", "15 度", "30 度"],
    answer: "7.5 度",
    note: "3:15 時，時針已經往 4 點移動了四分之一格。",
  },
  {
    text: "找規律：2、6、12、20、30，下一個是？",
    choices: ["36", "40", "42", "44"],
    answer: "42",
    note: "差距是 4、6、8、10，下一個差距是 12。",
  },
  {
    text: "小明有 5 顆糖，吃掉 2 顆，又得到原本數量的一半，他現在有幾顆？",
    choices: ["4.5", "5", "5.5", "6"],
    answer: "5.5",
    note: "5 - 2 + 2.5 = 5.5。",
  },
  {
    text: "哪個字倒過來看還是同一個數字？",
    choices: ["6", "8", "9", "12"],
    answer: "8",
    note: "8 上下倒過來仍然像 8。",
  },
  {
    text: "如果今天是星期三，100 天後是星期幾？",
    choices: ["星期五", "星期六", "星期日", "星期一"],
    answer: "星期五",
    note: "100 除以 7 餘 2，星期三往後兩天是星期五。",
  },
  {
    text: "三個連續偶數相加是 42，最大的數是？",
    choices: ["12", "14", "16", "18"],
    answer: "16",
    note: "12 + 14 + 16 = 42。",
  },
  {
    text: "哪一個不是質數？",
    choices: ["17", "19", "21", "23"],
    answer: "21",
    note: "21 = 3 x 7。",
  },
  {
    text: "A 比 B 多 6，B 比 C 多 4，如果 C 是 10，A 是？",
    choices: ["16", "18", "20", "22"],
    answer: "20",
    note: "B 是 14，A 是 20。",
  },
  {
    text: "找規律：1、1、2、3、5、8，下一個是？",
    choices: ["11", "12", "13", "15"],
    answer: "13",
    note: "每個數字都是前兩個數字相加。",
  },
];

const state = {
  current: 0,
  score: 0,
  streak: 0,
  timeLeft: 20,
  timer: null,
  answered: false,
};

const scoreEl = document.querySelector("#score");
const roundEl = document.querySelector("#round");
const totalEl = document.querySelector("#total");
const timeEl = document.querySelector("#time");
const streakEl = document.querySelector("#streak");
const questionEl = document.querySelector("#question");
const answersEl = document.querySelector("#answers");
const feedbackEl = document.querySelector("#feedback");
const startBtn = document.querySelector("#startBtn");
const nextBtn = document.querySelector("#nextBtn");

totalEl.textContent = questions.length;

function startGame() {
  state.current = 0;
  state.score = 0;
  state.streak = 0;
  startBtn.hidden = true;
  nextBtn.hidden = true;
  updateStats();
  showQuestion();
}

function showQuestion() {
  const question = questions[state.current];
  state.answered = false;
  state.timeLeft = 20;
  feedbackEl.textContent = "";
  questionEl.textContent = question.text;
  answersEl.innerHTML = "";
  nextBtn.hidden = true;

  question.choices.forEach((choice) => {
    const button = document.createElement("button");
    button.className = "answer";
    button.type = "button";
    button.textContent = choice;
    button.addEventListener("click", () => chooseAnswer(button, choice));
    answersEl.append(button);
  });

  updateStats();
  startTimer();
}

function startTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.timeLeft -= 1;
    timeEl.textContent = state.timeLeft;

    if (state.timeLeft <= 0) {
      finishQuestion(null);
    }
  }, 1000);
}

function chooseAnswer(button, choice) {
  if (state.answered) return;
  finishQuestion(choice, button);
}

function finishQuestion(choice, selectedButton) {
  const question = questions[state.current];
  const isCorrect = choice === question.answer;
  state.answered = true;
  clearInterval(state.timer);

  document.querySelectorAll(".answer").forEach((button) => {
    button.disabled = true;
    if (button.textContent === question.answer) {
      button.classList.add("correct");
    }
  });

  if (selectedButton && !isCorrect) {
    selectedButton.classList.add("wrong");
  }

  if (isCorrect) {
    state.score += 10 + Math.max(state.timeLeft, 0);
    state.streak += 1;
    feedbackEl.textContent = `答對了！${question.note}`;
  } else {
    state.streak = 0;
    feedbackEl.textContent = choice
      ? `差一點。正確答案是「${question.answer}」。${question.note}`
      : `時間到。正確答案是「${question.answer}」。${question.note}`;
  }

  updateStats();
  nextBtn.textContent = state.current === questions.length - 1 ? "查看結果" : "下一題";
  nextBtn.hidden = false;
}

function nextQuestion() {
  if (state.current < questions.length - 1) {
    state.current += 1;
    showQuestion();
    return;
  }

  clearInterval(state.timer);
  questionEl.textContent = `挑戰完成！你的總分是 ${state.score} 分。`;
  answersEl.innerHTML = "";
  feedbackEl.textContent = state.score >= 180 ? "腦力全開，這成績很漂亮。" : "做得不錯，再玩一次可以衝更高分。";
  startBtn.textContent = "再玩一次";
  startBtn.hidden = false;
  nextBtn.hidden = true;
}

function updateStats() {
  scoreEl.textContent = state.score;
  roundEl.textContent = Math.min(state.current + 1, questions.length);
  timeEl.textContent = state.timeLeft;
  streakEl.textContent = state.streak;
}

startBtn.addEventListener("click", startGame);
nextBtn.addEventListener("click", nextQuestion);
