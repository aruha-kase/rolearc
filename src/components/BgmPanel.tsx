import { useState, useRef } from 'react';
import { Music, Play, Pause, Square, Trash2, Upload, Volume2, VolumeX, Link2, Unlink } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { uploadToR2 } from '@/lib/r2upload';
import type { BgmTrack } from '@/hooks/useBgm';
import type { Scene } from '@/types/trpg';

interface BgmPanelProps {
  tracks: BgmTrack[];
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;
  loop: boolean;
  audioUnlocked: boolean;
  isAdmin: boolean;
  currentScene: Scene | null;
  onSetVolume: (v: number) => void;
  onSetLoop: (v: boolean) => void;
  onPlayTrack: (id: string) => void;
  onStopPlayback: () => void;
  onTogglePlayback: () => void;
  onAddTrack: (name: string, url: string) => void;
  onDeleteTrack: (id: string) => void;
  onLinkBgmToScene: (sceneId: string, trackId: string | null) => void;
  onUnlockAudio: () => void;
}

export function BgmPanel({
  tracks, currentTrackId, isPlaying, volume, loop, audioUnlocked,
  isAdmin, currentScene,
  onSetVolume, onSetLoop, onPlayTrack, onStopPlayback, onTogglePlayback,
  onAddTrack, onDeleteTrack, onLinkBgmToScene, onUnlockAudio,
}: BgmPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const currentTrack = tracks.find(t => t.id === currentTrackId);
  const sceneBgmId = currentScene?.bgm_track_id ?? null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `bgm/${crypto.randomUUID()}.${ext}`;
    console.log('[BGM Upload] Uploading to R2:', path, 'type:', file.type);
    let publicUrl: string;
    try {
      publicUrl = await uploadToR2(file, path);
    } catch (err) {
      console.error('[BGM Upload] R2 upload failed:', err);
      setUploading(false);
      return;
    }
    console.log('[BGM Upload] Public URL:', publicUrl);
    const name = file.name.replace(/\.[^/.]+$/, '');
    await onAddTrack(name, publicUrl);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3.5 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music size={16} className="text-primary" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">BGM</span>
        </div>
        {isAdmin && (
          <div className="mr-6">
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
              title="BGMをアップロード"
            >
              <Upload size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Audio unlock banner */}
      {!audioUnlocked && (
        <button
          onClick={onUnlockAudio}
          className="mx-3 mt-2 px-3 py-2 text-xs bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-colors"
        >
          🔊 音声を有効化
        </button>
      )}

      {/* Now playing */}
      {currentTrack && (
        <div className="mx-3 mt-2 p-2 rounded-md bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-foreground truncate flex-1">{currentTrack.name}</span>
            <button onClick={onTogglePlayback} className="p-1 hover:text-primary transition-colors">
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <button onClick={onStopPlayback} className="p-1 hover:text-destructive transition-colors text-muted-foreground" title="停止">
              <Square size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-3 py-2 space-y-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          {volume === 0 ? <VolumeX size={12} className="text-muted-foreground" /> : <Volume2 size={12} className="text-muted-foreground" />}
          <Slider
            value={[volume * 100]}
            onValueChange={([v]) => onSetVolume(v / 100)}
            max={100}
            step={1}
            className="flex-1"
            disabled={!isAdmin}
          />
          <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{Math.round(volume * 100)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">ループ</span>
          <Switch checked={loop} onCheckedChange={onSetLoop} className="scale-75" disabled={!isAdmin} />
        </div>
        {!isAdmin && (
          <div className="text-[9px] text-muted-foreground/50">音量はGMが管理しています</div>
        )}
      </div>

      {/* Scene link */}
      {isAdmin && currentScene && (
        <div className="px-3 py-2 border-b border-border/30">
          <div className="text-[10px] text-muted-foreground mb-1">シーン: {currentScene.name}</div>
          {sceneBgmId ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-foreground flex-1 truncate">
                🎵 {tracks.find(t => t.id === sceneBgmId)?.name ?? '不明'}
              </span>
              <button
                onClick={() => onLinkBgmToScene(currentScene.id, null)}
                className="text-[10px] flex items-center gap-1 text-destructive/70 hover:text-destructive transition-colors"
                title="紐づけ解除"
              >
                <Unlink size={10} />
                解除
              </button>
            </div>
          ) : currentTrackId ? (
            <button
              onClick={() => onLinkBgmToScene(currentScene.id, currentTrackId)}
              className="text-[10px] flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
            >
              <Link2 size={10} />
              再生中のBGMをこのシーンに紐づける
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">BGMを再生してから紐づけ</span>
          )}
        </div>
      )}

      {/* Track list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {tracks.map(track => {
          const isCurrent = track.id === currentTrackId;
          const isLinked = track.id === sceneBgmId;
          return (
            <div
              key={track.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-primary/15 text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground'
              }`}
              onClick={() => onPlayTrack(track.id)}
            >
              {isCurrent && isPlaying ? (
                <div className="w-3 h-3 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                </div>
              ) : (
                <Play size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
              <span className="flex-1 truncate">{track.name}</span>
              {isLinked && <span title="シーンに紐づけ済み"><Music size={10} className="text-primary/60" /></span>}
              {isAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteTrack(track.id); }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  title="削除"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          );
        })}
        {tracks.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8 px-4">
            BGMがまだ登録されていません。
            {isAdmin && <><br />上のアップロードボタンから追加してください。</>}
          </div>
        )}
      </div>
    </div>
  );
}
