import { useEffect, useRef, useState } from 'react';
import { SceneObject, isLocked, isFlippedX, getObjectCategory, getVariants, getCurrentVariantIndex } from '@/types/trpg';
import { Lock, Unlock, FlipHorizontal, ArrowUp, ArrowDown, Trash2, Eye, EyeOff, ChevronRight, ChevronLeft, Smile, Copy } from 'lucide-react';

interface ObjectContextMenuProps {
  obj: SceneObject;
  objects: SceneObject[];
  position: { x: number; y: number };
  isAdmin: boolean;
  onClose: () => void;
  onUpdateObject: (id: string, updates: Record<string, unknown>) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject?: (id: string) => void;
}

export function ObjectContextMenu({
  obj, objects, position, isAdmin, onClose, onUpdateObject, onDeleteObject, onDuplicateObject,
}: ObjectContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showVariants, setShowVariants] = useState(false);
  const locked = isLocked(obj);
  const flipped = isFlippedX(obj);
  const category = getObjectCategory(obj);
  const variants = getVariants(obj);
  const currentVariantIndex = getCurrentVariantIndex(obj);
  const maxZ = objects.reduce((max, o) => Math.max(max, o.z_index ?? 0), 0);
  const minZ = objects.reduce((min, o) => Math.min(min, o.z_index ?? 0), maxZ);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const items: Array<{ icon: React.ReactNode; label: string; action: () => void; destructive?: boolean; hasSubmenu?: boolean }> = [];

  if (category === 'character_object' && variants.length > 1) {
    items.push({
      icon: <Smile size={12} />,
      label: '表情変化',
      action: () => setShowVariants(true),
      hasSubmenu: true,
    });
  }

  if (category === 'character_object' || category === 'scene_object' || category === 'marker_object') {
    items.push({
      icon: <FlipHorizontal size={12} />,
      label: flipped ? '反転解除' : '左右反転',
      action: () => { onUpdateObject(obj.id, { flip_x: !flipped }); onClose(); },
    });
  }

  items.push({
    icon: locked ? <Unlock size={12} /> : <Lock size={12} />,
    label: locked ? 'ロック解除' : 'ロック',
    action: () => { onUpdateObject(obj.id, { is_locked: !locked }); onClose(); },
  });

  if (!locked) {
    const sortedByZ = [...objects].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
    const curIdx = sortedByZ.findIndex(o => o.id === obj.id);
    const curZ = obj.z_index ?? 0;

    items.push(
      {
        icon: <ArrowUp size={12} />,
        label: '最前面',
        action: () => {
          if (curZ < maxZ) { onUpdateObject(obj.id, { z_index: maxZ + 1 }); }
          onClose();
        },
      },
      {
        icon: <ArrowUp size={12} />,
        label: '前面',
        action: () => {
          if (curIdx < sortedByZ.length - 1) {
            const above = sortedByZ[curIdx + 1];
            const aboveZ = above.z_index ?? 0;
            onUpdateObject(obj.id, { z_index: aboveZ });
            onUpdateObject(above.id, { z_index: curZ });
          }
          onClose();
        },
      },
      {
        icon: <ArrowDown size={12} />,
        label: '背面',
        action: () => {
          if (curIdx > 0) {
            const below = sortedByZ[curIdx - 1];
            const belowZ = below.z_index ?? 0;
            onUpdateObject(obj.id, { z_index: belowZ });
            onUpdateObject(below.id, { z_index: curZ });
          }
          onClose();
        },
      },
      {
        icon: <ArrowDown size={12} />,
        label: '最背面',
        action: () => {
          if (curZ > minZ) { onUpdateObject(obj.id, { z_index: minZ - 1 }); }
          onClose();
        },
      },
    );
  }

  items.push({
    icon: obj.is_visible ? <EyeOff size={12} /> : <Eye size={12} />,
    label: obj.is_visible ? '非表示にする' : '表示する',
    action: () => { onUpdateObject(obj.id, { is_visible: !obj.is_visible }); onClose(); },
  });

  if (isAdmin && onDuplicateObject) {
    items.push({
      icon: <Copy size={12} />,
      label: '複製',
      action: () => { onDuplicateObject(obj.id); onClose(); },
    });
  }

  if (isAdmin) {
    items.push({
      icon: <Trash2 size={12} />,
      label: '削除',
      action: () => { onDeleteObject(obj.id); onClose(); },
      destructive: true,
    });
  }

  return (
    <div
      ref={ref}
      className="fixed z-[9999] glass-panel py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      {showVariants ? (
        <>
          <button
            onClick={() => setShowVariants(false)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/40 transition-colors border-b border-border/30"
          >
            <ChevronLeft size={12} /> 戻る
          </button>
          {variants.map((variant, index) => (
            <button
              key={index}
              onClick={() => {
                const updates: Record<string, unknown> = { current_variant_index: index };
                if (variant.crop_top !== undefined || variant.crop_right !== undefined || variant.crop_bottom !== undefined || variant.crop_left !== undefined) {
                  updates.crop_top = variant.crop_top ?? 0;
                  updates.crop_right = variant.crop_right ?? 0;
                  updates.crop_bottom = variant.crop_bottom ?? 0;
                  updates.crop_left = variant.crop_left ?? 0;
                }
                onUpdateObject(obj.id, updates);
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                index === currentVariantIndex
                  ? 'text-green-400 bg-green-400/10'
                  : 'text-foreground hover:bg-secondary/40'
              }`}
            >
              {index === currentVariantIndex && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />}
              {index !== currentVariantIndex && <span className="w-2 shrink-0" />}
              {variant.label}
            </button>
          ))}
        </>
      ) : (
        items.map((item, i) => (
          <button
            key={i}
            onClick={item.action}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
              item.destructive
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-foreground hover:bg-secondary/40'
            }`}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.hasSubmenu && <ChevronRight size={12} className="text-muted-foreground" />}
          </button>
        ))
      )}
    </div>
  );
}
