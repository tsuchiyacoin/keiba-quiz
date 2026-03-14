// ============================================================
// 状態管理
// ============================================================
var currentQuestion = 0;
var score = 0;
var answered = false;
var shuffledQuiz = [];
var timer = null;
var timeLeft = 0;
var combo = 0;
var maxCombo = 0;
var wrongList = [];
var correctCount = 0;
var isReviewMode = false;
var isDailyMode = false;
var isBattleMode = false;
var battleSeed = null;
var isHardMode = false;
var isBonusQuestion = false;
var currentTimeLimit = 15;
var prevTitleName = '';

// ============================================================
// 称号データ
// ============================================================
var TITLES = [
  { min: 0, name: '見習いファン', icon: '🐴' },
  { min: 10, name: '競馬ファン', icon: '🏇' },
  { min: 30, name: '馬券師', icon: '🎫' },
  { min: 60, name: '競馬通', icon: '🏆' },
  { min: 100, name: '競馬マスター', icon: '👑' },
  { min: 200, name: '伝説の予想家', icon: '🔥' },
];

var SPECIAL_TITLES = {
  fullCombo: { name: 'フルコンボマスター', icon: '💎' },
  dailyPerfect: { name: 'デイリーパーフェクト', icon: '🌟' },
  hardFullCombo: { name: '鉄の馬', icon: '🛡️' },
};

var GENRES = {
  general: '総合',
  g1: 'G1レース',
  bloodline: '血統',
  jockey: '騎手',
  history: '歴史',
};

var DIFFICULTY_SETTINGS = {
  beginner: { label: '初級', time: 20, xpMul: 1 },
  intermediate: { label: '中級', time: 15, xpMul: 1.5 },
  advanced: { label: '上級', time: 10, xpMul: 2 },
};

// ============================================================
// ユーティリティ
// ============================================================
function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    var result = JSON.parse(str);
    return (result !== null && result !== undefined) ? result : fallback;
  } catch (e) { return fallback; }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// シード付きランダム (mulberry32)
function seededRng(seed) {
  var s = seed | 0;
  return function () {
    s = s + 0x6D2B79F5 | 0;
    var t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

function getTodayStr() {
  var d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function getWeekId() {
  var d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  var jan1 = new Date(d.getFullYear(), 0, 1);
  var week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + (week < 10 ? '0' + week : '' + week);
}

function seededShuffle(arr, rng) {
  var a = [...arr];
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rng() * (i + 1));
    var tmp2 = a[i]; a[i] = a[j]; a[j] = tmp2;
  }
  return a;
}

// ============================================================
// データ管理
// ============================================================
function getQuizData() {
  var saved = localStorage.getItem('keiba-quiz-questions');
  var data = saved ? safeJsonParse(saved, quizData) : quizData;
  return data.map(function(q) {
    var copy = {};
    for (var k in q) { if (q.hasOwnProperty(k)) copy[k] = q[k]; }
    if (!copy.genre) copy.genre = 'general';
    if (!copy.difficulty) copy.difficulty = 'intermediate';
    return copy;
  });
}

function getFilteredQuizData() {
  var all = getQuizData();
  var settings = getSettings();
  var filtered = all;

  if (settings.selectedGenres && settings.selectedGenres.length > 0) {
    filtered = filtered.filter(function(q) { return settings.selectedGenres.indexOf(q.genre) >= 0; });
  }
  if (settings.difficulty && settings.difficulty !== 'all') {
    filtered = filtered.filter(function(q) { return q.difficulty === settings.difficulty; });
  }
  return filtered.length > 0 ? filtered : all;
}

function getSettings() {
  return safeJsonParse(localStorage.getItem('keiba-settings'), {
    selectedGenres: [],
    difficulty: 'all',
    hardMode: false,
  });
}

function saveSettings(s) {
  localStorage.setItem('keiba-settings', JSON.stringify(s));
}

// ============================================================
// レベル & XP
// ============================================================
function getPlayerData() {
  return safeJsonParse(localStorage.getItem('keiba-player'), {
    xp: 0, level: 1, specialTitles: [],
  });
}

function savePlayerData(p) {
  localStorage.setItem('keiba-player', JSON.stringify(p));
}

function xpForLevel(lv) {
  return lv * 100;
}

function totalXpForLevel(lv) {
  return lv * (lv - 1) * 50;
}

function addXP(amount) {
  var p = getPlayerData();
  p.xp += amount;
  var leveledUp = false;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    leveledUp = true;
  }
  savePlayerData(p);
  return { xp: p.xp, level: p.level, leveledUp };
}

// ============================================================
// 連続ログイン (ストリーク)
// ============================================================
function getStreak() {
  return safeJsonParse(localStorage.getItem('keiba-streak'), {
    lastDate: '', currentStreak: 0, bestStreak: 0,
  });
}

function checkStreak() {
  var s = getStreak();
  var today = getTodayStr();
  if (s.lastDate === today) return s;

  var yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000).toISOString().slice(0, 10);
  if (s.lastDate === yesterday) {
    s.currentStreak++;
  } else {
    s.currentStreak = 1;
  }
  s.lastDate = today;
  if (s.currentStreak > s.bestStreak) s.bestStreak = s.currentStreak;
  localStorage.setItem('keiba-streak', JSON.stringify(s));
  return s;
}

function getStreakMultiplier() {
  var s = getStreak();
  return Math.min(2, 1 + s.currentStreak * 0.1);
}

// ============================================================
// 成績管理
// ============================================================
function getStats() {
  return safeJsonParse(localStorage.getItem('keiba-stats'), {
    totalAnswered: 0, totalCorrect: 0,
    genres: {},
    history: [],
  });
}

function saveStats(st) {
  localStorage.setItem('keiba-stats', JSON.stringify(st));
}

function recordStat(question, wasCorrect) {
  var st = getStats();
  st.totalAnswered++;
  if (wasCorrect) st.totalCorrect++;

  var g = question.genre || 'general';
  if (!st.genres[g]) st.genres[g] = { answered: 0, correct: 0 };
  st.genres[g].answered++;
  if (wasCorrect) st.genres[g].correct++;

  saveStats(st);
}

function recordGameHistory(sc, total, acc) {
  var st = getStats();
  st.history.push({
    date: getTodayStr(),
    score: sc, total: total, accuracy: acc,
  });
  if (st.history.length > 100) st.history = st.history.slice(-100);
  saveStats(st);
}

