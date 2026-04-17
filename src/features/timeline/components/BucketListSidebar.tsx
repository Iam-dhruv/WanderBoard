// ─── BucketListSidebar.tsx ────────────────────────────────────────────────────
// Left panel showing the trip's bucket list as draggable postcards.
// Owner can drag a card onto the timeline grid to schedule it.
// Members see the same list but cannot drag.

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
}

interface BucketListSidebarProps {
  tripId: string;
  isOwner: boolean;
  onDragStart: (item: BucketItem) => void;
}

export function BucketListSidebar({
  tripId,
  isOwner,
  onDragStart,
}: BucketListSidebarProps) {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'trips', tripId, 'bucketList'),
      orderBy('createdAt'),
    );
    const unsub: Unsubscribe = onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as BucketItem)),
      );
      setLoading(false);
    });
    return unsub;
  }, [tripId]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Bucket list
        </p>
        <p className="text-sm font-medium text-gray-800 mt-0.5">
          {isOwner ? 'Drag to schedule' : 'Saved activities'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
        )}
        {!loading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 px-3 text-center">
            <p className="text-xs text-gray-400">
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
              e.dataTransfer.setData('sourceType', 'bucket');
              e.dataTransfer.effectAllowed = 'copy';
              onDragStart(item);
            }
          : undefined
      }
      className={[
        'rounded-xl border border-gray-100 bg-white overflow-hidden transition-all',
        isOwner
          ? 'cursor-grab hover:border-indigo-200 hover:shadow-sm active:opacity-70'
          : 'cursor-default',
      ].join(' ')}
    >
      {/* Photo */}
      {item.photoUrl && (
        <div className="h-24 overflow-hidden">
          <img
            src={item.photoUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
        <p className="text-[10px] text-gray-500 truncate mt-0.5">{item.address}</p>
        {item.rating > 0 && (
          <p className="text-[10px] text-amber-500 mt-1">
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)} {item.rating.toFixed(1)}
          </p>
        )}
        {isOwner && (
          <p className="text-[9px] text-indigo-400 mt-1.5 font-medium uppercase tracking-wide">
            drag to add →
          </p>
        )}
      </div>
    </div>
  );
}
