import { useState, useRef } from 'react';
import { Zap, Play, Square, Trash2, Upload, Volume2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { uploadToR2 } from '@/lib/r2upload';
import type { SeTrack } from '@/hooks/useSePlayer';
interface SePanelProps {
  tracks: SeTrack[];
  playingIds: Set<string>;
  isAdmin: boolean;
  onPlaySe: (id: string) => void;
  onStopSe: (id: string) => void;
  onStopAll: () => void;
  onAddTrack: (name: string, url: string) => void;
  onDeleteTrack: (id: string) => void;
  onUpdateVolume: (id: string, volume: number) => void;
}

export function SePanel({
  tracks, playingIds, isAdmin,
  onPlaySe, onStopSe, onStopAll, onAddTrack, onDeleteTrack, onUpdateVolume,
}: SePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `se/${crypto.randomUUID()}.${ext}`;
      const publicUrl = await uploadToR2(file, path);
      const name = file.name.replace(/\.[^/.]+$/, '');
      await onAddTrack(name, publicUrl);
    } catch (err) {
      console.error('[SE Upload] Error:', err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3.5 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-amber-400" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">SE</span>
        </div>
        <div className="flex items-center gap-1 mr-6">
          {tracks.length > 0 && (
            <button
              onClick={onStopAll}
              className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
              title="全停止"
            >
              <Square size={14} />
            </button>
          )}
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                title="SEをアップロード"
              >
                <Upload size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {tracks.map(track => {
          const isActive = playingIds.has(track.id);
          return (
            <div
              key={track.id}
              className={`group px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-amber-500/15 text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => isActive ? onStopSe(track.id) : onPlaySe(track.id)}
                  className="p-0.5 hover:text-amber-400 transition-colors"
                  title={isActive ? '停止' : '再生'}
                >
                  {isActive ? <Square size={12} /> : <Play size={12} />}
                </button>
                <span className="flex-1 truncate cursor-pointer" onClick={() => onPlaySe(track.id)}>
                  {track.name}
                </span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                )}
                {isAdmin && (
                  <button
                    onClick={() => onDeleteTrack(track.id)}
                    className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                    title="削除"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              {/* Volume slider - admin only */}
              {isAdmin && (
                <div className="flex items-center gap-2 mt-1 pl-5">
                  <Volume2 size={10} className="text-muted-foreground/60" />
                  <Slider
                    value={[track.volume * 100]}
                    onValueChange={([v]) => onUpdateVolume(track.id, v / 100)}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-[9px] text-muted-foreground/60 tabular-nums w-6 text-right">
                    {Math.round(track.volume * 100)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {tracks.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8 px-4">
            SEがまだ登録されていません。
            {isAdmin && <><br />上のアップロードボタンから追加してください。</>}
          </div>
        )}
      </div>
    </div>
  );
}
