import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import type { ExamDocument, StudentProfileDocument, ExamSecretDocument } from './types';

/**
 * Universal timestamp parser returning epoch milliseconds.
 * Supports Firestore Timestamp, Date instance, ISO/RFC string, or numeric epoch.
 */
export function parseTimestampToMillis(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isFinite(val) ? val : null;
  }
  if (typeof val === 'object') {
    if (typeof val.toMillis === 'function') {
      return val.toMillis();
    }
    if (typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (val instanceof Date) {
      return val.getTime();
    }
    if (typeof val._seconds === 'number') {
      return val._seconds * 1000 + (val._nanoseconds || 0) / 1000000;
    }
    if (typeof val.seconds === 'number') {
      return val.seconds * 1000 + (val.nanoseconds || 0) / 1000000;
    }
  }
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    return isNaN(ms) ? null : ms;
  }
  return null;
}

export interface EligibilityResult {
  allowed: boolean;
  code: string;
  message: string;
  exam?: ExamDocument;
  student?: StudentProfileDocument;
}

/**
 * Verifies student candidate eligibility using authoritative Firestore documents
 * and trusted server time.
 */
export async function verifyCandidateEligibility(
  db: admin.firestore.Firestore,
  studentUid: string,
  examId: string,
  nowMs: number = Date.now(),
  options: { allowSubmissionGrace?: boolean } = {}
): Promise<EligibilityResult> {
  // 1. Fetch Exam Document
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    return {
      allowed: false,
      code: 'exam_not_found',
      message: `Examination with ID "${examId}" does not exist.`,
    };
  }
  const exam = { id: examSnap.id, ...examSnap.data() } as ExamDocument;

  // 2. Draft/Archived restriction
  if (exam.status === 'draft') {
    return {
      allowed: false,
      code: 'exam_not_published',
      message: 'This examination paper is currently in draft mode and not yet published by faculty.',
      exam,
    };
  }
  if (exam.status === 'archived') {
    return {
      allowed: false,
      code: 'exam_archived',
      message: 'This examination has been archived and is no longer available.',
      exam,
    };
  }

  // 3. Load authoritative Student Profile
  const studentSnap = await db.collection('students').doc(studentUid).get();
  let student: StudentProfileDocument | undefined;
  if (studentSnap.exists) {
    student = { uid: studentSnap.id, ...studentSnap.data() } as StudentProfileDocument;
  } else {
    // Check users collection fallback
    const userSnap = await db.collection('users').doc(studentUid).get();
    if (!userSnap.exists) {
      return {
        allowed: false,
        code: 'unregistered_candidate',
        message: 'No student registration profile found for your account. Please contact the administrator.',
        exam,
      };
    }
    const userData = userSnap.data() || {};
    student = {
      uid: studentUid,
      name: userData.name || '',
      kmuRegistrationNo: userData.kmuRegistrationNo || '',
      program: userData.program || '',
      semester: userData.semester || '',
      batch: userData.batch || '',
    };
  }

  // 4. Check Individual Assignment Record
  const assignmentId = `${examId}_${studentUid}`;
  const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
  const hasIndividualAssignment = assignmentSnap.exists;

  // 5. Check Academic Cohort Matching if not individually assigned
  if (!hasIndividualAssignment) {
    const studentProgram = (student.program || '').trim().toLowerCase();
    const examProgram = (exam.program || '').trim().toLowerCase();
    const studentSemester = (student.semester || '').trim().toLowerCase();
    const examSemester = (exam.semester || '').trim().toLowerCase();
    const studentBatch = (student.batch || '').trim().toLowerCase();
    const examBatch = (exam.batch || '').trim().toLowerCase();

    if (studentProgram && examProgram && studentProgram !== examProgram) {
      return {
        allowed: false,
        code: 'cohort_program_mismatch',
        message: `Academic program mismatch: Exam is assigned to "${exam.program}", but your registered program is "${student.program}".`,
        exam,
        student,
      };
    }

    if (studentSemester && examSemester && studentSemester !== examSemester) {
      return {
        allowed: false,
        code: 'cohort_semester_mismatch',
        message: `Semester mismatch: Exam is assigned to "${exam.semester}", but your registered semester is "${student.semester}".`,
        exam,
        student,
      };
    }

    if (examBatch && studentBatch && examBatch !== studentBatch) {
      return {
        allowed: false,
        code: 'cohort_batch_mismatch',
        message: `Batch restriction: Exam is designated for "${exam.batch}", but your profile is registered in "${student.batch}".`,
        exam,
        student,
      };
    }
  }

  // 6. Trusted Server Schedule Verification
  const startAtMs = parseTimestampToMillis(exam.startAt);
  const endAtMs = parseTimestampToMillis(exam.endAt);

  if (startAtMs !== null && nowMs < startAtMs) {
    return {
      allowed: false,
      code: 'not_started',
      message: `The scheduled examination start time has not arrived yet.`,
      exam,
      student,
    };
  }

  // Submissions get a 10-minute network grace period; question retrieval does not
  const graceMs = options.allowSubmissionGrace ? 10 * 60 * 1000 : 0;
  if (endAtMs !== null && nowMs > endAtMs + graceMs) {
    return {
      allowed: false,
      code: 'expired',
      message: `The scheduled examination attempt window has ended and this paper is now closed.`,
      exam,
      student,
    };
  }

  return {
    allowed: true,
    code: 'eligible',
    message: 'Candidate is verified and authorized.',
    exam,
    student,
  };
}

