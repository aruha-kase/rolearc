import { useState } from 'react';
import { X, Plus, Pencil, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Crosshair } from 'lucide-react';
import { ActionConfig, ActionType, ACTION_LABELS, ObjectSnapshot } from './types';
import { Scene, SceneObject, getObjectCategory, getVariants, isFlippedX, getRotation } from '@/types/trpg';
import { Slider } from '@/components/ui/slider';

const COLOR_PRESETS = [
  { label: '青', hex: '#3b82f6' },
  { label: '緑', hex: '#22c55e' },
  { label: '赤', hex: '#ef4444' },
  { label: '橙', hex: '#f97316' },
  { label: '紫', hex: '#a855f7' },
  { label: '灰', hex: '#6b7280' },
];

interface ActionConfigModalProps {
  initial?: ActionConfig | null;
  initialButtonText?: string;
  initialColor?: string;
  isButton?: boolean;
  scenes: Scene[];
  currentSceneId?: string | null;
  objects: SceneObject[];
  bgmTracks: { id: string; name: string }[];
  seTracks: { id: string; name: string }[];
  onSave: (config: ActionConfig, buttonText?: string, color?: string) => void;
  onCancel: () => void;
}

const ACTION_GROUPS = [
  { label: 'シーン・背景', types: ['scene_switch', 'board_effect', 'bg_effect'] as ActionType[] },
  { label: '音声', types: ['bgm_play', 'bgm_stop', 'se_play', 'se_stop'] as ActionType[] },
  { label: 'オブジェクト', types: ['obj_expression', 'obj_visibility', 'obj_placement', 'obj_layer', 'obj_position', 'obj_scale', 'obj_flip', 'video_play', 'video_stop', 'hide_all', 'hide_characters'] as ActionType[] },
  { label: '演出', types: ['screen_shake', 'screen_flash', 'text_overlay', 'countdown', 'obj_bounce', 'grayscale'] as ActionType[] },
  { label: 'テキスト・送信', types: ['text_copy', 'discord_send'] as ActionType[] },
  { label: '複合', types: ['delay', 'multi'] as ActionType[] },
];

// サブアクション: delay は使用可、multi は不可
const SUB_ACTION_GROUPS = ACTION_GROUPS.map(g =>
  g.label === '複合' ? { ...g, types: g.types.filter(t => t !== 'multi') as ActionType[] } : g
).filter(g => g.types.length > 0);

const BOARD_EFFECTS = [
  { value: 'none', label: 'なし' },
  { value: 'sepia', label: 'セピア' },
  { value: 'invert', label: '色反転' },
  { value: 'darken', label: '暗転' },
  { value: 'ambient', label: 'アンビエント' },
] as const;

function NumInput({ label, value, onChange, min, max }: {
  label: string; value: number | undefined; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-20 shrink-0">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 bg-secondary/40 border border-border rounded px-2 py-1 text-xs text-foreground"
      />
    </div>
  );
}

function actionSummary(
  action: ActionConfig,
  scenes: Scene[],
  bgmTracks: { id: string; name: string }[],
  seTracks: { id: string; name: string }[],
  objects: SceneObject[],
): string {
  switch (action.type) {
    case 'scene_switch': return scenes.find(s => s.id === action.sceneId)?.name ?? '';
    case 'board_effect': return action.effect ?? '';
    case 'bg_effect': return `ぼかし${action.blur ?? 0}%`;
    case 'bgm_play': return bgmTracks.find(t => t.id === action.trackId)?.name ?? '';
    case 'se_play':
    case 'se_stop': return seTracks.find(t => t.id === action.trackId)?.name ?? '';
    case 'obj_visibility': {
      const obj = objects.find(o => o.id === action.objectId);
      return obj ? `${obj.name} → ${action.visible ? '表示' : '非表示'}` : '';
    }
    case 'obj_position':
    case 'obj_scale':
    case 'obj_placement':
    case 'obj_flip':
    case 'video_play':
    case 'video_stop': {
      const obj = objects.find(o => o.id === action.objectId);
      return obj?.name ?? '';
    }
    case 'obj_layer': {
      const obj = objects.find(o => o.id === action.objectId);
      const modeLabel = action.layerMode === 'front' ? '最前面' : action.layerMode === 'back' ? '最背面' : action.zIndex != null ? `z:${action.zIndex}` : '';
      return obj ? `${obj.name}${modeLabel ? ` → ${modeLabel}` : ''}` : '';
    }
    case 'obj_expression': {
      const obj = objects.find(o => o.id === action.objectId);
      if (!obj) return '';
      const v = getVariants(obj)[action.variantIndex ?? 0];
      return obj.name + (v ? ` → ${v.label}` : '');
    }
    case 'obj_multi_placement':
      return action.snapshots?.length ? `${action.snapshots.length}個のオブジェクト` : '';
    case 'delay': return `${action.delayMs ?? 0}ms`;
    case 'screen_shake': {
      const patLabel = action.shakePattern === 'horizontal' ? '横' : action.shakePattern === 'vertical' ? '縦' : '複合';
      return `${patLabel} 強さ${action.shakeIntensity ?? 12}px ×${action.shakeFrequency ?? 3}回`;
    }
    case 'screen_flash': return `${action.flashColor ?? '#ffffff'} / ${action.flashDurationMs ?? 400}ms`;
    case 'text_overlay': return action.overlayText ? `「${action.overlayText.slice(0, 12)}${action.overlayText.length > 12 ? '…' : ''}」` : '';
    case 'countdown': return `${action.countdownSeconds ?? 10}秒`;
    case 'obj_bounce': {
      const obj = objects.find(o => o.id === action.objectId);
      const mode = action.bounceStop ? '停止' : action.bounceLoop ? 'ループ' : `×${action.bounceCount ?? 3}`;
      return obj ? `${obj.name} → ${mode}` : '';
    }
    case 'grayscale': {
      if (!action.grayscaleEnabled) return '解除';
      return action.grayscaleMode === 'select' ? `指定${action.grayscaleKeepIds?.length ?? 0}件以外を白黒` : 'キャラ以外を白黒';
    }
    default: return '';
  }
}

