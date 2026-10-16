import type { Timestamp } from 'firebase/firestore';
import type { WrittenQuestionEvaluation } from './writtenQuestion';

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
  mcqMarks?: number;
  mcqTotalMarks?: number;
  shortQuestionsMarks?: number;
  shortQuestionsTotalMarks?: number;
  longQuestionsMarks?: number;
  longQuestionsTotalMarks?: number;
  writtenMarks?: number;
  writtenTotalMarks?: number;
  requiresWrittenGrading?: boolean;
  writtenEvaluations?: Record<string, WrittenQuestionEvaluation>;
  evaluatedBy?: string;
  evaluatorName?: string;
  evaluatedAt?: Timestamp | string;
  regradedFrom?: number;
  submittedAt: Timestamp | string;
  status: ResultStatus;
}

