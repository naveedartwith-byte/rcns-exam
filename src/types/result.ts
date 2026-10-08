import type { Timestamp } from 'firebase/firestore';

export type ResultStatus = 'pending' | 'graded' | 'published' | 'reviewed';

export interface Result {
  id: string;
  examId: string;
  studentId: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  submittedAt: Timestamp | string;
  status: ResultStatus;
}