function MultiPlacementConfig({ config, set, objects }: {
  config: Partial<ActionConfig>;
  set: (patch: Partial<ActionConfig>) => void;
  objects: SceneObject[];
}) {
  const captured = config.snapshots ?? [];
  const capturedIds = new Set(captured.map(s => s.objectId));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(captured.map(s => s.objectId))
  );

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const captureAll = () => {
    const snapshots: ObjectSnapshot[] = [...selectedIds].flatMap(id => {
      const obj = objects.find(o => o.id === id);
      if (!obj) return [];
      return [{
        objectId: id,
        x: obj.x ?? 0,
        y: obj.y ?? 0,
        width: obj.width ?? 300,
        height: obj.height ?? 300,
        z_index: obj.z_index ?? 0,
        flip_x: obj.flip_x ?? false,
        rotation: getRotation(obj),
        crop_top: obj.crop_top ?? 0,
        crop_right: obj.crop_right ?? 0,
        crop_bottom: obj.crop_bottom ?? 0,
        crop_left: obj.crop_left ?? 0,
      }];
    });
    set({ snapshots });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">対象オブジェクト（複数選択可）</span>
        <button
          onClick={captureAll}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Crosshair size={11} />
          現在値を取得（{selectedIds.size}個）
        </button>
      </div>
      <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto border border-border/40 rounded p-1">
        {objects.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-3">オブジェクトなし</div>
        )}
        {objects.map(obj => {
          const snap = captured.find(s => s.objectId === obj.id);
          return (
            <label
              key={obj.id}
              className="flex items-center gap-2 px-2 py-1 hover:bg-secondary/30 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(obj.id)}
                onChange={() => toggleId(obj.id)}
                className="accent-primary"
              />
              <span className="flex-1 text-xs truncate">{obj.name}</span>
              {snap && (
                <span className="text-[9px] text-primary/70 shrink-0">
                  x:{Math.round(snap.x)} y:{Math.round(snap.y)}
                </span>
              )}
              {capturedIds.has(obj.id) && !snap && (
                <span className="text-[9px] text-muted-foreground/50 shrink-0">未選択</span>
              )}
            </label>
          );
        })}
      </div>
      {captured.length > 0 && (
        <div className="text-[11px] text-primary/80 bg-primary/5 border border-primary/20 rounded px-3 py-1.5">
          取得済み: {captured.length}個のオブジェクト配置を保存中
        </div>
      )}
    </div>
  );
}

