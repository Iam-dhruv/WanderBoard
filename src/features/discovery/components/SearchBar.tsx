import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '@/features/discovery/services/placesApi';
import type { Place } from '@/features/discovery/types';

interface SearchBarProps {
  onResults: (places: Place[]) => void;
  onLoadingChange: (loading: boolean) => void;
  onErrorChange?: (message: string | null) => void;
}

export function SearchBar({ onResults, onLoadingChange, onErrorChange }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      requestIdRef.current += 1;
      setIsSearching(false);
      onLoadingChange(false);
      onErrorChange?.(null);
      onResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const requestId = ++requestIdRef.current;

      setIsSearching(true);
      onLoadingChange(true);

      try {
        if (!window.google?.maps?.places) {
          onErrorChange?.('Google Places is still loading.');
          onResults([]);
          return;
        }

        const places = await searchPlaces(trimmed);
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
        onErrorChange?.(message);
        onResults([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
          onLoadingChange(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query, onResults, onLoadingChange, onErrorChange]);

  return (
    <div className="space-y-2">
      <label htmlFor="discovery-search" className="block text-sm font-medium text-gray-700">
        Search places
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <input
          id="discovery-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: cafes in Paris, museums in Rome"
          className="w-full border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
        {isSearching && <span className="text-xs text-gray-500">Searching...</span>}
      </div>
    </div>
  );
}
