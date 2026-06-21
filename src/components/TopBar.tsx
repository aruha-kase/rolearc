import { useState } from 'react';
import { Link, LogOut, ChevronLeft, Monitor, BookOpen, Users, MapPin, Box, Film, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ObjectCategory } from '@/types/trpg';

interface TopBarProps {
  roomName: string;
  roomId: string | null;
  isAdmin: boolean;
  currentSceneId: string | null;
  shareToken: string | null;
  onAddObject: (obj: { type: string; name: string; url: string; width?: number; height?: number; object_category?: string }) => void;
  onSignOut: () => void;
  onBackToRooms?: () => void;
  onOpenScenePanel?: () => void;
  onOpenCharacterPanel?: () => void;
  onOpenMarkerPanel?: () => void;
  onOpenVideoPanel?: () => void;
}

const CATEGORY_OPTIONS: { value: ObjectCategory; label: string }[] = [
  { value: 'scene_object', label: 'セットオブジェクト' },
  { value: 'character_object', label: 'キャラクター' },
  { value: 'marker_object', label: 'プロップ' },
];

export function TopBar({
  roomName, roomId, isAdmin, currentSceneId, shareToken,
  onAddObject, onSignOut, onBackToRooms,
  onOpenScenePanel, onOpenCharacterPanel, onOpenMarkerPanel, onOpenVideoPanel,
}: TopBarProps) {
  const [urlOpen, setUrlOpen] = useState(false);
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image');
  const [urlInput, setUrlInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<ObjectCategory>('scene_object');

  // 画像拡張子で終わらないURLは url_image(iframe表示) として追加
  const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif|apng)(\?.*)?$/i;

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    const trimmed = urlInput.trim();
    const type = mediaKind === 'video'
      ? 'video'
      : (IMAGE_EXT_RE.test(trimmed) ? 'image' : 'url_image');
    onAddObject({
      type,
      name: nameInput.trim() || 'URL Object',
      url: trimmed,
      width: 400,
      height: 400,
      object_category: mediaKind === 'video' ? 'scene_object' : categoryInput,
    });
    setUrlInput('');
    setNameInput('');
    setCategoryInput('scene_object');
    setMediaKind('image');
    setUrlOpen(false);
  };

  const shareUrl = shareToken
    ? `${window.location.origin}/view/${shareToken}`
    : null;

  return (
    <>
      <div
        className="h-12 flex items-center gap-2 px-4"
        style={{
          background: 'hsla(0 0% 0% / 0.4)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.05)',
        }}
      >
        {onBackToRooms && (
          <button
            onClick={onBackToRooms}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="ルーム一覧に戻る"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <span className="text-sm font-medium text-foreground mr-4">{roomName}</span>

        {isAdmin && currentSceneId && (
          <>
            <ToolButton icon={<Plus size={14} />} label="URL追加" onClick={() => setUrlOpen(true)} />
            <div className="w-px h-4 bg-border/60 mx-1" />
            <ToolButton icon={<Users size={14} />} label="キャラ" onClick={() => onOpenCharacterPanel?.()} />
            <ToolButton icon={<MapPin size={14} />} label="プロップ" onClick={() => onOpenMarkerPanel?.()} />
            <ToolButton icon={<Box size={14} />} label="セット" onClick={() => onOpenScenePanel?.()} />
            <ToolButton icon={<Film size={14} />} label="動画" onClick={() => onOpenVideoPanel?.()} />
          </>
        )}

        {isAdmin && roomId && (
          <button
            onClick={() => window.open(`/room/${roomId}/scenario`, '_blank')}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white px-3 py-1.5 rounded-md ml-2 transition-all hover:opacity-90 hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
              boxShadow: '0 2px 12px hsla(var(--primary) / 0.35)',
            }}
            title="Live Scenario Master を開く"
          >
            <BookOpen size={14} />
            <span>LSM を開く</span>
          </button>
        )}

        <div className="flex-1" />

        {/* OBS link copy buttons */}
        {roomId && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/obs/${roomId}?obs=main`)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 input-dark transition-colors"
              title="OBSメインリンクをコピー"
            >
              <Monitor size={12} />
              <span>OBSメイン</span>
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/obs/${roomId}?obs=sub`)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 input-dark transition-colors"
              title="OBSサブリンクをコピー"
            >
              <Monitor size={12} />
              <span>OBSサブ</span>
            </button>
          </div>
        )}

        {shareUrl && (
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 input-dark transition-colors"
          >
            共有リンクをコピー
          </button>
        )}

        <button onClick={onSignOut} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <LogOut size={14} />
        </button>
      </div>

      <Dialog open={urlOpen} onOpenChange={(o) => setUrlOpen(o)}>
        <DialogContent className="glass-panel border-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">URLから追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* 画像 / 動画 切替 */}
            <div className="flex gap-1">
              {([['image', '画像'], ['video', '動画']] as const).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMediaKind(k)}
                  className={`flex-1 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                    mediaKind === k
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <Input placeholder="名前" value={nameInput} onChange={e => setNameInput(e.target.value)} className="input-dark text-foreground" />
            <Input placeholder={mediaKind === 'video' ? '動画URL' : '画像URL'} value={urlInput} onChange={e => setUrlInput(e.target.value)} className="input-dark text-foreground"
              onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()} />
            {/* 画像のみカテゴリ選択（動画はセット固定） */}
            {mediaKind === 'image' && (
              <select
                value={categoryInput}
                onChange={e => setCategoryInput(e.target.value as ObjectCategory)}
                className="w-full text-xs px-2 py-1.5 input-dark text-foreground"
              >
                {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleUrlSubmit} disabled={!urlInput.trim()}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md hover:bg-secondary/40 transition-colors"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
