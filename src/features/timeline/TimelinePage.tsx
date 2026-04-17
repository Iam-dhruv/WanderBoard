// ─── TimelinePage.tsx ─────────────────────────────────────────────────────────
// Orchestrates the full timeline view:
//  - Real-time Firestore subscription (all members)
//  - BucketListSidebar (drag source for owner)
//  - TimelineGrid (drop target + calendar view)
//  - CreateEventModal (owner: custom events)
//  - Toast notifications

import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '@/features/trips/useTripStore';
import { useAuth } from '@/features/auth/AuthProvider';
import { subscribeTimeline, createTimelineEvent, pickEventColor } from './timelineService';
import type { TimelineEvent } from '@/types';
import { TimelineGrid } from './components/TimelineGrid';
import { BucketListSidebar } from './components/BucketListSidebar';
import { CreateEventModal } from './components/CreateEventModal';
import type { BucketItem } from './components/BucketListSidebar';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warn';
}

let toastCounter = 0;

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelinePage() {
  const { activeTrip } = useTripStore();
  const { user }       = useAuth();

  const [events, setEvents]       = useState<TimelineEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts]       = useState<Toast[]>([]);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalDate, setModalDate]             = useState('');
  const [modalTime, setModalTime]             = useState('');

  // Drag state
  const [draggingBucket, setDraggingBucket]   = useState<BucketItem | null>(null);
  const [draggingEvent,  setDraggingEvent]    = useState<TimelineEvent | null>(null);

  const isOwner = activeTrip?.ownerId === user?.uid;

  // Real-time subscription
  useEffect(() => {
    if (!activeTrip) return;
    const unsub = subscribeTimeline(
      activeTrip.id,
      (evs) => { setEvents(evs); setLoadError(null); },
      (msg) => setLoadError(msg),
    );
    return unsub;
  }, [activeTrip]);

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

    if (result.ok) {
      addToast(`"${data.title}" added to timeline!`, 'success');
    } else {
      addToast(result.error, 'error');
    }
  }

  if (!activeTrip) return null;

  return (
    <div className="flex h-full min-h-0 bg-gray-50">

      {/* ── Bucket list sidebar ─────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col overflow-hidden">
        <BucketListSidebar
          tripId={activeTrip.id}
          isOwner={isOwner}
          onDragStart={(item) => setDraggingBucket(item)}
        />
      </aside>

      {/* ── Main timeline area ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Timeline
            </p>
            <h2 className="text-sm font-semibold text-gray-900 mt-0.5">
              {activeTrip.name} · {activeTrip.startDate} → {activeTrip.endDate}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Role badge */}
            {isOwner ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                Owner — can edit
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                View only
              </span>
            )}

            {/* Add custom event */}
            {isOwner && (
              <button
                onClick={() => openCreateModal(activeTrip.startDate, '09:00')}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                + Custom event
              </button>
            )}
          </div>
        </div>

        

        {/* Error state */}
        {loadError && (
          <div className="flex-shrink-0 mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Grid scroll area */}
        <div className="flex-1 overflow-auto">
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
          />
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
            className={[
              'px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-xs pointer-events-auto',
              t.type === 'success' ? 'bg-emerald-600 text-white' :
              t.type === 'error'   ? 'bg-red-600 text-white' :
                                     'bg-amber-500 text-white',
            ].join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
