import { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SceneObject, Scene, getObjectCategory, isEmbedLikeObject } from '@/types/trpg';
import { DraggableObject } from './DraggableObject';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const WORKSPACE_MARGIN = 800;

interface CanvasBoardProps {
  scene: Scene | null;
  objects: SceneObject[];
  selectedObjectId: string | null;
  isAdmin: boolean;
  fadeDuration: number;
  backgroundBlur?: number;
  backgroundBrightness?: number;
  backgroundSaturation?: number;
  sceneEffect?: string;
  isOnBreak?: boolean;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (id: string, updates: Record<string, unknown>) => void;
  onLocalUpdateObject: (id: string, updates: Record<string, unknown>) => void;
  onDeleteObject?: (id: string) => void;
  onContextMenu?: (objId: string, x: number, y: number) => void;
  obsMode?: 'main' | 'minimap';
  onDropAsset?: (assetJson: string, worldX: number, worldY: number) => void;
  videoCommands?: Record<string, { action: 'play' | 'pause'; seq: number; fadeMs?: number }>;
  onVideoControl?: (objId: string, action: 'play' | 'pause') => void;
  onDragMove?: (id: string, x: number, y: number, rotation?: number, z_index?: number) => void;
  hideAllObjects?: boolean;
  hideCharacterObjects?: boolean;
  screenMode?: number; // 0=OFF / 1=メイン盤面を囲う / 2=サブ盤面を囲う
  onPresetChange?: (preset: 1 | 2) => void; // カメラ1/2押下を親へ通知(スクリーンモード連動用)
  masterVolume?: number;
  enableKeyboardShortcuts?: boolean;
  shakeCommand?: { intensity: number; durationMs: number; frequency: number; pattern: string; seq: number } | null;
  flashCommand?: { color: string; durationMs: number; opacity: number; seq: number } | null;
  textOverlayCommand?: { text: string; position: string; fontSize: number; color: string; durationMs: number; seq: number } | null;
  countdownCommand?: { seconds: number; position: string; label: string; fontSize?: number; alertColor?: string; seq: number } | null;
  bounceCommands?: Record<string, { stop: boolean; loop: boolean; count: number; intensity: number; durationMs: number; seq: number }>;
  grayscaleState?: { enabled: boolean; mode: string; keepIds: string[] };
}

const SCENE_EFFECT_FILTERS: Record<string, string> = {
  none: '',
  sepia: 'sepia(1) brightness(0.7)',
  invert: 'invert(1) brightness(0.7)',
  darken: '',
  ambient: '',
};

