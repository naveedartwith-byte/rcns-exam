import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyCandidateEligibility, validateAndAuthorizeExamCode } from './examAuth';
import { gradeExamSubmission, calculateKmuGrade } from './grading';
import type {
  GetStudentQuestionsRequest,
  GetStudentQuestionsResponse,
  SubmitExamAttemptRequest,
  SubmitExamAttemptResponse,
  VerifyExamCodeRequest,
  VerifyExamCodeResponse,
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
 * Cloud Function: verifyExamSecretCode
 * Authenticates candidate, verifies eligibility, enforces rate limiting,
 * securely validates secret exam code against salted hash, and authorizes attempt.
 */
export const verifyExamSecretCode = onCall(
  { region: FUNCTION_REGION },
  async (request): Promise<VerifyExamCodeResponse> => {
    // 1. Verify caller authentication
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to verify examination code.');
    }

    const studentUid = request.auth.uid;
    const { examId, code } = request.data as VerifyExamCodeRequest;

    if (!examId || typeof examId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid examination ID is required.');
    }

    if (!code || typeof code !== 'string') {
      throw new HttpsError('invalid-argument', 'Secret exam code is required.');
    }

    const result = await validateAndAuthorizeExamCode(
      db,
      studentUid,
      examId,
      code,
      Date.now()
    );

    if (!result.success) {
      const isRateLimited = result.code === 'rate_limited';
      const isInvalidCode = result.code === 'invalid_code';
      const errorCode = isRateLimited
        ? 'resource-exhausted'
        : isInvalidCode
        ? 'permission-denied'
        : 'failed-precondition';
      throw new HttpsError(errorCode, result.message);
    }

    return {
      success: true,
      examId: result.examId,
      verifiedAt: result.verifiedAt,
      attemptId: result.attemptId,
    };
  }
);

