// ============================================================
// 状態管理
// ============================================================
let currentQuestion = 0;
let score = 0;
let answered = false;
let shuffledQuiz = [];
let timer = null;
let timeLeft = 0;
let combo = 0;
let maxCombo = 0;
let wrongList = [];
let correctCount = 0;
let isReviewMode = false;
let isDailyMode = false;
let isBattleMode = false;
let battleSeed = null;
let isHardMode = false;
let isBonusQuestion = false;
let currentTimeLimit = 15;
let prevTitleName = '';

// ============================================================
// 称号データ
// ============================================================
const TITLES = [
  { min: 0, name: '見習いファン', icon: '🐴' },
  { min: 10, name: '競馬ファン', icon: '🏇' },
  { min: 30, name: '馬券師', icon: '🎫' },
  { min: 60, name: '競馬通', icon: '🏆' },
  { min: 100, name: '競馬マスター', icon: '👑' },
  { min: 200, name: '伝説の予想家', icon: '🔥' },
];

const SPECIAL_TITLES = {
  fullCombo: { name: 'フルコンボマスター', icon: '💎' },
  dailyPerfect: { name: 'デイリーパーフェクト', icon: '🌟' },
  hardFullCombo: { name: '鉄の馬', icon: '🛡️' },
};

const GENRES = {
  general: '総合',
  g1: 'G1レース',
  bloodline: '血統',
  jockey: '騎手',
  history: '歴史',
};

const DIFFICULTY_SETTINGS = {
  beginner: { label: '初級', time: 20, xpMul: 1 },
  intermediate: { label: '中級', time: 15, xpMul: 1.5 },
  advanced: { label: '上級', time: 10, xpMul: 2 },
};

