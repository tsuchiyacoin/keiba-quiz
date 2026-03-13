// 状態管理
let currentQuestion = 0;
let score = 0;
let answered = false;
let shuffledQuiz = [];
let timer = null;
let timeLeft = 0;
let combo = 0;
let maxCombo = 0;
let wrongList = [];
let isReviewMode = false;
const TIME_LIMIT = 15;

// 称号データ
const TITLES = [
  { min: 0, name: '見習いファン', icon: '🐴' },
  { min: 10, name: '競馬ファン', icon: '🏇' },
  { min: 30, name: '馬券師', icon: '🎫' },
  { min: 60, name: '競馬通', icon: '🏆' },
  { min: 100, name: '競馬マスター', icon: '👑' },
  { min: 200, name: '伝説の予想家', icon: '🔥' },
];

// 画面切り替え
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// 安全なJSONパース
function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

// 問題データ取得
function getQuizData() {
  const saved = localStorage.getItem('keiba-quiz-questions');
  return saved ? safeJsonParse(saved, quizData) : quizData;
}

// 累計正解数の管理
function getTotalCorrect() {
  return parseInt(localStorage.getItem('keiba-total-correct') || '0');
}
function addTotalCorrect(n) {
  const total = getTotalCorrect() + n;
  localStorage.setItem('keiba-total-correct', total);
  return total;
}

// 現在の称号を取得
function getCurrentTitle() {
  const total = getTotalCorrect();
  let title = TITLES[0];
  for (const t of TITLES) {
    if (total >= t.min) title = t;
  }
  return title;
}

// スタート画面に称号表示
function updateStartScreen() {
  const title = getCurrentTitle();
  const total = getTotalCorrect();
  const el = document.getElementById('player-title');
  if (el) {
    el.textContent = '';
    const titleText = document.createTextNode(`${title.icon} ${title.name} `);
    const countSpan = document.createElement('span');
    countSpan.className = 'title-count';
    countSpan.textContent = `累計${total}問正解`;
    el.appendChild(titleText);
    el.appendChild(countSpan);
  }
}

// クイズ開始
function startQuiz() {
  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  answered = false;
  wrongList = [];
  isReviewMode = false;
  shuffledQuiz = shuffleArray([...getQuizData()]);
  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  showScreen('quiz-screen');
  loadQuestion();
}

// 復習モード
function startReview() {
  if (wrongList.length === 0) return;
  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  answered = false;
  isReviewMode = true;
  shuffledQuiz = shuffleArray([...wrongList]);
  wrongList = [];
  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  showScreen('quiz-screen');
  loadQuestion();
}

// 問題読み込み
function loadQuestion() {
  answered = false;
  const q = shuffledQuiz[currentQuestion];
  document.getElementById('question-num').textContent = currentQuestion + 1;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('result-msg').textContent = '';
  document.getElementById('result-msg').className = 'result-msg';
  document.getElementById('next-btn').style.display = 'none';
  document.getElementById('combo-label').textContent = '';
  document.getElementById('combo-label').className = 'combo-label';

  const expEl = document.getElementById('explanation');
  expEl.textContent = '';
  expEl.classList.remove('show');

  const pct = (currentQuestion / shuffledQuiz.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';

  startTimer();

  const choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];
  const indices = shuffleArray([0, 1, 2, 3]);

  indices.forEach((origIdx, displayIdx) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'choice-label';
    labelSpan.textContent = labels[displayIdx];
    btn.appendChild(labelSpan);
    btn.appendChild(document.createTextNode(q.choices[origIdx]));
    btn.dataset.origIdx = origIdx;
    btn.onclick = () => selectAnswer(btn, origIdx, q.answer, choicesEl);
    choicesEl.appendChild(btn);
  });
}

// タイマー
let tickPlayed = { 3: false, 2: false, 1: false };

