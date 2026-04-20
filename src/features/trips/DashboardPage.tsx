import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ensureUserDocumentForUser } from '@/features/auth/authService';
import { auth } from '@/config/firebase';
import { useTripStore } from './useTripStore';
import { getUserTrips, createTrip, joinTrip } from './tripService';
import { signOut } from '@/features/auth/authService';
import { ROUTES } from '@/config/routes';
import { useJsApiLoader } from '@react-google-maps/api';
import { DEFAULT_TRIP_CURRENCY, TRIP_CURRENCY_OPTIONS } from '@/lib/currency';
import type { Trip } from '@/types';
import { resolvePlaceCoordinates } from '@/features/discovery/services/placesApi';
import { Avatar } from '@/components/Avatar';
import { Sticker } from '@/components/Sticker';

const CREATE_TRIP_MAP_LIBRARIES: ('places')[] = ['places'];

// Curated travel photos for trip cards (cycled by index)
const COVER_PHOTOS = [
  'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1558980664-10e7170b5df9?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1537956965359-7573183d1f57?auto=format&fit=crop&w=1200&q=70',
];

const TRIP_STICKERS = [
  { emoji: '⛰️', label: 'Mountains', color: 'sun'  as const, rotation: 'left'  as const },
  { emoji: '🌴', label: 'Beach',     color: 'coral' as const, rotation: 'right' as const },
  { emoji: '🌸', label: 'Spring',    color: 'plum'  as const, rotation: 'right' as const },
  { emoji: '🏔',  label: 'Trek',      color: 'sky'   as const, rotation: 'left'  as const },
  { emoji: '✈',  label: 'Past trip', color: 'moss'  as const, rotation: 'left'  as const },
  { emoji: '🤿', label: 'Dive',      color: 'ocean' as const, rotation: 'right' as const },
];

function getDaysToGo(startDate: string): number {
  return Math.ceil((new Date(startDate).getTime() - Date.now()) / 86400000);
}

function normalizeCity(city: string): string {
  return city.replace(/\s+/g, ' ').trim();
}

