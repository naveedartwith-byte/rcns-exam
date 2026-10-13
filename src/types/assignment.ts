import type { Timestamp } from 'firebase/firestore';

export type AssignmentStatus = 'assigned' | 'started' | 'paused' | 'submitted' | 'expired' | 'graded';

export interface Assignment {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string;
  kmuRegistrationNo?: string;
  assignedBy: string; // Teacher or Admin UID
  assignedAt: Timestamp | string;
  status: AssignmentStatus;
  batch?: string;
  semester?: string;
  program?: string;
  examTitle?: string;
  examType?: string;
  subject?: string;
  startedAt?: Timestamp | string;
  startedAtMs?: number;
  submittedAt?: Timestamp | string;
  isPaused?: boolean;
  pausedAt?: Timestamp | string;
  pausedBy?: string;
  pausedByName?: string;
  resumedAt?: Timestamp | string;
  resumedBy?: string;
  lastHeartbeatAt?: Timestamp | string;
  lastHeartbeatAtMs?: number;
  shuffledQuestionOrder?: string[];
  answers?: Record<string, any>;
  answersCount?: number;
  totalMarks?: number;
}
