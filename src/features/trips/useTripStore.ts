import { create } from 'zustand';
import type { Trip, TripMember } from '@/types';

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
  setLoading:    (loading: boolean) => void;
  setError:      (error: string | null) => void;
  reset:         () => void;
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
  setLoading:    (loading) => set({ tripsLoading: loading }),
  setError:      (error)   => set({ tripsError: error, tripsLoading: false }),

  // Call on sign-out to wipe all trip state
  reset: () => set(initialState),
}));