// ============================================================
// 間違えた問題バンク
// ============================================================
function getWrongBank() {
  return safeJsonParse(localStorage.getItem('keiba-wrong-bank'), []);
}

function addToWrongBank(q) {
  var bank = getWrongBank();
  if (!bank.find(function(b) { return b.question === q.question; })) {
    bank.push(q);
    if (bank.length > 50) bank.shift();
    localStorage.setItem('keiba-wrong-bank', JSON.stringify(bank));
  }
}

function removeFromWrongBank(q) {
  var bank = getWrongBank();
  bank = bank.filter(function(b) { return b.question !== q.question; });
  localStorage.setItem('keiba-wrong-bank', JSON.stringify(bank));
}

// ============================================================
// 累計正解数
// ============================================================
function getTotalCorrect() {
  return parseInt(localStorage.getItem('keiba-total-correct') || '0');
}

function addTotalCorrect(n) {
  var total = getTotalCorrect() + n;
  localStorage.setItem('keiba-total-correct', total);
  return total;
}

function getCurrentTitle() {
  var total = getTotalCorrect();
  var title = TITLES[0];
  for (var ti = 0; ti < TITLES.length; ti++) {
    var t = TITLES[ti];
    if (total >= t.min) title = t;
  }
  return title;
}

// ============================================================
// スタート画面
// ============================================================
function updateStartScreen() {
  var title = getCurrentTitle();
  var total = getTotalCorrect();
  var el = document.getElementById('player-title');
  if (el) {
    el.textContent = title.icon + ' ' + title.name + ' ';
    var countSpan = document.createElement('span');
    countSpan.className = 'title-count';
    countSpan.textContent = '累計' + total + '問正解';
    el.appendChild(countSpan);
  }

  // レベル & XP
  var p = getPlayerData();
  var levelEl = document.getElementById('player-level');
  var xpFill = document.getElementById('xp-fill');
  var xpText = document.getElementById('xp-text');
  if (levelEl) levelEl.textContent = p.level;
  if (xpFill) xpFill.style.width = (p.xp / xpForLevel(p.level) * 100) + '%';
  if (xpText) xpText.textContent = p.xp + ' / ' + xpForLevel(p.level) + ' XP';

  // ストリーク
  var streak = checkStreak();
  var streakEl = document.getElementById('streak-display');
  if (streakEl) {
    if (streak.currentStreak >= 2) {
      streakEl.style.display = 'block';
      streakEl.textContent = '🔥 ' + streak.currentStreak + '日連続';
    } else {
      streakEl.style.display = 'none';
    }
  }

  // デイリーチャレンジ状態
  var dailyBtn = document.getElementById('daily-btn');
  if (dailyBtn) {
    var daily = getDailyState();
    if (daily.completed) {
      dailyBtn.textContent = '✅ 今日のスコア: ' + daily.score + '点';
      dailyBtn.classList.add('completed');
    } else {
      dailyBtn.textContent = '📅 デイリーチャレンジ';
      dailyBtn.classList.remove('completed');
    }
  }

  // 間違えた問題数
  var wrongCount = getWrongBank().length;
  var wrongBadge = document.getElementById('wrong-count');
  var wrongBtn = document.getElementById('wrong-bank-btn');
  if (wrongBadge) wrongBadge.textContent = wrongCount;
  if (wrongBtn) wrongBtn.style.display = wrongCount > 0 ? 'block' : 'none';

  // 設定を復元
  var settings = getSettings();
  isHardMode = settings.hardMode || false;
  var hardToggle = document.getElementById('hard-toggle');
  if (hardToggle) hardToggle.checked = isHardMode;
}

// ============================================================
// クイズ開始
// ============================================================
function startQuiz() {
  readSettingsFromUI();
  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  answered = false;
  wrongList = [];
  isReviewMode = false;
  isDailyMode = false;
  isBattleMode = false;

  var settings = getSettings();
  var diff = DIFFICULTY_SETTINGS[settings.difficulty] || DIFFICULTY_SETTINGS.intermediate;
  currentTimeLimit = isHardMode ? Math.min(8, diff.time) : diff.time;

  shuffledQuiz = shuffleArray([...getFilteredQuizData()]);
  prevTitleName = getCurrentTitle().name;

  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  updateModeIndicator();
  showScreen('quiz-screen');
  loadQuestion();
}

function readSettingsFromUI() {
  var settings = getSettings();

  // ジャンル
  var genreChecks = document.querySelectorAll('.genre-check');
  settings.selectedGenres = [];
  genreChecks.forEach(function(cb) { if (cb.checked) settings.selectedGenres.push(cb.value); });

  // 難易度
  var diffRadio = document.querySelector('input[name="difficulty"]:checked');
  settings.difficulty = diffRadio ? diffRadio.value : 'all';

  // ハードモード
  var hardToggle = document.getElementById('hard-toggle');
  settings.hardMode = hardToggle ? hardToggle.checked : false;
  isHardMode = settings.hardMode;

  saveSettings(settings);
}

function updateModeIndicator() {
  var el = document.getElementById('mode-indicator');
  if (!el) return;
  var parts = [];
  if (isHardMode) parts.push('HARD');
  if (isDailyMode) parts.push('DAILY');
  if (isBattleMode) parts.push('BATTLE');
  var settings = getSettings();
  if (settings.difficulty && settings.difficulty !== 'all') {
    var d = DIFFICULTY_SETTINGS[settings.difficulty]; parts.push(d ? d.label : '');
  }
  el.textContent = parts.join(' | ');
  el.style.display = parts.length > 0 ? 'block' : 'none';
}

// ============================================================
// デイリーチャレンジ
// ============================================================
function getDailyState() {
  var data = safeJsonParse(localStorage.getItem('keiba-daily-state'), {});
  if (data.date !== getTodayStr()) return { date: getTodayStr(), completed: false, score: 0 };
  return data;
}

function saveDailyState(state) {
  localStorage.setItem('keiba-daily-state', JSON.stringify(state));
}

function startDailyChallenge() {
  var daily = getDailyState();
  if (daily.completed) {
    alert('今日のチャレンジは完了済みです！\nスコア: ' + daily.score + '点');
    return;
  }

  readSettingsFromUI();
  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  answered = false;
  wrongList = [];
  isReviewMode = false;
  isDailyMode = true;
  isBattleMode = false;

  var allQ = getQuizData();
  var seed = hashString(getTodayStr());
  var rng = seededRng(seed);
  shuffledQuiz = seededShuffle(allQ, rng).slice(0, 5);
  prevTitleName = getCurrentTitle().name;

  currentTimeLimit = isHardMode ? 8 : 15;

  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  updateModeIndicator();
  showScreen('quiz-screen');
  loadQuestion();
}

