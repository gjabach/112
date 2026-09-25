// Web Audio API Sound System for Novelist Studio
// Pure synthetic audio: 0 KB assets, 0 ms latency, works offline, delicate & non-fatiguing.

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private lastSoundTime: number = 0;
  private minIntervalMs: number = 35; // Throttle to avoid audio clutter

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('novelist_sound_enabled');
        this.enabled = stored !== null ? stored === 'true' : true;
      } catch {
        this.enabled = true;
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('novelist_sound_enabled', String(val));
        window.dispatchEvent(new CustomEvent('novelist-sound-changed', { detail: { enabled: val } }));
      } catch {}
    }
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled) {
      this.playPop();
    }
    return this.enabled;
  }

  private canPlay(): boolean {
    if (!this.enabled) return false;
    const now = performance.now();
    if (now - this.lastSoundTime < this.minIntervalMs) return false;
    this.lastSoundTime = now;
    return true;
  }

  /**
   * Soft mechanical / tactile switch click (gentle, warm, non-piercing)
   */
  public playClick(volume: number = 0.045) {
    if (!this.canPlay()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Gentle pitch envelope: starts at ~1400Hz dropping to 350Hz in 16ms
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.016);

      // Lowpass filter to shave off any harsh high click edges
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, t);

      // Ultra-short gentle gain envelope
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.02);
    } catch {}
  }

  /**
   * Warm bubble pop for switches, toggles & tabs
   */
  public playPop(volume: number = 0.04) {
    if (!this.canPlay()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Rising pitch creates a pleasant bubble pop
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(760, t + 0.025);

      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.04);
    } catch {}
  }

  /**
   * Smooth chapter turn sound: a delicate whisper paper slide & soft chime
   */
  public playChapterSwitch(volume: number = 0.035) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      // 1. Soft melodic chime
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, t); // D5
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.08); // A5

      oscGain.gain.setValueAtTime(volume * 0.7, t);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);

      // 2. Gentle filtered paper swoosh
      const bufferSize = Math.floor(ctx.sampleRate * 0.08);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, t);
      filter.Q.setValueAtTime(1.5, t);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.6, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(t);
      noise.stop(t + 0.09);
    } catch {}
  }

  /**
   * Delicate rewarding chime for chapter rename, creation & save
   */
  public playSuccess(volume: number = 0.04) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const notes = [659.25, 987.77]; // E5, B5 harmony
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.04);

        gain.gain.setValueAtTime(volume, t + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.04 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t + idx * 0.04);
        osc.stop(t + idx * 0.04 + 0.23);
      });
    } catch {}
  }

  /**
   * Low subtle tap for deletions
   */
  public playDelete(volume: number = 0.04) {
    if (!this.canPlay()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.05);

      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.07);
    } catch {}
  }
}

export const soundManager = new SoundManager();

export const playClickSound = (vol?: number) => soundManager.playClick(vol);
export const playPopSound = (vol?: number) => soundManager.playPop(vol);
export const playChapterSwitchSound = (vol?: number) => soundManager.playChapterSwitch(vol);
export const playSuccessSound = (vol?: number) => soundManager.playSuccess(vol);
export const playDeleteSound = (vol?: number) => soundManager.playDelete(vol);
export const toggleSound = () => soundManager.toggle();
export const isSoundEnabled = () => soundManager.isEnabled();
export const setSoundEnabled = (val: boolean) => soundManager.setEnabled(val);
