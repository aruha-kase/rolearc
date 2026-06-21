import { memo, useState } from 'react';
import { toast } from 'sonner';
import { SceneObject, isLocked, isFlippedX, getRotation, getObjectCategory, getDisplayName, getVideoSettings, getBlendMode, BLEND_MODE_OPTIONS, getOpacity, ObjectCategory, hasCrop, getVariants, getCurrentVariantIndex, getCropSettings } from '@/types/trpg';
import { Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Lock, Unlock, FlipHorizontal, Crop, RotateCcw, RotateCw, Save, Image as ImageIcon } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface VariantAsset { id: string; name: string; url: string; category: string }

interface InspectorPanelProps {
  selectedObject: SceneObject | null;
  objects: SceneObject[];
  isAdmin: boolean;
  variantAssets?: VariantAsset[];
  onUpdateObject: (id: string, updates: Record<string, unknown>) => void;
  onDeleteObject: (id: string) => void;
  onSelectObject: (id: string | null) => void;
}

const CATEGORY_LABELS: Record<ObjectCategory, string> = {
  
  scene_object: 'セット',
  character_object: 'キャラクター',
  marker_object: 'プロップ',
};

export const InspectorPanel = memo(function InspectorPanel({
  selectedObject, objects, isAdmin, variantAssets = [],
  onUpdateObject, onDeleteObject, onSelectObject,
}: InspectorPanelProps) {
  const maxZ = objects.reduce((max, o) => Math.max(max, o.z_index ?? 0), 0);
  const minZ = objects.reduce((min, o) => Math.min(min, o.z_index ?? 0), maxZ);

  const locked = selectedObject ? isLocked(selectedObject) : false;
  const flipped = selectedObject ? isFlippedX(selectedObject) : false;
  const rotation = selectedObject ? getRotation(selectedObject) : 0;
  const category = selectedObject ? getObjectCategory(selectedObject) : 'scene_object';
  const videoSettings = selectedObject ? getVideoSettings(selectedObject) : null;

  return (
    <div className="glass-panel-flat h-full flex flex-col" style={{ width: 280, overflowX: 'hidden' }}>
      <div className="p-3 border-b border-border/30">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          インスペクター
        </span>
      </div>

      {selectedObject ? (
        <div className="p-3 space-y-4 flex-1 overflow-y-auto overflow-x-hidden">
          {/* Category */}
          {isAdmin && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">種別</label>
              <select
                value={category}
                onChange={e => onUpdateObject(selectedObject.id, { object_category: e.target.value })}
                className="w-full text-xs px-2 py-1.5 mt-1 input-dark text-foreground"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {/* Display Name (character_object) */}
          {category === 'character_object' && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">表示名</label>
              <input
                value={getDisplayName(selectedObject)}
                onChange={e => onUpdateObject(selectedObject.id, { display_name: e.target.value })}
                className="w-full text-xs px-2 py-1.5 mt-1 input-dark text-foreground"
              />
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">名前</label>
            <input
              value={selectedObject.name}
              onChange={e => onUpdateObject(selectedObject.id, { name: e.target.value })}
              className="w-full text-xs px-2 py-1.5 mt-1 input-dark text-foreground"
              disabled={!isAdmin}
            />
          </div>

          {/* Lock */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">ロック</label>
            <button
              onClick={() => onUpdateObject(selectedObject.id, { is_locked: !locked })}
              className="p-1.5 input-dark text-foreground hover:bg-secondary/50"
            >
              {locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>

          {/* Flip */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">左右反転</label>
            <button
              onClick={() => onUpdateObject(selectedObject.id, { flip_x: !flipped })}
              className={`p-1.5 input-dark hover:bg-secondary/50 ${flipped ? 'text-primary' : 'text-foreground'}`}
            >
              <FlipHorizontal size={14} />
            </button>
          </div>

          {/* Rotation */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">回転</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateObject(selectedObject.id, { rotation: ((rotation - 90) % 360 + 360) % 360 })}
                className="p-1.5 input-dark text-foreground hover:bg-secondary/50"
                title="-90°"
              >
                <RotateCcw size={14} />
              </button>
              <input
                type="number"
                value={Math.round(rotation)}
                onChange={e => onUpdateObject(selectedObject.id, { rotation: Number(e.target.value) })}
                className="w-14 text-xs px-1 py-1 input-dark text-foreground tabular-nums text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => onUpdateObject(selectedObject.id, { rotation: ((rotation + 90) % 360 + 360) % 360 })}
                className="p-1.5 input-dark text-foreground hover:bg-secondary/50"
                title="+90°"
              >
                <RotateCw size={14} />
              </button>
            </div>
          </div>

          {/* Transform */}
          {!locked && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">トランスフォーム</label>
              <div className="grid grid-cols-2 gap-0.5 mt-1">
                {[
                  { label: 'X', key: 'x', value: selectedObject.x },
                  { label: 'Y', key: 'y', value: selectedObject.y },
                  { label: 'W', key: 'width', value: selectedObject.width },
                  { label: 'H', key: 'height', value: selectedObject.height },
                ].map(({ label, key, value }) => (
                  <div key={key} className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground w-3 tabular-nums">{label}</span>
                    <input
                      type="number"
                      value={Math.round(value ?? 0)}
                      onChange={e => onUpdateObject(selectedObject.id, { [key]: Number(e.target.value) })}
                      className="flex-1 min-w-0 text-xs px-1 py-1 input-dark text-foreground tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scale Slider */}
          {!locked && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">スケール</label>
              <Slider
                value={[selectedObject.width ?? 300]}
                min={50}
                max={2560}
                step={10}
                onValueChange={([w]) => {
                  const oldW = selectedObject.width ?? 300;
                  const oldH = selectedObject.height ?? 300;
                  const scale = w / oldW;
                  const updates: Record<string, unknown> = { width: w, height: Math.round(oldH * scale) };
                  const cropT = selectedObject.crop_top ?? 0;
                  const cropR = selectedObject.crop_right ?? 0;
                  const cropB = selectedObject.crop_bottom ?? 0;
                  const cropL = selectedObject.crop_left ?? 0;
                  if (cropT || cropR || cropB || cropL) {
                    updates.crop_top = Math.round(cropT * scale);
                    updates.crop_right = Math.round(cropR * scale);
                    updates.crop_bottom = Math.round(cropB * scale);
                    updates.crop_left = Math.round(cropL * scale);
                  }
                  onUpdateObject(selectedObject.id, updates);
                }}
                className="mt-2"
              />
              <div className="text-[10px] text-muted-foreground tabular-nums mt-1 text-right">
                {Math.round(selectedObject.width ?? 300)}px
              </div>
            </div>
          )}

          {/* Crop */}
          {selectedObject.type !== 'video' && (
            <CropEditor
              selectedObject={selectedObject}
              onUpdateObject={onUpdateObject}
            />
          )}

          {!locked && (() => {
            const sortedByZ = [...objects].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
            const curIdx = sortedByZ.findIndex(o => o.id === selectedObject.id);
            const curZ = selectedObject.z_index ?? 0;
            const isTop = curIdx >= sortedByZ.length - 1;
            const isBottom = curIdx <= 0;
            return (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">レイヤー</label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  <button
                    disabled={isTop}
                    onClick={() => onUpdateObject(selectedObject.id, { z_index: maxZ + 1 })}
                    className="flex flex-col items-center justify-center text-[10px] py-1.5 input-dark text-foreground hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-default"
                  >
                    <ArrowUp size={12} />最前面
                  </button>
                  <button
                    disabled={isTop}
                    onClick={() => {
                      if (!isTop) {
                        const above = sortedByZ[curIdx + 1];
                        onUpdateObject(selectedObject.id, { z_index: above.z_index ?? 0 });
                        onUpdateObject(above.id, { z_index: curZ });
                      }
                    }}
                    className="flex flex-col items-center justify-center text-[10px] py-1.5 input-dark text-foreground hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-default"
                  >
                    <ArrowUp size={10} />前面
                  </button>
                  <button
                    disabled={isBottom}
                    onClick={() => {
                      if (!isBottom) {
                        const below = sortedByZ[curIdx - 1];
                        onUpdateObject(selectedObject.id, { z_index: below.z_index ?? 0 });
                        onUpdateObject(below.id, { z_index: curZ });
                      }
                    }}
                    className="flex flex-col items-center justify-center text-[10px] py-1.5 input-dark text-foreground hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-default"
                  >
                    <ArrowDown size={10} />背面
                  </button>
                  <button
                    disabled={isBottom}
                    onClick={() => onUpdateObject(selectedObject.id, { z_index: minZ - 1 })}
                    className="flex flex-col items-center justify-center text-[10px] py-1.5 input-dark text-foreground hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-default"
                  >
                    <ArrowDown size={12} />最背面
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Opacity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">透明度</label>
              <span className="text-[10px] text-foreground tabular-nums">{getOpacity(selectedObject)}%</span>
            </div>
            <Slider
              value={[getOpacity(selectedObject)]}
              min={0} max={100} step={1}
              onValueChange={([v]) => {
                const meta = (selectedObject.metadata as Record<string, unknown>) ?? {};
                onUpdateObject(selectedObject.id, { metadata: { ...meta, opacity: v } });
              }}
            />
          </div>

          {/* Blend Mode */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">ブレンドモード</label>
            <select
              value={getBlendMode(selectedObject)}
              onChange={e => {
                const meta = (selectedObject.metadata as Record<string, unknown>) ?? {};
                onUpdateObject(selectedObject.id, { metadata: { ...meta, blend_mode: e.target.value } });
              }}
              className="w-full text-xs px-2 py-1.5 mt-1 input-dark text-foreground"
            >
              {BLEND_MODE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Video Settings */}
          {selectedObject.type === 'video' && videoSettings && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">動画設定</label>
              <div className="space-y-2 mt-1">
                <ToggleRow label="自動再生" checked={videoSettings.autoplay}
                  onChange={v => onUpdateObject(selectedObject.id, { autoplay: v })} />
                <ToggleRow label="ループ" checked={videoSettings.loop}
                  onChange={v => onUpdateObject(selectedObject.id, { loop: v })} />
                <ToggleRow label="音声" checked={!videoSettings.muted}
                  onChange={v => onUpdateObject(selectedObject.id, { muted: !v })} />
                <ToggleRow label="シーン表示時に再生" checked={videoSettings.play_on_scene}
                  onChange={v => onUpdateObject(selectedObject.id, { play_on_scene: v })} />
              </div>
            </div>
          )}

          {/* Visibility */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">表示</label>
            <button
              onClick={() => {
                const newVisible = !selectedObject.is_visible;
                onUpdateObject(selectedObject.id, { is_visible: newVisible });
                if (!newVisible) onSelectObject(null);
              }}
              className="p-1.5 input-dark text-foreground hover:bg-secondary/50"
            >
              {selectedObject.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>

          {/* URL */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">ソースURL</label>
            <input
              value={selectedObject.url}
              onChange={e => onUpdateObject(selectedObject.id, { url: e.target.value })}
              className="w-full text-xs px-2 py-1.5 mt-1 input-dark text-foreground truncate"
              disabled={!isAdmin}
            />
          </div>

          {/* Variant Editor — character_object, admin only */}
          {isAdmin && category === 'character_object' && (
            <VariantEditor obj={selectedObject} onUpdateObject={onUpdateObject} variantAssets={variantAssets} />
          )}

          {/* Delete */}
          {isAdmin && (
            <button
              onClick={() => { onDeleteObject(selectedObject.id); onSelectObject(null); }}
              className="w-full flex items-center justify-center gap-1 text-xs py-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={12} /> オブジェクト削除
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center px-4">
            オブジェクトを選択して<br />プロパティを編集
          </p>
        </div>
      )}

      {/* Object list */}
      <div className="border-t border-border/30 p-2 max-h-48 overflow-y-auto overflow-x-hidden">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-1 mb-1">
          オブジェクト一覧
        </div>
        {[...objects].sort((a, b) => (b.z_index ?? 0) - (a.z_index ?? 0)).map(obj => {
          const cat = getObjectCategory(obj);
          const catColor = cat === 'character_object' ? 'text-green-400'
            : cat === 'marker_object' ? 'text-yellow-400'
            : 'text-muted-foreground';
          return (
            <div
              key={obj.id}
              onClick={() => { if (obj.is_visible !== false) onSelectObject(obj.id); }}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                obj.is_visible === false
                  ? 'text-muted-foreground/40 cursor-default'
                  : selectedObject?.id === obj.id
                    ? 'bg-primary/15 text-foreground cursor-pointer'
                    : 'text-muted-foreground hover:bg-secondary/30 hover:text-foreground cursor-pointer'
              }`}
            >
              <button
                onClick={e => {
                  e.stopPropagation();
                  const newVisible = !obj.is_visible;
                  onUpdateObject(obj.id, { is_visible: newVisible });
                  if (!newVisible && selectedObject?.id === obj.id) onSelectObject(null);
                }}
                className="p-0.5 hover:text-foreground"
              >
                {obj.is_visible ? <Eye size={10} /> : <EyeOff size={10} />}
              </button>
              <span className={`text-[8px] ${catColor}`}>●</span>
              <span className="flex-1 truncate">
                {cat === 'character_object' ? getDisplayName(obj) : obj.name}
              </span>
              {isLocked(obj) && <Lock size={8} className="text-muted-foreground/50" />}
              <span className="text-[13px] text-muted-foreground tabular-nums font-medium">{obj.z_index}</span>
            </div>
          );
        })}
        {objects.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-2">オブジェクトなし</div>
        )}
      </div>
    </div>
  );
});

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}

function VariantEditor({ obj, onUpdateObject, variantAssets = [] }: {
  obj: SceneObject;
  onUpdateObject: (id: string, updates: Record<string, unknown>) => void;
  variantAssets?: { id: string; name: string; url: string; category: string }[];
}) {
  const variants = getVariants(obj);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const updateVariant = (index: number, field: 'label' | 'url', value: string) => {
    const updated = variants.map((v, i) => i === index ? { ...v, [field]: value } : v);
    onUpdateObject(obj.id, { variants: updated });
  };

  const saveCropToVariant = (index: number) => {
    const crop = getCropSettings(obj);
    const updated = variants.map((v, i) => i === index
      ? { ...v, crop_top: crop.top, crop_right: crop.right, crop_bottom: crop.bottom, crop_left: crop.left }
      : v);
    onUpdateObject(obj.id, { variants: updated });
    toast.success(`「${variants[index].label}」のトリミングを保存しました（上:${crop.top} 右:${crop.right} 下:${crop.bottom} 左:${crop.left}）`);
  };

  const addVariant = () => {
    const updated = [...variants, { label: `表情${variants.length + 1}`, url: '' }];
    onUpdateObject(obj.id, { variants: updated });
  };

  const deleteVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index);
    const newIndex = Math.min(getCurrentVariantIndex(obj), Math.max(0, updated.length - 1));
    onUpdateObject(obj.id, { variants: updated, current_variant_index: newIndex });
  };

  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">表情バリアント</label>
      <div className="mt-1 space-y-2">
        {variants.map((variant, index) => {
          const hasSavedCrop = variant.crop_top !== undefined || variant.crop_right !== undefined
            || variant.crop_bottom !== undefined || variant.crop_left !== undefined;
          return (
            <div key={index} className="flex flex-col gap-1 p-2 rounded bg-secondary/20">
              <div className="flex items-center gap-1">
                <input
                  value={variant.label}
                  onChange={e => updateVariant(index, 'label', e.target.value)}
                  placeholder="ラベル名"
                  className="flex-1 text-xs px-2 py-1 input-dark text-foreground"
                />
                <button
                  onClick={() => saveCropToVariant(index)}
                  className={`p-1 rounded transition-colors ${hasSavedCrop ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-secondary/50'}`}
                  title={hasSavedCrop ? 'トリミング保存済（クリックで上書き）' : '現在のトリミングをこの表情に保存'}
                >
                  <Crop size={12} />
                </button>
                <button
                  onClick={() => deleteVariant(index)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                  title="削除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={variant.url}
                  onChange={e => updateVariant(index, 'url', e.target.value)}
                  placeholder="URL"
                  className="flex-1 text-xs px-2 py-1 input-dark text-foreground"
                />
                <button
                  onClick={() => setPickerIndex(pickerIndex === index ? null : index)}
                  className={`p-1 rounded transition-colors ${pickerIndex === index ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-secondary/50'}`}
                  title="画像ライブラリから選択"
                >
                  <ImageIcon size={12} />
                </button>
              </div>
              {variant.url && /\.(png|jpe?g|gif|webp|svg|bmp|avif|apng)(\?.*)?$/i.test(variant.url) && (
                <div className="w-full h-12 rounded bg-black/20 overflow-hidden">
                  <img src={variant.url} alt={variant.label} className="w-full h-full object-contain" />
                </div>
              )}
              {pickerIndex === index && (
                <div className="rounded bg-background/95 border border-border/40 p-1.5 max-h-40 overflow-y-auto">
                  {variantAssets.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">
                      画像ライブラリに「立ち絵」「オブジェクト」カテゴリの画像がありません
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {variantAssets.map(asset => (
                        <button
                          key={asset.id}
                          onClick={() => { updateVariant(index, 'url', asset.url); setPickerIndex(null); }}
                          title={asset.name}
                          className="aspect-square rounded overflow-hidden bg-secondary/40 hover:ring-2 hover:ring-primary transition-all"
                        >
                          <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={addVariant}
          className="w-full text-xs py-1.5 input-dark text-muted-foreground hover:text-foreground hover:bg-secondary/30 rounded"
        >
          + 表情を追加
        </button>
      </div>
    </div>
  );
}

function CropEditor({ selectedObject, onUpdateObject }: {
  selectedObject: SceneObject;
  onUpdateObject: (id: string, updates: Record<string, unknown>) => void;
}) {
  const isCropped = hasCrop(selectedObject);

  const reset = () => {
    onUpdateObject(selectedObject.id, {
      crop_top: 0, crop_right: 0, crop_bottom: 0, crop_left: 0,
    });
  };

  return (
    <div className="flex items-center justify-between">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
        <Crop size={10} /> トリミング
      </label>
      <div className="flex items-center gap-1">
        {isCropped ? (
          <button onClick={reset} className="flex items-center gap-1 px-2 py-0.5 text-[10px] input-dark text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded" title="リセット">
            <RotateCcw size={10} /> リセット
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">Alt+辺ドラッグ</span>
        )}
      </div>
    </div>
  );
}
