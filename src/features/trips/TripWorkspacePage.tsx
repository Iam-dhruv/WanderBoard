import { createContext, useContext, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { NavLink, Outlet, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROUTES } from '@/config/routes';
import type { Trip, TripMember } from '@/types';
import { getTrip, getTripMembers } from './tripService';
import { useTripStore } from './useTripStore';
import { useWeatherStore } from '@/features/weather';
import { getCoordinatesFromCity, type Coordinates } from '@/features/weather/geocodingService';
import { Avatar } from '@/components/Avatar';
import { MapView } from '@/components/MapView';
import { TripMapProvider, useTripMap } from './TripMapContext';

// ─── Geocoding context (destination lat/lon for weather + initial map centre) ──

export type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; coords: Coordinates };

interface TripGeoContextValue { geo: GeoState }
const TripGeoContext = createContext<TripGeoContextValue>({ geo: { status: 'idle' } });

export function useTripGeo(): TripGeoContextValue {
  return useContext(TripGeoContext);
}

// ─── Workspace tabs config ─────────────────────────────────────────────────────

const TABS = (tripId: string) => [
  { label: 'Plan',        to: ROUTES.tripPlanning(tripId) },
  { label: 'Timeline',    to: ROUTES.tripTimeline(tripId) },
  { label: 'Bucket list', to: ROUTES.tripBucketList(tripId) },
  { label: 'Discover',    to: ROUTES.tripDiscovery(tripId) },
  { label: 'Forecast',    to: ROUTES.tripWeather(tripId) },
  { label: 'Expenses',    to: ROUTES.tripExpenses(tripId) },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export function TripWorkspacePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { activeTrip, members, setActiveTrip, setMembers } = useTripStore();
  const resetWeather = useWeatherStore((s) => s.reset);

  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    if (!tripId) { navigate(ROUTES.DASHBOARD, { replace: true }); return; }
    Promise.all([getTrip(tripId), getTripMembers(tripId)]).then(
      ([tripResult, membersResult]) => {
        if (cancelled) return;
        if (!tripResult.ok) { navigate(ROUTES.DASHBOARD, { replace: true }); return; }
        setActiveTrip(tripResult.data);
        if (membersResult.ok) setMembers(membersResult.data);
      },
    );
    return () => {
      cancelled = true;
      setActiveTrip(null);
      resetWeather();
    };
  }, [tripId, navigate, setActiveTrip, setMembers, resetWeather]);

  useEffect(() => {
    if (!activeTrip) {
      setGeo({ status: 'idle' });
      return;
    }

    // Primary source: persisted destination coordinates from trip creation.
    if (activeTrip.destinationLocation) {
      setGeo({
        status: 'ready',
        coords: {
          lat: activeTrip.destinationLocation.lat,
          lon: activeTrip.destinationLocation.lng,
          resolvedName: activeTrip.destinationPlaceName ?? activeTrip.destination,
        },
      });
      return;
    }

    if (!activeTrip.destination) {
      setGeo({ status: 'idle' });
      return;
    }

    // Fallback for older trips without persisted destinationLocation.
    setGeo({ status: 'loading' });
    const primaryCity = activeTrip.destination.split(';')[0].trim();
    getCoordinatesFromCity(primaryCity, { placeId: activeTrip.destinationPlaceId }).then((result) => {
      setGeo(result.ok ? { status: 'ready', coords: result.data } : { status: 'error', message: result.error });
    });
  }, [
    activeTrip,
    activeTrip?.destination,
    activeTrip?.destinationLocation,
    activeTrip?.destinationPlaceId,
    activeTrip?.destinationPlaceName,
  ]);

  const isOwner = activeTrip?.ownerId === user?.uid;

  if (!activeTrip) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--wb-paper)' }}>
        <div className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>Loading trip…</div>
      </div>
    );
  }

  return (
    <TripGeoContext.Provider value={{ geo }}>
      <TripMapProvider>
        <WorkspaceShell
          geo={geo}
          isOwner={isOwner}
          members={members}
          activeTrip={activeTrip}
          user={user}
        />
      </TripMapProvider>
    </TripGeoContext.Provider>
  );
}

// ─── Shell (needs TripMapContext) ──────────────────────────────────────────────

