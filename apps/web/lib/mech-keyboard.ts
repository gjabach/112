class MechKeyboardManager {
  public enabled: boolean = false;
  public switchType: string = 'red';
  public volume: number = 0.5;

  private audioCtx: AudioContext | null = null;
  private lastPlayTime: number = 0;
  private throttleMs: number = 25;

  constructor() {
    if (typeof window !== 'undefined') {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);
      
      const savedEnabled = localStorage.getItem('novelist_mech_keyboard_enabled');
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true';
      } else {
        this.enabled = !isMobile; // Default disabled on mobile, enabled on desktop if desired. Actually user asked to default to disabled on mobile.
      }

      const savedSwitch = localStorage.getItem('novelist_mech_keyboard_switch');
      if (savedSwitch) {
        this.switchType = savedSwitch;
      }

      const savedVolume = localStorage.getItem('novelist_mech_keyboard_volume');
      if (savedVolume !== null) {
        this.volume = parseFloat(savedVolume);
      }
    }
  }

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_enabled', val.toString());
      this.dispatchEvent();
      if (val) this.initAudio();
    }
  }

  public setSwitchType(type: string) {
    this.switchType = type;
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_switch', type);
      this.dispatchEvent();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_volume', this.volume.toString());
      this.dispatchEvent();
    }
  }

  private dispatchEvent() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-mech-keyboard-changed'));
    }
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.audioCtx) return null;
    const bufferSize = this.audioCtx.sampleRate * 0.1; // 100ms
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playSynthesizedSound(
    freq1: number, 
    freq2: number, 
    type: OscillatorType, 
    duration: number, 
    noiseWeight: number = 0,
    noiseFilterFreq: number = 1000
  ) {
    if (!this.enabled || this.volume <= 0) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = performance.now();
    if (now - this.lastPlayTime < this.throttleMs) return;
    this.lastPlayTime = now;

    const t = this.audioCtx.currentTime;
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(this.volume, t);
    masterGain.connect(this.audioCtx.destination);

    // Oscillator
    if (freq1 > 0) {
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq1, t);
      osc.frequency.exponentialRampToValueAtTime(freq2, t + duration);
      
      oscGain.gain.setValueAtTime(1, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + duration);
      
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(t);
      osc.stop(t + duration);
    }

    // Noise
    if (noiseWeight > 0) {
      const noiseBuffer = this.createNoiseBuffer();
      if (noiseBuffer) {
        const noiseSrc = this.audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        
        const noiseFilter = this.audioCtx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = noiseFilterFreq;

        const noiseGain = this.audioCtx.createGain();
        noiseGain.gain.setValueAtTime(noiseWeight, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        
        noiseSrc.start(t);
        noiseSrc.stop(t + duration);
      }
    }
  }

  private playDoubleSynthesizedSound(
    f1a: number, f1b: number, dur1: number,
    f2a: number, f2b: number, dur2: number, delay: number,
    noise1: number = 0, noise2: number = 0
  ) {
    if (!this.enabled || this.volume <= 0) return;
    this.initAudio();
    if (!this.audioCtx) return;

    const now = performance.now();
    if (now - this.lastPlayTime < this.throttleMs) return;
    this.lastPlayTime = now;

    const t = this.audioCtx.currentTime;
    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(this.volume, t);
    masterGain.connect(this.audioCtx.destination);

    // First click
    const osc1 = this.audioCtx.createOscillator();
    const gain1 = this.audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(f1a, t);
    osc1.frequency.exponentialRampToValueAtTime(f1b, t + dur1);
    gain1.gain.setValueAtTime(1, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + dur1);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(t);
    osc1.stop(t + dur1);

    if (noise1 > 0) {
      const buf = this.createNoiseBuffer();
      if (buf) {
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const flt = this.audioCtx.createBiquadFilter();
        flt.type = 'highpass';
        flt.frequency.value = 2000;
        const ng = this.audioCtx.createGain();
        ng.gain.setValueAtTime(noise1, t);
        ng.gain.exponentialRampToValueAtTime(0.01, t + dur1);
        src.connect(flt); flt.connect(ng); ng.connect(masterGain);
        src.start(t); src.stop(t + dur1);
      }
    }

    // Second click
    const t2 = t + delay;
    const osc2 = this.audioCtx.createOscillator();
    const gain2 = this.audioCtx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(f2a, t2);
    osc2.frequency.exponentialRampToValueAtTime(f2b, t2 + dur2);
    gain2.gain.setValueAtTime(0.8, t2);
    gain2.gain.exponentialRampToValueAtTime(0.01, t2 + dur2);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(t2);
    osc2.stop(t2 + dur2);
    
    if (noise2 > 0) {
      const buf = this.createNoiseBuffer();
      if (buf) {
        const src = this.audioCtx.createBufferSource();
        src.buffer = buf;
        const flt = this.audioCtx.createBiquadFilter();
        flt.type = 'bandpass';
        flt.frequency.value = 1500;
        const ng = this.audioCtx.createGain();
        ng.gain.setValueAtTime(noise2, t2);
        ng.gain.exponentialRampToValueAtTime(0.01, t2 + dur2);
        src.connect(flt); flt.connect(ng); ng.connect(masterGain);
        src.start(t2); src.stop(t2 + dur2);
      }
    }
  }

  private playSoundProfile(isDown: boolean, modifier: number = 1) {
    switch (this.switchType) {
      case 'blue':
        if (isDown) {
          this.playDoubleSynthesizedSound(
            2500 * modifier, 1000 * modifier, 0.02,
            1200 * modifier, 400 * modifier, 0.04, 0.015,
            0.5, 0.3
          );
        } else {
          this.playSynthesizedSound(800 * modifier, 400 * modifier, 'triangle', 0.03, 0.2, 2000);
        }
        break;
      case 'red':
        if (isDown) {
          this.playSynthesizedSound(300 * modifier, 100 * modifier, 'sine', 0.04, 0.1, 800);
        } else {
          this.playSynthesizedSound(200 * modifier, 150 * modifier, 'sine', 0.03, 0.05, 600);
        }
        break;
      case 'brown':
        if (isDown) {
          this.playDoubleSynthesizedSound(
            800 * modifier, 300 * modifier, 0.015,
            400 * modifier, 150 * modifier, 0.03, 0.01,
            0.2, 0.1
          );
        } else {
          this.playSynthesizedSound(350 * modifier, 200 * modifier, 'triangle', 0.03, 0.1, 1000);
        }
        break;
      case 'black':
        if (isDown) {
          this.playSynthesizedSound(250 * modifier, 80 * modifier, 'sine', 0.05, 0.15, 600);
        } else {
          this.playSynthesizedSound(180 * modifier, 120 * modifier, 'sine', 0.04, 0.08, 500);
        }
        break;
      case 'topre':
        if (isDown) {
          this.playSynthesizedSound(200 * modifier, 60 * modifier, 'triangle', 0.06, 0.08, 400);
        } else {
          this.playSynthesizedSound(150 * modifier, 90 * modifier, 'sine', 0.05, 0.05, 300);
        }
        break;
      case 'buckling':
        if (isDown) {
          this.playDoubleSynthesizedSound(
            3000 * modifier, 1500 * modifier, 0.01,
            900 * modifier, 200 * modifier, 0.08, 0.01,
            0.6, 0.8
          );
        } else {
          this.playSynthesizedSound(1200 * modifier, 500 * modifier, 'square', 0.05, 0.4, 2500);
        }
        break;
      default:
        // fallback to red
        this.playSynthesizedSound(300 * modifier, 100 * modifier, 'sine', 0.04, 0.1, 800);
    }
  }

  public playKeyDown() { this.playSoundProfile(true, 1); }
  public playKeyUp() { this.playSoundProfile(false, 1); }
  public playSpace() { this.playSoundProfile(true, 0.7); } // deeper
  public playEnter() { this.playSoundProfile(true, 0.85); }
  public playBackspace() { this.playSoundProfile(true, 1.2); } // higher, shorter
}

export const mechKeyboardManager = new MechKeyboardManager();

export const isMechKeyboardEnabled = () => mechKeyboardManager.enabled;
export const setMechKeyboardEnabled = (val: boolean) => mechKeyboardManager.setEnabled(val);
export const getMechSwitchType = () => mechKeyboardManager.switchType;
export const setMechSwitchType = (type: string) => mechKeyboardManager.setSwitchType(type);
export const getMechVolume = () => mechKeyboardManager.volume;
export const setMechVolume = (vol: number) => mechKeyboardManager.setVolume(vol);