// ============================================================
// ユーティリティ
// ============================================================
function safeJsonParse(str, fallback) {
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// シード付きランダム (mulberry32)
function seededRng(seed) {
  let s = seed | 0;
  return function () {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h;
}

function getTodayStr() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function getWeekId() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// データ管理
// ============================================================
function getQuizData() {
  const saved = localStorage.getItem('keiba-quiz-questions');
  const data = saved ? safeJsonParse(saved, quizData) : quizData;
  return data.map(q => ({
    ...q,
    genre: q.genre || 'general',
    difficulty: q.difficulty || 'intermediate',
  }));
}

function getFilteredQuizData() {
  const all = getQuizData();
  const settings = getSettings();
  let filtered = all;

  if (settings.selectedGenres && settings.selectedGenres.length > 0) {
    filtered = filtered.filter(q => settings.selectedGenres.includes(q.genre));
  }
  if (settings.difficulty && settings.difficulty !== 'all') {
    filtered = filtered.filter(q => q.difficulty === settings.difficulty);
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
  const p = getPlayerData();
  p.xp += amount;
  let leveledUp = false;
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
  const s = getStreak();
  const today = getTodayStr();
  if (s.lastDate === today) return s;

  const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000).toISOString().slice(0, 10);
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
  const s = getStreak();
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
  const st = getStats();
  st.totalAnswered++;
  if (wasCorrect) st.totalCorrect++;

  const g = question.genre || 'general';
  if (!st.genres[g]) st.genres[g] = { answered: 0, correct: 0 };
  st.genres[g].answered++;
  if (wasCorrect) st.genres[g].correct++;

  saveStats(st);
}

function recordGameHistory(sc, total, acc) {
  const st = getStats();
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
  const bank = getWrongBank();
  if (!bank.find(b => b.question === q.question)) {
    bank.push(q);
    if (bank.length > 50) bank.shift();
    localStorage.setItem('keiba-wrong-bank', JSON.stringify(bank));
  }
}

function removeFromWrongBank(q) {
  let bank = getWrongBank();
  bank = bank.filter(b => b.question !== q.question);
  localStorage.setItem('keiba-wrong-bank', JSON.stringify(bank));
}

// ============================================================
// 累計正解数
// ============================================================
function getTotalCorrect() {
  return parseInt(localStorage.getItem('keiba-total-correct') || '0');
}

function addTotalCorrect(n) {
  const total = getTotalCorrect() + n;
  localStorage.setItem('keiba-total-correct', total);
  return total;
}

function getCurrentTitle() {
  const total = getTotalCorrect();
  let title = TITLES[0];
  for (const t of TITLES) {
    if (total >= t.min) title = t;
  }
  return title;
}

// ============================================================
// スタート画面
// ============================================================
function updateStartScreen() {
  const title = getCurrentTitle();
  const total = getTotalCorrect();
  const el = document.getElementById('player-title');
  if (el) {
    el.textContent = `${title.icon} ${title.name} `;
    const countSpan = document.createElement('span');
    countSpan.className = 'title-count';
    countSpan.textContent = `累計${total}問正解`;
    el.appendChild(countSpan);
  }

  // レベル & XP
  const p = getPlayerData();
  const levelEl = document.getElementById('player-level');
  const xpFill = document.getElementById('xp-fill');
  const xpText = document.getElementById('xp-text');
  if (levelEl) levelEl.textContent = p.level;
  if (xpFill) xpFill.style.width = (p.xp / xpForLevel(p.level) * 100) + '%';
  if (xpText) xpText.textContent = `${p.xp} / ${xpForLevel(p.level)} XP`;

  // ストリーク
  const streak = checkStreak();
  const streakEl = document.getElementById('streak-display');
  if (streakEl) {
    if (streak.currentStreak >= 2) {
      streakEl.style.display = 'block';
      streakEl.textContent = `🔥 ${streak.currentStreak}日連続`;
    } else {
      streakEl.style.display = 'none';
    }
  }

  // デイリーチャレンジ状態
  const dailyBtn = document.getElementById('daily-btn');
  if (dailyBtn) {
    const daily = getDailyState();
    if (daily.completed) {
      dailyBtn.textContent = `✅ 今日のスコア: ${daily.score}点`;
      dailyBtn.classList.add('completed');
    } else {
      dailyBtn.textContent = '📅 デイリーチャレンジ';
      dailyBtn.classList.remove('completed');
    }
  }

  // 間違えた問題数
  const wrongCount = getWrongBank().length;
  const wrongBadge = document.getElementById('wrong-count');
  const wrongBtn = document.getElementById('wrong-bank-btn');
  if (wrongBadge) wrongBadge.textContent = wrongCount;
  if (wrongBtn) wrongBtn.style.display = wrongCount > 0 ? 'block' : 'none';

  // 設定を復元
  const settings = getSettings();
  isHardMode = settings.hardMode || false;
  const hardToggle = document.getElementById('hard-toggle');
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

  const settings = getSettings();
  const diff = DIFFICULTY_SETTINGS[settings.difficulty] || DIFFICULTY_SETTINGS.intermediate;
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
  const settings = getSettings();

  // ジャンル
  const genreChecks = document.querySelectorAll('.genre-check');
  settings.selectedGenres = [];
  genreChecks.forEach(cb => { if (cb.checked) settings.selectedGenres.push(cb.value); });

  // 難易度
  const diffRadio = document.querySelector('input[name="difficulty"]:checked');
  settings.difficulty = diffRadio ? diffRadio.value : 'all';

  // ハードモード
  const hardToggle = document.getElementById('hard-toggle');
  settings.hardMode = hardToggle ? hardToggle.checked : false;
  isHardMode = settings.hardMode;

  saveSettings(settings);
}

function updateModeIndicator() {
  const el = document.getElementById('mode-indicator');
  if (!el) return;
  const parts = [];
  if (isHardMode) parts.push('HARD');
  if (isDailyMode) parts.push('DAILY');
  if (isBattleMode) parts.push('BATTLE');
  const settings = getSettings();
  if (settings.difficulty && settings.difficulty !== 'all') {
    parts.push(DIFFICULTY_SETTINGS[settings.difficulty]?.label || '');
  }
  el.textContent = parts.join(' | ');
  el.style.display = parts.length > 0 ? 'block' : 'none';
}

// ============================================================
// デイリーチャレンジ
// ============================================================
function getDailyState() {
  const data = safeJsonParse(localStorage.getItem('keiba-daily-state'), {});
  if (data.date !== getTodayStr()) return { date: getTodayStr(), completed: false, score: 0 };
  return data;
}

function saveDailyState(state) {
  localStorage.setItem('keiba-daily-state', JSON.stringify(state));
}

function startDailyChallenge() {
  const daily = getDailyState();
  if (daily.completed) {
    alert(`今日のチャレンジは完了済みです！\nスコア: ${daily.score}点`);
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

  const allQ = getQuizData();
  const seed = hashString(getTodayStr());
  const rng = seededRng(seed);
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
  const allQ = getQuizData();
  battleSeed = Date.now();
  const rng = seededRng(battleSeed);
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
  const allQ = getQuizData();
  const rng = seededRng(seed);
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
  const hash = window.location.hash;
  const match = hash.match(/#battle=(\d+)/);
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
  const bank = getWrongBank();
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

  // ボーナス問題判定 (15%の確率, デイリー・復習モードでは出ない)
  const bonusEl = document.getElementById('bonus-indicator');
  if (!isDailyMode && !isReviewMode && Math.random() < 0.15) {
    isBonusQuestion = true;
    if (bonusEl) bonusEl.style.display = 'block';
    playSound('bonus');
  } else {
    if (bonusEl) bonusEl.style.display = 'none';
  }

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

// ============================================================
// タイマー
// ============================================================
let tickPlayed = { 3: false, 2: false, 1: false };

function startTimer() {
  stopTimer();
  timeLeft = currentTimeLimit * 10;
  tickPlayed = { 3: false, 2: false, 1: false };
  const fill = document.getElementById('timer-fill');
  fill.style.width = '100%';
  fill.className = 'timer-fill';

  timer = setInterval(() => {
    timeLeft--;
    const pct = (timeLeft / (currentTimeLimit * 10)) * 100;
    fill.style.width = pct + '%';

    if (pct <= 20) fill.className = 'timer-fill danger';
    else if (pct <= 50) fill.className = 'timer-fill warning';

    const secLeft = Math.ceil(timeLeft / 10);
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

  const q = shuffledQuiz[currentQuestion];
  document.getElementById('timer-fill').classList.add('timeup');

  const container = document.getElementById('choices');
  const buttons = container.querySelectorAll('.choice-btn');
  const msgEl = document.getElementById('result-msg');

  buttons.forEach(b => {
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
  showExplanation(q);
  const nextBtn = document.getElementById('next-btn');
  nextBtn.style.display = 'block';
  setTimeout(() => nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

// ============================================================
// 回答選択
// ============================================================
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
    correctCount++;
    if (combo > maxCombo) maxCombo = combo;

    // 復習モードで正解したら問題バンクから削除
    if (isReviewMode) removeFromWrongBank(q);

    let comboText = '';
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
    let multiplier = 1;
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
    const bonusEl = document.getElementById('bonus-indicator');
    if (bonusEl) bonusEl.style.display = 'none';
  }

  document.getElementById('current-score').parentElement.classList.add('pop');
  setTimeout(() => document.getElementById('current-score').parentElement.classList.remove('pop'), 300);

  showExplanation(q);
  const nextBtn = document.getElementById('next-btn');
  nextBtn.style.display = 'block';
  setTimeout(() => nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
}

// ============================================================
// コンボ表示
// ============================================================
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

function showExplanation(q) {
  const expEl = document.getElementById('explanation');
  if (q.explanation) {
    expEl.textContent = q.explanation;
    expEl.classList.add('show');
  }
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
  const finalScore = Math.floor(score);
  const accuracy = shuffledQuiz.length > 0 ? correctCount / shuffledQuiz.length : 0;

  // XP計算
  const settings = getSettings();
  const diffMul = DIFFICULTY_SETTINGS[settings.difficulty]?.xpMul || 1;
  const streakMul = getStreakMultiplier();
  const hardMul = isHardMode ? 1.5 : 1;
  const baseXp = correctCount * 10;
  const totalXp = Math.floor(baseXp * diffMul * streakMul * hardMul);

  const xpResult = addXP(totalXp);
  const total = addTotalCorrect(correctCount);
  const title = getCurrentTitle();

  // 成績記録
  recordGameHistory(finalScore, shuffledQuiz.length, accuracy);

  document.getElementById('final-score').textContent = finalScore;
  document.getElementById('final-total').textContent = shuffledQuiz.length;
  document.getElementById('final-combo').textContent = maxCombo;
  document.getElementById('final-title').textContent = `${title.icon} ${title.name}`;

  // XP表示
  const xpGainedEl = document.getElementById('xp-gained');
  if (xpGainedEl) xpGainedEl.textContent = `+${totalXp} XP`;
  const resultLevelEl = document.getElementById('result-level');
  if (resultLevelEl) resultLevelEl.textContent = `Lv.${xpResult.level}`;
  const resultXpFill = document.getElementById('result-xp-fill');
  if (resultXpFill) resultXpFill.style.width = (xpResult.xp / xpForLevel(xpResult.level) * 100) + '%';

  // 次の称号
  const nextTitle = TITLES.find(t => t.min > total);
  document.getElementById('next-title-info').textContent = nextTitle
    ? `次の称号「${nextTitle.name}」まであと${nextTitle.min - total}問`
    : '最高称号達成！';

  // コメント
  const pct = accuracy;
  let comment = '';
  if (pct === 1 && maxCombo >= shuffledQuiz.length) comment = '完全制覇！フルコンボ達成！';
  else if (pct === 1) comment = '全問正解！競馬マスター！';
  else if (pct >= 0.8) comment = 'すごい！かなりの競馬通ですね';
  else if (pct >= 0.6) comment = 'なかなか！もっと詳しくなれるかも';
  else if (pct >= 0.4) comment = 'まだまだこれから！';
  else comment = '競馬の世界は奥が深い...！';
  document.getElementById('result-comment').textContent = comment;

  // 正答率
  const accEl = document.getElementById('result-accuracy');
  if (accEl) accEl.textContent = `正答率: ${Math.round(accuracy * 100)}%`;

  // 復習ボタン
  const reviewBtn = document.getElementById('review-btn');
  if (wrongList.length > 0) {
    reviewBtn.style.display = 'block';
    reviewBtn.textContent = `間違えた${wrongList.length}問を復習`;
  } else {
    reviewBtn.style.display = 'none';
  }

  // デイリーモード保存
  if (isDailyMode) {
    saveDailyState({ date: getTodayStr(), completed: true, score: finalScore });
  }

  // 対戦URL
  const battleUrlArea = document.getElementById('battle-url-area');
  if (battleUrlArea) {
    if (isBattleMode && battleSeed) {
      const url = `${window.location.origin}${window.location.pathname}#battle=${battleSeed}`;
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
    setTimeout(() => showLevelUpAnimation(xpResult.level), 600);
  }

  // フルコンボ称号チェック
  if (maxCombo >= shuffledQuiz.length && shuffledQuiz.length >= 5) {
    let specialKey = 'fullCombo';
    if (isDailyMode) specialKey = 'dailyPerfect';
    if (isHardMode) specialKey = 'hardFullCombo';
    awardSpecialTitle(specialKey);
  }

  // 称号変化チェック → ガチャ演出
  if (title.name !== prevTitleName) {
    setTimeout(() => showGachaAnimation(title), xpResult.leveledUp ? 2500 : 800);
  } else {
    setTimeout(() => {
      document.getElementById('name-modal').style.display = 'flex';
    }, 1200);
  }
}

// ============================================================
// 特殊称号
// ============================================================
function awardSpecialTitle(key) {
  const p = getPlayerData();
  if (!p.specialTitles.includes(key)) {
    p.specialTitles.push(key);
    savePlayerData(p);
  }
}

// ============================================================
// レベルアップ演出
// ============================================================
function showLevelUpAnimation(level) {
  const overlay = document.getElementById('levelup-overlay');
  if (!overlay) return;
  document.getElementById('levelup-num').textContent = level;
  overlay.style.display = 'flex';
  playSound('levelup');
  setTimeout(() => { overlay.style.display = 'none'; }, 2000);
}

// ============================================================
// ガチャ演出
// ============================================================
function showGachaAnimation(title) {
  const overlay = document.getElementById('gacha-overlay');
  if (!overlay) return;
  const card = overlay.querySelector('.gacha-card');
  document.getElementById('gacha-icon').textContent = title.icon;
  document.getElementById('gacha-name').textContent = title.name;

  overlay.style.display = 'flex';
  card.classList.remove('flipped');
  playSound('gacha');

  setTimeout(() => { card.classList.add('flipped'); }, 1000);
}

function closeGacha() {
  document.getElementById('gacha-overlay').style.display = 'none';
  setTimeout(() => {
    document.getElementById('name-modal').style.display = 'flex';
  }, 300);
}

// ============================================================
// ランキング
// ============================================================
function submitScore() {
  const name = document.getElementById('nickname-input').value.trim();
  if (!name) return;

  const title = getCurrentTitle();
  const rankings = getRankings();
  rankings.push({
    name, score: Math.floor(score), total: shuffledQuiz.length,
    combo: maxCombo, title: title.icon,
    date: new Date().toLocaleDateString('ja-JP'),
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
  return safeJsonParse(localStorage.getItem('keiba-quiz-rankings'), []);
}

// 週間ランキング
function getWeeklyRankings() {
  const data = safeJsonParse(localStorage.getItem('keiba-weekly-rankings'), { weekId: '', entries: [] });
  if (data.weekId !== getWeekId()) return { weekId: getWeekId(), entries: [] };
  return data;
}

function saveWeeklyScore(sc) {
  const data = getWeeklyRankings();
  data.weekId = getWeekId();
  const name = localStorage.getItem('keiba-last-name') || '';
  if (name) {
    data.entries.push({
      name, score: sc, date: new Date().toLocaleDateString('ja-JP'),
    });
    data.entries.sort((a, b) => b.score - a.score);
    data.entries = data.entries.slice(0, 50);
  }
  localStorage.setItem('keiba-weekly-rankings', JSON.stringify(data));
}

// ランキング表示
let rankingTab = 'all';

function showRanking() {
  rankingTab = 'all';
  renderRanking();
  showScreen('ranking-screen');
}

function switchRankingTab(tab) {
  rankingTab = tab;
  const allBtn = document.getElementById('rank-tab-all');
  const weekBtn = document.getElementById('rank-tab-week');
  if (allBtn) allBtn.classList.toggle('active', tab === 'all');
  if (weekBtn) weekBtn.classList.toggle('active', tab === 'week');
  renderRanking();
}

function renderRanking() {
  const rankings = rankingTab === 'all' ? getRankings() : getWeeklyRankings().entries;
  const listEl = document.getElementById('ranking-list');
  listEl.innerHTML = '';

  if (rankings.length === 0) {
    const p = document.createElement('p');
    p.style.cssText = 'text-align:center;color:#8faa8b;padding:40px 0;';
    p.textContent = 'まだランキングデータがありません';
    listEl.appendChild(p);
    return;
  }

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
    if (r.total) {
      const totalSpan = document.createElement('span');
      totalSpan.className = 'ranking-total';
      totalSpan.textContent = `/${r.total}`;
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
  const st = getStats();
  const p = getPlayerData();

  // 全体
  const overallEl = document.getElementById('overall-stats');
  if (overallEl) {
    const acc = st.totalAnswered > 0 ? Math.round(st.totalCorrect / st.totalAnswered * 100) : 0;
    overallEl.innerHTML = `
      <div class="stat-card"><div class="stat-num">${st.totalAnswered}</div><div class="stat-label">解答数</div></div>
      <div class="stat-card"><div class="stat-num">${acc}%</div><div class="stat-label">正答率</div></div>
      <div class="stat-card"><div class="stat-num">Lv.${p.level}</div><div class="stat-label">レベル</div></div>
      <div class="stat-card"><div class="stat-num">${getStreak().bestStreak}</div><div class="stat-label">最長連続</div></div>
    `;
  }

  // ジャンル別
  const genreEl = document.getElementById('genre-stats');
  if (genreEl) {
    let html = '';
    for (const [key, label] of Object.entries(GENRES)) {
      const g = st.genres[key];
      if (!g || g.answered === 0) continue;
      const acc = Math.round(g.correct / g.answered * 100);
      html += `
        <div class="genre-stat-row">
          <span class="genre-stat-name">${label}</span>
          <div class="genre-stat-bar"><div class="genre-stat-fill" style="width:${acc}%"></div></div>
          <span class="genre-stat-pct">${acc}%</span>
        </div>
      `;
    }
    genreEl.innerHTML = html || '<p style="color:#8faa8b;text-align:center;">まだデータがありません</p>';
  }

  // 特殊称号
  const specialEl = document.getElementById('special-titles');
  if (specialEl) {
    let html = '';
    for (const key of p.specialTitles) {
      const t = SPECIAL_TITLES[key];
      if (t) html += `<span class="special-title-badge">${t.icon} ${t.name}</span>`;
    }
    specialEl.innerHTML = html || '<p style="color:#8faa8b;font-size:13px;">まだ獲得した特殊称号はありません</p>';
  }

  showScreen('stats-screen');
}

// ============================================================
// シェア（スコアカード画像生成）
// ============================================================
function shareResult() {
  generateScoreCard().then(blob => {
    if (blob && navigator.share && navigator.canShare) {
      const file = new File([blob], 'keiba-quiz-score.png', { type: 'image/png' });
      const shareData = { files: [file], text: getShareText() };
      if (navigator.canShare(shareData)) {
        navigator.share(shareData);
        return;
      }
    }
    // フォールバック: テキストシェア
    if (navigator.share) {
      navigator.share({ text: getShareText() });
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(getShareText())}`, '_blank');
    }
  });
}

function getShareText() {
  const title = getCurrentTitle();
  return `${title.icon}競馬クイズ${title.icon}\nスコア: ${Math.floor(score)}/${shuffledQuiz.length}\n最大コンボ: ${maxCombo}\n称号: ${title.name}\n\nあなたも挑戦してみて！`;
}

function generateScoreCard() {
  return document.fonts.ready.then(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');

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
    ctx.fillText(`/ ${shuffledQuiz.length}問中`, 600, 310);

    // コンボ
    ctx.font = '700 32px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#f39c12';
    ctx.fillText(`最大コンボ: ${maxCombo}`, 600, 380);

    // 称号
    const title = getCurrentTitle();
    ctx.font = '900 40px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#f0ece2';
    ctx.fillText(`${title.icon} ${title.name}`, 600, 450);

    // レベル
    const p = getPlayerData();
    ctx.font = '700 28px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#8faa8b';
    ctx.fillText(`Lv.${p.level}`, 600, 510);

    // 正答率
    const acc = shuffledQuiz.length > 0 ? Math.round(correctCount / shuffledQuiz.length * 100) : 0;
    ctx.fillText(`正答率: ${acc}%`, 600, 560);

    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  });
}

function downloadScoreCard() {
  generateScoreCard().then(blob => {
    if (!blob) return;
    const a = document.createElement('a');
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
  const input = document.getElementById('battle-url');
  if (input) {
    navigator.clipboard.writeText(input.value).then(() => {
      const btn = document.getElementById('copy-battle-btn');
      if (btn) { btn.textContent = 'コピー済み！'; setTimeout(() => btn.textContent = 'URLをコピー', 2000); }
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
// 初期化
// ============================================================
checkStreak();
updateStartScreen();
checkBattleFromUrl();
