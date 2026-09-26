/**
 * Novelist Mechanical Keyboard Sound Simulator
 * High-fidelity, authentic physical mechanical keyboard audio engine
 * Built with Web Audio API, real-world switch recordings, stereo spatial panning,
 * humanized pitch/volume jitter, and acoustic resonance physical fallback.
 */

export interface MechSwitchProfile {
  id: string;
  name: string;
  category: 'creamy' | 'thocky' | 'smooth' | 'vintage' | 'capacitive' | 'clicky' | 'tactile' | 'linear';
  badge: string;
  badgeClass: string;
  description: string;
  type: 'multi' | 'sprite';
  folder: string;
  audioFile?: string;
  configFile?: string;
}

export const SWITCH_PROFILES: MechSwitchProfile[] = [
  {
    id: 'cream',
    name: 'NovelKeys Cream',
    category: 'creamy',
    badge: 'Creamy',
    badgeClass: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    description: 'Âm đá cẩm thạch béo ngậy, gõ cực êm mượt và tròn tiếng (Lubed Creamy)',
    type: 'multi',
    folder: 'cream',
  },
  {
    id: 'holy-pandas',
    name: 'Holy Panda',
    category: 'thocky',
    badge: 'Thocky',
    badgeClass: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    description: 'Chuẩn mực âm thock phím cơ thế giới, khấc tactile giòn tan, âm trầm sâu',
    type: 'multi',
    folder: 'holy-pandas',
  },
  {
    id: 'turquoise',
    name: 'Turquoise Tealios',
    category: 'smooth',
    badge: 'Smooth',
    badgeClass: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
    description: 'Linear siêu êm ái đầm tay, giảm chấn tinh tế, gõ nhanh không mỏi',
    type: 'multi',
    folder: 'turquoise',
  },
  {
    id: 'buckling',
    name: 'IBM Model M (Buckling Spring)',
    category: 'vintage',
    badge: 'Vintage',
    badgeClass: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    description: 'Huyền thoại bàn phím cơ IBM 1985, tiếng lò xo kim loại đanh thép cổ điển',
    type: 'multi',
    folder: 'buckling',
  },
  {
    id: 'topre',
    name: 'Topre Purple Hybrid',
    category: 'capacitive',
    badge: 'Capacitive',
    badgeClass: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    description: 'Switch điện dung tĩnh đắt đỏ, âm thock trầm ấm êm dịu như giọt nước',
    type: 'sprite',
    folder: 'topre',
    audioFile: 'sound.ogg',
    configFile: 'config.json',
  },
  {
    id: 'blue',
    name: 'Cherry MX Blue',
    category: 'clicky',
    badge: 'Clicky',
    badgeClass: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    description: 'Tiếng click đanh giòn tách bạch cơ học, phản hồi xúc giác dứt khoát',
    type: 'sprite',
    folder: 'blue',
    audioFile: 'sound.ogg',
    configFile: 'config.json',
  },
  {
    id: 'mxbrown',
    name: 'Cherry MX Brown',
    category: 'tactile',
    badge: 'Tactile',
    badgeClass: 'text-amber-700 dark:text-amber-400 bg-amber-700/10 border-amber-700/30',
    description: 'Khấc nhẹ êm tai vừa phải, cân bằng hoàn hảo cho gõ chữ văn phòng dài ngày',
    type: 'multi',
    folder: 'mxbrown',
  },
  {
    id: 'mxblack',
    name: 'Cherry MX Black',
    category: 'linear',
    badge: 'Heavy Linear',
    badgeClass: 'text-zinc-600 dark:text-zinc-300 bg-zinc-600/10 border-zinc-600/30',
    description: 'Linear lực nặng cổ điển, tiếng chạm đáy dứt khoát và trầm đục chắc chắn',
    type: 'multi',
    folder: 'mxblack',
  },
  {
    id: 'red',
    name: 'Cherry MX Red',
    category: 'linear',
    badge: 'Linear',
    badgeClass: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
    description: 'Hành trình trơn tru nhẹ nhàng, không khấc, âm thanh thanh thoát',
    type: 'sprite',
    folder: 'red',
    audioFile: 'sound.ogg',
    configFile: 'config.json',
  },
];

