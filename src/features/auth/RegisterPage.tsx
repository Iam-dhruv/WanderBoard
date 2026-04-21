import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerWithEmail } from './authService';
import { ROUTES } from '@/config/routes';

export function RegisterPage() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const result = await registerWithEmail(email, password, displayName.trim());
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate(ROUTES.DASHBOARD, { replace: true });
  }


  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: '1.05fr 1fr' }}>
      {/* ── Left hero ── */}
      <div className="relative overflow-hidden border-r border-wb-line">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80')",
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(15,28,46,0.25) 0%, rgba(15,28,46,0.6) 100%)' }}
        />
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

        <div className="relative z-10 h-full flex flex-col justify-between p-9 text-white">
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

          <div>
            <div className="flex gap-2 mb-4">
              <span className="wb-sticker sun">⏰ Manali</span>
              <span className="wb-sticker coral rot-r">🌴 Goa</span>
              <span className="wb-sticker sky">🏔 Leh</span>
            </div>
            <h1
              className="text-white font-fraunces font-bold"
              style={{
                fontSize: 72,
                lineHeight: 0.95,
                letterSpacing: '-0.03em',
                textShadow: '0 2px 20px rgba(0,0,0,0.25)',
              }}
            >
              Build the<br />
              <em className="italic" style={{ color: '#F5A524', fontVariationSettings: '"SOFT" 100' }}>
                trip
              </em>
              {' '}board<br />
              your group loves.
            </h1>
            <p className="mt-3.5 text-[17px] leading-relaxed max-w-[460px]" style={{ color: 'rgb(230,234,241)' }}>
              Create your account and bring your crew into one shared workspace.
            </p>
          </div>

          <div className="flex gap-3.5 items-center text-xs opacity-80">
            <span>Ladakh · photo by @unsplash</span>
            <span>·</span>
            <span>Invite sent in seconds</span>
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
            <span
              className="absolute -top-3.5 left-6 wb-sticker coral text-xs"
              style={{ transform: 'rotate(-2deg)' }}
            >
              New here
            </span>

            <h2
              className="font-fraunces text-[34px] font-bold leading-[1.05] mt-1.5 mb-1.5"
              style={{ letterSpacing: '-0.02em' }}
            >
              Start planning{' '}
              <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>
                together.
              </em>
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--wb-ink-soft)' }}>
              Create your account to join the workspace.
            </p>

            {error && (
              <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} noValidate className="space-y-3.5">
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-[13px] font-semibold mb-1.5"
                  style={{ color: 'var(--wb-ink)' }}
                >
                  Full name
                </label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="wb-input"
                  placeholder="Sakshi Sharma"
                />
              </div>

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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="wb-input"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="block text-[13px] font-semibold mb-1.5"
                  style={{ color: 'var(--wb-ink)' }}
                >
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="wb-input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 wb-btn wb-btn-primary wb-btn-lg flex items-center justify-center"
              >
                {loading ? 'Creating account…' : 'Create account →'}
              </button>
            </form>

            <p className="mt-5 text-center text-[13px]" style={{ color: 'var(--wb-ink-soft)' }}>
              Already have an account?{' '}
              <Link
                to={ROUTES.LOGIN}
                className="font-semibold underline"
                style={{ color: 'var(--wb-ink)' }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
