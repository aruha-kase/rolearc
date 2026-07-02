import { useState, useRef, useEffect, useLayoutEffect, memo, useCallback } from 'react';
import { SceneObject, isLocked, isFlippedX, getRotation, getActiveUrl, getObjectCategory, getVideoSettings, getCropSettings, hasCrop, getBlendMode, getOpacity, getVariants, getCurrentVariantIndex } from '@/types/trpg';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { computeOpaqueBounds, OpaqueBounds } from '@/lib/opaqueBounds';

interface DraggableObjectProps {
  obj: SceneObject;
  zoom: number;
  isVisible: boolean;
  isSelected: boolean;
  isAdmin: boolean;
  onSelect: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onLocalUpdate: (id: string, updates: Record<string, unknown>) => void;
  onContextMenu?: (objId: string, x: number, y: number) => void;
  onUpdateObject?: (id: string, updates: Record<string, unknown>) => void;
  videoCommand?: { action: 'play' | 'pause'; seq: number; fadeMs?: number };
  onVideoControl?: (objId: string, action: 'play' | 'pause') => void;
  masterVolume?: number;
  suppressAutoplay?: boolean;
  grayscale?: boolean;
  opacityOverride?: number;
  bounce?: { stop: boolean; loop: boolean; count: number; intensity: number; durationMs: number; seq: number };
}

type CropEdge = 'top' | 'right' | 'bottom' | 'left';

