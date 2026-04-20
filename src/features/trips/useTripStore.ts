import { create } from 'zustand';
import type { Trip, TripDestinationCity, TripMember } from '@/types';

// ─── Trip store ───────────────────────────────────────────────────────────────
// Holds the list of the current user's trips and the active trip's members.
// Service calls live in tripService.ts — this store only holds derived state.

interface TripState {
  trips:         Trip[];
  activeTrip:    Trip | null;
  members:       TripMember[];
  tripsLoading:  boolean;
  tripsError:    string | null;

  setTrips:      (trips: Trip[]) => void;
  addTrip:       (trip: Trip) => void;
  setActiveTrip: (trip: Trip | null) => void;
  setMembers:    (members: TripMember[]) => void;
  patchActiveTrip: (patch: Partial<Trip>) => void;
  upsertActiveDestinationCity: (city: TripDestinationCity) => void;
  setActiveSelectedDestinationCity: (cityName: string) => void;
  setLoading:    (loading: boolean) => void;
  setError:      (error: string | null) => void;
  reset:         () => void;
}

function normalizeCityName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

const initialState = {
  trips:        [],
  activeTrip:   null,
  members:      [],
  tripsLoading: false,
  tripsError:   null,
};

export const useTripStore = create<TripState>((set) => ({
  ...initialState,

  setTrips:      (trips)   => set({ trips, tripsLoading: false, tripsError: null }),
  addTrip:       (trip)    => set((s) => ({ trips: [...s.trips, trip] })),
  setActiveTrip: (trip)    => set({ activeTrip: trip, members: [] }),
  setMembers:    (members) => set({ members }),
  patchActiveTrip: (patch) => set((s) => {
    if (!s.activeTrip) return s;
    const activeTrip = { ...s.activeTrip, ...patch };
    return {
      activeTrip,
      trips: s.trips.map((t) => (t.id === activeTrip.id ? activeTrip : t)),
    };
  }),
  upsertActiveDestinationCity: (city) => set((s) => {
    if (!s.activeTrip) return s;

    const normalizedName = normalizeCityName(city.name);
    if (!normalizedName) return s;

    const existing = s.activeTrip.destinationCities ?? [];
    const index = existing.findIndex((c) => normalizeCityName(c.name).toLowerCase() === normalizedName.toLowerCase());
    const nextCities = [...existing];

    if (index === -1) {
      nextCities.push({ ...city, name: normalizedName });
    } else {
      nextCities[index] = {
        ...nextCities[index],
        name: normalizedName,
        placeId: nextCities[index].placeId ?? city.placeId,
        location: nextCities[index].location ?? city.location,
      };
    }

    const destination = nextCities.map((c) => c.name).join('; ');
    const activeTrip = {
      ...s.activeTrip,
      destination,
      destinationCities: nextCities,
      selectedDestinationCity: s.activeTrip.selectedDestinationCity ?? nextCities[0]?.name,
    };

    return {
      activeTrip,
      trips: s.trips.map((t) => (t.id === activeTrip.id ? activeTrip : t)),
    };
  }),
  setActiveSelectedDestinationCity: (cityName) => set((s) => {
    if (!s.activeTrip) return s;
    const normalizedName = normalizeCityName(cityName);
    if (!normalizedName) return s;

    const activeTrip = {
      ...s.activeTrip,
      selectedDestinationCity: normalizedName,
    };
    return {
      activeTrip,
      trips: s.trips.map((t) => (t.id === activeTrip.id ? activeTrip : t)),
    };
  }),
  setLoading:    (loading) => set({ tripsLoading: loading }),
  setError:      (error)   => set({ tripsError: error, tripsLoading: false }),

  // Call on sign-out to wipe all trip state
  reset: () => set(initialState),
}));
