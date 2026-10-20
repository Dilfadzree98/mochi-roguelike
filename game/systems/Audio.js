import { Rng } from './Rng.js';

// All sound is synthesized with the Web Audio API, so there are no audio files.
// Browsers only allow audio after a key press or click, so call unlock() from input.

const MUTE_KEY = 'mochi-muted';
const MASTER_VOLUME = 0.5;
const MUSIC_VOLUME = 0.22;
const SFX_MIN_GAP_MS = 40; // the same sound never stacks faster than this
const SFX_GAPS = { warn: 150 }; // ...or this, for sounds that many enemies make at once

const midiToHz = (note) => 440 * Math.pow(2, (note - 69) / 12);

// One looping tune per floor; deeper floors are slower and darker.
const TUNES = [
  { tempo: 116, root: 60, scale: [0, 2, 4, 7, 9], lead: 'triangle', bass: 'square', seed: 11 },
  { tempo: 100, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'triangle', bass: 'triangle', seed: 22 },
  { tempo: 88, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], lead: 'sine', bass: 'triangle', seed: 33 },
  { tempo: 80, root: 52, scale: [0, 1, 3, 5, 7, 8, 10], lead: 'square', bass: 'sawtooth', seed: 44 },
];

// Each sound: list of [wave, startHz, endHz, durationMs, volume, delayMs], or a noise burst.
const SOUNDS = {
  shoot: [['triangle', 720, 380, 60, 0.18]],
  enemyHit: [['square', 220, 140, 45, 0.08]],
  enemyDie: [['sine', 420, 70, 220, 0.22]],
  enemyShot: [['sine', 520, 420, 70, 0.06]],
  hurt: [['square', 240, 90, 220, 0.18]],
  coin: [['square', 988, 988, 60, 0.1], ['square', 1319, 1319, 120, 0.1, 60]],
  pickup: [['triangle', 523, 523, 70, 0.18], ['triangle', 784, 784, 110, 0.18, 70]],
  item: [
    ['triangle', 523, 523, 90, 0.2],
    ['triangle', 659, 659, 90, 0.2, 90],
    ['triangle', 784, 784, 90, 0.2, 180],
    ['triangle', 1047, 1047, 220, 0.2, 270],
  ],
  door: [['triangle', 300, 520, 140, 0.15]],
  unlock: [['square', 660, 660, 60, 0.1], ['square', 880, 880, 120, 0.1, 70]],
  bossIntro: [['sawtooth', 130, 55, 700, 0.18]],
  descend: [['triangle', 600, 120, 700, 0.2]],
  select: [['square', 660, 660, 40, 0.08]],
  beam: [['sawtooth', 180, 90, 1900, 0.1], ['square', 360, 300, 1900, 0.05]],
  crit: [['square', 1200, 1800, 80, 0.1]],
  meow:[['triangle', 620, 940, 140, 0.16], ['triangle', 940, 520, 260, 0.16, 140]],
  scratch: [['sawtooth', 2200, 700, 60, 0.07], ['sawtooth', 2000, 650, 60, 0.07, 70]],
  // An attack is coming: a quick rising two-note alert.
  warn: [['square', 740, 740, 55, 0.07], ['square', 1110, 1110, 80, 0.07, 65]],
  bomb: 'noise',
};

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = this.loadMuted();
    this.lastPlayed = {};
    this.tuneIndex = null;
    this.musicPaused = false;
  }

  loadMuted() {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }

  unlock() {
    if (!this.ctx) {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!Context) return;
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = MUSIC_VOLUME;
      this.musicGain.connect(this.master);
      if (this.tuneIndex !== null) this.startScheduler();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    return this.muted;
  }

  // ---------- Sound effects ----------

  play(name) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - (this.lastPlayed[name] ?? 0) < (SFX_GAPS[name] ?? SFX_MIN_GAP_MS)) return;
    this.lastPlayed[name] = now;

    const sound = SOUNDS[name];
    if (sound === 'noise') this.noise(0.45, 0.4);
    else for (const [wave, from, to, ms, volume, delay = 0] of sound) this.tone(wave, from, to, ms, volume, delay);
  }

  tone(wave, from, to, ms, volume, delayMs = 0, destination = this.master, startAt = null) {
    const ctx = this.ctx;
    const t = startAt ?? ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + ms / 1000);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  }

  noise(seconds, volume) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const rng = new Rng(7);
    for (let i = 0; i < data.length; i++) data[i] = (rng.next() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  // ---------- Music ----------

  startMusic(index) {
    if (this.tuneIndex === index) return;
    this.tuneIndex = index;
    this.pattern = makePattern(TUNES[index]);
    this.step = 0;
    if (this.ctx) this.startScheduler();
  }

  stopMusic() {
    this.tuneIndex = null;
    clearInterval(this.timer);
    this.timer = null;
  }

  setMusicPaused(paused) {
    this.musicPaused = paused;
    if (this.musicGain) this.musicGain.gain.value = paused ? 0 : MUSIC_VOLUME;
  }

  // Schedules notes a little ahead of time so playback stays steady.
  startScheduler() {
    clearInterval(this.timer);
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => {
      if (this.tuneIndex === null) return;
      const tune = TUNES[this.tuneIndex];
      const stepSeconds = 60 / tune.tempo / 2; // eighth notes
      while (this.nextNoteAt < this.ctx.currentTime + 0.25) {
        const { lead, bass } = this.pattern[this.step % this.pattern.length];
        const ms = stepSeconds * 1000;
        if (lead) this.tone(tune.lead, midiToHz(lead), midiToHz(lead), ms * 0.9, 0.12, 0, this.musicGain, this.nextNoteAt);
        if (bass) this.tone(tune.bass, midiToHz(bass), midiToHz(bass), ms * 1.8, 0.09, 0, this.musicGain, this.nextNoteAt);
        this.nextNoteAt += stepSeconds;
        this.step += 1;
      }
    }, 50);
  }
}

// 4 bars of 8 eighth notes: a wandering melody over a simple bass line.
function makePattern(tune) {
  const rng = new Rng(tune.seed);
  const steps = [];
  const bassDegrees = [0, 0, 3, 4];
  let degree = 0;
  for (let bar = 0; bar < 4; bar++) {
    for (let i = 0; i < 8; i++) {
      degree = Phaser.Math.Clamp(degree + rng.int(-2, 2), 0, tune.scale.length * 2 - 1);
      const octave = Math.floor(degree / tune.scale.length);
      const lead = rng.chance(0.65) ? tune.root + 12 + tune.scale[degree % tune.scale.length] + octave * 12 : null;
      const bassNote = tune.root - 12 + tune.scale[bassDegrees[bar] % tune.scale.length];
      steps.push({ lead, bass: i % 4 === 0 ? bassNote : null });
    }
  }
  return steps;
}

export const Audio = new AudioSystem();
