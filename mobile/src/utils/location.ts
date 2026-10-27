import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { LatLng } from '../api/field';

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
  /** Degrees from north, when moving (browsers report nothing when standing still). */
  heading: number | null;
  /** Metres per second. */
  speed: number | null;
  at: number;
}

const clean = (n: number | null | undefined, max: number) => (n == null || Number.isNaN(n) || n < 0 || n > max ? null : n);

export const toFix = (l: Location.LocationObject): Fix => ({
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  accuracy: clean(l.coords.accuracy, 100_000),
  heading: clean(l.coords.heading, 360),
  speed: clean(l.coords.speed, 100),
  at: l.timestamp || Date.now(),
});

/** Asks the phone/browser for location permission. True when allowed. */
export async function askLocation(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Is location already allowed (without asking)? */
export async function locationAllowed(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

export async function currentFix(): Promise<Fix | null> {
  try {
    return toFix(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
  } catch {
    return null;
  }
}

/**
 * Follows the phone's position until the returned function is called.
 * On the web this talks to the browser directly: expo-location's web watcher mixes up its own ids with the
 * browser's (so only the first watcher ever hears anything) and never stops the browser watch.
 */
export function watchFix(onFix: (f: Fix) => void, onError?: () => void): () => void {
  if (Platform.OS === 'web') {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) {
      onError?.();
      return () => {};
    }
    const id = geo.watchPosition(
      (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: clean(p.coords.accuracy, 100_000), heading: clean(p.coords.heading, 360), speed: clean(p.coords.speed, 100), at: p.timestamp || Date.now() }),
      (e) => e.code === e.PERMISSION_DENIED && onError?.(),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20_000 },
    );
    return () => geo.clearWatch(id);
  }
  let stopped = false;
  let sub: Location.LocationSubscription | null = null;
  Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 4000, distanceInterval: 5 }, (l) => !stopped && onFix(toFix(l)))
    .then((s) => (stopped ? s.remove() : (sub = s)))
    .catch(() => onError?.());
  return () => {
    stopped = true;
    sub?.remove();
  };
}

/** Metres between two points. */
export function metres(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b in degrees. */
export function bearing(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** "350 m" / "4.2 km" */
export const distanceLabel = (m: number) => (m < 950 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`);
/** "12 min" / "1 h 05 min" */
export const minutesLabel = (sec: number) => {
  const min = Math.max(1, Math.round(sec / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
};
/** Clock time in Nairobi, e.g. "10:42". */
export const clockAt = (ms: number) => new Date(ms).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });
