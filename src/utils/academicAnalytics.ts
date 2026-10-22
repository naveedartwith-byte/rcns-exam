import type { Result } from '../types/result';

/**
 * Checks if a result corresponds to a Class Quiz.
 */
export function isQuizResult(r: { examType?: string; examTitle?: string; subject?: string }): boolean {
  const type = (r.examType || '').toLowerCase().trim();
  const title = (r.examTitle || '').toLowerCase().trim();
  const subject = (r.subject || '').toLowerCase().trim();

  return type === 'quiz' || title.includes('quiz') || subject.includes('quiz');
}

/**
 * Checks if a result corresponds to a Mid-Term Examination.
 */
export function isMidtermResult(r: { examType?: string; examTitle?: string; subject?: string }): boolean {
  const type = (r.examType || '').toLowerCase().trim();
  const title = (r.examTitle || '').toLowerCase().trim();
  const subject = (r.subject || '').toLowerCase().trim();

  return (
    type === 'midterm' ||
    title.includes('mid-term') ||
    title.includes('midterm') ||
    title.includes('mid term') ||
    subject.includes('mid-term') ||
    subject.includes('midterm')
  );
}

export interface CategoryPerformanceSummary {
  // Class Quiz Performance
  quizCount: number;
  quizPercentage: string; // e.g. "86.5" or "—"
  quizHasData: boolean;

  // Mid-Term Performance
  midtermCount: number;
  midtermPercentage: string; // e.g. "79.2" or "—"
  midtermHasData: boolean;

  // Overall Performance
  totalCount: number;
  overallPercentage: string;
  overallPassRate: string;
}

/**
 * Calculates authoritative overall percentage separately for:
 * 1. Class Quizzes
 * 2. Mid-Term Examinations
 * 3. Overall Combined
 */
export function calculateCategoryPerformance(results: Result[]): CategoryPerformanceSummary {
  const gradedResults = results.filter(
    (r) => r.status === 'graded' || (r.percentage !== undefined && r.percentage !== null)
  );

  const quizResults = gradedResults.filter(isQuizResult);
  const midtermResults = gradedResults.filter(isMidtermResult);

  const computePercentage = (items: Result[]): { percentage: string; hasData: boolean } => {
    if (items.length === 0) {
      return { percentage: '—', hasData: false };
    }

    const totalObtained = items.reduce((acc, r) => acc + (Number(r.marks) || 0), 0);
    const totalMax = items.reduce((acc, r) => acc + (Number(r.totalMarks) || 0), 0);

    if (totalMax > 0) {
      return {
        percentage: ((totalObtained / totalMax) * 100).toFixed(1),
        hasData: true,
      };
    }

    const sumPct = items.reduce((acc, r) => acc + (Number(r.percentage) || 0), 0);
    return {
      percentage: (sumPct / items.length).toFixed(1),
      hasData: true,
    };
  };

  const quizStat = computePercentage(quizResults);
  const midtermStat = computePercentage(midtermResults);
  const overallStat = computePercentage(gradedResults);

  const passedCount = gradedResults.filter((r) => r.passed || (r.percentage ?? 0) >= 50).length;
  const passRate =
    gradedResults.length > 0
      ? ((passedCount / gradedResults.length) * 100).toFixed(1)
      : '0.0';

  return {
    quizCount: quizResults.length,
    quizPercentage: quizStat.percentage,
    quizHasData: quizStat.hasData,

    midtermCount: midtermResults.length,
    midtermPercentage: midtermStat.percentage,
    midtermHasData: midtermStat.hasData,

    totalCount: gradedResults.length,
    overallPercentage: overallStat.hasData ? overallStat.percentage : '0.0',
    overallPassRate: passRate,
  };
}
