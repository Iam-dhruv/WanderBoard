import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROUTES } from '@/config/routes';
import type { TripMember } from '@/types';
import { getTrip, getTripMembers } from './tripService';
import { useTripStore } from './useTripStore';

export function TripWorkspacePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user }   = useAuth();
  const location   = useNavigate();
  const navigate   = useNavigate();
  const loc        = useLocation();
  const { activeTrip, members, setActiveTrip, setMembers } = useTripStore();

  useEffect(() => {
    let cancelled = false;

    if (!tripId) {
      navigate(ROUTES.DASHBOARD, { replace: true });
      return () => { cancelled = true; };
    }

    Promise.all([getTrip(tripId), getTripMembers(tripId)]).then(
      ([tripResult, membersResult]) => {
        if (cancelled) return;
        if (!tripResult.ok) {
          navigate(ROUTES.DASHBOARD, { replace: true });
          return;
        }
        setActiveTrip(tripResult.data);
        if (membersResult.ok) setMembers(membersResult.data);
      },
    );

    return () => {
      cancelled = true;
      setActiveTrip(null);
    };
  }, [tripId, navigate, setActiveTrip, setMembers]);

  const isOwner         = activeTrip?.ownerId === user?.uid;
  // Both discovery and timeline get the full-height full-screen layout
  const isFullScreen    = loc.pathname.includes('/discovery') ||
                          loc.pathname.includes('/timeline');

  if (!activeTrip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading trip...</p>
      </div>
    );
  }

  return (
    <div
      className={
        isFullScreen
          ? 'h-screen overflow-hidden bg-gray-50 flex flex-col'
          : 'min-h-screen bg-gray-50'
      }
    >
      {/* Top header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <Link to={ROUTES.DASHBOARD} className="text-sm text-gray-400 hover:text-gray-700">
          Back to Trips
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{activeTrip.name}</h1>
          <p className="text-xs text-gray-400 truncate">
            {activeTrip.destination} | {activeTrip.startDate} to {activeTrip.endDate}
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full">
            Trip owner
          </div>
        )}
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <nav className="max-w-6xl mx-auto px-6 flex items-center gap-2 overflow-x-auto py-3">
          <TabLink to="planning"    label="Planning" />
          <TabLink to="bucket-list" label="Bucket list" />
          <TabLink to="discovery"   label="Discovery" />
          <TabLink to="timeline"    label="Timeline" />
          <TabLink to="expenses"    label="Expenses" />
          <TabLink to="contingency" label="Contingency" />
        </nav>
      </div>

      {/* Content */}
      {isFullScreen ? (
        <main className="flex-1 min-h-0">
          <Outlet />
        </main>
      ) : (
        <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <section className="lg:col-span-2 min-w-0 space-y-6">
            <Outlet />
          </section>

          <aside>
            <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Travelers</h3>
                <span className="text-xs text-gray-400">{members.length}</span>
              </div>

              {isOwner && (
                <div className="mb-4 bg-gray-50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-500 mb-1">Invite code</p>
                  <p className="font-mono font-semibold text-gray-900 tracking-widest text-sm">
                    {activeTrip.inviteCode}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Share with group members</p>
                </div>
              )}

              <div className="space-y-2">
                {members.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    isCurrentUser={member.userId === user?.uid}
                  />
                ))}
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  );
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  );
}

function MemberRow({
  member,
  isCurrentUser,
}: {
  member: TripMember;
  isCurrentUser: boolean;
}) {
  const initials = member.displayName
    .split(' ')
    .map((name) => name[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {member.displayName}
          {isCurrentUser && <span className="text-gray-400 font-normal"> (you)</span>}
        </p>
      </div>
      <span
        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
          member.role === 'owner'
            ? 'bg-indigo-50 text-indigo-600'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {member.role}
      </span>
    </div>
  );
}
