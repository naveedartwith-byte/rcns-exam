import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Result } from '../types/result';
import type { WrittenQuestionEvaluation, StudentWrittenQuestion } from '../types/writtenQuestion';
import {
  generateMarksDropdownOptions,
  validateAwardedMarks,
  calculateCombinedMarks,
  type CombinedScoringParams,
  type CombinedScoringOutcome,
} from '../utils/writtenGrading';

export type { CombinedScoringParams, CombinedScoringOutcome };
export { generateMarksDropdownOptions, validateAwardedMarks, calculateCombinedMarks };

export const writtenGradingService = {
  /**
   * Generates integer options [0, 1, ..., maxMarks] for teacher grading dropdown.
   */
  generateMarksDropdownOptions,

  /**
   * Validates awarded marks: must be non-negative integer <= maxMarks.
   */
  validateAwardedMarks(awarded: unknown, maxMarks: number): boolean {
    return validateAwardedMarks(awarded, maxMarks).valid;
  },

  /**
   * Pure calculation: Combines auto-scored MCQ marks with teacher-awarded Short & Long marks.
   * Completely eliminates double-counting by summing discrete component totals.
   */
  calculateCombinedMarks,

  /**
   * Authoritative teacher action: Validates, combines, and finalizes a student's examination result.
   * Prevents double-counting and repeated finalization errors via deterministic document write.
   */
  async finalizeCandidateResult(params: {
    examId: string;
    studentId: string;
    evaluatorUid: string;
    evaluatorName?: string;
    mcqMarks: number;
    mcqTotalMarks: number;
    writtenEvaluations: Record<string, WrittenQuestionEvaluation>;
    writtenQuestions: StudentWrittenQuestion[];
    passingMarks?: number;
    lastEvaluatedAt?: string; // Optimistic concurrency check
  }): Promise<Result> {
    const {
      examId,
      studentId,
      evaluatorUid,
      evaluatorName,
      mcqMarks,
      mcqTotalMarks,
      writtenEvaluations,
      writtenQuestions,
      passingMarks,
    } = params;

    // 1. Validation: Ensure every written question has an evaluated mark
    for (const wq of writtenQuestions) {
      const evalItem = writtenEvaluations[wq.id];
      if (!evalItem || evalItem.awardedMarks === undefined || evalItem.awardedMarks === null) {
        throw new Error(
          `Please award marks for all questions. Question "${wq.question.slice(0, 30)}..." has not been graded yet.`
        );
      }
      if (!this.validateAwardedMarks(evalItem.awardedMarks, wq.maxMarks)) {
        throw new Error(
          `Awarded mark (${evalItem.awardedMarks}) for question "${wq.question.slice(0, 30)}..." exceeds maximum allowable marks (${wq.maxMarks}) or is invalid.`
        );
      }
    }

    // 2. Fetch student assignment document for submission answers & candidate metadata
    const assignmentId = `${examId}_${studentId}`;
    const assignDoc = await getDoc(doc(db, 'assignments', assignmentId));
    if (!assignDoc.exists()) {
      throw new Error('Candidate assignment document was not found.');
    }
    const assignData = assignDoc.data();

    // 3. Concurrency check: check if already finalized
    const resultId = `${studentId}_${examId}`;
    const resultRef = doc(db, 'results', resultId);
    const existingSnap = await getDoc(resultRef);
    let previousMarks: number | undefined = undefined;
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      if (data.status === 'graded') {
        previousMarks = Number(data.marks);
      }
    }

    // 4. Calculate final deterministic marks
    const scored = this.calculateCombinedMarks({
      mcqMarks,
      mcqTotalMarks,
      writtenEvaluations,
      writtenQuestions,
      passingMarks,
    });

    // 5. Construct authoritative Result document
    const finalResultRecord: Result = {
      id: resultId,
      examId,
      studentId,
      studentName: assignData.studentName || 'Student Candidate',
      kmuRegistrationNo: assignData.kmuRegistrationNo || '',
      examTitle: assignData.examTitle || 'Academic Examination',
      examType: assignData.examType || 'exam',
      subject: assignData.subject || 'Clinical Assessment',
      program: assignData.program || '',
      semester: assignData.semester || '',
      batch: assignData.batch || '',
      marks: scored.finalMarks,
      totalMarks: scored.totalPossibleMarks,
      percentage: scored.percentage,
      passed: scored.passed,
      grade: scored.grade,
      mcqMarks: scored.mcqMarks,
      mcqTotalMarks: scored.mcqTotalMarks,
      shortQuestionsMarks: scored.shortQuestionsMarks,
      shortQuestionsTotalMarks: scored.shortQuestionsTotalMarks,
      longQuestionsMarks: scored.longQuestionsMarks,
      longQuestionsTotalMarks: scored.longQuestionsTotalMarks,
      writtenMarks: scored.writtenMarks,
      writtenTotalMarks: scored.writtenTotalMarks,
      requiresWrittenGrading: true,
      writtenEvaluations,
      evaluatedBy: evaluatorUid,
      evaluatorName: evaluatorName || 'Course Examiner',
      evaluatedAt: new Date().toISOString(),
      ...(previousMarks !== undefined ? { regradedFrom: previousMarks } : {}),
      submittedAt: assignData.submittedAt || new Date().toISOString(),
      status: 'graded',
    };

    // Save authoritative result (Faculty is authorized under Firestore rules)
    await setDoc(resultRef, {
      ...finalResultRecord,
      evaluatedAt: serverTimestamp(),
    });

    // Update candidate's assignment status to graded
    try {
      await updateDoc(doc(db, 'assignments', assignmentId), {
        status: 'graded',
        gradedAt: serverTimestamp(),
      });
    } catch (uErr) {
      console.warn('Assignment status update to graded note:', uErr);
    }

    return finalResultRecord;
  },
};

export default writtenGradingService;
