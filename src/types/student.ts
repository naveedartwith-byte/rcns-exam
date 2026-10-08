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
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface KmuRegistrationRecord {
  uid: string;
  kmuRegistrationNo: string;
  normalizedRegistrationNo: string;
  registeredAt: Timestamp | string;
}