// ============================================================
// 対戦モード
// ============================================================
function startBattle() {
  readSettingsFromUI();
  var allQ = getQuizData();
  battleSeed = Date.now();
  var rng = seededRng(battleSeed);
  shuffledQuiz = seededShuffle(allQ, rng).slice(0, 10);

  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  answered = false;
  wrongList = [];
  isReviewMode = false;
  isDailyMode = false;
  isBattleMode = true;
  prevTitleName = getCurrentTitle().name;

  currentTimeLimit = isHardMode ? 8 : 15;

  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  updateModeIndicator();
  showScreen('quiz-screen');
  loadQuestion();
}

function joinBattle(seed) {
  var allQ = getQuizData();
  var rng = seededRng(seed);
  shuffledQuiz = seededShuffle(allQ, rng).slice(0, 10);
  battleSeed = seed;

  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  answered = false;
  wrongList = [];
  isReviewMode = false;
  isDailyMode = false;
  isBattleMode = true;
  prevTitleName = getCurrentTitle().name;

  currentTimeLimit = isHardMode ? 8 : 15;

  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  updateModeIndicator();
  showScreen('quiz-screen');
  loadQuestion();
}

function checkBattleFromUrl() {
  var hash = window.location.hash;
  var match = hash.match(/#battle=(\d+)/);
  if (match) {
    window.location.hash = '';
    joinBattle(parseInt(match[1]));
  }
}

// ============================================================
// 復習モード
// ============================================================
function startReview() {
  if (wrongList.length === 0) return;
  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  answered = false;
  isReviewMode = true;
  isDailyMode = false;
  isBattleMode = false;
  shuffledQuiz = shuffleArray([...wrongList]);
  wrongList = [];
  prevTitleName = getCurrentTitle().name;
  currentTimeLimit = 15;

  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  updateModeIndicator();
  showScreen('quiz-screen');
  loadQuestion();
}

function startWrongBankReview() {
  var bank = getWrongBank();
  if (bank.length === 0) return;
  currentQuestion = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  correctCount = 0;
  answered = false;
  isReviewMode = true;
  isDailyMode = false;
  isBattleMode = false;
  shuffledQuiz = shuffleArray([...bank]);
  wrongList = [];
  prevTitleName = getCurrentTitle().name;
  currentTimeLimit = 15;

  document.getElementById('current-score').textContent = '0';
  document.getElementById('total-num').textContent = shuffledQuiz.length;
  document.getElementById('combo-display').style.display = 'none';
  updateModeIndicator();
  showScreen('quiz-screen');
  loadQuestion();
}

// ============================================================
// 問題読み込み
// ============================================================
function loadQuestion() {
  answered = false;
  isBonusQuestion = false;
  var q = shuffledQuiz[currentQuestion];
  document.getElementById('question-num').textContent = currentQuestion + 1;
  document.getElementById('question-text').textContent = q.question;
  document.getElementById('result-msg').textContent = '';
  document.getElementById('result-msg').className = 'result-msg';
  document.getElementById('combo-label').textContent = '';
  document.getElementById('combo-label').className = 'combo-label';

  // 回答カードを非表示
  var answerCard = document.getElementById('answer-card');
  if (answerCard) {
    answerCard.style.display = 'none';
    answerCard.className = 'answer-card';
  }
  var correctDisplay = document.getElementById('correct-answer-display');
  if (correctDisplay) correctDisplay.textContent = '';

  var expEl = document.getElementById('explanation');
  expEl.textContent = '';
  expEl.classList.remove('show');

  var pct = (currentQuestion / shuffledQuiz.length) * 100;
  document.getElementById('progress-fill').style.width = pct + '%';

  // ボーナス問題判定 (15%の確率, デイリー・復習モードでは出ない)
  var bonusEl = document.getElementById('bonus-indicator');
  if (!isDailyMode && !isReviewMode && Math.random() < 0.15) {
    isBonusQuestion = true;
    if (bonusEl) bonusEl.style.display = 'block';
    playSound('bonus');
  } else {
    if (bonusEl) bonusEl.style.display = 'none';
  }

  // 読み上げボタン表示
  var speakBtn = document.getElementById('speak-btn');
  if (speakBtn) speakBtn.style.display = speechEnabled ? 'block' : 'none';

  startTimer();

  // 自動読み上げ
  if (speechEnabled) speakQuestion();

  var choicesEl = document.getElementById('choices');
  choicesEl.innerHTML = '';
  var labels = ['A', 'B', 'C', 'D'];
  var indices = shuffleArray([0, 1, 2, 3]);

  indices.forEach(function(origIdx, displayIdx) {
    var btn = document.createElement('button');
    btn.className = 'choice-btn';
    var labelSpan = document.createElement('span');
    labelSpan.className = 'choice-label';
    labelSpan.textContent = labels[displayIdx];
    btn.appendChild(labelSpan);
    btn.appendChild(document.createTextNode(q.choices[origIdx]));
    btn.dataset.origIdx = origIdx;
    btn.onclick = (function(b, oi) { return function() { selectAnswer(b, oi, q.answer, choicesEl); }; })(btn, origIdx);
    choicesEl.appendChild(btn);
  });
}

// ============================================================
// タイマー
// ============================================================
var tickPlayed = { 3: false, 2: false, 1: false };

function startTimer() {
  stopTimer();
  timeLeft = currentTimeLimit * 10;
  tickPlayed = { 3: false, 2: false, 1: false };
  var fill = document.getElementById('timer-fill');
  fill.style.width = '100%';
  fill.className = 'timer-fill';

  timer = setInterval(function() {
    timeLeft--;
    var pct = (timeLeft / (currentTimeLimit * 10)) * 100;
    fill.style.width = pct + '%';

    if (pct <= 20) fill.className = 'timer-fill danger';
    else if (pct <= 50) fill.className = 'timer-fill warning';

    var secLeft = Math.ceil(timeLeft / 10);
    if (secLeft <= 3 && secLeft > 0 && !tickPlayed[secLeft] && timeLeft % 10 === 0) {
      tickPlayed[secLeft] = true;
      playSound('tick');
    }

    if (timeLeft <= 0) onTimeUp();
  }, 100);
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null; }
}

