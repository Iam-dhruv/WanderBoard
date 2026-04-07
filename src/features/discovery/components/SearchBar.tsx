import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '@/features/discovery/services/placesApi';
import type { Place } from '@/features/discovery/types';

interface SearchBarProps {
  onResults: (places: Place[]) => void;
  onLoadingChange?: (loading: boolean) => void;
  onErrorChange?: (error: string | null) => void;
  debounceMs?: number;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchBar({
  onResults,
  onLoadingChange,
  onErrorChange,
  debounceMs = 450,
  placeholder = 'Search destinations, cafes, attractions...',
  disabled = false,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (!normalizedQuery || disabled) {
      requestIdRef.current += 1;
      onLoadingChange?.(false);
      onErrorChange?.(null);
      onResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      onLoadingChange?.(true);

      try {
        if (!window.google?.maps?.places) {
          onResults([]);
          onErrorChange?.('Google Maps is still loading. Please try again in a moment.');
          return;
        }

        const places = await searchPlaces(normalizedQuery);
        if (requestId !== requestIdRef.current) {
          return;
        }

        onErrorChange?.(null);
        onResults(places);
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Failed to search places.';
        onResults([]);
        onErrorChange?.(message);
      } finally {
        if (requestId === requestIdRef.current) {
          onLoadingChange?.(false);
        }
      }
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [query, disabled, debounceMs, onResults, onLoadingChange, onErrorChange]);

  return (
    <div className="space-y-2">
      <label htmlFor="discovery-search" className="block text-sm font-medium text-gray-700">
        Discover places
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <input
          id="discovery-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:text-gray-400"
        />
      </div>
    </div>
  );
}
