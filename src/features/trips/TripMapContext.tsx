import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode, MutableRefObject } from 'react';
import type { MapMarker } from '@/components/MapView';

interface TripMapContextValue {
  // Map instance — set once in TripWorkspacePage's onLoad
  mapRef:    MutableRefObject<google.maps.Map | null>;
  isLoaded:  boolean;
  idleTick:  number;

  // Marker layer — written by the active child route, read by the workspace MapView
  mapMarkers:       MapMarker[];
  selectedMarkerId: string | null;
  hoveredMarkerId:  string | null;
  renderInfoWindow: ((id: string) => ReactNode) | null;

  setMapLoaded:          (loaded: boolean) => void;
  setIdleTick:           (tick: number | ((t: number) => number)) => void;
  setMapMarkers:         (markers: MapMarker[]) => void;
  setSelectedMarkerId:   (id: string | null) => void;
  setHoveredMarkerId:    (id: string | null) => void;
  /** Pass null to clear, or a render function — wrapped internally to avoid React's functional-update pitfall */
  setRenderInfoWindow:   (fn: ((id: string) => ReactNode) | null) => void;
}

const TripMapContext = createContext<TripMapContextValue>(null!);

export function useTripMap(): TripMapContextValue {
  return useContext(TripMapContext);
}

export function TripMapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<google.maps.Map | null>(null);

  const [isLoaded,         setMapLoaded]         = useState(false);
  const [idleTick,         setIdleTick]           = useState(0);
  const [mapMarkers,       setMapMarkers]         = useState<MapMarker[]>([]);
  const [selectedMarkerId, setSelectedMarkerId]   = useState<string | null>(null);
  const [hoveredMarkerId,  setHoveredMarkerId]    = useState<string | null>(null);
  // Store as a box to avoid React treating the fn as a state-updater
  const [infoWindowBox, setInfoWindowBox] = useState<{ fn: ((id: string) => ReactNode) | null }>({ fn: null });

  const setRenderInfoWindow = useCallback((fn: ((id: string) => ReactNode) | null) => {
    setInfoWindowBox({ fn });
  }, []);

  return (
    <TripMapContext.Provider
      value={{
        mapRef,
        isLoaded,
        idleTick,
        mapMarkers,
        selectedMarkerId,
        hoveredMarkerId,
        renderInfoWindow: infoWindowBox.fn,
        setMapLoaded,
        setIdleTick,
        setMapMarkers,
        setSelectedMarkerId,
        setHoveredMarkerId,
        setRenderInfoWindow,
      }}
    >
      {children}
    </TripMapContext.Provider>
  );
}
