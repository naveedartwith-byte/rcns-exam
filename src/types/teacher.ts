import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './user';

export interface TeacherProfile {
  uid: string;
  role: Extract<UserRole, 'teacher'>;
  name: string;
  email: string;
  department: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
