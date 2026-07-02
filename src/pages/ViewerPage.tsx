import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRoom } from '@/hooks/useRoom';
import { useBgm } from '@/hooks/useBgm';
import { useSePlayer } from '@/hooks/useSePlayer';
import { useMasterVolume } from '@/hooks/useMasterVolume';
import { CanvasBoard } from '@/components/CanvasBoard';
import { InspectorPanel } from '@/components/InspectorPanel';
import { ObjectContextMenu } from '@/components/ObjectContextMenu';
import { Volume2, Monitor, ChevronLeft, ChevronRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

export default function ViewerPage() {
  const { token } = useParams<{ token: string }>();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ objId: string; x: number; y: number } | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  // スクリーンモード: 0=OFF / 1=メイン盤面 / 2=サブ盤面
  const [screenMode, setScreenMode] = useState<0 | 1 | 2>(0);
  const [showInspectorPanel, setShowInspectorPanel] = useState(true);

  const { masterVolume, setMasterVolume } = useMasterVolume();

  const { room, scenes, objects, loading, updateObject, updateObjectImmediate, localUpdateObject, deleteObject, videoCommands, hideAllObjects, hideCharacterObjects, roomBroadcast, tempHiddenId, shakeCommand, flashCommand, textOverlayCommand, countdownCommand, bounceCommands, grayscaleState } = useRoom(roomId);

  // BGM & SE hooks - master volume applied internally
  const bgm = useBgm(roomId, room?.current_scene_id ?? null, masterVolume, false);
  const se = useSePlayer(roomId, masterVolume);

  useEffect(() => {
    if (!token) return;
    const findRoom = async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('id')
        .eq('share_token', token)
        .single();
      if (error || !data) {
        setError('ルームが見つかりません');
        return;
      }
      setRoomId(data.id);
    };
    findRoom();
  }, [token]);

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">接続中...</div>
      </div>
    );
  }

  const currentScene = scenes.find(s => s.id === room.current_scene_id) ?? null;
  const isOnBreak = room?.is_on_break ?? false;
  const selectedObject = objects.find(o => o.id === selectedObjectId) ?? null;
  const contextObj = contextMenu ? objects.find(o => o.id === contextMenu.objId) ?? null : null;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div
        className="h-10 flex items-center px-4 justify-between"
        style={{
          background: 'hsla(0 0% 0% / 0.4)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.05)',
        }}
      >
        <span className="text-xs text-muted-foreground">
          {room.name} — {currentScene?.name ?? 'シーンなし'}
        </span>
        <span className="text-[10px] text-muted-foreground/60">参加者モード</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <CanvasBoard
          scene={currentScene}
          objects={objects}
          selectedObjectId={selectedObjectId}
          isAdmin={false}
          enableKeyboardShortcuts
          fadeDuration={0.3}
          isOnBreak={isOnBreak}
          onSelectObject={setSelectedObjectId}
          onUpdateObject={updateObject}
          onDragMove={handleDragMove}
          onLocalUpdateObject={localUpdateObject}
          onDeleteObject={deleteObject}
          onContextMenu={handleContextMenu}
          videoCommands={videoCommands}
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
          onTempHide={handleTempHide}
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
              isAdmin={false}
              onUpdateObject={updateObjectImmediate}
              onDeleteObject={deleteObject}
              onSelectObject={setSelectedObjectId}
            />
          )}
        </div>
      </div>

      {/* Screen Mode toggle (0→1→2→0) */}
      <button
        onClick={() => setScreenMode(v => (v === 0 ? 1 : v === 1 ? 2 : 0))}
        className={`fixed bottom-4 z-50 p-3 rounded-full shadow-lg transition-all ${showInspectorPanel ? 'right-[348px]' : 'right-[56px]'} ${screenMode ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
        title={screenMode === 0 ? 'スクリーンモード: OFF' : `スクリーンモード: ${screenMode}`}
      >
        <Monitor size={18} />
        {screenMode > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center">
            {screenMode}
          </span>
        )}
      </button>

      {/* Master volume control — left of InspectorPanel */}
      <div className={`fixed bottom-4 z-50 flex flex-col gap-2 items-end ${showInspectorPanel ? 'right-[292px]' : 'right-4'}`}>
        {showVolumeSlider && (
          <div className="glass-panel p-3 w-56 flex items-center gap-2">
            <Volume2 size={14} className="text-muted-foreground shrink-0" />
            <Slider
              value={[masterVolume * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => setMasterVolume(v / 100)}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
        )}
        <button
          onClick={() => setShowVolumeSlider(!showVolumeSlider)}
          className="p-3 rounded-full shadow-lg bg-card text-muted-foreground hover:text-foreground transition-all"
          title="マスター音量"
        >
          <Volume2 size={18} />
        </button>
      </div>

      {contextMenu && contextObj && (
        <ObjectContextMenu
          obj={contextObj}
          objects={objects}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          isAdmin={false}
          onClose={() => setContextMenu(null)}
          onUpdateObject={updateObjectImmediate}
          onDeleteObject={deleteObject}
        />
      )}
    </div>
  );
}
