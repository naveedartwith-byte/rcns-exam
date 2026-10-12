import type { Timestamp } from 'firebase/firestore';

export type AssignmentStatus = 'assigned' | 'started' | 'submitted' | 'expired';

export interface Assignment {
  id: string;
  examId: string;
  studentId: string;
  assignedBy: string; // Teacher or Admin UID
  assignedAt: Timestamp | string;
  status: AssignmentStatus;
  batch?: string;
  semester?: string;
  program?: string;
  examTitle?: string;
}
