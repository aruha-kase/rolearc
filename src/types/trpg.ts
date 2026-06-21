import { Database } from '@/integrations/supabase/types';

export type Room = Database['public']['Tables']['rooms']['Row'];
export type Scene = Database['public']['Tables']['scenes']['Row'];
export type SceneObject = Database['public']['Tables']['objects']['Row'];

export type SceneObjectInsert = Database['public']['Tables']['objects']['Insert'];
export type SceneObjectUpdate = Database['public']['Tables']['objects']['Update'];
export type SceneInsert = Database['public']['Tables']['scenes']['Insert'];
export type RoomInsert = Database['public']['Tables']['rooms']['Insert'];

// Variant for character_object image variations
export interface CharacterVariant {
  url: string;
  label: string;
  crop_top?: number;
  crop_right?: number;
  crop_bottom?: number;
  crop_left?: number;
}

export type ObjectCategory = 'scene_object' | 'character_object' | 'marker_object';

// Helper to safely access extended fields on SceneObject
export function getObjectCategory(obj: SceneObject): ObjectCategory {
  return (obj.object_category as ObjectCategory) ?? 'scene_object';
}

export function isLocked(obj: SceneObject): boolean {
  return obj.is_locked ?? false;
}

export function isFlippedX(obj: SceneObject): boolean {
  return obj.flip_x ?? false;
}

export function getRotation(obj: SceneObject): number {
  return obj.rotation ?? 0;
}

export function getDisplayName(obj: SceneObject): string {
  return obj.display_name ?? obj.name;
}

export function getVariants(obj: SceneObject): CharacterVariant[] {
  const v = obj.variants;
  if (Array.isArray(v)) return v as unknown as CharacterVariant[];
  return [];
}

export function getCurrentVariantIndex(obj: SceneObject): number {
  return obj.current_variant_index ?? 0;
}

export function getActiveUrl(obj: SceneObject): string {
  const variants = getVariants(obj);
  const idx = getCurrentVariantIndex(obj);
  if (variants.length > 0 && idx < variants.length) {
    return variants[idx].url;
  }
  return obj.url;
}

export function getVideoSettings(obj: SceneObject) {
  return {
    autoplay: obj.autoplay ?? false,
    loop: obj.loop ?? false,
    muted: obj.muted ?? true,
    play_on_scene: obj.play_on_scene ?? false,
  };
}

export function isEmbedLikeObject(obj: SceneObject): boolean {
  const type = obj.type.toLowerCase();
  return type === 'url_image' || type === 'embed_object' || type === 'iframe_object';
}

export interface CropSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function getCropSettings(obj: SceneObject): CropSettings {
  return {
    top: obj.crop_top ?? 0,
    right: obj.crop_right ?? 0,
    bottom: obj.crop_bottom ?? 0,
    left: obj.crop_left ?? 0,
  };
}

export function hasCrop(obj: SceneObject): boolean {
  const c = getCropSettings(obj);
  return c.top > 0 || c.right > 0 || c.bottom > 0 || c.left > 0;
}

export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay';

export const BLEND_MODE_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: '通常' },
  { value: 'screen', label: '加算' },
  { value: 'multiply', label: '乗算' },
  { value: 'overlay', label: 'オーバーレイ' },
];

export function getBlendMode(obj: SceneObject): BlendMode {
  const meta = obj.metadata as Record<string, unknown> | null;
  const mode = meta?.blend_mode as string | undefined;
  if (mode === 'screen' || mode === 'multiply' || mode === 'overlay') return mode;
  return 'normal';
}

export function getOpacity(obj: SceneObject): number {
  const meta = obj.metadata as Record<string, unknown> | null;
  const v = meta?.opacity;
  if (typeof v === 'number' && v >= 0 && v <= 100) return v;
  return 100;
}