// ============================================================
// 時間切れ
// ============================================================
function onTimeUp() {
  if (answered) return;
  stopTimer();
  answered = true;

  var q = shuffledQuiz[currentQuestion];
  document.getElementById('timer-fill').classList.add('timeup');

  var container = document.getElementById('choices');
  var buttons = container.querySelectorAll('.choice-btn');
  var msgEl = document.getElementById('result-msg');

  buttons.forEach(function(b) {
    b.classList.add('disabled');
    if (parseInt(b.dataset.origIdx) === q.answer) b.classList.add('correct');
  });

  msgEl.textContent = '時間切れ！';
  msgEl.className = 'result-msg timeup';

  combo = 0;
  updateComboDisplay();
  wrongList.push(q);
  addToWrongBank(q);
  recordStat(q, false);

  playSound('timeup');
  vibrate(200);
  showAnswerCard(q, 'timeup');
}

// ============================================================
// 回答選択
// ============================================================
function selectAnswer(btn, selected, correct, container) {
  if (answered) return;
  answered = true;
  stopTimer();

  var q = shuffledQuiz[currentQuestion];
  var buttons = container.querySelectorAll('.choice-btn');
  var msgEl = document.getElementById('result-msg');

  buttons.forEach(function(b) {
    b.classList.add('disabled');
    if (parseInt(b.dataset.origIdx) === correct) b.classList.add('correct');
  });

  if (selected === correct) {
    btn.classList.add('correct');
    combo++;
    correctCount++;
    if (combo > maxCombo) maxCombo = combo;

    // 復習モードで正解したら問題バンクから削除
    if (isReviewMode) removeFromWrongBank(q);

    var comboText = '';
    if (combo >= 7) {
      comboText = 'UNSTOPPABLE!!';
      playSound('combo');
      vibrate([50, 30, 50, 30, 50]);
    } else if (combo >= 5) {
      comboText = 'PERFECT!';
      playSound('combo');
      vibrate([50, 30, 50]);
    } else if (combo >= 3) {
      comboText = 'GREAT!';
      playSound('combo');
      vibrate([50, 30]);
    } else {
      playSound('correct');
      vibrate(30);
    }
    msgEl.textContent = '正解！';
    msgEl.className = 'result-msg correct';

    // スコア計算
    var multiplier = 1;
    if (combo >= 5) multiplier = 2;
    else if (combo >= 3) multiplier = 1.5;
    if (isBonusQuestion) multiplier *= 2;

    score += multiplier;
    document.getElementById('current-score').textContent = Math.floor(score);
    updateComboDisplay(comboText, multiplier);
    recordStat(q, true);
  } else {
    btn.classList.add('wrong');
    msgEl.textContent = '不正解...';
    msgEl.className = 'result-msg wrong';
    combo = 0;
    updateComboDisplay();
    wrongList.push(q);
    addToWrongBank(q);
    recordStat(q, false);
    playSound('wrong');
    vibrate(200);
  }

  if (isBonusQuestion) {
    var bonusEl = document.getElementById('bonus-indicator');
    if (bonusEl) bonusEl.style.display = 'none';
  }

  document.getElementById('current-score').parentElement.classList.add('pop');
  setTimeout(function() { document.getElementById('current-score').parentElement.classList.remove('pop'); }, 300);

  showAnswerCard(q, selected === correct ? 'correct' : 'wrong');
}

// ============================================================
// コンボ表示
// ============================================================
function updateComboDisplay(text, multiplier) {
  var comboDisplay = document.getElementById('combo-display');
  var comboLabel = document.getElementById('combo-label');

  if (combo >= 2) {
    comboDisplay.style.display = 'flex';
    comboDisplay.textContent = combo + ' COMBO';
    comboDisplay.classList.add('pop');
    setTimeout(function() { comboDisplay.classList.remove('pop'); }, 300);
  } else {
    comboDisplay.style.display = 'none';
  }

  if (text) {
    comboLabel.textContent = text + ' ×' + multiplier;
    comboLabel.className = 'combo-label show';
    if (combo >= 5) comboLabel.classList.add('rainbow');
  } else {
    comboLabel.textContent = '';
    comboLabel.className = 'combo-label';
  }
}

