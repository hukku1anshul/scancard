import type { ScanLocation } from '../types';

/** Capture browser GPS coordinates and reverse-geocode to a human-readable city/venue label via OpenStreetMap Nominatim. */
export async function captureGeoLocation(timeoutMs = 7000): Promise<ScanLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve(p);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs - 500, maximumAge: 180_000 },
    );
  });

  if (!pos) return null;
  const lat = Number(pos.coords.latitude.toFixed(5));
  const lng = Number(pos.coords.longitude.toFixed(5));
  const capturedAt = Date.now();

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      {
        headers: { Accept: 'application/json' },
        signal: ctrl.signal,
      },
    );
    clearTimeout(t);
    if (res.ok) {
      const data = await res.json();
      const a = data.address || {};
      const venue = data.name || a.amenity || a.building || a.Suburb || a.neighbourhood || a.road;
      const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district;
      const region = a.state || a.country_code?.toUpperCase();
      const parts = [venue, city, region].filter(Boolean);
      const unique = parts.filter((v, i) => parts.indexOf(v) === i);
      const label = unique.slice(0, 3).join(', ') || data.display_name?.split(',').slice(0, 2).join(',').trim() || `${lat}, ${lng}`;
      return { lat, lng, label, capturedAt };
    }
  } catch {
    // Fallback to raw coordinates if offline or rate-limited
  }

  return { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, capturedAt };
}

export function mapsUrl(loc?: ScanLocation | null): string | undefined {
  if (!loc) return undefined;
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
  }
  if (loc.label) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.label)}`;
  }
  return undefined;
}
