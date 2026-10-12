import type { MasterQuestion } from '../types/question';

export interface GradedResult {
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  answersCount: number;
}

/**
 * Universal evaluator matching student answers with correct answers.
 * Supports letter keys ('A', 'B', 'C', 'D'), numeric indices (0, 1, 2, 3), and text matching.
 */
export function checkAnswerMatch(
  submitted: string | number | undefined,
  correct: string | number | undefined,
  options: any[]
): boolean {
  if (submitted === undefined || submitted === null || correct === undefined || correct === null) {
    return false;
  }

  const subStr = String(submitted).trim().toUpperCase();
  const corStr = String(correct).trim().toUpperCase();

  // 1. Direct equality
  if (subStr === corStr) return true;

  // 2. Letter to Index conversion
  const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const subIndex =
    letterMap[subStr] !== undefined
      ? letterMap[subStr]
      : !isNaN(Number(subStr)) && Number.isInteger(Number(subStr))
      ? Number(subStr)
      : -1;
  const corIndex =
    letterMap[corStr] !== undefined
      ? letterMap[corStr]
      : !isNaN(Number(corStr)) && Number.isInteger(Number(corStr))
      ? Number(corStr)
      : -1;

  if (subIndex >= 0 && corIndex >= 0 && subIndex === corIndex) {
    return true;
  }

  // 3. Option text match
  if (Array.isArray(options)) {
    if (subIndex >= 0 && subIndex < options.length) {
      const optText = typeof options[subIndex] === 'string' ? options[subIndex] : options[subIndex]?.text;
      if (optText && String(optText).trim().toLowerCase() === String(correct).trim().toLowerCase()) {
        return true;
      }
    }
    if (corIndex >= 0 && corIndex < options.length) {
      const optText = typeof options[corIndex] === 'string' ? options[corIndex] : options[corIndex]?.text;
      if (optText && String(optText).trim().toLowerCase() === String(submitted).trim().toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Server-side authoritative grading of student answers against the master question bank.
 */
export function gradeExamSubmission(
  questions: any[],
  answers: Record<string, string | number>,
  passingMarks?: number
): GradedResult {
  let obtainedMarks = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let answersCount = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qMarks = Number(q.marks) || 1;
    totalMarks += qMarks;

    // Resolve student answer by Question ID, or by index fallback
    const submittedAnswer =
      answers[q.id] !== undefined
        ? answers[q.id]
        : answers[i] !== undefined
        ? answers[i]
        : answers[String(i)] !== undefined
        ? answers[String(i)]
        : undefined;

    if (submittedAnswer !== undefined && submittedAnswer !== null && submittedAnswer !== '') {
      answersCount++;
      const isCorrect = checkAnswerMatch(submittedAnswer, q.correctAnswer, q.options || []);
      if (isCorrect) {
        obtainedMarks += qMarks;
        correctCount++;
      }
    }
  }

  const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 1000) / 10 : 0;
  
  const passed =
    passingMarks !== undefined && passingMarks > 0
      ? obtainedMarks >= passingMarks
      : percentage >= 50;

  return {
    obtainedMarks,
    totalMarks,
    percentage,
    passed,
    correctCount,
    answersCount,
  };
}
