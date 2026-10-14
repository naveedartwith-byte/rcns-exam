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
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/firestore';
import { functions } from '../firebase/functions';
import type { Result } from '../types/result';
import type { MasterQuestion } from '../types/question';
import {
  checkAnswerMatch,
  gradeExamSubmission,
  calculateKmuGrade,
} from '../utils/secureGrading';

export { checkAnswerMatch };

export const resultService = {
  /**
   * Retrieves results for a specific student.
   * Also checks assignment records for any pending submitted exams without a finalized result.
   */
  async getResultsByStudentId(studentId: string): Promise<Result[]> {
    if (!studentId) return [];

    const resultsCol = collection(db, 'results');
    const q = query(resultsCol, where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    const finalizedResults = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Result));

    // Also look for pending submitted assignments
    try {
      const assignmentsCol = collection(db, 'assignments');
      const qAssign = query(
        assignmentsCol,
        where('studentId', '==', studentId),
        where('status', '==', 'submitted')
      );
      const assignSnap = await getDocs(qAssign);

      const finalizedExamIds = new Set(finalizedResults.map((r) => r.examId));

      for (const assignDoc of assignSnap.docs) {
        const assignData = assignDoc.data();
        if (!finalizedExamIds.has(assignData.examId)) {
          const isGraded = assignData.resultStatus === 'graded' || assignData.status === 'graded';
          const percentage = Number(assignData.percentage) || 0;
          finalizedResults.push({
            id: `assign_${assignData.examId}_${studentId}`,
            examId: assignData.examId,
            studentId,
            studentName: assignData.studentName || 'Student Candidate',
            kmuRegistrationNo: assignData.kmuRegistrationNo,
            examTitle: assignData.examTitle || 'Academic Examination',
            examType: assignData.examType || 'exam',
            subject: assignData.subject || 'Clinical Assessment',
            program: assignData.program,
            semester: assignData.semester,
            batch: assignData.batch,
            marks: Number(assignData.marks) || 0,
            totalMarks: Number(assignData.totalMarks) || 100,
            percentage,
            passed: assignData.passed !== undefined ? Boolean(assignData.passed) : percentage >= 50,
            answersCount: assignData.answersCount || (assignData.answers ? Object.keys(assignData.answers).length : 0),
            correctCount: Number(assignData.correctCount) || 0,
            incorrectCount: Number(assignData.incorrectCount) || 0,
            unansweredCount: Number(assignData.unansweredCount) || 0,
            submittedAt: assignData.submittedAt || new Date().toISOString(),
            status: isGraded ? 'graded' : 'pending',
            grade: assignData.grade || calculateKmuGrade(percentage),
          });
        }
      }
    } catch (assignErr) {
      console.warn('Could not check pending assignment submissions:', assignErr);
    }

    return finalizedResults;
  },

  /**
   * Retrieves results for a specific exam.
   */
  async getResultsByExamId(examId: string): Promise<Result[]> {
    if (!examId) return [];
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
   * Submits student exam answers.
   * If Cloud Functions are available (Blaze tier), server-side authoritative grading is used.
   * On Firebase Spark free tier (Cloud Functions unavailable), safely persists submission
   * answers and metadata to the candidate's assignment document in Firestore.
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
    totalQuestions?: number;
  }): Promise<Result> {
    const resultId = `${params.studentId}_${params.examId}`;
    const resultRef = doc(db, 'results', resultId);
    const assignmentId = `${params.examId}_${params.studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);

    // 1. Idempotency Check: Prevent duplicate submissions and repeated result creation
    try {
      const existingSnap = await getDoc(resultRef);
      if (existingSnap.exists()) {
        console.log('[resultService] Authoritative result already exists:', resultId);
        return { id: existingSnap.id, ...existingSnap.data() } as Result;
      }
      const assignSnap = await getDoc(assignRef);
      if (assignSnap.exists()) {
        const assignData = assignSnap.data();
        if (assignData.status === 'submitted' || assignData.status === 'graded') {
          console.warn('[resultService] Duplicate submission prevented: Attempt already marked submitted/graded.');
          const r = assignData.result || {};
          return {
            id: resultId,
            examId: params.examId,
            studentId: params.studentId,
            studentName: assignData.studentName || params.studentName || 'Student Candidate',
            kmuRegistrationNo: assignData.kmuRegistrationNo || params.kmuRegistrationNo,
            examTitle: assignData.examTitle || params.examTitle || 'Academic Examination',
            examType: (assignData.examType || params.examType || 'exam') as any,
            subject: assignData.subject || params.subject || 'Clinical Assessment',
            program: assignData.program || params.program,
            semester: assignData.semester || params.semester,
            batch: assignData.batch || params.batch,
            marks: r.marks ?? assignData.marks ?? 0,
            totalMarks: r.totalMarks ?? assignData.totalMarks ?? 100,
            percentage: r.percentage ?? assignData.percentage ?? 0,
            passed: r.passed ?? assignData.passed ?? false,
            grade: r.grade ?? assignData.grade ?? 'Pass',
            answersCount: r.answersCount ?? assignData.answersCount ?? 0,
            correctCount: r.correctCount ?? assignData.correctCount ?? 0,
            incorrectCount: r.incorrectCount ?? assignData.incorrectCount ?? 0,
            unansweredCount: r.unansweredCount ?? assignData.unansweredCount ?? 0,
            status: (r.status ?? assignData.resultStatus ?? assignData.status ?? 'submitted') as any,
            submittedAt: assignData.submittedAt || new Date().toISOString(),
          } as Result;
        }
      }
    } catch (checkErr) {
      console.warn('Idempotency pre-check notice:', checkErr);
    }

    // Load exam metadata for variable marks and total marks calculation
    const examDoc = await getDoc(doc(db, 'exams', params.examId)).catch(() => null);
    const examData = examDoc?.exists() ? examDoc.data() : null;

    let totalQuestions = params.totalQuestions || 0;
    let totalMarks = 0;

    if (Array.isArray(examData?.sanitizedQuestions) && examData.sanitizedQuestions.length > 0) {
      if (!totalQuestions) {
        totalQuestions = examData.sanitizedQuestions.length;
      }
      totalMarks = examData.sanitizedQuestions.reduce(
        (sum: number, q: any) => sum + (Number(q.marks) || 1),
        0
      );
    } else {
      totalQuestions = totalQuestions || Number(examData?.questionCount) || Object.keys(params.answers || {}).length || 1;
      totalMarks = Number(examData?.totalMarks) || totalQuestions;
    }

    // Calculate answered and unanswered/skipped questions
    const answeredCount = Object.keys(params.answers || {}).filter((k) => {
      const val = params.answers[k];
      return val !== undefined && val !== null && String(val).trim() !== '' && val !== -1 && val !== '-1';
    }).length;

    const unansweredCount = Math.max(0, totalQuestions - answeredCount);

    // 2. Cloud Function Attempt (Blaze tier authoritative server-side grading)
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
      if (data) {
        const correctCount = Number(data.correctCount) || 0;
        const answersCount = data.answersCount || answeredCount;
        const incorrectCount = Math.max(0, answersCount - correctCount);
        return {
          id: data.resultId || resultId,
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
          answersCount,
          correctCount,
          incorrectCount,
          unansweredCount,
          submittedAt: data.submittedAt || new Date().toISOString(),
          status: data.status || 'graded',
        };
      }
    } catch (fnErr: any) {
      console.warn(
        `[resultService] Cloud Function unavailable (${fnErr?.code || fnErr?.message}). Proceeding with Spark tier direct submission.`
      );
    }

    // 3. Spark Free Tier Evaluation & Persistence
    let gradedResult: ReturnType<typeof gradeExamSubmission> | null = null;
    try {
      const questionsCol = collection(db, 'questions');
      const qQuery = query(questionsCol, where('examId', '==', params.examId));
      const questionsSnap = await getDocs(qQuery);
      if (!questionsSnap.empty) {
        const masterQuestions = questionsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as MasterQuestion)
        );
        masterQuestions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        gradedResult = gradeExamSubmission(masterQuestions, params.answers, examData?.passingMarks);
      }
    } catch {
      // Expected zero-trust restriction for student clients on Spark tier
    }

    const marks = gradedResult ? gradedResult.obtainedMarks : 0;
    const percentage = gradedResult ? gradedResult.percentage : 0;
    const passed = gradedResult ? gradedResult.passed : false;
    const correctCount = gradedResult ? gradedResult.correctCount : 0;
    const incorrectCount = gradedResult ? Math.max(0, answeredCount - gradedResult.correctCount) : 0;
    const grade = gradedResult ? gradedResult.grade : calculateKmuGrade(percentage);
    const resultStatus = gradedResult ? 'graded' : 'pending';

    const assignResultData = {
      marks,
      totalMarks,
      percentage,
      passed,
      correctCount,
      incorrectCount,
      unansweredCount,
      answersCount: answeredCount,
      totalQuestions,
      grade,
      status: resultStatus,
    };

    // Persist submission record onto assignment document (Student is authorized under Firestore rules)
    try {
      await setDoc(
        assignRef,
        {
          id: assignmentId,
          examId: params.examId,
          studentId: params.studentId,
          studentName: params.studentName || 'Student Candidate',
          kmuRegistrationNo: params.kmuRegistrationNo || '',
          examTitle: params.examTitle || examData?.title || 'Academic Examination',
          examType: (params.examType as any) || examData?.type || 'exam',
          subject: params.subject || examData?.subject || 'Clinical Assessment',
          program: params.program || examData?.program || '',
          semester: params.semester || examData?.semester || '',
          batch: params.batch || examData?.batch || '',
          status: 'submitted',
          submittedAt: serverTimestamp(),
          answers: params.answers,
          answersCount: answeredCount,
          unansweredCount,
          totalQuestions,
          totalMarks,
          marks,
          percentage,
          passed,
          correctCount,
          incorrectCount,
          grade,
          resultStatus,
          result: assignResultData,
        },
        { merge: true }
      );
    } catch (assignErr) {
      console.warn('Assignment submission record note:', assignErr);
    }

    const finalResultData: Result = {
      id: resultId,
      examId: params.examId,
      studentId: params.studentId,
      studentName: params.studentName || 'Student Candidate',
      kmuRegistrationNo: params.kmuRegistrationNo,
      examTitle: params.examTitle || examData?.title || 'Academic Examination',
      examType: (params.examType as any) || examData?.type || 'exam',
      subject: params.subject || examData?.subject || 'Clinical Assessment',
      program: params.program || examData?.program,
      semester: params.semester || examData?.semester,
      batch: params.batch || examData?.batch,
      marks,
      totalMarks,
      percentage,
      passed,
      answersCount: answeredCount,
      correctCount,
      incorrectCount,
      unansweredCount,
      grade,
      submittedAt: new Date().toISOString() as any,
      status: resultStatus,
    };

    return finalResultData;
  },

  /**
   * Authoritative grading of a candidate's submission by Teacher or Admin.
   * Loads protected master questions with answer keys, computes grades, and writes
   * authoritative result document to /results.
   */
  async gradeSubmission(params: {
    examId: string;
    studentId: string;
    evaluatorUid?: string;
  }): Promise<Result> {
    const { examId, studentId, evaluatorUid } = params;

    // 1. Fetch Master Questions (Authorized for Teachers/Admins)
    const questionsCol = collection(db, 'questions');
    const qQuery = query(questionsCol, where('examId', '==', examId));
    const questionsSnap = await getDocs(qQuery);
    const masterQuestions = questionsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as MasterQuestion)
    );
    masterQuestions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    if (masterQuestions.length === 0) {
      throw new Error('No master questions found for this examination.');
    }

    // 2. Fetch Parent Exam metadata
    const examDoc = await getDoc(doc(db, 'exams', examId));
    const examData = examDoc.exists() ? examDoc.data() : null;

    // 3. Fetch Student Assignment containing submitted answers
    const assignmentId = `${examId}_${studentId}`;
    const assignDoc = await getDoc(doc(db, 'assignments', assignmentId));
    if (!assignDoc.exists()) {
      throw new Error('Assignment record for this candidate was not found.');
    }
    const assignData = assignDoc.data();
    const answers = assignData.answers || {};

    // 4. Grade authoritative submission
    const passingMarks = examData?.passingMarks;
    const graded = gradeExamSubmission(masterQuestions, answers, passingMarks);

    // 5. Construct Authoritative Result Record
    const resultId = `${studentId}_${examId}`;
    const resultRef = doc(db, 'results', resultId);

    const totalQuestions = masterQuestions.length;
    const unansweredCount = Math.max(0, totalQuestions - graded.answersCount);
    const incorrectCount = Math.max(0, graded.answersCount - graded.correctCount);

    const resultRecord: Result = {
      id: resultId,
      examId,
      studentId,
      studentName: assignData.studentName || 'Student Candidate',
      kmuRegistrationNo: assignData.kmuRegistrationNo || '',
      examTitle: examData?.title || assignData.examTitle || 'Academic Examination',
      examType: (examData?.type || assignData.examType || 'exam') as any,
      subject: examData?.subject || assignData.subject || 'Clinical Assessment',
      program: examData?.program || assignData.program || '',
      semester: examData?.semester || assignData.semester || '',
      batch: examData?.batch || assignData.batch || '',
      marks: graded.obtainedMarks,
      totalMarks: graded.totalMarks,
      percentage: graded.percentage,
      passed: graded.passed,
      grade: calculateKmuGrade(graded.percentage),
      answersCount: graded.answersCount,
      correctCount: graded.correctCount,
      incorrectCount,
      unansweredCount,
      submittedAt: assignData.submittedAt || serverTimestamp(),
      status: 'graded',
    };

    // Save to results collection (Teacher/Admin is authorized under Firestore rules)
    await setDoc(resultRef, {
      ...resultRecord,
      evaluatedBy: evaluatorUid || 'faculty-examiner',
      evaluatedAt: serverTimestamp(),
    });

    // Update assignment status to graded
    try {
      await updateDoc(doc(db, 'assignments', assignmentId), {
        status: 'graded',
        gradedAt: serverTimestamp(),
      });
    } catch (uErr) {
      console.warn('Assignment status update notice:', uErr);
    }

    return resultRecord;
  },

  /**
   * Grades all submitted assignments for an exam (Batch Teacher/Admin action).
   */
  async gradeAllPendingSubmissionsForExam(
    examId: string,
    evaluatorUid?: string
  ): Promise<{ gradedCount: number; results: Result[] }> {
    const assignmentsCol = collection(db, 'assignments');
    const q = query(
      assignmentsCol,
      where('examId', '==', examId),
      where('status', '==', 'submitted')
    );
    const snap = await getDocs(q);

    const results: Result[] = [];
    for (const docSnap of snap.docs) {
      const studentId = docSnap.data().studentId;
      if (studentId) {
        try {
          const res = await this.gradeSubmission({ examId, studentId, evaluatorUid });
          results.push(res);
        } catch (err) {
          console.error(`Error grading submission for student ${studentId}:`, err);
        }
      }
    }

    return {
      gradedCount: results.length,
      results,
    };
  },

  /**
   * Retrieves pending submissions for an exam.
   */
  async getPendingSubmissionsForExam(examId: string): Promise<any[]> {
    const assignmentsCol = collection(db, 'assignments');
    const q = query(
      assignmentsCol,
      where('examId', '==', examId),
      where('status', '==', 'submitted')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
