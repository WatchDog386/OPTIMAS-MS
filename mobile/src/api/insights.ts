/** Responses of the manager insight endpoints (GET /insights/...). */

export interface LeaderRow {
  rank: number;
  user: { id: string; name: string; staffNo: string; region?: string | null };
  jobs: number;
  avgMinutes: number;
  rating: { average: number | null; count: number };
  daysPresent: number;
  lateDays: number;
  onTimeRate: number | null;
  score: number;
}
export interface Leaderboard {
  range: 'week' | 'month';
  days: number;
  from: string;
  leaders: LeaderRow[];
}

export type MapState = 'ON_JOB' | 'AVAILABLE' | 'OFFLINE';
export interface LiveMap {
  generatedAt: string;
  staff: {
    user: { id: string; name: string; staffNo: string; phone: string | null };
    state: MapState;
    lat: number | null;
    lng: number | null;
    seenAt: string | null;
    currentTask: { code: string; title: string } | null;
  }[];
  jobs: { id: string; code: string; title: string; status: string; priority: string; address: string; lat: number | null; lng: number | null; assigneeName: string }[];
}

export interface DayPoint {
  date: string;
  created: number;
  completed: number;
  collected: number;
  present: number;
  late: number;
  issued: number;
  returned: number;
  installed: number;
  consumed: number;
}
export interface Charts {
  days: number;
  perDay: DayPoint[];
  byType: { type: string; count: number }[];
}

export interface Ratings {
  average: number | null;
  count: number;
  distribution: { stars: number; count: number }[];
  byTechnician: { user: { id: string; name: string; staffNo: string }; average: number; count: number }[];
  recent: { id: string; code: string; title: string; customerName: string; rating: number; feedback: string | null; ratedAt: string; technician: string }[];
}
