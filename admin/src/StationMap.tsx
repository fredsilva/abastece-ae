import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];
const NO_COORDS_ZOOM = 4;
const PIN_ZOOM = 16;

interface Props {
  latitude: number;
  longitude: number;
}

export function StationMap({ latitude, longitude }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center: BRAZIL_CENTER, zoom: NO_COORDS_ZOOM });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // O modal pode montar o container antes do layout final; sem isso o tile fica cortado.
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0);
    const position: [number, number] = hasCoords ? [latitude, longitude] : BRAZIL_CENTER;

    if (!markerRef.current) {
      markerRef.current = L.marker(position).addTo(map);
    } else {
      markerRef.current.setLatLng(position);
    }
    map.setView(position, hasCoords ? PIN_ZOOM : NO_COORDS_ZOOM);
  }, [latitude, longitude]);

  return <div ref={containerRef} className="map-preview" />;
}
