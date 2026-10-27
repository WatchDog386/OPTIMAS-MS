import { env } from '../config/env';
import { distanceMetres } from './geo';

/**
 * Driving routes for in-app navigation and arrival times. Uses an OSRM server (ROUTING_URL); when it is
 * switched off or cannot be reached, falls back to an estimate from the straight-line distance so the
 * app always has something sensible to show.
 */

export interface RouteStep {
  instruction: string;
  /** Metres covered by this step. */
  distance: number;
  /** Seconds this step takes. */
  duration: number;
  /** Where the manoeuvre happens. */
  lat: number;
  lng: number;
}

export interface Route {
  /** Metres along the road (or the estimate). */
  distance: number;
  /** Seconds of driving. */
  duration: number;
  /** [lat, lng] points to draw. */
  geometry: [number, number][];
  steps: RouteStep[];
  source: 'road' | 'estimate';
}

// Nairobi-area figures: roads wind about 40% longer than a straight line; a motorbike or van averages ~24 km/h in town.
const ROAD_FACTOR = 1.4;
const TOWN_SPEED_MPS = 24_000 / 3600;

/** Straight-line based estimate (always available, no network). */
export function estimateRoute(from: [number, number], to: [number, number]): Route {
  const distance = Math.round(distanceMetres(from[0], from[1], to[0], to[1]) * ROAD_FACTOR);
  const duration = Math.round(distance / TOWN_SPEED_MPS);
  return {
    distance,
    duration,
    geometry: [from, to],
    steps: [{ instruction: 'Head towards the customer', distance, duration, lat: from[0], lng: from[1] }],
    source: 'estimate',
  };
}

/** Rough minutes to drive between two points without asking the routing server (used to rank many technicians). */
export const estimateMinutes = (from: [number, number], to: [number, number]) => Math.max(1, Math.round(estimateRoute(from, to).duration / 60));

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number };
}

/** Plain-English instruction for one OSRM step. */
export function describeStep(step: OsrmStep): string {
  const { type, modifier, exit } = step.maneuver;
  const road = step.name ? ` onto ${step.name}` : '';
  const along = step.name ? ` along ${step.name}` : '';
  const turn = modifier ?? '';
  switch (type) {
    case 'depart':
      return `Start${along || ' driving'}`;
    case 'arrive':
      return 'You have arrived at the customer';
    case 'roundabout':
    case 'rotary':
      return `At the roundabout, take exit ${exit ?? 1}${road}`;
    case 'merge':
      return `Merge${road}`;
    case 'fork':
      return `Keep ${turn || 'ahead'} at the fork${road}`;
    case 'end of road':
      return `At the end of the road, turn ${turn || 'ahead'}${road}`;
    case 'continue':
    case 'new name':
      return `Continue${along || ' straight'}`;
    default:
      if (!modifier || modifier === 'straight') return `Continue straight${along}`;
      if (modifier === 'uturn') return `Make a U-turn${road}`;
      return `Turn ${turn}${road}`;
  }
}

type OsrmResponse = { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { steps: OsrmStep[] }[] }[] };

/** Turns an OSRM /route answer (geojson geometry, steps on) into our Route. Throws if there is no route. */
export function parseOsrm(raw: unknown): Route {
  const body = raw as OsrmResponse;
  const r = body.routes?.[0];
  if (body.code !== 'Ok' || !r) throw new Error(`routing ${body.code}`);
  return {
    distance: Math.round(r.distance),
    duration: Math.round(r.duration),
    geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    steps: r.legs.flatMap((l) => l.steps).map((s) => ({ instruction: describeStep(s), distance: Math.round(s.distance), duration: Math.round(s.duration), lat: s.maneuver.location[1], lng: s.maneuver.location[0] })),
    source: 'road',
  };
}

const cache = new Map<string, { at: number; route: Route }>();
const key = (from: [number, number], to: [number, number]) => [...from, ...to].map((n) => n.toFixed(4)).join(',');

/** Road route from → to. Never throws. */
export async function drivingRoute(from: [number, number], to: [number, number]): Promise<Route> {
  if (!env.ROUTING_URL || env.NODE_ENV === 'test') return estimateRoute(from, to);
  const k = key(from, to);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < 60_000) return hit.route;
  try {
    const url = `${env.ROUTING_URL.replace(/\/$/, '')}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'OptimasMS/1.0' } });
    if (!res.ok) throw new Error(`routing ${res.status}`);
    const route = parseOsrm(await res.json());
    if (cache.size > 500) cache.clear();
    cache.set(k, { at: Date.now(), route });
    return route;
  } catch (err) {
    console.warn('[routing] falling back to estimate:', (err as Error).message);
    return estimateRoute(from, to);
  }
}

/** Coordinates for a typed Kenyan address, or null. Never throws. */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!env.GEOCODING_URL || env.NODE_ENV === 'test' || address.trim().length < 3) return null;
  try {
    const url = `${env.GEOCODING_URL.replace(/\/$/, '')}/search?format=json&limit=1&countrycodes=ke&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'OptimasMS/1.0 (field service app)' } });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}
