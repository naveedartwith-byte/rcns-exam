import type { MasterQuestion } from '../types/question';

export interface GradedResult {
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  answersCount: number;
  grade?: string;
}

/**
 * Calculates official Khyber Medical University (KMU) letter grade based on percentage.
 */
export function calculateKmuGrade(percentage: number): string {
  if (percentage >= 85) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 75) return 'B+';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

/**
 * Helper to extract option text whether option is a string or an object { text, label, value, title }.
 */
function extractOptionText(opt: any): string {
  if (opt === undefined || opt === null) return '';
  if (typeof opt === 'string') return opt.trim();
  if (typeof opt === 'number') return String(opt).trim();
  return String(opt.text ?? opt.value ?? opt.label ?? opt.title ?? '').trim();
}

/**
 * Universal evaluator matching student answers with correct answers.
 * Supports letter keys ('A', 'B', 'C', 'D'), numeric indices (0, 1, 2, 3), and text matching.
 * Strictly guarantees that missing, unselected, or invalid answers are NEVER marked correct.
 */
export function checkAnswerMatch(
  submitted: string | number | undefined | null,
  correct: string | number | undefined | null,
  options: any = []
): boolean {
  if (submitted === undefined || submitted === null || correct === undefined || correct === null) {
    return false;
  }

  const rawSub = String(submitted).trim();
  const rawCor = String(correct).trim();

  // Missing, empty, or unselected (-1) answers must NEVER be marked correct
  if (rawSub === '' || rawCor === '' || rawSub === '-1' || rawCor === '-1') {
    return false;
  }

  // 1. Direct trimmed, case-insensitive string equality
  if (rawSub.toLowerCase() === rawCor.toLowerCase()) {
    return true;
  }

  const subUpper = rawSub.toUpperCase();
  const corUpper = rawCor.toUpperCase();

  // Clean common prefixes (e.g., "OPTION A" -> "A")
  const cleanSub = subUpper.replace(/^OPTION\s+/i, '').trim();
  const cleanCor = corUpper.replace(/^OPTION\s+/i, '').trim();

  if (cleanSub === cleanCor) {
    return true;
  }

  // 2. Letter to 0-based Index mapping (A: 0, B: 1, C: 2, D: 3, E: 4)
  const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

  const parseIndex = (val: string): number => {
    if (letterMap[val] !== undefined) {
      return letterMap[val];
    }
    const num = Number(val);
    if (!isNaN(num) && Number.isInteger(num) && num >= 0 && num < 26) {
      return num;
    }
    return -1;
  };

  const subIndex = parseIndex(cleanSub);
  const corIndex = parseIndex(cleanCor);

  if (subIndex >= 0 && corIndex >= 0 && subIndex === corIndex) {
    return true;
  }

  // Normalize options array
  const rawOpts = options as any;
  const optsArray: any[] = Array.isArray(rawOpts)
    ? rawOpts
    : typeof rawOpts === 'object' && rawOpts !== null
    ? [rawOpts.optionA, rawOpts.optionB, rawOpts.optionC, rawOpts.optionD].filter(Boolean)
    : [];

  // 3. Option Text Matching
  if (optsArray.length > 0) {
    // If student answer resolved to a valid option index, compare option text with correct answer
    if (subIndex >= 0 && subIndex < optsArray.length) {
      const optText = extractOptionText(optsArray[subIndex]);
      if (optText && optText.toLowerCase() === rawCor.toLowerCase()) {
        return true;
      }
      const optClean = optText.replace(/^[A-E][.):\s]\s*/i, '').trim();
      const corCleanText = rawCor.replace(/^[A-E][.):\s]\s*/i, '').trim();
      if (optClean && corCleanText && optClean.toLowerCase() === corCleanText.toLowerCase()) {
        return true;
      }
    }

    // If correct answer resolved to a valid option index, compare option text with student answer
    if (corIndex >= 0 && corIndex < optsArray.length) {
      const optText = extractOptionText(optsArray[corIndex]);
      if (optText && optText.toLowerCase() === rawSub.toLowerCase()) {
        return true;
      }
      const optClean = optText.replace(/^[A-E][.):\s]\s*/i, '').trim();
      const subCleanText = rawSub.replace(/^[A-E][.):\s]\s*/i, '').trim();
      if (optClean && subCleanText && optClean.toLowerCase() === subCleanText.toLowerCase()) {
        return true;
      }
    }

    // Cross-check: check if raw strings match any option text directly
    for (let idx = 0; idx < optsArray.length; idx++) {
      const optText = extractOptionText(optsArray[idx]).toLowerCase();
      if (!optText) continue;
      const subMatches = optText === rawSub.toLowerCase() || (subIndex >= 0 && subIndex === idx);
      const corMatches = optText === rawCor.toLowerCase() || (corIndex >= 0 && corIndex === idx);
      if (subMatches && corMatches) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Authoritative grading of student answers against the master question bank.
 * Evaluates individual marks, pass/fail thresholds, and prevents division by zero.
 */
export function gradeExamSubmission(
  questions: MasterQuestion[],
  answers: Record<string, string | number | undefined | null>,
  passingMarks?: number
): GradedResult {
  let obtainedMarks = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let answersCount = 0;

  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      obtainedMarks: 0,
      totalMarks: 0,
      percentage: 0,
      passed: false,
      correctCount: 0,
      answersCount: 0,
      grade: 'F',
    };
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const rawMarks = Number(q.marks);
    const qMarks = !isNaN(rawMarks) && Number.isFinite(rawMarks) && rawMarks > 0 ? rawMarks : 1;
    totalMarks += qMarks;

    // Resolve student answer by Question ID, or by index / order fallbacks
    let submittedAnswer: any = undefined;

    if (answers && typeof answers === 'object') {
      if (q.id && answers[q.id] !== undefined) {
        submittedAnswer = answers[q.id];
      } else if (answers[i] !== undefined) {
        submittedAnswer = answers[i];
      } else if (answers[String(i)] !== undefined) {
        submittedAnswer = answers[String(i)];
      } else if (q.order !== undefined && answers[q.order] !== undefined) {
        submittedAnswer = answers[q.order];
      } else if (q.order !== undefined && answers[String(q.order)] !== undefined) {
        submittedAnswer = answers[String(q.order)];
      } else if (q.order !== undefined && answers[q.order - 1] !== undefined) {
        submittedAnswer = answers[q.order - 1];
      }
    }

    const isAnswered =
      submittedAnswer !== undefined &&
      submittedAnswer !== null &&
      String(submittedAnswer).trim() !== '' &&
      submittedAnswer !== -1 &&
      submittedAnswer !== '-1';

    if (isAnswered) {
      answersCount++;
      const isCorrect = checkAnswerMatch(submittedAnswer, q.correctAnswer, q.options || []);
      if (isCorrect) {
        obtainedMarks += qMarks;
        correctCount++;
      }
    }
  }

  const percentage =
    totalMarks > 0
      ? Math.round((obtainedMarks / totalMarks) * 1000) / 10
      : 0;

  const validPercentage = !isNaN(percentage) && Number.isFinite(percentage) ? percentage : 0;

  const numPassingMarks = Number(passingMarks);
  const passed =
    passingMarks !== undefined && !isNaN(numPassingMarks) && numPassingMarks > 0
      ? obtainedMarks >= numPassingMarks
      : validPercentage >= 50;

  const grade = calculateKmuGrade(validPercentage);

  return {
    obtainedMarks,
    totalMarks,
    percentage: validPercentage,
    passed,
    correctCount,
    answersCount,
    grade,
  };
}
