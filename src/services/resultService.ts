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
          finalizedResults.push({
            id: `pending_${assignData.examId}_${studentId}`,
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
            marks: 0,
            totalMarks: Number(assignData.totalMarks) || 100,
            percentage: 0,
            passed: false,
            answersCount: assignData.answersCount || (assignData.answers ? Object.keys(assignData.answers).length : 0),
            submittedAt: assignData.submittedAt || new Date().toISOString(),
            status: 'pending',
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
  }): Promise<Result> {
    const resultId = `${params.studentId}_${params.examId}`;
    const resultRef = doc(db, 'results', resultId);

    // 1. Idempotency Check: Return existing result if already recorded
    try {
      const existingSnap = await getDoc(resultRef);
      if (existingSnap.exists()) {
        return { id: existingSnap.id, ...existingSnap.data() } as Result;
      }
    } catch (checkErr) {
      console.warn('Idempotency pre-check notice:', checkErr);
    }

    // 2. Cloud Function Attempt (Blaze tier fallback)
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
          submittedAt: data.submittedAt || new Date().toISOString(),
          status: data.status || 'graded',
        };
      }
    } catch (fnErr: any) {
      console.warn(
        `[resultService] Cloud Function unavailable (${fnErr?.code || fnErr?.message}). Proceeding with Spark tier direct submission.`
      );
    }

    // 3. Spark Free Tier Workflow: Persist submission to student's assignment document
    const examDoc = await getDoc(doc(db, 'exams', params.examId)).catch(() => null);
    const examData = examDoc?.exists() ? examDoc.data() : null;

    const totalMarks = Number(examData?.totalMarks) || 100;

    // Filter valid answers count
    const answeredCount = Object.keys(params.answers || {}).filter((k) => {
      const val = params.answers[k];
      return val !== undefined && val !== null && String(val).trim() !== '' && val !== -1 && val !== '-1';
    }).length;

    // Persist submission record onto assignment document (Student is authorized under Firestore rules)
    const assignmentId = `${params.examId}_${params.studentId}`;
    try {
      const assignRef = doc(db, 'assignments', assignmentId);
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
          totalMarks,
        },
        { merge: true }
      );
    } catch (assignErr) {
      console.warn('Assignment submission record note:', assignErr);
    }

    // Return safe pending-result object without exposing provisional 0s as authoritative
    const pendingResultData: Result = {
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
      marks: 0,
      totalMarks,
      percentage: 0,
      passed: false,
      answersCount: answeredCount,
      correctCount: 0,
      submittedAt: new Date().toISOString() as any,
      status: 'pending',
    };

    return pendingResultData;
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
