import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyCandidateEligibility } from './examAuth';
import { gradeExamSubmission } from './grading';
import type {
  GetStudentQuestionsRequest,
  GetStudentQuestionsResponse,
  SubmitExamAttemptRequest,
  SubmitExamAttemptResponse,
  MasterQuestion,
  SanitizedStudentQuestion,
} from './types';

// Initialize Firebase Admin SDK (Singleton)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Regional configuration matching Cloud Firestore (Asia Mumbai / asia-south1)
const FUNCTION_REGION = 'asia-south1';

/**
 * Cloud Function: getStudentExamQuestions
 * Authenticates candidate, verifies eligibility & schedule against trusted server time,
 * fetches master questions, strips answer keys & explanations, and delivers sanitized paper.
 */
export const getStudentExamQuestions = onCall(
  { region: FUNCTION_REGION },
  async (request): Promise<GetStudentQuestionsResponse> => {
    // 1. Verify caller authentication
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to access examination questions.');
    }

    const studentUid = request.auth.uid;
    const { examId } = request.data as GetStudentQuestionsRequest;

    if (!examId || typeof examId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid examination ID is required.');
    }

    // 2. Authoritative Eligibility & Schedule Check
    const eligibility = await verifyCandidateEligibility(
      db,
      studentUid,
      examId,
      Date.now(),
      { allowSubmissionGrace: false }
    );

    if (!eligibility.allowed) {
      const errorCode =
        eligibility.code === 'not_started' || eligibility.code === 'expired'
          ? 'failed-precondition'
          : 'permission-denied';
      throw new HttpsError(errorCode, eligibility.message);
    }

    const exam = eligibility.exam!;

    // 3. Fetch Master Questions from Firestore using privileged Admin SDK
    const questionsSnap = await db
      .collection('questions')
      .where('examId', '==', examId)
      .get();

    const masterQuestions = questionsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as MasterQuestion[];

    // Sort by order ascending
    masterQuestions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // 4. SANITIZE: Strictly omit correctAnswer, explanation, and createdBy
    const sanitizedQuestions: SanitizedStudentQuestion[] = masterQuestions.map((q) => ({
      id: q.id,
      examId: q.examId,
      question: q.question,
      options: q.options || [],
      marks: Number(q.marks) || 1,
      order: Number(q.order) || 0,
    }));

    // 5. Ensure Assignment Status is recorded as 'started'
    try {
      const assignmentId = `${examId}_${studentUid}`;
      const assignmentRef = db.collection('assignments').doc(assignmentId);
      const assignSnap = await assignmentRef.get();

      if (assignSnap.exists) {
        if (assignSnap.data()?.status === 'assigned') {
          await assignmentRef.update({
            status: 'started',
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } else {
        await assignmentRef.set({
          id: assignmentId,
          examId,
          studentId: studentUid,
          status: 'started',
          program: eligibility.student?.program || exam.program || '',
          semester: eligibility.student?.semester || exam.semester || '',
          batch: eligibility.student?.batch || exam.batch || '',
          assignedBy: 'system-verified-entry',
          assignedAt: admin.firestore.FieldValue.serverTimestamp(),
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (assignErr) {
      console.warn('Assignment tracking notice:', assignErr);
    }

    return {
      examId,
      examTitle: exam.title,
      duration: Number(exam.duration) || 60,
      totalMarks: Number(exam.totalMarks) || masterQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0),
      questions: sanitizedQuestions,
    };
  }
);

/**
 * Cloud Function: submitExamAttempt
 * Evaluates student answers on the server against the master question bank,
 * calculates marks, pass/fail, and writes authoritative result record.
 */
export const submitExamAttempt = onCall(
  { region: FUNCTION_REGION },
  async (request): Promise<SubmitExamAttemptResponse> => {
    // 1. Verify caller authentication
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to submit examination answers.');
    }

    const studentUid = request.auth.uid;
    const { examId, answers } = request.data as SubmitExamAttemptRequest;

    if (!examId || typeof examId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid examination ID is required.');
    }

    if (!answers || typeof answers !== 'object') {
      throw new HttpsError('invalid-argument', 'Answers object is required.');
    }

    // 2. Idempotency Check: Return existing result if already evaluated and submitted
    const resultId = `${studentUid}_${examId}`;
    const resultRef = db.collection('results').doc(resultId);
    const existingResultSnap = await resultRef.get();

    if (existingResultSnap.exists) {
      const data = existingResultSnap.data()!;
      return {
        resultId,
        examId,
        studentId: studentUid,
        studentName: data.studentName || '',
        kmuRegistrationNo: data.kmuRegistrationNo || '',
        marks: data.marks || 0,
        totalMarks: data.totalMarks || 0,
        percentage: data.percentage || 0,
        passed: Boolean(data.passed),
        status: 'graded',
        submittedAt: data.submittedAt ? String(data.submittedAt) : new Date().toISOString(),
      };
    }

    // 3. Authoritative Eligibility & Schedule Check (allowing 10 min network grace period)
    const eligibility = await verifyCandidateEligibility(
      db,
      studentUid,
      examId,
      Date.now(),
      { allowSubmissionGrace: true }
    );

    if (!eligibility.allowed) {
      throw new HttpsError('failed-precondition', eligibility.message);
    }

    const exam = eligibility.exam!;
    const student = eligibility.student!;

    // 4. Load Authoritative Master Questions with Answer Keys
    const questionsSnap = await db
      .collection('questions')
      .where('examId', '==', examId)
      .get();

    const masterQuestions = questionsSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as MasterQuestion[];

    if (masterQuestions.length === 0) {
      throw new HttpsError('failed-precondition', 'No questions found for this examination.');
    }

    // 5. Server-Side Authoritative Grading
    const graded = gradeExamSubmission(masterQuestions, answers, exam.passingMarks);

    // 6. Write Authoritative Result Document via Admin SDK
    const submittedTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const resultDocData = {
      id: resultId,
      examId,
      studentId: studentUid,
      studentName: student.name || 'Student Candidate',
      kmuRegistrationNo: student.kmuRegistrationNo || '',
      examTitle: exam.title,
      examType: exam.type || 'quiz',
      subject: exam.subject || 'Clinical Assessment',
      program: student.program || exam.program || '',
      semester: student.semester || exam.semester || '',
      batch: student.batch || exam.batch || '',
      marks: graded.obtainedMarks,
      totalMarks: graded.totalMarks,
      percentage: graded.percentage,
      passed: graded.passed,
      answersCount: graded.answersCount,
      correctCount: graded.correctCount,
      status: 'graded',
      submittedAt: submittedTimestamp,
      evaluatedBy: 'secure-backend-grading-engine',
    };

    await resultRef.set(resultDocData);

    // 7. Update Assignment Document status to 'submitted'
    try {
      const assignmentId = `${examId}_${studentUid}`;
      const assignmentRef = db.collection('assignments').doc(assignmentId);
      await assignmentRef.set(
        {
          id: assignmentId,
          examId,
          studentId: studentUid,
          status: 'submitted',
          submittedAt: submittedTimestamp,
        },
        { merge: true }
      );
    } catch (assignErr) {
      console.warn('Could not update assignment status to submitted:', assignErr);
    }

    return {
      resultId,
      examId,
      studentId: studentUid,
      studentName: resultDocData.studentName,
      kmuRegistrationNo: resultDocData.kmuRegistrationNo,
      marks: graded.obtainedMarks,
      totalMarks: graded.totalMarks,
      percentage: graded.percentage,
      passed: graded.passed,
      status: 'graded',
      submittedAt: new Date().toISOString(),
    };
  }
);