function showAnswerCard(q, resultType) {
  var card = document.getElementById('answer-card');
  if (!card) return;

  // カードの枠色
  card.className = 'answer-card';
  if (resultType === 'correct') card.classList.add('correct-card');
  else if (resultType === 'wrong') card.classList.add('wrong-card');
  else card.classList.add('timeup-card');

  // 正解の選択肢を表示
  var labels = ['A', 'B', 'C', 'D'];
  var correctDisplay = document.getElementById('correct-answer-display');
  if (correctDisplay) {
    correctDisplay.textContent = '正解: ' + labels[q.answer] + '. ' + q.choices[q.answer];
  }

  // 解説
  var expEl = document.getElementById('explanation');
  if (q.explanation) {
    expEl.textContent = q.explanation;
    expEl.classList.add('show');
  }

  card.style.display = 'block';
  setTimeout(function() { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);

  // 正解読み上げ
  speakAnswer(q, resultType === 'correct');
}

// ============================================================
// 次の問題
// ============================================================
function nextQuestion() {
  currentQuestion++;
  if (currentQuestion >= shuffledQuiz.length) {
    showResult();
  } else {
    loadQuestion();
  }
}

// ============================================================
// 結果表示
// ============================================================
function showResult() {
  stopTimer();
  var finalScore = Math.floor(score);
  var accuracy = shuffledQuiz.length > 0 ? correctCount / shuffledQuiz.length : 0;

  // XP計算
  var settings = getSettings();
  var diffSetting = DIFFICULTY_SETTINGS[settings.difficulty]; var diffMul = diffSetting ? diffSetting.xpMul : 1;
  var streakMul = getStreakMultiplier();
  var hardMul = isHardMode ? 1.5 : 1;
  var baseXp = correctCount * 10;
  var totalXp = Math.floor(baseXp * diffMul * streakMul * hardMul);

  var xpResult = addXP(totalXp);
  var total = addTotalCorrect(correctCount);
  var title = getCurrentTitle();

  // 成績記録
  recordGameHistory(finalScore, shuffledQuiz.length, accuracy);

  document.getElementById('final-score').textContent = finalScore;
  document.getElementById('final-total').textContent = shuffledQuiz.length;
  document.getElementById('final-combo').textContent = maxCombo;
  document.getElementById('final-title').textContent = title.icon + ' ' + title.name;

  // XP表示
  var xpGainedEl = document.getElementById('xp-gained');
  if (xpGainedEl) xpGainedEl.textContent = '+' + totalXp + ' XP';
  var resultLevelEl = document.getElementById('result-level');
  if (resultLevelEl) resultLevelEl.textContent = 'Lv.' + xpResult.level;
  var resultXpFill = document.getElementById('result-xp-fill');
  if (resultXpFill) resultXpFill.style.width = (xpResult.xp / xpForLevel(xpResult.level) * 100) + '%';

  // 次の称号
  var nextTitle = TITLES.find(function(t) { return t.min > total; });
  document.getElementById('next-title-info').textContent = nextTitle
    ? '次の称号「' + nextTitle.name + '」まであと' + nextTitle.min - total + '問'
    : '最高称号達成！';

  // コメント
  var pct = accuracy;
  var comment = '';
  if (pct === 1 && maxCombo >= shuffledQuiz.length) comment = '完全制覇！フルコンボ達成！';
  else if (pct === 1) comment = '全問正解！競馬マスター！';
  else if (pct >= 0.8) comment = 'すごい！かなりの競馬通ですね';
  else if (pct >= 0.6) comment = 'なかなか！もっと詳しくなれるかも';
  else if (pct >= 0.4) comment = 'まだまだこれから！';
  else comment = '競馬の世界は奥が深い...！';
  document.getElementById('result-comment').textContent = comment;

  // 正答率
  var accEl = document.getElementById('result-accuracy');
  if (accEl) accEl.textContent = '正答率: ' + Math.round(accuracy * 100) + '%';

  // 復習ボタン
  var reviewBtn = document.getElementById('review-btn');
  if (wrongList.length > 0) {
    reviewBtn.style.display = 'block';
    reviewBtn.textContent = '間違えた' + wrongList.length + '問を復習';
  } else {
    reviewBtn.style.display = 'none';
  }

  // デイリーモード保存
  if (isDailyMode) {
    saveDailyState({ date: getTodayStr(), completed: true, score: finalScore });
  }

  // 対戦URL
  var battleUrlArea = document.getElementById('battle-url-area');
  if (battleUrlArea) {
    if (isBattleMode && battleSeed) {
      var url = window.location.origin + window.location.pathname + '#battle=' + battleSeed;
      document.getElementById('battle-url').value = url;
      battleUrlArea.style.display = 'block';
    } else {
      battleUrlArea.style.display = 'none';
    }
  }

  // 週間ランキング保存
  saveWeeklyScore(finalScore);

  document.getElementById('progress-fill').style.width = '100%';
  playSound('result');
  showScreen('result-screen');

  // レベルアップ演出
  if (xpResult.leveledUp) {
    setTimeout(function() { showLevelUpAnimation(xpResult.level); }, 600);
  }

  // フルコンボ称号チェック
  if (maxCombo >= shuffledQuiz.length && shuffledQuiz.length >= 5) {
    var specialKey = 'fullCombo';
    if (isDailyMode) specialKey = 'dailyPerfect';
    if (isHardMode) specialKey = 'hardFullCombo';
    awardSpecialTitle(specialKey);
  }

  // 称号変化チェック → ガチャ演出
  if (title.name !== prevTitleName) {
    setTimeout(function() { showGachaAnimation(title); }, xpResult.leveledUp ? 2500 : 800);
  } else {
    setTimeout(function() {
      document.getElementById('name-modal').style.display = 'flex';
    }, 1200);
  }
}

// ============================================================
// 特殊称号
// ============================================================
function awardSpecialTitle(key) {
  var p = getPlayerData();
  if (p.specialTitles.indexOf(key) < 0) {
    p.specialTitles.push(key);
    savePlayerData(p);
  }
}

// ============================================================
// レベルアップ演出
// ============================================================
function showLevelUpAnimation(level) {
  var overlay = document.getElementById('levelup-overlay');
  if (!overlay) return;
  document.getElementById('levelup-num').textContent = level;
  overlay.style.display = 'flex';
  playSound('levelup');
  setTimeout(function() { overlay.style.display = 'none'; }, 2000);
}

// ============================================================
// ガチャ演出
// ============================================================
function showGachaAnimation(title) {
  var overlay = document.getElementById('gacha-overlay');
  if (!overlay) return;
  var card = overlay.querySelector('.gacha-card');
  document.getElementById('gacha-icon').textContent = title.icon;
  document.getElementById('gacha-name').textContent = title.name;

  overlay.style.display = 'flex';
  card.classList.remove('flipped');
  playSound('gacha');

  setTimeout(function() { card.classList.add('flipped'); }, 1000);
}

function closeGacha() {
  document.getElementById('gacha-overlay').style.display = 'none';
  setTimeout(function() {
    document.getElementById('name-modal').style.display = 'flex';
  }, 300);
}

// ============================================================
// ランキング
// ============================================================
function submitScore() {
  var name = document.getElementById('nickname-input').value.trim();
  if (!name) return;

  var title = getCurrentTitle();
  var rankings = getRankings();
  rankings.push({
    name, score: Math.floor(score), total: shuffledQuiz.length,
    combo: maxCombo, title: title.icon,
    date: new Date().toLocaleDateString('ja-JP'),
  });
  rankings.sort(function(a, b) { return b.score - a.score; });
  localStorage.setItem('keiba-quiz-rankings', JSON.stringify(rankings.slice(0, 50)));

  document.getElementById('name-modal').style.display = 'none';
  document.getElementById('nickname-input').value = '';
}

function skipRanking() {
  document.getElementById('name-modal').style.display = 'none';
}

function getRankings() {
  return safeJsonParse(localStorage.getItem('keiba-quiz-rankings'), []);
}

// 週間ランキング
function getWeeklyRankings() {
  var data = safeJsonParse(localStorage.getItem('keiba-weekly-rankings'), { weekId: '', entries: [] });
  if (data.weekId !== getWeekId()) return { weekId: getWeekId(), entries: [] };
  return data;
}

function saveWeeklyScore(sc) {
  var data = getWeeklyRankings();
  data.weekId = getWeekId();
  var name = localStorage.getItem('keiba-last-name') || '';
  if (name) {
    data.entries.push({
      name, score: sc, date: new Date().toLocaleDateString('ja-JP'),
    });
    data.entries.sort(function(a, b) { return b.score - a.score; });
    data.entries = data.entries.slice(0, 50);
  }
  localStorage.setItem('keiba-weekly-rankings', JSON.stringify(data));
}

// ランキング表示
var rankingTab = 'all';

function showRanking() {
  rankingTab = 'all';
  renderRanking();
  showScreen('ranking-screen');
}

function switchRankingTab(tab) {
  rankingTab = tab;
  var allBtn = document.getElementById('rank-tab-all');
  var weekBtn = document.getElementById('rank-tab-week');
  if (allBtn) allBtn.classList.toggle('active', tab === 'all');
  if (weekBtn) weekBtn.classList.toggle('active', tab === 'week');
  renderRanking();
}

function renderRanking() {
  var rankings = rankingTab === 'all' ? getRankings() : getWeeklyRankings().entries;
  var listEl = document.getElementById('ranking-list');
  listEl.innerHTML = '';

  if (rankings.length === 0) {
    var p = document.createElement('p');
    p.style.cssText = 'text-align:center;color:#8faa8b;padding:40px 0;';
    p.textContent = 'まだランキングデータがありません';
    listEl.appendChild(p);
    return;
  }

  rankings.slice(0, 20).forEach(function(r, i) {
    var item = document.createElement('div');
    item.className = 'ranking-item';
    var numClass = 'normal';
    if (i === 0) numClass = 'gold';
    else if (i === 1) numClass = 'silver';
    else if (i === 2) numClass = 'bronze';

    var numDiv = document.createElement('div');
    numDiv.className = 'ranking-num ' + numClass;
    numDiv.textContent = i + 1;

    var nameDiv = document.createElement('div');
    nameDiv.className = 'ranking-name';
    nameDiv.textContent = r.title || '🐴' + ' ' + r.name;

    var scoreDiv = document.createElement('div');
    scoreDiv.className = 'ranking-score';
    scoreDiv.textContent = r.score;
    if (r.total) {
      var totalSpan = document.createElement('span');
      totalSpan.className = 'ranking-total';
      totalSpan.textContent = '/' + r.total;
      scoreDiv.appendChild(totalSpan);
    }

    item.appendChild(numDiv);
    item.appendChild(nameDiv);
    item.appendChild(scoreDiv);
    listEl.appendChild(item);
  });
}

// ============================================================
// 成績画面
// ============================================================
function showStatsScreen() {
  var st = getStats();
  var p = getPlayerData();

  // 全体
  var overallEl = document.getElementById('overall-stats');
  if (overallEl) {
    var acc = st.totalAnswered > 0 ? Math.round(st.totalCorrect / st.totalAnswered * 100) : 0;
    overallEl.innerHTML = '<div class="stat-card"><div class="stat-num">' + st.totalAnswered + '</div><div class="stat-label">解答数</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + acc + '%</div><div class="stat-label">正答率</div></div>' +
      '<div class="stat-card"><div class="stat-num">Lv.' + p.level + '</div><div class="stat-label">レベル</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + getStreak().bestStreak + '</div><div class="stat-label">最長連続</div></div>';
  }

  // ジャンル別
  var genreEl = document.getElementById('genre-stats');
  if (genreEl) {
    var html = '';
    var genreKeys = Object.keys(GENRES);
    for (var gi = 0; gi < genreKeys.length; gi++) {
      var key = genreKeys[gi];
      var label = GENRES[key];
      var g = st.genres[key];
      if (!g || g.answered === 0) continue;
      var acc = Math.round(g.correct / g.answered * 100);
      html += '<div class="genre-stat-row">' +
        '<span class="genre-stat-name">' + label + '</span>' +
        '<div class="genre-stat-bar"><div class="genre-stat-fill" style="width:' + acc + '%"></div></div>' +
        '<span class="genre-stat-pct">' + acc + '%</span>' +
        '</div>';
    }
    genreEl.innerHTML = html || '<p style="color:#8faa8b;text-align:center;">まだデータがありません</p>';
  }

  // 特殊称号
  var specialEl = document.getElementById('special-titles');
  if (specialEl) {
    var html = '';
    for (var si = 0; si < p.specialTitles.length; si++) {
      var key = p.specialTitles[si];
      var t = SPECIAL_TITLES[key];
      if (t) html += '<span class="special-title-badge">' + t.icon + ' ' + t.name + '</span>';
    }
    specialEl.innerHTML = html || '<p style="color:#8faa8b;font-size:13px;">まだ獲得した特殊称号はありません</p>';
  }

  showScreen('stats-screen');
}

// ============================================================
// シェア（スコアカード画像生成）
// ============================================================
function shareResult() {
  generateScoreCard().then(function(blob) {
    if (blob && navigator.share && navigator.canShare) {
      var file = new File([blob], 'keiba-quiz-score.png', { type: 'image/png' });
      var shareData = { files: [file], text: getShareText() };
      if (navigator.canShare(shareData)) {
        navigator.share(shareData);
        return;
      }
    }
    // フォールバック: テキストシェア
    if (navigator.share) {
      navigator.share({ text: getShareText() });
    } else {
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(getShareText()), '_blank');
    }
  });
}

