import type { LineString } from 'geojson';

export interface DrivingRoute {
  geometry: LineString;
  distanceMeters: number;
  durationSeconds: number;
}

export async function fetchDrivingRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): Promise<DrivingRoute | null> {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const body = await res.json();
  const route = body.routes?.[0];
  if (!route) return null;

  return {
    geometry: route.geometry,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
