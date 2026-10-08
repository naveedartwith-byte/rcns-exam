import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Result } from '../types/result';
import { calculatePercentage } from '../utils/validation';
import { questionService } from './questionService';
import { examService } from './examService';

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
   * Evaluates student exam answers, calculates marks and pass/fail,
   * and creates an idempotent result document.
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
    const resultId = `${params.studentId}_${params.examId}`;
    const resultRef = doc(db, 'results', resultId);

    // 1. Idempotency Check: Return existing result if already submitted
    const existingSnap = await getDoc(resultRef);
    if (existingSnap.exists()) {
      return { id: existingSnap.id, ...existingSnap.data() } as Result;
    }

    // 2. Load authoritative questions with correct answers from Firestore
    const questions = await questionService.getQuestionsByExamId(params.examId);
    const exam = await examService.getExamById(params.examId);

    let obtainedMarks = 0;
    let totalMarks = 0;
    let correctCount = 0;

    for (const q of questions) {
      const qMarks = Number(q.marks) || 1;
      totalMarks += qMarks;

      const submittedAnswer = params.answers[q.id];
      if (submittedAnswer !== undefined && submittedAnswer !== null) {
        // Compare answers safely
        const isCorrect =
          String(submittedAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        if (isCorrect) {
          obtainedMarks += qMarks;
          correctCount++;
        }
      }
    }

    if (totalMarks === 0 && exam?.totalMarks) {
      totalMarks = exam.totalMarks;
    }

    const percentage = calculatePercentage(obtainedMarks, totalMarks || 100);
    const passingScore = 50; // Standard 50% passing threshold
    const passed = percentage >= passingScore;

    const grade =
      percentage >= 85
        ? 'A+'
        : percentage >= 80
        ? 'A'
        : percentage >= 75
        ? 'B+'
        : percentage >= 70
        ? 'B'
        : percentage >= 60
        ? 'C'
        : percentage >= 50
        ? 'D'
        : 'F';

    const resultData: Result = {
      id: resultId,
      examId: params.examId,
      studentId: params.studentId,
      studentName: params.studentName || 'Student',
      kmuRegistrationNo: params.kmuRegistrationNo,
      examTitle: params.examTitle || exam?.title || 'Academic Examination',
      examType: params.examType || exam?.type || 'exam',
      subject: params.subject || exam?.subject || 'Clinical Assessment',
      grade,
      program: params.program || exam?.program,
      semester: params.semester || exam?.semester,
      batch: params.batch,
      marks: obtainedMarks,
      totalMarks: totalMarks || 100,
      percentage,
      passed,
      answersCount: Object.keys(params.answers).length,
      correctCount,
      submittedAt: serverTimestamp() as any,
      status: 'published',
    };

    await setDoc(resultRef, resultData);

    // Update assignment status to submitted
    const assignmentId = `${params.examId}_${params.studentId}`;
    try {
      const assignRef = doc(db, 'assignments', assignmentId);
      await setDoc(assignRef, { status: 'submitted' }, { merge: true });
    } catch {
      // assignment update is best-effort
    }

    return {
      ...resultData,
      submittedAt: new Date().toISOString(),
    };
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

