import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BucketListPriority, BucketListUserData, Result } from '@/types';
import type { Place } from '@/features/discovery/types';
import { Modal } from '@/components/ui';

const ACTIVITY_TYPES = [
  'Sightseeing',
  'Food',
  'Adventure',
  'Culture',
  'Nature',
  'Relaxation',
];

interface AddToBucketModalProps {
  isOpen: boolean;
  place: Place;
  minDate?: string;
  maxDate?: string;
  onClose: () => void;
  onSubmit: (userData: BucketListUserData) => Promise<Result<void>>;
}

export function AddToBucketModal({ isOpen, place, minDate, maxDate, onClose, onSubmit }: AddToBucketModalProps) {
  const [customTitle, setCustomTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [activityType, setActivityType] = useState('');
  const [priority, setPriority] = useState<BucketListPriority | ''>('');
  const [tags, setTags] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCustomTitle('');
    setNotes('');
    setDate('');
    setTime('');
    setActivityType('');
    setPriority('');
    setTags('');
    setDurationMinutes('');
    setError(null);
  }, [isOpen]);

  const proposedTime = useMemo(() => {
    if (!date || !time) return undefined;
    const combined = new Date(`${date}T${time}`);
    if (Number.isNaN(combined.getTime())) {
      return undefined;
    }
    return combined.toISOString();
  }, [date, time]);

  const parsedDuration = useMemo(() => {
    const value = Number(durationMinutes);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [durationMinutes]);

  const parsedTags = useMemo(
    () => tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    [tags],
  );

  const handleSubmit = async () => {
    if (isSubmitting) return;

    if (time && !date) {
      setError('Select a date to use with the time.');
      return;
    }

    if (date) {
      if (minDate && date < minDate) {
        setError('Select a date within the trip range.');
        return;
      }
      if (maxDate && date > maxDate) {
        setError('Select a date within the trip range.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await onSubmit({
        customTitle: customTitle.trim() || undefined,
        notes: notes.trim() || undefined,
        proposedTime,
        activityType: activityType || undefined,
        priority: priority || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        durationMinutes: parsedDuration,
      });

      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    } catch (submitError: any) {
      setError(submitError?.message ?? 'Failed to add this place.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Add to bucket list" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Place</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">{place.name}</h3>
          <p className="text-sm text-gray-500">{place.address}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Custom title">
            <input
              type="text"
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder="Optional nickname"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Activity type">
            <select
              value={activityType}
              onChange={(event) => setActivityType(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Select type</option>
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Proposed date">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              min={minDate}
              max={maxDate}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Proposed time">
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Priority">
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as BucketListPriority | '')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Optional</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Estimated duration (minutes)">
            <input
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
              placeholder="e.g. 90"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Tags">
          <input
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Comma separated"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Optional notes for the group"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </Field>

        <p className="text-xs text-gray-500">
          Date and time are optional. If you provide both, the weather contingency check will use that time.
        </p>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? 'Adding...' : 'Add to bucket'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-medium text-gray-700">
      <span>{label}</span>
      {children}
    </label>
  );
}