export const CanvasBoard = memo(function CanvasBoard({
  scene, objects, selectedObjectId, isAdmin, fadeDuration,
  backgroundBlur, backgroundBrightness, backgroundSaturation,
  sceneEffect, isOnBreak,
  onSelectObject, onUpdateObject, onLocalUpdateObject,
  onDeleteObject, onContextMenu, obsMode, onDropAsset,
  videoCommands, onVideoControl, onDragMove,
  hideAllObjects, hideCharacterObjects, screenMode, masterVolume,
  enableKeyboardShortcuts, shakeCommand, onPresetChange,
  flashCommand, textOverlayCommand, countdownCommand, bounceCommands, grayscaleState,
}: CanvasBoardProps) {
  const effectiveBlur = backgroundBlur ?? ((scene?.background_blur ?? 0) / 100 * 20);
  const effectiveBrightness = backgroundBrightness ?? (scene?.background_brightness ?? 100);
  const effectiveSaturation = backgroundSaturation ?? (scene?.background_saturation ?? 100);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [shakeStyle, setShakeStyle] = useState<{ animation: string } | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!shakeCommand) return;
    const intensity = shakeCommand.intensity || 12;
    const durationMs = shakeCommand.durationMs || 600;
    const frequency = Math.max(1, Math.round(shakeCommand.frequency || 3));
    const pattern = shakeCommand.pattern || 'combined';
    const animName = pattern === 'horizontal' ? 'lsm-shake-h'
      : pattern === 'vertical' ? 'lsm-shake-v'
      : 'lsm-shake-c';
    // 1サイクルの長さ = 総時間 / 回数
    const cycleDuration = Math.round(durationMs / frequency);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    // アニメを一度リセットしてからセットし直すことで再発火させる
    setShakeStyle(null);
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--lsm-shake-amp', `${intensity}px`);
      setShakeStyle({ animation: `${animName} ${cycleDuration}ms ease-in-out ${frequency}` });
    });
    shakeTimerRef.current = setTimeout(() => {
      setShakeStyle(null);
      shakeTimerRef.current = null;
    }, durationMs + 50);
    return () => {
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = null;
      }
    };
  }, [shakeCommand?.seq]);

  // フラッシュ
  const [flashState, setFlashState] = useState<{ color: string; durationMs: number; opacity: number; seq: number } | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!flashCommand) return;
    setFlashState(flashCommand);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlashState(null);
      flashTimerRef.current = null;
    }, flashCommand.durationMs + 50);
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
  }, [flashCommand?.seq]);

  // テキストオーバーレイ（表示/消去ともにフェード、同じ内容の再送信でトグル消去）
  const [overlayState, setOverlayState] = useState<{ text: string; position: string; fontSize: number; color: string; seq: number; closing: boolean } | null>(null);
  const overlayRef = useRef<typeof overlayState>(null);
  overlayRef.current = overlayState;
  const overlayAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideOverlay = useCallback(() => {
    if (overlayAutoTimerRef.current) { clearTimeout(overlayAutoTimerRef.current); overlayAutoTimerRef.current = null; }
    setOverlayState(prev => prev ? { ...prev, closing: true } : null);
    if (overlayHideTimerRef.current) clearTimeout(overlayHideTimerRef.current);
    overlayHideTimerRef.current = setTimeout(() => { setOverlayState(null); overlayHideTimerRef.current = null; }, 450);
  }, []);
  useEffect(() => {
    if (!textOverlayCommand) return;
    const cur = overlayRef.current;
    const sameVisible = !!cur && !cur.closing
      && cur.text === textOverlayCommand.text
      && cur.position === textOverlayCommand.position
      && cur.fontSize === textOverlayCommand.fontSize
      && cur.color === textOverlayCommand.color;
    if (sameVisible) { hideOverlay(); return; }
    if (overlayHideTimerRef.current) { clearTimeout(overlayHideTimerRef.current); overlayHideTimerRef.current = null; }
    if (overlayAutoTimerRef.current) { clearTimeout(overlayAutoTimerRef.current); overlayAutoTimerRef.current = null; }
    setOverlayState({ ...textOverlayCommand, closing: false });
    if (textOverlayCommand.durationMs > 0) {
      overlayAutoTimerRef.current = setTimeout(() => { hideOverlay(); }, textOverlayCommand.durationMs);
    }
  }, [textOverlayCommand?.seq, hideOverlay]);

  // カウントダウン
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [countdownMeta, setCountdownMeta] = useState<{ position: string; label: string; fontSize: number; alertColor: string } | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!countdownCommand) return;
    setCountdownMeta({
      position: countdownCommand.position,
      label: countdownCommand.label,
      fontSize: countdownCommand.fontSize ?? 200,
      alertColor: countdownCommand.alertColor ?? '#ff4444',
    });
    setCountdownValue(countdownCommand.seconds);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdownValue(prev => {
        if (prev == null) return null;
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          // 0を一瞬見せてから消す
          setTimeout(() => { setCountdownValue(null); setCountdownMeta(null); }, 700);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); };
  }, [countdownCommand?.seq]);
  const [embedSceneId, setEmbedSceneId] = useState<string | null>(scene?.id ?? null);
  const prevSceneIdRef = useRef<string | null | undefined>(undefined);
  const suppressAutoplay = prevSceneIdRef.current !== undefined && prevSceneIdRef.current !== (scene?.id ?? null);
  prevSceneIdRef.current = scene?.id ?? null;
  const embedSceneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!scene?.id) return;
    if (embedSceneTimerRef.current) clearTimeout(embedSceneTimerRef.current);
    embedSceneTimerRef.current = setTimeout(() => {
      setEmbedSceneId(scene.id);
      embedSceneTimerRef.current = null;
    }, 80);
    return () => {
      if (embedSceneTimerRef.current) {
        clearTimeout(embedSceneTimerRef.current);
        embedSceneTimerRef.current = null;
      }
    };
  }, [scene?.id]);
  const [isPanning, setIsPanning] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [activePreset, setActivePreset] = useState<1 | 2 | 3>(1);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const animTimeout = useRef<ReturnType<typeof setTimeout>>();
  // パン移動のrAFスロットル用（マウス移動のたびに再レンダーせず、フレーム単位に間引く）
  const panRafRef = useRef<number | null>(null);
  const panPendingRef = useRef<{ x: number; y: number } | null>(null);

  const worldCenterX = (CANVAS_W + WORKSPACE_MARGIN * 2) / 2;
  const worldCenterY = (CANVAS_H + WORKSPACE_MARGIN * 2) / 2;

  const PRESET_TARGETS = {
    1: { x: 0, y: 0 },
    2: { x: WORKSPACE_MARGIN + 3280 - worldCenterX, y: 0 },
  } as const;

  const panToPreset = useCallback((preset: 1 | 2, currentZoom: number) => {
    const t = PRESET_TARGETS[preset];
    setPan({ x: -t.x * currentZoom, y: -t.y * currentZoom });
  }, []);

  const presetFree = useCallback(() => {
    setActivePreset(3);
  }, []);

  const animateTransform = useCallback(() => {
    setIsAnimating(true);
    clearTimeout(animTimeout.current);
    animTimeout.current = setTimeout(() => setIsAnimating(false), 350);
  }, []);

  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const z = Math.min(clientWidth / CANVAS_W, clientHeight / CANVAS_H) * (obsMode ? 1.0 : 0.85);
    setZoom(z);
    if (obsMode === 'minimap') {
      setActivePreset(2);
      const t = PRESET_TARGETS[2];
      setPan({ x: -t.x * z, y: -t.y * z });
    } else {
      setActivePreset(1);
      setPan({ x: 0, y: 0 });
    }
  }, [obsMode]);

  const presetMain = useCallback(() => {
    setActivePreset(1);
    panToPreset(1, zoom);
    animateTransform();
    onPresetChange?.(1);
  }, [panToPreset, zoom, animateTransform, onPresetChange]);

  const presetMinimap = useCallback(() => {
    setActivePreset(2);
    panToPreset(2, zoom);
    animateTransform();
    onPresetChange?.(2);
  }, [panToPreset, zoom, animateTransform, onPresetChange]);

  useEffect(() => {
    fitToView();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/rolearc-asset')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const json = e.dataTransfer.getData('application/rolearc-asset');
    if (!json || !onDropAsset || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left - rect.width / 2 - pan.x;
    const screenY = e.clientY - rect.top - rect.height / 2 - pan.y;
    const worldX = screenX / zoom + worldCenterX - WORKSPACE_MARGIN;
    const worldY = screenY / zoom + worldCenterY - WORKSPACE_MARGIN;
    onDropAsset(json, Math.round(worldX), Math.round(worldY));
  }, [onDropAsset, pan, zoom, worldCenterX, worldCenterY]);

  const zoomTo = useCallback((newZoom: number) => {
    const clamped = Math.max(0.05, Math.min(5, newZoom));
    if (activePreset === 3) {
      setPan(prev => {
        const ratio = clamped / zoom;
        return { x: prev.x * ratio, y: prev.y * ratio };
      });
    } else {
      const t = PRESET_TARGETS[activePreset];
      setPan({ x: -t.x * clamped, y: -t.y * clamped });
      animateTransform();
    }
    setZoom(clamped);
  }, [activePreset, animateTransform, zoom]);

  // activePreset を ref で参照（wheelリスナーを1回だけネイティブ登録するため）
  const activePresetRef = useRef(activePreset);
  useEffect(() => { activePresetRef.current = activePreset; }, [activePreset]);

  // ホイールズーム。React の onWheel はパッシブリスナー扱いで preventDefault が効かず
  // 「Unable to preventDefault inside passive event listener」エラーが出るため、
  // ネイティブの addEventListener で { passive: false } 登録する。
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const preset = activePresetRef.current;
      setZoom(prev => {
        const newZ = Math.max(0.05, Math.min(5, prev * factor));
        if (preset === 3) {
          setPan(p => {
            const ratio = newZ / prev;
            return { x: p.x * ratio, y: p.y * ratio };
          });
        } else {
          const t = PRESET_TARGETS[preset];
          setPan({ x: -t.x * newZ, y: -t.y * newZ });
          animateTransform();
        }
        return newZ;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [animateTransform]);


  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 0) {
      e.preventDefault();
      setIsPanning(true);
      setActivePreset(3);
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [pan]);

  // Alt+左クリック: その座標にある全オブジェクトをz-index順で循環選択する
  const handleAltClick = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left - rect.width / 2 - pan.x;
    const screenY = e.clientY - rect.top - rect.height / 2 - pan.y;
    const canvasX = screenX / zoom + worldCenterX - WORKSPACE_MARGIN;
    const canvasY = screenY / zoom + worldCenterY - WORKSPACE_MARGIN;
    const hits = objects
      .filter(o => {
        const x = o.x ?? 0, y = o.y ?? 0, w = o.width ?? 0, h = o.height ?? 0;
        return canvasX >= x && canvasX <= x + w && canvasY >= y && canvasY <= y + h;
      })
      .sort((a, b) => (b.z_index ?? 0) - (a.z_index ?? 0));
    if (hits.length === 0) return;
    const currentIdx = hits.findIndex(o => o.id === selectedObjectId);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % hits.length : 0;
    onSelectObject(hits[nextIdx].id);
  }, [objects, pan, zoom, worldCenterX, worldCenterY, selectedObjectId, onSelectObject]);

  // ドラッグ終了時にx,yに加えてrotationとflip_xも書き込む。
  // DBエコー(postgres_changes)でrotationがnullで返ってくるとリセットされるため。
  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    const target = objects.find(o => o.id === id);
    const updates: Record<string, unknown> = { x, y };
    if (target) {
      if (target.rotation != null) updates.rotation = target.rotation;
      if (target.flip_x != null) updates.flip_x = target.flip_x;
    }
    onUpdateObject(id, updates);
  }, [objects, onUpdateObject]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    // 最新座標を貯めて、次のアニメフレームで1回だけ反映（過剰な再レンダーを防ぐ）
    panPendingRef.current = {
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    };
    if (panRafRef.current == null) {
      panRafRef.current = requestAnimationFrame(() => {
        panRafRef.current = null;
        if (panPendingRef.current) setPan(panPendingRef.current);
      });
    }
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    if (panRafRef.current != null) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = null;
    }
    if (panPendingRef.current) {
      setPan(panPendingRef.current);
      panPendingRef.current = null;
    }
  }, []);

  // Refs for keyboard move broadcast (outside useEffect so they persist across re-renders)
  const keyMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyPosRef = useRef<{ id: string; x: number; y: number; rotation?: number } | null>(null);

  // Keyboard shortcuts for selected object
  useEffect(() => {
    if ((!isAdmin && !enableKeyboardShortcuts) || !selectedObjectId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      const obj = objects.find(o => o.id === selectedObjectId);
      if (!obj) return;
      const step = e.shiftKey ? 20 : 5;

      const schedulePosBroadcast = (id: string, x: number, y: number, rotation?: number) => {
        lastKeyPosRef.current = { id, x, y, rotation };
        if (keyMoveTimerRef.current) clearTimeout(keyMoveTimerRef.current);
        keyMoveTimerRef.current = setTimeout(() => {
          if (lastKeyPosRef.current) {
            const p = lastKeyPosRef.current;
            onDragMove?.(p.id, p.x, p.y, p.rotation);
            lastKeyPosRef.current = null;
          }
          keyMoveTimerRef.current = null;
        }, 300);
      };

      switch (e.key) {
        case 'ArrowLeft': {
          e.preventDefault();
          const nx = (obj.x ?? 0) - step;
          onUpdateObject(selectedObjectId, { x: nx, y: obj.y ?? 0, rotation: obj.rotation ?? 0, flip_x: obj.flip_x ?? false });
          schedulePosBroadcast(selectedObjectId, nx, obj.y ?? 0);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const nx = (obj.x ?? 0) + step;
          onUpdateObject(selectedObjectId, { x: nx, y: obj.y ?? 0, rotation: obj.rotation ?? 0, flip_x: obj.flip_x ?? false });
          schedulePosBroadcast(selectedObjectId, nx, obj.y ?? 0);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const ny = (obj.y ?? 0) - step;
          onUpdateObject(selectedObjectId, { x: obj.x ?? 0, y: ny, rotation: obj.rotation ?? 0, flip_x: obj.flip_x ?? false });
          schedulePosBroadcast(selectedObjectId, obj.x ?? 0, ny);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          const ny = (obj.y ?? 0) + step;
          onUpdateObject(selectedObjectId, { x: obj.x ?? 0, y: ny, rotation: obj.rotation ?? 0, flip_x: obj.flip_x ?? false });
          schedulePosBroadcast(selectedObjectId, obj.x ?? 0, ny);
          break;
        }
        case 'Delete':
          if (!isAdmin) break;
          e.preventDefault();
          if (window.confirm(`「${obj.name ?? 'オブジェクト'}」を削除しますか？`)) {
            onDeleteObject?.(selectedObjectId);
          }
          break;
        case 'r': {
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          const newRot = (((obj.rotation ?? 0) + (e.shiftKey ? -20 : 20)) % 360 + 360) % 360;
          onUpdateObject(selectedObjectId, { x: obj.x ?? 0, y: obj.y ?? 0, flip_x: obj.flip_x ?? false, rotation: newRot });
          onDragMove?.(selectedObjectId, obj.x ?? 0, obj.y ?? 0, newRot);
          break;
        }
        case 'z': {
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          const newZ = (obj.z_index ?? 0) + 1;
          onUpdateObject(selectedObjectId, { x: obj.x ?? 0, y: obj.y ?? 0, rotation: obj.rotation ?? 0, flip_x: obj.flip_x ?? false, z_index: newZ });
          onDragMove?.(selectedObjectId, obj.x ?? 0, obj.y ?? 0, undefined, newZ);
          break;
        }
        case 'x': {
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          const newZ = (obj.z_index ?? 0) - 1;
          onUpdateObject(selectedObjectId, { x: obj.x ?? 0, y: obj.y ?? 0, rotation: obj.rotation ?? 0, flip_x: obj.flip_x ?? false, z_index: newZ });
          onDragMove?.(selectedObjectId, obj.x ?? 0, obj.y ?? 0, undefined, newZ);
          break;
        }
        case 'Escape':
          onSelectObject(null);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, enableKeyboardShortcuts, selectedObjectId, objects, onUpdateObject, onDeleteObject, onSelectObject, onDragMove]);

  const renderableObjects = objects.filter(o => o.is_visible !== false || o.type !== 'video' || isEmbedLikeObject(o));

  const effectiveIsVisible = useCallback((obj: SceneObject): boolean => {
    if (hideAllObjects) return false;
    if (hideCharacterObjects && getObjectCategory(obj) === 'character_object') return false;
    return obj.is_visible !== false;
  }, [hideAllObjects, hideCharacterObjects]);

  // 白黒エフェクト: カラーを残す対象以外をグレースケール
  const shouldGrayscale = useCallback((obj: SceneObject): boolean => {
    if (!grayscaleState?.enabled) return false;
    if (grayscaleState.mode === 'characters') return getObjectCategory(obj) !== 'character_object';
    return !grayscaleState.keepIds.includes(obj.id);
  }, [grayscaleState]);

  const persistentObjects = renderableObjects.filter(o => {
    const cat = getObjectCategory(o);
    return cat === 'character_object' || cat === 'marker_object';
  });
  const embedObjects = renderableObjects.filter(o =>
    getObjectCategory(o) === 'scene_object' && isEmbedLikeObject(o)
  );
  const sceneObjects = renderableObjects.filter(o => {
    const cat = getObjectCategory(o);
    return cat !== 'character_object' && cat !== 'marker_object' && !isEmbedLikeObject(o);
  });

  const effectiveSceneEffect = sceneEffect ?? (scene?.scene_effect ?? 'none');
  const sceneEffectFilter = SCENE_EFFECT_FILTERS[effectiveSceneEffect] ?? '';

  const ambientBrightness = scene?.ambient_brightness ?? 100;
  const ambientSaturation = scene?.ambient_saturation ?? 100;
  const ambientColor = scene?.ambient_color ?? '#1b3a5c';
  const ambientBlendMode = ((scene as Record<string, unknown> | null)?.ambient_blend_mode as React.CSSProperties['mixBlendMode']) ?? 'multiply';
  const ambientOpacity = ((scene as Record<string, unknown> | null)?.ambient_opacity as number | undefined) ?? 0.25;

  const ambientFilter = useMemo(() => {
    if (effectiveSceneEffect !== 'ambient') return '';
    const parts: string[] = [];
    if (ambientBrightness !== 100) parts.push(`brightness(${ambientBrightness / 100})`);
    if (ambientSaturation !== 100) parts.push(`saturate(${ambientSaturation / 100})`);
    return parts.join(' ');
  }, [effectiveSceneEffect, ambientBrightness, ambientSaturation]);

  const totalW = CANVAS_W + WORKSPACE_MARGIN * 2;
  const totalH = CANVAS_H + WORKSPACE_MARGIN * 2;

  // カメラ2が画面中心に映すワールドX = worldCenterX + PRESET_TARGETS[2].x = WORKSPACE_MARGIN + 3280。
  // サブ盤面の「中心」をそこに合わせるため、左端は盤面幅の半分だけ左にずらす。
  const SUB_BOARD_CENTER_X = WORKSPACE_MARGIN + 3280;
  const SUB_BOARD_LEFT = SUB_BOARD_CENTER_X - CANVAS_W / 2;
  const subBackgroundUrl = (scene as Record<string, unknown> | null)?.sub_background_url as string | null ?? null;

  const canvasFilter = effectiveSceneEffect === 'ambient' ? ambientFilter : sceneEffectFilter;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative"
      style={{ background: 'hsl(var(--canvas-bg))', cursor: isPanning ? 'grabbing' : 'grab' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.z-50')) return;
        if (e.button === 0 && e.altKey) {
          handleAltClick(e);
        } else {
          handlePointerDown(e);
          if (e.button === 0) onSelectObject(null);
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {!obsMode && (
        <div className="absolute top-3 right-3 z-50 flex gap-1">
          <button
            onClick={presetMain}
            className={`p-1.5 min-w-[28px] text-[11px] font-bold leading-none transition-colors rounded-sm ${
              activePreset === 1
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground input-dark'
            }`}
            title="メインビュー"
          >1</button>
          <button
            onClick={presetMinimap}
            className={`p-1.5 min-w-[28px] text-[11px] font-bold leading-none transition-colors rounded-sm ${
              activePreset === 2
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground input-dark'
            }`}
            title="ミニマップビュー"
          >2</button>
          <button
            onClick={presetFree}
            className={`p-1.5 min-w-[28px] text-[11px] font-bold leading-none transition-colors rounded-sm ${
              activePreset === 3
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground input-dark'
            }`}
            title="フリービュー"
          >3</button>
          <div className="w-px bg-border mx-0.5" />
          <ZoomButton icon={<ZoomOut size={14} />} onClick={() => zoomTo(zoom * 0.8)} title="ズームアウト" />
          <button
            onClick={() => zoomTo(1)}
            className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground input-dark tabular-nums"
            title="100%表示"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ZoomButton icon={<ZoomIn size={14} />} onClick={() => zoomTo(zoom * 1.25)} title="ズームイン" />
          <ZoomButton icon={<Maximize size={14} />} onClick={fitToView} title="全体表示" />
        </div>
        )}


      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: totalW,
          height: totalH,
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isAnimating && !isPanning ? 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
        }}
      >
        <div
          className="absolute shadow-2xl"
          style={{
            left: WORKSPACE_MARGIN,
            top: WORKSPACE_MARGIN,
            width: CANVAS_W,
            height: CANVAS_H,
            background: '#050506',
            boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.08), 0 20px 60px rgba(0,0,0,0.6)',
            filter: canvasFilter || undefined,
            transition: 'filter 0.6s ease-in-out',
            animation: shakeStyle?.animation,
          }}
        >
          <AnimatePresence mode="wait">
            {scene?.background_url && (
              <motion.div
                key={scene.background_url}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: fadeDuration, ease: [0.2, 0, 0, 1] }}
                className="absolute inset-0 overflow-hidden"
              >
                <img
                  src={scene.background_url}
                  className="absolute w-full h-full object-cover"
                  style={{
                    filter: [
                      effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : '',
                      effectiveBrightness !== 100 ? `brightness(${effectiveBrightness / 100})` : '',
                      effectiveSaturation !== 100 ? `saturate(${effectiveSaturation / 100})` : '',
                      grayscaleState?.enabled ? 'grayscale(1)' : '',
                    ].filter(Boolean).join(' ') || undefined,
                    transform: effectiveBlur > 0 ? `scale(${1 + effectiveBlur * 0.008})` : undefined,
                    transition: 'filter 0.5s ease-in-out',
                  }}
                  alt="背景"
                  loading="lazy"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="absolute"
            style={{
              inset: 0,
              pointerEvents: isOnBreak ? 'none' : undefined,
            }}
          >
          <AnimatePresence mode="wait">
            <motion.div
              key={scene?.id ?? 'none'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: fadeDuration, ease: [0.2, 0, 0, 1] }}
              style={{ position: 'absolute', inset: 0 }}
            >
              {sceneObjects.map(obj => (
                <DraggableObject
                  key={obj.id}
                  obj={obj}
                  zoom={zoom}
                  isVisible={effectiveIsVisible(obj)}
                  isSelected={obj.id === selectedObjectId}
                  isAdmin={isAdmin}
                  onSelect={() => onSelectObject(obj.id)}
                  onDragEnd={handleDragEnd}
                  onDragMove={onDragMove}
                  onLocalUpdate={onLocalUpdateObject}
                  onContextMenu={onContextMenu}
                  onUpdateObject={onUpdateObject}
                  videoCommand={videoCommands?.[obj.id]}
                  onVideoControl={onVideoControl}
                  masterVolume={masterVolume}
                  suppressAutoplay={suppressAutoplay}
                  grayscale={shouldGrayscale(obj)}
                  bounce={bounceCommands?.[obj.id]}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {embedObjects.map(obj => (
            <DraggableObject
              key={obj.id}
              obj={obj}
              zoom={zoom}
              isVisible={effectiveIsVisible(obj) && obj.scene_id === embedSceneId}
              isSelected={obj.id === selectedObjectId}
              isAdmin={isAdmin}
              onSelect={() => onSelectObject(obj.id)}
              onDragEnd={handleDragEnd}
              onDragMove={onDragMove}
              onLocalUpdate={onLocalUpdateObject}
              onContextMenu={onContextMenu}
              onUpdateObject={onUpdateObject}
              videoCommand={videoCommands?.[obj.id]}
              onVideoControl={onVideoControl}
              masterVolume={masterVolume}
              suppressAutoplay={suppressAutoplay}
              grayscale={shouldGrayscale(obj)}
              bounce={bounceCommands?.[obj.id]}
            />
          ))}

          {persistentObjects.map(obj => (
            <DraggableObject
              key={obj.id}
              obj={obj}
              zoom={zoom}
              isVisible={effectiveIsVisible(obj)}
              isSelected={obj.id === selectedObjectId}
              isAdmin={isAdmin}
              onSelect={() => onSelectObject(obj.id)}
              onDragEnd={handleDragEnd}
              onDragMove={onDragMove}
              onLocalUpdate={onLocalUpdateObject}
              onContextMenu={onContextMenu}
              onUpdateObject={onUpdateObject}
              masterVolume={masterVolume}
              suppressAutoplay={suppressAutoplay}
              grayscale={shouldGrayscale(obj)}
              bounce={bounceCommands?.[obj.id]}
            />
          ))}
          </div>
        </div>

        {/* サブ盤面（カメラ2位置）。FHDの2枚目の盤面。背景=sub_background_url。
            オブジェクトはワークスペース全域に絶対配置されるため、サブ盤面エリアの座標に
            置けば自動でここに写る（盤面はクリップしない）。 */}
        <div
          className="absolute shadow-2xl"
          style={{
            left: SUB_BOARD_LEFT,
            top: WORKSPACE_MARGIN,
            width: CANVAS_W,
            height: CANVAS_H,
            background: '#050506',
            boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.08), 0 20px 60px rgba(0,0,0,0.6)',
            zIndex: -1, // オブジェクト(z_index≥0)より背面に。サブ盤面の背景が手前に来ないように
          }}
        >
          {subBackgroundUrl && (
            <img
              src={subBackgroundUrl}
              className="absolute w-full h-full object-cover"
              alt="サブ背景"
              loading="lazy"
            />
          )}
          {!subBackgroundUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground/40 text-sm">サブ盤面（背景未設定）</p>
            </div>
          )}
        </div>

        <div
          className="absolute pointer-events-none"
          style={{
            left: WORKSPACE_MARGIN,
            top: WORKSPACE_MARGIN,
            width: CANVAS_W,
            height: CANVAS_H,
            background: effectiveSceneEffect === 'ambient' ? ambientColor : 'transparent',
            opacity: effectiveSceneEffect === 'ambient' ? ambientOpacity : 0,
            mixBlendMode: ambientBlendMode,
            zIndex: 100,
            transition: 'background 0.6s ease-in-out, opacity 0.6s ease-in-out',
          }}
        />

        <div
          className="absolute pointer-events-none"
          style={{
            left: WORKSPACE_MARGIN,
            top: WORKSPACE_MARGIN,
            width: CANVAS_W,
            height: CANVAS_H,
            background: '#000',
            opacity: effectiveSceneEffect === 'darken' ? 1 : 0,
            zIndex: 100,
            transition: 'opacity 0.6s ease-in-out',
          }}
        />

        {!scene && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: WORKSPACE_MARGIN,
              top: WORKSPACE_MARGIN,
              width: CANVAS_W,
              height: CANVAS_H,
            }}
          >
            <p className="text-muted-foreground text-sm">シーンを選択してください</p>
          </div>
        )}

        {screenMode > 0 && (() => {
          // スクリーン1=メイン盤面(WORKSPACE_MARGIN)、2=サブ盤面(SUB_BOARD_LEFT)を黒枠で囲う
          const screenLeft = screenMode === 2 ? SUB_BOARD_LEFT : WORKSPACE_MARGIN;
          return (
            <>
              <div className="absolute pointer-events-none" style={{ left: -20000, top: -20000, width: totalW + 80000, height: WORKSPACE_MARGIN + 20000, background: '#000', zIndex: 9998 }} />
              <div className="absolute pointer-events-none" style={{ left: -20000, top: WORKSPACE_MARGIN + CANVAS_H, width: totalW + 80000, height: WORKSPACE_MARGIN + 20000, background: '#000', zIndex: 9998 }} />
              <div className="absolute pointer-events-none" style={{ left: -20000, top: WORKSPACE_MARGIN, width: screenLeft + 20000, height: CANVAS_H, background: '#000', zIndex: 9998 }} />
              <div className="absolute pointer-events-none" style={{ left: screenLeft + CANVAS_W, top: WORKSPACE_MARGIN, width: 40000, height: CANVAS_H, background: '#000', zIndex: 9998 }} />
            </>
          );
        })()}

        {/* フラッシュ */}
        {flashState && (
          <div
            key={flashState.seq}
            className="absolute pointer-events-none"
            style={{
              left: WORKSPACE_MARGIN,
              top: WORKSPACE_MARGIN,
              width: CANVAS_W,
              height: CANVAS_H,
              background: flashState.color,
              zIndex: 9990,
              opacity: 0,
              ['--lsm-flash-opacity' as string]: flashState.opacity,
              animation: `lsm-flash ${flashState.durationMs}ms ease-out`,
            } as React.CSSProperties}
          />
        )}

        {/* テキストオーバーレイ */}
        {overlayState && (
          <div
            className="absolute pointer-events-none flex px-16"
            style={{
              left: WORKSPACE_MARGIN,
              top: WORKSPACE_MARGIN,
              width: CANVAS_W,
              height: CANVAS_H,
              zIndex: 9991,
              alignItems: overlayState.position === 'top' ? 'flex-start' : overlayState.position === 'bottom' ? 'flex-end' : 'center',
              justifyContent: 'center',
              paddingTop: overlayState.position === 'top' ? 120 : 0,
              paddingBottom: overlayState.position === 'bottom' ? 120 : 0,
            }}
          >
            <div
              key={overlayState.seq}
              className="text-center font-bold whitespace-pre-wrap"
              style={{
                fontSize: overlayState.fontSize,
                color: overlayState.color,
                textShadow: '0 4px 24px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8)',
                lineHeight: 1.3,
                animation: overlayState.closing ? 'lsm-overlay-out 0.45s ease-in forwards' : 'lsm-overlay-in 0.6s ease-out',
              }}
            >
              {overlayState.text}
            </div>
          </div>
        )}

        {/* カウントダウン */}
        {countdownValue != null && countdownMeta && (
          <div
            className="absolute pointer-events-none flex flex-col px-16"
            style={{
              left: WORKSPACE_MARGIN,
              top: WORKSPACE_MARGIN,
              width: CANVAS_W,
              height: CANVAS_H,
              zIndex: 9992,
              alignItems: 'center',
              justifyContent: countdownMeta.position === 'top' ? 'flex-start' : countdownMeta.position === 'bottom' ? 'flex-end' : 'center',
              paddingTop: countdownMeta.position === 'top' ? 100 : 0,
              paddingBottom: countdownMeta.position === 'bottom' ? 100 : 0,
            }}
          >
            {countdownMeta.label && (
              <div className="font-bold text-white mb-2" style={{ fontSize: 48, textShadow: '0 4px 24px rgba(0,0,0,0.9)' }}>
                {countdownMeta.label}
              </div>
            )}
            <div
              key={countdownValue}
              className="font-bold tabular-nums"
              style={{
                fontSize: countdownMeta.fontSize,
                color: countdownValue <= 3 ? countdownMeta.alertColor : '#ffffff',
                textShadow: '0 6px 40px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.8)',
                animation: 'lsm-countdown-tick 1s ease-out',
              }}
            >
              {countdownValue}
            </div>
          </div>
        )}

        {isOnBreak && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: WORKSPACE_MARGIN,
              top: WORKSPACE_MARGIN,
              width: CANVAS_W,
              height: CANVAS_H,
              backdropFilter: 'blur(16px)',
              background: 'hsla(0 0% 0% / 0.4)',
              zIndex: 9999,
            }}
          >
            <div className="text-center">
              <p
                className="text-white font-bold tracking-[0.3em] select-none"
                style={{ fontSize: '72px', textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
              >
                休憩中
              </p>
              <p className="text-white/50 text-lg mt-4 tracking-widest">BREAK TIME</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function ZoomButton({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 text-muted-foreground hover:text-foreground input-dark transition-colors"
      title={title}
    >
      {icon}
    </button>
  );
}
