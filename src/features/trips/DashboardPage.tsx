import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTripStore } from './useTripStore';
import { getUserTrips, createTrip, joinTrip } from './tripService';
import { signOut } from '@/features/auth/authService';
import { ROUTES } from '@/config/routes';
import type { Trip } from '@/types';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const { trips, tripsLoading, tripsError, setTrips, addTrip, setLoading, setError, reset } = useTripStore();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin]     = useState(false);

  // Load trips on mount
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserTrips(user.uid).then((result) => {
      if (result.ok) setTrips(result.data);
      else setError(result.error);
    });
  }, [user]);

  async function handleSignOut() {
    await signOut();
    reset();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">WanderBoard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.displayName ?? user?.email}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-gray-900">Your trips</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoin(true)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Join trip
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              New trip
            </button>
          </div>
        </div>

        {tripsLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {tripsError   && <p className="text-sm text-red-600">{tripsError}</p>}

        {!tripsLoading && trips.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <p className="text-gray-400 text-sm">No trips yet — create one or join with a code.</p>
          </div>
        )}

        <div className="space-y-3">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              ownerId={user!.uid}
              onClick={() => navigate(ROUTES.trip(trip.id))}
            />
          ))}
        </div>
      </main>

      {showCreate && (
        <CreateTripModal
          userId={user!}
          onClose={() => setShowCreate(false)}
          onCreated={(t) => { addTrip(t); setShowCreate(false); navigate(ROUTES.trip(t.id)); }}
        />
      )}
      {showJoin && (
        <JoinTripModal
          user={user!}
          onClose={() => setShowJoin(false)}
          onJoined={(t) => { addTrip(t); setShowJoin(false); navigate(ROUTES.trip(t.id)); }}
        />
      )}
    </div>
  );
}

// ─── Trip card ─────────────────────────────────────────────────────────────────

function TripCard({ trip, ownerId, onClick }: { trip: Trip; ownerId: string; onClick: () => void }) {
  const isOwner = trip.ownerId === ownerId;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl bg-white border border-gray-100 px-5 py-4 hover:border-indigo-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900">{trip.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">{trip.destination}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          isOwner
            ? 'bg-indigo-50 text-indigo-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {isOwner ? 'Owner' : 'Member'}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-2">{trip.startDate} → {trip.endDate}</p>
    </button>
  );
}

// ─── Create trip modal ─────────────────────────────────────────────────────────

function CreateTripModal({ userId, onClose, onCreated }: {
  userId: any; onClose: () => void; onCreated: (t: Trip) => void;
}) {
  const [name, setName]               = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be after start date.');
      return;
    }
    setLoading(true);
    const result = await createTrip({
      name, destination, startDate, endDate,
      ownerId: userId.uid,
      ownerDisplayName: userId.displayName ?? 'Traveler',
      ownerEmail: userId.email ?? '',
      ownerPhotoURL: userId.photoURL,
    });
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    onCreated(result.data);
  }

  return (
    <Modal title="New trip" onClose={onClose}>
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Trip name" id="tname"><input id="tname" required value={name} onChange={e=>setName(e.target.value)} className={inputCls} placeholder="Himachal Adventure"/></Field>
        <Field label="Destination" id="dest"><input id="dest" required value={destination} onChange={e=>setDestination(e.target.value)} className={inputCls} placeholder="Manali, Himachal Pradesh"/></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" id="sd"><input id="sd" type="date" required value={startDate} onChange={e=>setStartDate(e.target.value)} className={inputCls}/></Field>
          <Field label="End date" id="ed"><input id="ed" type="date" required value={endDate} onChange={e=>setEndDate(e.target.value)} className={inputCls}/></Field>
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {loading ? 'Creating…' : 'Create trip'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Join trip modal ───────────────────────────────────────────────────────────

function JoinTripModal({ user, onClose, onJoined }: {
  user: any; onClose: () => void; onJoined: (t: Trip) => void;
}) {
  const [code, setCode]     = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal title="Join a trip" onClose={onClose}>
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Invite code" id="code">
          <input
            id="code" required maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className={`${inputCls} tracking-widest text-center text-lg font-mono`}
            placeholder="XJ92L1"
          />
        </Field>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {loading ? 'Joining…' : 'Join trip'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Shared UI helpers ─────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
