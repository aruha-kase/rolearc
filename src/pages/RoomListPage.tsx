import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AuthScreen } from '@/components/AuthScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, LogOut, Pencil, Trash2, DoorOpen } from 'lucide-react';
import type { Room } from '@/types/trpg';

export default function RoomListPage() {
  const { session, loading: authLoading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [renameRoom, setRenameRoom] = useState<Room | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);
  const [nameInput, setNameInput] = useState('');

  const fetchRooms = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('admin_id', user.id)
      .order('updated_at', { ascending: false });
    setRooms(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchRooms();
  }, [user]);

  const handleCreate = async () => {
    const name = nameInput.trim() || '新しいルーム';
    if (!user) return;
    const { data } = await supabase
      .from('rooms')
      .insert({ name, admin_id: user.id })
      .select()
      .single();
    if (data) {
      setCreateOpen(false);
      setNameInput('');
      navigate(`/room/${data.id}`);
    }
  };

  const handleRename = async () => {
    if (!renameRoom || !nameInput.trim()) return;
    await supabase.from('rooms').update({ name: nameInput.trim() }).eq('id', renameRoom.id);
    setRenameRoom(null);
    setNameInput('');
    fetchRooms();
  };

  const handleDelete = async () => {
    if (!deleteRoom) return;
    await supabase.from('rooms').delete().eq('id', deleteRoom.id);
    setDeleteRoom(null);
    fetchRooms();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div
        className="h-12 flex items-center px-4 gap-3"
        style={{
          background: 'hsla(0 0% 0% / 0.4)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.05)',
        }}
      >
        <span className="text-sm font-semibold tracking-wide">RoleArc</span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut size={14} />
          ログアウト
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold">ルーム一覧</h1>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => { setNameInput(''); setCreateOpen(true); }}
          >
            <Plus size={14} />
            新規ルーム
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-16">読み込み中...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-muted-foreground text-sm">ルームがまだありません</p>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => { setNameInput(''); setCreateOpen(true); }}
            >
              <Plus size={14} />
              最初のルームを作成
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {rooms.map(room => (
              <div
                key={room.id}
                className="group flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/room/${room.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{room.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    更新: {new Date(room.updated_at).toLocaleString('ja-JP', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); setNameInput(room.name); setRenameRoom(room); }}
                    className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                    title="名前変更"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteRoom(room); }}
                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="削除"
                  >
                    <Trash2 size={13} />
                  </button>
                  <DoorOpen size={14} className="ml-1 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass-panel border-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">新しいルームを作成</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="ルーム名"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            className="input-dark text-foreground"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button size="sm" onClick={handleCreate}>作成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameRoom} onOpenChange={() => setRenameRoom(null)}>
        <DialogContent className="glass-panel border-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">ルーム名を変更</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="新しい名前"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            className="input-dark text-foreground"
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button size="sm" onClick={handleRename}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRoom} onOpenChange={() => setDeleteRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ルームを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteRoom?.name}」を削除すると、含まれるシーンやオブジェクトもすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
