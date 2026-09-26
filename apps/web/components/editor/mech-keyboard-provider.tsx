'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Keyboard, Volume2, Sparkles, Sliders, Music, Radio, Check } from 'lucide-react';
import {
  mechKeyboardManager,
  isMechKeyboardEnabled,
  setMechKeyboardEnabled,
  getMechSwitchType,
  setMechSwitchType,
  getMechVolume,
  setMechVolume,
  getMechSpatialAudio,
  setMechSpatialAudio,
  getMechKeyUpSound,
  setMechKeyUpSound,
  SWITCH_PROFILES,
  MechSwitchProfile,
} from '@/lib/mech-keyboard';
import { Button } from '@/components/ui/button';

export function MechKeyboardProvider({ children }: { children: React.ReactNode }) {
  const activeKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMechKeyboardEnabled()) return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isEditable =
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable ||
        target.classList.contains('ProseMirror') ||
        !!target.closest('.ProseMirror, [contenteditable="true"]');

      if (!isEditable) return;

      activeKeys.current.add(e.code);
      mechKeyboardManager.playKeyDown(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isMechKeyboardEnabled()) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isEditable =
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable ||
        target.classList.contains('ProseMirror') ||
        !!target.closest('.ProseMirror, [contenteditable="true"]');

      if (!isEditable) return;

      if (activeKeys.current.has(e.code)) {
        activeKeys.current.delete(e.code);
        mechKeyboardManager.playKeyUp(e.code);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, []);

  return <>{children}</>;
}