function WorkspaceShell({
  geo, isOwner, members, activeTrip, user,
}: {
  geo: GeoState;
  isOwner: boolean;
  members: TripMember[];
  activeTrip: Trip;
  user: ReturnType<typeof useAuth>['user'];
}) {
  const location = useLocation();
  const isDiscovery = location.pathname.includes('/discovery');
  const isTimeline = location.pathname.includes('/timeline');
  const isForecast = location.pathname.includes('/weather');
  const hasCustomPanelHeader = isDiscovery || isTimeline || isForecast;
  const [rightPanelWidth, setRightPanelWidth] = useState(() => Math.floor(window.innerWidth * 0.5));
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isOffHomeCenter, setIsOffHomeCenter] = useState(false);

  const homeCenter = useMemo(
    () => (geo.status === 'ready' ? { lat: geo.coords.lat, lng: geo.coords.lon } : null),
    [geo.status, geo.status === 'ready' ? geo.coords.lat : null, geo.status === 'ready' ? geo.coords.lon : null],
  );

  const {
    mapRef, mapMarkers, selectedMarkerId, hoveredMarkerId, renderInfoWindow,
    setMapLoaded, setIdleTick, setSelectedMarkerId,
  } = useTripMap();

  // Markers with highlighted state computed here (not stored in context)
  const displayMarkers = mapMarkers.map((m) => ({
    ...m,
    highlighted: m.id === selectedMarkerId || m.id === hoveredMarkerId,
  }));

  function handleMapLoad(map: google.maps.Map) {
    mapRef.current = map;
    setMapLoaded(true);
    setMapReadyTick((t) => t + 1);
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleIdle = () => {
      setIdleTick((t) => t + 1);

      if (!homeCenter || !window.google?.maps?.geometry?.spherical) {
        setIsOffHomeCenter(false);
        return;
      }

      const center = map.getCenter();
      if (!center) {
        setIsOffHomeCenter(false);
        return;
      }

      const homeLatLng = new window.google.maps.LatLng(homeCenter.lat, homeCenter.lng);
      const distance = window.google.maps.geometry.spherical.computeDistanceBetween(center, homeLatLng);
      setIsOffHomeCenter(distance > 250);
    };

    const listener = map.addListener('idle', handleIdle);
    handleIdle();

    return () => {
      listener.remove();
    };
  }, [mapReadyTick, homeCenter, mapRef, setIdleTick]);

  useEffect(() => {
    if (!homeCenter) {
      setIsOffHomeCenter(false);
      return;
    }
    setRecenterTrigger((t) => t + 1);
    setIsOffHomeCenter(false);
  }, [homeCenter]);

  function handleMarkerClick(id: string) {
    setSelectedMarkerId(selectedMarkerId === id ? null : id);
  }

  function startRightPanelResize(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();

    const minWidth = 320;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const maxWidth = Math.floor(window.innerWidth * 0.5);
      const nextWidth = window.innerWidth - moveEvent.clientX;
      setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, nextWidth)));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: 'var(--wb-paper)' }}>

      {/* ── App nav ── */}
      <header
        className="flex items-center gap-5 px-8 py-4 flex-shrink-0"
        style={{ background: 'var(--wb-paper)', borderBottom: '1px solid var(--wb-line)' }}
      >
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
        <nav className="flex gap-1 ml-5">
          <Link to={ROUTES.DASHBOARD} className="px-3 py-[7px] rounded-lg text-sm font-medium hover:bg-wb-paper-2 transition-colors" style={{ color: 'var(--wb-ink-soft)' }}>
            My Trips
          </Link>
          <span className="px-3 py-[7px] rounded-lg text-sm font-semibold" style={{ background: 'var(--wb-ink)', color: '#fff' }}>
            {activeTrip.name}
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="wb-sticker sun rot-r text-xs">{getDaysToGo(activeTrip.startDate)} days to go</span>
          {user && <Avatar displayName={user.displayName ?? user.email ?? 'U'} photoURL={user.photoURL} size="md" />}
        </div>
      </header>

      {/* ── Workspace top bar ── */}
      <div
        className="flex items-center gap-4 px-6 py-3.5 flex-shrink-0"
        style={{ background: '#fff', borderBottom: '1px solid var(--wb-line)' }}
      >
        <Link
          to={ROUTES.DASHBOARD}
          className="flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70"
          style={{ color: 'var(--wb-ink-soft)' }}
        >
          ← All trips
        </Link>

        <div className="ml-2">
          <h1 className="font-fraunces text-[22px] font-bold leading-tight tracking-tight" style={{ color: 'var(--wb-ink)' }}>
            {activeTrip.name}
          </h1>
          <p className="text-xs" style={{ color: 'var(--wb-ink-soft)' }}>
            {activeTrip.destination} · {activeTrip.startDate} → {activeTrip.endDate} ·{' '}
            <span className="font-semibold" style={{ color: 'var(--wb-ink)' }}>
              {isOwner ? "You're the owner" : 'You are a member'}
            </span>
          </p>
        </div>

        {/* Tab segmented control */}
        <div className="ml-5 flex gap-1 p-1 rounded-[10px]" style={{ background: 'var(--wb-paper-2)' }}>
          {TABS(activeTrip.id).map(({ label, to }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) => [
                'px-3 py-[7px] rounded-[7px] text-[13px] font-semibold transition-all duration-[120ms]',
                isActive ? 'bg-white shadow-wb-sm text-wb-ink' : 'text-wb-ink-soft hover:text-wb-ink',
              ].join(' ')}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--wb-moss)', boxShadow: '0 0 0 3px rgba(107,143,62,0.25)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--wb-ink-soft)' }}>
              {members.length} planning now
            </span>
          </div>
          <button
            onClick={() => setIsRightPanelCollapsed((prev) => !prev)}
            className="wb-btn wb-btn-ghost wb-btn-sm"
          >
            {isRightPanelCollapsed ? 'Show panel' : 'Hide panel'}
          </button>
          <button className="wb-btn wb-btn-ghost wb-btn-sm">Share</button>
          <button className="wb-btn wb-btn-accent wb-btn-sm">Publish itinerary</button>
        </div>
      </div>

      {/* ── Split pane ── */}
      <div className="flex-1 min-h-0 flex">

        {/* LEFT: Shared map canvas */}
        <div
          className={[ 'relative overflow-hidden flex-1 min-w-0', !isRightPanelCollapsed ? 'border-r' : '' ].join(' ')}
          style={{
            borderColor: 'var(--wb-line)',
            background: 'radial-gradient(1200px 700px at 30% 30%, #DDEAF3, transparent 60%), radial-gradient(900px 500px at 70% 80%, #FAEFD9, transparent 60%), #EEE4CC',
          }}
        >
          <MapView
            center={homeCenter ?? undefined}
            zoom={isDiscovery ? 13 : 11}
            recenterTrigger={recenterTrigger}
            markers={displayMarkers}
            selectedMarkerId={selectedMarkerId ?? undefined}
            onMarkerClick={handleMarkerClick}
            onInfoWindowClose={() => setSelectedMarkerId(null)}
            renderInfoWindow={renderInfoWindow ?? undefined}
            onLoad={handleMapLoad}
            onUnmount={() => { mapRef.current = null; }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />

          {/* Map chrome chips */}
          <div className="absolute left-4 top-4 flex flex-col gap-2 z-10">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold"
              style={{ background: '#fff', border: '1.5px solid var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)', color: 'var(--wb-ink)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {isDiscovery ? 'Discover' : 'Route view'}
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold"
              style={{ background: 'var(--wb-paper-2)', border: '1.5px solid var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)', color: 'var(--wb-ink)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {activeTrip.destination}
            </div>
          </div>

          {/* Zoom controls — wired to shared mapRef */}
          <div
            className="absolute right-4 top-4 z-10 overflow-hidden rounded-[10px]"
            style={{ border: '1.5px solid var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)' }}
          >
            <button
              onClick={() => { const z = mapRef.current?.getZoom() ?? 12; mapRef.current?.setZoom(z + 1); }}
              className="w-9 h-9 bg-white flex items-center justify-center text-lg font-bold hover:bg-wb-paper-2 transition-colors"
              style={{ color: 'var(--wb-ink)' }}
            >+</button>
            <button
              onClick={() => { const z = mapRef.current?.getZoom() ?? 12; mapRef.current?.setZoom(z - 1); }}
              className="w-9 h-9 bg-white flex items-center justify-center text-lg font-bold border-t hover:bg-wb-paper-2 transition-colors"
              style={{ color: 'var(--wb-ink)', borderColor: 'var(--wb-line)' }}
            >−</button>
            {geo.status === 'ready' && (
              <button
                onClick={() => {
                  if (!homeCenter) return;
                  mapRef.current?.panTo(homeCenter);
                  mapRef.current?.setZoom(isDiscovery ? 13 : 11);
                }}
                className="w-9 h-9 bg-white flex items-center justify-center text-sm font-bold border-t hover:bg-wb-paper-2 transition-colors"
                style={{
                  color: 'var(--wb-ink)',
                  borderColor: 'var(--wb-line)',
                  opacity: isOffHomeCenter ? 1 : 0.55,
                }}
                title="Recenter on destination"
              >
                ◎
              </button>
            )}
          </div>

          {isRightPanelCollapsed && (
            <button
              onClick={() => setIsRightPanelCollapsed(false)}
              className="absolute right-4 top-20 z-10 rounded-[10px] px-3 py-2 text-xs font-semibold"
              style={{ background: '#fff', border: '1.5px solid var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)', color: 'var(--wb-ink)' }}
            >
              Show panel
            </button>
          )}
          {/* Members panel */}
          <div
            className="absolute bottom-4 left-4 z-10 rounded-[14px] p-3 w-[220px]"
            style={{ background: '#fff', border: '1.5px solid var(--wb-line)', boxShadow: 'var(--wb-shadow-md)' }}
          >
            <h5 className="text-[11px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--wb-ink-soft)' }}>
              Travelers · {members.length}
            </h5>
            {members.map((m) => (
              <MemberRow key={m.userId} member={m} isCurrentUser={m.userId === user?.uid} />
            ))}
            {isOwner && activeTrip.inviteCode && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--wb-line)' }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--wb-ink-soft)' }}>Invite code</p>
                <p className="font-jetbrains font-bold tracking-widest text-sm" style={{ color: 'var(--wb-ink)' }}>
                  {activeTrip.inviteCode}
                </p>
              </div>
            )}
          </div>
        </div>

        {!isRightPanelCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={startRightPanelResize}
            className="w-2 cursor-col-resize flex-shrink-0"
            style={{ background: 'var(--wb-paper-2)', borderLeft: '1px solid var(--wb-line)', borderRight: '1px solid var(--wb-line)' }}
          />
        )}

        {/* RIGHT: feature panel */}
        {!isRightPanelCollapsed && (
        <div
          className="flex flex-col overflow-hidden flex-shrink-0"
          style={{ background: 'var(--wb-paper)', width: rightPanelWidth, maxWidth: '50vw' }}
        >
          {/* Header — hidden for Discovery (it renders its own) */}
          {!hasCustomPanelHeader && (
            <div className="px-6 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--wb-line)' }}>
              <div className="flex items-center justify-between">
                <h2
                  className="font-fraunces text-[28px] font-bold leading-tight tracking-tight"
                  style={{ color: 'var(--wb-ink)' }}
                >
                  Day{' '}
                  <em className="italic" style={{ color: 'var(--wb-sunset)', fontVariationSettings: '"SOFT" 100' }}>by</em>
                  {' '}day
                </h2>
                <button
                  className="wb-btn wb-btn-sm flex items-center gap-1.5"
                  style={{ background: 'var(--wb-paper-2)', color: 'var(--wb-ink)', border: '1.5px solid var(--wb-line)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Edit
                </button>
              </div>
              <p className="text-[13px] mt-1" style={{ color: 'var(--wb-ink-soft)' }}>
                Drag activities from the bucket list into slots. {isOwner ? 'You can reorder.' : 'Owner can reorder.'}
              </p>
            </div>
          )}

          {/* Scrollable content — Discovery manages its own scroll */}
          <div className={hasCustomPanelHeader ? 'flex-1 overflow-hidden' : 'flex-1 overflow-y-auto'}>
            <Outlet />
          </div>
        </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MemberRow({ member, isCurrentUser }: { member: TripMember; isCurrentUser: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="relative">
        <Avatar displayName={member.displayName} photoURL={member.photoURL} size="sm" />
        <span className="absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full border-2 border-white" style={{ background: 'var(--wb-moss)' }} />
      </div>
      <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: 'var(--wb-ink)' }}>
        {member.displayName}{isCurrentUser && <span style={{ color: 'var(--wb-ink-soft)', fontWeight: 400 }}> (you)</span>}
      </span>
      <span className="text-[10px] uppercase tracking-[0.1em] flex-shrink-0" style={{ color: 'var(--wb-ink-soft)' }}>{member.role}</span>
    </div>
  );
}

function getDaysToGo(startDate: string): number {
  return Math.max(0, Math.ceil((new Date(startDate).getTime() - Date.now()) / 86400000));
}
