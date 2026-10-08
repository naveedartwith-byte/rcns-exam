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
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Question } from '../types/question';

export const questionService = {
  /**
   * Retrieves all questions associated with an exam.
   */
  async getQuestionsByExamId(examId: string): Promise<Question[]> {
    const questionsCol = collection(db, 'questions');
    const q = query(questionsCol, where('examId', '==', examId));
    const snapshot = await getDocs(q);
    const questions = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Question));
    return questions.sort((a, b) => a.order - b.order);
  },

  /**
   * Adds a question to an exam.
   */
  async addQuestion(questionData: Omit<Question, 'id'> & { id?: string }): Promise<string> {
    const questionsCol = collection(db, 'questions');
    const questionRef = questionData.id ? doc(db, 'questions', questionData.id) : doc(questionsCol);

    await setDoc(questionRef, {
      ...questionData,
      id: questionRef.id,
    });

    return questionRef.id;
  },

  /**
   * Updates an existing question.
   */
  async updateQuestion(questionId: string, data: Partial<Omit<Question, 'id' | 'examId'>>): Promise<void> {
    const questionRef = doc(db, 'questions', questionId);
    await updateDoc(questionRef, data);
  },

  /**
   * Deletes a question.
   */
  async deleteQuestion(questionId: string): Promise<void> {
    const questionRef = doc(db, 'questions', questionId);
    await deleteDoc(questionRef);
  },

  /**
   * Retrieves a question by ID.
   */
  async getQuestionById(questionId: string): Promise<Question | null> {
    const questionRef = doc(db, 'questions', questionId);
    const snapshot = await getDoc(questionRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Question;
  },
};

export default questionService;
