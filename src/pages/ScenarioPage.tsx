import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AuthScreen } from '@/components/AuthScreen';
import { ScenarioEditor } from '@/components/scenario/ScenarioEditor';
import { ArrowLeft } from 'lucide-react';

export default function ScenarioPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">読み込み中...</div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div
        className="h-10 flex items-center px-4 gap-3 shrink-0"
        style={{
          background: 'hsla(0 0% 0% / 0.4)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 0 1px hsla(0 0% 100% / 0.05)',
        }}
      >
        <button
          onClick={() => navigate(`/room/${roomId}`)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          盤面に戻る
        </button>
        <span className="text-xs text-muted-foreground/40">|</span>
        <span className="text-xs font-medium text-foreground">Live Scenario Master</span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <ScenarioEditor roomId={roomId ?? ''} />
      </div>
    </div>
  );
}
