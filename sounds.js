// Web Audio APIで効果音を生成（ファイル不要）
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const now = audioCtx.currentTime;

  if (type === 'correct') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.linearRampToValueAtTime(784, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1047, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);
    osc.start(now); osc.stop(now + 0.35);
  }

  if (type === 'wrong') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.25);
    osc.start(now); osc.stop(now + 0.25);
  }

  if (type === 'combo') {
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.2, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.06 + 0.3);
      osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.3);
    });
  }

  if (type === 'timeup') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.4);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.45);
    osc.start(now); osc.stop(now + 0.45);
  }

  if (type === 'result') {
    [523, 659, 784, 1047, 784, 1047].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.2);
      osc.start(now + i * 0.12); osc.stop(now + i * 0.12 + 0.2);
    });
  }

  if (type === 'tick') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.start(now); osc.stop(now + 0.08);
  }

  if (type === 'levelup') {
    [523, 659, 784, 1047, 1319, 1568].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.25, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.08 + 0.25);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.25);
    });
  }

  if (type === 'gacha') {
    // ドラムロール
    for (let i = 0; i < 12; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200 + i * 30, now + i * 0.06);
      gain.gain.setValueAtTime(0.1, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.06 + 0.08);
      osc.start(now + i * 0.06); osc.stop(now + i * 0.06 + 0.08);
    }
    // ファンファーレ (カードがめくれるタイミング)
    [784, 988, 1175, 1568].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.9 + i * 0.1);
      gain.gain.setValueAtTime(0.3, now + 0.9 + i * 0.1);
      gain.gain.linearRampToValueAtTime(0, now + 0.9 + i * 0.1 + 0.3);
      osc.start(now + 0.9 + i * 0.1); osc.stop(now + 0.9 + i * 0.1 + 0.3);
    });
  }

  if (type === 'bonus') {
    // キラキラ音
    [1047, 1319, 1568, 1319, 1568, 2093].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
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
