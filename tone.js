// Tiny WebAudio beeps (no external files)
class Tone {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this._tickOsc = null;
    this._tickGain = null;
  }

  _ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  setVolume(v) { this.volume = v; }

  // Simple beep: frequency, duration (s)
  beep(freq = 880, dur = 0.12) {
    this._ensure();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  // Chime sequence
  chime() {
    this._ensure();
    const freqs = [660, 880, 660];
    freqs.forEach((f, i) => setTimeout(() => this.beep(f, 0.12), i * 160));
  }

  // Per-second ticking (enable/disable)
  startTick() {
    if (this._tickOsc) return;
    this._ensure();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 2; // low-frequency modulation
    gain.gain.value = 0;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();

    // emulate a subtle tick using periodic short gain bursts
    this._tickOsc = setInterval(() => {
      const now = this.ctx.currentTime;
      const click = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      click.type = "square";
      click.frequency.value = 2200;
      g.gain.setValueAtTime(Math.min(this.volume, 0.15), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      click.connect(g).connect(this.ctx.destination);
      click.start(now);
      click.stop(now + 0.03);
    }, 1000);
  }

  stopTick() {
    if (this._tickOsc) {
      clearInterval(this._tickOsc);
      this._tickOsc = null;
    }
  }
}

window.ToneKit = new Tone();