// Physical stereo pan map (from -0.38 leftmost to +0.38 rightmost)
const KEY_PAN_MAP: Record<string, number> = {
  Escape: -0.38, Backquote: -0.38, Tab: -0.36, CapsLock: -0.36, ShiftLeft: -0.36, ControlLeft: -0.36,
  Digit1: -0.34, KeyQ: -0.32, KeyA: -0.32, KeyZ: -0.32,
  Digit2: -0.26, Digit3: -0.20, KeyW: -0.22, KeyE: -0.16, KeyS: -0.20, KeyD: -0.14, KeyX: -0.20, KeyC: -0.14,
  Digit4: -0.10, Digit5: -0.04, KeyR: -0.08, KeyT: -0.02, KeyF: -0.08, KeyG: -0.02, KeyV: -0.08, KeyB: -0.02,
  Space: 0.0,
  Digit6: 0.04, Digit7: 0.10, KeyY: 0.02, KeyU: 0.08, KeyH: 0.02, KeyJ: 0.08, KeyN: 0.02, KeyM: 0.08,
  Digit8: 0.16, Digit9: 0.22, KeyI: 0.14, KeyO: 0.20, KeyK: 0.14, KeyL: 0.20, Comma: 0.14, Period: 0.20,
  Digit0: 0.28, Minus: 0.32, Equal: 0.36, Backspace: 0.38,
  KeyP: 0.26, BracketLeft: 0.32, BracketRight: 0.36, Backslash: 0.38,
  Semicolon: 0.26, Quote: 0.32, Enter: 0.36, NumpadEnter: 0.38,
  Slash: 0.26, ShiftRight: 0.36, ControlRight: 0.36, AltRight: 0.20,
  ArrowUp: 0.32, ArrowDown: 0.32, ArrowLeft: 0.28, ArrowRight: 0.36,
};

