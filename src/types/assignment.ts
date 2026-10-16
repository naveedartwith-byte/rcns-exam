import type { Timestamp } from 'firebase/firestore';
import type { StudentWrittenAnswer } from './writtenQuestion';

export type AssignmentStatus = 'assigned' | 'started' | 'submitted' | 'expired' | 'graded';

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
  examType?: string;
  subject?: string;
  studentName?: string;
  kmuRegistrationNo?: string;
  totalMarks?: number;
  answers?: Record<string, any>;
  answersCount?: number;
  writtenAnswers?: Record<string, StudentWrittenAnswer>;
  writtenAnswersCount?: number;
  startedAt?: Timestamp | string;
  submittedAt?: Timestamp | string;
  gradedAt?: Timestamp | string;
}
