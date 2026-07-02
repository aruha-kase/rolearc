import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadToR2, deleteFromR2 } from '@/lib/r2upload';

export type AssetCategory = 'background' | 'character' | 'object' | 'video';

export interface RoomAsset {
  id: string;
  room_id: string;
  name: string;
  url: string;
  category: AssetCategory;
  file_size: number | null;
  created_at: string;
}

export function useRoomAssets(roomId: string | null) {
  const [assets, setAssets] = useState<RoomAsset[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    const { data } = await supabase
      .from('room_assets')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (data) setAssets(data as unknown as RoomAsset[]);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const uploadAsset = useCallback(async (file: File, category: AssetCategory = 'object') => {
    if (!roomId) return null;
    const ext = file.name.split('.').pop();
    const path = `library/${roomId}/${crypto.randomUUID()}.${ext}`;
    let publicUrl: string;
    try {
      publicUrl = await uploadToR2(file, path);
    } catch (err) {
      console.error('[useRoomAssets] R2 upload failed:', err);
      return null;
    }

    const { data } = await supabase
      .from('room_assets')
      .insert({ room_id: roomId, name: file.name, url: publicUrl, category, file_size: file.size })
      .select()
      .single();
    if (data) {
      const asset = data as unknown as RoomAsset;
      setAssets(prev => [asset, ...prev]);
      return asset;
    }
    return null;
  }, [roomId]);

  const renameAsset = useCallback(async (id: string, name: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, name } : a));
    await supabase.from('room_assets').update({ name }).eq('id', id);
  }, []);

  const checkAssetInUse = useCallback(async (asset: RoomAsset): Promise<boolean> => {
    // Check if URL is used by any object or scene background
    const { data: objMatches } = await supabase
      .from('objects')
      .select('id')
      .eq('url', asset.url)
      .limit(1);
    if (objMatches && objMatches.length > 0) return true;

    const { data: sceneMatches } = await supabase
      .from('scenes')
      .select('id')
      .eq('background_url', asset.url)
      .limit(1);
    if (sceneMatches && sceneMatches.length > 0) return true;

    return false;
  }, []);

  const deleteAsset = useCallback(async (id: string, force = false): Promise<{ success: boolean; inUse?: boolean }> => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return { success: false };

    if (!force) {
      const inUse = await checkAssetInUse(asset);
      if (inUse) return { success: false, inUse: true };
    }

    // R2からファイル削除（R2 URLの場合のみ）
    await deleteFromR2(asset.url);

    // Delete DB record
    await supabase.from('room_assets').delete().eq('id', id);
    setAssets(prev => prev.filter(a => a.id !== id));
    return { success: true };
  }, [assets, checkAssetInUse]);

  const updateCategory = useCallback(async (id: string, category: AssetCategory) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, category } : a));
    await supabase.from('room_assets').update({ category }).eq('id', id);
  }, []);

  return { assets, loading, uploadAsset, renameAsset, deleteAsset, updateCategory, refetch: fetchAssets };
}
