'use client';
import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  Smartphone, 
  QrCode, 
  CheckCircle2, 
  RefreshCw, 
  Copy, 
  Key,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { 
  getSyncKey, 
  setSyncKey, 
  pushSync, 
  pullSync, 
  exportFullWorkspace,
  isAutoSyncEnabled,
  setAutoSyncEnabled
} from '@/lib/sync';

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyncDialog({ open, onOpenChange }: SyncDialogProps) {
  const [syncKey, setLocalSyncKey] = useState('default_user');
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [stats, setStats] = useState<{ projects: number; chapters: number; characters: number }>({ projects: 0, chapters: 0, characters: 0 });
  const [autoSync, setAutoSync] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [syncUrl, setSyncUrl] = useState('');

  const refreshData = () => {
    if (typeof window === 'undefined') return;
    const currentKey = getSyncKey();
    setLocalSyncKey(currentKey);
    setNewKeyInput(currentKey);
    setAutoSync(isAutoSyncEnabled());

    const workspace = exportFullWorkspace();
    if (workspace) {
      setStats({
        projects: workspace.projects.length,
        chapters: workspace.chapters.length,
        characters: workspace.characters.length
      });
    }

    const last = localStorage.getItem('novelist_last_synced');
    if (last) {
      const d = new Date(parseInt(last, 10));
      setLastSyncedTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString());
    } else {
      setLastSyncedTime('Chưa đồng bộ');
    }

    const host = window.location.origin;
    const connectUrl = `${host}/settings?sync_key=${encodeURIComponent(currentKey)}`;
    setSyncUrl(connectUrl);
  };

  useEffect(() => {
    if (open) {
      refreshData();
    }
  }, [open]);

  useEffect(() => {
    if (open && canvasRef.current && syncUrl) {
      QRCode.toCanvas(canvasRef.current, syncUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }).catch(err => {
        console.error('QR Render error:', err);
      });
    }
  }, [open, syncUrl]);

  const handleSaveKey = () => {
    if (!newKeyInput.trim()) {
      toast.error('Mã đồng bộ không được để trống');
      return;
    }
    const saved = setSyncKey(newKeyInput);
    setLocalSyncKey(saved);
    setIsEditingKey(false);
    toast.success('Đã cập nhật mã đồng bộ: ' + saved);
    refreshData();
  };

  const handlePush = async () => {
    setSyncing(true);
    try {
      const res = await pushSync();
      if (res.success) {
        toast.success(`Đã đồng bộ lên đám mây thành công! (${res.stats?.projects || stats.projects} tiểu thuyết)`);
        refreshData();
      } else {
        toast.error('Lỗi khi đồng bộ: ' + (res.error || ''));
      }
    } finally {
      setSyncing(false);
    }
  };

  const handlePull = async () => {
    setSyncing(true);
    try {
      const res = await pullSync(true);
      if (res.success) {
        toast.success('Đã cập nhật dữ liệu mới nhất từ máy chủ!');
        refreshData();
      } else {
        toast.error('Lỗi khi tải dữ liệu: ' + (res.error || ''));
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard && syncUrl) {
      navigator.clipboard.writeText(syncUrl);
      toast.success('Đã sao chép liên kết đồng bộ vào clipboard!');
    }
  };

  const handleToggleAutoSync = () => {
    const nextVal = !autoSync;
    setAutoSync(nextVal);
    setAutoSyncEnabled(nextVal);
    toast.success(nextVal ? 'Đã bật tự động đồng bộ' : 'Đã tắt tự động đồng bộ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Smartphone className="w-5 h-5 text-primary" />
            Đồng bộ Đa thiết bị (PC & Điện thoại)
          </DialogTitle>
          <DialogDescription>
            Đọc và viết tiếp tiểu thuyết trên điện thoại mọi lúc mọi nơi với tính năng đồng bộ thời gian thực.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Quick status banner */}
          <div className="p-4 rounded-xl border bg-muted/40 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                Trạng thái: Tự động đồng bộ
              </div>
              <p className="text-xs text-muted-foreground">
                Đang lưu trữ: <span className="font-medium text-foreground">{stats.projects}</span> tiểu thuyết,{' '}
                <span className="font-medium text-foreground">{stats.chapters}</span> chương,{' '}
                <span className="font-medium text-foreground">{stats.characters}</span> nhân vật.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Lần cuối: {lastSyncedTime}
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" onClick={handlePush} disabled={syncing} className="text-xs h-8">
                <CloudUpload className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-bounce' : ''}`} />
                Đẩy lên
              </Button>
              <Button size="sm" variant="outline" onClick={handlePull} disabled={syncing} className="text-xs h-8">
                <CloudDownload className="w-3.5 h-3.5 mr-1.5" />
                Tải về
              </Button>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="border rounded-xl p-5 bg-card text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-1">
              <QrCode className="w-3.5 h-3.5" />
              Cách nhanh nhất: Quét mã QR bằng Điện thoại
            </div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Mở camera trên điện thoại của bạn và quét mã dưới đây để mở ứng dụng với toàn bộ dữ liệu đã được đồng bộ tự động.
            </p>

            <div className="flex justify-center p-3 bg-white rounded-lg w-fit mx-auto shadow-inner border">
              <canvas ref={canvasRef} className="rounded" />
            </div>

            <div className="flex items-center gap-2 max-w-md mx-auto">
              <Input 
                value={syncUrl} 
                readOnly 
                className="text-xs font-mono h-8 bg-muted/50" 
              />
              <Button size="sm" variant="outline" onClick={handleCopyLink} className="h-8 shrink-0">
                <Copy className="w-3.5 h-3.5 mr-1" /> Sao chép link
              </Button>
            </div>
          </div>

          {/* Sync Key Management */}
          <div className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Key className="w-4 h-4 text-primary" />
                Mã đồng bộ cá nhân (Sync Key)
              </label>
              {!isEditingKey ? (
                <Button size="sm" variant="ghost" onClick={() => setIsEditingKey(true)} className="h-7 text-xs">
                  Thay đổi
                </Button>
              ) : (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingKey(false)} className="h-7 text-xs">Hủy</Button>
                  <Button size="sm" onClick={handleSaveKey} className="h-7 text-xs">Lưu</Button>
                </div>
              )}
            </div>

            {isEditingKey ? (
              <div className="space-y-1.5">
                <Input 
                  value={newKeyInput} 
                  onChange={e => setNewKeyInput(e.target.value)} 
                  placeholder="Nhập mã bí mật riêng của bạn (vd: tacgia_123)" 
                  className="text-sm font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Dùng chung mã này trên PC và điện thoại để liên kết 2 thiết bị với nhau.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-muted/60 p-2.5 rounded-lg border text-sm font-mono">
                <span className="font-semibold text-primary">{syncKey}</span>
                <span className="text-xs text-muted-foreground">Bảo mật thiết bị</span>
              </div>
            )}
          </div>

          {/* Settings & Info */}
          <div className="space-y-2 text-xs text-muted-foreground bg-muted/30 p-3.5 rounded-xl border">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Tự động đồng bộ khi viết truyện</span>
              <input 
                type="checkbox" 
                checked={autoSync} 
                onChange={handleToggleAutoSync}
                className="rounded border-input w-4 h-4 cursor-pointer accent-primary" 
              />
            </div>
            <p className="leading-relaxed">
              Khi được bật, mọi thay đổi khi bạn gõ chữ, tạo chương mới hay thêm nhân vật trên PC hoặc Điện thoại sẽ được tự động đồng bộ hóa mà không cần bấm nút thủ công.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
