import { useState } from 'react';
import { X, Eye, EyeOff, Trash2, Plus, Library, Copy } from 'lucide-react';
import { SceneObject } from '@/types/trpg';
import { RoomAsset } from '@/hooks/useRoomAssets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// 管理対象カテゴリ。scene=セット, character=キャラ, marker=プロップ, video=動画
export type PanelCategory = 'scene_object' | 'character_object' | 'marker_object' | 'video';

interface PersistentObjectPanelProps {
  category: PanelCategory;
  objects: SceneObject[];
  assets: RoomAsset[];
  currentSceneId: string | null;
  isAdmin: boolean;
  onAddObject: (obj: { type: string; name: string; url: string; width?: number; height?: number; object_category?: string }) => void;
  onUpdateObject: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteObject: (id: string) => Promise<void>;
  onDuplicateObject?: (id: string) => void;
  onClose: () => void;
}

type AddMode = null | 'url' | 'library';

const PANEL_META: Record<PanelCategory, { title: string; defaultName: string; assetCategory: string; emptyText: string; libEmptyText: string }> = {
  scene_object:     { title: 'セット管理',       defaultName: 'セット',       assetCategory: 'object',    emptyText: 'セットがありません',         libEmptyText: 'オブジェクト素材がありません' },
  character_object: { title: 'キャラクター管理', defaultName: 'キャラクター', assetCategory: 'character', emptyText: 'キャラクターがいません',     libEmptyText: 'キャラクター素材がありません' },
  marker_object:    { title: 'プロップ管理',     defaultName: 'プロップ',     assetCategory: 'object',    emptyText: 'プロップがありません',       libEmptyText: 'オブジェクト素材がありません' },
  video:            { title: '動画管理',         defaultName: '動画',         assetCategory: 'video',     emptyText: '動画がありません',           libEmptyText: '動画素材がありません' },
};

// 画像拡張子で終わるか判定（終わらないURLはreactive等のurl_image=iframe扱い）
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif|apng)(\?.*)?$/i;

export function PersistentObjectPanel({
  category, objects, assets, currentSceneId, isAdmin,
  onAddObject, onUpdateObject, onDeleteObject, onDuplicateObject, onClose,
}: PersistentObjectPanelProps) {
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const meta = PANEL_META[category];
  const title = meta.title;
  // 動画はtypeで、それ以外はobject_categoryで絞り込む
  const filtered = category === 'video'
    ? objects.filter(o => o.type === 'video')
    : objects.filter(o => o.object_category === category && o.type !== 'video');
  const libraryAssets = assets.filter(a => a.category === meta.assetCategory);

  const doAdd = (assetName: string, assetUrl: string) => {
    const trimmed = assetUrl.trim();
    if (!trimmed || !currentSceneId) return;
    // 動画→video / 画像拡張子→image / それ以外のURL→url_image(iframe表示)
    const type = category === 'video'
      ? 'video'
      : (IMAGE_EXT_RE.test(trimmed) ? 'image' : 'url_image');
    onAddObject({
      type,
      name: assetName.trim() || meta.defaultName,
      url: trimmed,
      width: 400,
      height: 400,
      // 動画はセット扱い(scene_object)で配置
      object_category: category === 'video' ? 'scene_object' : category,
    });
  };

  const handleUrlAdd = () => {
    doAdd(name, url);
    setName('');
    setUrl('');
    setAddMode(null);
  };

  const handleLibraryAdd = (asset: RoomAsset) => {
    doAdd(asset.name, asset.url);
  };

  const closeAdd = () => {
    setAddMode(null);
    setName('');
    setUrl('');
  };

  return (
    <div
      className="glass-panel w-72 flex flex-col overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 60px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Add section */}
      {isAdmin && (
        <div className="border-b border-border shrink-0">
          {addMode === null && (
            <div className="flex gap-1 px-3 py-2">
              <button
                onClick={() => setAddMode('url')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={12} />URLから追加
              </button>
              <span className="text-muted-foreground/40 mx-1">|</span>
              <button
                onClick={() => setAddMode('library')}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Library size={12} />ライブラリから追加
              </button>
            </div>
          )}

          {addMode === 'url' && (
            <div className="px-3 py-2 flex flex-col gap-1.5">
              <Input
                placeholder="名前"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-dark text-foreground h-7 text-xs"
              />
              <Input
                placeholder={category === 'video' ? '動画URL' : '画像URL'}
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="input-dark text-foreground h-7 text-xs"
                onKeyDown={e => e.key === 'Enter' && handleUrlAdd()}
              />
              {!currentSceneId && (
                <p className="text-[10px] text-muted-foreground">シーンを選択してから追加してください</p>
              )}
              <div className="flex gap-1.5">
                <Button size="sm" onClick={handleUrlAdd} disabled={!url.trim() || !currentSceneId} className="h-6 text-xs flex-1">追加</Button>
                <Button size="sm" variant="ghost" onClick={closeAdd} className="h-6 text-xs">キャンセル</Button>
              </div>
            </div>
          )}

          {addMode === 'library' && (
            <div className="px-3 py-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">クリックで追加</span>
                <button onClick={closeAdd} className="text-[10px] text-muted-foreground hover:text-foreground">閉じる</button>
              </div>
              {!currentSceneId && (
                <p className="text-[10px] text-muted-foreground mb-1">シーンを選択してから追加してください</p>
              )}
              {libraryAssets.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3">
                  {meta.libEmptyText}
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1 max-h-36 overflow-y-auto">
                  {libraryAssets.map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => handleLibraryAdd(asset)}
                      disabled={!currentSceneId}
                      title={asset.name}
                      className="aspect-square rounded overflow-hidden bg-secondary/40 hover:ring-2 hover:ring-primary transition-all disabled:opacity-40"
                    >
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Object list */}
      <div className="overflow-y-auto flex-1 py-1">
        {filtered.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-6">
            {meta.emptyText}
          </div>
        ) : (
          filtered.map(obj => (
            <div
              key={obj.id}
              onContextMenu={isAdmin && onDuplicateObject ? (e => { e.preventDefault(); onDuplicateObject(obj.id); }) : undefined}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/20 transition-colors"
            >
              <div className="w-8 h-8 rounded overflow-hidden bg-secondary/40 shrink-0">
                <img
                  src={obj.url}
                  alt={obj.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span className="text-xs text-foreground flex-1 truncate">
                {(obj as SceneObject & { display_name?: string }).display_name ?? obj.name}
              </span>
              {isAdmin && (
                <>
                  <button
                    onClick={() => onUpdateObject(obj.id, { is_visible: !obj.is_visible })}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title={obj.is_visible !== false ? '非表示にする' : '表示する'}
                  >
                    {obj.is_visible !== false ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  {onDuplicateObject && (
                    <button
                      onClick={() => onDuplicateObject(obj.id)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                      title="複製"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteObject(obj.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    title="削除"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
