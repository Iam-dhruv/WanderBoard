import { createContext, useContext, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROUTES } from '@/config/routes';
import type { Trip, TripDestinationCity, TripMember } from '@/types';
import { appendTripDestinationCity, getTrip, getTripMembers, setSelectedDestinationCity } from './tripService';
import { useTripStore } from './useTripStore';
import { useWeatherStore } from '@/features/weather';
import { getCoordinatesFromCity, type Coordinates } from '@/features/weather/geocodingService';
import { Avatar } from '@/components/Avatar';
import { MapView } from '@/components/MapView';
import { TripMapProvider, useTripMap } from './TripMapContext';
import { WorkspaceFeaturePanel } from './WorkspaceFeaturePanel';
import { useWorkspacePanelStore, type WorkspacePanelKey } from './useWorkspacePanelStore';
import { db } from '@/config/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import type { TimelineEvent } from '@/types';

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

function normalizeCityName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function parseDestinationCities(destination: string): string[] {
  return destination
    .split(';')
    .map(normalizeCityName)
    .filter(Boolean);
}

function mergeTripCities(trip: Trip): TripDestinationCity[] {
  const byName = new Map<string, TripDestinationCity>();
  const names = parseDestinationCities(trip.destination);

  for (const city of trip.destinationCities ?? []) {
    const normalizedName = normalizeCityName(city.name);
    if (!normalizedName) continue;
    byName.set(normalizedName.toLowerCase(), {
      ...city,
      name: normalizedName,
    });
  }

  names.forEach((name, index) => {
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      if (index === 0) {
        existing.location = existing.location ?? trip.destinationLocation;
        existing.placeId = existing.placeId ?? trip.destinationPlaceId;
      }
      return;
    }
    byName.set(key, {
      name,
      location: index === 0 ? trip.destinationLocation : undefined,
      placeId: index === 0 ? trip.destinationPlaceId : undefined,
    });
  });

  if (names.length > 0) {
    return names.map((name, index) => {
      const city = byName.get(name.toLowerCase()) ?? { name };
      if (index === 0) {
        return {
          ...city,
          location: city.location ?? trip.destinationLocation,
          placeId: city.placeId ?? trip.destinationPlaceId,
        };
      }
      return city;
    });
  }

  return Array.from(byName.values());
}

const PANEL_CONFIG: Array<{
  key: WorkspacePanelKey;
  label: string;
  icon: string;
  route: (tripId: string) => string;
}> = [
  { key: 'planning', icon: 'P', label: 'Planning', route: ROUTES.tripPlanning },
  { key: 'timeline', icon: 'T', label: 'Timeline', route: ROUTES.tripTimeline },
  { key: 'bucket-list', icon: 'B', label: 'Bucket list', route: ROUTES.tripBucketList },
  { key: 'discovery', icon: 'D', label: 'Discover', route: ROUTES.tripDiscovery },
  { key: 'weather', icon: 'F', label: 'Forecast', route: ROUTES.tripWeather },
  { key: 'expenses', icon: 'E', label: 'Expenses', route: ROUTES.tripExpenses },
];

function panelKeyFromPath(pathname: string): WorkspacePanelKey {
  if (pathname.includes('/timeline')) return 'timeline';
  if (pathname.includes('/bucket-list')) return 'bucket-list';
  if (pathname.includes('/discovery')) return 'discovery';
  if (pathname.includes('/weather')) return 'weather';
  if (pathname.includes('/expenses')) return 'expenses';
  return 'planning';
}

function routeForPanelKey(tripId: string, key: WorkspacePanelKey): string {
  const panel = PANEL_CONFIG.find((entry) => entry.key === key);
  return (panel ?? PANEL_CONFIG[0]).route(tripId);
}

