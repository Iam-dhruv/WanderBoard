// ─── TimelinePage.tsx ─────────────────────────────────────────────────────────
// Orchestrates the full timeline/plan view:
//  - Resizable bucket list sidebar (left)
//  - Full-trip accordion view OR single-day grid (right)
//  - Map sync: pushes calendar event markers to TripMapContext
//    • Full trip, day expanded → markers for that day only
//    • Full trip, no day expanded → markers for all calendar events
//    • Single day → markers for selectedDay
//  - CreateEventModal, toast notifications
//  - DayWeatherSummary strip

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTripStore } from '@/features/trips/useTripStore';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTripMap } from '@/features/trips/TripMapContext';
import {
  subscribeTimeline, createTimelineEvent, deleteTimelineEvent, pickEventColor,
} from './timelineService';
import type { TimelineEvent } from '@/types';
import { TimelineGrid } from './components/TimelineGrid';
import { TripAccordionView } from './components/TripAccordionView';
import { BucketListSidebar } from './components/BucketListSidebar';
import { CreateEventModal } from './components/CreateEventModal';
import type { BucketItem } from './components/BucketListSidebar';
import { DayWeatherSummary } from '@/features/weather/DayWeatherSummary';
import { useTripGeo } from '@/features/trips/TripWorkspacePage';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warn';
}

let toastCounter = 0;

// Lightweight type for bucket items — only what we need for map location lookup
interface BucketItemLoc {
  id: string;
  location?: { lat: number; lng: number };
  name?: string;
  address?: string;
  userData?: {
    proposedDate?: string;
    proposedTime?: string;
    activityType?: string;
  };
}

