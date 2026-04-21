import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signInWithEmail } from './authService';
import { ROUTES } from '@/config/routes';

export function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? ROUTES.DASHBOARD;

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signInWithEmail(email, password);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    navigate(from, { replace: true });
  }


  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: '1.05fr 1fr' }}>
      {/* ── Left hero ── */}
      <div className="relative overflow-hidden border-r border-wb-line">
        {/* Background photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        {/* Dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(15,28,46,0.25) 0%, rgba(15,28,46,0.6) 100%)' }}
        />
        {/* Dashed stamp circle */}
        <div
          className="absolute right-10 top-10 z-10 w-[120px] h-[120px] rounded-full flex items-center justify-center text-center"
          style={{
            border: '2px dashed rgba(255,255,255,0.75)',
            transform: 'rotate(-8deg)',
            color: '#fff',
            fontFamily: 'Fraunces, serif',
            fontStyle: 'italic',
            fontSize: 11,
            lineHeight: 1.3,
            padding: 12,
          }}
        >
          Plan trips<br />together
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-9 text-white">
          {/* Brand mark */}
          <div className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight">
            <div
              className="w-[30px] h-[30px] rounded-lg flex items-center justify-center border-2 border-white"
              style={{ background: '#F5A524', boxShadow: '3px 3px 0 rgba(0,0,0,0.35)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F1C2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
            </div>
            WanderBoard
          </div>

          {/* Bottom content */}
          <div>
            <div className="flex gap-2 mb-4">
              <span className="wb-sticker sun">⏰ Manali</span>
              <span className="wb-sticker coral rot-r">🌴 Goa</span>
              <span className="wb-sticker sky">🏔 Leh</span>
            </div>
            <h1
              className="text-white font-fraunces font-bold"
              style={{
                fontSize: 74,
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                textShadow: '0 2px 20px rgba(0,0,0,0.25)',
              }}
            >
              Six friends.<br />
              One{' '}
              <em className="italic" style={{ color: '#F5A524', fontVariationSettings: '"SOFT" 100' }}>
                spreadsheet
              </em>
              -free<br />
              trip.
            </h1>
            <p className="mt-3.5 text-[17px] leading-relaxed max-w-[460px]" style={{ color: 'rgb(230,234,241)' }}>
              Bucket lists, votes, weather, money — in one workspace that's actually fun to use.
            </p>
          </div>

          <div className="flex gap-3.5 items-center text-xs opacity-80">
            <span>Ladakh · photo by @unsplash</span>
            <span>·</span>
            <span>4 friends already planning</span>
          </div>
        </div>
      </div>

      {/* ── Right form ── */}
      <div
        className="flex items-center justify-center p-10"
        style={{ background: 'var(--wb-paper)' }}
      >
        <div className="w-full max-w-[420px]">
          <div
            className="relative bg-white rounded-[20px] p-8"
            style={{
              border: '1px solid var(--wb-line)',
              boxShadow: 'var(--wb-shadow-md)',
            }}
          >
            {/* "Welcome back" sticker tag */}
            <span
              className="absolute -top-3.5 left-6 wb-sticker sun text-xs"
              style={{ transform: 'rotate(-3deg)' }}
            >
              Welcome back
            </span>

            <h2
              className="font-fraunces text-[36px] font-bold leading-[1.05] mt-1.5 mb-1.5"
              style={{ letterSpacing: '-0.02em' }}
            >
              Let's go{' '}
              <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>
                somewhere.
              </em>
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--wb-ink-soft)' }}>
              Sign in to jump back into your trips.
            </p>

            {error && (
              <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailLogin} noValidate className="space-y-3.5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-[13px] font-semibold mb-1.5"
                  style={{ color: 'var(--wb-ink)' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="wb-input"
                  placeholder="you@iitr.ac.in"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[13px] font-semibold mb-1.5"
                  style={{ color: 'var(--wb-ink)' }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="wb-input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 wb-btn wb-btn-primary wb-btn-lg flex items-center justify-center"
              >
                {loading ? 'Signing in…' : 'Sign in →'}
              </button>
            </form>

            <p className="mt-5 text-center text-[13px]" style={{ color: 'var(--wb-ink-soft)' }}>
              No account yet?{' '}
              <Link
                to={ROUTES.REGISTER}
                className="font-semibold underline"
                style={{ color: 'var(--wb-ink)' }}
              >
                Sign up in 30 seconds →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
