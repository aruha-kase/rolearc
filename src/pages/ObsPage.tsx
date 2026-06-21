import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useRoom } from '@/hooks/useRoom';
import { CanvasBoard } from '@/components/CanvasBoard';

/**
 * OBS専用表示ページ
 * ?obs=main  → メイン盤面のみ
 * ?obs=minimap → ミニマップのみ
 * UI・音声なし、閲覧専用
 */
export default function ObsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  // obs=main / sub。sub(=サブ盤面)は内部的にカメラ2位置を映す 'minimap' モードで表示。
  // 旧 minimap も後方互換で受ける。
  const rawObs = searchParams.get('obs');
  const obsMode: 'main' | 'minimap' = (rawObs === 'sub' || rawObs === 'minimap') ? 'minimap' : 'main';

  const { room, scenes, objects, loading, videoCommands, hideAllObjects, hideCharacterObjects, shakeCommand, flashCommand, textOverlayCommand, countdownCommand, bounceCommands, grayscaleState } = useRoom(roomId ?? null);


  if (loading || !room) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  const currentScene = scenes.find(s => s.id === room.current_scene_id) ?? null;
  const isOnBreak = room.is_on_break ?? false;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex">
      <CanvasBoard
        scene={currentScene}
        objects={objects}
        selectedObjectId={null}
        isAdmin={false}
        fadeDuration={0.3}
        isOnBreak={isOnBreak}
        onSelectObject={() => {}}
        onUpdateObject={() => {}}
        onLocalUpdateObject={() => {}}
        obsMode={obsMode ?? 'main'}
        videoCommands={videoCommands}
        hideAllObjects={hideAllObjects}
        hideCharacterObjects={hideCharacterObjects}
        shakeCommand={shakeCommand}
        flashCommand={flashCommand}
        textOverlayCommand={textOverlayCommand}
        countdownCommand={countdownCommand}
        bounceCommands={bounceCommands}
        grayscaleState={grayscaleState}
      />
    </div>
  );
}
