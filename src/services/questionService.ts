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
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/firestore';
import { functions } from '../firebase/functions';
import type { Question, ParsedMCQ } from '../types/question';

export type StudentQuestion = Omit<Question, 'correctAnswer' | 'explanation'>;

export interface BulkImportOptions {
  examId: string;
  questions: ParsedMCQ[];
  createdBy?: string;
  defaultMarks?: number;
  replaceExisting?: boolean;
}

export interface BulkImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  totalQuestionsInExam: number;
  errors?: string[];
}

export const questionService = {
  /**
   * Retrieves all questions associated with an exam (Teacher/Admin view with answers).
   */
  async getQuestionsByExamId(examId: string): Promise<Question[]> {
    const questionsCol = collection(db, 'questions');
    const q = query(questionsCol, where('examId', '==', examId));
    const snapshot = await getDocs(q);
    const questions = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Question));
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  /**
   * Retrieves sanitized questions for a student taking an exam.
   * Spark Free Plan workflow:
   * 1. Loads sanitized question documents embedded directly on the parent exam document.
   *    (Strictly strips correctAnswer, explanation, and createdBy).
   * 2. If a Cloud Function is deployed (Blaze plan fallback), attempts invocation.
   * 3. Replaces generic 'Internal' failure with a safe, descriptive student diagnostic.
   */
  async getStudentQuestions(examId: string): Promise<StudentQuestion[]> {
    if (!examId) return [];

    try {
      // Step 1: Read the exam document (authorized under Firestore rules for scheduled/active exams)
      const examRef = doc(db, 'exams', examId);
      const examSnap = await getDoc(examRef);

      if (examSnap.exists()) {
        const examData = examSnap.data();
        if (Array.isArray(examData.sanitizedQuestions) && examData.sanitizedQuestions.length > 0) {
          // Double-check sanitization: guarantee answer keys and explanations are never delivered to student
          return examData.sanitizedQuestions.map((q: any, idx: number) => ({
            id: q.id || `q-${idx + 1}`,
            examId,
            question: q.question,
            options: q.options || [],
            marks: Number(q.marks) || 1,
            order: Number(q.order) || idx + 1,
          }));
        }
      }

      // Step 2: Fallback for environments where Cloud Functions are deployed (Blaze plan)
      try {
        const getQuestionsFn = httpsCallable<{ examId: string }, { questions: StudentQuestion[] }>(
          functions,
          'getStudentExamQuestions'
        );
        const response = await getQuestionsFn({ examId });
        if (response.data?.questions && response.data.questions.length > 0) {
          return response.data.questions;
        }
      } catch (fnErr: any) {
        // Log diagnostic error in development without leaking secrets or tokens
        console.warn(
          `[questionService] Cloud Function unavailable (${fnErr?.code || fnErr?.message}). Spark free plan active.`
        );
      }

      // Step 3: Informative error message instead of generic 'Internal'
      throw new Error(
        'Examination questions have not yet been synchronized or published by your course instructor. Please contact your instructor to publish the question paper.'
      );
    } catch (err: any) {
      console.error('Error loading student questions:', err?.message || err);
      throw err;
    }
  },

  /**
   * Adds a single question to an exam.
   */
  async addQuestion(questionData: Omit<Question, 'id'> & { id?: string }): Promise<string> {
    const questionsCol = collection(db, 'questions');
    const questionRef = questionData.id ? doc(db, 'questions', questionData.id) : doc(questionsCol);

    await setDoc(questionRef, {
      ...questionData,
      id: questionRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return questionRef.id;
  },

  /**
   * Saves / synchronizes a list of questions for an exam in batches.
   * Chunks operations into groups of 250 to avoid Firestore's 500-operation limit.
   */
  async saveQuestionsForExam(
    examId: string,
    questions: Array<Omit<Question, 'id'> & { id?: string }>
  ): Promise<void> {
    // 1. Fetch existing questions to delete
    const existing = await this.getQuestionsByExamId(examId);
    const questionsCol = collection(db, 'questions');

    // Combine deletes and sets
    const deleteRefs = existing.map((eq) => doc(db, 'questions', eq.id));
    const setOps = questions.map((qData, i) => {
      const qRef = qData.id ? doc(db, 'questions', qData.id) : doc(questionsCol);
      return {
        ref: qRef,
        data: {
          ...qData,
          id: qRef.id,
          examId,
          order: i + 1,
          updatedAt: serverTimestamp(),
        },
      };
    });

    // Execute in chunked batches
    const BATCH_SIZE = 250;
    
    // Chunk 1: Deletions
    for (let i = 0; i < deleteRefs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = deleteRefs.slice(i, i + BATCH_SIZE);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // Chunk 2: Insertions/Updates
    for (let i = 0; i < setOps.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = setOps.slice(i, i + BATCH_SIZE);
      chunk.forEach((op) => batch.set(op.ref, op.data));
      await batch.commit();
    }

    // Prepare sanitized student questions (strictly stripped of answer keys)
    const sanitizedQuestions: StudentQuestion[] = questions.map((q, i) => ({
      id: q.id || `q-${i + 1}`,
      examId,
      question: q.question,
      options: q.options || [],
      marks: Number(q.marks) || 2,
      order: Number(q.order) || i + 1,
    }));

    // Update parent exam metadata
    try {
      const examRef = doc(db, 'exams', examId);
      const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 2), 0);
      await updateDoc(examRef, {
        questionCount: questions.length,
        totalMarks: totalMarks || questions.length * 2,
        sanitizedQuestions,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not update parent exam question count:', err);
    }
  },

  /**
   * Bulk imports parsed MCQs into an exam.
   * Validates each item, chunks batch writes, and updates exam metrics.
   */
  async bulkImportQuestions(options: BulkImportOptions): Promise<BulkImportResult> {
    const { examId, questions, createdBy, defaultMarks = 2, replaceExisting = false } = options;

    if (!examId) {
      throw new Error('Please select an exam first.');
    }

    // Filter only valid questions for import
    const validQuestions = questions.filter((q) => q.isValid);
    const skippedCount = questions.length - validQuestions.length;

    if (validQuestions.length === 0) {
      return {
        success: false,
        importedCount: 0,
        skippedCount,
        totalQuestionsInExam: 0,
        errors: ['No valid questions found to import.'],
      };
    }

    // Get existing questions if not replacing
    const existing = await this.getQuestionsByExamId(examId);
    let startOrder = 0;

    if (replaceExisting) {
      // Delete existing questions
      const BATCH_SIZE = 250;
      for (let i = 0; i < existing.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = existing.slice(i, i + BATCH_SIZE);
        chunk.forEach((eq) => batch.delete(doc(db, 'questions', eq.id)));
        await batch.commit();
      }
      startOrder = 0;
    } else {
      startOrder = existing.length;
    }

    // Prepare questions to write
    const questionsCol = collection(db, 'questions');
    const preparedQuestions: Question[] = validQuestions.map((q, idx) => {
      const qRef = doc(questionsCol);
      return {
        id: qRef.id,
        examId,
        question: q.questionText.trim(),
        options: [q.optionA.trim(), q.optionB.trim(), q.optionC.trim(), q.optionD.trim()],
        correctAnswer: q.correctAnswer.trim().toUpperCase(),
        marks: Number(q.marks) || defaultMarks,
        order: startOrder + idx + 1,
        explanation: q.explanation?.trim() || '',
        createdBy: createdBy || 'Teacher',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    });

    // Chunk batch write (max 250 operations per batch)
    const BATCH_SIZE = 250;
    for (let i = 0; i < preparedQuestions.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = preparedQuestions.slice(i, i + BATCH_SIZE);
      for (const q of chunk) {
        const ref = doc(db, 'questions', q.id);
        batch.set(ref, q);
      }
      await batch.commit();
    }

    // Update parent exam metadata
    const totalQuestionsInExam = replaceExisting
      ? preparedQuestions.length
      : existing.length + preparedQuestions.length;

    try {
      const examRef = doc(db, 'exams', examId);
      const addedMarks = preparedQuestions.reduce((sum, q) => sum + (Number(q.marks) || defaultMarks), 0);
      const existingMarks = replaceExisting
        ? 0
        : existing.reduce((sum, q) => sum + (Number(q.marks) || defaultMarks), 0);

      // Load all questions to generate complete sanitized array for students
      const allCurrentQuestions = replaceExisting
        ? preparedQuestions
        : [...existing, ...preparedQuestions];
      const sanitizedQuestions: StudentQuestion[] = allCurrentQuestions.map((q, idx) => ({
        id: q.id,
        examId,
        question: q.question,
        options: q.options || [],
        marks: Number(q.marks) || defaultMarks,
        order: Number(q.order) || idx + 1,
      }));

      await updateDoc(examRef, {
        questionCount: totalQuestionsInExam,
        totalMarks: existingMarks + addedMarks,
        sanitizedQuestions,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Could not update parent exam question count:', err);
    }

    return {
      success: true,
      importedCount: preparedQuestions.length,
      skippedCount,
      totalQuestionsInExam,
    };
  },

  /**
   * Synchronizes master questions into sanitized questions on the parent exam document.
   * Can be called by faculty or admin to publish questions for students on the Spark tier.
   */
  async syncSanitizedQuestionsForExam(examId: string): Promise<number> {
    const questions = await this.getQuestionsByExamId(examId);
    if (questions.length === 0) return 0;

    const sanitizedQuestions: StudentQuestion[] = questions.map((q, idx) => ({
      id: q.id,
      examId,
      question: q.question,
      options: q.options || [],
      marks: Number(q.marks) || 1,
      order: Number(q.order) || idx + 1,
    }));

    const examRef = doc(db, 'exams', examId);
    await updateDoc(examRef, {
      sanitizedQuestions,
      questionCount: sanitizedQuestions.length,
      updatedAt: serverTimestamp(),
    });

    return sanitizedQuestions.length;
  },

  /**
   * Updates an existing question.
   */
  async updateQuestion(questionId: string, data: Partial<Omit<Question, 'id' | 'examId'>>): Promise<void> {
    const questionRef = doc(db, 'questions', questionId);
    await updateDoc(questionRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
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