function ConfigFields({ config, set, scenes, currentScene, objects, bgmTracks, seTracks }: {
  config: Partial<ActionConfig>;
  set: (patch: Partial<ActionConfig>) => void;
  scenes: Scene[];
  currentScene?: Scene | null;
  objects: SceneObject[];
  bgmTracks: { id: string; name: string }[];
  seTracks: { id: string; name: string }[];
}) {
  const videoObjects = objects.filter(o => o.type === 'video');

  // #4 現在の盤面（シーン）のアンビエント状態を読み込む
  const loadCurrentAmbient = () => {
    if (!currentScene) return;
    const cs = currentScene as Record<string, unknown>;
    set({
      effect: 'ambient',
      ambientBrightness: (cs.ambient_brightness as number) ?? 100,
      ambientSaturation: (cs.ambient_saturation as number) ?? 100,
      ambientColor: (cs.ambient_color as string) ?? '#1b3a5c',
      ambientBlendMode: (cs.ambient_blend_mode as string) ?? 'multiply',
      ambientOpacity: (cs.ambient_opacity as number) ?? 0.25,
    });
  };

  return (
    <>
      {config.type === 'scene_switch' && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">切り替え先シーン</span>
          <select
            value={config.sceneId ?? ''}
            onChange={e => set({ sceneId: e.target.value })}
            className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground"
          >
            <option value="">選択してください</option>
            {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {config.type === 'board_effect' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">エフェクト</span>
            <div className="flex flex-wrap gap-1">
              {BOARD_EFFECTS.map(e => (
                <button key={e.value} onClick={() => set({ effect: e.value })}
                  className={`text-[11px] px-3 py-1.5 rounded transition-colors ${config.effect === e.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          {config.effect === 'ambient' && (
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">アンビエント設定</span>
                {currentScene && (
                  <button onClick={loadCurrentAmbient}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/50 transition-colors"
                    title="現在の盤面のアンビエント状態を読み込む">
                    <Crosshair size={11} />盤面の現在値
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-10">明暗</span>
                <Slider value={[config.ambientBrightness ?? 100]} min={20} max={180} step={1}
                  onValueChange={([v]) => set({ ambientBrightness: v })} className="flex-1" />
                <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{config.ambientBrightness ?? 100}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-10">彩度</span>
                <Slider value={[config.ambientSaturation ?? 100]} min={0} max={200} step={1}
                  onValueChange={([v]) => set({ ambientSaturation: v })} className="flex-1" />
                <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{config.ambientSaturation ?? 100}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-10">色味</span>
                <input type="color" value={config.ambientColor ?? '#1b3a5c'}
                  onChange={e => set({ ambientColor: e.target.value })}
                  className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0" />
                <span className="text-[10px] text-muted-foreground">{config.ambientColor ?? '#1b3a5c'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">ブレンドモード</span>
                <select
                  value={config.ambientBlendMode ?? 'multiply'}
                  onChange={e => set({ ambientBlendMode: e.target.value })}
                  className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground"
                >
                  <option value="normal">通常 (normal)</option>
                  <option value="multiply">乗算 (multiply)</option>
                  <option value="screen">スクリーン (screen)</option>
                  <option value="overlay">オーバーレイ (overlay)</option>
                  <option value="soft-light">ソフトライト (soft-light)</option>
                  <option value="hard-light">ハードライト (hard-light)</option>
                  <option value="color-dodge">覆い焼き (color-dodge)</option>
                  <option value="color-burn">焼き込み (color-burn)</option>
                  <option value="color">カラー (color)</option>
                  <option value="hue">色相 (hue)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-10">強さ</span>
                <Slider value={[Math.round((config.ambientOpacity ?? 0.25) * 100)]} min={0} max={100} step={1}
                  onValueChange={([v]) => set({ ambientOpacity: v / 100 })} className="flex-1" />
                <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{Math.round((config.ambientOpacity ?? 0.25) * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {config.type === 'bg_effect' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-10">ぼかし</span>
            <Slider value={[config.blur ?? 0]} min={0} max={100} step={1}
              onValueChange={([v]) => set({ blur: v })} className="flex-1" />
            <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{config.blur ?? 0}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-10">明暗</span>
            <Slider value={[config.brightness ?? 100]} min={0} max={200} step={1}
              onValueChange={([v]) => set({ brightness: v })} className="flex-1" />
            <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{config.brightness ?? 100}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-10">彩度</span>
            <Slider value={[config.saturation ?? 100]} min={0} max={200} step={1}
              onValueChange={([v]) => set({ saturation: v })} className="flex-1" />
            <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{config.saturation ?? 100}%</span>
          </div>
        </div>
      )}

      {config.type === 'ambient_settings' && (
        <div className="flex flex-col gap-3">
          {currentScene && (
            <button onClick={loadCurrentAmbient}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/50 transition-colors self-start"
              title="現在の盤面のアンビエント状態を読み込む">
              <Crosshair size={11} />盤面の現在値を読み込む
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-10">明暗</span>
            <Slider value={[config.ambientBrightness ?? 100]} min={20} max={180} step={1}
              onValueChange={([v]) => set({ ambientBrightness: v })} className="flex-1" />
            <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{config.ambientBrightness ?? 100}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-10">彩度</span>
            <Slider value={[config.ambientSaturation ?? 100]} min={0} max={200} step={1}
              onValueChange={([v]) => set({ ambientSaturation: v })} className="flex-1" />
            <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{config.ambientSaturation ?? 100}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-10">色味</span>
            <input type="color" value={config.ambientColor ?? '#1b3a5c'}
              onChange={e => set({ ambientColor: e.target.value })}
              className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0" />
            <span className="text-[10px] text-muted-foreground">{config.ambientColor ?? '#1b3a5c'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">ブレンドモード</span>
            <select
              value={config.ambientBlendMode ?? 'multiply'}
              onChange={e => set({ ambientBlendMode: e.target.value })}
              className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground"
            >
              <option value="normal">通常 (normal)</option>
              <option value="multiply">乗算 (multiply)</option>
              <option value="screen">スクリーン (screen)</option>
              <option value="overlay">オーバーレイ (overlay)</option>
              <option value="soft-light">ソフトライト (soft-light)</option>
              <option value="hard-light">ハードライト (hard-light)</option>
              <option value="color-dodge">覆い焼き (color-dodge)</option>
              <option value="color-burn">焼き込み (color-burn)</option>
              <option value="color">カラー (color)</option>
              <option value="hue">色相 (hue)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-10">強さ</span>
            <Slider value={[Math.round((config.ambientOpacity ?? 0.25) * 100)]} min={0} max={100} step={1}
              onValueChange={([v]) => set({ ambientOpacity: v / 100 })} className="flex-1" />
            <span className="text-[10px] w-8 text-right tabular-nums text-muted-foreground">{Math.round((config.ambientOpacity ?? 0.25) * 100)}%</span>
          </div>
          <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded px-3 py-2">
            乗算=暗く色付け / スクリーン=明るく / オーバーレイ・ソフトライト=コントラスト維持。強さで効き具合を調整。
          </div>
        </div>
      )}

      {config.type === 'bgm_play' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">BGMトラック</span>
            <select value={config.trackId ?? ''} onChange={e => set({ trackId: e.target.value })}
              className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground">
              <option value="">選択してください</option>
              {bgmTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <NumInput label="フェードイン (ms)" value={config.fadeMs} onChange={v => set({ fadeMs: v })} min={0} />
        </div>
      )}

      {config.type === 'bgm_stop' && (
        <NumInput label="フェードアウト (ms)" value={config.fadeMs} onChange={v => set({ fadeMs: v })} min={0} />
      )}

      {(config.type === 'se_play' || config.type === 'se_stop') && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">SEトラック</span>
          <select value={config.trackId ?? ''} onChange={e => set({ trackId: e.target.value })}
            className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground">
            <option value="">選択してください</option>
            {seTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {(['obj_visibility', 'obj_position', 'obj_scale', 'obj_flip'] as ActionType[]).includes(config.type!) && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">対象オブジェクト</span>
            <select value={config.objectId ?? ''} onChange={e => set({ objectId: e.target.value })}
              className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground">
              <option value="">選択してください</option>
              {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          {config.type === 'obj_visibility' && (
            <div className="flex gap-2">
              {[{ v: true, l: '表示' }, { v: false, l: '非表示' }].map(({ v, l }) => (
                <button key={l} onClick={() => set({ visible: v })}
                  className={`text-[11px] px-3 py-1.5 rounded ${config.visible === v ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {config.type === 'obj_position' && (() => {
            const target = objects.find(o => o.id === config.objectId);
            return (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">座標</span>
                  {target && (
                    <button
                      onClick={() => set({ x: Math.round(target.x ?? 0), y: Math.round(target.y ?? 0) })}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/50 transition-colors"
                      title="現在値を取り込む"
                    >
                      <Crosshair size={11} />現在値
                    </button>
                  )}
                </div>
                <NumInput label="X座標" value={config.x} onChange={v => set({ x: v })} />
                <NumInput label="Y座標" value={config.y} onChange={v => set({ y: v })} />
              </div>
            );
          })()}
          {config.type === 'obj_scale' && (() => {
            const target = objects.find(o => o.id === config.objectId);
            return (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">スケール (幅)</span>
                  <div className="flex items-center gap-2">
                    {target && (
                      <button
                        onClick={() => set({ scale: target.width ?? 300 })}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/50 transition-colors"
                        title="現在値を取り込む"
                      >
                        <Crosshair size={11} />現在値
                      </button>
                    )}
                    <span className="text-[11px] tabular-nums text-foreground">{config.scale ?? 300}px</span>
                  </div>
                </div>
                <Slider
                  value={[config.scale ?? 300]}
                  min={50} max={2560} step={10}
                  onValueChange={([v]) => set({ scale: v })}
                />
              </div>
            );
          })()}
          {config.type === 'obj_flip' && (
            <div className="flex gap-2">
              {[{ v: false, l: '通常' }, { v: true, l: '反転' }].map(({ v, l }) => (
                <button key={l} onClick={() => set({ flipped: v })}
                  className={`text-[11px] px-3 py-1.5 rounded ${config.flipped === v ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {config.type === 'obj_placement' && (() => {
        const target = objects.find(o => o.id === config.objectId);
        const toggleBtn = (on: boolean, onClick: () => void) => (
          <button onClick={onClick}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${on ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
            {on ? 'ON' : 'OFF'}
          </button>
        );
        const layerModes = [
          { v: 'front' as const, l: '最前面' },
          { v: 'back'  as const, l: '最背面' },
          { v: 'value' as const, l: '数値'   },
        ];
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">対象オブジェクト</span>
              <select value={config.objectId ?? ''} onChange={e => set({ objectId: e.target.value })}
                className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground">
                <option value="">選択してください</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            {target && (
              <button
                onClick={() => set({ x: Math.round(target.x ?? 0), y: Math.round(target.y ?? 0), scale: target.width ?? 300, layerMode: 'value', zIndex: target.z_index ?? 0, flipped: isFlippedX(target) })}
                className="flex items-center gap-1 self-start text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary/50 transition-colors border border-border"
              >
                <Crosshair size={11} />すべての現在値を取り込む
              </button>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">X座標</span>
                {toggleBtn(config.x != null, () => set({ x: config.x != null ? undefined : Math.round(target?.x ?? 0) }))}
              </div>
              {config.x != null && <NumInput label="" value={config.x} onChange={v => set({ x: v })} />}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Y座標</span>
                {toggleBtn(config.y != null, () => set({ y: config.y != null ? undefined : Math.round(target?.y ?? 0) }))}
              </div>
              {config.y != null && <NumInput label="" value={config.y} onChange={v => set({ y: v })} />}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">スケール (幅)</span>
                <div className="flex items-center gap-2">
                  {config.scale != null && <span className="text-[11px] tabular-nums text-foreground">{config.scale}px</span>}
                  {toggleBtn(config.scale != null, () => set({ scale: config.scale != null ? undefined : (target?.width ?? 300) }))}
                </div>
              </div>
              {config.scale != null && (
                <Slider value={[config.scale]} min={50} max={2560} step={10}
                  onValueChange={([v]) => set({ scale: v })} />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">左右反転</span>
                {toggleBtn(config.flipped != null, () => set({ flipped: config.flipped != null ? undefined : isFlippedX(target!) }))}
              </div>
              {config.flipped != null && (
                <div className="flex gap-2">
                  {[{ v: false, l: '通常' }, { v: true, l: '反転' }].map(({ v, l }) => (
                    <button key={l} onClick={() => set({ flipped: v })}
                      className={`text-[11px] px-3 py-1.5 rounded ${config.flipped === v ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">レイヤー</span>
                {toggleBtn(config.layerMode != null, () => set(config.layerMode != null
                  ? { layerMode: undefined, zIndex: undefined }
                  : { layerMode: 'value', zIndex: target?.z_index ?? 0 }
                ))}
              </div>
              {config.layerMode != null && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    {layerModes.map(({ v, l }) => (
                      <button key={v} onClick={() => set({ layerMode: v })}
                        className={`text-[11px] px-2.5 py-1 rounded transition-colors ${config.layerMode === v ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {config.layerMode === 'value' && (
                    <div className="flex items-center gap-2">
                      <NumInput label="Z値" value={config.zIndex} onChange={v => set({ zIndex: v })} />
                      {target && (
                        <button onClick={() => set({ zIndex: target.z_index ?? 0 })}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/50 transition-colors shrink-0"
                          title="現在値を取り込む">
                          <Crosshair size={11} />現在値
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {config.type === 'obj_layer' && (() => {
        const target = objects.find(o => o.id === config.objectId);
        const layerModes = [
          { v: 'front' as const, l: '最前面' },
          { v: 'back'  as const, l: '最背面' },
          { v: 'value' as const, l: '数値'   },
        ];
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">対象オブジェクト</span>
                {target && (
                  <button onClick={() => set({ layerMode: 'value', zIndex: target.z_index ?? 0 })}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-secondary/50 transition-colors"
                    title="現在値を取り込む">
                    <Crosshair size={11} />現在値
                  </button>
                )}
              </div>
              <select value={config.objectId ?? ''} onChange={e => set({ objectId: e.target.value })}
                className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground">
                <option value="">選択してください</option>
                {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              {layerModes.map(({ v, l }) => (
                <button key={v} onClick={() => set({ layerMode: v })}
                  className={`text-[11px] px-3 py-1.5 rounded transition-colors ${config.layerMode === v ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}>
                  {l}
                </button>
              ))}
            </div>
            {config.layerMode === 'value' && (
              <NumInput label="Z値" value={config.zIndex} onChange={v => set({ zIndex: v })} />
            )}
          </div>
        );
      })()}

      {(config.type === 'video_play' || config.type === 'video_stop') && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">対象動画オブジェクト</span>
          <select value={config.objectId ?? ''} onChange={e => set({ objectId: e.target.value })}
            className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground">
            <option value="">選択してください</option>
            {videoObjects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {config.type === 'obj_multi_placement' && (
        <MultiPlacementConfig config={config} set={set} objects={objects} />
      )}

      {config.type === 'obj_expression' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">キャラクター</span>
            <select
              value={config.objectId ?? ''}
              onChange={e => set({ objectId: e.target.value, variantIndex: undefined })}
              className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground"
            >
              <option value="">選択してください</option>
              {objects
                .filter(o => getObjectCategory(o) === 'character_object' && getVariants(o).length > 1)
                .map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          {config.objectId && (() => {
            const obj = objects.find(o => o.id === config.objectId);
            const variants = obj ? getVariants(obj) : [];
            if (variants.length === 0) return null;
            return (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">表情</span>
                <div className="flex flex-wrap gap-1">
                  {variants.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => set({ variantIndex: i })}
                      className={`text-[11px] px-2 py-1.5 rounded transition-colors ${config.variantIndex === i ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {config.type === 'delay' && (
        <NumInput label="待機時間 (ms)" value={config.delayMs} onChange={v => set({ delayMs: v })} min={0} />
      )}

      {config.type === 'screen_shake' && (
        <div className="flex flex-col gap-3">
          {/* パターン選択 */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">揺れパターン</span>
            <div className="flex gap-1">
              {(['horizontal', 'vertical', 'combined'] as const).map(p => {
                const labels = { horizontal: '横揺れ', vertical: '縦揺れ', combined: '複合' };
                const active = (config.shakePattern ?? 'combined') === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set({ shakePattern: p })}
                    className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60'
                    }`}
                  >
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>
          <NumInput label="揺れの強さ (px)" value={config.shakeIntensity ?? 12} onChange={v => set({ shakeIntensity: v })} min={1} max={100} />
          <NumInput label="揺れ時間 (ms)" value={config.shakeDurationMs ?? 600} onChange={v => set({ shakeDurationMs: v })} min={100} max={5000} />
          <NumInput label="揺れ回数" value={config.shakeFrequency ?? 3} onChange={v => set({ shakeFrequency: Math.max(1, Math.round(v)) })} min={1} max={20} />
          <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded px-3 py-2">
            回数×強さで揺れ感が変わります。例）回数3・時間600ms → 1サイクル200ms×3回
          </div>
        </div>
      )}

      {config.type === 'screen_flash' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0">色</span>
            <input type="color" value={config.flashColor ?? '#ffffff'} onChange={e => set({ flashColor: e.target.value })} className="h-7 w-12 bg-transparent" />
            <div className="flex gap-1">
              {[['白', '#ffffff'], ['赤', '#ff2a2a'], ['黄', '#ffe14d'], ['青', '#3aa0ff']].map(([l, c]) => (
                <button key={c} type="button" onClick={() => set({ flashColor: c })} className="px-2 py-1 rounded text-[10px] border border-border bg-secondary/40 hover:bg-secondary/60">{l}</button>
              ))}
            </div>
          </div>
          <NumInput label="時間 (ms)" value={config.flashDurationMs ?? 400} onChange={v => set({ flashDurationMs: v })} min={100} max={3000} />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0">最大不透明度 ({Math.round((config.flashOpacity ?? 0.8) * 100)}%)</span>
            <input type="range" min={10} max={100} value={Math.round((config.flashOpacity ?? 0.8) * 100)} onChange={e => set({ flashOpacity: Number(e.target.value) / 100 })} className="flex-1" />
          </div>
        </div>
      )}

      {config.type === 'text_overlay' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">表示テキスト</span>
            <textarea
              value={config.overlayText ?? ''}
              onChange={e => set({ overlayText: e.target.value })}
              rows={2}
              placeholder="例）第二章 — 深淵へ"
              className="bg-secondary/40 border border-border rounded px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">表示位置</span>
            <div className="flex gap-1">
              {(['top', 'center', 'bottom'] as const).map(p => {
                const labels = { top: '上', center: '中央', bottom: '下' };
                const active = (config.overlayPosition ?? 'center') === p;
                return (
                  <button key={p} type="button" onClick={() => set({ overlayPosition: p })}
                    className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60'}`}>
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>
          <NumInput label="文字サイズ (px)" value={config.overlayFontSize ?? 64} onChange={v => set({ overlayFontSize: v })} min={16} max={200} />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-20 shrink-0">文字色</span>
            <input type="color" value={config.overlayColor ?? '#ffffff'} onChange={e => set({ overlayColor: e.target.value })} className="h-7 w-12 bg-transparent" />
          </div>
          <NumInput label="表示時間 (ms)" value={config.overlayDurationMs ?? 4000} onChange={v => set({ overlayDurationMs: v })} min={0} max={20000} />
          <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded px-3 py-2">表示時間0で手動消去まで保持（次のテキスト表示で上書き）</div>
        </div>
      )}

      {config.type === 'countdown' && (
        <div className="flex flex-col gap-2">
          <NumInput label="秒数" value={config.countdownSeconds ?? 10} onChange={v => set({ countdownSeconds: Math.max(1, Math.round(v)) })} min={1} max={600} />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">表示位置</span>
            <div className="flex gap-1">
              {(['top', 'center', 'bottom'] as const).map(p => {
                const labels = { top: '上', center: '中央', bottom: '下' };
                const active = (config.countdownPosition ?? 'center') === p;
                return (
                  <button key={p} type="button" onClick={() => set({ countdownPosition: p })}
                    className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60'}`}>
                    {labels[p]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">ラベル（任意）</span>
            <input type="text" value={config.countdownLabel ?? ''} onChange={e => set({ countdownLabel: e.target.value })} placeholder="例）爆発まで" className="bg-secondary/40 border border-border rounded px-2 py-1 text-xs text-foreground" />
          </div>
          <NumInput label="文字サイズ (px)" value={config.countdownFontSize ?? 200} onChange={v => set({ countdownFontSize: v })} min={40} max={600} />
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-28 shrink-0">残り3秒以下の色</span>
            <input type="color" value={config.countdownAlertColor ?? '#ff4444'} onChange={e => set({ countdownAlertColor: e.target.value })} className="h-7 w-12 bg-transparent" />
            <span className="text-[10px] text-muted-foreground">{config.countdownAlertColor ?? '#ff4444'}</span>
          </div>
        </div>
      )}

      {config.type === 'obj_bounce' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">対象オブジェクト</span>
            <select value={config.objectId ?? ''} onChange={e => set({ objectId: e.target.value })} className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground">
              <option value="">選択してください</option>
              {objects.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer bg-secondary/30 rounded px-3 py-2">
            <input type="checkbox" checked={config.bounceStop ?? false} onChange={e => set({ bounceStop: e.target.checked })} />
            このオブジェクトのバウンスを停止する
          </label>
          {!config.bounceStop && (
            <>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={config.bounceLoop ?? false} onChange={e => set({ bounceLoop: e.target.checked })} />
                ループ（停止アクションまで跳ね続ける）
              </label>
              {!config.bounceLoop && (
                <NumInput label="回数" value={config.bounceCount ?? 3} onChange={v => set({ bounceCount: Math.max(1, Math.round(v)) })} min={1} max={50} />
              )}
              <NumInput label="高さ (px)" value={config.bounceIntensity ?? 30} onChange={v => set({ bounceIntensity: v })} min={5} max={300} />
              <NumInput label="1回の時間 (ms)" value={config.bounceDurationMs ?? 600} onChange={v => set({ bounceDurationMs: v })} min={150} max={3000} />
            </>
          )}
        </div>
      )}

      {config.type === 'grayscale' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">動作</span>
            <div className="flex gap-1">
              {[[true, '白黒ON'], [false, '解除']].map(([val, label]) => {
                const active = (config.grayscaleEnabled ?? true) === val;
                return (
                  <button key={String(val)} type="button" onClick={() => set({ grayscaleEnabled: val as boolean })}
                    className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60'}`}>
                    {label as string}
                  </button>
                );
              })}
            </div>
          </div>
          {(config.grayscaleEnabled ?? true) && (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">カラーを残す対象</span>
                <div className="flex gap-1">
                  {(['characters', 'select'] as const).map(m => {
                    const labels = { characters: 'キャラ全員', select: '個別選択' };
                    const active = (config.grayscaleMode ?? 'characters') === m;
                    return (
                      <button key={m} type="button" onClick={() => set({ grayscaleMode: m })}
                        className={`flex-1 px-2 py-1.5 rounded text-[11px] font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60'}`}>
                        {labels[m]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {(config.grayscaleMode ?? 'characters') === 'select' && (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">カラーのまま残すオブジェクト（複数可）</span>
                  <div className="flex flex-col gap-1 max-h-44 overflow-y-auto bg-secondary/20 rounded p-2">
                    {objects.map(o => {
                      const checked = (config.grayscaleKeepIds ?? []).includes(o.id);
                      return (
                        <label key={o.id} className="flex items-center gap-2 text-[11px] text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              const cur = config.grayscaleKeepIds ?? [];
                              set({ grayscaleKeepIds: e.target.checked ? [...cur, o.id] : cur.filter(id => id !== o.id) });
                            }}
                          />
                          {o.name}
                        </label>
                      );
                    })}
                    {objects.length === 0 && <span className="text-[11px] text-muted-foreground">オブジェクトがありません</span>}
                  </div>
                </div>
              )}
              <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded px-3 py-2">
                背景と対象外オブジェクトが白黒になります。「解除」アクションで元に戻ります。
              </div>
            </>
          )}
        </div>
      )}

      {(config.type === 'hide_all' || config.type === 'hide_characters') && (
        <div className="text-[11px] text-muted-foreground bg-secondary/30 rounded px-3 py-2">
          押すたびに{config.type === 'hide_all' ? '全オブジェクト' : 'キャラクター'}の表示/非表示を切り替えます
        </div>
      )}

      {config.type === 'text_copy' && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-muted-foreground">コピーするテキスト</span>
          <textarea
            value={config.text ?? ''}
            onChange={e => set({ text: e.target.value })}
            rows={4}
            placeholder="クリックでクリップボードにコピーされるテキスト"
            className="bg-secondary/40 border border-border rounded px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
          />
        </div>
      )}

      {config.type === 'discord_send' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Webhook URL</span>
            <input
              type="text"
              value={config.discordWebhookUrl ?? ''}
              onChange={e => {
                const url = e.target.value;
                set({ discordWebhookUrl: url });
                if (url) localStorage.setItem('discord-webhook-url', url);
              }}
              placeholder="https://discord.com/api/webhooks/..."
              className="bg-secondary/40 border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
            <span className="text-[10px] text-muted-foreground/60">DiscordチャンネルのWebhook URLを入力。一度入力すると次回から自動入力されます。</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">送信メッセージ</span>
            <textarea
              value={config.text ?? ''}
              onChange={e => set({ text: e.target.value })}
              rows={4}
              placeholder="Discordに送信するテキスト"
              className="bg-secondary/40 border border-border rounded px-3 py-2 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      )}
    </>
  );
}

export function ActionConfigModal({
  initial, initialButtonText, initialColor, isButton,
  scenes, currentSceneId, objects, bgmTracks, seTracks, onSave, onCancel,
}: ActionConfigModalProps) {
  const [config, setConfig] = useState<Partial<ActionConfig>>(initial ?? {});
  const [buttonText, setButtonText] = useState(initialButtonText ?? '');
  const [color, setColor] = useState(initialColor ?? '#3b82f6');
  const [subConfig, setSubConfigState] = useState<Partial<ActionConfig> | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // #1 選択 → 設定 → 戻る のビュー切替。既存編集時は最初から設定ビュー
  const [view, setView] = useState<'select' | 'config'>(initial?.type ? 'config' : 'select');
  // #1 グループ（タブ）の開閉。デフォルトは全て閉じる
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = (label: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });
  const currentScene = scenes.find(s => s.id === currentSceneId) ?? null;

  const set = (patch: Partial<ActionConfig>) => setConfig(prev => {
    // discord_send を選択したとき、localStorageからWebhook URLを自動入力
    if (patch.type === 'discord_send' && !prev.discordWebhookUrl) {
      const saved = localStorage.getItem('discord-webhook-url');
      if (saved) return { ...prev, ...patch, discordWebhookUrl: saved };
    }
    return { ...prev, ...patch };
  });
  const setSub = (patch: Partial<ActionConfig>) => setSubConfigState(prev => prev ? { ...prev, ...patch } : patch);

  const canSave = config.type === 'multi'
    ? (config.actions?.length ?? 0) > 0
    : config.type === 'obj_multi_placement'
      ? (config.snapshots?.length ?? 0) > 0
      : !!config.type;

  const startEditSubAction = (i: number) => {
    setEditingIndex(i);
    setSubConfigState({ ...(config.actions ?? [])[i] });
  };

  const saveSubAction = () => {
    if (!subConfig?.type) return;
    if (editingIndex !== null) {
      const actions = [...(config.actions ?? [])];
      actions[editingIndex] = subConfig as ActionConfig;
      set({ actions });
    } else {
      set({ actions: [...(config.actions ?? []), subConfig as ActionConfig] });
    }
    setSubConfigState(null);
    setEditingIndex(null);
  };

  const cancelSubAction = () => {
    setSubConfigState(null);
    setEditingIndex(null);
  };

  const removeSubAction = (i: number) => {
    set({ actions: (config.actions ?? []).filter((_, j) => j !== i) });
  };

  const moveSubAction = (i: number, dir: -1 | 1) => {
    const actions = [...(config.actions ?? [])];
    const j = i + dir;
    if (j < 0 || j >= actions.length) return;
    [actions[i], actions[j]] = [actions[j], actions[i]];
    set({ actions });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60">
      <div className="glass-panel w-[440px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-medium">アクション設定</span>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Action type selector（選択ビュー・タブ開閉可） */}
          {view === 'select' && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">アクション種別</span>
            {ACTION_GROUPS.map(group => {
              const open = openGroups.has(group.label);
              return (
              <div key={group.label} className="rounded border border-border/40 overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wider">{group.label}</span>
                  {open ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />}
                </button>
                {open && (
                  <div className="flex flex-wrap gap-1 p-2">
                    {group.types.map(type => (
                      <button
                        key={type}
                        onClick={() => { setConfig(prev => prev.type === type ? prev : { type }); setView('config'); }}
                        className={`text-[11px] px-2 py-1 rounded transition-colors ${config.type === type ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
                      >
                        {ACTION_LABELS[type]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
          )}

          {/* 設定ビュー：選択したアクションの設定のみ表示 */}
          {view === 'config' && (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setView('select')}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft size={14} /> アクション選択に戻る
              </button>
              {config.type && (
                <span className="text-[11px] font-medium text-foreground">{ACTION_LABELS[config.type]}</span>
              )}
            </div>

          {/* Config fields for non-multi types */}
          {config.type && config.type !== 'multi' && (
            <ConfigFields
              config={config}
              set={set}
              scenes={scenes}
              currentScene={currentScene}
              objects={objects}
              bgmTracks={bgmTracks}
              seTracks={seTracks}
            />
          )}

          {/* Multi-action list */}
          {config.type === 'multi' && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">アクション一覧（上から順に実行）</span>

              {(config.actions ?? []).length === 0 && !subConfig && (
                <div className="text-[11px] text-muted-foreground/50 bg-secondary/20 rounded px-3 py-2 text-center">
                  アクションを追加してください
                </div>
              )}

              {(config.actions ?? []).map((action, i) => (
                <div key={i} className={`flex items-center gap-1.5 rounded px-2 py-1.5 ${editingIndex === i ? 'bg-primary/15 border border-primary/30' : 'bg-secondary/30'}`}>
                  {/* 並び替え */}
                  <div className="flex flex-col shrink-0">
                    <button onClick={() => moveSubAction(i, -1)} disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none">
                      <ChevronUp size={12} />
                    </button>
                    <button onClick={() => moveSubAction(i, 1)} disabled={i === (config.actions?.length ?? 0) - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none">
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 w-3 shrink-0">{i + 1}</span>
                  <span className="text-[11px] text-foreground flex-1 min-w-0 truncate">
                    <span className="font-medium">{ACTION_LABELS[action.type]}</span>
                    {actionSummary(action, scenes, bgmTracks, seTracks, objects) && (
                      <span className="text-muted-foreground ml-1.5">
                        {actionSummary(action, scenes, bgmTracks, seTracks, objects)}
                      </span>
                    )}
                  </span>
                  {/* 編集 */}
                  <button onClick={() => startEditSubAction(i)}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                    <Pencil size={11} />
                  </button>
                  {/* 削除 */}
                  <button onClick={() => removeSubAction(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ))}

              {subConfig !== null ? (
                <div className="border border-border/60 rounded-md p-3 flex flex-col gap-3 bg-secondary/10">
                  <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                    {editingIndex !== null ? `アクション ${editingIndex + 1} を編集` : '追加するアクションを選択'}
                  </span>

                  {/* Sub-action type selector */}
                  <div className="flex flex-col gap-1.5">
                    {SUB_ACTION_GROUPS.map(group => (
                      <div key={group.label}>
                        <span className="text-[10px] text-muted-foreground/50">{group.label}</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {group.types.map(type => (
                            <button
                              key={type}
                              onClick={() => { if (subConfig.type !== type) setSubConfigState({ type }); }}
                              className={`text-[11px] px-2 py-1 rounded transition-colors ${subConfig.type === type ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground hover:text-foreground'}`}
                            >
                              {ACTION_LABELS[type]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sub-action config fields */}
                  {subConfig.type && (
                    <ConfigFields
                      config={subConfig}
                      set={setSub}
                      scenes={scenes}
                      currentScene={currentScene}
                      objects={objects}
                      bgmTracks={bgmTracks}
                      seTracks={seTracks}
                    />
                  )}

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      onClick={cancelSubAction}
                      className="text-xs px-3 py-1.5 rounded bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={saveSubAction}
                      disabled={!subConfig.type}
                      className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
                    >
                      {editingIndex !== null ? '更新' : '追加'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSubConfigState({})}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-border/50 rounded px-3 py-2 transition-colors hover:border-border"
                >
                  <Plus size={12} />
                  アクションを追加
                </button>
              )}
            </div>
          )}

          {/* Button settings (isButton mode) */}
          {isButton && (
            <>
              <div className="h-px bg-border" />
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">ボタンテキスト</span>
                  <input
                    type="text"
                    value={buttonText}
                    onChange={e => setButtonText(e.target.value)}
                    placeholder={config.type ? ACTION_LABELS[config.type] : 'ボタン'}
                    className="bg-secondary/40 border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">ボタンカラー</span>
                  <div className="flex gap-2 flex-wrap items-center">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c.hex}
                        onClick={() => setColor(c.hex)}
                        className={`text-[11px] px-2 py-1 rounded transition-all ${color === c.hex ? 'ring-2 ring-white ring-offset-1 ring-offset-background scale-110' : 'opacity-80 hover:opacity-100'}`}
                        style={{ background: c.hex, color: '#fff' }}
                      >
                        {c.label}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0"
                      title="カスタムカラー"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-5 h-5 rounded" style={{ background: color }} />
                    <span className="text-[10px] text-muted-foreground font-mono">{color}</span>
                  </div>
                </div>
              </div>
            </>
          )}
          </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
          <button onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            キャンセル
          </button>
          <button
            onClick={() => canSave && onSave(config as ActionConfig, isButton ? (buttonText || undefined) : undefined, isButton ? color : undefined)}
            disabled={!canSave}
            className="text-xs px-4 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
