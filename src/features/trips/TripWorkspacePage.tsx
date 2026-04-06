import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SearchBar } from '@/features/discovery/components/SearchBar';
import { DiscoveryList } from '@/features/discovery/components/DiscoveryList';
import type { Place } from '@/features/discovery/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROUTES } from '@/config/routes';
import type { TripMember } from '@/types';
import { getTrip, getTripMembers } from './tripService';
import { useTripStore } from './useTripStore';

export function TripWorkspacePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeTrip, members, setActiveTrip, setMembers } = useTripStore();

  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) {
      navigate(ROUTES.DASHBOARD);
      return;
    }

    Promise.all([getTrip(tripId), getTripMembers(tripId)]).then(([tripResult, membersResult]) => {
      if (!tripResult.ok) {
        navigate(ROUTES.DASHBOARD);
        return;
      }

      setActiveTrip(tripResult.data);
      if (membersResult.ok) {
        setMembers(membersResult.data);
      }
    });

    return () => setActiveTrip(null);
  }, [tripId, navigate, setActiveTrip, setMembers]);

  const isOwner = activeTrip?.ownerId === user?.uid;

  if (!activeTrip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading trip...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link to={ROUTES.DASHBOARD} className="text-sm text-gray-400 hover:text-gray-700">Back to Trips</Link>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">{activeTrip.name}</h1>
          <p className="text-xs text-gray-400">{activeTrip.destination} - {activeTrip.startDate} to {activeTrip.endDate}</p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full">
            Trip owner
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          <FeaturePlaceholder title="Bucket list" description="Add and vote on activities - coming in week 2" />
          <FeaturePlaceholder title="Timeline" description={isOwner ? 'Finalize the itinerary' : 'View the finalized plan'} locked={!isOwner} />
          <FeaturePlaceholder title="Weather and alerts" description="Environmental data dashboard - coming in week 2" />
          <FeaturePlaceholder title="Expenses" description="Track and split costs - coming in week 3" />

          <section className="rounded-xl border border-gray-100 bg-white p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Discover places</h2>
              <p className="text-xs text-gray-500">Search for places around your trip destination.</p>
            </div>

            <SearchBar
              onResults={setPlaces}
              onLoadingChange={setLoadingPlaces}
              onErrorChange={setSearchError}
            />

            {searchError && (
              <p className="text-xs text-rose-600">{searchError}</p>
            )}

            <DiscoveryList places={places} loading={loadingPlaces} />
          </section>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
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
                <MemberRow key={member.userId} member={member} isCurrentUser={member.userId === user?.uid} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MemberRow({ member, isCurrentUser }: { member: TripMember; isCurrentUser: boolean }) {
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
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
        member.role === 'owner'
          ? 'bg-indigo-50 text-indigo-600'
          : 'bg-gray-100 text-gray-500'
      }`}>
        {member.role}
      </span>
    </div>
  );
}

function FeaturePlaceholder({ title, description, locked }: {
  title: string;
  description: string;
  locked?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-5 py-4 ${locked ? 'border-dashed border-amber-200 bg-amber-50/50' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{title}</p>
        {locked && <span className="text-xs text-amber-600 font-medium">Owner only</span>}
      </div>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}
