import type { Timestamp } from 'firebase/firestore';
import type { WrittenQuestionEvaluation } from './writtenQuestion';

export type ResultStatus = 'pending' | 'graded' | 'published' | 'reviewed';

export interface Result {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string;
  fatherName?: string;
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
  totalQuestions?: number;
  totalMCQs?: number;
  answeredMCQs?: number;
  correctMCQs?: number;
  incorrectMCQs?: number;
  unansweredMCQs?: number;
  totalObjectiveMarks?: number;
  obtainedObjectiveMarks?: number;
  totalWrittenQuestions?: number;
  writtenAnsweredCount?: number;
  writtenUnansweredCount?: number;
  answers?: Record<string, any>;
  writtenAnswers?: Record<string, any>;
  submittedAt: Timestamp | string;
  status: ResultStatus;
}

