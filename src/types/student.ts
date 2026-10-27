import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './user';

export interface StudentProfile {
  uid: string;
  role: Extract<UserRole, 'student'>;
  name: string;
  fatherName: string;
  email: string;
  kmuRegistrationNo: string;
  batch?: string;
  semester: string;
  program: string;
  department: string;
  phone?: string;
  address?: string;
  /** @deprecated Fabricated feature removed. Kept optional for legacy schema compatibility */
  gpa?: number;
  status?: 'active' | 'suspended' | 'inactive';
  passKey?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface KmuRegistrationRecord {
  uid: string;
  email?: string;
  kmuRegistrationNo: string;
  normalizedRegistrationNo: string;
  registeredAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

