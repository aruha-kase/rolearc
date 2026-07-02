import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RAicon from '@/assets/RAicon.webp';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Ark hull shape — bottom curve */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140%] aspect-[3/1] rounded-t-[50%] opacity-[0.04]"
        style={{
          background: 'linear-gradient(0deg, hsl(var(--primary)), transparent)',
        }}
      />
      {/* Ark keel line */}
      <svg
        className="absolute bottom-0 left-0 w-full h-[40%] opacity-[0.06]"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 400 Q720 80 1440 400"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
        />
        <path
          d="M100 400 Q720 140 1340 400"
          stroke="hsl(var(--accent))"
          strokeWidth="0.8"
        />
      </svg>

      {/* Ambient glow */}
      <div
        className="absolute top-[15%] left-[20%] w-72 h-72 rounded-full opacity-[0.06] blur-[120px]"
        style={{ background: 'hsl(var(--primary))' }}
      />
      <div
        className="absolute bottom-[20%] right-[15%] w-60 h-60 rounded-full opacity-[0.04] blur-[100px]"
        style={{ background: 'hsl(var(--accent))' }}
      />

      {/* Floating particles / stars */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/20"
          style={{
            top: `${15 + i * 12}%`,
            left: `${10 + i * 15}%`,
            animation: `pulse ${2 + i * 0.5}s ease-in-out infinite alternate`,
          }}
        />
      ))}

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <img
            src={RAicon}
            alt="RoleArc"
            className="w-20 h-20 drop-shadow-lg"
            style={{
              filter: 'drop-shadow(0 0 20px hsla(var(--primary) / 0.3))',
            }}
          />
        </div>

        <div className="glass-panel p-8 space-y-7">
          {/* Branding */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              RoleArc
            </h1>
            <p className="text-[11px] text-muted-foreground tracking-widest uppercase">
              シーン管理・演出ツール
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-dark h-11"
              required
            />
            <Input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-dark h-11"
              required
            />
            {error && <p className="text-destructive text-xs">{error}</p>}
            <Button
              type="submit"
              className="w-full h-11 font-medium text-primary-foreground"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
              }}
              disabled={loading}
            >
              {loading ? '...' : isSignUp ? 'アカウント作成' : 'ログイン'}
            </Button>
          </form>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors"
          >
            {isSignUp ? 'ログインに切り替え' : 'アカウントを作成'}
          </button>
        </div>
      </div>
    </div>
  );
}
