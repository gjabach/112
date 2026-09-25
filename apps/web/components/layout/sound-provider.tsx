'use client';

import React, { useEffect, useState } from 'react';
import { playClickSound, toggleSound, isSoundEnabled } from '@/lib/sound';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SoundProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find closest interactive element
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const interactive = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"], select, summary');
      if (!interactive) return;

      // Check if sound is disabled on this element
      if (interactive.getAttribute('data-no-sound') === 'true') return;
      if (interactive.hasAttribute('disabled') || interactive.getAttribute('aria-disabled') === 'true') return;

      playClickSound();
    };

    document.addEventListener('click', handleClick, { passive: true, capture: true });
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, []);

  return <>{children}</>;
}

export function SoundToggleButton({ className = '' }: { className?: string }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
    const onSoundChange = (e: any) => {
      if (e.detail && typeof e.detail.enabled === 'boolean') {
        setEnabled(e.detail.enabled);
      }
    };
    window.addEventListener('novelist-sound-changed', onSoundChange);
    return () => window.removeEventListener('novelist-sound-changed', onSoundChange);
  }, []);

  const handleToggle = () => {
    const newState = toggleSound();
    setEnabled(newState);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={`h-8 w-8 text-muted-foreground hover:text-foreground relative transition-colors ${className}`}
      title={enabled ? 'Tắt âm thanh thao tác (Clicky Sound: Bật)' : 'Bật âm thanh thao tác (Clicky Sound: Đang tắt)'}
    >
      {enabled ? (
        <Volume2 className="w-4 h-4 text-primary" />
      ) : (
        <VolumeX className="w-4 h-4 text-muted-foreground/60" />
      )}
      <span className="sr-only">Toggle UI Sound</span>
    </Button>
  );
}
