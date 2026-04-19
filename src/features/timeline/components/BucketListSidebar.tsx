// ─── BucketListSidebar.tsx ────────────────────────────────────────────────────
// Left panel showing the trip's bucket list as draggable postcards.
// Owner can drag a card onto the timeline grid to schedule it.
// Owner can also drag a timeline event back here to un-schedule it.
// Members see the same list but cannot drag.
//
// Drop-bug fix: onDragOver only accepts drags that carry 'text/timeline-event'
// (set by EventCard's dragStart). Bucket-item drags don't carry that type, so
// they pass through to the calendar underneath instead of being swallowed here.

import { useEffect, useState } from 'react';
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
  onDragStart: (item: BucketItem) => void;
  onReturnEvent?: (eventId: string) => void;
}

export function BucketListSidebar({
  tripId,
  isOwner,
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
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && (
          <p style={{ fontSize: 12, color: 'var(--wb-ink-soft)', textAlign: 'center', padding: '16px 0' }}>
            Loading…
          </p>
        )}
        {!loading && items.length === 0 && (
          <div style={{ border: '1.5px dashed var(--wb-line)', borderRadius: 12, padding: '32px 12px', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: 'var(--wb-ink-soft)', lineHeight: 1.5 }}>
              No bucket list items yet.
              <br />
              Discover places and save them.
            </p>
          </div>
        )}

        {items.map((item) => (
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
  const stars = Math.round(item.rating);

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
      {/* Photo */}
      {item.photoUrl && (
        <div style={{ height: 84, overflow: 'hidden' }}>
          <img
            src={item.photoUrl}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--wb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </p>
        <p style={{ fontSize: 10, color: 'var(--wb-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {item.address}
        </p>
        {item.rating > 0 && (
          <p style={{ fontSize: 10, color: 'var(--wb-sun)', marginTop: 4 }}>
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}{' '}{item.rating.toFixed(1)}
          </p>
        )}
        {item.durationMinutes && (
          <p style={{ fontSize: 10, color: 'var(--wb-ink-soft)', marginTop: 2 }}>
            {formatDuration(item.durationMinutes)}
          </p>
        )}
        {isOwner && (
          <p style={{ fontSize: 9, color: 'var(--wb-ocean)', marginTop: 6, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            drag to add →
          </p>
        )}
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
