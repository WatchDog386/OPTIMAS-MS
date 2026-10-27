import type { Role } from './types';

/** Responses for live tracking, dispatch, chat and customer onboarding. */

export type LatLng = [number, number];

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  lat: number;
  lng: number;
}

export interface Route {
  /** Metres. */
  distance: number;
  /** Seconds. */
  duration: number;
  geometry: LatLng[];
  steps: RouteStep[];
  /** 'road' = real road route; 'estimate' = from the straight-line distance (routing server unreachable). */
  source: 'road' | 'estimate';
  arriveAt?: string;
}

export interface TrackedPosition {
  lat: number;
  lng: number;
  at: string;
  heading: number | null;
  speed: number | null;
  kind: 'live' | 'recent' | 'photo';
}

export interface JobTrack {
  job: { id: string; code: string; title: string; status: string; address: string; customerName: string; lat: number | null; lng: number | null; startedAt: string | null };
  tech: { id?: string; name: string; phone: string | null; position: TrackedPosition | null };
  trail: LatLng[];
  route: Route | null;
}

export interface NearbyTech {
  user: { id: string; name: string; phone: string | null; staffNo: string };
  current: boolean;
  onDuty: boolean;
  busy: boolean;
  openJobs: number;
  position: { lat: number; lng: number; at: string; kind: TrackedPosition['kind'] } | null;
  distanceKm: number | null;
  etaMinutes: number | null;
}

export interface Nearby {
  job: { id: string; lat: number | null; lng: number | null; status: string };
  suggestedId: string | null;
  technicians: NearbyTech[];
}

export interface ConversationRow {
  id: string;
  kind: 'DIRECT' | 'SUPPORT';
  title: string;
  subtitle: string;
  role: Role | 'SUPPORT' | null;
  lastMessage: { body: string; at: string; mine: boolean };
  unread: number;
}

export interface ChatMessage {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: { id: string; name: string; role: Role };
  /** Client-only: still being sent. */
  pending?: boolean;
}

export interface ConversationDetail {
  conversation: {
    id: string;
    kind: 'DIRECT' | 'SUPPORT';
    title: string;
    subtitle: string;
    role: Role | 'SUPPORT' | null;
    phone: string | null;
    otherId: string | null;
    jobs: { id: string; code: string; title: string; status: string }[];
  };
  messages: ChatMessage[];
}

export interface Contact {
  id: string;
  name: string;
  role: Role;
  phone: string | null;
  customerAccount: string | null;
  reason?: string;
}

export interface Onboarded {
  user: { id: string; name: string; staffNo: string; customerAccount: string | null };
  loginId: string;
  temporaryPassword: string;
}
