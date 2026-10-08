import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './user';

export interface AdminProfile {
  uid: string;
  role: Extract<UserRole, 'admin'>;
  name: string;
  email: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
