// ─── CreateEventModal.tsx ─────────────────────────────────────────────────────
// Modal for the owner to manually create a custom timeline event.

import { useState } from 'react';
import type { Trip } from '@/types';

const TAG_OPTIONS = ['outdoor', 'dining', 'photography', 'culture', 'adventure', 'relaxation', 'shopping', 'nightlife'];

const DURATION_PRESETS = [
  { label: '30 min', value: 30 },
  { label: '1 hr',   value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr',   value: 120 },
  { label: '3 hr',   value: 180 },
  { label: 'Custom', value: 0 },
];

interface CreateEventModalProps {
  trip: Trip;
  defaultDate?: string;
  defaultStartTime?: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    location: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    tags: string[];
  }) => void;
}

export function CreateEventModal({
  trip,
  defaultDate,
  defaultStartTime,
  onClose,
  onSubmit,
}: CreateEventModalProps) {
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [location, setLocation]     = useState('');
  const [date, setDate]             = useState(defaultDate ?? trip.startDate);
  const [startTime, setStartTime]   = useState(defaultStartTime ?? '09:00');
  const [durationPreset, setPreset] = useState(60);
  const [customDuration, setCustom] = useState('60');
  const [tags, setTags]             = useState<string[]>([]);
  const [error, setError]           = useState('');

  const durationMinutes = durationPreset === 0
    ? Math.max(15, parseInt(customDuration) || 60)
    : durationPreset;

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (date < trip.startDate || date > trip.endDate) {
      setError(`Date must be between ${trip.startDate} and ${trip.endDate}.`);
      return;
    }
    onSubmit({ title, description, location, date, startTime, durationMinutes, tags });
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Add custom event</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <Field label="Title" id="ev-title">
            <input
              id="ev-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Sunrise hike at Triund"
            />
          </Field>

          {/* Description */}
          <Field label="Description (optional)" id="ev-desc">
            <textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Any notes for the group…"
            />
          </Field>

          {/* Location */}
          <Field label="Location (optional)" id="ev-loc">
            <input
              id="ev-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputCls}
              placeholder="Meeting point or venue name"
            />
          </Field>

          {/* Date + Start time */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" id="ev-date">
              <input
                id="ev-date"
                type="date"
                required
                min={trip.startDate}
                max={trip.endDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Start time" id="ev-start">
              <input
                id="ev-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(normalizeTimeInput(e.target.value))}
                step={60}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPreset(p.value)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    durationPreset === p.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-gray-200 text-gray-600 hover:border-indigo-300',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {durationPreset === 0 && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="15"
                  max="720"
                  value={customDuration}
                  onChange={(e) => setCustom(e.target.value)}
                  className={`${inputCls} w-24`}
                />
                <span className="text-sm text-gray-500">minutes</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tags (for constraint engine)
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={[
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    tags.includes(tag)
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300',
                  ].join(' ')}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Add to timeline
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function normalizeTimeInput(value: string): string {
  if (!value) return '';
  const parts = value.split(':');
  if (parts.length < 2) return value;
  return `${parts[0]}:${parts[1]}`;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
