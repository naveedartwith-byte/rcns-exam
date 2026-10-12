import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/firestore';
import { functions } from '../firebase/functions';
import type { Result } from '../types/result';

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
      if (optText && optText.trim().toLowerCase() === String(correct).trim().toLowerCase()) {
        return true;
      }
    }
    if (corIndex >= 0 && corIndex < options.length) {
      const optText = typeof options[corIndex] === 'string' ? options[corIndex] : options[corIndex]?.text;
      if (optText && optText.trim().toLowerCase() === String(submitted).trim().toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

export const resultService = {
  /**
   * Retrieves results for a specific student.
   */
  async getResultsByStudentId(studentId: string): Promise<Result[]> {
    const resultsCol = collection(db, 'results');
    const q = query(resultsCol, where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Result));
  },

  /**
   * Retrieves results for a specific exam.
   */
  async getResultsByExamId(examId: string): Promise<Result[]> {
    const resultsCol = collection(db, 'results');
    const q = query(resultsCol, where('examId', '==', examId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Result));
  },

  /**
   * Retrieves all results across the institution (Admin view).
   */
  async getAllResults(): Promise<Result[]> {
    const resultsCol = collection(db, 'results');
    const snapshot = await getDocs(resultsCol);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Result));
  },

  /**
   * Submits student exam answers to the secure serverless Cloud Function.
   * Grading is evaluated authoritatively on the server; client cannot tamper with marks.
   */
  async submitExamAttempt(params: {
    examId: string;
    studentId: string;
    studentName?: string;
    kmuRegistrationNo?: string;
    examTitle?: string;
    examType?: string;
    subject?: string;
    program?: string;
    semester?: string;
    batch?: string;
    answers: Record<string, string | number>;
  }): Promise<Result> {
    try {
      const submitFn = httpsCallable<
        { examId: string; answers: Record<string, string | number> },
        any
      >(functions, 'submitExamAttempt');

      const response = await submitFn({
        examId: params.examId,
        answers: params.answers,
      });

      const data = response.data;
      return {
        id: data.resultId || `${params.studentId}_${params.examId}`,
        examId: params.examId,
        studentId: params.studentId,
        studentName: data.studentName || params.studentName || 'Student Candidate',
        kmuRegistrationNo: data.kmuRegistrationNo || params.kmuRegistrationNo,
        examTitle: params.examTitle || 'Academic Examination',
        examType: (params.examType as any) || 'exam',
        subject: params.subject || 'Clinical Assessment',
        program: params.program,
        semester: params.semester,
        batch: params.batch,
        marks: data.marks,
        totalMarks: data.totalMarks,
        percentage: data.percentage,
        passed: data.passed,
        submittedAt: data.submittedAt || new Date().toISOString(),
        status: data.status || 'graded',
      };
    } catch (err: any) {
      console.error('Error submitting exam attempt via Cloud Function:', err);
      throw err;
    }
  },

  /**
   * Retrieves a result by ID.
   */
  async getResultById(resultId: string): Promise<Result | null> {
    const resultRef = doc(db, 'results', resultId);
    const snapshot = await getDoc(resultRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Result;
  },
};

export default resultService;