function parseCityTokens(rawValue: string): string[] {
  return rawValue.split(';').map(normalizeCity).filter(Boolean);
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { trips, tripsLoading, tripsError, setTrips, addTrip, setLoading, setError, reset } = useTripStore();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin,   setShowJoin]   = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (auth.currentUser) {
        try { await ensureUserDocumentForUser(auth.currentUser); }
        catch (err) { console.error('[DashboardPage] ensure user doc failed:', err); }
      }
      const result = await getUserTrips(user.uid);
      if (cancelled) return;
      if (result.ok) setTrips(result.data);
      else setError(result.error);
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function handleSignOut() {
    await signOut();
    reset();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  const upcomingTrips = trips
    .filter((t) => getDaysToGo(t.startDate) > 0)
    .sort((a, b) => getDaysToGo(a.startDate) - getDaysToGo(b.startDate));
  const heroTrip = upcomingTrips[0] ?? trips[0] ?? null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--wb-paper)' }}>
      {/* ── Top nav ── */}
      <header
        className="flex items-center gap-5 px-8 py-4"
        style={{ background: 'var(--wb-paper)', borderBottom: '1px solid var(--wb-line)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 font-extrabold text-[18px] tracking-tight" style={{ color: 'var(--wb-ink)' }}>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center border-[1.5px]"
            style={{ background: 'var(--wb-sun)', borderColor: 'var(--wb-ink)', boxShadow: '2px 2px 0 var(--wb-ink)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F1C2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l19-9-9 19-2-8-8-2z" />
            </svg>
          </div>
          WanderBoard
        </div>

        {/* Nav links */}
        <nav className="flex gap-1 ml-5">
          <a href="#" className="px-3 py-[7px] rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--wb-ink)' }}>
            My Trips
          </a>
          <a href="#" className="px-3 py-[7px] rounded-lg text-sm font-medium hover:bg-wb-paper-2 transition-colors" style={{ color: 'var(--wb-ink-soft)' }}>
            Discover
          </a>
          <a href="#" className="px-3 py-[7px] rounded-lg text-sm font-medium hover:bg-wb-paper-2 transition-colors" style={{ color: 'var(--wb-ink-soft)' }}>
            Bucket List
          </a>
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-3">
          {tripsLoading && <span className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>Loading…</span>}
          {tripsError   && <span className="text-sm text-red-500">{tripsError}</span>}
          <button
            onClick={() => setShowJoin(true)}
            className="wb-btn wb-btn-ghost wb-btn-sm flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 17l-5-5 5-5"/><path d="M4 12h16"/>
            </svg>
            Join with code
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="wb-btn wb-btn-accent wb-btn-sm"
          >
            + New trip
          </button>
          {user && (
            <button onClick={handleSignOut} title="Sign out">
              <Avatar displayName={user.displayName ?? user.email ?? 'U'} photoURL={user.photoURL} size="md" />
            </button>
          )}
        </div>
      </header>

      {/* ── Hero row ── */}
      {!tripsLoading && trips.length > 0 && heroTrip && (
        <div className="grid gap-6 px-8 pt-8" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
          <HeroCard trip={heroTrip} isOwner={heroTrip.ownerId === user?.uid} onOpen={() => navigate(ROUTES.tripPlanning(heroTrip.id))} />
          <QuickActionsPanel
            inviteCode={heroTrip.inviteCode}
            onNewTrip={() => setShowCreate(true)}
            onJoin={() => setShowJoin(true)}
          />
        </div>
      )}

      {/* ── All trips grid ── */}
      {!tripsLoading && trips.length > 0 && (
        <section className="px-8 pb-14">
          <div className="flex items-end justify-between mt-8 mb-5">
            <h2 className="font-fraunces font-bold text-[40px] leading-none tracking-tight" style={{ color: 'var(--wb-ink)' }}>
              All{' '}
              <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>trips</em>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {trips.map((trip, idx) => (
              <TripCard
                key={trip.id}
                trip={trip}
                isOwner={trip.ownerId === user?.uid}
                photoUrl={COVER_PHOTOS[idx % COVER_PHOTOS.length]}
                sticker={TRIP_STICKERS[idx % TRIP_STICKERS.length]}
                onClick={() => navigate(ROUTES.tripPlanning(trip.id))}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {!tripsLoading && trips.length === 0 && (
        <EmptyState
          userName={user?.displayName?.split(' ')[0] ?? 'Traveler'}
          onNewTrip={() => setShowCreate(true)}
          onJoin={() => setShowJoin(true)}
        />
      )}

      {/* ── Modals ── */}
      {showCreate && (
        <CreateTripModal
          userId={user!}
          onClose={() => setShowCreate(false)}
          onCreated={(t) => { addTrip(t); setShowCreate(false); navigate(ROUTES.tripPlanning(t.id)); }}
        />
      )}
      {showJoin && (
        <JoinTripModal
          user={user!}
          onClose={() => setShowJoin(false)}
          onJoined={(t) => { addTrip(t); setShowJoin(false); navigate(ROUTES.tripPlanning(t.id)); }}
        />
      )}
    </div>
  );
}

// ─── Hero card ─────────────────────────────────────────────────────────────────

function HeroCard({ trip, isOwner, onOpen }: { trip: Trip; isOwner: boolean; onOpen: () => void }) {
  const daysToGo = getDaysToGo(trip.startDate);
  const photoUrl = COVER_PHOTOS[0];

  return (
    <div
      className="relative overflow-hidden min-h-[320px] flex flex-col justify-between p-7"
      style={{ borderRadius: 24, background: 'var(--wb-ink)', boxShadow: 'var(--wb-shadow-lg)' }}
    >
      {/* Background photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${photoUrl}')` }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(120deg, rgba(15,28,46,0.6) 0%, rgba(15,28,46,0.2) 60%, rgba(15,28,46,0.8) 100%)' }}
      />

      {/* Days-to-go stamp */}
      {daysToGo > 0 && (
        <div
          className="absolute right-6 top-6 z-10 flex flex-col items-center justify-center font-fraunces font-bold"
          style={{
            width: 86, height: 86, borderRadius: '50%',
            background: 'var(--wb-sun)', color: 'var(--wb-ink)',
            border: '2px solid var(--wb-ink)',
            boxShadow: '3px 3px 0 var(--wb-ink)',
            transform: 'rotate(8deg)',
          }}
        >
          <span className="text-[28px] leading-none">{daysToGo}</span>
          <span className="text-[10px] tracking-widest uppercase mt-0.5">days to go</span>
        </div>
      )}

      {/* Top content */}
      <div className="relative z-10 text-white">
        <p className="text-xs font-bold tracking-[0.15em] uppercase opacity-85">
          Your next trip · {isOwner ? 'Owner' : 'Member'}
        </p>
        <h1
          className="font-fraunces font-bold text-white leading-none mt-2.5"
          style={{ fontSize: 56, letterSpacing: '-0.03em' }}
        >
          {trip.name}
        </h1>
        <div className="flex flex-wrap gap-3 mt-4">
          {[trip.destination, `${trip.startDate} → ${trip.endDate}`, `${trip.memberIds?.length ?? 1} travelers`].map((item) => (
            <div key={item} className="wb-glass-chip">
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="relative z-10 flex items-end justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.15em] uppercase opacity-80 text-white mb-2">Trip</p>
          <div className="wb-progress-track" style={{ width: 200 }}>
            <div className="wb-progress-fill" style={{ width: '72%' }} />
          </div>
        </div>
        <button
          onClick={onOpen}
          className="wb-btn wb-btn-accent wb-btn-sm"
        >
          Open trip →
        </button>
      </div>
    </div>
  );
}

// ─── Quick actions panel ────────────────────────────────────────────────────────

function QuickActionsPanel({ inviteCode, onNewTrip, onJoin }: {
  inviteCode?: string; onNewTrip: () => void; onJoin: () => void;
}) {
  const actions = [
    { ico: 'sun', label: 'Plan a trip', desc: 'Start a new adventure', onClick: onNewTrip,
      icon: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /> },
    { ico: 'coral', label: 'Join with code', desc: '6-char invite', onClick: onJoin,
      icon: <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> },
    { ico: 'ocean', label: 'Browse places', desc: 'Get inspired', onClick: () => {},
      icon: <><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2.5" fill="none"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></> },
    { ico: 'ink', label: 'My bucket list', desc: 'Saved spots', onClick: () => {},
      icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" fill="none"/><polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2"/></> },
  ];

  const icoBg: Record<string, string> = {
    sun: 'var(--wb-sun)', coral: 'var(--wb-coral)', ocean: 'var(--wb-ocean)', ink: 'var(--wb-ink)',
  };
  const icoColor: Record<string, string> = { sun: 'var(--wb-ink)', coral: '#fff', ocean: '#fff', ink: '#fff' };

  return (
    <div
      className="flex flex-col gap-4 p-6 min-h-[320px]"
      style={{ background: '#fff', border: '1px solid var(--wb-line)', borderRadius: 24, boxShadow: 'var(--wb-shadow-sm)' }}
    >
      <h3 className="font-fraunces text-[26px] font-bold tracking-tight leading-none" style={{ color: 'var(--wb-ink)' }}>
        Quick actions
      </h3>
      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="flex flex-col gap-2 items-start p-4 rounded-[14px] border-[1.5px] text-left transition-all duration-[120ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:border-wb-ink hover:shadow-wb-sticker"
            style={{ background: 'var(--wb-paper-2)', borderColor: 'var(--wb-line)' }}
          >
            <div
              className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center"
              style={{ background: icoBg[a.ico], color: icoColor[a.ico] }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">{a.icon}</svg>
            </div>
            <div className="text-sm font-bold" style={{ color: 'var(--wb-ink)' }}>{a.label}</div>
            <div className="text-xs" style={{ color: 'var(--wb-ink-soft)' }}>{a.desc}</div>
          </button>
        ))}
      </div>

      {/* Invite code strip */}
      {inviteCode && (
        <div
          className="flex items-center gap-3 p-4 rounded-[14px] mt-auto"
          style={{ background: 'var(--wb-ink)', color: '#fff' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Share code</div>
            <div
              className="font-jetbrains font-bold text-lg tracking-[0.35em] px-3 py-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)' }}
            >
              {inviteCode}
            </div>
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(inviteCode)}
            className="ml-auto wb-btn wb-btn-sm"
            style={{ background: 'var(--wb-sun)', color: 'var(--wb-ink)', boxShadow: '2px 2px 0 rgba(0,0,0,0.25)' }}
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Trip card ─────────────────────────────────────────────────────────────────

function TripCard({ trip, isOwner, photoUrl, sticker, onClick }: {
  trip: Trip; isOwner: boolean; photoUrl: string;
  sticker: typeof TRIP_STICKERS[0]; onClick: () => void;
}) {
  const daysToGo = getDaysToGo(trip.startDate);

  return (
    <button
      onClick={onClick}
      className="wb-trip-card relative overflow-hidden rounded-[20px] border text-left flex flex-col"
      style={{ background: '#fff', borderColor: 'var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
    >
      {/* Photo */}
      <div className="relative h-[var(--den-card-h)] bg-cover bg-center" style={{ backgroundImage: `url('${photoUrl}')` }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(15,28,46,0.45) 100%)' }} />

        {/* Sticker + role pill */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
          <Sticker color={sticker.color} rotation={sticker.rotation}>
            {sticker.emoji} {sticker.label}
          </Sticker>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.95)', color: 'var(--wb-ink)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: isOwner ? 'var(--wb-sunset)' : 'var(--wb-ink-soft)' }}
            />
            {isOwner ? 'Owner' : 'Member'}
          </span>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-3.5 left-4 right-4 z-10 text-white">
          <h3 className="font-fraunces text-[26px] font-bold leading-[1.1] tracking-tight">{trip.name}</h3>
          <p className="text-[13px] opacity-95 mt-0.5">{trip.destination}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2.5 px-4 py-3">
        <div className="flex items-center">
          {(trip.memberIds ?? []).slice(0, 4).map((id, i) => (
            <div
              key={id}
              className="w-[26px] h-[26px] rounded-full border-2 border-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'var(--wb-sunset)', color: '#fff', marginLeft: i > 0 ? -6 : 0 }}
            >
              {id.slice(0, 1).toUpperCase()}
            </div>
          ))}
          {(trip.memberIds?.length ?? 0) > 4 && (
            <div
              className="w-[26px] h-[26px] rounded-full border-2 border-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold -ml-1.5"
              style={{ background: 'var(--wb-paper-3)', color: 'var(--wb-ink-soft)' }}
            >
              +{(trip.memberIds?.length ?? 0) - 4}
            </div>
          )}
        </div>
        <div className="text-right">
          <div
            className="font-fraunces font-bold text-[22px] leading-none tracking-tight"
            style={{ color: 'var(--wb-ink)' }}
          >
            {daysToGo > 0 ? daysToGo : '✓'}
          </div>
          <div className="text-[11px] font-medium uppercase tracking-wide mt-0.5" style={{ color: 'var(--wb-ink-soft)' }}>
            {daysToGo > 0 ? `days to go · ${trip.startDate}` : `Past · ${trip.startDate}`}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ userName, onNewTrip, onJoin }: {
  userName: string; onNewTrip: () => void; onJoin: () => void;
}) {
  return (
    <div className="px-10 py-10 max-w-[960px] mx-auto">
      <div className="mb-6">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border"
          style={{ borderColor: 'var(--wb-line)', background: '#fff' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--wb-sunset)' }} />
          First-timer
        </span>
        <h2
          className="font-fraunces font-bold text-[40px] leading-none tracking-tight mt-2.5"
          style={{ color: 'var(--wb-ink)' }}
        >
          Welcome,{' '}
          <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>
            {userName}.
          </em>
        </h2>
      </div>

      <div
        className="relative overflow-hidden min-h-[480px] rounded-[24px] p-12 flex flex-col items-center justify-center gap-5 text-center border-[1.5px] border-dashed"
        style={{ borderColor: 'var(--wb-line)', background: '#fff' }}
      >
        {/* Paper texture */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(120px 120px at 12% 20%, rgba(245,165,36,0.1), transparent 70%), radial-gradient(180px 180px at 85% 20%, rgba(14,107,168,0.08), transparent 70%), radial-gradient(140px 140px at 80% 85%, rgba(232,93,47,0.09), transparent 70%)',
          }}
        />
        <div className="relative z-10 flex flex-wrap gap-2.5 justify-center">
          <Sticker color="sun">⛰️ Himalayas</Sticker>
          <Sticker color="coral" rotation="right">🌊 Goa</Sticker>
          <Sticker color="sky">🏔 Leh</Sticker>
          <Sticker color="moss" rotation="right">🌴 Andamans</Sticker>
          <Sticker color="plum">🌸 Kyoto</Sticker>
        </div>
        <h3
          className="relative z-10 font-fraunces font-bold text-[38px] leading-tight tracking-tight"
          style={{ color: 'var(--wb-ink)' }}
        >
          Your passport's looking{' '}
          <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>empty.</em>
        </h3>
        <p className="relative z-10 max-w-[420px] text-base" style={{ color: 'var(--wb-ink-soft)' }}>
          Plan your first trip in 30 seconds, or hop into one with a 6-digit invite code from a friend.
        </p>
        <div className="relative z-10 flex gap-2.5">
          <button onClick={onNewTrip} className="wb-btn wb-btn-primary wb-btn-lg">+ Plan a trip</button>
          <button onClick={onJoin}    className="wb-btn wb-btn-ghost wb-btn-lg">Join with code</button>
        </div>
        <p className="relative z-10 text-xs" style={{ color: 'var(--wb-ink-soft)' }}>
          No credit card · invite up to 12 travelers · free forever for ≤ 2 trips
        </p>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4">
        {[
          { bg: 'var(--wb-sun)', icon: '🗳', title: 'Vote, don\'t argue', body: 'Everyone suggests ideas. Everyone votes. Owner locks the plan.' },
          { bg: 'var(--wb-sky)', icon: '🗺', title: 'Map as canvas',     body: 'Drag activities onto a real map. See weather and golden hour per stop.' },
          { bg: 'var(--wb-moss)', icon: '₹', title: 'Split without math', body: 'Log a bill once. We settle debts with the fewest transfers.' },
        ].map((f) => (
          <div key={f.title} className="p-6 rounded-[16px] border" style={{ background: '#fff', borderColor: 'var(--wb-line)' }}>
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-xl text-wb-ink" style={{ background: f.bg }}>
              {f.icon}
            </div>
            <h4 className="font-fraunces text-xl font-bold mt-3.5 mb-1.5 tracking-tight" style={{ color: 'var(--wb-ink)' }}>{f.title}</h4>
            <p className="text-[13px]" style={{ color: 'var(--wb-ink-soft)' }}>{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Create trip modal ─────────────────────────────────────────────────────────

function CreateTripModal({ userId, onClose, onCreated }: {
  userId: any; onClose: () => void; onCreated: (t: Trip) => void;
}) {
  const [name, setName]                     = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [destinationCities, setDestinationCities] = useState<string[]>([]);
  const [startDate, setStartDate]           = useState('');
  const [endDate, setEndDate]               = useState('');
  const [currency, setCurrency]             = useState(DEFAULT_TRIP_CURRENCY);
  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);

  const destinationInputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef     = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries: CREATE_TRIP_MAP_LIBRARIES,
  });

  function addDestinationCity(city: string) {
    const normalized = normalizeCity(city);
    if (!normalized) return;
    setDestinationCities((prev) => {
      if (prev.some((e) => e.toLowerCase() === normalized.toLowerCase())) return prev;
      return [...prev, normalized];
    });
  }

  function commitDestinationInput() {
    const parsed = parseCityTokens(destinationInput);
    if (parsed.length === 0) { setDestinationInput(''); return; }
    parsed.forEach(addDestinationCity);
    setDestinationInput('');
  }

  useEffect(() => {
    if (!isLoaded || !destinationInputRef.current || autocompleteRef.current) return;
    let listener: google.maps.MapsEventListener | null = null;
    try {
      const ac = new window.google.maps.places.Autocomplete(
        destinationInputRef.current,
        { types: ['(cities)'], fields: ['formatted_address'] },
      );
      autocompleteRef.current = ac;
      listener = ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place?.formatted_address) return;
        addDestinationCity(place.formatted_address);
        setDestinationInput('');
        window.setTimeout(() => destinationInputRef.current?.focus(), 0);
      });
    } catch (err) {
      console.error('[CreateTripModal] Places autocomplete init failed:', err);
    }
    return () => { listener?.remove(); };
  }, [isLoaded]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const pendingCities = parseCityTokens(destinationInput);
    const merged = [...destinationCities];
    for (const c of pendingCities) {
      if (!merged.some((x) => x.toLowerCase() === c.toLowerCase())) merged.push(c);
    }
    const trimmedDestination = merged.join('; ');
    if (!trimmedDestination) { setError('Please add at least one city.'); return; }
    if (!isLoaded || loadError) { setError('Google Places is unavailable. Please try again.'); return; }
    if (new Date(endDate) < new Date(startDate)) { setError('End date must be after start date.'); return; }

    setLoading(true);
    let destinationLocation: { lat: number; lng: number } | undefined;
    let destinationPlaceId: string | undefined;
    let destinationPlaceName: string | undefined;

    try {
      const resolved = await resolvePlaceCoordinates(merged[0]);
      if (!resolved) { setLoading(false); setError('Could not resolve destination coordinates.'); return; }
      destinationLocation  = resolved.location;
      destinationPlaceId   = resolved.placeId;
      destinationPlaceName = resolved.name;
    } catch (placeError: any) {
      setLoading(false);
      setError(placeError?.message ?? 'Failed to resolve destination coordinates.');
      return;
    }

    const destinationCitiesPayload = merged.map((city, index) => ({
      name: city,
      placeId: index === 0 ? destinationPlaceId : undefined,
      location: index === 0 ? destinationLocation : undefined,
    }));

    const result = await createTrip({
      name, destination: trimmedDestination,
      destinationCities: destinationCitiesPayload,
      selectedDestinationCity: destinationCitiesPayload[0]?.name,
      destinationLocation, destinationPlaceId, destinationPlaceName,
      currency, startDate, endDate,
      ownerId: userId.uid,
      ownerDisplayName: userId.displayName ?? 'Traveler',
      ownerEmail: userId.email ?? '',
      ownerPhotoURL: userId.photoURL,
    });
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    onCreated(result.data);
  }

  const QUICK_PICKS = ['🏔 Manali', '🌊 Goa', '❄ Spiti', '🌴 Andaman', '🌸 Tokyo'];

  return (
    <WBModal onClose={onClose}>
      <div className="mb-1.5">
        <Sticker color="sun" rotation="left">✦ New adventure</Sticker>
      </div>
      <h2 className="font-fraunces text-[32px] font-bold tracking-tight leading-tight mt-2 mb-1.5" style={{ color: 'var(--wb-ink)' }}>
        Where to{' '}
        <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>next?</em>
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--wb-ink-soft)' }}>
        We'll spin up a workspace, generate an invite code, and seed a starter itinerary.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <WBField label="Trip name" id="tname">
          <input id="tname" required value={name} onChange={(e) => setName(e.target.value)} className="wb-input" placeholder="Himalayan Heist" />
        </WBField>

        <WBField label="Destination" id="dest">
          <div
            className="w-full rounded-[10px] border-[1.5px] px-3 py-2 text-sm focus-within:border-wb-ink focus-within:shadow-[0_0_0_4px_rgba(245,165,36,0.25)] min-h-[46px] flex flex-wrap items-center gap-2 cursor-text transition-all"
            style={{ borderColor: 'var(--wb-line)', background: 'var(--wb-paper-2)' }}
            onClick={() => destinationInputRef.current?.focus()}
          >
            {destinationCities.map((city, idx) => (
              <span
                key={`${city}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ background: 'var(--wb-sun)', color: 'var(--wb-ink)' }}
              >
                {city}
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); setDestinationCities((prev) => prev.filter((_, i) => i !== idx)); }}
                  className="opacity-60 hover:opacity-100"
                >×</button>
              </span>
            ))}
            <input
              id="dest"
              ref={destinationInputRef}
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ';' || e.key === 'Tab') && destinationInput.trim()) {
                  e.preventDefault(); commitDestinationInput();
                } else if (e.key === 'Backspace' && !destinationInput && destinationCities.length > 0) {
                  setDestinationCities((prev) => prev.slice(0, -1));
                }
              }}
              className="flex-1 min-w-[12rem] border-0 bg-transparent text-sm outline-none"
              placeholder={destinationCities.length > 0 ? 'Add another city…' : 'Type and press Enter to add city'}
              autoComplete="off"
              style={{ color: 'var(--wb-ink)' }}
            />
          </div>
          {loadError && <p className="mt-1 text-xs" style={{ color: 'var(--wb-sunset)' }}>Autocomplete unavailable — type manually.</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {QUICK_PICKS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => addDestinationCity(p.split(' ').slice(1).join(' '))}
                className="border-[1.5px] rounded-full px-2.5 py-1 text-xs font-semibold hover:border-wb-ink transition-colors"
                style={{ borderColor: 'var(--wb-line)', background: '#fff', color: 'var(--wb-ink)' }}
              >
                {p}
              </button>
            ))}
          </div>
        </WBField>

        <WBField label="Currency" id="currency">
          <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="wb-input">
            {TRIP_CURRENCY_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </select>
        </WBField>

        <div className="grid grid-cols-2 gap-3">
          <WBField label="Start date" id="sd">
            <input id="sd" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="wb-input" />
          </WBField>
          <WBField label="End date" id="ed">
            <input id="ed" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="wb-input" />
          </WBField>
        </div>

        <button type="submit" disabled={loading} className="wb-btn wb-btn-primary w-full wb-btn-lg mt-1 disabled:opacity-60">
          {loading ? 'Creating…' : 'Create trip →'}
        </button>
      </form>
      <p className="text-xs text-center mt-3.5" style={{ color: 'var(--wb-ink-soft)' }}>Invite 5 more · up to 12 travelers</p>
    </WBModal>
  );
}

// ─── Join trip modal ───────────────────────────────────────────────────────────

function JoinTripModal({ user, onClose, onJoined }: {
  user: any; onClose: () => void; onJoined: (t: Trip) => void;
}) {
  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const b0 = useRef<HTMLInputElement>(null);
  const b1 = useRef<HTMLInputElement>(null);
  const b2 = useRef<HTMLInputElement>(null);
  const b3 = useRef<HTMLInputElement>(null);
  const b4 = useRef<HTMLInputElement>(null);
  const b5 = useRef<HTMLInputElement>(null);
  const boxRefs = [b0, b1, b2, b3, b4, b5];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await joinTrip({
      rawCode: code,
      userId: user.uid,
      displayName: user.displayName ?? 'Traveler',
      email: user.email ?? '',
      photoURL: user.photoURL,
    });
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    onJoined(result.data);
  }

  function handleBoxChange(idx: number, val: string) {
    const char = val.toUpperCase().slice(-1);
    const chars = code.padEnd(6, ' ').split('');
    chars[idx] = char || ' ';
    const newCode = chars.join('').trimEnd();
    setCode(newCode);
    if (char && idx < 5) boxRefs[idx + 1].current?.focus();
  }

  function handleBoxKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) boxRefs[idx - 1].current?.focus();
  }

  return (
    <WBModal onClose={onClose}>
      <Sticker color="coral">🧩 Invite code</Sticker>
      <h2 className="font-fraunces text-[32px] font-bold tracking-tight leading-tight mt-3 mb-1.5" style={{ color: 'var(--wb-ink)' }}>
        Join the{' '}
        <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>group.</em>
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--wb-ink-soft)' }}>Got a 6-character code from a friend? Drop it in.</p>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2 justify-between mb-2">
          {Array.from({ length: 6 }, (_, idx) => (
            <input
              key={idx}
              ref={boxRefs[idx]}
              maxLength={1}
              value={code[idx] ?? ''}
              onChange={(e) => handleBoxChange(idx, e.target.value)}
              onKeyDown={(e) => handleBoxKeyDown(idx, e)}
              className="w-[54px] h-16 text-center font-jetbrains font-bold text-3xl rounded-xl border-2 focus:outline-none focus:border-wb-ink transition-colors"
              style={{
                borderColor: 'var(--wb-line)',
                background: '#fff',
                color: 'var(--wb-ink)',
                boxShadow: code[idx] ? '0 0 0 4px rgba(245,165,36,0.25)' : undefined,
              }}
            />
          ))}
        </div>
        <button type="submit" disabled={loading || code.replace(/\s/g, '').length < 6} className="wb-btn wb-btn-primary w-full wb-btn-lg mt-4 disabled:opacity-60">
          {loading ? 'Joining…' : 'Find my trip →'}
        </button>
      </form>
      <p className="text-xs text-center mt-3.5" style={{ color: 'var(--wb-ink-soft)' }}>Codes are case-insensitive · expire after 7 days</p>
    </WBModal>
  );
}

// ─── Local WB modal wrapper ────────────────────────────────────────────────────

function WBModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: 'rgba(15,28,46,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[520px] rounded-[20px] p-8"
        style={{ background: 'var(--wb-paper)', border: '1.5px solid var(--wb-ink)', boxShadow: 'var(--wb-shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white border flex items-center justify-center text-lg font-bold hover:bg-wb-paper-2 transition-colors"
          style={{ borderColor: 'var(--wb-line)', color: 'var(--wb-ink)' }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function WBField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold mb-1.5" style={{ color: 'var(--wb-ink)' }}>{label}</label>
      {children}
    </div>
  );
}
