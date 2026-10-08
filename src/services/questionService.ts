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
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Question } from '../types/question';

export type StudentQuestion = Omit<Question, 'correctAnswer' | 'explanation'>;

export const questionService = {
  /**
   * Retrieves all questions associated with an exam (Teacher/Admin view with answers).
   */
  async getQuestionsByExamId(examId: string): Promise<Question[]> {
    const questionsCol = collection(db, 'questions');
    const q = query(questionsCol, where('examId', '==', examId));
    const snapshot = await getDocs(q);
    const questions = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Question));
    return questions.sort((a, b) => a.order - b.order);
  },

  /**
   * Retrieves questions for a student taking an exam.
   * Strips correct answers and explanations to protect answer keys from client inspection.
   */
  async getStudentQuestions(examId: string): Promise<StudentQuestion[]> {
    const fullQuestions = await this.getQuestionsByExamId(examId);
    return fullQuestions.map((q) => ({
      id: q.id,
      examId: q.examId,
      question: q.question,
      options: q.options,
      marks: q.marks,
      order: q.order,
    }));
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
   * Saves / synchronizes a list of questions for an exam in batch.
   */
  async saveQuestionsForExam(
    examId: string,
    questions: Array<Omit<Question, 'id'> & { id?: string }>
  ): Promise<void> {
    const batch = writeBatch(db);
    const questionsCol = collection(db, 'questions');

    // First delete any existing questions for this exam
    const existing = await this.getQuestionsByExamId(examId);
    for (const eq of existing) {
      batch.delete(doc(db, 'questions', eq.id));
    }

    // Write the new questions
    for (let i = 0; i < questions.length; i++) {
      const qData = questions[i];
      const qRef = qData.id ? doc(db, 'questions', qData.id) : doc(questionsCol);
      batch.set(qRef, {
        ...qData,
        id: qRef.id,
        examId,
        order: i + 1,
      });
    }

    await batch.commit();
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

