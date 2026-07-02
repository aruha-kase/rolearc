import { Scene } from '@/types/trpg';
import { RoomAsset } from '@/hooks/useRoomAssets';
import { Plus, Trash2, Image as ImageIcon, ChevronUp, ChevronDown, X, Copy } from 'lucide-react';
import { useState } from 'react';

interface ScenePanelProps {
  scenes: Scene[];
  currentSceneId: string | null;
  isAdmin: boolean;
  backgroundAssets: RoomAsset[];
  onSwitchScene: (id: string) => void;
  onCreateScene: (name: string) => void;
  onDeleteScene: (id: string) => void;
  onDuplicateScene: (id: string) => void;
  onSetBackground: (sceneId: string, url: string | null) => void;
  onSetSubBackground: (sceneId: string, url: string | null) => void;
  onReorderScene: (id: string, direction: 'up' | 'down') => void;
}

export function ScenePanel({
  scenes, currentSceneId, isAdmin, backgroundAssets,
  onSwitchScene, onCreateScene, onDeleteScene, onDuplicateScene, onSetBackground, onSetSubBackground, onReorderScene,
}: ScenePanelProps) {
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [bgPickerSceneId, setBgPickerSceneId] = useState<string | null>(null);
  const [bgTarget, setBgTarget] = useState<'main' | 'sub'>('main');
  const [ctxMenu, setCtxMenu] = useState<{ sceneId: string; x: number; y: number } | null>(null);

  // 背景設定の適用先(メイン/サブ)に応じて振り分け
  const applyBackground = (sceneId: string, url: string | null) => {
    if (bgTarget === 'sub') onSetSubBackground(sceneId, url);
    else onSetBackground(sceneId, url);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateScene(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  return (
    <div className="glass-panel-flat h-full flex flex-col relative" style={{ width: 240 }}>
      <div className="p-3 flex items-center justify-between border-b border-border/30">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          シーン
        </span>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {showCreate && isAdmin && (
        <div className="p-2 border-b border-border/30 flex gap-1">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="シーン名..."
            className="flex-1 text-xs px-2 py-1 input-dark text-foreground"
            autoFocus
          />
          <button onClick={handleCreate} className="text-xs text-primary px-2">
            追加
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {scenes.map((scene, idx) => (
          <div
            key={scene.id}
            onClick={() => onSwitchScene(scene.id)}
            onContextMenu={isAdmin ? (e => { e.preventDefault(); setCtxMenu({ sceneId: scene.id, x: e.clientX, y: e.clientY }); }) : undefined}
            className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
              scene.id === currentSceneId
                ? 'bg-primary/15 text-foreground'
                : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground'
            }`}
          >
            <div
              className="w-8 h-5 rounded bg-secondary/50 flex-shrink-0 overflow-hidden"
              style={{ aspectRatio: '16/9' }}
            >
              {scene.background_url && (
                <img src={scene.background_url} className="w-full h-full object-cover" alt="" />
              )}
            </div>
            <span className="flex-1 truncate text-xs">{scene.name}</span>
            {isAdmin && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); onReorderScene(scene.id, 'up'); }}
                  className="p-0.5 hover:text-primary disabled:opacity-30"
                  title="上へ"
                  disabled={idx === 0}
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onReorderScene(scene.id, 'down'); }}
                  className="p-0.5 hover:text-primary disabled:opacity-30"
                  title="下へ"
                  disabled={idx === scenes.length - 1}
                >
                  <ChevronDown size={12} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setBgTarget('main'); setBgPickerSceneId(scene.id); }}
                  className="p-1 hover:text-primary"
                  title="背景設定"
                >
                  <ImageIcon size={12} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDuplicateScene(scene.id); }}
                  className="p-1 hover:text-primary"
                  title="複製"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteScene(scene.id); }}
                  className="p-1 hover:text-destructive"
                  title="削除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ))}
        {scenes.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8 px-4">
            ステージは空です。<br />シーンを追加して物語を始めましょう。
          </div>
        )}
      </div>

      {/* 右クリックメニュー */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null); }} />
          <div className="fixed z-40 glass-panel py-1 min-w-[140px]" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
            <button
              onClick={() => { onDuplicateScene(ctxMenu.sceneId); setCtxMenu(null); }}
              className="w-full text-left text-xs px-3 py-2 text-foreground hover:bg-secondary/60 flex items-center gap-2"
            >
              <Copy size={12} /> シーンを複製
            </button>
            <button
              onClick={() => { setBgTarget('main'); setBgPickerSceneId(ctxMenu.sceneId); setCtxMenu(null); }}
              className="w-full text-left text-xs px-3 py-2 text-foreground hover:bg-secondary/60 flex items-center gap-2"
            >
              <ImageIcon size={12} /> 背景を設定
            </button>
            <button
              onClick={() => { onDeleteScene(ctxMenu.sceneId); setCtxMenu(null); }}
              className="w-full text-left text-xs px-3 py-2 text-destructive hover:bg-secondary/60 flex items-center gap-2"
            >
              <Trash2 size={12} /> 削除
            </button>
          </div>
        </>
      )}

      {/* Background picker from library */}
      {bgPickerSceneId && (
        <div className="absolute inset-0 z-20 bg-background/95 flex flex-col">
          <div className="p-3 flex items-center justify-between border-b border-border/30">
            <span className="text-xs font-medium text-foreground">背景を選択</span>
            <button onClick={() => setBgPickerSceneId(null)} className="p-1 hover:bg-secondary/50 rounded text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          {/* メイン / サブ 切替タブ */}
          <div className="flex gap-1 px-2 pt-2">
            {([['main', 'メイン背景'], ['sub', 'サブ背景']] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setBgTarget(k)}
                className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                  bgTarget === k
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Remove background option */}
            <button
              onClick={() => { applyBackground(bgPickerSceneId, null); setBgPickerSceneId(null); }}
              className="w-full text-left text-xs px-3 py-2 rounded hover:bg-secondary/40 text-muted-foreground transition-colors"
            >
              背景なし
            </button>
            {backgroundAssets.length === 0 ? (
              <div className="text-[11px] text-muted-foreground text-center py-6">
                画像ライブラリに「背景」カテゴリの画像がありません。<br />
                ライブラリに画像を追加してください。
              </div>
            ) : (
              backgroundAssets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => { applyBackground(bgPickerSceneId, asset.url); setBgPickerSceneId(null); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/40 transition-colors"
                >
                  <div className="w-12 h-7 rounded bg-black/20 overflow-hidden flex-shrink-0">
                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <span className="text-xs text-foreground truncate">{asset.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
