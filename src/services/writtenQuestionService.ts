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
import type { WrittenQuestion, StudentWrittenQuestion } from '../types/writtenQuestion';

export const writtenQuestionService = {
  /**
   * Retrieves all master written questions for an exam (Teacher/Admin view with guidelines).
   */
  async getWrittenQuestionsByExamId(examId: string): Promise<WrittenQuestion[]> {
    if (!examId) return [];
    try {
      const col = collection(db, 'writtenQuestions');
      const q = query(col, where('examId', '==', examId));
      const snapshot = await getDocs(q);
      const questions = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as WrittenQuestion)
      );
      return questions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    } catch (err) {
      console.error('Error fetching written questions by exam ID:', err);
      return [];
    }
  },

  /**
   * Adds a new written question (Short or Long) to the master bank.
   */
  async addWrittenQuestion(
    data: Omit<WrittenQuestion, 'id'> & { id?: string }
  ): Promise<string> {
    const col = collection(db, 'writtenQuestions');
    const docRef = data.id ? doc(db, 'writtenQuestions', data.id) : doc(col);

    const cleanMaxMarks = Number(data.maxMarks);
    const validMaxMarks = !isNaN(cleanMaxMarks) && cleanMaxMarks > 0 ? cleanMaxMarks : 5;

    await setDoc(docRef, {
      ...data,
      id: docRef.id,
      maxMarks: validMaxMarks,
      order: Number(data.order) || 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  },

  /**
   * Updates an existing written question in the master bank.
   */
  async updateWrittenQuestion(
    questionId: string,
    data: Partial<Omit<WrittenQuestion, 'id' | 'examId'>>
  ): Promise<void> {
    if (!questionId) return;
    const docRef = doc(db, 'writtenQuestions', questionId);
    const updateData: Record<string, any> = {
      ...data,
      updatedAt: serverTimestamp(),
    };
    if (data.maxMarks !== undefined) {
      const clean = Number(data.maxMarks);
      updateData.maxMarks = !isNaN(clean) && clean > 0 ? clean : 5;
    }
    await updateDoc(docRef, updateData);
  },

  /**
   * Deletes a written question from the master bank.
   */
  async deleteWrittenQuestion(questionId: string): Promise<void> {
    if (!questionId) return;
    const docRef = doc(db, 'writtenQuestions', questionId);
    await deleteDoc(docRef);
  },

  /**
   * Synchronizes and embeds sanitized written questions onto the parent exam document.
   * Strips confidential teacher rubrics (`guidelines`) and `createdBy`.
   * Also updates written question count and written total marks on the exam document.
   */
  async syncSanitizedWrittenQuestions(examId: string): Promise<StudentWrittenQuestion[]> {
    if (!examId) return [];

    const masterQuestions = await this.getWrittenQuestionsByExamId(examId);

    // Strictly sanitize: exclude guidelines and createdBy
    const sanitized: StudentWrittenQuestion[] = masterQuestions.map((q, idx) => ({
      id: q.id,
      examId: q.examId,
      type: q.type,
      question: q.question.trim(),
      maxMarks: Number(q.maxMarks) || 5,
      order: Number(q.order) || idx + 1,
      ...(q.minWords ? { minWords: Number(q.minWords) } : {}),
      ...(q.maxWords ? { maxWords: Number(q.maxWords) } : {}),
    }));

    const writtenTotalMarks = sanitized.reduce((sum, q) => sum + (Number(q.maxMarks) || 0), 0);

    try {
      const examRef = doc(db, 'exams', examId);
      const examSnap = await getDoc(examRef);
      if (examSnap.exists()) {
        const examData = examSnap.data();
        // Compute combined total marks
        const mcqQuestions = examData.sanitizedQuestions || [];
        const mcqTotalMarks = Array.isArray(mcqQuestions)
          ? mcqQuestions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0)
          : 0;

        await updateDoc(examRef, {
          sanitizedWrittenQuestions: sanitized,
          writtenQuestionCount: sanitized.length,
          writtenTotalMarks,
          totalMarks: mcqTotalMarks + writtenTotalMarks,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('Could not update parent exam with sanitized written questions:', err);
    }

    return sanitized;
  },

  /**
   * Reads sanitized written questions for student attempt directly from the exam document.
   */
  async getStudentWrittenQuestions(examId: string): Promise<StudentWrittenQuestion[]> {
    if (!examId) return [];
    try {
      const examRef = doc(db, 'exams', examId);
      const examSnap = await getDoc(examRef);
      if (examSnap.exists()) {
        const data = examSnap.data();
        if (Array.isArray(data.sanitizedWrittenQuestions)) {
          return data.sanitizedWrittenQuestions.map((q: any, idx: number) => ({
            id: q.id || `wq-${idx + 1}`,
            examId,
            type: q.type || 'short',
            question: q.question || '',
            maxMarks: Number(q.maxMarks) || 5,
            order: Number(q.order) || idx + 1,
            ...(q.minWords ? { minWords: Number(q.minWords) } : {}),
            ...(q.maxWords ? { maxWords: Number(q.maxWords) } : {}),
          }));
        }
      }
      return [];
    } catch (err) {
      console.error('Error fetching student written questions:', err);
      return [];
    }
  },
};

export default writtenQuestionService;