/**
 * Computes salted SHA-256 hash for an examination code.
 * Normalized to uppercase trimmed string for consistent comparison.
 */
export function hashExamCode(code: string, salt: string): string {
  const normalized = (code || '').trim().toUpperCase();
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}

/**
 * Generates a random cryptographic salt.
 */
export function generateExamCodeSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export interface CodeValidationResult {
  success: boolean;
  code: string;
  message: string;
  examId: string;
  attemptId: string;
  verifiedAt: string;
}

/**
 * Authoritatively validates secret exam code, checks candidate eligibility,
 * enforces rate limits, and atomically creates/authorizes attempt in Firestore.
 */
export async function validateAndAuthorizeExamCode(
  db: admin.firestore.Firestore,
  studentUid: string,
  examId: string,
  candidateCode: string,
  nowMs: number = Date.now()
): Promise<CodeValidationResult> {
  const attemptId = `${examId}_${studentUid}`;
  const rateLimitRef = db.collection('examCodeRateLimits').doc(attemptId);
  const assignmentRef = db.collection('assignments').doc(attemptId);

  // 1. Authoritative Eligibility & Schedule Check
  const eligibility = await verifyCandidateEligibility(db, studentUid, examId, nowMs, {
    allowSubmissionGrace: false,
  });

  if (!eligibility.allowed) {
    return {
      success: false,
      code: eligibility.code,
      message: eligibility.message,
      examId,
      attemptId,
      verifiedAt: new Date(nowMs).toISOString(),
    };
  }

  const exam = eligibility.exam!;
  const student = eligibility.student!;

  // 2. Check Existing Attempt Policy: Reject if already submitted or graded
  const existingAssignSnap = await assignmentRef.get();
  if (existingAssignSnap.exists) {
    const existingData = existingAssignSnap.data();
    if (existingData?.status === 'submitted' || existingData?.status === 'graded') {
      return {
        success: false,
        code: 'already_submitted',
        message: 'Institutional Notice: You have already completed and submitted this examination. Re-entry is strictly prohibited.',
        examId,
        attemptId,
        verifiedAt: new Date(nowMs).toISOString(),
      };
    }
    // If student has already verified code and attempt is in progress, allow resumption
    if (existingData?.codeVerified === true && existingData?.status === 'started') {
      return {
        success: true,
        code: 'already_verified',
        message: 'Examination attempt is already verified and active.',
        examId,
        attemptId,
        verifiedAt: new Date(nowMs).toISOString(),
      };
    }
  }

  // 3. Brute-force rate limiting: Maximum 5 failed attempts per candidate per exam (15-minute lock)
  const rateLimitSnap = await rateLimitRef.get();
  let failedAttempts = 0;
  if (rateLimitSnap.exists) {
    const rlData = rateLimitSnap.data() || {};
    const lastFailedMs = parseTimestampToMillis(rlData.lastFailedAt) || 0;
    const cooldownMs = 15 * 60 * 1000; // 15 minutes

    if (nowMs - lastFailedMs < cooldownMs) {
      failedAttempts = Number(rlData.failedAttempts) || 0;
      if (failedAttempts >= 5) {
        const remainingMins = Math.ceil((cooldownMs - (nowMs - lastFailedMs)) / 60000);
        return {
          success: false,
          code: 'rate_limited',
          message: `Maximum verification attempts exceeded (5 failed attempts). Access temporarily locked for ${remainingMins} minute(s) to protect institutional integrity. Please contact your examination proctor.`,
          examId,
          attemptId,
          verifiedAt: new Date(nowMs).toISOString(),
        };
      }
    }
  }

  // 4. Retrieve Secret Code Record
  const secretRef = db.collection('examSecrets').doc(examId);
  const secretSnap = await secretRef.get();

  // If exam explicitly requires secret code, secret must exist
  const requiresCode = exam.requiresSecretCode !== false;
  if (requiresCode && !secretSnap.exists) {
    // Legacy migration check: if no secret was ever configured, allow through or inform
    return {
      success: false,
      code: 'code_not_configured',
      message: 'Secret exam code has not yet been initialized by faculty for this examination.',
      examId,
      attemptId,
      verifiedAt: new Date(nowMs).toISOString(),
    };
  }

  if (secretSnap.exists) {
    const secretData = secretSnap.data() as ExamSecretDocument;
    const candidateHash = hashExamCode(candidateCode, secretData.salt);

    let isMatch = false;
    if (secretData.codeHash) {
      isMatch = candidateHash === secretData.codeHash;
    } else if (secretData.code) {
      isMatch = (candidateCode || '').trim().toUpperCase() === secretData.code.trim().toUpperCase();
    }

    if (!isMatch) {
      // Record failed attempt for rate limiting
      const newFailedCount = failedAttempts + 1;
      await rateLimitRef.set(
        {
          examId,
          studentId: studentUid,
          failedAttempts: newFailedCount,
          lastFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAttemptedCodeLength: (candidateCode || '').length,
        },
        { merge: true }
      );

      const attemptsRemaining = Math.max(0, 5 - newFailedCount);
      const remainingNotice = attemptsRemaining > 0
        ? ` (${attemptsRemaining} attempt(s) remaining before temporary lockout).`
        : ' (Account temporarily locked for 15 minutes).';

      return {
        success: false,
        code: 'invalid_code',
        message: `Incorrect Secret Exam Code. Please verify the code announced by your instructor${remainingNotice}`,
        examId,
        attemptId,
        verifiedAt: new Date(nowMs).toISOString(),
      };
    }
  }

  // 5. Success! Clear rate limit and atomically authorize attempt in Firestore
  await rateLimitRef.delete().catch(() => {});

  const nowServer = admin.firestore.FieldValue.serverTimestamp();
  await assignmentRef.set(
    {
      id: attemptId,
      examId,
      studentId: studentUid,
      studentName: student.name || 'Student Candidate',
      kmuRegistrationNo: student.kmuRegistrationNo || '',
      program: student.program || exam.program || '',
      semester: student.semester || exam.semester || '',
      batch: student.batch || exam.batch || '',
      examTitle: exam.title || '',
      status: 'started',
      codeVerified: true,
      codeVerifiedAt: nowServer,
      startedAt: existingAssignSnap.data()?.startedAt || nowServer,
      attemptId,
      assignedBy: existingAssignSnap.data()?.assignedBy || 'code-verified-entry',
    },
    { merge: true }
  );

  return {
    success: true,
    code: 'authorized',
    message: 'Secret exam code verified successfully. Attempt authorized.',
    examId,
    attemptId,
    verifiedAt: new Date(nowMs).toISOString(),
  };
}

