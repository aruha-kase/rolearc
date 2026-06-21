import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BgmTrack {
  id: string;
  room_id: string;
  name: string;
  url: string;
  created_at: string;
}

interface BgmState {
  trackId: string | null;
  status: 'playing' | 'paused' | 'stopped';
  volume: number;
  loop: boolean;
  fadeMs?: number;
}

export function useBgm(roomId: string | null, currentSceneId: string | null, masterVolume: number = 1, isAdmin: boolean = false) {
  const [tracks, setTracks] = useState<BgmTrack[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [loop, setLoop] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevSceneIdRef = useRef<string | null>(null);
  const sceneBgmCache = useRef<Map<string, string | null>>(new Map());
  const tracksRef = useRef<BgmTrack[]>([]);
  const currentTrackIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(0.5);
  const loopRef = useRef(true);
  const isAdminRef = useRef(isAdmin);
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);
  // Non-admin pages (viewer, OBS) have no explicit unlock button; auto-unlock on first interaction
  useEffect(() => {
    if (isAdmin || audioUnlocked) return;
    const tryUnlock = () => {
      if (!audioRef.current) return;
      const audio = audioRef.current;
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.play().then(() => {
        audio.pause();
        audio.src = '';
        setAudioUnlocked(true);
      }).catch(() => {});
      document.removeEventListener('click', tryUnlock, true);
      document.removeEventListener('keydown', tryUnlock, true);
      document.removeEventListener('touchstart', tryUnlock, true);
    };
    document.addEventListener('click', tryUnlock, true);
    document.addEventListener('keydown', tryUnlock, true);
    document.addEventListener('touchstart', tryUnlock, true);
    return () => {
      document.removeEventListener('click', tryUnlock, true);
      document.removeEventListener('keydown', tryUnlock, true);
      document.removeEventListener('touchstart', tryUnlock, true);
    };
  }, [isAdmin, audioUnlocked]);
  // Stores the track that should be playing when autoplay was blocked; retried after unlock
  const wantedPlayRef = useRef<{ trackId: string; url: string; volume: number; loop: boolean } | null>(null);
  // Flag to suppress broadcast when receiving remote state
  const suppressBroadcast = useRef(false);
  const broadcastDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentTrackIdRef.current = currentTrackId; }, [currentTrackId]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { loopRef.current = loop; }, [loop]);

  const masterVolumeRef = useRef(masterVolume);
  const preloadCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const bgmFadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    masterVolumeRef.current = masterVolume;
    if (audioRef.current) {
      audioRef.current.volume = volumeRef.current * masterVolume;
    }
  }, [masterVolume]);

  // Warm the browser HTTP cache for all BGM tracks as soon as the list is fetched
  useEffect(() => {
    const cache = preloadCache.current;
    const trackIds = new Set(tracks.map(t => t.id));
    // Add new tracks
    tracks.forEach(track => {
      if (!cache.has(track.id)) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = track.url;
        audio.load();
        cache.set(track.id, audio);
      }
    });
    // Remove stale entries
    cache.forEach((audio, id) => {
      if (!trackIds.has(id)) {
        audio.src = '';
        cache.delete(id);
      }
    });
  }, [tracks]);

  const broadcastBgmState = useCallback((state: BgmState) => {
    if (!roomId || suppressBroadcast.current) return;
    supabase.channel(`bgm-broadcast-${roomId}`).send({
      type: 'broadcast',
      event: 'bgm_state',
      payload: state,
    });
  }, [roomId]);

  // Fetch tracks
  useEffect(() => {
    if (!roomId) return;
    const fetchTracks = async () => {
      try {
        const { data, error } = await supabase
          .from('bgm_tracks')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at');
        if (data) setTracks(data as BgmTrack[]);
      } catch (e) {
        console.error('[BGM] Fetch tracks error:', e);
      }
    };
    fetchTracks();

    const channel = supabase
      .channel('bgm-track-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bgm_tracks',
        filter: `room_id=eq.${roomId}`,
      }, () => { fetchTracks(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      audioRef.current = audio;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      preloadCache.current.forEach(a => { a.src = ''; });
      preloadCache.current.clear();
    };
  }, []);

  // Sync volume to audio element (shared volume × master volume)
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume * masterVolumeRef.current;
  }, [volume]);

  // Sync loop to audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
  }, [loop]);

  // Listen for BGM state broadcasts from other clients
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`bgm-broadcast-${roomId}`)
      .on('broadcast', { event: 'request_bgm_sync' }, () => {
        // Admin responds with current BGM state so late-joining clients can sync
        if (!isAdminRef.current) return;
        channel.send({
          type: 'broadcast',
          event: 'bgm_state',
          payload: {
            trackId: currentTrackIdRef.current,
            status: isPlayingRef.current ? 'playing' : currentTrackIdRef.current ? 'paused' : 'stopped',
            volume: volumeRef.current,
            loop: loopRef.current,
          },
        });
      })
      .on('broadcast', { event: 'bgm_state' }, (payload) => {
        const state = payload.payload as BgmState;
        if (!state) return;

        suppressBroadcast.current = true;

        // Apply received state
          if (state.volume !== undefined) {
          setVolume(state.volume);
          if (audioRef.current) audioRef.current.volume = state.volume * masterVolumeRef.current;
        }
        if (state.loop !== undefined) {
          setLoop(state.loop);
          if (audioRef.current) audioRef.current.loop = state.loop;
        }

        if (state.status === 'stopped') {
          if (state.fadeMs && state.fadeMs > 0 && audioRef.current && isPlayingRef.current) {
            // Fade out then stop
            const audio = audioRef.current;
            const startVol = audio.volume;
            const startTime = Date.now();
            if (bgmFadeTimer.current) clearInterval(bgmFadeTimer.current);
            bgmFadeTimer.current = setInterval(() => {
              if (!audioRef.current) { clearInterval(bgmFadeTimer.current!); bgmFadeTimer.current = null; return; }
              const progress = Math.min((Date.now() - startTime) / state.fadeMs!, 1);
              audioRef.current.volume = startVol * (1 - progress);
              if (progress >= 1) {
                clearInterval(bgmFadeTimer.current!);
                bgmFadeTimer.current = null;
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current.volume = state.volume * masterVolumeRef.current;
                setIsPlaying(false);
              }
            }, 16);
            setCurrentTrackId(state.trackId);
          } else {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            setIsPlaying(false);
            setCurrentTrackId(state.trackId);
          }
        } else if (state.status === 'paused') {
          if (audioRef.current) audioRef.current.pause();
          setIsPlaying(false);
          setCurrentTrackId(state.trackId);
        } else if (state.status === 'playing' && state.trackId) {
          const track = tracksRef.current.find(t => t.id === state.trackId);
          if (track && audioRef.current) {
            const audio = audioRef.current;
            if (audio.src !== track.url) {
              audio.src = track.url;
            }
            const targetVol = state.volume * masterVolumeRef.current;
            // For fade-in: start silent, ramp up after play() resolves
            audio.volume = state.fadeMs && state.fadeMs > 0 ? 0 : targetVol;
            audio.loop = state.loop;
            audio.play().then(() => {
              setCurrentTrackId(state.trackId);
              setIsPlaying(true);
              setAudioUnlocked(true);
              wantedPlayRef.current = null;
              if (state.fadeMs && state.fadeMs > 0) {
                if (bgmFadeTimer.current) clearInterval(bgmFadeTimer.current);
                const startTime = Date.now();
                bgmFadeTimer.current = setInterval(() => {
                  if (!audioRef.current) { clearInterval(bgmFadeTimer.current!); bgmFadeTimer.current = null; return; }
                  const progress = Math.min((Date.now() - startTime) / state.fadeMs!, 1);
                  audioRef.current.volume = targetVol * progress;
                  if (progress >= 1) { clearInterval(bgmFadeTimer.current!); bgmFadeTimer.current = null; }
                }, 16);
              }
            }).catch(e => {
              console.warn('[BGM] Autoplay blocked on sync:', e);
              wantedPlayRef.current = { trackId: state.trackId!, url: track.url, volume: state.volume, loop: state.loop };
            });
          }
        }

        suppressBroadcast.current = false;
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED' || isAdminRef.current) return;
        // Request current BGM state from admin after joining
        setTimeout(() => {
          channel.send({ type: 'broadcast', event: 'request_bgm_sync', payload: {} });
        }, 500);
      });
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Update scene BGM cache via realtime
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel('scene-bgm-cache')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'scenes',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (payload.new && 'id' in payload.new) {
          const scene = payload.new as { id: string; bgm_track_id: string | null };
          sceneBgmCache.current.set(scene.id, scene.bgm_track_id ?? null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Stable play function using refs
  const playTrackInternal = useCallback((trackId: string) => {
    const allTracks = tracksRef.current;
    const track = allTracks.find(t => t.id === trackId);
    if (!track || !audioRef.current) return;

    const audio = audioRef.current;

    if (currentTrackIdRef.current === trackId && isPlayingRef.current && audio.src === track.url) {
      return;
    }

    const vol = volumeRef.current;
    const lp = loopRef.current;
    const mv = masterVolumeRef.current;

    if (audio.src === track.url && audio.readyState >= 2) {
      audio.currentTime = 0;
      audio.volume = vol * mv;
      audio.loop = lp;
      audio.play().then(() => {
        setCurrentTrackId(trackId);
        setIsPlaying(true);
        setAudioUnlocked(true);
      }).catch(e => console.warn('Autoplay blocked:', e));
      return;
    }

    audio.src = track.url;
    audio.volume = vol * mv;
    audio.loop = lp;
    audio.play().then(() => {
      setCurrentTrackId(trackId);
      setIsPlaying(true);
      setAudioUnlocked(true);
    }).catch(e => console.warn('Autoplay blocked:', e));
  }, []);

  // After audio is unlocked by user interaction, restart whatever should be playing.
  // Priority: (1) track received from bgm_state sync that autoplay blocked, (2) scene-linked BGM.
  useEffect(() => {
    if (!audioUnlocked || isPlayingRef.current) return;
    if (wantedPlayRef.current) {
      const { trackId, url, volume: vol, loop: lp } = wantedPlayRef.current;
      wantedPlayRef.current = null;
      if (audioRef.current) {
        const audio = audioRef.current;
        if (audio.src !== url) audio.src = url;
        audio.volume = vol * masterVolumeRef.current;
        audio.loop = lp;
        audio.play().then(() => {
          setCurrentTrackId(trackId);
          setIsPlaying(true);
        }).catch(e => console.warn('[BGM] Retry after unlock failed:', e));
      }
      return;
    }
    if (!currentSceneId) return;
    const trackId = sceneBgmCache.current.get(currentSceneId);
    if (trackId) playTrackInternal(trackId);
  }, [audioUnlocked, currentSceneId, playTrackInternal]);

  // Scene switch: check cached BGM
  useEffect(() => {
    if (!currentSceneId || currentSceneId === prevSceneIdRef.current) return;
    prevSceneIdRef.current = currentSceneId;

    if (sceneBgmCache.current.has(currentSceneId)) {
      const trackId = sceneBgmCache.current.get(currentSceneId)!;
      if (trackId) playTrackInternal(trackId);
      return;
    }

    const checkSceneBgm = async () => {
      try {
        const { data } = await supabase
          .from('scenes')
          .select('bgm_track_id')
          .eq('id', currentSceneId)
          .single();
        const trackId = data?.bgm_track_id ?? null;
        sceneBgmCache.current.set(currentSceneId, trackId);
        if (trackId) playTrackInternal(trackId);
      } catch (e) {
        console.error('[BGM] Scene BGM check error:', e);
      }
    };
    checkSceneBgm();
  }, [currentSceneId, playTrackInternal]);

  const unlockAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    audioRef.current.play().then(() => {
      audioRef.current!.pause();
      audioRef.current!.src = '';
      setAudioUnlocked(true);
    }).catch(() => {});
  }, []);

  const clearBgmFade = useCallback(() => {
    if (bgmFadeTimer.current) {
      clearInterval(bgmFadeTimer.current);
      bgmFadeTimer.current = null;
    }
  }, []);

  const playTrack = useCallback((trackId: string, fadeMs: number = 0) => {
    clearBgmFade();
    playTrackInternal(trackId);
    if (fadeMs > 0 && audioRef.current) {
      // Override volume to 0 after playTrackInternal (which sets vol*mv), then ramp up
      audioRef.current.volume = 0;
      const targetVol = volumeRef.current * masterVolumeRef.current;
      const startTime = Date.now();
      bgmFadeTimer.current = setInterval(() => {
        if (!audioRef.current) { clearBgmFade(); return; }
        const progress = Math.min((Date.now() - startTime) / fadeMs, 1);
        audioRef.current.volume = targetVol * progress;
        if (progress >= 1) clearBgmFade();
      }, 16);
    }
    broadcastBgmState({
      trackId,
      status: 'playing',
      volume: volumeRef.current,
      loop: loopRef.current,
      fadeMs: fadeMs > 0 ? fadeMs : undefined,
    });
  }, [playTrackInternal, broadcastBgmState, clearBgmFade]);

  const stopPlayback = useCallback((fadeMs: number = 0) => {
    clearBgmFade();
    if (fadeMs > 0 && audioRef.current && isPlayingRef.current) {
      const startVol = audioRef.current.volume;
      const startTime = Date.now();
      broadcastBgmState({
        trackId: currentTrackIdRef.current,
        status: 'stopped',
        volume: volumeRef.current,
        loop: loopRef.current,
        fadeMs: fadeMs > 0 ? fadeMs : undefined,
      });
      bgmFadeTimer.current = setInterval(() => {
        if (!audioRef.current) { clearBgmFade(); return; }
        const progress = Math.min((Date.now() - startTime) / fadeMs, 1);
        audioRef.current.volume = startVol * (1 - progress);
        if (progress >= 1) {
          clearBgmFade();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.volume = volumeRef.current * masterVolumeRef.current;
          setIsPlaying(false);
        }
      }, 16);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      broadcastBgmState({
        trackId: currentTrackIdRef.current,
        status: 'stopped',
        volume: volumeRef.current,
        loop: loopRef.current,
      });
    }
  }, [broadcastBgmState, clearBgmFade]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !currentTrackIdRef.current) return;
    if (isPlayingRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      broadcastBgmState({
        trackId: currentTrackIdRef.current,
        status: 'paused',
        volume: volumeRef.current,
        loop: loopRef.current,
      });
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        broadcastBgmState({
          trackId: currentTrackIdRef.current,
          status: 'playing',
          volume: volumeRef.current,
          loop: loopRef.current,
        });
      }).catch(() => {});
    }
  }, [broadcastBgmState]);

  // Wrap setVolume to broadcast (audio updates immediately, broadcast is debounced)
  const setVolumeAndBroadcast = useCallback((v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v * masterVolumeRef.current;
    if (broadcastDebounceTimer.current) clearTimeout(broadcastDebounceTimer.current);
    broadcastDebounceTimer.current = setTimeout(() => {
      broadcastDebounceTimer.current = null;
      broadcastBgmState({
        trackId: currentTrackIdRef.current,
        status: isPlayingRef.current ? 'playing' : 'paused',
        volume: v,
        loop: loopRef.current,
      });
    }, 300);
  }, [broadcastBgmState]);

  // Wrap setLoop to broadcast
  const setLoopAndBroadcast = useCallback((v: boolean) => {
    setLoop(v);
    if (audioRef.current) audioRef.current.loop = v;
    broadcastBgmState({
      trackId: currentTrackIdRef.current,
      status: isPlayingRef.current ? 'playing' : 'paused',
      volume: volumeRef.current,
      loop: v,
    });
  }, [broadcastBgmState]);

  const addTrack = useCallback(async (name: string, url: string) => {
    if (!roomId) return;
    try {
      const { data, error } = await supabase
        .from('bgm_tracks')
        .insert({ room_id: roomId, name, url })
        .select()
        .single();
      if (error) {
        console.error('[BGM] DB insert failed:', error);
        return;
      }
      if (data) {
        setTracks(prev => [...prev, data as BgmTrack]);
      }
    } catch (e) {
      console.error('[BGM] addTrack error:', e);
    }
  }, [roomId]);

  const deleteTrack = useCallback(async (trackId: string) => {
    if (currentTrackIdRef.current === trackId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    }
    try {
      await supabase.from('bgm_tracks').delete().eq('id', trackId);
    } catch (e) {
      console.error('[BGM] deleteTrack error:', e);
    }
  }, []);

  const linkBgmToScene = useCallback(async (sceneId: string, trackId: string | null) => {
    sceneBgmCache.current.set(sceneId, trackId);
    try {
      await supabase.from('scenes').update({ bgm_track_id: trackId }).eq('id', sceneId);
    } catch (e) {
      console.error('[BGM] linkBgmToScene error:', e);
    }
  }, []);

  return {
    tracks,
    currentTrackId,
    isPlaying,
    volume,
    loop,
    audioUnlocked,
    setVolume: setVolumeAndBroadcast,
    setLoop: setLoopAndBroadcast,
    playTrack,
    stopPlayback,
    togglePlayback,
    addTrack,
    deleteTrack,
    linkBgmToScene,
    unlockAudio,
  };
}
