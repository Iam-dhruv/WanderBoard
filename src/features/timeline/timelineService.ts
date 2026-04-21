// ─── timelineService.ts ───────────────────────────────────────────────────────
// Firestore CRUD + real-time subscription for timeline events.
// All writes are owner-only (enforced by Firestore rules).
// Reads subscribe via onSnapshot so all members see changes instantly.

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ok, err, type Result } from '@/types';
import type { TimelineEvent } from '@/types';

// ─── Collection helpers ───────────────────────────────────────────────────────

const timelineCol = (tripId: string) =>
  collection(db, 'trips', tripId, 'timeline');

const timelineDoc = (tripId: string, eventId: string) =>
  doc(db, 'trips', tripId, 'timeline', eventId);

// ─── Subscribe (real-time, all members) ──────────────────────────────────────

export function subscribeTimeline(
  tripId: string,
  onData: (events: TimelineEvent[]) => void,
  onError: (error: string) => void,
): Unsubscribe {
  const q = query(timelineCol(tripId), orderBy('date'), orderBy('startTime'));
  return onSnapshot(
    q,
    (snap) => {
      const events = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as TimelineEvent),
      );
      onData(events);
    },
    (error) => {
      console.error('[subscribeTimeline]', error);
      onError(error.message);
    },
  );
}

// ─── Create (owner only) ──────────────────────────────────────────────────────

export interface CreateEventInput {
  tripId: string;
  title: string;
  description?: string;
  location?: string;
  date: string;           // "YYYY-MM-DD"
  startTime: string;      // "HH:MM"
  durationMinutes: number;
  color: string;
  tags: string[];
  sourceType: 'bucket' | 'custom';
  bucketItemId?: string;
  createdBy: string;
}

export async function createTimelineEvent(
  input: CreateEventInput,
): Promise<Result<TimelineEvent>> {
  try {
    const payload = {
      tripId:          input.tripId,
      title:           input.title.trim(),
      description:     input.description?.trim() ?? '',
      location:        input.location?.trim() ?? '',
      date:            input.date,
      startTime:       input.startTime,
      durationMinutes: input.durationMinutes,
      color:           input.color,
      tags:            input.tags,
      sourceType:      input.sourceType,
      bucketItemId:    input.bucketItemId ?? null,
      createdBy:       input.createdBy,
      createdAt:       serverTimestamp(),
    };
    const ref = await addDoc(timelineCol(input.tripId), payload);
    return ok({ id: ref.id, ...payload, createdAt: Date.now() } as TimelineEvent);
  } catch (e: any) {
    console.error('[createTimelineEvent]', e);
    return err(e?.code === 'permission-denied'
      ? 'Only the trip owner can add timeline events.'
      : 'Failed to create event.');
  }
}

// ─── Update (owner only — move / edit) ───────────────────────────────────────

export interface UpdateEventInput {
  tripId: string;
  eventId: string;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  title?: string;
  description?: string;
  color?: string;
  tags?: string[];
}

export interface BatchUpdateEventInput {
  eventId: string;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  title?: string;
  description?: string;
  color?: string;
  tags?: string[];
}

export async function updateTimelineEvent(
  input: UpdateEventInput,
): Promise<Result<void>> {
  try {
    const patch: Record<string, unknown> = {};
    if (input.date !== undefined)            patch.date            = input.date;
    if (input.startTime !== undefined)       patch.startTime       = input.startTime;
    if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes;
    if (input.title !== undefined)           patch.title           = input.title.trim();
    if (input.description !== undefined)     patch.description     = input.description.trim();
    if (input.color !== undefined)           patch.color           = input.color;
    if (input.tags !== undefined)            patch.tags            = input.tags;

    await updateDoc(timelineDoc(input.tripId, input.eventId), patch);
    return ok(undefined);
  } catch (e: any) {
    console.error('[updateTimelineEvent]', e);
    return err(e?.code === 'permission-denied'
      ? 'Only the trip owner can move events.'
      : 'Failed to update event.');
  }
}

export async function updateTimelineEvents(
  tripId: string,
  updates: BatchUpdateEventInput[],
): Promise<Result<void>> {
  if (updates.length === 0) return ok(undefined);

  try {
    const batch = writeBatch(db);

    for (const input of updates) {
      const patch: Record<string, unknown> = {};
      if (input.date !== undefined)            patch.date            = input.date;
      if (input.startTime !== undefined)       patch.startTime       = input.startTime;
      if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes;
      if (input.title !== undefined)           patch.title           = input.title.trim();
      if (input.description !== undefined)     patch.description     = input.description.trim();
      if (input.color !== undefined)           patch.color           = input.color;
      if (input.tags !== undefined)            patch.tags            = input.tags;

      if (Object.keys(patch).length === 0) continue;
      batch.update(timelineDoc(tripId, input.eventId), patch);
    }

    await batch.commit();
    return ok(undefined);
  } catch (e: any) {
    console.error('[updateTimelineEvents]', e);
    return err(e?.code === 'permission-denied'
      ? 'Only the trip owner can move events.'
      : 'Failed to update timeline events.');
  }
}

// ─── Delete (owner only) ──────────────────────────────────────────────────────

export async function deleteTimelineEvent(
  tripId: string,
  eventId: string,
): Promise<Result<void>> {
  try {
    await deleteDoc(timelineDoc(tripId, eventId));
    return ok(undefined);
  } catch (e: any) {
    console.error('[deleteTimelineEvent]', e);
    return err(e?.code === 'permission-denied'
      ? 'Only the trip owner can delete events.'
      : 'Failed to delete event.');
  }
}

// ─── Colour palette for auto-assignment ──────────────────────────────────────

const EVENT_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f97316', // orange
  '#06b6d4', // cyan
];

export function pickEventColor(index: number): string {
  return EVENT_COLORS[index % EVENT_COLORS.length];
}
