import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import type { Libraries } from '@react-google-maps/api';

const MAP_LIBRARIES: Libraries = ['places', 'geometry'];

const WB_MAP_STYLES = [
  { featureType: 'water',          elementType: 'geometry',           stylers: [{ color: '#C8DDF0' }] },
  { featureType: 'landscape',      elementType: 'geometry',           stylers: [{ color: '#F0E9D9' }] },
  { featureType: 'road.highway',   elementType: 'geometry',           stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.local',     elementType: 'geometry',           stylers: [{ color: '#F5F0E8' }] },
  { featureType: 'poi',            elementType: 'labels',             stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',        elementType: 'labels',             stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke',    stylers: [{ color: '#D4C9B8' }] },
  { featureType: 'all',            elementType: 'labels.text.fill',   stylers: [{ color: '#0F1C2E' }] },
  { featureType: 'all',            elementType: 'labels.text.stroke', stylers: [{ color: '#FAF6EF' }, { weight: 2 }] },
];

export interface MapMarker {
  id:           string;
  position:     { lat: number; lng: number };
  title?:       string;
  color?:       string;
  highlighted?: boolean;
}

export interface MapViewProps {
  /** Undefined while geocoding — shows skeleton instead of map */
  center?:           { lat: number; lng: number };
  zoom?:             number;
  /** Bump this value to pan the map back to center */
  recenterTrigger?:  number;
  markers?:          MapMarker[];
  selectedMarkerId?: string;
  onMarkerClick?:    (markerId: string) => void;
  onInfoWindowClose?: () => void;
  renderInfoWindow?: (markerId: string) => ReactNode;
  onLoad?:           (map: google.maps.Map) => void;
  onUnmount?:        () => void;
  style?:            CSSProperties;
  className?:        string;
}

function createPinIcon(color: string, highlighted: boolean): google.maps.Icon {
  const w = highlighted ? 34 : 26;
  const h = highlighted ? 44 : 34;
  const cx = w / 2;
  const cy = highlighted ? 16 : 12;
  const r = highlighted ? 6.5 : 5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <path d="M${cx} 1C${Math.round(cx * 0.4)} 1 1 ${Math.round(cx * 0.85)} 1 ${cx + 1}c0 ${Math.round(cx * 1.05)} ${cx - 1} ${Math.round(h * 0.65)} ${cx - 1} ${Math.round(h * 0.65)}s${cx - 1}-${Math.round(h * 0.35)} ${cx - 1}-${Math.round(h * 0.65)}C${w - 1} ${Math.round(cx * 0.85)} ${Math.round(cx * 1.6)} 1 ${cx} 1z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="white" opacity="0.92"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(w, h),
    anchor: new google.maps.Point(cx, h),
  };
}

export function MapView({
  center,
  zoom = 12,
  recenterTrigger,
  markers = [],
  selectedMarkerId,
  onMarkerClick,
  onInfoWindowClose,
  renderInfoWindow,
  onLoad,
  onUnmount,
  style,
  className,
}: MapViewProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id:               'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    libraries:        MAP_LIBRARIES,
  });

  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(center);

  useEffect(() => {
    if (!mapCenter && center) {
      setMapCenter(center);
    }
  }, [mapCenter, center]);

  useEffect(() => {
    if (!center) return;
    setMapCenter(center);
    mapInstanceRef.current?.panTo(center);
  }, [recenterTrigger, center]);

  function syncCenterFromMap() {
    const current = mapInstanceRef.current?.getCenter();
    if (!current) return;
    const next = { lat: current.lat(), lng: current.lng() };
    setMapCenter((prev) => {
      if (!prev) return next;
      if (Math.abs(prev.lat - next.lat) < 0.0000001 && Math.abs(prev.lng - next.lng) < 0.0000001) {
        return prev;
      }
      return next;
    });
  }

  if (loadError) {
    return (
      <div
        style={style}
        className={['w-full h-full flex items-center justify-center', className ?? ''].join(' ')}
      >
        <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>Map unavailable</p>
      </div>
    );
  }

  if (!isLoaded || !center) {
    return <MapSkeleton style={style} className={className} />;
  }

  const selectedMarker = selectedMarkerId ? markers.find((m) => m.id === selectedMarkerId) : null;

  return (
    <GoogleMap
      mapContainerStyle={style}
      mapContainerClassName={className}
      center={mapCenter ?? center}
      zoom={zoom}
      onLoad={(map) => {
        mapInstanceRef.current = map;
        onLoad?.(map);
      }}
      onUnmount={() => {
        mapInstanceRef.current = null;
        onUnmount?.();
      }}
      onDragEnd={syncCenterFromMap}
      onZoomChanged={syncCenterFromMap}
      onIdle={syncCenterFromMap}
      options={{
        streetViewControl: false,
        mapTypeControl:    false,
        fullscreenControl: false,
        zoomControl:       false,
        styles:            WB_MAP_STYLES,
      }}
    >
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={m.position}
          title={m.title}
          icon={m.color ? createPinIcon(m.color, m.highlighted ?? false) : undefined}
          zIndex={m.highlighted ? 10 : 1}
          onClick={onMarkerClick ? () => onMarkerClick(m.id) : undefined}
        />
      ))}

      {selectedMarker && renderInfoWindow && (
        <InfoWindow
          position={selectedMarker.position}
          onCloseClick={onInfoWindowClose}
          options={{ maxWidth: 280, pixelOffset: new google.maps.Size(0, -8) }}
        >
          <div>{renderInfoWindow(selectedMarker.id)}</div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

function MapSkeleton({ style, className }: { style?: CSSProperties; className?: string }) {
  return (
    <div
      style={{
        ...style,
        background:
          'radial-gradient(1200px 700px at 30% 30%, #DDEAF3, transparent 60%), ' +
          'radial-gradient(900px 500px at 70% 80%, #FAEFD9, transparent 60%), #EEE4CC',
      }}
      className={['w-full h-full flex items-center justify-center', className ?? ''].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--wb-ink-soft)' }} />
        <p className="text-sm" style={{ color: 'var(--wb-ink-soft)' }}>Loading map…</p>
      </div>
    </div>
  );
}
