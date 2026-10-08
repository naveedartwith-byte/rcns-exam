import type { Timestamp } from 'firebase/firestore';
import type { UserRole } from './user';

export interface TeacherProfile {
  uid: string;
  role: Extract<UserRole, 'teacher'>;
  name: string;
  email: string;
  department: string;
  designation?: string;
  phone?: string;
  courses?: string[];
  totalExams?: number;
  status?: 'active' | 'inactive';
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