function normalizeMapLocation(raw: any): { lat: number; lng: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const latRaw = typeof raw.lat === 'function' ? raw.lat() : (raw.lat ?? raw.latitude);
  const lngRaw = typeof raw.lng === 'function' ? raw.lng() : (raw.lng ?? raw.longitude);
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

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

    // Clear stale trip content when switching trip ids.
    setActiveTrip(null);
    resetWeather();

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
  const navigate = useNavigate();
  const {
    openPanels,
    activePanelKey,
    resetForRoute,
    setFromRoute,
    togglePanel,
    focusPanel,
    closePanel,
    closeAll,
    resizePanel,
  } = useWorkspacePanelStore((s) => ({
    openPanels: s.openPanels,
    activePanelKey: s.activePanelKey,
    resetForRoute: s.resetForRoute,
    setFromRoute: s.setFromRoute,
    togglePanel: s.togglePanel,
    focusPanel: s.focusPanel,
    closePanel: s.closePanel,
    closeAll: s.closeAll,
    resizePanel: s.resizePanel,
  }));

  const [mapReadyTick, setMapReadyTick] = useState(0);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [isOffHomeCenter, setIsOffHomeCenter] = useState(false);
  const [selectedCityName, setSelectedCityName] = useState('');
  const [selectedCityCenter, setSelectedCityCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvedCityCenters, setResolvedCityCenters] = useState<Record<string, { lat: number; lng: number }>>({});

  const { setActiveSelectedDestinationCity, upsertActiveDestinationCity, patchActiveTrip } = useTripStore((s) => ({
    setActiveSelectedDestinationCity: s.setActiveSelectedDestinationCity,
    upsertActiveDestinationCity: s.upsertActiveDestinationCity,
    patchActiveTrip: s.patchActiveTrip,
  }));

  const tripCities = useMemo(() => mergeTripCities(activeTrip), [activeTrip]);
  const routePanelKey = useMemo(() => panelKeyFromPath(location.pathname), [location.pathname]);
  const hasDiscoveryPanel = useMemo(
    () => openPanels.some((panel) => panel.key === 'discovery'),
    [openPanels],
  );

  useEffect(() => {
    resetForRoute(routePanelKey);
  }, [activeTrip.id, routePanelKey, resetForRoute]);

  useEffect(() => {
    setFromRoute(routePanelKey);
  }, [location.pathname, routePanelKey, setFromRoute]);

  const fallbackHomeCenter = useMemo(
    () => (geo.status === 'ready' ? { lat: geo.coords.lat, lng: geo.coords.lon } : null),
    [geo.status, geo.status === 'ready' ? geo.coords.lat : null, geo.status === 'ready' ? geo.coords.lon : null],
  );

  const homeCenter = selectedCityCenter ?? fallbackHomeCenter;

  const {
    mapRef, mapMarkers, selectedMarkerId, hoveredMarkerId, renderInfoWindow,
    setMapLoaded, setIdleTick, setSelectedMarkerId, setMapMarkers, setRenderInfoWindow,
  } = useTripMap();

  useEffect(() => {
    if (openPanels.length > 0) return;

    let timelineEvents: TimelineEvent[] = [];
    let bucketPlaces = new Map<string, { name: string; location: { lat: number; lng: number } }>();

    const pushMarkers = () => {
      const markers = timelineEvents
        .filter((event) => event.bucketItemId && bucketPlaces.has(event.bucketItemId))
        .map((event) => {
          const place = bucketPlaces.get(event.bucketItemId!);
          return {
            id: event.id,
            position: place!.location,
            title: place!.name || event.title,
            color: event.color,
          };
        });

      setMapMarkers(markers);
      setRenderInfoWindow(null);
    };

    const timelineQuery = query(collection(db, 'trips', activeTrip.id, 'timeline'));
    const bucketQuery = query(collection(db, 'trips', activeTrip.id, 'bucketList'));

    const unsubTimeline = onSnapshot(timelineQuery, (snapshot) => {
      timelineEvents = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TimelineEvent));
      pushMarkers();
    });

    const unsubBucket = onSnapshot(bucketQuery, (snapshot) => {
      bucketPlaces = new Map(
        snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            const location = normalizeMapLocation(data.location);
            if (!location) return null;
            return [docSnap.id, { name: data.name ?? '', location }] as const;
          })
          .filter((entry): entry is readonly [string, { name: string; location: { lat: number; lng: number } }] => entry !== null),
      );
      pushMarkers();
    });

    return () => {
      unsubTimeline();
      unsubBucket();
    };
  }, [openPanels.length, activeTrip.id, setMapMarkers, setRenderInfoWindow]);

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

  useEffect(() => {
    if (tripCities.length === 0) {
      setSelectedCityName('');
      setSelectedCityCenter(null);
      return;
    }

    const fromTrip = normalizeCityName(activeTrip.selectedDestinationCity ?? '');
    const hasFromTrip = tripCities.some((city) => city.name.toLowerCase() === fromTrip.toLowerCase());
    const next = hasFromTrip ? fromTrip : tripCities[0].name;

    setSelectedCityName((prev) => {
      const hasPrev = tripCities.some((city) => city.name.toLowerCase() === normalizeCityName(prev).toLowerCase());
      return hasPrev ? prev : next;
    });
  }, [tripCities, activeTrip.selectedDestinationCity]);

  useEffect(() => {
    if (!selectedCityName) {
      setSelectedCityCenter(null);
      return;
    }

    const normalized = normalizeCityName(selectedCityName);
    const city = tripCities.find((c) => c.name.toLowerCase() === normalized.toLowerCase());
    if (!city) return;

    if (city.location) {
      setSelectedCityCenter({ lat: city.location.lat, lng: city.location.lng });
      return;
    }

    const cached = resolvedCityCenters[normalized.toLowerCase()];
    if (cached) {
      setSelectedCityCenter(cached);
      return;
    }

    let cancelled = false;
    getCoordinatesFromCity(normalized, { placeId: city.placeId }).then(async (result) => {
      if (cancelled || !result.ok) return;

      const next = { lat: result.data.lat, lng: result.data.lon };
      setResolvedCityCenters((prev) => ({ ...prev, [normalized.toLowerCase()]: next }));
      setSelectedCityCenter(next);
      upsertActiveDestinationCity({ name: normalized, placeId: city.placeId, location: next });

      const appendResult = await appendTripDestinationCity(activeTrip.id, {
        name: normalized,
        placeId: city.placeId,
        location: next,
      });
      if (appendResult.ok) {
        patchActiveTrip({
          destination: appendResult.data.destination,
          destinationCities: appendResult.data.destinationCities,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedCityName, tripCities, resolvedCityCenters, upsertActiveDestinationCity, activeTrip.id, patchActiveTrip]);

  function handleSelectCity(cityName: string) {
    const normalized = normalizeCityName(cityName);
    if (!normalized || normalized === selectedCityName) return;

    setSelectedCityName(normalized);
    setActiveSelectedDestinationCity(normalized);

    void setSelectedDestinationCity(activeTrip.id, normalized).then((result) => {
      if (!result.ok) return;
      patchActiveTrip({
        selectedDestinationCity: result.data.selectedDestinationCity,
      });
    });
  }

  function handleMarkerClick(id: string) {
    setSelectedMarkerId(selectedMarkerId === id ? null : id);
  }

  function startPanelResize(event: ReactMouseEvent<HTMLDivElement>, panelKey: WorkspacePanelKey, initialWidth: number) {
    event.preventDefault();

    const startX = event.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      resizePanel(panelKey, initialWidth + delta);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleToggleFeaturePanel(key: WorkspacePanelKey) {
    const isOpen = openPanels.some((panel) => panel.key === key);

    if (isOpen) {
      closePanel(key);
      const remaining = openPanels.filter((panel) => panel.key !== key);
      const nextKey = activePanelKey === key ? (remaining[0]?.key ?? 'planning') : activePanelKey;
      navigate(routeForPanelKey(activeTrip.id, nextKey));
      return;
    }

    togglePanel(key);
    navigate(routeForPanelKey(activeTrip.id, key));
  }

  function handleFocusPanel(key: WorkspacePanelKey) {
    focusPanel(key);
    navigate(routeForPanelKey(activeTrip.id, key));
  }

  function handleClosePanel(key: WorkspacePanelKey) {
    closePanel(key);
    const remaining = openPanels.filter((panel) => panel.key !== key);
    const nextKey = activePanelKey === key ? (remaining[0]?.key ?? 'planning') : activePanelKey;
    navigate(routeForPanelKey(activeTrip.id, nextKey));
  }

  function handleCloseAllPanels() {
    closeAll();
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
          {tripCities.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--wb-ink-soft)' }}>City</span>
              <select
                value={selectedCityName || tripCities[0].name}
                onChange={(event) => handleSelectCity(event.target.value)}
                className="h-7 rounded-[8px] border-[1.5px] px-2.5 text-xs font-semibold outline-none"
                style={{ borderColor: 'var(--wb-line)', background: '#fff', color: 'var(--wb-ink)' }}
              >
                {tripCities.map((city) => (
                  <option key={city.name.toLowerCase()} value={city.name}>{city.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--wb-moss)', boxShadow: '0 0 0 3px rgba(107,143,62,0.25)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--wb-ink-soft)' }}>
              {members.length} planning now
            </span>
          </div>
          <button
            onClick={handleCloseAllPanels}
            className="wb-btn wb-btn-ghost wb-btn-sm"
          >
            Close all panels
          </button>
        </div>
      </div>

      {/* ── Split pane ── */}
      <div className="flex-1 min-h-0 flex">

        {/* LEFT: Shared map canvas */}
        <div
          className="relative overflow-hidden flex-1 min-w-0"
          style={{
            background: 'radial-gradient(1200px 700px at 30% 30%, #DDEAF3, transparent 60%), radial-gradient(900px 500px at 70% 80%, #FAEFD9, transparent 60%), #EEE4CC',
          }}
        >
          <MapView
            center={homeCenter ?? undefined}
            zoom={hasDiscoveryPanel ? 13 : 11}
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
              {hasDiscoveryPanel ? 'Discover' : 'Route view'}
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold"
              style={{ background: 'var(--wb-paper-2)', border: '1.5px solid var(--wb-line)', boxShadow: 'var(--wb-shadow-sm)', color: 'var(--wb-ink)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {selectedCityName || activeTrip.destination}
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
                  mapRef.current?.setZoom(hasDiscoveryPanel ? 13 : 11);
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

          {openPanels.length === 0 && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
              <FeatureIconRail
                openPanels={openPanels}
                activePanelKey={activePanelKey}
                onToggle={handleToggleFeaturePanel}
              />
            </div>
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

        {openPanels.length > 0 && (
          <div className="h-full flex flex-shrink-0" style={{ maxWidth: '80vw' }}>
            <div className="h-full flex items-center px-2" style={{ background: 'var(--wb-paper-2)', borderLeft: '1px solid var(--wb-line)', borderRight: '1px solid var(--wb-line)' }}>
              <FeatureIconRail
                openPanels={openPanels}
                activePanelKey={activePanelKey}
                onToggle={handleToggleFeaturePanel}
              />
            </div>

            {openPanels.map((panel) => {
              const panelMeta = PANEL_CONFIG.find((entry) => entry.key === panel.key)!;
              const isActivePanel = activePanelKey === panel.key;
              return (
                <div key={panel.key} className="h-full flex flex-shrink-0">
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    onMouseDown={(event) => startPanelResize(event, panel.key, panel.width)}
                    className="w-2 cursor-col-resize"
                    style={{ background: 'var(--wb-paper-2)', borderLeft: '1px solid var(--wb-line)', borderRight: '1px solid var(--wb-line)' }}
                  />

                  <div
                    className="h-full flex flex-col overflow-hidden"
                    onMouseDown={() => handleFocusPanel(panel.key)}
                    style={{
                      width: panel.width,
                      minWidth: 280,
                      background: 'var(--wb-paper)',
                      borderRight: '1px solid var(--wb-line)',
                    }}
                  >
                    <div
                      className="h-10 px-3 flex items-center justify-between"
                      style={{
                        borderBottom: '1px solid var(--wb-line)',
                        background: isActivePanel ? '#fff' : 'var(--wb-paper-2)',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[10px] font-extrabold"
                          style={{ background: 'var(--wb-sun)', color: 'var(--wb-ink)' }}
                        >
                          {panelMeta.icon}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--wb-ink)' }}>
                          {panelMeta.label}
                        </span>
                      </div>
                      <button
                        className="text-xs font-bold px-1.5 py-0.5 rounded hover:bg-white"
                        style={{ color: 'var(--wb-ink-soft)' }}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleClosePanel(panel.key);
                        }}
                        title={`Close ${panelMeta.label}`}
                      >
                        x
                      </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden">
                      <WorkspaceFeaturePanel panelKey={panel.key} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

function FeatureIconRail({
  openPanels,
  activePanelKey,
  onToggle,
}: {
  openPanels: Array<{ key: WorkspacePanelKey }>;
  activePanelKey: WorkspacePanelKey;
  onToggle: (key: WorkspacePanelKey) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {PANEL_CONFIG.map((panel) => {
        const isOpen = openPanels.some((entry) => entry.key === panel.key);
        const isActive = isOpen && activePanelKey === panel.key;
        return (
          <button
            key={panel.key}
            onClick={() => onToggle(panel.key)}
            className="h-10 min-w-[120px] px-3 rounded-[10px] border-[1.5px] text-xs font-semibold flex items-center justify-start transition-all whitespace-nowrap"
            style={{
              borderColor: isActive ? 'var(--wb-ink)' : 'var(--wb-line)',
              background: isOpen ? 'var(--wb-sun)' : '#fff',
              color: 'var(--wb-ink)',
              boxShadow: isActive ? 'var(--wb-shadow-sm)' : 'none',
            }}
            title={panel.label}
          >
            {panel.label}
          </button>
        );
      })}
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