function normalizeLocation(raw: any): { lat: number; lng: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const latRaw = typeof raw.lat === 'function' ? raw.lat() : (raw.lat ?? raw.latitude);
  const lngRaw = typeof raw.lng === 'function' ? raw.lng() : (raw.lng ?? raw.longitude);
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDatesInRange(startDate: string, endDate: string): string[] {
  const startMatch = startDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = endDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!startMatch || !endMatch) return [];

  const dates: string[] = [];
  const current = new Date(Number(startMatch[1]), Number(startMatch[2]) - 1, Number(startMatch[3]));
  const end = new Date(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3]));

  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) return [];

  while (current <= end) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDayFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelinePage() {
  const { activeTrip } = useTripStore();
  const { user }       = useAuth();
  const { geo }        = useTripGeo();
  const { setMapMarkers } = useTripMap();

  const containerRef = useRef<HTMLDivElement>(null);

  const [events, setEvents]       = useState<TimelineEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts]       = useState<Toast[]>([]);

  // Bucket items with location data (for map markers)
  const [bucketItems, setBucketItems] = useState<BucketItemLoc[]>([]);

  // View mode + accordion
  const [viewMode, setViewMode]       = useState<'trip' | 'day'>('trip');
  const [selectedDay, setSelectedDay] = useState('');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalDate, setModalDate]             = useState('');
  const [modalTime, setModalTime]             = useState('');

  // Drag state
  const [draggingBucket, setDraggingBucket] = useState<BucketItem | null>(null);
  const [draggingEvent,  setDraggingEvent]  = useState<TimelineEvent | null>(null);

  // Resizable sidebar
  const [bucketSidebarWidth, setBucketSidebarWidth] = useState(
    () => Math.max(200, Math.floor(window.innerWidth * 0.25)),
  );
  const [isBucketSidebarCollapsed, setIsBucketSidebarCollapsed] = useState(false);

  const isOwner = activeTrip?.ownerId === user?.uid;

  // Seed selectedDay on first load
  useEffect(() => {
    if (activeTrip && !selectedDay) setSelectedDay(activeTrip.startDate);
  }, [activeTrip]);

  // Real-time timeline subscription
  useEffect(() => {
    if (!activeTrip) return;
    return subscribeTimeline(
      activeTrip.id,
      (evs) => { setEvents(evs); setLoadError(null); },
      (msg) => setLoadError(msg),
    );
  }, [activeTrip]);

  // Subscribe to bucket list items for location lookup (map markers)
  useEffect(() => {
    if (!activeTrip) return;
    const q = query(collection(db, 'trips', activeTrip.id, 'bucketList'));
    return onSnapshot(q, (snap) => {
      setBucketItems(
        snap.docs.map((d) => {
          const data = d.data();
          const userData = data.userData ?? {};
          return {
            id:       d.id,
            location: normalizeLocation(data.location),
            name:     data.name ?? undefined,
            address:  data.address ?? undefined,
            userData: {
              proposedDate: typeof userData.proposedDate === 'string' ? userData.proposedDate : undefined,
              proposedTime: typeof userData.proposedTime === 'string' ? userData.proposedTime : undefined,
              activityType: typeof userData.activityType === 'string' ? userData.activityType : undefined,
            },
          };
        }),
      );
    });
  }, [activeTrip]);

  const bucketMetaById = useMemo(
    () => new Map(bucketItems.map((item) => [item.id, item])),
    [bucketItems],
  );

  // Push calendar event markers to the map based on expanded/selected day
  useEffect(() => {
    const locationMap = new Map<string, { lat: number; lng: number }>();
    for (const item of bucketItems) {
      if (item.location) locationMap.set(item.id, item.location);
    }

    // Determine which day to filter by (null = show all)
    const mapFilterDay = viewMode === 'day'
      ? selectedDay
      : expandedDay;

    const relevantEvents = mapFilterDay
      ? events.filter((ev) => ev.date === mapFilterDay)
      : events;

    const markers = relevantEvents
      .filter((ev) => ev.bucketItemId && locationMap.has(ev.bucketItemId))
      .map((ev) => ({
        id:       ev.id,
        position: locationMap.get(ev.bucketItemId!)!,
        title:    ev.title,
        color:    ev.color,
      }));

    setMapMarkers(markers);
  }, [events, bucketItems, expandedDay, viewMode, selectedDay, setMapMarkers]);

  function addToast(message: string, type: Toast['type']) {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  function openCreateModal(date: string, startTime: string) {
    setModalDate(date);
    setModalTime(startTime);
    setShowCreateModal(true);
  }

  function startBucketSidebarResize(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const minWidth = 160;
    const handleMouseMove = (mv: MouseEvent) => {
      const containerLeft  = containerRef.current?.getBoundingClientRect().left ?? 0;
      const containerWidth = containerRef.current?.getBoundingClientRect().width ?? window.innerWidth * 0.5;
      const maxWidth = Math.floor(containerWidth * 0.75);
      setBucketSidebarWidth(Math.max(minWidth, Math.min(maxWidth, mv.clientX - containerLeft)));
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleToggleDay(day: string) {
    setExpandedDay((prev) => (prev === day ? null : day));
  }

  async function handleCreateCustom(data: {
    title: string;
    description: string;
    location: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    tags: string[];
  }) {
    if (!activeTrip || !user) return;
    setShowCreateModal(false);
    const result = await createTimelineEvent({
      tripId:          activeTrip.id,
      title:           data.title,
      description:     data.description,
      location:        data.location,
      date:            data.date,
      startTime:       data.startTime,
      durationMinutes: data.durationMinutes,
      color:           pickEventColor(events.length),
      tags:            data.tags,
      sourceType:      'custom',
      createdBy:       user.uid,
    });
    if (result.ok) addToast(`"${data.title}" added to timeline!`, 'success');
    else           addToast(result.error, 'error');
  }

  if (!activeTrip) return null;

  const tripDays         = getDatesInRange(activeTrip.startDate, activeTrip.endDate);
  const showWeatherStrip = geo.status === 'ready' && tripDays.length > 0;
  const scheduledBucketIds = useMemo(
    () => new Set(events
      .map((ev) => ev.bucketItemId)
      .filter((id): id is string => Boolean(id))),
    [events],
  );

  // Day navigation helpers (single-day mode)
  const currentDayIndex = tripDays.indexOf(selectedDay);
  const canGoPrev = viewMode === 'day' && currentDayIndex > 0;
  const canGoNext = viewMode === 'day' && currentDayIndex < tripDays.length - 1;

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 relative"
      style={{ background: 'var(--wb-paper)' }}
    >

      {/* ── Bucket list sidebar (resizable) ─────────────────────────────── */}
      {!isBucketSidebarCollapsed && (
        <aside
          className="flex-shrink-0 flex flex-col overflow-hidden"
          style={{ width: bucketSidebarWidth, borderRight: '1px solid var(--wb-line)' }}
        >
          <BucketListSidebar
            tripId={activeTrip.id}
            isOwner={isOwner}
            scheduledBucketIds={scheduledBucketIds}
            onDragStart={(item) => setDraggingBucket(item)}
            onReturnEvent={async (eventId) => {
              const result = await deleteTimelineEvent(activeTrip.id, eventId);
              if (!result.ok) addToast(result.error, 'error');
              else            addToast('Activity returned to bucket list.', 'success');
            }}
          />
        </aside>
      )}

      {/* Sidebar resize handle */}
      {!isBucketSidebarCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={startBucketSidebarResize}
          style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: 'var(--wb-line)', transition: 'background var(--wb-fast)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--wb-ocean)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--wb-line)'; }}
        />
      )}

      {/* ── Main timeline area ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <div
          className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ borderBottom: '1px solid var(--wb-line)', background: 'var(--wb-paper)' }}
        >
          {/* Left: collapse toggle + title + day nav */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setIsBucketSidebarCollapsed((p) => !p)}
              style={{
                padding: '4px 9px', borderRadius: 7,
                border: '1px solid var(--wb-line)', background: 'white',
                fontSize: 11, fontWeight: 600, color: 'var(--wb-ink-soft)',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              {isBucketSidebarCollapsed ? '☰' : '✕'}
            </button>

            <div style={{ width: 1, height: 20, background: 'var(--wb-line)', flexShrink: 0 }} />

            <div className="min-w-0">
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wb-ocean)' }}>
                Timeline
              </p>
              <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--wb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeTrip.name}
              </h2>
            </div>

            {/* Day navigation (single-day mode) */}
            {viewMode === 'day' && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  disabled={!canGoPrev}
                  onClick={() => setSelectedDay(tripDays[currentDayIndex - 1])}
                  style={{
                    width: 24, height: 24, borderRadius: 6,
                    border: '1px solid var(--wb-line)', background: 'white',
                    fontSize: 14, cursor: canGoPrev ? 'pointer' : 'not-allowed',
                    opacity: canGoPrev ? 1 : 0.3, color: 'var(--wb-ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >‹</button>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--wb-ink)', minWidth: 72, textAlign: 'center' }}>
                  {formatDayFull(selectedDay)}
                </span>
                <button
                  disabled={!canGoNext}
                  onClick={() => setSelectedDay(tripDays[currentDayIndex + 1])}
                  style={{
                    width: 24, height: 24, borderRadius: 6,
                    border: '1px solid var(--wb-line)', background: 'white',
                    fontSize: 14, cursor: canGoNext ? 'pointer' : 'not-allowed',
                    opacity: canGoNext ? 1 : 0.3, color: 'var(--wb-ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >›</button>
              </div>
            )}
          </div>

          {/* Right: view toggle + role + create */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Segmented control */}
            <div style={{ display: 'flex', border: '1px solid var(--wb-line)', borderRadius: 7, overflow: 'hidden', background: 'white' }}>
              {(['trip', 'day'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    if (mode === 'day' && !selectedDay) setSelectedDay(tripDays[0] ?? '');
                  }}
                  style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', border: 'none',
                    borderRight: mode === 'trip' ? '1px solid var(--wb-line)' : 'none',
                    background: viewMode === mode ? 'var(--wb-ink)' : 'transparent',
                    color: viewMode === mode ? 'var(--wb-paper)' : 'var(--wb-ink-soft)',
                    transition: 'background var(--wb-fast), color var(--wb-fast)',
                  }}
                >
                  {mode === 'trip' ? 'Full trip' : 'Day'}
                </button>
              ))}
            </div>

            {/* Role badge */}
            {isOwner ? (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(14,107,168,0.1)', color: 'var(--wb-ocean)' }}>
                Owner
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'var(--wb-paper-2)', color: 'var(--wb-ink-soft)' }}>
                View only
              </span>
            )}

            {/* Create event */}
            {isOwner && (
              <button
                onClick={() => openCreateModal(
                  viewMode === 'day' ? selectedDay : (expandedDay ?? activeTrip.startDate),
                  '09:00',
                )}
                style={{
                  padding: '4px 10px', borderRadius: 7,
                  background: 'var(--wb-ink)', color: 'var(--wb-paper)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                }}
              >
                + Event
              </button>
            )}
          </div>
        </div>

        {/* ── Per-day weather strip ───────────────────────────────────────── */}
        {showWeatherStrip && geo.status === 'ready' && (
          <div
            className="flex-shrink-0 overflow-x-auto px-4 py-2"
            style={{ borderBottom: '1px solid var(--wb-line)', background: 'var(--wb-paper)' }}
          >
            <div className="flex items-center gap-3 min-w-max">
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--wb-ink-soft)', opacity: 0.6, flexShrink: 0 }}>
                Weather
              </span>
              {(viewMode === 'day' ? [selectedDay] : tripDays).map((date) => (
                <div key={date} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span style={{ fontSize: 9, color: 'var(--wb-ink-soft)', fontWeight: 600 }}>
                    {formatDayLabel(date)}
                  </span>
                  <DayWeatherSummary date={date} lat={geo.coords.lat} lon={geo.coords.lon} />
                </div>
              ))}
            </div>
          </div>
        )}

        {geo.status === 'loading' && (
          <div className="flex-shrink-0 px-4 py-1.5" style={{ borderBottom: '1px solid var(--wb-line)' }}>
            <p style={{ fontSize: 10, color: 'var(--wb-ink-soft)' }}>Fetching destination weather…</p>
          </div>
        )}

        {loadError && (
          <div className="flex-shrink-0 mx-4 mt-3 px-4 py-2 rounded-xl text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
            {loadError}
          </div>
        )}

        {/* ── Content area: accordion (Full trip) or drag-drop grid (Day) ── */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'trip' ? (
            // Full trip: collapsible day-by-day accordion
            <TripAccordionView
              days={tripDays}
              events={events}
              expandedDay={expandedDay}
              onToggleDay={handleToggleDay}
              bucketMetaById={bucketMetaById}
            />
          ) : (
            // Single day: drag-drop scheduling grid
            <div className="h-full overflow-auto">
              <TimelineGrid
                trip={activeTrip}
                events={events}
                isOwner={isOwner}
                currentUserId={user?.uid ?? ''}
                draggingBucketItem={draggingBucket}
                draggingExistingEvent={draggingEvent}
                onDragEnd={() => { setDraggingBucket(null); setDraggingEvent(null); }}
                onToast={addToast}
                onOpenCreateModal={openCreateModal}
                filterDay={selectedDay}
              />
            </div>
          )}
        </div>
      </main>

      {/* ── Create event modal ──────────────────────────────────────────── */}
      {showCreateModal && isOwner && (
        <CreateEventModal
          trip={activeTrip}
          defaultDate={modalDate}
          defaultStartTime={modalTime}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateCustom}
        />
      )}

      {/* ── Toast notifications ─────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '10px 16px', borderRadius: 12,
              boxShadow: 'var(--wb-shadow-lg)', fontSize: 13, fontWeight: 600,
              maxWidth: 320, pointerEvents: 'auto',
              background:
                t.type === 'success' ? 'var(--wb-forest)' :
                t.type === 'error'   ? 'var(--wb-sunset)' :
                                       'var(--wb-sun)',
              color: t.type === 'warn' ? 'var(--wb-ink)' : 'white',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
