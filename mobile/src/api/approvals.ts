import type { ReviewStatus, TaskStatus, TaskType } from './types';

/** Responses of the review desk (GET /approvals/...) and photo details. */

export interface ProofPhoto {
  id: string;
  flags: string[];
  lat: number | null;
  lng: number | null;
  accuracyM?: number | null;
  receivedAt: string;
  deviceTime?: string | null;
  purpose?: string;
}

export interface ApprovalSummary {
  checkIns: number;
  checkOuts: number;
  jobs: number;
  total: number;
  flagged: number;
}

interface Who {
  id: string;
  name: string;
  staffNo: string;
  phone?: string | null;
}

export interface AttendanceReview {
  id: string;
  userId: string;
  workDate: string;
  status: 'PRESENT' | 'LATE';
  checkInAt: string;
  checkOutAt: string | null;
  workedMinutes: number | null;
  dressChecklist: Record<string, boolean> | null;
  dressReview: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy?: { id: string; name: string } | null;
  checkOutReview?: ReviewStatus | null;
  checkOutNote?: string | null;
  checkOutReviewedAt?: string | null;
  checkOutReviewedBy?: { id: string; name: string } | null;
  user: Who;
  checkInPhoto: ProofPhoto;
  checkOutPhoto?: ProofPhoto | null;
}

export interface JobReview {
  id: string;
  code: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  customerName: string;
  customerAccount: string | null;
  address: string;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  completionNotes: string | null;
  amountCollected: number | null;
  signedByName: string | null;
  signed: boolean;
  verificationNote: string | null;
  verifiedAt: string | null;
  verifiedBy?: { id: string; name: string } | null;
  assignee: Who;
  startPhoto: ProofPhoto | null;
  endPhoto: ProofPhoto | null;
  materials: { id: string; quantity: number; amount: number; item: { name: string; unit: string }; unit: { serialNumber: string } | null }[];
}

export interface ActivityEvent {
  at: string;
  kind: string;
  title: string;
  detail?: string;
  photo?: ProofPhoto | null;
  status?: string | null;
  note?: string | null;
  taskId?: string;
  attendanceId?: string;
}

export interface Activity {
  user: Who & { role: string };
  date: string;
  summary: { jobsDone: number; minutesWorked: number | null; photos: number; flags: number; checkedIn: boolean };
  events: ActivityEvent[];
}

export interface PhotoInfo {
  id: string;
  purpose: string;
  receivedAt: string;
  deviceTime: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  deviceId: string | null;
  sizeBytes: number;
  flags: string[];
  user: Who;
  usedFor: { kind: 'TASK'; id: string; code: string; title: string } | { kind: 'ATTENDANCE'; id: string } | null;
}