/**
 * Cloud Function: getStudentExamQuestions
 * Authenticates candidate, verifies eligibility & schedule against trusted server time,
 * checks secret code verification if required, fetches master questions, strips answer keys & explanations,
 * and delivers sanitized paper.
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

    // 2b. If exam requires secret code, verify candidate assignment has codeVerified === true
    if (exam.requiresSecretCode === true) {
      const assignmentId = `${examId}_${studentUid}`;
      const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
      if (!assignmentSnap.exists || assignmentSnap.data()?.codeVerified !== true) {
        throw new HttpsError(
          'permission-denied',
          'Secret exam code verification required before examination questions can be accessed.'
        );
      }
    }

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
    const { examId, answers, writtenAnswers } = request.data as SubmitExamAttemptRequest;

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
        grade: data.grade || '',
        status: data.status || 'graded',
        mcqMarks: data.mcqMarks ?? data.marks ?? 0,
        mcqTotalMarks: data.mcqTotalMarks ?? data.totalMarks ?? 0,
        totalQuestions: data.totalQuestions || 0,
        totalMCQs: data.totalMCQs || 0,
        answeredMCQs: data.answeredMCQs || 0,
        correctMCQs: data.correctMCQs || 0,
        incorrectMCQs: data.incorrectMCQs || 0,
        unansweredMCQs: data.unansweredMCQs || 0,
        totalObjectiveMarks: data.totalObjectiveMarks || data.mcqTotalMarks || 0,
        obtainedObjectiveMarks: data.obtainedObjectiveMarks || data.mcqMarks || 0,
        totalWrittenQuestions: data.totalWrittenQuestions || 0,
        writtenAnsweredCount: data.writtenAnsweredCount || 0,
        writtenUnansweredCount: data.writtenUnansweredCount || 0,
        requiresWrittenGrading: Boolean(data.requiresWrittenGrading),
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

    // Load Written Questions (if any)
    let masterWrittenQuestions: Array<{ id: string; maxMarks: number }> = [];
    try {
      const writtenSnap = await db
        .collection('writtenQuestions')
        .where('examId', '==', examId)
        .get();
      masterWrittenQuestions = writtenSnap.docs.map((d) => ({
        id: d.id,
        maxMarks: Number(d.data().maxMarks) || 5,
      }));
    } catch {
      if (Array.isArray(exam.sanitizedWrittenQuestions)) {
        masterWrittenQuestions = exam.sanitizedWrittenQuestions.map((wq: any) => ({
          id: String(wq.id),
          maxMarks: Number(wq.maxMarks) || 5,
        }));
      }
    }

    // 5. Server-Side Authoritative Grading for MCQs
    const graded = gradeExamSubmission(masterQuestions, answers, exam.passingMarks);

    // 6. Compute Comprehensive Answer Statistics
    const totalMCQs = masterQuestions.length;
    const answeredMCQs = graded.answersCount;
    const correctMCQs = graded.correctCount;
    const incorrectMCQs = Math.max(0, answeredMCQs - correctMCQs);
    const unansweredMCQs = Math.max(0, totalMCQs - answeredMCQs);
    const totalObjectiveMarks = graded.totalMarks;
    const obtainedObjectiveMarks = graded.obtainedMarks;

    const totalWrittenQuestions = masterWrittenQuestions.length;
    let writtenAnsweredCount = 0;
    const sanitizedWrittenAnswers: Record<string, any> = {};

    if (writtenAnswers && typeof writtenAnswers === 'object') {
      for (const [key, val] of Object.entries(writtenAnswers)) {
        if (val && typeof val === 'object') {
          const answerText = String((val as any).answerText || '').trim();
          sanitizedWrittenAnswers[key] = {
            questionId: String((val as any).questionId || key),
            type: (val as any).type || 'short',
            questionText: String((val as any).questionText || ''),
            answerText,
            wordCount: Number((val as any).wordCount) || (answerText ? answerText.split(/\s+/).length : 0),
            submittedAt: (val as any).submittedAt || new Date().toISOString(),
          };
          if (answerText.length > 0) {
            writtenAnsweredCount++;
          }
        }
      }
    }

    const writtenUnansweredCount = Math.max(0, totalWrittenQuestions - writtenAnsweredCount);
    const totalQuestions = totalMCQs + totalWrittenQuestions;
    const writtenTotalMarks = masterWrittenQuestions.reduce((sum, wq) => sum + (Number(wq.maxMarks) || 5), 0);
    const combinedTotalMarks = Number(exam.totalMarks) || (totalObjectiveMarks + writtenTotalMarks);
    const requiresWrittenGrading = totalWrittenQuestions > 0;

    // Status & Grades
    const status: 'pending' | 'graded' = requiresWrittenGrading ? 'pending' : 'graded';
    const grade = requiresWrittenGrading ? 'Pending' : (graded.grade || calculateKmuGrade(graded.percentage));
    const passed = requiresWrittenGrading ? false : graded.passed;
    const marks = obtainedObjectiveMarks;
    const percentage = requiresWrittenGrading
      ? Math.round((obtainedObjectiveMarks / combinedTotalMarks) * 1000) / 10
      : graded.percentage;

    // 7. Write Authoritative Result Document via Admin SDK
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
      marks,
      totalMarks: combinedTotalMarks,
      percentage,
      passed,
      grade,
      status,
      answersCount: answeredMCQs,
      correctCount: correctMCQs,
      mcqMarks: obtainedObjectiveMarks,
      mcqTotalMarks: totalObjectiveMarks,
      totalQuestions,
      totalMCQs,
      answeredMCQs,
      correctMCQs,
      incorrectMCQs,
      unansweredMCQs,
      totalObjectiveMarks,
      obtainedObjectiveMarks,
      totalWrittenQuestions,
      writtenAnsweredCount,
      writtenUnansweredCount,
      writtenMarks: 0,
      writtenTotalMarks,
      requiresWrittenGrading,
      answers,
      writtenAnswers: sanitizedWrittenAnswers,
      submittedAt: submittedTimestamp,
      evaluatedBy: requiresWrittenGrading ? 'pending-faculty-evaluation' : 'secure-backend-grading-engine',
    };

    await resultRef.set(resultDocData);

    // 8. Update Assignment Document status to 'submitted'
    try {
      const assignmentId = `${examId}_${studentUid}`;
      const assignmentRef = db.collection('assignments').doc(assignmentId);
      await assignmentRef.set(
        {
          id: assignmentId,
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
          status: 'submitted',
          submittedAt: submittedTimestamp,
          answers,
          answersCount: answeredMCQs,
          writtenAnswers: sanitizedWrittenAnswers,
          writtenAnswersCount: writtenAnsweredCount,
          mcqMarks: obtainedObjectiveMarks,
          mcqTotalMarks: totalObjectiveMarks,
          totalQuestions,
          totalMCQs,
          answeredMCQs,
          correctMCQs,
          incorrectMCQs,
          unansweredMCQs,
          totalObjectiveMarks,
          obtainedObjectiveMarks,
          totalWrittenQuestions,
          writtenAnsweredCount,
          writtenUnansweredCount,
          totalMarks: combinedTotalMarks,
          requiresWrittenGrading,
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
      marks,
      totalMarks: combinedTotalMarks,
      percentage,
      passed,
      grade,
      status,
      mcqMarks: obtainedObjectiveMarks,
      mcqTotalMarks: totalObjectiveMarks,
      totalQuestions,
      totalMCQs,
      answeredMCQs,
      correctMCQs,
      incorrectMCQs,
      unansweredMCQs,
      totalObjectiveMarks,
      obtainedObjectiveMarks,
      totalWrittenQuestions,
      writtenAnsweredCount,
      writtenUnansweredCount,
      requiresWrittenGrading,
      submittedAt: new Date().toISOString(),
    };
  }
);

/**
 * Cloud Function: adminUpdateStudentPassword
 * Allows authorized administrators to securely change/reset a student's password in Firebase Authentication.
 */
