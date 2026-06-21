import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SeTrack {
  id: string;
  room_id: string;
  name: string;
  url: string;
  volume: number;
  created_at: string;
}

export function useSePlayer(roomId: string | null, masterVolume: number = 1) {
  const [tracks, setTracks] = useState<SeTrack[]>([]);
  const [playingIds, setPlayingIds] = useState<string[]>([]);
  const audioPool = useRef<Map<string, HTMLAudioElement>>(new Map());
  const preloadCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const masterVolumeRef = useRef(masterVolume);

  // Sync master volume to all playing audio
  useEffect(() => {
    masterVolumeRef.current = masterVolume;
    audioPool.current.forEach((audio, trackId) => {
      const track = tracks.find(t => t.id === trackId);
      if (track) audio.volume = track.volume * masterVolume;
    });
  }, [masterVolume, tracks]);

  // Warm the browser HTTP cache for all SE tracks whenever the track list changes
  useEffect(() => {
    const cache = preloadCache.current;
    const trackIds = new Set(tracks.map(t => t.id));
    tracks.forEach(track => {
      if (!cache.has(track.id)) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = track.url;
        audio.load();
        cache.set(track.id, audio);
      }
    });
    cache.forEach((audio, id) => {
      if (!trackIds.has(id)) {
        audio.src = '';
        cache.delete(id);
      }
    });
  }, [tracks]);

  // Fetch SE tracks for the room
  useEffect(() => {
    if (!roomId) { setTracks([]); return; }
    const fetchTracks = async () => {
      try {
        const { data } = await supabase
          .from('se_tracks')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at');
        if (data) setTracks(data as SeTrack[]);
      } catch (e) {
        console.error('[SE] Fetch error:', e);
      }
    };
    fetchTracks();

    const channel = supabase
      .channel(`se-track-changes-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'se_tracks',
        filter: `room_id=eq.${roomId}`,
      }, () => { fetchTracks(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Listen for SE play broadcasts (viewer sync)
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`se-broadcast-${roomId}`)
      .on('broadcast', { event: 'se_play' }, (payload) => {
        const { url, volume: vol } = payload.payload ?? {};
        if (url) {
          const audio = new Audio(url);
          const baseVol = typeof vol === 'number' ? vol : 1.0;
          audio.volume = baseVol * masterVolumeRef.current;
          audio.play().catch(() => {});
          audio.addEventListener('ended', () => { audio.src = ''; });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Clean up audio pool and preload cache on unmount
  useEffect(() => {
    return () => {
      audioPool.current.forEach(a => { a.pause(); a.src = ''; });
      audioPool.current.clear();
      preloadCache.current.forEach(a => { a.src = ''; });
      preloadCache.current.clear();
    };
  }, []);

  const playSe = useCallback((trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    // Create new Audio for concurrent playback
    const audio = new Audio(track.url);
    audio.volume = track.volume * masterVolumeRef.current;
    audio.play().catch(e => console.warn('[SE] Play blocked:', e));

    audioPool.current.set(trackId, audio);
    setPlayingIds(prev => prev.includes(trackId) ? prev : [...prev, trackId]);

    audio.addEventListener('ended', () => {
      audioPool.current.delete(trackId);
      setPlayingIds(prev => prev.filter(id => id !== trackId));
    });

    // Broadcast to viewers
    if (roomId) {
      supabase.channel(`se-broadcast-${roomId}`).send({
        type: 'broadcast',
        event: 'se_play',
        payload: { url: track.url, volume: track.volume },
      });
    }
  }, [tracks, roomId]);

  const stopSe = useCallback((trackId: string) => {
    const audio = audioPool.current.get(trackId);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioPool.current.delete(trackId);
    }
    setPlayingIds(prev => prev.filter(id => id !== trackId));
  }, []);

  const stopAll = useCallback(() => {
    audioPool.current.forEach(a => { a.pause(); a.src = ''; });
    audioPool.current.clear();
    setPlayingIds([]);
  }, []);

  const addTrack = useCallback(async (name: string, url: string) => {
    if (!roomId) return;
    try {
      const { data, error } = await supabase
        .from('se_tracks')
        .insert({ room_id: roomId, name, url })
        .select()
        .single();
      if (error) {
        console.error('[SE] Insert failed:', error);
        return;
      }
      if (data) setTracks(prev => [...prev, data as SeTrack]);
    } catch (e) {
      console.error('[SE] addTrack error:', e);
    }
  }, [roomId]);

  const deleteTrack = useCallback(async (trackId: string) => {
    stopSe(trackId);
    try {
      await supabase.from('se_tracks').delete().eq('id', trackId);
      setTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (e) {
      console.error('[SE] deleteTrack error:', e);
    }
  }, [stopSe]);

  const updateVolume = useCallback(async (trackId: string, volume: number) => {
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
    const audio = audioPool.current.get(trackId);
    if (audio) audio.volume = volume * masterVolumeRef.current;
    try {
      await supabase.from('se_tracks').update({ volume }).eq('id', trackId);
    } catch (e) {
      console.error('[SE] updateVolume error:', e);
    }
  }, []);

  return {
    tracks,
    playingIds,
    playSe,
    stopSe,
    stopAll,
    addTrack,
    deleteTrack,
    updateVolume,
  };
}
