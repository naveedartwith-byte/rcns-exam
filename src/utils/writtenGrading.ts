/**
 * Pure Calculation & Sanitization Utilities for Written Questions (Short & Long)
 * ROYAL COLLEGE OF NURSING SWAT - KMU Examination Pattern
 *
 * This utility module is completely decoupled from Firebase client SDK
 * and can run in both browser and standalone Node.js environments.
 */

import type {
  WrittenQuestion,
  StudentWrittenQuestion,
  WrittenQuestionEvaluation,
} from '../types/writtenQuestion.ts';
import { calculateKmuGrade } from './secureGrading.ts';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface CombinedScoringParams {
  mcqMarks: number;
  mcqTotalMarks: number;
  writtenEvaluations: Record<string, WrittenQuestionEvaluation>;
  writtenQuestions: (StudentWrittenQuestion | WrittenQuestion)[];
  passingMarks?: number;
}

export interface CombinedScoringOutcome {
  mcqMarks: number;
  mcqTotalMarks: number;
  shortQuestionsMarks: number;
  shortQuestionsTotalMarks: number;
  longQuestionsMarks: number;
  longQuestionsTotalMarks: number;
  writtenMarks: number;
  writtenTotalMarks: number;
  totalObtainedMarks: number;
  finalMarks: number; // alias for totalObtainedMarks
  grandTotalMarks: number;
  totalPossibleMarks: number; // alias for grandTotalMarks
  percentage: number;
  passed: boolean;
  grade: string;
}

/**
 * Generates dropdown mark options [0, 1, ..., maxMarks] for faculty grading.
 */
export function generateMarksDropdownOptions(maxMarks: number): number[] {
  const clean = Math.floor(Number(maxMarks));
  const safeMax = !isNaN(clean) && clean >= 0 ? clean : 0;
  const options: number[] = [];
  for (let i = 0; i <= safeMax; i++) {
    options.push(i);
  }
  return options;
}

/**
 * Validates awarded marks: must be non-negative finite number <= maxMarks.
 */
export function validateAwardedMarks(awarded: unknown, maxMarks: number): ValidationResult {
  if (awarded === undefined || awarded === null) {
    return { valid: false, reason: 'Marks value is required' };
  }
  const num = Number(awarded);
  if (isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, reason: 'Awarded mark must be a valid finite number' };
  }
  if (num < 0) {
    return { valid: false, reason: 'Awarded mark cannot be negative' };
  }
  if (num > maxMarks) {
    return { valid: false, reason: `Awarded mark cannot exceed question maximum (${maxMarks})` };
  }
  return { valid: true };
}

/**
 * Pure calculation: Combines auto-scored MCQ marks with teacher-awarded Short & Long marks.
 * Completely eliminates double-counting by calculating pure component totals directly from evaluations.
 * Supports both object params and positional params for maximum flexibility.
 */
export function calculateCombinedMarks(
  paramsOrMcqMarks: CombinedScoringParams | number,
  maybeMcqTotalMarks?: number,
  maybeWrittenQuestions?: (StudentWrittenQuestion | WrittenQuestion)[],
  maybeWrittenEvaluations?: Record<string, WrittenQuestionEvaluation>,
  maybePassingMarks?: number
): CombinedScoringOutcome {
  let mcqMarks = 0;
  let mcqTotalMarks = 0;
  let writtenEvaluations: Record<string, WrittenQuestionEvaluation> = {};
  let writtenQuestions: (StudentWrittenQuestion | WrittenQuestion)[] = [];
  let passingMarks: number | undefined;

  if (typeof paramsOrMcqMarks === 'object' && paramsOrMcqMarks !== null) {
    mcqMarks = paramsOrMcqMarks.mcqMarks ?? 0;
    mcqTotalMarks = paramsOrMcqMarks.mcqTotalMarks ?? 0;
    writtenEvaluations = paramsOrMcqMarks.writtenEvaluations ?? {};
    writtenQuestions = paramsOrMcqMarks.writtenQuestions ?? [];
    passingMarks = paramsOrMcqMarks.passingMarks;
  } else {
    mcqMarks = Number(paramsOrMcqMarks) || 0;
    mcqTotalMarks = Number(maybeMcqTotalMarks) || 0;
    writtenQuestions = maybeWrittenQuestions ?? [];
    writtenEvaluations = maybeWrittenEvaluations ?? {};
    passingMarks = maybePassingMarks;
  }

  let shortQuestionsMarks = 0;
  let shortQuestionsTotalMarks = 0;
  let longQuestionsMarks = 0;
  let longQuestionsTotalMarks = 0;

  for (const wq of writtenQuestions) {
    const qMaxMarks = Number(wq.maxMarks) || 0;
    const evalItem = writtenEvaluations[wq.id];
    const rawAwarded = evalItem !== undefined ? Number(evalItem.awardedMarks) : 0;
    const validation = validateAwardedMarks(rawAwarded, qMaxMarks);
    const validAwarded = validation.valid ? rawAwarded : 0;

    if (wq.type === 'short') {
      shortQuestionsMarks += validAwarded;
      shortQuestionsTotalMarks += qMaxMarks;
    } else {
      longQuestionsMarks += validAwarded;
      longQuestionsTotalMarks += qMaxMarks;
    }
  }

  const writtenMarks = shortQuestionsMarks + longQuestionsMarks;
  const writtenTotalMarks = shortQuestionsTotalMarks + longQuestionsTotalMarks;

  const totalObtainedMarks = mcqMarks + writtenMarks;
  const grandTotalMarks = mcqTotalMarks + writtenTotalMarks;

  const percentage =
    grandTotalMarks > 0
      ? Math.round((totalObtainedMarks / grandTotalMarks) * 1000) / 10
      : 0;

  const validPercentage = !isNaN(percentage) && Number.isFinite(percentage) ? percentage : 0;

  const numPassingMarks = Number(passingMarks);
  const passed =
    passingMarks !== undefined && !isNaN(numPassingMarks) && numPassingMarks > 0
      ? totalObtainedMarks >= numPassingMarks
      : validPercentage >= 50;

  const grade = calculateKmuGrade(validPercentage);

  return {
    mcqMarks,
    mcqTotalMarks,
    shortQuestionsMarks,
    shortQuestionsTotalMarks,
    longQuestionsMarks,
    longQuestionsTotalMarks,
    writtenMarks,
    writtenTotalMarks,
    totalObtainedMarks,
    finalMarks: totalObtainedMarks,
    grandTotalMarks,
    totalPossibleMarks: grandTotalMarks,
    percentage: validPercentage,
    passed,
    grade,
  };
}

/**
 * Sanitizes a written question for delivery to student exam sessions.
 * Strictly strips confidential faculty rubrics, model answers, and internal notes.
 */
export function sanitizeWrittenQuestionForStudent(q: WrittenQuestion): StudentWrittenQuestion {
  return {
    id: q.id,
    examId: q.examId,
    type: q.type,
    question: q.question,
    maxMarks: Number(q.maxMarks) || 0,
    order: Number(q.order) || 0,
  };
}

/**
 * Sanitizes an array of written questions for students.
 */
export function sanitizeWrittenQuestions(questions: WrittenQuestion[]): StudentWrittenQuestion[] {
  return (questions || []).map(sanitizeWrittenQuestionForStudent);
}
