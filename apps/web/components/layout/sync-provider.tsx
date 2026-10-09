'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  initAutoSync,
  syncBidirectional,
  exportFullWorkspace,
  type SyncStatus,
} from '@/lib/sync';
import { Button } from '@/components/ui/button';
import { Cloud, Check, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SyncContextType {
  status: SyncStatus;
  lastSynced: number | null;
  syncNow: (force?: boolean) => Promise<boolean>;
}

const SyncContext = createContext<SyncContextType>({
  status: 'idle',
  lastSynced: null,
  syncNow: async () => false,
});

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novelist_last_synced');
      return saved ? parseInt(saved, 10) : null;
    }
    return null;
  });

  useEffect(() => {
    // 1. Initialize auto-sync across entire application and capture disposer
    const cleanup = initAutoSync();

    // 2. Listen to custom sync status events
    const handleStatus = (e: any) => {
      if (e?.detail?.status) {
        setStatus(e.detail.status);
      }
      if (e?.detail?.timestamp) {
        setLastSynced(e.detail.timestamp);
      }
    };

    const handleUpdated = (e: any) => {
      // Only mark as cloud synced if event originated from verified server ack
      if (e?.detail?.fromServer || e?.detail?.serverAck) {
        setStatus('synced');
        setLastSynced(Date.now());
      }
    };

    window.addEventListener('novelist-sync-status', handleStatus);
    window.addEventListener('novelist-sync-updated', handleUpdated);

    return () => {
      cleanup();
      window.removeEventListener('novelist-sync-status', handleStatus);
      window.removeEventListener('novelist-sync-updated', handleUpdated);
    };
  }, []);

  const syncNow = useCallback(async (force: boolean = true) => {
    setStatus('syncing');
    try {
      const res = await syncBidirectional();
      const current = exportFullWorkspace();
      const totalChapters = Array.isArray(current?.chapters)
        ? current.chapters.length
        : 0;

      if (res.success && res.writeAcknowledged) {
        setStatus('synced');
        setLastSynced(Date.now());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('novelist-sync-updated', {
              detail: { data: current, fromServer: true, serverAck: true },
            })
          );
        }
        toast.success(`Đồng bộ hoàn tất! Hiện có ${totalChapters} chương`);
        return true;
      } else {
        setStatus('error');
        toast.error(
          'Chưa thể kết nối đám mây: ' + (res.error || 'Vui lòng thử lại')
        );
        return false;
      }
    } catch (e: any) {
      setStatus('error');
      toast.error('Lỗi khi đồng bộ: ' + (e?.message || 'Vui lòng thử lại'));
      return false;
    }
  }, []);

  return (
    <SyncContext.Provider value={{ status, lastSynced, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}

/**
 * Universal Sync Status Button component.
 * Can be rendered on mobile header or desktop toolbar.
 * Provides clear visual feedback and manual one-tap sync.
 */
export function SyncStatusButton({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { status, syncNow } = useSync();
  const [isClicking, setIsClicking] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isClicking || status === 'syncing') return;
    setIsClicking(true);
    await syncNow(true);
    setIsClicking(false);
  };

  const isSpinning = status === 'syncing' || isClicking;

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isSpinning}
        title={
          isSpinning
            ? 'Đang đồng bộ đám mây...'
            : status === 'error'
              ? 'Lỗi đồng bộ (Bấm để thử lại)'
              : status === 'synced'
                ? 'Đã lưu trên đám mây'
                : 'Đồng bộ đám mây (Bấm để cập nhật)'
        }
        className={`h-8 w-8 rounded-lg relative ${className}`}
      >
        {isSpinning ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : status === 'error' ? (
          <AlertCircle className="w-4 h-4 text-destructive" />
        ) : status === 'synced' ? (
          <Cloud className="w-4 h-4 text-[hsl(var(--success))] hover:text-[hsl(var(--success))]" />
        ) : (
          <Cloud className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isSpinning}
      className={`h-8 px-2.5 text-xs font-medium gap-1.5 transition-all ${
        status === 'error'
          ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
          : status === 'synced'
            ? 'border-emerald-500/30 text-[hsl(var(--success))] hover:border-emerald-500/50'
            : 'border-border/70 hover:border-primary/50 text-foreground'
      } ${className}`}
      title="Bấm để đồng bộ dữ liệu ngay lập tức giữa PC và Điện thoại"
    >
      {isSpinning ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="hidden sm:inline">Đang đồng bộ...</span>
        </>
      ) : status === 'error' ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-destructive" />
          <span>Thử lại đồng bộ</span>
        </>
      ) : status === 'synced' ? (
        <>
          <Cloud className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
          <span className="hidden sm:inline">Đã đồng bộ</span>
        </>
      ) : (
        <>
          <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">Đồng bộ</span>
        </>
      )}
    </Button>
  );
}