// Map code to keyboard row (R0..R4)
function getKeyboardRow(code: string): number {
  if (code.startsWith('Digit') || ['Minus', 'Equal', 'Backquote', 'Escape', 'Backspace'].includes(code) || code.startsWith('F')) {
    return 0;
  }
  if (['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash', 'Tab'].includes(code)) {
    return 1;
  }
  if (['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'CapsLock', 'Enter'].includes(code)) {
    return 2;
  }
  if (['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftLeft', 'ShiftRight'].includes(code)) {
    return 3;
  }
  return 4;
}

// Scancode set 1 map for sprite/buckling packs
const CODE_TO_SCANCODE: Record<string, number> = {
  Escape: 1, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5, Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10, Digit0: 11,
  Minus: 12, Equal: 13, Backspace: 14, Tab: 15,
  KeyQ: 16, KeyW: 17, KeyE: 18, KeyR: 19, KeyT: 20, KeyY: 21, KeyU: 22, KeyI: 23, KeyO: 24, KeyP: 25,
  BracketLeft: 26, BracketRight: 27, Enter: 28, ControlLeft: 29,
  KeyA: 30, KeyS: 31, KeyD: 32, KeyF: 33, KeyG: 34, KeyH: 35, KeyJ: 36, KeyK: 37, KeyL: 38,
  Semicolon: 39, Quote: 40, Backquote: 41, ShiftLeft: 42, Backslash: 43,
  KeyZ: 44, KeyX: 45, KeyC: 46, KeyV: 47, KeyB: 48, KeyN: 49, KeyM: 50,
  Comma: 51, Period: 52, Slash: 53, ShiftRight: 54, NumpadMultiply: 55, AltLeft: 56, Space: 57, CapsLock: 58,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65, F8: 66, F9: 67, F10: 68,
  Numpad7: 71, Numpad8: 72, Numpad9: 73, NumpadSubtract: 74, Numpad4: 75, Numpad5: 76, Numpad6: 77, NumpadAdd: 78,
  Numpad1: 79, Numpad2: 80, Numpad3: 81, Numpad0: 82, NumpadDecimal: 83, F11: 87, F12: 88,
  NumpadEnter: 28, ControlRight: 29, AltRight: 56,
};

interface SpriteConfig {
  defines: Record<string, [number, number]>;
}

class MechKeyboardManager {
  public enabled: boolean = false;
  public switchType: string = 'cream';
  public volume: number = 0.6;
  public spatialAudio: boolean = true;
  public keyUpSound: boolean = true;

  private audioCtx: AudioContext | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private spriteConfigCache: Map<string, SpriteConfig> = new Map();
  private loadingPacks: Set<string> = new Set();
  private lastKeyPlayTimes: Map<string, number> = new Map();
  private globalLastPlayTime: number = 0;
  private minThrottleMs: number = 12;

  constructor() {
    if (typeof window !== 'undefined') {
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window;

      const savedEnabled = localStorage.getItem('novelist_mech_keyboard_enabled');
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true';
      } else {
        this.enabled = !isMobile;
      }

      const savedSwitch = localStorage.getItem('novelist_mech_keyboard_switch');
      if (savedSwitch && SWITCH_PROFILES.some((s) => s.id === savedSwitch)) {
        this.switchType = savedSwitch;
      } else {
        this.switchType = 'cream';
      }

      const savedVolume = localStorage.getItem('novelist_mech_keyboard_volume');
      if (savedVolume !== null) {
        const v = parseFloat(savedVolume);
        if (!isNaN(v)) this.volume = Math.max(0, Math.min(1, v));
      }

      const savedSpatial = localStorage.getItem('novelist_mech_keyboard_spatial');
      if (savedSpatial !== null) {
        this.spatialAudio = savedSpatial === 'true';
      }

      const savedKeyUp = localStorage.getItem('novelist_mech_keyboard_keyup');
      if (savedKeyUp !== null) {
        this.keyUpSound = savedKeyUp === 'true';
      }

      // Preload default switch if enabled
      if (this.enabled) {
        this.schedulePreload(this.switchType);
      }
    }
  }

  public initAudio(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_enabled', val.toString());
      this.dispatchEvent();
      if (val) {
        this.initAudio();
        this.preloadPack(this.switchType);
      }
    }
  }

  public setSwitchType(type: string) {
    if (!SWITCH_PROFILES.some((s) => s.id === type)) return;
    this.switchType = type;
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_switch', type);
      this.dispatchEvent();
      this.preloadPack(type);
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_volume', this.volume.toString());
      this.dispatchEvent();
    }
  }

  public setSpatialAudio(val: boolean) {
    this.spatialAudio = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_spatial', val.toString());
      this.dispatchEvent();
    }
  }

  public setKeyUpSound(val: boolean) {
    this.keyUpSound = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('novelist_mech_keyboard_keyup', val.toString());
      this.dispatchEvent();
    }
  }

  private dispatchEvent() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novelist-mech-keyboard-changed'));
    }
  }

  private schedulePreload(packId: string) {
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => this.preloadPack(packId));
      } else {
        setTimeout(() => this.preloadPack(packId), 200);
      }
    }
  }

  public async preloadPack(packId: string): Promise<void> {
    const profile = SWITCH_PROFILES.find((s) => s.id === packId);
    if (!profile || this.loadingPacks.has(packId)) return;

    this.loadingPacks.add(packId);
    try {
      const ctx = this.initAudio();
      if (!ctx) return;

      if (profile.type === 'sprite') {
        const soundUrl = `/sounds/keyboard/${profile.folder}/${profile.audioFile}`;
        const configUrl = `/sounds/keyboard/${profile.folder}/${profile.configFile}`;

        const [soundBuf, cfg] = await Promise.all([
          this.fetchAndDecodeAudio(soundUrl, ctx),
          fetch(configUrl).then((r) => r.json()).catch(() => null),
        ]);

        if (soundBuf) {
          this.bufferCache.set(`sprite_${profile.folder}`, soundBuf);
        }
        if (cfg) {
          this.spriteConfigCache.set(profile.folder, cfg);
        }
      } else if (packId === 'buckling') {
        const buckleKeys = ['39', '1c', '0e', '1e', '2e', '30', '20', '12'];
        const urls: { key: string; url: string }[] = [];
        buckleKeys.forEach((k) => {
          urls.push({ key: `buckling_press_${k}`, url: `/sounds/keyboard/buckling/press/${k}-0.wav` });
          urls.push({ key: `buckling_release_${k}`, url: `/sounds/keyboard/buckling/release/${k}-1.wav` });
        });

        await Promise.all(
          urls.map(async ({ key, url }) => {
            if (!this.bufferCache.has(key)) {
              const buf = await this.fetchAndDecodeAudio(url, ctx);
              if (buf) this.bufferCache.set(key, buf);
            }
          })
        );
      } else {
        // Multi-file travel packs (cream, holy-pandas, turquoise, mxblack, mxbrown)
        const pressKeys = [
          'GENERIC_R0', 'GENERIC_R1', 'GENERIC_R2', 'GENERIC_R3', 'GENERIC_R4',
          'SPACE', 'ENTER', 'BACKSPACE'
        ];
        const releaseKeys = ['GENERIC', 'SPACE', 'ENTER', 'BACKSPACE'];

        const promises: Promise<void>[] = [];

        for (const k of pressKeys) {
          const cacheKey = `${profile.folder}_press_${k}`;
          if (!this.bufferCache.has(cacheKey)) {
            const url = `/sounds/keyboard/${profile.folder}/press/${k}.mp3`;
            promises.push(
              this.fetchAndDecodeAudio(url, ctx).then((buf) => {
                if (buf) this.bufferCache.set(cacheKey, buf);
              })
            );
          }
        }

        for (const k of releaseKeys) {
          const cacheKey = `${profile.folder}_release_${k}`;
          if (!this.bufferCache.has(cacheKey)) {
            const url = `/sounds/keyboard/${profile.folder}/release/${k}.mp3`;
            promises.push(
              this.fetchAndDecodeAudio(url, ctx).then((buf) => {
                if (buf) this.bufferCache.set(cacheKey, buf);
              })
            );
          }
        }

        await Promise.all(promises);
      }
    } catch (err) {
      console.warn(`[MechKeyboard] Failed to preload soundpack: ${packId}`, err);
    } finally {
      this.loadingPacks.delete(packId);
    }
  }

  private async fetchAndDecodeAudio(url: string, ctx: AudioContext): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuf);
    } catch {
      return null;
    }
  }

  /**
   * Main entry point when a key is pressed down
   */
  public playKeyDown(code: string = 'KeyA') {
    if (!this.enabled || this.volume <= 0) return;

    const ctx = this.initAudio();
    if (!ctx) return;

    const now = performance.now();
    // Fast throttle on identical key
    const lastKeyTime = this.lastKeyPlayTimes.get(code) || 0;
    if (now - lastKeyTime < this.minThrottleMs) return;
    this.lastKeyPlayTimes.set(code, now);

    // Global throttle to protect CPU / audio graph
    if (now - this.globalLastPlayTime < 6) return;
    this.globalLastPlayTime = now;

    const profile = SWITCH_PROFILES.find((s) => s.id === this.switchType) || SWITCH_PROFILES[0];
    const pan = this.spatialAudio ? (KEY_PAN_MAP[code] ?? 0.0) : 0.0;

    if (profile.type === 'sprite') {
      const played = this.playSpriteSound(profile.folder, code, true, pan);
      if (!played) {
        this.playAcousticSynthesizedFallback(code, true, pan);
      }
    } else if (profile.id === 'buckling') {
      const played = this.playBucklingSound(code, true, pan);
      if (!played) {
        this.playAcousticSynthesizedFallback(code, true, pan);
      }
    } else {
      const played = this.playMultiFileSound(profile.folder, code, true, pan);
      if (!played) {
        this.playAcousticSynthesizedFallback(code, true, pan);
      }
    }
  }

  /**
   * Main entry point when a key is released (upstroke)
   */
  public playKeyUp(code: string = 'KeyA') {
    if (!this.enabled || !this.keyUpSound || this.volume <= 0) return;

    const ctx = this.initAudio();
    if (!ctx) return;

    const profile = SWITCH_PROFILES.find((s) => s.id === this.switchType) || SWITCH_PROFILES[0];
    const pan = this.spatialAudio ? (KEY_PAN_MAP[code] ?? 0.0) : 0.0;

    if (profile.type === 'sprite') {
      // In sprite definitions, release key is often suffix "-up" or scancode + up
      this.playSpriteSound(profile.folder, code, false, pan);
    } else if (profile.id === 'buckling') {
      this.playBucklingSound(code, false, pan);
    } else {
      this.playMultiFileSound(profile.folder, code, false, pan);
    }
  }

  public playSpace() { this.playKeyDown('Space'); }
  public playEnter() { this.playKeyDown('Enter'); }
  public playBackspace() { this.playKeyDown('Backspace'); }

  /**
   * Multi-file soundpack playback (NovelKeys Cream, Holy Panda, Tealios, Brown, Black)
   */
  private playMultiFileSound(folder: string, code: string, isDown: boolean, pan: number): boolean {
    if (!this.audioCtx) return false;

    let soundKeyName: string;
    if (isDown) {
      if (code === 'Space') soundKeyName = 'SPACE';
      else if (code === 'Enter' || code === 'NumpadEnter') soundKeyName = 'ENTER';
      else if (code === 'Backspace') soundKeyName = 'BACKSPACE';
      else {
        const row = getKeyboardRow(code);
        soundKeyName = `GENERIC_R${row}`;
      }
    } else {
      if (code === 'Space') soundKeyName = 'SPACE';
      else if (code === 'Enter' || code === 'NumpadEnter') soundKeyName = 'ENTER';
      else if (code === 'Backspace') soundKeyName = 'BACKSPACE';
      else soundKeyName = 'GENERIC';
    }

    const action = isDown ? 'press' : 'release';
    const cacheKey = `${folder}_${action}_${soundKeyName}`;
    let buffer = this.bufferCache.get(cacheKey);

    // Fallbacks if specific sound is missing in cache
    if (!buffer) {
      buffer = this.bufferCache.get(`${folder}_${action}_GENERIC_R2`) ||
               this.bufferCache.get(`${folder}_${action}_GENERIC`) ||
               this.bufferCache.get(`${folder}_press_GENERIC_R2`);
    }

    if (!buffer) {
      // Kick off background fetch so it's ready for future presses
      this.preloadPack(folder);
      return false;
    }

    this.playDecodedBuffer(buffer, pan, isDown);
    return true;
  }

  /**
   * IBM Model M Buckling Spring authentic playback
   */
  private playBucklingSound(code: string, isDown: boolean, pan: number): boolean {
    if (!this.audioCtx) return false;

    let keyId: string;
    if (code === 'Space') keyId = '39';
    else if (code === 'Enter' || code === 'NumpadEnter') keyId = '1c';
    else if (code === 'Backspace') keyId = '0e';
    else {
      // Pick authentic key variation
      const variations = ['1e', '12', '20', '2e', '30'];
      const charCode = code.charCodeAt(code.length - 1) || 0;
      keyId = variations[charCode % variations.length];
    }

    const action = isDown ? 'press' : 'release';
    const cacheKey = `buckling_${action}_${keyId}`;
    let buffer = this.bufferCache.get(cacheKey);

    if (!buffer) {
      buffer = this.bufferCache.get(`buckling_${action}_1e`) || this.bufferCache.get(`buckling_press_1e`);
    }

    if (!buffer) {
      this.preloadPack('buckling');
      return false;
    }

    this.playDecodedBuffer(buffer, pan, isDown, 0.95);
    return true;
  }

  /**
   * Sprite-based soundpack playback (Topre, Cherry MX Blue, Cherry MX Red)
   */
  private playSpriteSound(folder: string, code: string, isDown: boolean, pan: number): boolean {
    if (!this.audioCtx) return false;

    const buffer = this.bufferCache.get(`sprite_${folder}`);
    const config = this.spriteConfigCache.get(folder);
    if (!buffer || !config) {
      this.preloadPack(folder);
      return false;
    }

    const scancode = CODE_TO_SCANCODE[code] ?? 30; // fallback to KeyA
    const keyStr = isDown ? scancode.toString() : `${scancode}-up`;
    
    // Look up slice timing
    let slice = config.defines[keyStr];
    if (!slice && !isDown) {
      // If no release sound defined in sprite, we can either skip or play a shortened click
      return true;
    }
    if (!slice) {
      slice = config.defines[scancode.toString()] || config.defines['30'];
    }

    if (!slice || slice.length < 2) return false;

    const offsetSec = slice[0] / 1000;
    const durationSec = Math.min(slice[1] / 1000, 0.35); // guard against overly long samples

    this.playDecodedBufferSlice(buffer, offsetSec, durationSec, pan, isDown);
    return true;
  }

  /**
   * Web Audio pipeline for playing a full buffer with humanization and stereo panning
   */
  private playDecodedBuffer(buffer: AudioBuffer, pan: number, isDown: boolean, volMultiplier: number = 1.0) {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;

    // Realistic humanized pitch jitter (±1.5% for down, ±2% for up)
    const pitchJitter = 1.0 + (Math.random() - 0.5) * 0.03;
    source.playbackRate.setValueAtTime(pitchJitter, t);

    // Master volume with subtle velocity jitter
    const gainNode = this.audioCtx.createGain();
    const velocityJitter = 0.96 + Math.random() * 0.08;
    const baseVol = isDown ? this.volume : this.volume * 0.75;
    gainNode.gain.setValueAtTime(baseVol * velocityJitter * volMultiplier, t);

    // Stereo Panning Node
    if (this.spatialAudio && typeof this.audioCtx.createStereoPanner === 'function') {
      const panner = this.audioCtx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), t);
      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.audioCtx.destination);
    } else {
      source.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
    }

    source.start(t);
  }

  /**
   * Web Audio pipeline for playing an audio sprite slice
   */
  private playDecodedBufferSlice(
    buffer: AudioBuffer,
    offsetSec: number,
    durationSec: number,
    pan: number,
    isDown: boolean
  ) {
    if (!this.audioCtx) return;
    const t = this.audioCtx.currentTime;

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;

    const pitchJitter = 1.0 + (Math.random() - 0.5) * 0.03;
    source.playbackRate.setValueAtTime(pitchJitter, t);

    const gainNode = this.audioCtx.createGain();
    const velocityJitter = 0.95 + Math.random() * 0.1;
    const baseVol = isDown ? this.volume : this.volume * 0.7;
    gainNode.gain.setValueAtTime(baseVol * velocityJitter, t);

    if (this.spatialAudio && typeof this.audioCtx.createStereoPanner === 'function') {
      const panner = this.audioCtx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), t);
      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.audioCtx.destination);
    } else {
      source.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
    }

    source.start(t, offsetSec, durationSec);
  }

  /**
   * Acoustic Physical Resonance Synthesizer (Zero-dependency realistic fallback)
   * Simulates the acoustic physics of a mechanical keycap bottoming out:
   * 1. Short noise burst (stem hitting housing) through high-pass filter (2-3ms)
   * 2. Resonant bandpass filter impulse (cavity thock) tuned to switch profile
   * 3. Low-frequency dampened sine thump (plate bottom-out)
   * ZERO laser pitch ramps or arcade "pew pew" sounds.
   */
  private playAcousticSynthesizedFallback(code: string, isDown: boolean, pan: number) {
    if (!this.audioCtx || this.volume <= 0) return;
    const t = this.audioCtx.currentTime;

    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(this.volume * (isDown ? 0.45 : 0.25), t);

    let destNode: AudioNode = this.audioCtx.destination;
    if (this.spatialAudio && typeof this.audioCtx.createStereoPanner === 'function') {
      const panner = this.audioCtx.createStereoPanner();
      panner.pan.setValueAtTime(pan, t);
      masterGain.connect(panner);
      panner.connect(this.audioCtx.destination);
    } else {
      masterGain.connect(destNode);
    }

    // 1. Key impact noise transient (3ms)
    const noiseDuration = isDown ? 0.004 : 0.003;
    const bufferSize = Math.floor(this.audioCtx.sampleRate * noiseDuration);
    if (bufferSize > 0) {
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }
      const noiseSrc = this.audioCtx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;

      const hpFilter = this.audioCtx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.value = isDown ? 1800 : 2600;

      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.7, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + noiseDuration);

      noiseSrc.connect(hpFilter);
      hpFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseSrc.start(t);
    }

    // 2. Body / Housing resonance (Thock cavity response)
    const resOsc = this.audioCtx.createOscillator();
    const resGain = this.audioCtx.createGain();
    const resFilter = this.audioCtx.createBiquadFilter();

    let resonantFreq = 520;
    if (code === 'Space') resonantFreq = 280;
    else if (code === 'Enter') resonantFreq = 420;
    else if (code === 'Backspace') resonantFreq = 650;

    resOsc.type = 'triangle';
    resOsc.frequency.setValueAtTime(resonantFreq, t);

    resFilter.type = 'bandpass';
    resFilter.frequency.setValueAtTime(resonantFreq, t);
    resFilter.Q.setValueAtTime(4.0, t);

    const resDuration = isDown ? 0.025 : 0.018;
    resGain.gain.setValueAtTime(0.6, t);
    resGain.gain.exponentialRampToValueAtTime(0.001, t + resDuration);

    resOsc.connect(resFilter);
    resFilter.connect(resGain);
    resGain.connect(masterGain);

    resOsc.start(t);
    resOsc.stop(t + resDuration);
  }
}

export const mechKeyboardManager = new MechKeyboardManager();

// React-friendly helper getters & setters
export const isMechKeyboardEnabled = () => mechKeyboardManager.enabled;
export const setMechKeyboardEnabled = (val: boolean) => mechKeyboardManager.setEnabled(val);
export const getMechSwitchType = () => mechKeyboardManager.switchType;
export const setMechSwitchType = (type: string) => mechKeyboardManager.setSwitchType(type);
export const getMechVolume = () => mechKeyboardManager.volume;
export const setMechVolume = (vol: number) => mechKeyboardManager.setVolume(vol);
export const getMechSpatialAudio = () => mechKeyboardManager.spatialAudio;
export const setMechSpatialAudio = (val: boolean) => mechKeyboardManager.setSpatialAudio(val);
export const getMechKeyUpSound = () => mechKeyboardManager.keyUpSound;
export const setMechKeyUpSound = (val: boolean) => mechKeyboardManager.setKeyUpSound(val);