function getShareText() {
  var title = getCurrentTitle();
  return title.icon + '競馬クイズ' + title.icon + '\nスコア: ' + Math.floor(score) + '/' + shuffledQuiz.length + '\n最大コンボ: ' + maxCombo + '\n称号: ' + title.name + '\n\nあなたも挑戦してみて！';
}

function generateScoreCard() {
  return document.fonts.ready.then(function() {
    var canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    var ctx = canvas.getContext('2d');

    // 背景
    ctx.fillStyle = '#1b3a2d';
    ctx.fillRect(0, 0, 1200, 630);

    // 金のライン
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 0, 1200, 6);
    ctx.fillRect(0, 624, 1200, 6);

    // タイトル
    ctx.font = '900 48px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.textAlign = 'center';
    ctx.fillText('🏇 競馬クイズ 🏇', 600, 80);

    // スコア
    ctx.font = '900 120px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.fillText(Math.floor(score).toString(), 600, 260);

    ctx.font = '400 36px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#8faa8b';
    ctx.fillText('/ ' + shuffledQuiz.length + '問中', 600, 310);

    // コンボ
    ctx.font = '700 32px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#f39c12';
    ctx.fillText('最大コンボ: ' + maxCombo, 600, 380);

    // 称号
    var title = getCurrentTitle();
    ctx.font = '900 40px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#f0ece2';
    ctx.fillText(title.icon + ' ' + title.name, 600, 450);

    // レベル
    var p = getPlayerData();
    ctx.font = '700 28px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#8faa8b';
    ctx.fillText('Lv.' + p.level, 600, 510);

    // 正答率
    var acc = shuffledQuiz.length > 0 ? Math.round(correctCount / shuffledQuiz.length * 100) : 0;
    ctx.fillText('正答率: ' + acc + '%', 600, 560);

    return new Promise(function(resolve) { canvas.toBlob(resolve, 'image/png'); });
  });
}