export const DraggableObject = memo(function DraggableObject({
  obj, zoom, isVisible, isSelected, isAdmin, onSelect, onDragEnd, onDragMove, onLocalUpdate, onContextMenu, onUpdateObject,
  videoCommand, onVideoControl, masterVolume, suppressAutoplay, grayscale, opacityOverride, bounce,
}: DraggableObjectProps) {
  const [pos, setPos] = useState({ x: obj.x ?? 0, y: obj.y ?? 0 });
  const [dragging, setDragging] = useState(false);
  const [animateMove, setAnimateMove] = useState(false);
  const [cropping, setCropping] = useState<CropEdge | null>(null);
  const [localCrop, setLocalCrop] = useState(getCropSettings(obj));
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const cropStart = useRef({ x: 0, y: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 } });
  const dragBroadcastTimer = useRef(0);
  const mounted = useRef(false);
  const locked = isLocked(obj);
  const flipped = isFlippedX(obj);
  const rotation = getRotation(obj);
  const activeUrl = getActiveUrl(obj);
  const category = getObjectCategory(obj);
  const videoSettings = getVideoSettings(obj);
  const crop = getCropSettings(obj);
  const [opaqueBounds, setOpaqueBounds] = useState<OpaqueBounds | null>(null);

  useEffect(() => {
    if (!cropping) {
      setLocalCrop(getCropSettings(obj));
    }
  }, [obj, cropping]);

  useEffect(() => {
    // 画像でないもの(動画/URL画像=iframe/embed)は余白解析しない。
    // url_image(reactive等)を画像として読み込もうとするとCORSで失敗し、
    // 失敗するまでの待ち時間がメインスレッド/接続を圧迫して表示が遅くなるため。
    if (obj.type === 'video' || obj.type === 'url_image'
        || obj.type === 'embed_object' || obj.type === 'iframe_object') {
      setOpaqueBounds(null);
      return;
    }
    computeOpaqueBounds(activeUrl).then(setOpaqueBounds);
  }, [activeUrl, obj.type]);

  // バウンス: seqが変わるたびにアニメをリセットして再発火（非ループでも再実行可能に）
  const [bounceAnim, setBounceAnim] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!bounce || bounce.stop) { setBounceAnim(undefined); return; }
    const iter = bounce.loop ? 'infinite' : Math.max(1, bounce.count);
    setBounceAnim(undefined);
    const raf = requestAnimationFrame(() => {
      setBounceAnim(`lsm-bounce ${bounce.durationMs}ms ease-in-out ${iter}`);
    });
    return () => cancelAnimationFrame(raf);
  }, [bounce?.seq, bounce?.stop]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => { mounted.current = true; });
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!dragging && (pos.x !== (obj.x ?? 0) || pos.y !== (obj.y ?? 0))) {
    if (mounted.current) setAnimateMove(true);
    setPos({ x: obj.x ?? 0, y: obj.y ?? 0 });
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isVisible || e.button === 1 || e.altKey) return;
    if (locked) return;
    e.stopPropagation();
    onSelect();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isVisible, locked, onSelect, pos.x, pos.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStart.current.x) / zoom;
    const dy = (e.clientY - dragStart.current.y) / zoom;
    const newPos = { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy };
    setPos(newPos);
    onLocalUpdate(obj.id, { x: newPos.x, y: newPos.y });
    if (onDragMove) {
      const now = performance.now();
      // ドラッグ中の位置broadcast頻度を約15回/秒に制限。
      // 受信側(OBS/共有リンク)の再描画負荷を抑える。最終位置はpointerUpで確実に送るのでズレない。
      if (now - dragBroadcastTimer.current > 66) {
        dragBroadcastTimer.current = now;
        onDragMove(obj.id, newPos.x, newPos.y);
      }
    }
  }, [dragging, zoom, obj.id, onLocalUpdate, onDragMove]);

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    onDragEnd(obj.id, pos.x, pos.y);
    onDragMove?.(obj.id, pos.x, pos.y);
  }, [dragging, obj.id, pos.x, pos.y, onDragEnd, onDragMove]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isVisible) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    onContextMenu?.(obj.id, e.clientX, e.clientY);
  }, [isVisible, obj.id, onSelect, onContextMenu]);

  const handleCropPointerDown = useCallback((edge: CropEdge, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCropping(edge);
    const currentCrop = getCropSettings(obj);
    setLocalCrop(currentCrop);
    cropStart.current = { x: e.clientX, y: e.clientY, crop: { ...currentCrop } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [obj]);

  const handleCropPointerMove = useCallback((e: React.PointerEvent) => {
    if (!cropping) return;
    const w = obj.width ?? 300;
    const h = obj.height ?? 300;
    const dx = (e.clientX - cropStart.current.x) / zoom;
    const dy = (e.clientY - cropStart.current.y) / zoom;
    const startCrop = cropStart.current.crop;
    const newCrop = { ...startCrop };
    const flipMul = flipped ? -1 : 1;
    const MIN_VIS = 1;

    switch (cropping) {
      case 'top':
        newCrop.top = Math.max(0, Math.min(h - startCrop.bottom - MIN_VIS, startCrop.top + dy));
        break;
      case 'bottom':
        newCrop.bottom = Math.max(0, Math.min(h - startCrop.top - MIN_VIS, startCrop.bottom - dy));
        break;
      case 'left':
        newCrop.left = Math.max(0, Math.min(w - startCrop.right - MIN_VIS, startCrop.left + dx * flipMul));
        break;
      case 'right':
        newCrop.right = Math.max(0, Math.min(w - startCrop.left - MIN_VIS, startCrop.right - dx * flipMul));
        break;
    }

    setLocalCrop(newCrop);
    onLocalUpdate(obj.id, {
      crop_top: newCrop.top, crop_right: newCrop.right,
      crop_bottom: newCrop.bottom, crop_left: newCrop.left,
    });
  }, [cropping, zoom, obj.id, obj.width, obj.height, flipped, onLocalUpdate]);

  const handleCropPointerUp = useCallback(() => {
    if (!cropping) return;
    setCropping(null);
    onUpdateObject?.(obj.id, {
      crop_top: localCrop.top, crop_right: localCrop.right,
      crop_bottom: localCrop.bottom, crop_left: localCrop.left,
    });
  }, [cropping, obj.id, localCrop, onUpdateObject]);

  const w = obj.width ?? 300;
  const h = obj.height ?? 300;

  const activeCrop = cropping ? localCrop : crop;
  const cropL = activeCrop.left;
  const cropR = activeCrop.right;
  const cropT = activeCrop.top;
  const cropB = activeCrop.bottom;

  const autoT = opaqueBounds ? opaqueBounds.top * h : 0;
  const autoR = opaqueBounds ? opaqueBounds.right * w : 0;
  const autoB = opaqueBounds ? opaqueBounds.bottom * h : 0;
  const autoL = opaqueBounds ? opaqueBounds.left * w : 0;

  const effL = Math.max(cropL, autoL);
  const effR = Math.max(cropR, autoR);
  const effT = Math.max(cropT, autoT);
  const effB = Math.max(cropB, autoB);

  const hasInset = effL > 0 || effR > 0 || effT > 0 || effB > 0;
  const visW = Math.max(1, w - effL - effR);
  const visH = Math.max(1, h - effT - effB);

  const outlineColor = category === 'character_object' ? 'hsl(140 70% 50%)'
    : category === 'marker_object' ? 'hsl(40 90% 55%)'
    : 'hsl(210 100% 50%)';

  const showCropHandles = isSelected && !locked && isVisible && obj.type !== 'video';

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: w,
        height: h,
        zIndex: isSelected ? 9999 : (obj.z_index ?? 1),
        opacity: opacityOverride != null ? opacityOverride : (isVisible ? getOpacity(obj) / 100 : 0),
        pointerEvents: 'none',
        transform: (rotation || flipped) ? `rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})` : undefined,
        transformOrigin: 'center center',
        mixBlendMode: getBlendMode(obj) !== 'normal' ? getBlendMode(obj) as React.CSSProperties['mixBlendMode'] : undefined,
        filter: grayscale ? 'grayscale(1)' : undefined,
        transition: dragging || cropping
          ? 'none'
          : animateMove
            ? 'left 180ms ease-out, top 180ms ease-out, opacity 400ms ease, filter 0.5s ease-in-out'
            : 'opacity 400ms ease, filter 0.5s ease-in-out',
        ...(bounceAnim ? {
          ['--lsm-bounce-amp']: `${bounce?.intensity ?? 30}px`,
          animation: bounceAnim,
        } as React.CSSProperties : {}),
      }}
      onTransitionEnd={() => setAnimateMove(false)}
    >
      <div
        style={{
          position: 'absolute',
          left: effL,
          top: effT,
          width: visW,
          height: visH,
          overflow: 'hidden',
          pointerEvents: isVisible ? 'auto' : 'none',
          cursor: !isVisible || locked ? 'default' : dragging ? 'grabbing' : 'grab',
          outline: isSelected ? `2px solid ${outlineColor}` : 'none',
          outlineOffset: 2,
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        onClick={e => e.stopPropagation()}
      >
        {locked && isSelected && (
          <div className="absolute -top-5 left-0 text-[9px] text-muted-foreground bg-background/80 px-1 rounded"
            style={{ transform: flipped ? 'scaleX(-1)' : undefined }}>
            🔒
          </div>
        )}
        <div style={{ position: 'absolute', left: -effL, top: -effT, width: w, height: h }}>
          <ObjectContent
            obj={obj} activeUrl={activeUrl} w={w} h={h}
            videoSettings={videoSettings} isSelected={isSelected} flipped={flipped}
            isAdmin={isAdmin}
            videoCommand={videoCommand}
            onVideoControl={onVideoControl ? (action) => onVideoControl(obj.id, action) : undefined}
            onUpdateObject={onUpdateObject}
            masterVolume={masterVolume}
            suppressAutoplay={suppressAutoplay}
          />
        </div>
      </div>

      {/* Crop handles on visible area edges */}
      {showCropHandles && (
        <CropHandles
          effL={effL} effT={effT} visW={visW} visH={visH}
          flipped={flipped}
          onCropPointerDown={handleCropPointerDown}
          onCropPointerMove={handleCropPointerMove}
          onCropPointerUp={handleCropPointerUp}
        />
      )}

    </div>
  );
});

