'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, CloudRain, Waves, Wind, Moon, Sun, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AmbianceSound = 'off' | 'rain' | 'waves' | 'cosmic';

interface ZenAmbianceProps {
  onToggleSpotlight?: (enabled: boolean) => void;
  className?: string;
}

export function ZenAmbianceController({ onToggleSpotlight, className = '' }: ZenAmbianceProps) {
  const [sound, setSound] = useState<AmbianceSound>('off');
  const [volume, setVolume] = useState<number>(0.3);
  const [spotlight, setSpotlight] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);

  const stopAudio = () => {
    try {
      if (noiseSourceRef.current) {
        if ('stop' in noiseSourceRef.current && typeof (noiseSourceRef.current as any).stop === 'function') {
          (noiseSourceRef.current as any).stop();
        }
        noiseSourceRef.current.disconnect();
        noiseSourceRef.current = null;
      }
      if (lfoRef.current) {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
        lfoRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    } catch {
      // Audio already stopped
    }
  };

  const playSyntheticSound = (type: AmbianceSound, vol: number) => {
    stopAudio();
    if (type === 'off') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(vol, ctx.currentTime);
      masterGain.connect(ctx.destination);
      gainNodeRef.current = masterGain;

      // 1. Generate 4 seconds of smooth pink/brownish noise buffer
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown/Pink filter
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Gain boost
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      if (type === 'rain') {
        // Rain: Lowpass filter around 800Hz
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();
        noiseSourceRef.current = whiteNoise;
      } else if (type === 'waves') {
        // Ocean waves: Lowpass filter modulated by LFO
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // 8-second cycle
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(300, ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        whiteNoise.connect(filter);
        filter.connect(masterGain);

        whiteNoise.start();
        lfo.start();
        noiseSourceRef.current = whiteNoise;
        lfoRef.current = lfo;
      } else if (type === 'cosmic') {
        // Cosmic White Noise: Bandpass drone around 300Hz with soft resonance
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, ctx.currentTime);
        filter.Q.setValueAtTime(1.5, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start();
        noiseSourceRef.current = whiteNoise;
      }
    } catch {
      // AudioContext policy blocked or unsupported
    }
  };

  const handleSoundChange = (newSound: AmbianceSound) => {
    setSound(newSound);
    playSyntheticSound(newSound, volume);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(newVol, audioCtxRef.current.currentTime);
    }
  };

  const toggleSpotlight = () => {
    const next = !spotlight;
    setSpotlight(next);
    onToggleSpotlight?.(next);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  return (
    <div className={`relative inline-block ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className={`h-8 px-2.5 text-xs flex items-center gap-1.5 rounded-lg border transition-all ${
          sound !== 'off' || spotlight
            ? 'border-primary/50 bg-primary/10 text-primary font-medium shadow-sm'
            : 'border-border/60 hover:border-primary/30 text-muted-foreground'
        }`}
        title="Không gian viết Zen & Âm thanh thư giãn"
      >
        {sound !== 'off' ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <Wind className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">Zen Ambiance</span>
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 p-3.5 rounded-xl border bg-card/95 backdrop-blur-md shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 mb-2 border-b">
            <span className="font-semibold flex items-center gap-1.5 text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Không gian sáng tác Zen
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => setOpen(false)}>
              ✕
            </Button>
          </div>

          {/* Sound options */}
          <div className="space-y-1.5 mb-3">
            <span className="text-[11px] text-muted-foreground font-medium">Âm thanh tập trung (Offline)</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleSoundChange('off')}
                className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                  sound === 'off' ? 'bg-primary text-primary-foreground border-primary font-medium' : 'hover:bg-accent border-border/70 text-muted-foreground'
                }`}
              >
                Tắt âm
              </button>
              <button
                onClick={() => handleSoundChange('rain')}
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${
                  sound === 'rain' ? 'bg-primary text-primary-foreground border-primary font-medium' : 'hover:bg-accent border-border/70 text-muted-foreground'
                }`}
              >
                <CloudRain className="w-3 h-3" /> Mưa rơi
              </button>
              <button
                onClick={() => handleSoundChange('waves')}
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${
                  sound === 'waves' ? 'bg-primary text-primary-foreground border-primary font-medium' : 'hover:bg-accent border-border/70 text-muted-foreground'
                }`}
              >
                <Waves className="w-3 h-3" /> Sóng biển
              </button>
              <button
                onClick={() => handleSoundChange('cosmic')}
                className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${
                  sound === 'cosmic' ? 'bg-primary text-primary-foreground border-primary font-medium' : 'hover:bg-accent border-border/70 text-muted-foreground'
                }`}
              >
                <Moon className="w-3 h-3" /> Không gian
              </button>
            </div>
          </div>

          {/* Volume slider */}
          {sound !== 'off' && (
            <div className="space-y-1 mb-3 pt-1 border-t">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Âm lượng</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          )}

          {/* Spotlight Mode Toggle */}
          <div className="pt-2 border-t flex items-center justify-between">
            <span className="text-muted-foreground">Ánh sáng Spotlight</span>
            <Button
              variant={spotlight ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={toggleSpotlight}
            >
              {spotlight ? 'Đang bật' : 'Bật focus'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