function downloadScoreCard() {
  generateScoreCard().then(function(blob) {
    if (!blob) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'keiba-quiz-score.png';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ============================================================
// 対戦URL コピー
// ============================================================
function copyBattleUrl() {
  var input = document.getElementById('battle-url');
  if (input) {
    navigator.clipboard.writeText(input.value).then(function() {
      var btn = document.getElementById('copy-battle-btn');
      if (btn) { btn.textContent = 'コピー済み！'; setTimeout(function() { btn.textContent = 'URLをコピー'; }, 2000); }
    });
  }
}

// ============================================================
// その他
// ============================================================
function retryQuiz() {
  document.getElementById('name-modal').style.display = 'none';
  startQuiz();
}

function backToStart() {
  updateStartScreen();
  showScreen('start-screen');
}

// ============================================================
// 読み上げ機能
// ============================================================
var speechEnabled = false;

function speakText(text) {
  if (!speechEnabled) return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 1.0;
  window.speechSynthesis.speak(u);
}

function speakQuestion() {
  if (!speechEnabled) return;
  var q = shuffledQuiz[currentQuestion];
  if (!q) return;
  var labels = ['A', 'B', 'C', 'D'];
  var text = q.question + '。';
  q.choices.forEach(function(c, i) {
    text += labels[i] + '、' + c + '。';
  });
  speakText(text);
}

function speakAnswer(q, wasCorrect) {
  if (!speechEnabled) return;
  var labels = ['A', 'B', 'C', 'D'];
  var text = wasCorrect ? '正解！' : '不正解。';
  text += '答えは、' + labels[q.answer] + '、' + q.choices[q.answer] + '。';
  if (q.explanation) text += q.explanation;
  speakText(text);
}

// ============================================================
// タブ切り替え
// ============================================================
function switchMainTab(tabName) {
  var tabs = document.querySelectorAll('.main-tab');
  var contents = document.querySelectorAll('.tab-content');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }
  for (var i = 0; i < contents.length; i++) {
    contents[i].classList.remove('active');
  }
  document.getElementById('tab-' + tabName).classList.add('active');
  document.getElementById('tab-' + tabName + '-content').classList.add('active');

  if (tabName === 'board') {
    loadThreadList();
  }
}

// ============================================================
// 掲示板機能（スレッド式）
// ============================================================
var threadLastDoc = null;
var currentThreadId = null;
var replyLastDoc = null;

function formatDate(ts) {
  var date = ts ? ts.toDate() : new Date();
  return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
}

// --- スレッド一覧 ---
function loadThreadList() {
  if (!db) {
    var el = document.getElementById('thread-list');
    if (el) el.innerHTML = '<p class="board-empty">掲示板は現在準備中です</p>';
    return;
  }

  threadLastDoc = null;
  var el = document.getElementById('thread-list');
  if (el) el.innerHTML = '';
  loadThreads();
}

function loadThreads() {
  if (!db) return;

  var query = db.collection('threads').orderBy('lastReplyAt', 'desc').limit(20);
  if (threadLastDoc) query = query.startAfter(threadLastDoc);

  query.get().then(function(snapshot) {
    var el = document.getElementById('thread-list');
    if (!el) return;

    if (snapshot.empty && !threadLastDoc) {
      el.innerHTML = '<p class="board-empty">まだスレッドがありません。最初のスレッドを作ろう！</p>';
      return;
    }

    snapshot.forEach(function(doc) {
      var data = doc.data();
      threadLastDoc = doc;

      var item = document.createElement('div');
      item.className = 'thread-item';
      item.setAttribute('data-id', doc.id);

      var title = document.createElement('div');
      title.className = 'thread-item-title';
      title.textContent = data.title || '無題';

      var meta = document.createElement('div');
      meta.className = 'thread-item-meta';

      var info = document.createElement('span');
      info.textContent = (data.name || '名無し') + ' · ' + formatDate(data.createdAt);

      var replies = document.createElement('span');
      replies.className = 'thread-item-replies';
      replies.textContent = (data.replyCount || 0) + '件の返信';

      meta.appendChild(info);
      meta.appendChild(replies);

      item.appendChild(title);
      item.appendChild(meta);
      el.appendChild(item);

      item.addEventListener('click', function() {
        openThread(doc.id, data);
      });
    });

    var loadMore = document.getElementById('thread-load-more');
    if (loadMore) {
      loadMore.style.display = snapshot.size >= 20 ? 'block' : 'none';
    }
  }).catch(function(err) {
    console.error('スレッド読み込みエラー:', err);
    var el = document.getElementById('thread-list');
    if (el) el.innerHTML = '<p class="board-empty">読み込みに失敗しました</p>';
  });
}

// --- スレッド作成 ---
function showNewThreadModal() {
  var modal = document.getElementById('thread-modal');
  if (modal) modal.style.display = 'flex';
}

function hideNewThreadModal() {
  var modal = document.getElementById('thread-modal');
  if (modal) modal.style.display = 'none';
}

function createThread() {
  if (!db) { alert('掲示板は現在準備中です'); return; }

  var titleEl = document.getElementById('thread-title-input');
  var nameEl = document.getElementById('thread-name-input');
  var bodyEl = document.getElementById('thread-body-input');

  var title = titleEl ? titleEl.value.trim() : '';
  var name = nameEl ? nameEl.value.trim() : '';
  var body = bodyEl ? bodyEl.value.trim() : '';

  if (!title) { alert('タイトルを入力してください'); return; }
  if (!name) { alert('ニックネームを入力してください'); return; }
  if (!body) { alert('本文を入力してください'); return; }

  var btn = document.getElementById('thread-create-btn');
  if (btn) btn.disabled = true;

  var now = firebase.firestore.FieldValue.serverTimestamp();
  db.collection('threads').add({
    title: title,
    name: name,
    body: body,
    createdAt: now,
    lastReplyAt: now,
    replyCount: 0
  }).then(function() {
    if (titleEl) titleEl.value = '';
    if (bodyEl) bodyEl.value = '';
    if (btn) btn.disabled = false;
    hideNewThreadModal();
    loadThreadList();
  }).catch(function(err) {
    if (btn) btn.disabled = false;
    alert('作成に失敗しました: ' + err.message);
  });
}

// --- スレッド詳細 ---
function openThread(threadId, data) {
  currentThreadId = threadId;
  replyLastDoc = null;

  var headerEl = document.getElementById('thread-header');
  if (headerEl) {
    headerEl.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'thread-detail-title';
    title.textContent = data.title || '無題';

    var body = document.createElement('div');
    body.className = 'thread-detail-body';
    body.textContent = data.body || '';

    var meta = document.createElement('div');
    meta.className = 'thread-detail-meta';
    meta.textContent = (data.name || '名無し') + ' · ' + formatDate(data.createdAt);

    headerEl.appendChild(title);
    headerEl.appendChild(body);
    headerEl.appendChild(meta);
  }

  var repliesEl = document.getElementById('thread-replies');
  if (repliesEl) repliesEl.innerHTML = '';

  loadReplies();
  showScreen('thread-screen');
}

function loadReplies() {
  if (!db || !currentThreadId) return;

  var query = db.collection('threads').doc(currentThreadId)
    .collection('replies').orderBy('createdAt', 'asc').limit(50);
  if (replyLastDoc) query = query.startAfter(replyLastDoc);

  query.get().then(function(snapshot) {
    var el = document.getElementById('thread-replies');
    if (!el) return;

    if (snapshot.empty && !replyLastDoc) {
      el.innerHTML = '<p class="board-empty">まだ返信がありません</p>';
    }

    snapshot.forEach(function(doc) {
      var data = doc.data();
      replyLastDoc = doc;

      // 最初に「まだ返信がありません」があれば消す
      var emptyMsg = el.querySelector('.board-empty');
      if (emptyMsg) emptyMsg.remove();

      var item = document.createElement('div');
      item.className = 'board-post-item';

      var header = document.createElement('div');
      header.className = 'board-post-header';

      var nameEl = document.createElement('span');
      nameEl.className = 'board-post-name';
      nameEl.textContent = data.name || '名無し';

      var dateEl = document.createElement('span');
      dateEl.className = 'board-post-date';
      dateEl.textContent = formatDate(data.createdAt);

      header.appendChild(nameEl);
      header.appendChild(dateEl);

      var body = document.createElement('div');
      body.className = 'board-post-body';
      body.textContent = data.message || '';

      item.appendChild(header);
      item.appendChild(body);
      el.appendChild(item);
    });

    var loadMore = document.getElementById('reply-load-more');
    if (loadMore) {
      loadMore.style.display = snapshot.size >= 50 ? 'block' : 'none';
    }
  }).catch(function(err) {
    console.error('返信読み込みエラー:', err);
  });
}

function postReply() {
  if (!db || !currentThreadId) { alert('掲示板は現在準備中です'); return; }

  var nameEl = document.getElementById('reply-name');
  var msgEl = document.getElementById('reply-message');
  var name = nameEl ? nameEl.value.trim() : '';
  var message = msgEl ? msgEl.value.trim() : '';

  if (!name) { alert('ニックネームを入力してください'); return; }
  if (!message) { alert('メッセージを入力してください'); return; }

  var btn = document.getElementById('reply-post-btn');
  if (btn) btn.disabled = true;

  var batch = db.batch();
  var replyRef = db.collection('threads').doc(currentThreadId).collection('replies').doc();
  batch.set(replyRef, {
    name: name,
    message: message,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  var threadRef = db.collection('threads').doc(currentThreadId);
  batch.update(threadRef, {
    lastReplyAt: firebase.firestore.FieldValue.serverTimestamp(),
    replyCount: firebase.firestore.FieldValue.increment(1)
  });

  batch.commit().then(function() {
    if (msgEl) msgEl.value = '';
    if (btn) btn.disabled = false;
    replyLastDoc = null;
    var el = document.getElementById('thread-replies');
    if (el) el.innerHTML = '';
    loadReplies();
  }).catch(function(err) {
    if (btn) btn.disabled = false;
    alert('投稿に失敗しました: ' + err.message);
  });
}

function backFromThread() {
  currentThreadId = null;
  showScreen('start-screen');
  switchMainTab('board');
}

// ============================================================
// イベントリスナー登録
// ============================================================
function bind(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', function(e) { e.preventDefault(); fn(); });
}

function initEvents() {
  // スタート画面
  bind('start-btn', startQuiz);
  bind('daily-btn', startDailyChallenge);
  bind('battle-btn', startBattle);
  bind('wrong-bank-btn', startWrongBankReview);
  bind('ranking-btn', showRanking);
  bind('stats-btn', showStatsScreen);

  // クイズ画面
  bind('next-btn', nextQuestion);

  // 結果画面
  bind('retry-btn', retryQuiz);
  bind('review-btn', startReview);
  bind('ranking-btn-2', showRanking);
  bind('share-btn', shareResult);
  bind('download-card-btn', downloadScoreCard);
  bind('copy-battle-btn', copyBattleUrl);

  // ランキング画面
  bind('rank-tab-all', function() { switchRankingTab('all'); });
  bind('rank-tab-week', function() { switchRankingTab('week'); });
  bind('ranking-back-btn', backToStart);

  // 成績画面
  bind('stats-back-btn', backToStart);

  // モーダル
  bind('submit-score-btn', submitScore);
  bind('skip-ranking-btn', skipRanking);

  // ガチャ
  bind('close-gacha-btn', closeGacha);

  // メインタブ
  bind('tab-quiz', function() { switchMainTab('quiz'); });
  bind('tab-board', function() { switchMainTab('board'); });

  // 掲示板（スレッド式）
  bind('new-thread-btn', showNewThreadModal);
  bind('thread-create-btn', createThread);
  bind('thread-cancel-btn', hideNewThreadModal);
  bind('thread-load-more', loadThreads);
  bind('thread-back-btn', backFromThread);
  bind('reply-post-btn', postReply);
  bind('reply-load-more', loadReplies);

  // 読み上げ
  bind('speak-btn', speakQuestion);
  var speechToggle = document.getElementById('speech-toggle');
  if (speechToggle) {
    speechToggle.addEventListener('change', function() {
      speechEnabled = speechToggle.checked;
    });
  }
}

// ============================================================
// 初期化
// ============================================================
function init() {
  try {
    initEvents();
    checkStreak();
    updateStartScreen();
    checkBattleFromUrl();
  } catch (e) {
    console.error('初期化エラー:', e);
  }
}

// DOMが確実に準備できてから初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
