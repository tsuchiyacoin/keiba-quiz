// Web Audio APIで効果音を生成（ファイル不要）
var audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  return audioCtx;
}

function playSound(type) {
  var ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  var now = ctx.currentTime;

  if (type === 'correct') {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.linearRampToValueAtTime(784, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1047, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);
    osc.start(now); osc.stop(now + 0.35);
  }

  if (type === 'wrong') {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.25);
    osc.start(now); osc.stop(now + 0.25);
  }

  if (type === 'combo') {
    [523, 659, 784, 1047].forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.2, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.06 + 0.3);
      osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.3);
    });
  }

  if (type === 'timeup') {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.4);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.45);
    osc.start(now); osc.stop(now + 0.45);
  }

  if (type === 'result') {
    [523, 659, 784, 1047, 784, 1047].forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.2);
      osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.2);
    });
  }

  if (type === 'tick') {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.start(now); osc.stop(now + 0.08);
  }

  if (type === 'levelup') {
    [523, 659, 784, 1047, 1319, 1568].forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.25, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.08 + 0.25);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.25);
    });
  }

  if (type === 'gacha') {
    for (var i = 0; i < 12; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200 + i * 30, now + i * 0.06);
      gain.gain.setValueAtTime(0.1, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.06 + 0.08);
      osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.08);
    }
    [784, 988, 1175, 1568].forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.9 + i * 0.1);
      gain.gain.setValueAtTime(0.3, now + 0.9 + i * 0.1);
      gain.gain.linearRampToValueAtTime(0, now + 0.9 + i * 0.1 + 0.3);
      osc.start(now + 0.9 + i * 0.1); osc.stop(now + 0.9 + i * 0.1 + 0.3);
    });
  }

  if (type === 'fanfare') {
    // 競馬のG1ファンファーレ風（トランペット調）
    var notes = [
      { freq: 587, dur: 0.15 },  // D5
      { freq: 587, dur: 0.15 },  // D5
      { freq: 587, dur: 0.15 },  // D5
      { freq: 784, dur: 0.3 },   // G5
      { freq: 659, dur: 0.15 },  // E5
      { freq: 784, dur: 0.15 },  // G5
      { freq: 988, dur: 0.45 },  // B5
      { freq: 784, dur: 0.15 },  // G5
      { freq: 988, dur: 0.15 },  // B5
      { freq: 1175, dur: 0.6 },  // D6
    ];
    var t = 0;
    for (var fi = 0; fi < notes.length; fi++) {
      var n = notes[fi];
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.freq, now + t);
      gain.gain.setValueAtTime(0.18, now + t);
      gain.gain.linearRampToValueAtTime(0.12, now + t + n.dur * 0.8);
      gain.gain.linearRampToValueAtTime(0, now + t + n.dur);
      osc.start(now + t); osc.stop(now + t + n.dur);
      t += n.dur;
    }
  }

  if (type === 'startrace') {
    // クイズ開始時のゲート音
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    osc.start(now); osc.stop(now + 0.5);
    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, now + 0.5);
    gain2.gain.setValueAtTime(0.3, now + 0.5);
    gain2.gain.linearRampToValueAtTime(0, now + 1.0);
    osc2.start(now + 0.5); osc2.stop(now + 1.0);
  }

  if (type === 'bonus') {
    [1047, 1319, 1568, 1319, 1568, 2093].forEach(function(freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.15, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.05 + 0.15);
      osc.start(now + i * 0.05); osc.stop(now + i * 0.05 + 0.15);
    });
  }
}

// 振動フィードバック
function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
