import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
import { useBgm } from '@/hooks/useBgm';
import { useSePlayer } from '@/hooks/useSePlayer';
import { useMasterVolume } from '@/hooks/useMasterVolume';
import { useRoomAssets, RoomAsset } from '@/hooks/useRoomAssets';

import { AuthScreen } from '@/components/AuthScreen';
import { TopBar } from '@/components/TopBar';
import { ScenePanel } from '@/components/ScenePanel';
import { CanvasBoard } from '@/components/CanvasBoard';
import { InspectorPanel } from '@/components/InspectorPanel';
import { ObjectContextMenu } from '@/components/ObjectContextMenu';
import { BgmPanel } from '@/components/BgmPanel';
import { SePanel } from '@/components/SePanel';
import { AssetLibrary } from '@/components/AssetLibrary';
import { PersistentObjectPanel, PanelCategory } from '@/components/PersistentObjectPanel';
import { Slider } from '@/components/ui/slider';
import { Music, Zap, Volume2, X, Eye, EyeOff, Image, Sun, Palette, RotateCcw, Sparkles, Coffee, ChevronLeft, ChevronRight, UserX, Layers, Monitor } from 'lucide-react';

const DEFAULT_FADE_DURATION = 0.3;

export default function BoardPage() {
  const { session, loading: authLoading, signOut, user } = useAuth();
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ objId: string; x: number; y: number } | null>(null);
  const [fadeDuration, setFadeDuration] = useState(DEFAULT_FADE_DURATION);
  const [activePanel, setActivePanel] = useState<'volume' | 'blur' | 'effect' | 'bgm' | 'se' | 'asset' | null>(null);
  const togglePanel = (panel: 'volume' | 'blur' | 'effect' | 'bgm' | 'se' | 'asset') =>
    setActivePanel(prev => prev === panel ? null : panel);
  const [persistentPanel, setPersistentPanel] = useState<PanelCategory | null>(null);
  const [showScenePanel, setShowScenePanel] = useState(true);
  const [showInspectorPanel, setShowInspectorPanel] = useState(true);
  const [dropCategoryPicker, setDropCategoryPicker] = useState<{ assetJson: string; x: number; y: number } | null>(null);
  // スクリーンモード: 0=OFF / 1=メイン盤面を囲う / 2=サブ盤面を囲う
  const [screenMode, setScreenMode] = useState<0 | 1 | 2>(0);

  const { masterVolume, setMasterVolume } = useMasterVolume();

  const {
    room, scenes, objects, loading, isAdmin,
    switchScene, createScene, deleteScene, duplicateScene, updateSceneBackground, updateSceneSubBackground, updateSceneBlur, updateSceneBrightness, updateSceneSaturation, updateSceneEffect, updateAmbientSettings, reorderScene,
    addObject, updateObject, updateObjectImmediate, localUpdateObject, deleteObject, duplicateObject,
    toggleBreak, videoCommands, broadcastVideoControl,
    roomBroadcast,
    tempHiddenId,
    hideAllObjects, setHideAllObjects, hideCharacterObjects, setHideCharacterObjects,
    mediaPreload, shakeCommand,
    flashCommand, textOverlayCommand, countdownCommand, bounceCommands, grayscaleState,
  } = useRoom(roomId ?? null);

  const bgm = useBgm(roomId ?? null, room?.current_scene_id ?? null, masterVolume, isAdmin);
  const se = useSePlayer(roomId ?? null, masterVolume);
  const assetLib = useRoomAssets(roomId ?? null);

  // Restore admin's visibility state from localStorage on load, then re-broadcast to viewers
  const visRestoredRef = useRef(false);
  useEffect(() => {
    if (!isAdmin || !roomId || visRestoredRef.current) return;
    visRestoredRef.current = true;
    const savedHideAll = localStorage.getItem(`hideAll_${roomId}`) === 'true';
    const savedHideChar = localStorage.getItem(`hideChar_${roomId}`) === 'true';
    if (savedHideAll || savedHideChar) {
      setHideAllObjects(savedHideAll);
      setHideCharacterObjects(savedHideChar);
      // Re-broadcast after channel is ready so connected viewers also sync
      setTimeout(() => {
        roomBroadcast('visibility_filter', { hideAll: savedHideAll, hideCharacters: savedHideChar });
      }, 800);
    }
  }, [isAdmin, roomId]);

  // Persist admin's visibility state to localStorage on every change
  useEffect(() => {
    if (!isAdmin || !roomId) return;
    localStorage.setItem(`hideAll_${roomId}`, String(hideAllObjects));
    localStorage.setItem(`hideChar_${roomId}`, String(hideCharacterObjects));
  }, [isAdmin, roomId, hideAllObjects, hideCharacterObjects]);

  // Preload library images so scene switches and first reveals are instant.
  // Scene backgrounds are already preloaded inside useRoom; this covers object/character assets.
  useEffect(() => {
    for (const asset of assetLib.assets) {
      if (asset.category === 'video') continue;
      const img = document.createElement('img');
      img.src = asset.url;
    }
  }, [assetLib.assets]);

  const handleSetBackground = useCallback(async (sceneId: string, url: string | null) => {
    await updateSceneBackground(sceneId, url ?? '');
  }, [updateSceneBackground]);

  const handleSetSubBackground = useCallback(async (sceneId: string, url: string | null) => {
    await updateSceneSubBackground(sceneId, url ?? '');
  }, [updateSceneSubBackground]);

  const handleAddObject = useCallback(async (obj: {
    type: string; name: string; url: string; width?: number; height?: number; object_category?: string;
  }) => {
    if (!room?.current_scene_id) return;
    await addObject({ scene_id: room.current_scene_id, ...obj });
  }, [room?.current_scene_id, addObject]);

  // 複数アセットから表情差分付きキャラクターを1体作成
  const handleCreateCharacterFromAssets = useCallback(async (assets: RoomAsset[]) => {
    if (!room?.current_scene_id || assets.length === 0) return;
    const variants = assets.map(a => ({ url: a.url, label: a.name }));
    await addObject({
      scene_id: room.current_scene_id,
      type: 'image',
      name: assets[0].name,
      url: assets[0].url,
      width: 400,
      height: 400,
      object_category: 'character_object',
      variants,
      current_variant_index: 0,
    });
  }, [room?.current_scene_id, addObject]);

  const handleAddAssetToScene = useCallback(async (asset: RoomAsset) => {
    if (!room?.current_scene_id) return;
    if (asset.category === 'background') {
      await updateSceneBackground(room.current_scene_id, asset.url);
      return;
    }
    await addObject({
      scene_id: room.current_scene_id,
      type: asset.category === 'video' ? 'video' : 'image',
      name: asset.name,
      url: asset.url,
      width: 400,
      height: 400,
      object_category: asset.category === 'character' ? 'character_object' : 'scene_object',
    });
  }, [room?.current_scene_id, addObject, updateSceneBackground]);

  const handleSwitchScene = useCallback(async (sceneId: string) => {
    if (!isAdmin) return;
    await switchScene(sceneId);
    // Auto-play videos with play_on_scene enabled in the new scene.
    // Delay slightly so the scene_change broadcast reaches viewers before play commands.
    const playOnScene = objects.filter(
      o => o.scene_id === sceneId && o.type === 'video' && o.play_on_scene
    );
    if (playOnScene.length > 0) {
      setTimeout(() => {
        playOnScene.forEach(o => broadcastVideoControl(o.id, 'play'));
      }, 150);
    }
  }, [isAdmin, switchScene, objects, broadcastVideoControl]);

  const handleContextMenu = useCallback((objId: string, x: number, y: number) => {
    setContextMenu({ objId, x, y });
    setSelectedObjectId(objId);
  }, []);

  const handleDragMove = useCallback((id: string, x: number, y: number, rotation?: number, z_index?: number) => {
    roomBroadcast('position_update', { objId: id, x, y, ...(rotation != null && { rotation }), ...(z_index != null && { z_index }) });
  }, [roomBroadcast]);

  const handleTempHide = useCallback((objId: string | null) => {
    roomBroadcast('obj_temp_hide', { objId });
  }, [roomBroadcast]);

  const handleDropAsset = useCallback(async (assetJson: string, worldX: number, worldY: number) => {
    if (!room?.current_scene_id) return;
    const asset = JSON.parse(assetJson) as RoomAsset;
    if (asset.category === 'character') {
      await addObject({
        scene_id: room.current_scene_id,
        type: 'image',
        name: asset.name,
        url: asset.url,
        x: worldX - 200,
        y: worldY - 200,
        width: 400,
        height: 400,
        object_category: 'character_object',
      });
    } else if (asset.category === 'video') {
      await addObject({
        scene_id: room.current_scene_id,
        type: 'video',
        name: asset.name,
        url: asset.url,
        x: worldX - 200,
        y: worldY - 200,
        width: 400,
        height: 400,
        object_category: 'scene_object',
      });
    } else {
      // 'object' category — show picker
      setDropCategoryPicker({ assetJson, x: worldX, y: worldY });
    }
  }, [room?.current_scene_id, addObject]);

  const handleDropCategorySelect = useCallback(async (category: 'scene_object' | 'marker_object') => {
    if (!dropCategoryPicker || !room?.current_scene_id) return;
    const asset = JSON.parse(dropCategoryPicker.assetJson) as RoomAsset;
    await addObject({
      scene_id: room.current_scene_id,
      type: 'image',
      name: asset.name,
      url: asset.url,
      x: dropCategoryPicker.x - 200,
      y: dropCategoryPicker.y - 200,
      width: 400,
      height: 400,
      object_category: category,
    });
    setDropCategoryPicker(null);
  }, [dropCategoryPicker, room?.current_scene_id, addObject]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">ルーム準備中...</div>
      </div>
    );
  }

  const currentScene = scenes.find(s => s.id === room.current_scene_id) ?? null;

  const currentSceneBlur = currentScene?.background_blur ?? 0;
  const currentSceneBrightness = currentScene?.background_brightness ?? 100;
  const currentSceneSaturation = currentScene?.background_saturation ?? 100;
  const currentSceneEffect = currentScene?.scene_effect ?? 'none';
  const ambientBrightness = currentScene?.ambient_brightness ?? 100;
  const ambientSaturation = currentScene?.ambient_saturation ?? 100;
  const ambientColor = currentScene?.ambient_color ?? '#1b3a5c';
  const ambientBlendMode = ((currentScene as Record<string, unknown> | null)?.ambient_blend_mode as string) ?? 'multiply';
  const ambientOpacity = ((currentScene as Record<string, unknown> | null)?.ambient_opacity as number | undefined) ?? 0.25;
  const isOnBreak = room.is_on_break ?? false;
  const blurPx = (currentSceneBlur / 100) * 20;
  const selectedObject = objects.find(o => o.id === selectedObjectId) ?? null;
  const contextObj = contextMenu ? objects.find(o => o.id === contextMenu.objId) ?? null : null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar
        roomName={room.name}
        roomId={roomId ?? null}
        isAdmin={isAdmin}
        currentSceneId={room.current_scene_id}
        shareToken={room.share_token}
        onAddObject={handleAddObject}
        onSignOut={signOut}
        onBackToRooms={() => navigate('/')}
        onOpenScenePanel={() => setPersistentPanel(prev => prev === 'scene_object' ? null : 'scene_object')}
        onOpenCharacterPanel={() => setPersistentPanel(prev => prev === 'character_object' ? null : 'character_object')}
        onOpenMarkerPanel={() => setPersistentPanel(prev => prev === 'marker_object' ? null : 'marker_object')}
        onOpenVideoPanel={() => setPersistentPanel(prev => prev === 'video' ? null : 'video')}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Scene panel + collapse toggle */}
        <div className="flex h-full flex-shrink-0">
          {showScenePanel && (
            <ScenePanel
              scenes={scenes}
              currentSceneId={room.current_scene_id}
              isAdmin={isAdmin}
              backgroundAssets={assetLib.assets.filter(a => a.category === 'background')}
              onSwitchScene={handleSwitchScene}
              onCreateScene={createScene}
              onDeleteScene={deleteScene}
              onDuplicateScene={duplicateScene}
              onSetBackground={handleSetBackground}
              onSetSubBackground={handleSetSubBackground}
              onReorderScene={reorderScene}
            />
          )}
          <button
            onClick={() => setShowScenePanel(p => !p)}
            className="w-4 h-full flex items-center justify-center bg-card/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={showScenePanel ? 'シーンパネルを隠す' : 'シーンパネルを表示'}
          >
            {showScenePanel ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        <CanvasBoard
          scene={currentScene}
          objects={objects}
          selectedObjectId={selectedObjectId}
          isAdmin={isAdmin}
          fadeDuration={fadeDuration}
          backgroundBlur={blurPx}
          backgroundBrightness={currentSceneBrightness}
          backgroundSaturation={currentSceneSaturation}
          sceneEffect={currentSceneEffect}
          isOnBreak={isOnBreak}
          onSelectObject={setSelectedObjectId}
          onUpdateObject={updateObject}
          onLocalUpdateObject={localUpdateObject}
          onDeleteObject={deleteObject}
          onContextMenu={handleContextMenu}
          onDropAsset={handleDropAsset}
          videoCommands={videoCommands}
          onVideoControl={broadcastVideoControl}
          onDragMove={isAdmin ? handleDragMove : undefined}
          hideAllObjects={hideAllObjects}
          hideCharacterObjects={hideCharacterObjects}
          screenMode={screenMode}
          onPresetChange={(preset) => setScreenMode(prev => prev === 0 ? prev : preset)}
          masterVolume={masterVolume}
          shakeCommand={shakeCommand}
          flashCommand={flashCommand}
          textOverlayCommand={textOverlayCommand}
          countdownCommand={countdownCommand}
          bounceCommands={bounceCommands}
          grayscaleState={grayscaleState}
          tempHiddenId={tempHiddenId}
          onTempHide={isAdmin ? handleTempHide : undefined}
        />

        {/* Inspector panel + collapse toggle */}
        <div className="flex h-full flex-shrink-0">
          <button
            onClick={() => setShowInspectorPanel(p => !p)}
            className="w-4 h-full flex items-center justify-center bg-card/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={showInspectorPanel ? 'インスペクターを隠す' : 'インスペクターを表示'}
          >
            {showInspectorPanel ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
          {showInspectorPanel && (
            <InspectorPanel
              selectedObject={selectedObject}
              objects={objects}
              isAdmin={isAdmin}
              variantAssets={assetLib.assets.filter(a => a.category === 'character' || a.category === 'object')}
              onUpdateObject={updateObjectImmediate}
              onDeleteObject={deleteObject}
              onSelectObject={setSelectedObjectId}
            />
          )}
        </div>
      </div>

      {/* Floating button column — overlaps canvas area, left of InspectorPanel */}
      <div className={`fixed bottom-4 z-50 flex flex-col gap-2 items-end ${showInspectorPanel ? 'right-[292px]' : 'right-5'}`}>
        {/* Small inline panels — appear above buttons, extend leftward */}
        {activePanel === 'blur' && (
          <div className="glass-panel p-3 w-56 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Eye size={14} className="text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground w-10">ぼかし</span>
              <Slider value={[currentSceneBlur]} min={0} max={100} step={1}
                onValueChange={([v]) => { if (room.current_scene_id) updateSceneBlur(room.current_scene_id, v); }}
                className="flex-1" />
              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{currentSceneBlur}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Sun size={14} className="text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground w-10">明暗</span>
              <Slider value={[currentSceneBrightness]} min={0} max={200} step={1}
                onValueChange={([v]) => { if (room.current_scene_id) updateSceneBrightness(room.current_scene_id, v); }}
                className="flex-1" />
              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{currentSceneBrightness}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Palette size={14} className="text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground w-10">彩度</span>
              <Slider value={[currentSceneSaturation]} min={0} max={200} step={1}
                onValueChange={([v]) => { if (room.current_scene_id) updateSceneSaturation(room.current_scene_id, v); }}
                className="flex-1" />
              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{currentSceneSaturation}%</span>
            </div>
            {(currentSceneBlur !== 0 || currentSceneBrightness !== 100 || currentSceneSaturation !== 100) && (
              <button
                onClick={() => { if (room.current_scene_id) { updateSceneBlur(room.current_scene_id, 0); updateSceneBrightness(room.current_scene_id, 100); updateSceneSaturation(room.current_scene_id, 100); } }}
                className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border mt-1"
              >
                <RotateCcw size={10} />リセット
              </button>
            )}
          </div>
        )}
        {activePanel === 'volume' && (
          <div className="glass-panel p-3 w-56 flex items-center gap-2">
            <Volume2 size={14} className="text-muted-foreground shrink-0" />
            <Slider value={[masterVolume * 100]} min={0} max={100} step={1}
              onValueChange={([v]) => setMasterVolume(v / 100)} className="flex-1" />
            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
        )}
        {activePanel === 'effect' && (
          <div className="glass-panel p-3 w-56 flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground font-medium mb-1">盤面エフェクト</span>
            {[
              { key: 'none', label: 'なし' },
              { key: 'sepia', label: 'セピア' },
              { key: 'invert', label: '色反転' },
              { key: 'darken', label: '暗転' },
              { key: 'ambient', label: 'アンビエント' },
            ].map(({ key, label }) => (
              <button key={key}
                onClick={() => { if (room.current_scene_id) updateSceneEffect(room.current_scene_id, key); }}
                className={`text-[11px] px-3 py-1.5 text-left rounded transition-colors ${currentSceneEffect === key ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary/60'}`}
              >{label}</button>
            ))}
            {currentSceneEffect === 'ambient' && (
              <div className="mt-2 pt-2 border-t border-border flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Sun size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground w-8">明暗</span>
                  <Slider value={[ambientBrightness]} min={20} max={180} step={1}
                    onValueChange={([v]) => { if (room.current_scene_id) updateAmbientSettings(room.current_scene_id, { ambient_brightness: v }); }}
                    className="flex-1" />
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{ambientBrightness}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Palette size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground w-8">彩度</span>
                  <Slider value={[ambientSaturation]} min={0} max={200} step={1}
                    onValueChange={([v]) => { if (room.current_scene_id) updateAmbientSettings(room.current_scene_id, { ambient_saturation: v }); }}
                    className="flex-1" />
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{ambientSaturation}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-14">色味</span>
                  <input type="color" value={ambientColor}
                    onChange={(e) => { if (room.current_scene_id) updateAmbientSettings(room.current_scene_id, { ambient_color: e.target.value }); }}
                    className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0" />
                  <span className="text-[10px] text-muted-foreground">{ambientColor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-14">合成</span>
                  <select value={ambientBlendMode}
                    onChange={(e) => { if (room.current_scene_id) updateAmbientSettings(room.current_scene_id, { ambient_blend_mode: e.target.value }); }}
                    className="flex-1 bg-secondary/40 border border-border rounded px-1 py-1 text-[10px] text-foreground">
                    <option value="normal">通常</option>
                    <option value="multiply">乗算</option>
                    <option value="screen">スクリーン</option>
                    <option value="overlay">オーバーレイ</option>
                    <option value="soft-light">ソフトライト</option>
                    <option value="hard-light">ハードライト</option>
                    <option value="color-dodge">覆い焼き</option>
                    <option value="color-burn">焼き込み</option>
                    <option value="color">カラー</option>
                    <option value="hue">色相</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-14">強さ</span>
                  <Slider value={[Math.round(ambientOpacity * 100)]} min={0} max={100} step={1}
                    onValueChange={([v]) => { if (room.current_scene_id) updateAmbientSettings(room.current_scene_id, { ambient_opacity: v / 100 }); }}
                    className="flex-1" />
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{Math.round(ambientOpacity * 100)}%</span>
                </div>
                {(ambientBrightness !== 100 || ambientSaturation !== 100 || ambientColor !== '#1b3a5c' || ambientBlendMode !== 'multiply' || ambientOpacity !== 0.25) && (
                  <button
                    onClick={() => { if (room.current_scene_id) updateAmbientSettings(room.current_scene_id, { ambient_brightness: 100, ambient_saturation: 100, ambient_color: '#1b3a5c', ambient_blend_mode: 'multiply', ambient_opacity: 0.25 }); }}
                    className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors pt-1 border-t border-border mt-1"
                  >
                    <RotateCcw size={10} />リセット
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Round icon buttons */}
        <button onClick={() => togglePanel('volume')}
          className="p-3 rounded-full shadow-lg bg-card text-muted-foreground hover:text-foreground transition-all"
          title="マスター音量">
          <Volume2 size={18} />
        </button>
        <button onClick={() => togglePanel('blur')}
          className={`p-3 rounded-full shadow-lg transition-all ${(currentSceneBlur > 0 || currentSceneBrightness !== 100 || currentSceneSaturation !== 100) ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          title="背景調整">
          <Eye size={18} />
        </button>
        <button onClick={() => togglePanel('effect')}
          className={`p-3 rounded-full shadow-lg transition-all ${currentSceneEffect !== 'none' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          title="盤面エフェクト">
          <Sparkles size={18} />
        </button>
        <button onClick={() => toggleBreak(!isOnBreak)}
          className={`p-3 rounded-full shadow-lg transition-all ${isOnBreak ? 'bg-orange-500 text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          title="休憩中">
          <Coffee size={18} />
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => {
                const next = !hideAllObjects;
                setHideAllObjects(next);
                setHideCharacterObjects(false);
                roomBroadcast('visibility_filter', { hideAll: next, hideCharacters: false });
              }}
              className={`p-3 rounded-full shadow-lg transition-all ${hideAllObjects ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
              title={hideAllObjects ? 'オブジェクトを表示' : '全オブジェクトを非表示'}
            >
              {hideAllObjects ? <Layers size={18} /> : <EyeOff size={18} />}
            </button>
            <button
              onClick={() => {
                const next = !hideCharacterObjects;
                setHideCharacterObjects(next);
                setHideAllObjects(false);
                roomBroadcast('visibility_filter', { hideAll: false, hideCharacters: next });
              }}
              className={`p-3 rounded-full shadow-lg transition-all ${hideCharacterObjects ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
              title={hideCharacterObjects ? 'キャラクターを表示' : 'キャラクターを非表示'}
            >
              <UserX size={18} />
            </button>
          </>
        )}
        <button onClick={() => togglePanel('se')}
          className={`p-3 rounded-full shadow-lg transition-all ${se.playingIds.length > 0 ? 'bg-amber-500 text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          title="SEプレイヤー">
          <Zap size={18} />
        </button>
        <button onClick={() => togglePanel('bgm')}
          className={`relative p-3 rounded-full shadow-lg transition-all ${bgm.isPlaying ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          title="BGMプレイヤー">
          <Music size={18} />
          {bgm.isPlaying && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
          )}
        </button>
        <button onClick={() => togglePanel('asset')}
          className={`p-3 rounded-full shadow-lg transition-all ${activePanel === 'asset' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          title="画像ライブラリ">
          <Image size={18} />
        </button>
        <button onClick={() => setScreenMode(v => (v === 0 ? 1 : v === 1 ? 2 : 0))}
          className={`relative p-3 rounded-full shadow-lg transition-all ${screenMode ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
          title={screenMode === 0 ? 'スクリーンモード: OFF' : `スクリーンモード: ${screenMode}`}>
          <Monitor size={18} />
          {screenMode > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center">
              {screenMode}
            </span>
          )}
        </button>
      </div>

      {/* Large floating windows — positioned left of the button column */}
      {activePanel === 'asset' && (
        <div className={`fixed bottom-4 z-50 glass-panel w-96 h-[32rem] flex flex-col overflow-hidden ${showInspectorPanel ? 'right-[352px]' : 'right-[64px]'}`}
          style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <button onClick={() => setActivePanel(null)}
            className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            title="閉じる"><X size={14} /></button>
          <AssetLibrary
            assets={assetLib.assets} loading={assetLib.loading} isAdmin={isAdmin}
            currentSceneId={room.current_scene_id} objects={objects}
            onUpload={assetLib.uploadAsset} onRename={assetLib.renameAsset}
            onDelete={assetLib.deleteAsset} onUpdateCategory={assetLib.updateCategory}
            onAddToScene={handleAddAssetToScene}
            onCreateCharacter={handleCreateCharacterFromAssets}
          />
        </div>
      )}
      {activePanel === 'se' && (
        <div className={`fixed bottom-4 z-50 glass-panel w-80 h-[28rem] flex flex-col overflow-hidden ${showInspectorPanel ? 'right-[352px]' : 'right-[64px]'}`}
          style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <button onClick={() => setActivePanel(null)}
            className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            title="閉じる"><X size={14} /></button>
          <SePanel
            tracks={se.tracks} playingIds={new Set(se.playingIds)} isAdmin={isAdmin}
            onPlaySe={se.playSe} onStopSe={se.stopSe} onStopAll={se.stopAll}
            onAddTrack={se.addTrack} onDeleteTrack={se.deleteTrack} onUpdateVolume={se.updateVolume}
          />
        </div>
      )}
      {activePanel === 'bgm' && (
        <div className={`fixed bottom-4 z-50 glass-panel w-80 h-[28rem] flex flex-col overflow-hidden ${showInspectorPanel ? 'right-[352px]' : 'right-[64px]'}`}
          style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <button onClick={() => setActivePanel(null)}
            className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            title="閉じる"><X size={14} /></button>
          <BgmPanel
            tracks={bgm.tracks} currentTrackId={bgm.currentTrackId} isPlaying={bgm.isPlaying}
            volume={bgm.volume} loop={bgm.loop} audioUnlocked={bgm.audioUnlocked}
            isAdmin={isAdmin} currentScene={currentScene}
            onSetVolume={bgm.setVolume} onSetLoop={bgm.setLoop} onPlayTrack={bgm.playTrack}
            onStopPlayback={bgm.stopPlayback} onTogglePlayback={bgm.togglePlayback}
            onAddTrack={bgm.addTrack} onDeleteTrack={bgm.deleteTrack}
            onLinkBgmToScene={bgm.linkBgmToScene} onUnlockAudio={bgm.unlockAudio}
          />
        </div>
      )}

      {/* Character / Marker management panels — drop from below TopBar */}
      {persistentPanel && (
        <div className="fixed top-12 left-4 z-50">
          <PersistentObjectPanel
            category={persistentPanel}
            objects={objects}
            assets={assetLib.assets}
            currentSceneId={room.current_scene_id}
            isAdmin={isAdmin}
            onAddObject={handleAddObject}
            onUpdateObject={updateObjectImmediate}
            onDeleteObject={deleteObject}
            onDuplicateObject={duplicateObject}
            onClose={() => setPersistentPanel(null)}
          />
        </div>
      )}

      {contextMenu && contextObj && (
        <ObjectContextMenu
          obj={contextObj}
          objects={objects}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          isAdmin={isAdmin}
          onClose={() => setContextMenu(null)}
          onUpdateObject={updateObjectImmediate}
          onDeleteObject={deleteObject}
          onDuplicateObject={duplicateObject}
        />
      )}

      {/* Drop category picker for 'object' assets */}
      {dropCategoryPicker && (
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setDropCategoryPicker(null)}
        >
          <div
            className="absolute glass-panel p-2 flex flex-col gap-1 min-w-[140px]"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[11px] text-muted-foreground px-2 py-1 font-medium">追加タイプを選択</div>
            <button
              onClick={() => handleDropCategorySelect('scene_object')}
              className="text-[11px] px-3 py-1.5 text-left rounded hover:bg-secondary/60 text-foreground transition-colors"
            >
              セットオブジェクト
            </button>
            <button
              onClick={() => handleDropCategorySelect('marker_object')}
              className="text-[11px] px-3 py-1.5 text-left rounded hover:bg-secondary/60 text-foreground transition-colors"
            >
              プロップ
            </button>
          </div>
        </div>
      )}
      {/* Media preload progress indicator */}
      {mediaPreload && (
        <div className="fixed bottom-4 left-4 z-50 glass-panel px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
          <span>{mediaPreload.label}をプリロード中... {mediaPreload.done} / {mediaPreload.total}</span>
          <div className="w-24 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(mediaPreload.done / mediaPreload.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
