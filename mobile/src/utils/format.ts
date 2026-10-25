import type { Tone } from '../components/Badge';
import type { TaskPriority, TaskStatus, TaskType, UnitStatus } from '../api/types';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

export const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--';

export const date = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (iso?: string | null) => (iso ? `${date(iso)}, ${time(iso)}` : '—');

export const duration = (minutes?: number | null) => {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

export const kes = (amount?: number | null) => `KES ${(amount ?? 0).toLocaleString('en-KE')}`;

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export const taskStatusTone: Record<TaskStatus, Tone> = {
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'brand',
  VERIFIED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

export const priorityTone: Record<TaskPriority, Tone> = { LOW: 'neutral', NORMAL: 'info', HIGH: 'warning', URGENT: 'danger' };

export const unitStatusTone: Record<UnitStatus, Tone> = {
  IN_STORE: 'neutral',
  IN_TRANSIT: 'warning',
  WITH_TECHNICIAN: 'info',
  INSTALLED: 'success',
  FAULTY: 'danger',
  LOST: 'danger',
};

export const taskTypeIcon: Record<TaskType, 'wifi' | 'construct' | 'build' | 'swap-horizontal' | 'map'> = {
  INSTALLATION: 'wifi',
  REPAIR: 'construct',
  MAINTENANCE: 'build',
  RELOCATION: 'swap-horizontal',
  SURVEY: 'map',
};

export const flagLabel: Record<string, string> = {
  NO_LOCATION: 'No GPS',
  LOW_GPS_ACCURACY: 'Weak GPS',
  OUTSIDE_GEOFENCE: 'Outside office',
  DEVICE_CLOCK_SKEW: 'Clock mismatch',
};

export const minutesSince = (iso?: string | null) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000)) : 0);
