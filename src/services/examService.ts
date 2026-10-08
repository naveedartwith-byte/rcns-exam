import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Exam } from '../types/exam';

export const examService = {
  /**
   * Retrieves an exam by ID.
   */
  async getExamById(examId: string): Promise<Exam | null> {
    const docRef = doc(db, 'exams', examId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }
    return { id: snapshot.id, ...snapshot.data() } as Exam;
  },

  /**
   * Retrieves all exams across the institution.
   */
  async getAllExams(): Promise<Exam[]> {
    const examsCol = collection(db, 'exams');
    const snapshot = await getDocs(examsCol);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Exam));
  },

  /**
   * Retrieves exams created by a specific teacher.
   */
  async getExamsByTeacher(teacherId: string): Promise<Exam[]> {
    const examsCol = collection(db, 'exams');
    const q = query(examsCol, where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Exam));
  },


  /**
   * Retrieves exams for a specific program and semester.
   */
  async getExamsByProgramAndSemester(program: string, semester: string): Promise<Exam[]> {
    const examsCol = collection(db, 'exams');
    const q = query(
      examsCol,
      where('program', '==', program),
      where('semester', '==', semester)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Exam));
  },

  /**
   * Creates a new exam document.
   */
  async createExam(examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
    const examsCol = collection(db, 'exams');
    const examRef = examData.id ? doc(db, 'exams', examData.id) : doc(examsCol);
    
    await setDoc(examRef, {
      ...examData,
      id: examRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return examRef.id;
  },

  /**
   * Updates an existing exam document.
   */
  async updateExam(examId: string, data: Partial<Omit<Exam, 'id' | 'createdAt'>>): Promise<void> {
    const examRef = doc(db, 'exams', examId);
    await updateDoc(examRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Deletes an exam document.
   */
  async deleteExam(examId: string): Promise<void> {
    const examRef = doc(db, 'exams', examId);
    await deleteDoc(examRef);
  },
};

export default examService;
