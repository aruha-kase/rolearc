import { useState, useRef } from 'react';
import { Upload, Trash2, PlusCircle, Pencil, Check, X, Layers, Film, FolderPlus, CheckSquare, UserPlus } from 'lucide-react';
import { RoomAsset, AssetCategory } from '@/hooks/useRoomAssets';
import { SceneObject } from '@/types/trpg';

const CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: 'object', label: 'オブジェクト' },
  { value: 'background', label: '背景' },
  { value: 'character', label: '立ち絵' },
  { value: 'video', label: '動画' },
];

interface AssetLibraryProps {
  assets: RoomAsset[];
  loading: boolean;
  isAdmin: boolean;
  currentSceneId: string | null;
  objects: SceneObject[];
  onUpload: (file: File, category: AssetCategory) => Promise<RoomAsset | null>;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string, force?: boolean) => Promise<{ success: boolean; inUse?: boolean }>;
  onUpdateCategory: (id: string, category: AssetCategory) => void;
  onAddToScene: (asset: RoomAsset) => void;
  onCreateCharacter?: (assets: RoomAsset[]) => void;
}

export function AssetLibrary({
  assets, loading, isAdmin, currentSceneId, objects,
  onUpload, onRename, onDelete, onUpdateCategory, onAddToScene, onCreateCharacter,
}: AssetLibraryProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState<AssetCategory>('object');
  const [filter, setFilter] = useState<AssetCategory | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // 選択順を保持するため配列

  const filtered = filter === 'all' ? assets : assets.filter(a => a.category === filter);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const clearSelection = () => { setSelectedIds([]); setSelectMode(false); };

  const handleCreateCharacter = () => {
    if (!onCreateCharacter || selectedIds.length === 0) return;
    // 選択順にアセットを並べてキャラ作成
    const ordered = selectedIds
      .map(id => assets.find(a => a.id === id))
      .filter((a): a is RoomAsset => !!a);
    onCreateCharacter(ordered);
    clearSelection();
  };

  // 複数ファイルを順番にアップロード（フォルダ選択・複数選択 両対応）
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    const files = Array.from(inputEl.files ?? []);
    if (files.length === 0) return;
    // 選択カテゴリに合う種別だけに絞る（フォルダ内の混在ファイル対策）
    const wantVideo = uploadCategory === 'video';
    const targets = files.filter(f =>
      wantVideo ? f.type.startsWith('video/') : f.type.startsWith('image/'));
    if (targets.length === 0) {
      inputEl.value = '';
      return;
    }
    setUploadProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      await onUpload(targets[i], uploadCategory);
      setUploadProgress({ done: i + 1, total: targets.length });
    }
    setUploadProgress(null);
    inputEl.value = '';
  };

  const startRename = (asset: RoomAsset) => {
    setEditingId(asset.id);
    setEditName(asset.name);
  };

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = async (asset: RoomAsset) => {
    const result = await onDelete(asset.id);
    if (!result.success && result.inUse) {
      setDeleteConfirmId(asset.id);
    }
  };

  const handleForceDelete = async (id: string) => {
    await onDelete(id, true);
    setDeleteConfirmId(null);
  };

  const isVideo = (asset: RoomAsset) => asset.category === 'video';
  const isDraggable = (asset: RoomAsset) => asset.category !== 'background';

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/30 space-y-2.5">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">アセットライブラリ</span>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <select
              value={uploadCategory}
              onChange={e => setUploadCategory(e.target.value as AssetCategory)}
              className="text-[10px] px-1.5 py-1 input-dark text-muted-foreground flex-1"
            >
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept={uploadCategory === 'video' ? 'video/*' : 'image/*'}
              multiple
              className="hidden"
              onChange={handleFile}
            />
            {/* フォルダ選択用（webkitdirectoryは型に無いのでanyキャストで付与） */}
            <input
              ref={folderRef}
              type="file"
              className="hidden"
              onChange={handleFile}
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={!!uploadProgress}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded transition-colors disabled:opacity-50"
              title="複数選択できます"
            >
              <Upload size={12} />
              <span>追加</span>
            </button>
            <button
              onClick={() => folderRef.current?.click()}
              disabled={!!uploadProgress}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-secondary/40 hover:bg-secondary/60 text-foreground rounded transition-colors disabled:opacity-50"
              title="フォルダ内の画像を一括追加"
            >
              <FolderPlus size={12} />
              <span>フォルダ</span>
            </button>
          </div>
        )}

        {uploadProgress && (
          <div className="text-[11px] text-primary bg-primary/10 rounded px-2 py-1">
            アップロード中… {uploadProgress.done} / {uploadProgress.total}
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {(['all', ...CATEGORY_OPTIONS.map(o => o.value)] as const).map(v => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                filter === v
                  ? 'bg-primary/30 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {v === 'all' ? '全て' : CATEGORY_OPTIONS.find(o => o.value === v)?.label}
            </button>
          ))}
        </div>

        {/* 選択モード切替＋キャラ作成アクション */}
        {isAdmin && onCreateCharacter && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setSelectMode(m => !m); setSelectedIds([]); }}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${selectMode ? 'bg-primary/30 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}
            >
              <CheckSquare size={12} />
              <span>{selectMode ? '選択中' : '複数選択'}</span>
            </button>
            {selectMode && (
              <>
                <span className="text-[10px] text-muted-foreground">{selectedIds.length}件</span>
                <button
                  onClick={handleCreateCharacter}
                  disabled={selectedIds.length === 0 || !currentSceneId}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded transition-colors disabled:opacity-40 ml-auto"
                  title={currentSceneId ? '選択画像を表情差分にしてキャラ作成' : 'シーンを選択してください'}
                >
                  <UserPlus size={12} />
                  <span>キャラ作成</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {loading ? (
          <div className="text-xs text-muted-foreground text-center py-4">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">アセットがありません</div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filtered.map(asset => (
              <div
                key={asset.id}
                onClick={selectMode ? () => toggleSelect(asset.id) : undefined}
                onContextMenu={isAdmin && onCreateCharacter ? (e => {
                  e.preventDefault();
                  // 右クリック: 選択中ならその全部、未選択なら単体でキャラ作成
                  const ids = selectedIds.includes(asset.id) && selectedIds.length > 0 ? selectedIds : [asset.id];
                  const ordered = ids.map(id => assets.find(a => a.id === id)).filter((a): a is RoomAsset => !!a);
                  if (ordered.length > 0) { onCreateCharacter(ordered); clearSelection(); }
                }) : undefined}
                className={`group relative rounded-md overflow-hidden border bg-card/50 transition-colors ${selectedIds.includes(asset.id) ? 'border-primary ring-1 ring-primary' : 'border-border/20 hover:border-border/50'} ${selectMode ? 'cursor-pointer' : isDraggable(asset) ? 'cursor-grab active:cursor-grabbing' : ''}`}
                draggable={!selectMode && isDraggable(asset)}
                onDragStart={(e) => {
                  if (selectMode || !isDraggable(asset)) { e.preventDefault(); return; }
                  e.dataTransfer.setData('application/rolearc-asset', JSON.stringify(asset));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                {selectMode && (
                  <div className={`absolute top-1 left-1 z-10 w-5 h-5 rounded flex items-center justify-center border ${selectedIds.includes(asset.id) ? 'bg-primary border-primary text-white' : 'bg-black/50 border-white/40 text-transparent'}`}>
                    <Check size={12} />
                    {selectedIds.includes(asset.id) && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center">
                        {selectedIds.indexOf(asset.id) + 1}
                      </span>
                    )}
                  </div>
                )}
                <div className="aspect-square bg-black/20 flex items-center justify-center overflow-hidden relative">
                  {isVideo(asset) ? (
                    <>
                      <video
                        src={asset.url}
                        className="w-full h-full object-contain pointer-events-none"
                        muted
                        playsInline
                        preload="metadata"
                        draggable={false}
                        onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                        onMouseLeave={e => {
                          const v = e.currentTarget as HTMLVideoElement;
                          v.pause();
                          v.currentTime = 0;
                        }}
                        style={{ pointerEvents: 'auto' }}
                      />
                      <div className="absolute bottom-1 right-1 bg-black/60 rounded p-0.5 pointer-events-none">
                        <Film size={10} className="text-white/70" />
                      </div>
                    </>
                  ) : (
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-contain pointer-events-none"
                      loading="lazy"
                      draggable={false}
                    />
                  )}
                </div>

                <div className="p-2 space-y-1.5">
                  {editingId === asset.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="text-[10px] px-1 py-0.5 input-dark flex-1 min-w-0"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && confirmRename()}
                      />
                      <button onClick={confirmRename} className="text-green-400 hover:text-green-300"><Check size={10} /></button>
                      <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X size={10} /></button>
                    </div>
                  ) : (
                    <div className="text-xs text-foreground truncate" title={asset.name}>
                      {asset.name}
                    </div>
                  )}

                  {isAdmin && (
                    <select
                      value={asset.category}
                      onChange={e => onUpdateCategory(asset.id, e.target.value as AssetCategory)}
                      className="text-[9px] px-1 py-0.5 input-dark text-muted-foreground w-full"
                    >
                      {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}

                  <div className="flex items-center gap-1">
                    {currentSceneId && (
                      <button
                        onClick={() => onAddToScene(asset)}
                        className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 bg-primary/20 hover:bg-primary/30 text-primary rounded transition-colors flex-1"
                        title={asset.category === 'background' ? 'このシーンの背景に設定' : '現在のシーンに追加'}
                      >
                        <PlusCircle size={9} />
                        <span>{asset.category === 'background' ? '背景に設定' : 'シーンに追加'}</span>
                      </button>
                    )}
                    {isAdmin && editingId !== asset.id && (
                      <>
                        <button onClick={() => startRename(asset)} className="p-0.5 text-muted-foreground hover:text-foreground" title="名前変更">
                          <Pencil size={9} />
                        </button>
                        <button onClick={() => handleDelete(asset)} className="p-0.5 text-muted-foreground hover:text-destructive" title="削除">
                          <Trash2 size={9} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Delete confirmation for in-use assets */}
                {deleteConfirmId === asset.id && (
                  <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-2 gap-2">
                    <span className="text-[10px] text-destructive text-center">このアセットは盤面で使用中です。削除しますか？</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleForceDelete(asset.id)}
                        className="text-[10px] px-2 py-0.5 bg-destructive text-destructive-foreground rounded"
                      >
                        削除
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[10px] px-2 py-0.5 bg-secondary text-secondary-foreground rounded"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