const CropHandles = memo(function CropHandles({
  effL, effT, visW, visH, flipped,
  onCropPointerDown, onCropPointerMove, onCropPointerUp,
}: {
  effL: number; effT: number; visW: number; visH: number; flipped: boolean;
  onCropPointerDown: (edge: CropEdge, e: React.PointerEvent) => void;
  onCropPointerMove: (e: React.PointerEvent) => void;
  onCropPointerUp: () => void;
}) {
  const EDGE_THICKNESS = 8;

  const edges: { edge: CropEdge; style: React.CSSProperties; cursor: string }[] = [
    {
      edge: 'top',
      style: { top: effT - EDGE_THICKNESS / 2, left: effL + 8, width: visW - 16, height: EDGE_THICKNESS },
      cursor: 'n-resize',
    },
    {
      edge: 'bottom',
      style: { top: effT + visH - EDGE_THICKNESS / 2, left: effL + 8, width: visW - 16, height: EDGE_THICKNESS },
      cursor: 's-resize',
    },
    {
      edge: 'left',
      style: { left: effL - EDGE_THICKNESS / 2, top: effT + 8, width: EDGE_THICKNESS, height: visH - 16 },
      cursor: 'w-resize',
    },
    {
      edge: 'right',
      style: { left: effL + visW - EDGE_THICKNESS / 2, top: effT + 8, width: EDGE_THICKNESS, height: visH - 16 },
      cursor: 'e-resize',
    },
  ];

  return (
    <>
      {edges.map(({ edge, style, cursor }) => (
        <div
          key={edge}
          style={{ position: 'absolute', ...style, cursor, zIndex: 10, pointerEvents: 'auto' }}
          className="group"
          onPointerDown={(e) => {
            if (!e.altKey) return;
            onCropPointerDown(edge, e);
          }}
          onPointerMove={onCropPointerMove}
          onPointerUp={onCropPointerUp}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'hsl(30 100% 50% / 0.6)', transform: flipped ? 'scaleX(-1)' : undefined }}
          />
        </div>
      ))}
    </>
  );
});

