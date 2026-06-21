import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AuthScreen } from '@/components/AuthScreen';
import { ScenarioEditor } from '@/components/scenario/ScenarioEditor';
import { BookOpen, ChevronDown, LogOut, Plus } from 'lucide-react';
import type { Room } from '@/types/trpg';

const LSM_ROOM_KEY = 'lsm-last-room-id';

export default function LsmPage() {
  const { session, loading: authLoading, signOut, user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // Load rooms
  useEffect(() => {
    if (!user) return;
    supabase
      .from('rooms')
      .select('*')
      .eq('admin_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        const list = data ?? [];
        setRooms(list);
        setRoomsLoading(false);

        // Restore last room
        const lastId = localStorage.getItem(LSM_ROOM_KEY);
        if (lastId) {
          const found = list.find(r => r.id === lastId);
          if (found) { setSelectedRoom(found); return; }
        }
        // Auto-select if only one room
        if (list.length === 1) {
          setSelectedRoom(list[0]);
          localStorage.setItem(LSM_ROOM_KEY, list[0].id);
        }
      });
  }, [user]);

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    localStorage.setItem(LSM_ROOM_KEY, room.id);
    setShowRoomPicker(false);
  };

  const handleCreateRoom = async () => {
    if (!user) return;
    const name = newRoomName.trim() || '新しいルーム';
    const { data } = await supabase
      .from('rooms')
      .insert({ name, admin_id: user.id })
      .select()
      .single();
    if (data) {
      setRooms(prev => [data, ...prev]);
      handleSelectRoom(data);
      setCreating(false);
      setNewRoomName('');
    }
  };

  // Loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  // Not logged in
  if (!session) return <AuthScreen />;

  // Room picker (no room selected or explicitly switching)
  if (!selectedRoom || showRoomPicker) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Header */}
        <div
          className="h-14 flex items-center px-5 gap-3 shrink-0"
          style={{
            background: 'hsla(0 0% 0% / 0.4)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.05)',
          }}
        >
          <BookOpen size={18} className="text-primary" />
          <span className="text-sm font-semibold tracking-wide">Live Scenario Master</span>
          <div className="flex-1" />
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors p-2"
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Room picker */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
          <p className="text-sm text-muted-foreground mb-6">ルームを選んでください</p>

          {roomsLoading ? (
            <div className="text-xs text-muted-foreground">読み込み中...</div>
          ) : (
            <div className="w-full max-w-md space-y-3">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => handleSelectRoom(room)}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-card/80 transition-colors text-left"
                >
                  <BookOpen size={16} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{room.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      更新: {new Date(room.updated_at).toLocaleString('ja-JP', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </div>
                  </div>
                </button>
              ))}

              {/* New room */}
              {creating ? (
                <div className="flex gap-2 mt-2">
                  <input
                    autoFocus
                    type="text"
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateRoom(); if (e.key === 'Escape') setCreating(false); }}
                    placeholder="ルーム名"
                    className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
                  />
                  <button
                    onClick={handleCreateRoom}
                    className="px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    作成
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors text-sm mt-1"
                >
                  <Plus size={15} />
                  新しいルームを作成
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // LSM editor (room selected)
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Minimal header */}
      <div
        className="h-10 flex items-center px-4 gap-2 shrink-0"
        style={{
          background: 'hsla(0 0% 0% / 0.4)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.05)',
        }}
      >
        <BookOpen size={13} className="text-primary shrink-0" />
        <span className="text-[11px] font-medium text-foreground/70">LSM</span>
        <span className="text-[11px] text-muted-foreground/40">|</span>
        <button
          onClick={() => setShowRoomPicker(true)}
          className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary transition-colors max-w-[200px] truncate"
          title="ルームを切り替え"
        >
          <span className="truncate">{selectedRoom.name}</span>
          <ChevronDown size={11} className="shrink-0 text-muted-foreground" />
        </button>
        <div className="flex-1" />
        <button
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
          title="ログアウト"
        >
          <LogOut size={13} />
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <ScenarioEditor roomId={selectedRoom.id} />
      </div>
    </div>
  );
}
