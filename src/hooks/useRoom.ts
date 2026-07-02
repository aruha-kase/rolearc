import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room, Scene, SceneObject, SceneObjectUpdate } from '@/types/trpg';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [videoCommands, setVideoCommands] = useState<Record<string, { action: 'play' | 'pause'; seq: number; fadeMs?: number }>>({});
  const [mediaPreload, setMediaPreload] = useState<{ done: number; total: number; label: string } | null>(null);
  const preloadEls = useRef<Array<HTMLVideoElement | HTMLImageElement | HTMLAudioElement>>([]);
  const [hideAllObjects, setHideAllObjects] = useState(() =>
    roomId ? localStorage.getItem(`hideAll_${roomId}`) === 'true' : false
  );
  const [hideCharacterObjects, setHideCharacterObjects] = useState(() =>
    roomId ? localStorage.getItem(`hideChar_${roomId}`) === 'true' : false
  );
  const [shakeCommand, setShakeCommand] = useState<{ intensity: number; durationMs: number; frequency: number; pattern: string; seq: number } | null>(null);
  const [tempHiddenId, setTempHiddenId] = useState<string | null>(null);
  const [flashCommand, setFlashCommand] = useState<{ color: string; durationMs: number; opacity: number; seq: number } | null>(null);
  const [textOverlayCommand, setTextOverlayCommand] = useState<{ text: string; position: string; fontSize: number; color: string; durationMs: number; seq: number } | null>(null);
  const [countdownCommand, setCountdownCommand] = useState<{ seconds: number; position: string; label: string; fontSize?: number; alertColor?: string; seq: number } | null>(null);
  const [bounceCommands, setBounceCommands] = useState<Record<string, { stop: boolean; loop: boolean; count: number; intensity: number; durationMs: number; seq: number }>>({});
  const [grayscaleState, setGrayscaleState] = useState<{ enabled: boolean; mode: string; keepIds: string[] }>({ enabled: false, mode: 'characters', keepIds: [] });
  const grayscaleRef = useRef<{ enabled: boolean; mode: string; keepIds: string[] }>({ enabled: false, mode: 'characters', keepIds: [] });
  const activeBounceLoops = useRef<Set<string>>(new Set());
  // 非ループバウンスの自動クリーンアップタイマー（終了後にコマンドを消し、シーン再マウントで蒸し返さない）
  const bounceCleanupTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isAdminRef = useRef(false);
  const hideAllRef = useRef(false);
  const hideCharRef = useRef(false);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const broadcastProtectionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingAmbientChanges = useRef<Map<string, Record<string, unknown>>>(new Map());
  const lastDraggedAt = useRef<Map<string, number>>(new Map());
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Tracks which video object IDs admin has actively played (not paused), so we can re-broadcast
  // play commands to late-joining clients (OBS) via request_sync.
  const playingVideoIds = useRef<Set<string>>(new Set());
  // Tracks a pending scene switch so rooms postgres_changes doesn't overwrite the optimistic scene ID
  const pendingRoomSceneRef = useRef<string | null>(null);
  const pendingRoomSceneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // このルームに属するscene IDのセット（他ルームのオブジェクトイベントを無視するためのフィルタ）
  const roomSceneIdsRef = useRef<Set<string>>(new Set());
  // 現在シーンIDをクロージャ外から参照するためのref。
  // これにより object の realtime 購読を roomId 依存に保て、シーン切替ごとの再購読を避けられる。
  const currentSceneIdRef = useRef<string | null>(null);
  const objectRefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch room
  useEffect(() => {
    if (!roomId) return;
    const fetchRoom = async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (data) {
        // If a real-time event (broadcast or postgres_changes) already updated room state
        // before this fetch completed, preserve its current_scene_id — it is more recent
        // than the snapshot the fetch captured when it started.
        setRoom(prev => prev !== null ? { ...data, current_scene_id: prev.current_scene_id } : data);
        const { data: { user } } = await supabase.auth.getUser();
        const admin = user?.id === data.admin_id;
        setIsAdmin(admin);
        isAdminRef.current = admin;
      }
    };
    fetchRoom();
  }, [roomId]);

  // Fetch scenes
  useEffect(() => {
    if (!roomId) return;
    const fetchScenes = async () => {
      const { data } = await supabase
        .from('scenes')
        .select('*')
        .eq('room_id', roomId)
        .order('order_index');
      if (data) {
        setScenes(data);
        // Preload all background images silently
        data.forEach(s => { if (s.background_url) new Image().src = s.background_url; });

        // Unified media preload: objects (images + videos) + BGM + SE
        const sceneIds = data.map(s => s.id);
        if (sceneIds.length > 0) {
          Promise.all([
            supabase.from('objects').select('url, type, object_category, variants').in('scene_id', sceneIds),
            supabase.from('bgm_tracks').select('url').eq('room_id', roomId),
            supabase.from('se_tracks').select('url').eq('room_id', roomId),
          ]).then(([{ data: objs }, { data: bgmRows }, { data: seRows }]) => {
            const seen = new Set<string>();
            const videos: string[] = [];
            const images: string[] = [];
            const audios: string[] = [];

            const addImage = (url: string) => {
              if (url && !seen.has(url)) { seen.add(url); images.push(url); }
            };
            const addVideo = (url: string) => {
              if (url && !seen.has(url)) { seen.add(url); videos.push(url); }
            };
            const addAudio = (url: string) => {
              if (url && !seen.has(url)) { seen.add(url); audios.push(url); }
            };

            (objs ?? []).forEach(o => {
              if (o.type === 'video') { addVideo(o.url); return; }
              if (o.url) addImage(o.url);
              if (o.object_category === 'character_object' && Array.isArray(o.variants)) {
                (o.variants as Array<{ url?: string }>).forEach(v => { if (v.url) addImage(v.url); });
              }
            });
            (bgmRows ?? []).forEach(r => { if (r.url) addAudio(r.url); });
            (seRows ?? []).forEach(r => { if (r.url) addAudio(r.url); });

            const total = videos.length + images.length + audios.length;
            if (total === 0) return;

            let done = 0;
            const onDone = () => {
              done++;
              const label =
                done <= videos.length ? '動画' :
                done <= videos.length + images.length ? '画像' : '音声';
              setMediaPreload({ done, total, label });
              if (done >= total) setTimeout(() => setMediaPreload(null), 1500);
            };

            setMediaPreload({ done: 0, total, label: '動画' });

            preloadEls.current = [];
            videos.forEach(url => {
              const v = document.createElement('video');
              v.preload = 'auto'; v.muted = true; v.src = url;
              preloadEls.current.push(v);
              v.addEventListener('canplay', onDone, { once: true });
              v.addEventListener('error', onDone, { once: true });
            });
            images.forEach(url => {
              const img = new Image(); img.src = url;
              preloadEls.current.push(img);
              img.addEventListener('load', onDone, { once: true });
              img.addEventListener('error', onDone, { once: true });
            });
            audios.forEach(url => {
              const a = new Audio(); a.preload = 'auto'; a.src = url;
              preloadEls.current.push(a);
              a.addEventListener('canplay', onDone, { once: true });
              a.addEventListener('error', onDone, { once: true });
            });
          });
        }
      }
      setLoading(false);
    };
    fetchScenes();
  }, [roomId]);

  // Fetch objects: scene-specific + persistent (character/marker) + embed-like from all scenes.
  // Embed-like objects (url_image etc.) are fetched from all scenes so they stay mounted across
  // scene changes — preventing image reload on every switch.
  useEffect(() => {
    if (!room?.current_scene_id || !roomId) { setObjects([]); return; }
    let cancelled = false;
    const fetchObjects = async () => {
      const { data: roomScenes } = await supabase
        .from('scenes')
        .select('id')
        .eq('room_id', roomId);
      const allSceneIds = roomScenes?.map(s => s.id) ?? [];

      const { data: sceneObjs } = await supabase
        .from('objects')
        .select('*')
        .eq('scene_id', room.current_scene_id!)
        .order('created_at');

      if (cancelled) return;

      const otherSceneIds = allSceneIds.filter(id => id !== room.current_scene_id);
      let otherObjs: SceneObject[] = [];
      if (otherSceneIds.length > 0) {
        const { data } = await supabase
          .from('objects')
          .select('*')
          .in('scene_id', otherSceneIds)
          .order('created_at');
        // Keep character/marker objects (persistent) and embed-like objects (prevent image reload)
        otherObjs = (data ?? []).filter(o =>
          o.object_category === 'character_object' ||
          o.object_category === 'marker_object' ||
          o.type === 'url_image' || o.type === 'embed_object' || o.type === 'iframe_object'
        );
      }

      if (cancelled) return;

      const all = [...(sceneObjs ?? []), ...otherObjs];
      const seen = new Set<string>();
      const deduped = all.filter(o => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });

      setObjects(deduped);
    };
    fetchObjects();
    return () => { cancelled = true; };
  }, [room?.current_scene_id, roomId]);

  // Realtime Broadcast: instant scene switching & break mode for all clients
  useEffect(() => {
    if (!roomId) return;
    const protect = (key: string) => {
      const bp = broadcastProtectionTimers.current;
      const t = bp.get(key);
      if (t) clearTimeout(t);
      bp.set(key, setTimeout(() => bp.delete(key), 1500));
    };

    // オブジェクトINSERT時の再取得（現在シーンはrefから読むので再購読不要）
    let active = true;
    const refetchObjects = () => {
      if (objectRefetchTimer.current) return;
      objectRefetchTimer.current = setTimeout(async () => {
        objectRefetchTimer.current = null;
        if (!active) return;
        const sceneId = currentSceneIdRef.current;
        if (!sceneId) return;
        const { data: roomScenes } = await supabase
          .from('scenes').select('id').eq('room_id', roomId);
        const allSceneIds = roomScenes?.map(s => s.id) ?? [];
        const { data: sceneObjs } = await supabase
          .from('objects').select('*').eq('scene_id', sceneId).order('created_at');
        const otherSceneIds = allSceneIds.filter(id => id !== sceneId);
        let otherObjs: SceneObject[] = [];
        if (otherSceneIds.length > 0) {
          const { data } = await supabase
            .from('objects').select('*').in('scene_id', otherSceneIds).order('created_at');
          otherObjs = (data ?? []).filter(o =>
            o.object_category === 'character_object' ||
            o.object_category === 'marker_object' ||
            o.type === 'url_image' || o.type === 'embed_object' || o.type === 'iframe_object'
          );
        }
        if (!active) return;
        const all = [...(sceneObjs ?? []), ...otherObjs];
        const seen = new Set<string>();
        const deduped = all.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
        setObjects(deduped);
      }, 300);
    };

    const channel = supabase
      .channel(`room-${roomId}`)
      .on('broadcast', { event: 'scene_change' }, (payload) => {
        const { sceneId: newSceneId, visualState } = payload.payload ?? {};
        if (!newSceneId) return;
        setRoom(prev => prev ? { ...prev, current_scene_id: newSceneId } : prev);
        // Apply the sender's visual state snapshot so viewers always see correct effects,
        // even if they missed earlier scene_update broadcasts for this scene.
        if (visualState) {
          setScenes(prev => prev.map(s => s.id === newSceneId ? { ...s, ...visualState } : s));
        }
        // Reset video tracking — stale play commands from the previous scene must not persist
        playingVideoIds.current.clear();
      })
      .on('broadcast', { event: 'break_change' }, (payload) => {
        const isOnBreak = payload.payload?.isOnBreak;
        if (typeof isOnBreak === 'boolean') {
          setRoom(prev => prev ? { ...prev, is_on_break: isOnBreak } : prev);
        }
      })
      .on('broadcast', { event: 'scene_update' }, (payload) => {
        const { sceneId, changes } = payload.payload ?? {};
        if (!sceneId || !changes) return;
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...changes } : s));
        // Protect changed fields from stale postgres_changes echoes for 1.5s
        if ('background_blur' in changes) protect(`scene-blur-${sceneId}`);
        if ('background_brightness' in changes) protect(`scene-brightness-${sceneId}`);
        if ('background_saturation' in changes) protect(`scene-saturation-${sceneId}`);
        if ('scene_effect' in changes) protect(`scene-effect-${sceneId}`);
        if ('ambient_brightness' in changes || 'ambient_saturation' in changes || 'ambient_color' in changes
            || 'ambient_blend_mode' in changes || 'ambient_opacity' in changes) {
          protect(`scene-ambient-${sceneId}`);
        }
      })
      .on('broadcast', { event: 'video_control' }, (payload) => {
        const { objId, action, fadeMs } = payload.payload ?? {};
        if (!objId || !action) return;
        setVideoCommands(prev => ({ ...prev, [objId]: { action, seq: Date.now(), fadeMs: fadeMs ?? undefined } }));
        if (action === 'play') playingVideoIds.current.add(objId);
        else if (action === 'pause') playingVideoIds.current.delete(objId);
      })
      .on('broadcast', { event: 'position_update' }, (payload) => {
        const { objId, x, y, rotation, z_index } = payload.payload ?? {};
        if (!objId) return;
        setObjects(prev => prev.map(o => {
          if (o.id !== objId) return o;
          const update: Record<string, unknown> = {};
          if (x != null) update.x = x;
          if (y != null) update.y = y;
          if (rotation != null) update.rotation = rotation;
          if (z_index != null) update.z_index = z_index;
          return { ...o, ...update };
        }));
      })
      .on('broadcast', { event: 'visibility_filter' }, (payload) => {
        const { hideAll, hideCharacters } = payload.payload ?? {};
        setHideAllObjects(typeof hideAll === 'boolean' ? hideAll : false);
        setHideCharacterObjects(typeof hideCharacters === 'boolean' ? hideCharacters : false);
      })
      .on('broadcast', { event: 'obj_temp_hide' }, (payload) => {
        const { objId } = payload.payload ?? {};
        setTempHiddenId(typeof objId === 'string' ? objId : null);
      })
      .on('broadcast', { event: 'screen_shake' }, (payload) => {
        const { intensity, durationMs, frequency, pattern } = payload.payload ?? {};
        setShakeCommand({
          intensity: typeof intensity === 'number' ? intensity : 12,
          durationMs: typeof durationMs === 'number' ? durationMs : 600,
          frequency: typeof frequency === 'number' ? frequency : 3,
          pattern: typeof pattern === 'string' ? pattern : 'combined',
          seq: Date.now(),
        });
      })
      .on('broadcast', { event: 'screen_flash' }, (payload) => {
        const { color, durationMs, opacity } = payload.payload ?? {};
        setFlashCommand({
          color: typeof color === 'string' ? color : '#ffffff',
          durationMs: typeof durationMs === 'number' ? durationMs : 400,
          opacity: typeof opacity === 'number' ? opacity : 0.8,
          seq: Date.now(),
        });
      })
      .on('broadcast', { event: 'text_overlay' }, (payload) => {
        const { text, position, fontSize, color, durationMs } = payload.payload ?? {};
        setTextOverlayCommand({
          text: typeof text === 'string' ? text : '',
          position: typeof position === 'string' ? position : 'center',
          fontSize: typeof fontSize === 'number' ? fontSize : 64,
          color: typeof color === 'string' ? color : '#ffffff',
          durationMs: typeof durationMs === 'number' ? durationMs : 4000,
          seq: Date.now(),
        });
      })
      .on('broadcast', { event: 'countdown' }, (payload) => {
        const { seconds, position, label, fontSize, alertColor } = payload.payload ?? {};
        setCountdownCommand({
          seconds: typeof seconds === 'number' ? seconds : 10,
          position: typeof position === 'string' ? position : 'center',
          label: typeof label === 'string' ? label : '',
          fontSize: typeof fontSize === 'number' ? fontSize : 200,
          alertColor: typeof alertColor === 'string' ? alertColor : '#ff4444',
          seq: Date.now(),
        });
      })
      .on('broadcast', { event: 'obj_bounce' }, (payload) => {
        const { objectId, stop, loop, count, intensity, durationMs } = payload.payload ?? {};
        if (typeof objectId !== 'string') return;
        const isStop = stop === true;
        const isLoop = loop === true;
        // 既存のクリーンアップタイマーがあれば破棄（新コマンドで仕切り直し）
        const existingTimer = bounceCleanupTimers.current.get(objectId);
        if (existingTimer) { clearTimeout(existingTimer); bounceCleanupTimers.current.delete(objectId); }
        // ループ中に同じボタンを再度押したら停止（トグル）
        if (isStop || (isLoop && activeBounceLoops.current.has(objectId))) {
          activeBounceLoops.current.delete(objectId);
          setBounceCommands(prev => {
            const next = { ...prev };
            delete next[objectId];
            return next;
          });
          return;
        }
        if (isLoop) activeBounceLoops.current.add(objectId);
        else activeBounceLoops.current.delete(objectId);
        const bCount = typeof count === 'number' ? count : 3;
        const bDuration = typeof durationMs === 'number' ? durationMs : 600;
        setBounceCommands(prev => ({
          ...prev,
          [objectId]: {
            stop: false,
            loop: isLoop,
            count: bCount,
            intensity: typeof intensity === 'number' ? intensity : 30,
            durationMs: bDuration,
            seq: Date.now(),
          },
        }));
        // 非ループは再生し終わったらコマンドを除去する（シーン再マウント時の再発火を防ぐ）
        if (!isLoop) {
          const total = bDuration * Math.max(1, bCount) + 100;
          const timer = setTimeout(() => {
            bounceCleanupTimers.current.delete(objectId);
            setBounceCommands(prev => {
              if (!prev[objectId]) return prev;
              const next = { ...prev };
              delete next[objectId];
              return next;
            });
          }, total);
          bounceCleanupTimers.current.set(objectId, timer);
        }
      })
      .on('broadcast', { event: 'grayscale' }, (payload) => {
        const { enabled, mode, keepIds } = payload.payload ?? {};
        const incoming = {
          enabled: typeof enabled === 'boolean' ? enabled : false,
          mode: typeof mode === 'string' ? mode : 'characters',
          keepIds: Array.isArray(keepIds) ? keepIds.filter((x): x is string => typeof x === 'string') : [],
        };
        // 同じ設定でONを再送信したらトグル解除
        const cur = grayscaleRef.current;
        const sameTarget = cur.enabled && cur.mode === incoming.mode
          && cur.keepIds.length === incoming.keepIds.length
          && cur.keepIds.every(id => incoming.keepIds.includes(id));
        const next = (incoming.enabled && sameTarget)
          ? { enabled: false, mode: incoming.mode, keepIds: incoming.keepIds }
          : incoming;
        setGrayscaleState(next);
        grayscaleRef.current = next;
      })
      .on('broadcast', { event: 'request_sync' }, () => {
        // Only admin responds — send current visibility state to the requester
        if (!isAdminRef.current) return;
        broadcastChannelRef.current?.send({
          type: 'broadcast',
          event: 'visibility_filter',
          payload: { hideAll: hideAllRef.current, hideCharacters: hideCharRef.current },
        });
        if (grayscaleRef.current.enabled) {
          broadcastChannelRef.current?.send({
            type: 'broadcast',
            event: 'grayscale',
            payload: grayscaleRef.current,
          });
        }
        // Re-broadcast play commands for all currently playing videos so late-joining
        // clients (OBS) receive the correct playback state.
        // Read playingVideoIds.current inside the timeout so a scene switch that
        // clears the set during the delay is respected (no stale commands sent).
        setTimeout(() => {
          for (const objId of playingVideoIds.current) {
            broadcastChannelRef.current?.send({
              type: 'broadcast',
              event: 'video_control',
              payload: { objId, action: 'play' },
            });
          }
        }, 300);
      })
      // --- postgres_changes（旧 room-changes / scene-changes / object-changes を統合）---
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`,
      }, (payload: RealtimePostgresChangesPayload<Room>) => {
        if (payload.new && 'id' in payload.new) {
          const incoming = payload.new as Room;
          // シーン切替中は楽観的 current_scene_id を保持し、無関係な更新(is_on_break等)で上書きしない
          if (pendingRoomSceneRef.current) {
            setRoom(prev => prev ? { ...incoming, current_scene_id: pendingRoomSceneRef.current } : incoming);
          } else {
            setRoom(incoming);
          }
        }
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'scenes', filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new && 'id' in payload.new) {
          const incoming = payload.new as Scene;
          setScenes(prev => prev.map(s => {
            if (s.id !== incoming.id) return s;
            // 視覚エフェクト系はbroadcastで管理。postgres_changesのstaleな値で上書きしない
            const sAny = s as typeof s & { ambient_blend_mode?: string; ambient_opacity?: number };
            return {
              ...incoming,
              background_blur: s.background_blur,
              background_brightness: s.background_brightness,
              background_saturation: s.background_saturation,
              scene_effect: s.scene_effect,
              ambient_brightness: s.ambient_brightness,
              ambient_saturation: s.ambient_saturation,
              ambient_color: s.ambient_color,
              ambient_blend_mode: sAny.ambient_blend_mode,
              ambient_opacity: sAny.ambient_opacity,
            } as Scene;
          }));
        } else {
          supabase.from('scenes').select('*').eq('room_id', roomId).order('order_index')
            .then(({ data }) => { if (data) setScenes(data); });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'objects',
      }, (payload) => {
        if (payload.new && 'id' in payload.new) {
          const incoming = payload.new as SceneObject;
          if (!roomSceneIdsRef.current.has(incoming.scene_id)) return;
          setObjects(prev => prev.map(o => {
            if (o.id !== incoming.id) return o;
            const t = lastDraggedAt.current.get(o.id) ?? 0;
            if (Date.now() - t < 1500) {
              return { ...incoming, x: o.x, y: o.y };
            }
            return incoming;
          }));
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'objects',
      }, (payload) => {
        if (payload.old && 'id' in payload.old) {
          setObjects(prev => prev.filter(o => o.id !== (payload.old as SceneObject).id));
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'objects',
      }, (payload) => {
        if (payload.new && 'scene_id' in payload.new) {
          if (!roomSceneIdsRef.current.has((payload.new as SceneObject).scene_id)) return;
        }
        refetchObjects();
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        // Request current state from admin after joining.
        // 800ms gives OBS browser sources enough time to mount video elements.
        setTimeout(() => {
          channel.send({ type: 'broadcast', event: 'request_sync', payload: {} });
        }, 800);
      });
    broadcastChannelRef.current = channel;
    return () => {
      active = false;
      supabase.removeChannel(channel);
      broadcastChannelRef.current = null;
      if (objectRefetchTimer.current) {
        clearTimeout(objectRefetchTimer.current);
        objectRefetchTimer.current = null;
      }
      bounceCleanupTimers.current.forEach(t => clearTimeout(t));
      bounceCleanupTimers.current.clear();
    };
  }, [roomId]);

  // Keep visibility refs in sync for use inside broadcast closures
  useEffect(() => { hideAllRef.current = hideAllObjects; }, [hideAllObjects]);
  useEffect(() => { hideCharRef.current = hideCharacterObjects; }, [hideCharacterObjects]);
  // Keep roomSceneIds ref in sync
  useEffect(() => { roomSceneIdsRef.current = new Set(scenes.map(s => s.id)); }, [scenes]);
  // Keep current scene id ref in sync（統合チャンネル内のobject購読がクロージャでなくrefで現在シーンを参照するため）
  useEffect(() => { currentSceneIdRef.current = room?.current_scene_id ?? null; }, [room?.current_scene_id]);

  // ※ rooms / scenes / objects の postgres_changes 購読は上の統合チャンネル(room-${roomId})に集約済み。

  // Optimistic scene switch: update UI immediately, broadcast, then save to DB
  const switchScene = useCallback(async (sceneId: string) => {
    if (!roomId) return;

    // 1. Optimistic local update
    setRoom(prev => prev ? { ...prev, current_scene_id: sceneId } : prev);

    // Clear playing video tracking — the new scene starts with no playing videos,
    // so request_sync responses won't re-send stale commands from the previous scene.
    playingVideoIds.current.clear();

    // 2. Mark pending switch — rooms postgres_changes from unrelated writes won't
    //    overwrite the optimistic scene ID while this timer is active.
    if (pendingRoomSceneTimer.current) clearTimeout(pendingRoomSceneTimer.current);
    pendingRoomSceneRef.current = sceneId;
    pendingRoomSceneTimer.current = setTimeout(() => {
      pendingRoomSceneRef.current = null;
    }, 3000);

    // 3. Broadcast via subscribed channel, including the target scene's visual state
    //    so late-joining viewers or clients that missed prior scene_update broadcasts
    //    always see the correct effects immediately.
    const target = scenes.find(s => s.id === sceneId);
    const t = target as (typeof target & { ambient_blend_mode?: string; ambient_opacity?: number }) | undefined;
    const visualState = t ? {
      background_blur: t.background_blur,
      background_brightness: t.background_brightness,
      background_saturation: t.background_saturation,
      scene_effect: t.scene_effect,
      ambient_brightness: t.ambient_brightness,
      ambient_saturation: t.ambient_saturation,
      ambient_color: t.ambient_color,
      ambient_blend_mode: t.ambient_blend_mode,
      ambient_opacity: t.ambient_opacity,
    } : undefined;
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'scene_change',
      payload: { sceneId, visualState },
    });

    // 4. Persist to DB and surface any failure
    const { error } = await supabase.from('rooms').update({ current_scene_id: sceneId }).eq('id', roomId);
    if (error) {
      toast.error('シーン切り替えの保存に失敗しました');
      console.error('switchScene DB error:', error);
    }
    pendingRoomSceneRef.current = null;
    if (pendingRoomSceneTimer.current) {
      clearTimeout(pendingRoomSceneTimer.current);
      pendingRoomSceneTimer.current = null;
    }
  }, [roomId, scenes]);

  const createScene = useCallback(async (name: string) => {
    if (!roomId) return null;
    const nextIndex = scenes.length;
    const { data } = await supabase
      .from('scenes')
      .insert({ room_id: roomId, name, order_index: nextIndex })
      .select()
      .single();
    if (data) setScenes(prev => [...prev, data]);
    return data;
  }, [roomId, scenes.length]);

  const deleteScene = useCallback(async (sceneId: string) => {
    // Relocate character/marker objects before deleting — DB has CASCADE DELETE on scene_id
    const remaining = scenes.filter(s => s.id !== sceneId);
    if (remaining.length > 0) {
      await supabase
        .from('objects')
        .update({ scene_id: remaining[0].id })
        .eq('scene_id', sceneId)
        .in('object_category', ['character_object', 'marker_object']);
    }

    // Optimistic: remove from local state immediately
    setScenes(prev => {
      const updated = prev.filter(s => s.id !== sceneId);
      // If deleted scene was current, switch to first remaining or null
      if (room?.current_scene_id === sceneId) {
        const next = updated.length > 0 ? updated[0].id : null;
        setRoom(r => r ? { ...r, current_scene_id: next } : r);
        if (next && roomId) {
          supabase.from('rooms').update({ current_scene_id: next }).eq('id', roomId);
        }
      }
      return updated;
    });
    await supabase.from('scenes').delete().eq('id', sceneId);
  }, [room?.current_scene_id, roomId, scenes]);

  const reorderScene = useCallback(async (sceneId: string, direction: 'up' | 'down') => {
    const current = [...scenes];
    const idx = current.findIndex(s => s.id === sceneId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= current.length) return;
    [current[idx], current[swapIdx]] = [current[swapIdx], current[idx]];
    const updated = current.map((s, i) => ({ ...s, order_index: i }));
    setScenes(updated);
    await Promise.all(updated.map((s, i) =>
      supabase.from('scenes').update({ order_index: i }).eq('id', s.id)
    ));
  }, [scenes]);

  // シーン複製: シーン本体＋そのシーン専用オブジェクト(セット/動画/url_image)を丸ごとコピー。
  // character/marker は全シーン共通なので複製しない。
  const duplicateScene = useCallback(async (sceneId: string) => {
    if (!roomId) return null;
    const src = scenes.find(s => s.id === sceneId);
    if (!src) return null;
    const { id: _id, created_at: _c, updated_at: _u, ...sceneCopy } = src as Record<string, unknown>;
    const { data: newScene } = await supabase
      .from('scenes')
      .insert({ ...sceneCopy, name: `${src.name} のコピー`, order_index: scenes.length } as never)
      .select()
      .single();
    if (!newScene) return null;
    setScenes(prev => [...prev, newScene]);
    // 元シーン専用のオブジェクトをコピー（character/markerは除外）
    const { data: srcObjs } = await supabase
      .from('objects').select('*').eq('scene_id', sceneId);
    const toCopy = (srcObjs ?? []).filter(o =>
      o.object_category !== 'character_object' && o.object_category !== 'marker_object');
    if (toCopy.length > 0) {
      const rows = toCopy.map(o => {
        const { id: _oid, created_at: _oc, updated_at: _ou, ...rest } = o as Record<string, unknown>;
        return { ...rest, scene_id: newScene.id };
      });
      await supabase.from('objects').insert(rows as never);
    }
    return newScene;
  }, [roomId, scenes]);

  const updateSceneBackground = useCallback(async (sceneId: string, url: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, background_url: url } : s));
    if (url) new Image().src = url;
    await supabase.from('scenes').update({ background_url: url }).eq('id', sceneId);
  }, []);

  const updateSceneSubBackground = useCallback(async (sceneId: string, url: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, sub_background_url: url || null } as Scene : s));
    if (url) new Image().src = url;
    await supabase.from('scenes').update({ sub_background_url: url || null } as never).eq('id', sceneId);
  }, []);

  const broadcastVideoControl = useCallback((objId: string, action: 'play' | 'pause', fadeMs?: number) => {
    // Admin tracks playing videos locally so request_sync can re-broadcast to late joiners
    if (action === 'play') playingVideoIds.current.add(objId);
    else if (action === 'pause') playingVideoIds.current.delete(objId);
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'video_control',
      payload: { objId, action, fadeMs },
    });
    // Supabase does not echo broadcasts back to the sender, so apply the command
    // locally so the admin's own video element reacts (e.g. play_on_scene auto-play).
    setVideoCommands(prev => ({ ...prev, [objId]: { action, seq: Date.now(), fadeMs } }));
  }, []);

  const roomBroadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    broadcastChannelRef.current?.send({ type: 'broadcast', event, payload });
  }, []);

  const broadcastSceneUpdate = useCallback((sceneId: string, changes: Record<string, unknown>) => {
    broadcastChannelRef.current?.send({
      type: 'broadcast',
      event: 'scene_update',
      payload: { sceneId, changes },
    });
  }, []);

  const updateSceneBlur = useCallback((sceneId: string, blur: number) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, background_blur: blur } : s));
    const key = `scene-blur-${sceneId}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(key, setTimeout(() => {
      debounceTimers.current.delete(key);
      supabase.from('scenes').update({ background_blur: blur }).eq('id', sceneId);
      broadcastSceneUpdate(sceneId, { background_blur: blur });
    }, 300));
  }, [broadcastSceneUpdate]);

  const updateSceneBrightness = useCallback((sceneId: string, brightness: number) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, background_brightness: brightness } : s));
    const key = `scene-brightness-${sceneId}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(key, setTimeout(() => {
      debounceTimers.current.delete(key);
      supabase.from('scenes').update({ background_brightness: brightness }).eq('id', sceneId);
      broadcastSceneUpdate(sceneId, { background_brightness: brightness });
    }, 300));
  }, [broadcastSceneUpdate]);

  const updateSceneSaturation = useCallback((sceneId: string, saturation: number) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, background_saturation: saturation } : s));
    const key = `scene-saturation-${sceneId}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(key, setTimeout(() => {
      debounceTimers.current.delete(key);
      supabase.from('scenes').update({ background_saturation: saturation }).eq('id', sceneId);
      broadcastSceneUpdate(sceneId, { background_saturation: saturation });
    }, 300));
  }, [broadcastSceneUpdate]);

  const updateSceneEffect = useCallback(async (sceneId: string, effect: string) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, scene_effect: effect } : s));
    broadcastSceneUpdate(sceneId, { scene_effect: effect });
    await supabase.from('scenes').update({ scene_effect: effect }).eq('id', sceneId);
  }, [broadcastSceneUpdate]);

  const updateAmbientSettings = useCallback((sceneId: string, settings: {
    ambient_brightness?: number;
    ambient_saturation?: number;
    ambient_color?: string;
    ambient_blend_mode?: string;
    ambient_opacity?: number;
  }) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...settings } : s));
    broadcastSceneUpdate(sceneId, settings as Record<string, unknown>);
    // Accumulate all ambient changes so partial updates (e.g. color only, then brightness only)
    // are all written together when the debounce fires.
    const accumulated = pendingAmbientChanges.current.get(sceneId) ?? {};
    pendingAmbientChanges.current.set(sceneId, { ...accumulated, ...settings });
    const key = `scene-ambient-${sceneId}`;
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(key, setTimeout(async () => {
      debounceTimers.current.delete(key);
      const allChanges = pendingAmbientChanges.current.get(sceneId) ?? {};
      pendingAmbientChanges.current.delete(sceneId);
      const { error } = await supabase.from('scenes').update(allChanges as never).eq('id', sceneId);
      if (error) console.error('[updateAmbientSettings] アンビエント設定の保存に失敗:', error.message);
    }, 300));
  }, [broadcastSceneUpdate]);

  const toggleBreak = useCallback(async (on: boolean) => {
    if (!roomId) return;
    setRoom(prev => prev ? { ...prev, is_on_break: on } : prev);
    roomBroadcast('break_change', { isOnBreak: on });
    await supabase.from('rooms').update({ is_on_break: on }).eq('id', roomId);
  }, [roomId]);

  const addObject = useCallback(async (obj: {
    scene_id: string; type: string; name: string; url: string;
    width?: number; height?: number; object_category?: string;
    x?: number; y?: number;
    variants?: { url: string; label: string }[]; current_variant_index?: number;
  }) => {
    const maxZ = objects.reduce((max, o) => Math.max(max, o.z_index ?? 0), 0);
    const { data } = await supabase
      .from('objects')
      .insert({ ...obj, z_index: maxZ + 1 })
      .select()
      .single();
    // Optimistically add to local state immediately — don't wait for postgres_changes INSERT
    if (data) setObjects(prev => prev.some(o => o.id === data.id) ? prev : [...prev, data]);
    return data;
  }, [objects]);

  // オブジェクト複製: 同じシーンに少しずらして複製する
  const duplicateObject = useCallback(async (objectId: string) => {
    const src = objects.find(o => o.id === objectId);
    if (!src) return null;
    const maxZ = objects.reduce((max, o) => Math.max(max, o.z_index ?? 0), 0);
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = src as Record<string, unknown>;
    const { data } = await supabase
      .from('objects')
      .insert({
        ...rest,
        name: `${src.name} のコピー`,
        x: (src.x ?? 0) + 30,
        y: (src.y ?? 0) + 30,
        z_index: maxZ + 1,
      } as never)
      .select()
      .single();
    if (data) setObjects(prev => prev.some(o => o.id === data.id) ? prev : [...prev, data]);
    return data;
  }, [objects]);

  const localUpdateObject = useCallback((id: string, updates: Record<string, unknown>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } as SceneObject : o));
  }, []);

  const updateObject = useCallback(async (id: string, updates: Record<string, unknown>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } as SceneObject : o));
    lastDraggedAt.current.set(id, Date.now());
    const existing = debounceTimers.current.get(id);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(id, setTimeout(async () => {
      debounceTimers.current.delete(id);
      await supabase.from('objects').update(updates as SceneObjectUpdate).eq('id', id);
    }, 200));
  }, []);

  const updateObjectImmediate = useCallback(async (id: string, updates: Record<string, unknown>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } as SceneObject : o));
    await supabase.from('objects').update(updates as SceneObjectUpdate).eq('id', id);
  }, []);

  const deleteObject = useCallback(async (id: string) => {
    setObjects(prev => prev.filter(o => o.id !== id));
    await supabase.from('objects').delete().eq('id', id);
  }, []);

  return {
    room, scenes, objects, loading, isAdmin,
    switchScene, createScene, deleteScene, duplicateScene, updateSceneBackground, updateSceneSubBackground, updateSceneBlur, updateSceneBrightness, updateSceneSaturation, updateSceneEffect, updateAmbientSettings, reorderScene,
    addObject, updateObject, updateObjectImmediate, localUpdateObject, deleteObject, duplicateObject,
    toggleBreak,
    videoCommands, broadcastVideoControl,
    roomBroadcast,
    tempHiddenId,
    hideAllObjects, setHideAllObjects, hideCharacterObjects, setHideCharacterObjects,
    mediaPreload,
    shakeCommand,
    flashCommand, textOverlayCommand, countdownCommand, bounceCommands, grayscaleState,
  };
}
