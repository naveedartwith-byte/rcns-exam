import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Exam } from '../types/exam';

function sortExamsNewestFirst(exams: Exam[]): Exam[] {
  return exams.sort((a, b) => {
    const parseTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (typeof val?.toMillis === 'function') return val.toMillis();
      if (typeof val?.toDate === 'function') return val.toDate().getTime();
      const d = new Date(val).getTime();
      return isNaN(d) ? 0 : d;
    };
    const timeA = parseTime(a.createdAt || a.updatedAt || a.startAt);
    const timeB = parseTime(b.createdAt || b.updatedAt || b.startAt);
    return timeB - timeA;
  });
}

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
   * Retrieves all exams across the institution, sorted newest first.
   */
  async getAllExams(): Promise<Exam[]> {
    const examsCol = collection(db, 'exams');
    const snapshot = await getDocs(examsCol);
    const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Exam));
    return sortExamsNewestFirst(list);
  },

  /**
   * Retrieves exams created by a specific teacher, sorted newest first.
   * If Dr. Tariq or demo faculty, also safely includes initial seeded exams authored by 'teacher-1'.
   */
  async getExamsByTeacher(teacherId: string, email?: string): Promise<Exam[]> {
    const examsCol = collection(db, 'exams');
    const q = query(examsCol, where('teacherId', '==', teacherId));
    const snapshot = await getDocs(q);
    const exams = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Exam));

    if (email === 'dr.tariq@royalcollege.edu.pk' || teacherId === 'teacher-1') {
      if (teacherId !== 'teacher-1') {
        try {
          const qSeeded = query(examsCol, where('teacherId', '==', 'teacher-1'));
          const seededSnap = await getDocs(qSeeded);
          const seededExams = seededSnap.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Exam))
            .filter((se) => !exams.some((e) => e.id === se.id));
          return sortExamsNewestFirst([...exams, ...seededExams]);
        } catch (seededErr) {
          console.warn('Seeded exams retrieval note:', seededErr);
        }
      }
    }
    return sortExamsNewestFirst(exams);
  },


  /**
   * Retrieves exams for a specific program and semester, sorted newest first.
   */
  async getExamsByProgramAndSemester(program: string, semester: string): Promise<Exam[]> {
    const examsCol = collection(db, 'exams');
    const q = query(
      examsCol,
      where('program', '==', program),
      where('semester', '==', semester)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Exam));
    return sortExamsNewestFirst(list);
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
   * Permanently deletes an exam and cascades across all associated collections:
   * 1. Master questions in questions collection where examId == examId
   * 2. Written questions in writtenQuestions collection where examId == examId
   * 3. Candidate assignments where examId == examId
   * 4. Candidate results where examId == examId
   * 5. Secret exam codes in examSecrets/{examId}
   * 6. Secret code hashes in examCodeHashes/{examId}
   * 7. Parent exam document in exams/{examId}
   */
  async deleteExamPermanently(examId: string): Promise<void> {
    if (!examId) return;

    // Fetch related documents across all collections in parallel
    const [qSnap, wqSnap, assignSnap, resSnap] = await Promise.all([
      getDocs(query(collection(db, 'questions'), where('examId', '==', examId))),
      getDocs(query(collection(db, 'writtenQuestions'), where('examId', '==', examId))),
      getDocs(query(collection(db, 'assignments'), where('examId', '==', examId))),
      getDocs(query(collection(db, 'results'), where('examId', '==', examId))),
    ]);

    const examRef = doc(db, 'exams', examId);
    const secretRef = doc(db, 'examSecrets', examId);
    const hashRef = doc(db, 'examCodeHashes', examId);

    const allRefs = [
      ...qSnap.docs.map((d) => d.ref),
      ...wqSnap.docs.map((d) => d.ref),
      ...assignSnap.docs.map((d) => d.ref),
      ...resSnap.docs.map((d) => d.ref),
      secretRef,
      hashRef,
      examRef,
    ];

    const BATCH_LIMIT = 250;
    for (let i = 0; i < allRefs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = allRefs.slice(i, i + BATCH_LIMIT);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  },

  /**
   * Deletes an exam document (cascades permanently to avoid orphaned questions/records).
   */
  async deleteExam(examId: string): Promise<void> {
    await this.deleteExamPermanently(examId);
  },
};

export default examService;
