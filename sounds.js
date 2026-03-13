// Web Audio APIで効果音を生成（ファイル不要）
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  // iOS対策: ユーザー操作後にresumeが必要
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const now = audioCtx.currentTime;

  if (type === 'correct') {
    // 正解: 明るい上昇音
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523, now);
    osc.frequency.linearRampToValueAtTime(784, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1047, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  if (type === 'wrong') {
    // 不正解: ブッ！低い音
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  if (type === 'combo') {
    // コンボ: 派手な和音
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.2, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.06 + 0.3);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.3);
    });
  }

  if (type === 'timeup') {
    // 時間切れ: 焦る下降音
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.4);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  if (type === 'result') {
    // 結果発表: ファンファーレ風
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.2);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.2);
    });
  }

  if (type === 'tick') {
    // 残り3秒の警告音
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}

// 振動フィードバック
function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
