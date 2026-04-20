// ─── BucketListSidebar.tsx ────────────────────────────────────────────────────
// Left panel showing the trip's bucket list as draggable postcards.
// Owner can drag a card onto the timeline grid to schedule it.
// Owner can also drag a timeline event back here to un-schedule it.
// Members see the same list but cannot drag.
//
// Drop-bug fix: onDragOver only accepts drags that carry 'text/timeline-event'
// (set by EventCard's dragStart). Bucket-item drags don't carry that type, so
// they pass through to the calendar underneath instead of being swallowed here.

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface BucketItem {
  id: string;
  name: string;
  address: string;
  rating: number;
  photoUrl: string;
  placeId: string;
  durationMinutes?: number;
}

interface BucketListSidebarProps {
  tripId: string;
  isOwner: boolean;
  scheduledBucketIds?: Set<string>;
  onDragStart: (item: BucketItem) => void;
  onReturnEvent?: (eventId: string) => void;
}

export function BucketListSidebar({
  tripId,
  isOwner,
  scheduledBucketIds,
  onDragStart,
  onReturnEvent,
}: BucketListSidebarProps) {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropTarget, setDropTarget] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'trips', tripId, 'bucketList'),
      orderBy('createdAt'),
    );
    const unsub: Unsubscribe = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            durationMinutes:
              typeof data.userData?.durationMinutes === 'number'
                ? data.userData.durationMinutes
                : undefined,
          } as BucketItem;
        }),
      );
      setLoading(false);
    });
    return unsub;
  }, [tripId]);

  const unscheduledItems = useMemo(
    () => items.filter((item) => !scheduledBucketIds?.has(item.id)),
    [items, scheduledBucketIds],
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: dropTarget ? 'rgba(14,107,168,0.04)' : 'var(--wb-paper)',
        outline: dropTarget ? '2px dashed var(--wb-ocean)' : undefined,
        borderRadius: dropTarget ? 12 : undefined,
        transition: 'background 120ms',
      }}
      onDragOver={(e) => {
        if (!isOwner) return;
        // Only accept drops of existing timeline events — NOT bucket item drags
        if (!e.dataTransfer.types.includes('text/timeline-event')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(e) => {
        setDropTarget(false);
        if (!isOwner) return;
        if (e.dataTransfer.getData('sourceType') === 'existing') {
          e.preventDefault();
          const eventId = e.dataTransfer.getData('eventId');
          if (eventId) onReturnEvent?.(eventId);
        }
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--wb-line)', padding: '16px 16px 12px', background: 'var(--wb-paper)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--wb-ocean)', marginBottom: 2 }}>
          Bucket list
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--wb-ink)' }}>
          {isOwner ? 'Drag to schedule · drop here to return' : 'Saved activities'}
        </p>
        {!loading && (
          <p style={{ fontSize: 11, color: 'var(--wb-ink-soft)', marginTop: 4 }}>
            {unscheduledItems.length} ready to schedule
          </p>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <p style={{ fontSize: 12, color: 'var(--wb-ink-soft)', textAlign: 'center', padding: '16px 0' }}>
            Loading…
          </p>
        )}
        {!loading && unscheduledItems.length === 0 && (
          <div style={{ border: '1.5px dashed var(--wb-line)', borderRadius: 12, padding: '32px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--wb-ink-soft)', lineHeight: 1.5 }}>
              {items.length === 0
                ? 'No bucket list items yet.'
                : 'All saved items are already scheduled.'}
              <br />
              Add again from Discover to schedule repeat visits.
            </p>
          </div>
        )}

        {unscheduledItems.map((item) => (
          <BucketCard
            key={item.id}
            item={item}
            isOwner={isOwner}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

// ─── BucketCard ───────────────────────────────────────────────────────────────

function BucketCard({
  item,
  isOwner,
  onDragStart,
}: {
  item: BucketItem;
  isOwner: boolean;
  onDragStart: (item: BucketItem) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      draggable={isOwner}
      onDragStart={
        isOwner
          ? (e) => {
              e.dataTransfer.setData('bucketItemId', item.id);
              e.dataTransfer.setData('bucketItemName', item.name);
              e.dataTransfer.setData('bucketItemAddress', item.address);
              e.dataTransfer.setData('bucketItemDuration', String(item.durationMinutes ?? ''));
              e.dataTransfer.setData('sourceType', 'bucket');
              e.dataTransfer.effectAllowed = 'copy';
              onDragStart(item);
            }
          : undefined
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        border: `1px solid ${hovered && isOwner ? 'var(--wb-ocean)' : 'var(--wb-line)'}`,
        background: 'white',
        overflow: 'hidden',
        cursor: isOwner ? 'grab' : 'default',
        boxShadow: hovered && isOwner ? 'var(--wb-shadow-md)' : 'var(--wb-shadow-sm)',
        transition: 'box-shadow var(--wb-fast), border-color var(--wb-fast)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, padding: 10 }}>
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: 10,
            overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--wb-paper-2)',
            border: '1px solid var(--wb-line)',
          }}
        >
          {item.photoUrl ? (
            <img
              src={item.photoUrl}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              📍
            </div>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--wb-ink)', lineHeight: 1.25 }}>
            {item.name}
          </p>
          <p
            style={{
              fontSize: 10,
              color: 'var(--wb-ink-soft)',
              marginTop: 3,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.address}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {item.rating > 0 && (
              <span style={{ fontSize: 10, color: '#946200', background: '#FFF7D9', border: '1px solid #F4D47B', borderRadius: 999, padding: '2px 7px', fontWeight: 600 }}>
                ★ {item.rating.toFixed(1)}
              </span>
            )}
            {item.durationMinutes && (
              <span style={{ fontSize: 10, color: 'var(--wb-ink-soft)', background: 'var(--wb-paper-2)', border: '1px solid var(--wb-line)', borderRadius: 999, padding: '2px 7px', fontWeight: 600 }}>
                {formatDuration(item.durationMinutes)}
              </span>
            )}
          </div>

          {isOwner && (
            <p style={{ fontSize: 9, color: 'var(--wb-ocean)', marginTop: 7, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Drag to schedule
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