const ObjectContent = memo(function ObjectContent({
  obj, activeUrl, w, h, videoSettings, isSelected, flipped,
  isAdmin, videoCommand, onVideoControl, onUpdateObject, masterVolume, suppressAutoplay,
}: {
  obj: SceneObject; activeUrl: string; w: number; h: number;
  videoSettings: { autoplay: boolean; loop: boolean; muted: boolean; play_on_scene: boolean };
  isSelected: boolean; flipped: boolean;
  isAdmin: boolean;
  videoCommand?: { action: 'play' | 'pause'; seq: number; fadeMs?: number };
  onVideoControl?: (action: 'play' | 'pause') => void;
  onUpdateObject?: (id: string, updates: Record<string, unknown>) => void;
  masterVolume?: number;
  suppressAutoplay?: boolean;
}) {
  const [iframeMode, setIframeMode] = useState(() =>
    obj.type === 'url_image' && !/\.(png|jpe?g|gif|webp|svg|bmp|avif|apng)(\?.*)?$/i.test(activeUrl)
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const suppressAutoplayAtMountRef = useRef(suppressAutoplay ?? false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(videoSettings.muted ? 0 : 1);
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useLayoutEffect(() => {
    if (!videoRef.current) return;
    const effectiveVol = volume * (masterVolume ?? 1);
    videoRef.current.volume = effectiveVol;
    videoRef.current.muted = effectiveVol === 0;
  }, [volume, masterVolume]);

  useEffect(() => {
    if (!videoSettings.autoplay || suppressAutoplayAtMountRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const tryPlay = () => {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    };
    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener('canplay', tryPlay, { once: true });
      return () => video.removeEventListener('canplay', tryPlay);
    }
  }, [videoSettings.autoplay]);

  const cmdSeq = videoCommand?.seq;
  const cmdAction = videoCommand?.action;
  useEffect(() => {
    if (!cmdSeq || !videoRef.current) return;
    const video = videoRef.current;
    if (cmdAction === 'play') {
      if (!video.paused) return;
      const doPlay = () => {
        video.play().catch(() => {
          setTimeout(() => { if (video.paused) video.play().catch(() => {}); }, 800);
        });
      };
      if (video.readyState >= 2) {
        doPlay();
      } else {
        video.addEventListener('canplay', doPlay, { once: true });
        return () => video.removeEventListener('canplay', doPlay);
      }
    } else {
      video.pause();
    }
  }, [cmdSeq, cmdAction]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration || 0);
    if (!onUpdateObject) return;
    if (w !== 400 || h !== 400) return;
    const video = e.currentTarget;
    const natW = video.videoWidth;
    const natH = video.videoHeight;
    if (!natW || !natH) return;
    onUpdateObject(obj.id, { width: natW, height: natH });
  }, [obj.id, w, h, onUpdateObject]);

  if (obj.type === 'video') {
    const showVideoControls = isAdmin && (isSelected || showControls);
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    return (
      <div
        className="relative w-full h-full"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={activeUrl}
          width={w}
          height={h}
          loop={videoSettings.loop}
          muted={(masterVolume ?? 1) * volume === 0}
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
          style={{ pointerEvents: 'none' }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
          onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={handleLoadedMetadata}
        />
        {showVideoControls && (
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm"
            style={{ pointerEvents: 'auto', transform: flipped ? 'scaleX(-1)' : undefined }}
            onPointerDown={e => e.stopPropagation()}
          >
            {duration > 0 && (
              <div className="px-4 pt-2">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration}
                  step={0.5}
                  onValueChange={([v]) => {
                    setCurrentTime(v);
                    if (videoRef.current) videoRef.current.currentTime = v;
                  }}
                  className="w-full"
                />
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-2">
              <button
                className="p-2 text-white hover:text-primary hover:bg-white/10 rounded-lg transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const v = videoRef.current;
                  if (!v) return;
                  if (v.paused) {
                    v.play().then(() => onVideoControl?.('play')).catch(() => {});
                  } else {
                    v.pause();
                    onVideoControl?.('pause');
                  }
                }}
                title={isPlaying ? '停止' : '再生'}
              >
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>
              {duration > 0 && (
                <span className="text-xs text-white/70 tabular-nums shrink-0">
                  {fmt(currentTime)} / {fmt(duration)}
                </span>
              )}
              <button
                className="p-2 text-white hover:text-primary hover:bg-white/10 rounded-lg transition-colors ml-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  setVolume(v => v > 0 ? 0 : 1);
                }}
                title={volume === 0 ? 'ミュート解除' : 'ミュート'}
              >
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <Slider
                value={[volume]}
                min={0} max={1} step={0.05}
                onValueChange={([v]) => {
                  setVolume(v);
                }}
                className="w-20"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (obj.type === 'url_image' && iframeMode) {
    // 複数variant(=reactive表情)がある場合、全variantのiframeを常時マウントしておき、
    // 現在の表情だけを表示する。表情切り替えでiframeのsrcを差し替えると毎回reactiveへ
    // 再接続が発生し、繰り返すほど遅くなるため（最初の1回だけ速い症状の原因）。
    // 各iframeは一度だけ接続し以後は表示/非表示の切り替えだけにすることで一瞬で切り替わる。
    const variants = getVariants(obj);
    const activeIdx = getCurrentVariantIndex(obj);
    if (variants.length > 1) {
      return (
        <div className="relative w-full h-full">
          {variants.map((v, i) => (
            <iframe
              key={i}
              src={v.url}
              width={w} height={h}
              className="absolute inset-0 w-full h-full border-none pointer-events-none"
              style={{ opacity: i === activeIdx ? 1 : 0, transition: 'opacity 0.15s ease' }}
              title={`${obj.name} (${v.label})`}
            />
          ))}
        </div>
      );
    }
    return (
      <iframe
        src={activeUrl}
        width={w} height={h}
        className="w-full h-full border-none pointer-events-none"
        title={obj.name}
      />
    );
  }

  return (
    <img
      src={activeUrl}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
      draggable={false}
      alt={obj.name}
      loading="eager"
      onError={() => {
        if (obj.type === 'url_image' && !iframeMode) setIframeMode(true);
      }}
    />
  );
}, (prev, next) => {
  return prev.activeUrl === next.activeUrl
    && prev.w === next.w
    && prev.h === next.h
    && prev.isSelected === next.isSelected
    && prev.flipped === next.flipped
    && prev.isAdmin === next.isAdmin
    && prev.obj.type === next.obj.type
    && prev.obj.name === next.obj.name
    && prev.videoSettings.autoplay === next.videoSettings.autoplay
    && prev.videoSettings.loop === next.videoSettings.loop
    && prev.videoSettings.muted === next.videoSettings.muted
    && prev.videoSettings.play_on_scene === next.videoSettings.play_on_scene
    && prev.videoCommand?.seq === next.videoCommand?.seq
    && prev.masterVolume === next.masterVolume
    && prev.suppressAutoplay === next.suppressAutoplay;
});