export const adminUpdateStudentPassword = onCall(
  { region: FUNCTION_REGION },
  async (request) => {
    // 1. Verify caller authentication
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'Caller must be authenticated.');
    }

    const callerUid = request.auth.uid;

    // 2. Authoritative Admin verification
    let isCallerAdmin = false;

    // Check custom claims
    if (request.auth.token?.role === 'admin' || request.auth.token?.admin === true) {
      isCallerAdmin = true;
    }

    // Check institutional admin email pattern
    const callerEmail = request.auth.token?.email || '';
    if (
      callerEmail.toLowerCase() === 'admin@royalcollege.edu.pk' ||
      callerEmail.toLowerCase() === 'naveedartwith@gmail.com'
    ) {
      isCallerAdmin = true;
    }

    // Check Firestore admins collection
    if (!isCallerAdmin) {
      const adminDoc = await db.collection('admins').doc(callerUid).get();
      if (adminDoc.exists) {
        isCallerAdmin = true;
      }
    }

    // Check Firestore users collection role
    if (!isCallerAdmin) {
      const userDoc = await db.collection('users').doc(callerUid).get();
      if (userDoc.exists && userDoc.data()?.role?.toLowerCase() === 'admin') {
        isCallerAdmin = true;
      }
    }

    if (!isCallerAdmin) {
      throw new HttpsError('permission-denied', 'Only authorized administrators can change student passwords.');
    }

    const { studentUid, newPassword } = (request.data || {}) as {
      studentUid?: string;
      newPassword?: string;
    };

    if (!studentUid || typeof studentUid !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid student UID is required.');
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
    }

    // 3. Update student password in Firebase Authentication
    try {
      await admin.auth().updateUser(studentUid, {
        password: newPassword,
      });

      console.log(`[Admin Password Update] Administrator ${callerUid} successfully updated password for student ${studentUid}`);

      return {
        success: true,
        message: 'Student password successfully updated in Firebase Authentication.',
      };
    } catch (authErr: any) {
      console.error('[Admin Password Update Error]', authErr);
      throw new HttpsError('internal', authErr.message || 'Failed to update student password in Firebase Auth.');
    }
  }
);