export function MechKeyboardToggle() {
  const [enabled, setEnabled] = useState(false);
  const [switchType, setSwitchType] = useState('cream');
  const [volume, setVolume] = useState(60);
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [keyUpSound, setKeyUpSound] = useState(true);
  const [open, setOpen] = useState(false);
  const [testText, setTestText] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncState = () => {
      setEnabled(isMechKeyboardEnabled());
      setSwitchType(getMechSwitchType());
      setVolume(Math.round(getMechVolume() * 100));
      setSpatialAudio(getMechSpatialAudio());
      setKeyUpSound(getMechKeyUpSound());
    };

    syncState();
    window.addEventListener('novelist-mech-keyboard-changed', syncState);
    return () => window.removeEventListener('novelist-mech-keyboard-changed', syncState);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    const newState = !enabled;
    setMechKeyboardEnabled(newState);
    setEnabled(newState);
    if (newState) {
      setTimeout(() => mechKeyboardManager.playSpace(), 60);
    }
  };

  const handleSwitchTypeChange = (val: string) => {
    setMechSwitchType(val);
    setSwitchType(val);
    // Play preview sound
    setTimeout(() => {
      mechKeyboardManager.playKeyDown('KeyA');
      setTimeout(() => mechKeyboardManager.playKeyUp('KeyA'), 80);
    }, 40);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setMechVolume(v / 100);
    setVolume(v);
  };

  const handleSpatialToggle = () => {
    const next = !spatialAudio;
    setMechSpatialAudio(next);
    setSpatialAudio(next);
  };

  const handleKeyUpToggle = () => {
    const next = !keyUpSound;
    setMechKeyUpSound(next);
    setKeyUpSound(next);
  };

  const currentProfile = SWITCH_PROFILES.find((s) => s.id === switchType) || SWITCH_PROFILES[0];

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className={`h-7 w-7 sm:h-8 sm:w-8 transition-all relative ${
          enabled
            ? 'text-primary bg-primary/10 hover:bg-primary/20 shadow-xs'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title={`Bàn phím cơ: ${enabled ? `${currentProfile.name} (Đang bật)` : 'Đang tắt'}`}
        data-no-sound="true"
      >
        <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {enabled && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 p-4 rounded-2xl border bg-card/98 backdrop-blur-xl shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2 border-border/80 text-foreground">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-sm block leading-tight">Mô phỏng phím cơ</span>
                <span className="text-[10px] text-muted-foreground">Âm thanh thực tế chuẩn audiophile</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                  enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                title={enabled ? 'Nhấn để tắt phím cơ' : 'Nhấn để bật phím cơ'}
                data-no-sound="true"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
                onClick={() => setOpen(false)}
                data-no-sound="true"
              >
                ✕
              </Button>
            </div>
          </div>

          {/* Active Switch Hero Banner */}
          <div className="mb-3.5 p-2.5 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-medium text-xs truncate">{currentProfile.name}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${currentProfile.badgeClass}`}>
                  {currentProfile.badge}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-1">{currentProfile.description}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 shrink-0 border-border/80 hover:bg-primary/10 hover:text-primary"
              onClick={() => {
                mechKeyboardManager.playSpace();
                setTimeout(() => mechKeyboardManager.playKeyDown('KeyA'), 90);
                setTimeout(() => mechKeyboardManager.playKeyUp('KeyA'), 150);
              }}
              data-no-sound="true"
            >
              <Sparkles className="w-2.5 h-2.5 mr-1 text-primary" />
              Thử âm
            </Button>
          </div>

          {/* Switch Grid Selector */}
          <div className="space-y-1.5 mb-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Chọn loại Switch ({SWITCH_PROFILES.length})
              </span>
              <span className="text-[10px] text-primary/80">Thu âm vật lý thật 100%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {SWITCH_PROFILES.map((sw) => {
                const isSelected = switchType === sw.id;
                return (
                  <button
                    key={sw.id}
                    onClick={() => handleSwitchTypeChange(sw.id)}
                    data-no-sound="true"
                    className={`p-2 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-primary/10 border-primary/60 text-foreground ring-1 ring-primary/30 shadow-xs'
                        : 'hover:bg-muted/70 border-border/60 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-primary font-semibold' : ''}`}>
                        {sw.name}
                      </span>
                      <span className={`text-[9px] px-1 py-0.2 rounded border shrink-0 font-medium ${sw.badgeClass}`}>
                        {sw.badge}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-muted-foreground/80 leading-snug line-clamp-2">
                      {sw.description}
                    </div>
                    {isSelected && (
                      <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio Adjustments & Controls */}
          <div className="space-y-2.5 pt-2.5 border-t border-border/60">
            {/* Volume slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                  <Volume2 className="w-3.5 h-3.5 text-primary" /> Âm lượng
                </span>
                <span className="font-semibold text-foreground">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Feature Toggles */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Stereo Spatial Audio */}
              <button
                type="button"
                onClick={handleSpatialToggle}
                data-no-sound="true"
                className={`p-2 rounded-xl border text-left transition-colors flex items-center justify-between ${
                  spatialAudio
                    ? 'bg-primary/10 border-primary/40 text-foreground'
                    : 'bg-muted/40 border-border/50 text-muted-foreground'
                }`}
                title="Âm thanh tự động đổi vị trí trái/phải theo đúng vị trí phím trên bàn phím thực tế"
              >
                <div className="min-w-0 pr-1">
                  <div className="text-[10px] font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3 text-primary" /> Âm vòm 3D
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate">Stereo Panning</div>
                </div>
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${spatialAudio ? 'bg-primary text-white' : 'bg-muted border'}`}>
                  {spatialAudio && <Check className="w-2.5 h-2.5" />}
                </div>
              </button>

              {/* Key Release Sound */}
              <button
                type="button"
                onClick={handleKeyUpToggle}
                data-no-sound="true"
                className={`p-2 rounded-xl border text-left transition-colors flex items-center justify-between ${
                  keyUpSound
                    ? 'bg-primary/10 border-primary/40 text-foreground'
                    : 'bg-muted/40 border-border/50 text-muted-foreground'
                }`}
                title="Phát tiếng nảy lò xo khi nhả ngón tay khỏi phím (Upstroke)"
              >
                <div className="min-w-0 pr-1">
                  <div className="text-[10px] font-semibold flex items-center gap-1">
                    <Music className="w-3 h-3 text-primary" /> Tiếng nhả phím
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate">Key Release</div>
                </div>
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${keyUpSound ? 'bg-primary text-white' : 'bg-muted border'}`}>
                  {keyUpSound && <Check className="w-2.5 h-2.5" />}
                </div>
              </button>
            </div>

            {/* Live Typing Sandbox Input */}
            <div className="pt-1">
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Gõ thử bàn phím tại ô này để cảm nhận..."
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border/70 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
