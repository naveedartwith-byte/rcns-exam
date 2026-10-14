import type { Timestamp } from 'firebase/firestore';

export type ResultStatus = 'pending' | 'graded' | 'published' | 'reviewed';

export interface Result {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string;
  kmuRegistrationNo?: string;
  examTitle?: string;
  examType?: string;
  subject?: string;
  grade?: string;
  program?: string;
  semester?: string;
  batch?: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  passed?: boolean;
  answersCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  submittedAt: Timestamp | string;
  status: ResultStatus;
}

