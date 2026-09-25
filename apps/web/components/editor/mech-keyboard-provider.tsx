'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Keyboard } from 'lucide-react';
import {
  mechKeyboardManager,
  isMechKeyboardEnabled,
  setMechKeyboardEnabled,
  getMechSwitchType,
  setMechSwitchType,
  getMechVolume,
  setMechVolume
} from '@/lib/mech-keyboard';
import { Button } from '@/components/ui/button';

export function MechKeyboardProvider({ children }: { children: React.ReactNode }) {
  const activeKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMechKeyboardEnabled()) return;
      if (e.repeat) return;

      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable ||
        target.classList.contains('ProseMirror') ||
        !!target.closest('.ProseMirror, [contenteditable="true"]');

      if (!isEditable) return;

      activeKeys.current.add(e.code);

      if (e.code === 'Space') {
        mechKeyboardManager.playSpace();
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        mechKeyboardManager.playEnter();
      } else if (e.code === 'Backspace') {
        mechKeyboardManager.playBackspace();
      } else {
        mechKeyboardManager.playKeyDown();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isMechKeyboardEnabled()) return;

      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.isContentEditable ||
        target.classList.contains('ProseMirror') ||
        !!target.closest('.ProseMirror, [contenteditable="true"]');

      if (!isEditable) return;

      if (activeKeys.current.has(e.code)) {
        activeKeys.current.delete(e.code);
        mechKeyboardManager.playKeyUp();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return <>{children}</>;
}

const SWITCH_TYPES = [
  { id: 'blue', name: 'Cherry MX Blue', desc: 'Clicky, tiếng click đặc trưng', color: 'text-blue-400' },
  { id: 'red', name: 'Cherry MX Red', desc: 'Linear, êm mượt', color: 'text-red-400' },
  { id: 'brown', name: 'Cherry MX Brown', desc: 'Tactile bump, âm trung bình', color: 'text-amber-600' },
  { id: 'black', name: 'Cherry MX Black', desc: 'Heavy linear, trầm sâu', color: 'text-gray-400' },
  { id: 'topre', name: 'Topre', desc: 'Thock êm ái, cao cấp', color: 'text-purple-400' },
  { id: 'buckling', name: 'Buckling Spring', desc: 'IBM Model M, kim loại', color: 'text-emerald-400' },
];

export function MechKeyboardToggle() {
  const [enabled, setEnabled] = useState(false);
  const [switchType, setSwitchType] = useState('red');
  const [volume, setVolume] = useState(50);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEnabled(isMechKeyboardEnabled());
    setSwitchType(getMechSwitchType());
    setVolume(Math.round(getMechVolume() * 100));

    const handleUpdate = () => {
      setEnabled(isMechKeyboardEnabled());
      setSwitchType(getMechSwitchType());
      setVolume(Math.round(getMechVolume() * 100));
    };

    window.addEventListener('novelist-mech-keyboard-changed', handleUpdate);
    return () => window.removeEventListener('novelist-mech-keyboard-changed', handleUpdate);
  }, []);

  const handleToggle = () => {
    const newState = !enabled;
    setMechKeyboardEnabled(newState);
    setEnabled(newState);
    if (newState) {
      // Play a sample sound to preview
      setTimeout(() => mechKeyboardManager.playKeyDown(), 100);
    }
  };

  const handleSwitchTypeChange = (val: string) => {
    setMechSwitchType(val);
    setSwitchType(val);
    // Play a sample to preview
    if (enabled) {
      setTimeout(() => mechKeyboardManager.playKeyDown(), 50);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setMechVolume(v / 100);
    setVolume(v);
  };

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className={`h-7 w-7 sm:h-8 sm:w-8 transition-colors ${
          enabled
            ? 'text-primary bg-primary/10 hover:bg-primary/20'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Âm thanh bàn phím cơ (Mechanical Keyboard)"
        data-no-sound="true"
      >
        <Keyboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-xl border bg-card/95 backdrop-blur-md shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b">
            <span className="font-semibold flex items-center gap-1.5 text-foreground text-sm">
              <Keyboard className="w-4 h-4 text-primary" />
              Bàn phím cơ
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                data-no-sound="true"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => setOpen(false)}>
                ✕
              </Button>
            </div>
          </div>

          {/* Mobile notice */}
          <div className="text-[11px] text-muted-foreground bg-muted p-2 rounded-lg border border-border/50 mb-3 leading-relaxed">
            📱 Trên điện thoại, bàn phím ảo không phát sự kiện phím vật lý nên tính năng này chỉ hoạt động tốt nhất trên PC/laptop có bàn phím vật lý.
          </div>

          {/* Switch type selector */}
          <div className={`space-y-2 transition-opacity ${enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <span className="text-[11px] text-muted-foreground font-medium">Loại Switch</span>
            <div className="grid grid-cols-2 gap-1.5">
              {SWITCH_TYPES.map((sw) => (
                <button
                  key={sw.id}
                  onClick={() => handleSwitchTypeChange(sw.id)}
                  data-no-sound="true"
                  className={`py-1.5 px-2 rounded-lg border text-left transition-all ${
                    switchType === sw.id
                      ? 'bg-primary/10 border-primary/50 text-foreground font-medium ring-1 ring-primary/20'
                      : 'hover:bg-muted border-border/70 text-muted-foreground'
                  }`}
                >
                  <div className={`text-[11px] font-medium ${switchType === sw.id ? sw.color : ''}`}>
                    {sw.name}
                  </div>
                  <div className="text-[9px] text-muted-foreground/80 mt-0.5">{sw.desc}</div>
                </button>
              ))}
            </div>

            {/* Volume slider */}
            <div className="space-y-1 pt-2 border-t">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Âm lượng</span>
                <span>{volume}%</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
