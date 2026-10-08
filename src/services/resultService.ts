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
   * Records or submits an exam result.
   */
  async recordResult(resultData: {
    examId: string;
    studentId: string;
    marks: number;
    totalMarks: number;
    status?: Result['status'];
  }): Promise<string> {
    const resultsCol = collection(db, 'results');
    const resultRef = doc(resultsCol);
    const percentage = calculatePercentage(resultData.marks, resultData.totalMarks);

    await setDoc(resultRef, {
      id: resultRef.id,
      examId: resultData.examId,
      studentId: resultData.studentId,
      marks: resultData.marks,
      totalMarks: resultData.totalMarks,
      percentage,
      status: resultData.status || 'graded',
      submittedAt: serverTimestamp(),
    });

    return resultRef.id;
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
