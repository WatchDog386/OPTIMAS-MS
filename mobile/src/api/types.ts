export type Role = 'ADMIN' | 'SUPERVISOR' | 'STOREKEEPER' | 'TECHNICIAN' | 'CUSTOMER';
export type CapturePurpose = 'CHECK_IN' | 'CHECK_OUT' | 'TASK_START' | 'TASK_END';
export type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'REJECTED' | 'CANCELLED';
export type TaskType = 'INSTALLATION' | 'REPAIR' | 'MAINTENANCE' | 'RELOCATION' | 'SURVEY';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type UnitStatus = 'IN_STORE' | 'IN_TRANSIT' | 'WITH_TECHNICIAN' | 'INSTALLED' | 'FAULTY' | 'LOST';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  staffNo: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  region: string | null;
  customerAccount?: string | null;
  address?: string | null;
  active: boolean;
  mustChangePassword?: boolean;
  /** Whether the person lets the app use their location; null until asked. */
  locationConsent?: boolean | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface PhotoRef {
  id: string;
  flags: string[];
  lat: number | null;
  lng: number | null;
  receivedAt: string;
}

export interface Attendance {
  id: string;
  userId: string;
  workDate: string;
  status: 'PRESENT' | 'LATE';
  checkInAt: string;
  checkOutAt: string | null;
  workedMinutes: number | null;
  dressReview: ReviewStatus;
  reviewNote: string | null;
  checkInPhoto?: PhotoRef;
  checkOutPhoto?: PhotoRef | null;
  user?: Pick<User, 'id' | 'name' | 'staffNo' | 'role'>;
}

export interface Custody {
  units: { serialNumber: string; name: string; status: UnitStatus; heldSince: string | null }[];
  bulk: { name: string; unit: string; quantity: number }[];
  tasksInProgress: number;
}

export interface Person {
  id: string;
  name: string;
  staffNo: string;
  phone?: string | null;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: 'ROUTER' | 'ONT' | 'CABLE' | 'CONNECTOR' | 'ACCESSORY' | 'TOOL';
  tracking: 'SERIALIZED' | 'BULK';
  unit: string;
  unitPrice: number;
  reorderLevel: number;
  stock?: { inStore: number; withTechnicians: number };
  lowStock?: boolean;
}

export interface TaskMaterial {
  id: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  item: Pick<Item, 'name' | 'sku' | 'unit' | 'category'>;
  unit: { serialNumber: string } | null;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  customerName: string;
  customerPhone: string | null;
  customerAccount: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  dueAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  completionNotes: string | null;
  amountCollected: number | null;
  verificationNote: string | null;
  customerSignature: string | null;
  signedByName: string | null;
  signedAt: string | null;
  customerRating?: number | null;
  customerFeedback?: string | null;
  ratedAt?: string | null;
  createdAt: string;
  assignee: Person;
  createdBy?: Person;
  verifiedBy?: Person | null;
  startPhoto?: PhotoRef | null;
  endPhoto?: PhotoRef | null;
  materials?: TaskMaterial[];
}

export interface SerialUnit {
  id: string;
  serialNumber: string;
  status: UnitStatus;
  heldSince: string | null;
  daysHeld?: number;
  customerAccount?: string | null;
  item: Pick<Item, 'id' | 'name' | 'sku' | 'category'>;
  holder?: Person | null;
}

export interface BulkHolding {
  id: string;
  quantity: number;
  item: Pick<Item, 'id' | 'name' | 'sku' | 'unit' | 'unitPrice' | 'category'>;
}

export interface StockCountResult {
  id: string;
  expected: string[];
  scanned: string[];
  missing: string[];
  unexpected: string[];
  createdAt: string;
}

export interface TeamMember extends User {
  today: { status: 'PRESENT' | 'LATE'; checkInAt: string; checkOutAt: string | null; dressReview: ReviewStatus } | null;
  openTasks: number;
  unitsInCustody: number;
}

export interface Dashboard {
  attendance: { technicians: number; checkedIn: number; late: number; checkedOut: number; absent: number; pendingDressReviews: number };
  tasks: {
    assigned: number;
    inProgress: number;
    awaitingVerification: number;
    completedLast7Days: number;
    avgDurationMinutes: number;
    amountCollectedLast7Days: number;
  };
  routers: {
    inStore: number;
    inTransit: number;
    withTechnicians: number;
    installed: number;
    faulty: number;
    lost: number;
    overdueInCustody: number;
    lostLast30Days: number;
    missingInSpotCounts: number;
  };
  lowStockItems: number;
  requests?: { open: number };
}

export interface Reconciliation {
  generatedAt: string;
  ageAlertDays: number;
  technicians: {
    technician: Person;
    serialised: {
      issued: number;
      installed: number;
      returned: number;
      lost: number;
      inHand: number;
      pendingAcceptance: number;
      overdue: { serialNumber: string; name: string; heldSince: string }[];
    };
    bulkInHand: { name: string; unit: string; quantity: number }[];
    lastCount: { at: string; missing: string[]; unexpected: string[] } | null;
    risk: 'HIGH' | 'NORMAL' | 'CLEAR';
  }[];
}

export interface Movement {
  id: string;
  type: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  item: { name: string; unit?: string };
  unit?: { serialNumber: string } | null;
  actor: { name: string };
  fromUser: { name: string } | null;
  toUser: { name: string } | null;
  task: { code: string } | null;
}

export type RequestStatus = 'OPEN' | 'SCHEDULED' | 'CLOSED';

export interface ServiceRequest {
  id: string;
  type: TaskType;
  description: string;
  phone: string | null;
  address: string | null;
  status: RequestStatus;
  closedNote: string | null;
  createdAt: string;
  customerAccount?: string | null;
  customer?: { id: string; name: string; phone: string | null; customerAccount: string | null; address: string | null };
  task?: { id: string; code: string; status: TaskStatus; assignee?: { name: string; phone?: string | null } } | null;
}

export interface CustomerJob {
  id: string;
  code: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  address: string;
  dueAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  signedByName: string | null;
  customerRating: number | null;
  customerFeedback: string | null;
  ratedAt: string | null;
  createdAt: string;
  assignee: { name: string; phone: string | null };
  completionNotes?: string | null;
  materials?: { quantity: number; item: { name: string; unit: string }; unit: { serialNumber: string } | null }[];
}

export interface CustomerOverview {
  customer: { name: string; account: string | null; phone: string | null; address: string | null; email: string | null };
  active: CustomerJob[];
  history: CustomerJob[];
  devices: { serialNumber: string; installedAt: string | null; item: { name: string; category: string } }[];
  requests: ServiceRequest[];
  /** Null when the office hasn't set that contact (the button is then hidden). */
  support: { phone: string | null; whatsapp: string | null };
}

/** GET /reports/me — a technician's own performance. */
export interface MyStats {
  openTasks: number;
  completedThisMonth: number;
  avgJobMinutes: number;
  daysPresent: number;
  lateDays: number;
  hoursWorked: number;
  unitsInCustody: number;
  week: { jobs: number; avgMinutes: number; hours: number; days: number };
  month: { jobs: number; avgMinutes: number; days: number; onTimeRate: number | null; verified: number; sentBack: number };
  rating: { average: number | null; count: number };
}
