// sound-manager.js — Web Audio API synthesis 
// AudioContext is lazy-initialized on first user 
// gesture to satisfy autoplay policy.

export class SoundManager {
  isEnabled = true;
  #ctx = null;
  #clickBuffer = null;
  #chimeBuffer = null;

  // Call once inside a user gesture (e.g. first button click).
  // Safe to call multiple times — only initializes once.
  async init() {
    if (this.#ctx) return;
    this.#ctx = new AudioContext();
    if (this.#ctx.state === 'suspended') {
      await this.#ctx.resume();
    }
    this.#clickBuffer = this.#makeClick();
    this.#chimeBuffer = this.#makeChime();
  }

  playTileMove() {
    if (!this.isEnabled || !this.#clickBuffer) return;
    this.#playBuffer(this.#clickBuffer);
  }

  playSolvedChime() {
    if (!this.isEnabled || !this.#chimeBuffer) return;
    this.#playBuffer(this.#chimeBuffer);
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
  }

  // ─── Synthesis ──────────────────────────────────────────────────────────

  // 600 Hz sine, 35 ms, quadratic decay — port of makeClick()
  #makeClick() {
    const sr = this.#ctx.sampleRate;
    const duration = 0.035;
    const frameCount = Math.floor(sr * duration);
    const buffer = this.#ctx.createBuffer(1, frameCount, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      const t = i / sr;
      const env = Math.pow(1.0 - i / frameCount, 2.0);
      data[i] = Math.sin(2 * Math.PI * 600 * t) * 0.45 * env;
    }
    return buffer;
  }

  // C5→E5→G5→C6 ascending arpeggio — port of makeChime()
  #makeChime() {
    const sr = this.#ctx.sampleRate;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    const noteDur = 0.16;
    const gap = 0.10;
    const total = freqs.length * (noteDur + gap);
    const frameCount = Math.floor(sr * total);
    const buffer = this.#ctx.createBuffer(1, frameCount, sr);
    const data = buffer.getChannelData(0);

    for (let n = 0; n < freqs.length; n++) {
      const freq = freqs[n];
      const start = Math.floor(sr * n * (noteDur + gap));
      const noteFrames = Math.floor(sr * noteDur);
      const attack = Math.floor(sr * 0.008);

      for (let i = 0; i < noteFrames; i++) {
        const t = i / sr;
        const env = i < attack
          ? i / attack
          : Math.pow(1.0 - (i - attack) / (noteFrames - attack), 1.5);
        const frame = start + i;
        if (frame < frameCount) {
          data[frame] += Math.sin(2 * Math.PI * freq * t) * 0.35 * env;
        }
      }
    }
    return buffer;
  }

  #playBuffer(buffer) {
    if (!this.#ctx) return;
    const source = this.#ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.#ctx.destination);
    source.start();
  }
}