function startTimer() {
  stopTimer();
  timeLeft = TIME_LIMIT * 10;
  tickPlayed = { 3: false, 2: false, 1: false };
  const fill = document.getElementById('timer-fill');
  fill.style.width = '100%';
  fill.className = 'timer-fill';

  timer = setInterval(() => {
    timeLeft--;
    const pct = (timeLeft / (TIME_LIMIT * 10)) * 100;
    fill.style.width = pct + '%';

    if (pct <= 20) {
      fill.className = 'timer-fill danger';
    } else if (pct <= 50) {
      fill.className = 'timer-fill warning';
    }

    // 残り3秒からtick音
    const secLeft = Math.ceil(timeLeft / 10);
    if (secLeft <= 3 && secLeft > 0 && !tickPlayed[secLeft] && timeLeft % 10 === 0) {
      tickPlayed[secLeft] = true;
      playSound('tick');
    }

    if (timeLeft <= 0) {
      onTimeUp();
    }
  }, 100);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// 時間切れ
function onTimeUp() {
  if (answered) return;
  stopTimer();
  answered = true;

  const q = shuffledQuiz[currentQuestion];
  const fill = document.getElementById('timer-fill');
  fill.classList.add('timeup');

  const container = document.getElementById('choices');
  const buttons = container.querySelectorAll('.choice-btn');
  const msgEl = document.getElementById('result-msg');

  buttons.forEach(b => {
    b.classList.add('disabled');
    if (parseInt(b.dataset.origIdx) === q.answer) b.classList.add('correct');
  });

  msgEl.textContent = '時間切れ！';
  msgEl.className = 'result-msg timeup';

  // コンボリセット
  combo = 0;
  updateComboDisplay();
  wrongList.push(q);

  playSound('timeup');
  vibrate(200);
  showExplanation(q);
  document.getElementById('next-btn').style.display = 'block';
}

// 回答選択
function selectAnswer(btn, selected, correct, container) {
  if (answered) return;
  answered = true;
  stopTimer();

  const q = shuffledQuiz[currentQuestion];
  const buttons = container.querySelectorAll('.choice-btn');
  const msgEl = document.getElementById('result-msg');

  buttons.forEach(b => {
    b.classList.add('disabled');
    if (parseInt(b.dataset.origIdx) === correct) b.classList.add('correct');
  });

  if (selected === correct) {
    btn.classList.add('correct');
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    // コンボ判定
    let comboText = '';
    if (combo >= 7) {
      comboText = 'UNSTOPPABLE!!';
      msgEl.textContent = '正解！';
      msgEl.className = 'result-msg correct';
      playSound('combo');
      vibrate([50, 30, 50, 30, 50]);
    } else if (combo >= 5) {
      comboText = 'PERFECT!';
      msgEl.textContent = '正解！';
      msgEl.className = 'result-msg correct';
      playSound('combo');
      vibrate([50, 30, 50]);
    } else if (combo >= 3) {
      comboText = 'GREAT!';
      msgEl.textContent = '正解！';
      msgEl.className = 'result-msg correct';
      playSound('combo');
      vibrate([50, 30]);
    } else {
      msgEl.textContent = '正解！';
      msgEl.className = 'result-msg correct';
      playSound('correct');
      vibrate(30);
    }

    // スコア計算（コンボ倍率）
    let multiplier = 1;
    if (combo >= 5) multiplier = 2;
    else if (combo >= 3) multiplier = 1.5;

    score += multiplier;
    document.getElementById('current-score').textContent = Math.floor(score);

    updateComboDisplay(comboText, multiplier);
  } else {
    btn.classList.add('wrong');
    msgEl.textContent = '不正解...';
    msgEl.className = 'result-msg wrong';
    combo = 0;
    updateComboDisplay();
    wrongList.push(q);
    playSound('wrong');
    vibrate(200);
  }

  document.getElementById('current-score').parentElement.classList.add('pop');
  setTimeout(() => {
    document.getElementById('current-score').parentElement.classList.remove('pop');
  }, 300);

  showExplanation(q);
  document.getElementById('next-btn').style.display = 'block';
}

// コンボ表示更新
function updateComboDisplay(text, multiplier) {
  const comboDisplay = document.getElementById('combo-display');
  const comboLabel = document.getElementById('combo-label');

  if (combo >= 2) {
    comboDisplay.style.display = 'flex';
    comboDisplay.textContent = `${combo} COMBO`;
    comboDisplay.classList.add('pop');
    setTimeout(() => comboDisplay.classList.remove('pop'), 300);
  } else {
    comboDisplay.style.display = 'none';
  }

  if (text) {
    comboLabel.textContent = `${text} ×${multiplier}`;
    comboLabel.className = 'combo-label show';
    if (combo >= 5) comboLabel.classList.add('rainbow');
  } else {
    comboLabel.textContent = '';
    comboLabel.className = 'combo-label';
  }
}

// 解説表示
function showExplanation(q) {
  const expEl = document.getElementById('explanation');
  if (q.explanation) {
    expEl.textContent = q.explanation;
    expEl.classList.add('show');
  }
}

// 次の問題
function nextQuestion() {
  currentQuestion++;
  if (currentQuestion >= shuffledQuiz.length) {
    showResult();
  } else {
    loadQuestion();
  }
}

// 結果表示
function showResult() {
  stopTimer();
  const finalScore = Math.floor(score);
  const total = addTotalCorrect(finalScore);
  const title = getCurrentTitle();

  document.getElementById('final-score').textContent = finalScore;
  document.getElementById('final-total').textContent = shuffledQuiz.length;
  document.getElementById('final-combo').textContent = maxCombo;

  // 称号表示
  document.getElementById('final-title').textContent = `${title.icon} ${title.name}`;

  // 次の称号までの残り
  const nextTitle = TITLES.find(t => t.min > total);
  if (nextTitle) {
    document.getElementById('next-title-info').textContent =
      `次の称号「${nextTitle.name}」まであと${nextTitle.min - total}問`;
  } else {
    document.getElementById('next-title-info').textContent = '最高称号達成！';
  }

  const pct = finalScore / shuffledQuiz.length;
  let comment = '';
  if (pct === 1 && maxCombo >= shuffledQuiz.length) comment = '完全制覇！フルコンボ達成！';
  else if (pct === 1) comment = '全問正解！競馬マスター！';
  else if (pct >= 0.8) comment = 'すごい！かなりの競馬通ですね';
  else if (pct >= 0.6) comment = 'なかなか！もっと詳しくなれるかも';
  else if (pct >= 0.4) comment = 'まだまだこれから！';
  else comment = '競馬の世界は奥が深い...！';
  document.getElementById('result-comment').textContent = comment;

  // 復習ボタン
  const reviewBtn = document.getElementById('review-btn');
  if (wrongList.length > 0) {
    reviewBtn.style.display = 'block';
    reviewBtn.textContent = `間違えた${wrongList.length}問を復習`;
  } else {
    reviewBtn.style.display = 'none';
  }

  document.getElementById('progress-fill').style.width = '100%';
  playSound('result');
  showScreen('result-screen');

  setTimeout(() => {
    document.getElementById('name-modal').style.display = 'flex';
  }, 1200);
}

// ランキング登録
function submitScore() {
  const name = document.getElementById('nickname-input').value.trim();
  if (!name) return;

  const title = getCurrentTitle();
  const rankings = getRankings();
  rankings.push({
    name: name,
    score: Math.floor(score),
    total: shuffledQuiz.length,
    combo: maxCombo,
    title: title.icon,
    date: new Date().toLocaleDateString('ja-JP')
  });

  rankings.sort((a, b) => b.score - a.score);
  localStorage.setItem('keiba-quiz-rankings', JSON.stringify(rankings.slice(0, 50)));

  document.getElementById('name-modal').style.display = 'none';
  document.getElementById('nickname-input').value = '';
}

function skipRanking() {
  document.getElementById('name-modal').style.display = 'none';
}

function getRankings() {
  const data = localStorage.getItem('keiba-quiz-rankings');
  return data ? safeJsonParse(data, []) : [];
}

// ランキング表示
function showRanking() {
  const rankings = getRankings();
  const listEl = document.getElementById('ranking-list');
  listEl.innerHTML = '';

  if (rankings.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.cssText = 'text-align:center;color:#8faa8b;padding:40px 0;';
    emptyMsg.textContent = 'まだランキングデータがありません';
    listEl.appendChild(emptyMsg);
  } else {
    rankings.slice(0, 20).forEach((r, i) => {
      const item = document.createElement('div');
      item.className = 'ranking-item';
      let numClass = 'normal';
      if (i === 0) numClass = 'gold';
      else if (i === 1) numClass = 'silver';
      else if (i === 2) numClass = 'bronze';

      const numDiv = document.createElement('div');
      numDiv.className = `ranking-num ${numClass}`;
      numDiv.textContent = i + 1;

      const nameDiv = document.createElement('div');
      nameDiv.className = 'ranking-name';
      nameDiv.textContent = `${r.title || '🐴'} ${r.name}`;

      const scoreDiv = document.createElement('div');
      scoreDiv.className = 'ranking-score';
      scoreDiv.textContent = r.score;
      const totalSpan = document.createElement('span');
      totalSpan.className = 'ranking-total';
      totalSpan.textContent = `/${r.total}`;
      scoreDiv.appendChild(totalSpan);

      item.appendChild(numDiv);
      item.appendChild(nameDiv);
      item.appendChild(scoreDiv);
      listEl.appendChild(item);
    });
  }

  showScreen('ranking-screen');
}

function retryQuiz() {
  document.getElementById('name-modal').style.display = 'none';
  startQuiz();
}

function backToStart() {
  updateStartScreen();
  showScreen('start-screen');
}

function shareResult() {
  const title = getCurrentTitle();
  const text = `${title.icon}競馬クイズ${title.icon}\nスコア: ${Math.floor(score)}/${shuffledQuiz.length}\n最大コンボ: ${maxCombo}\n称号: ${title.name}\n\nあなたも挑戦してみて！`;
  if (navigator.share) {
    navigator.share({ text: text });
  } else {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  }
}

// ユーティリティ
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 初期化
updateStartScreen();
