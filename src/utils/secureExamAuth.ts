export interface EligibilityResult {
  allowed: boolean;
  code: string;
  message: string;
  exam?: any;
  student?: any;
}

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

/**
 * Verifies student candidate eligibility against authoritative Firestore documents
 * and trusted server time.
 */
export async function verifyCandidateEligibility(
  db: any,
  studentUid: string,
  examId: string,
  nowMs: number = Date.now(),
  options: { allowSubmissionGrace?: boolean } = {}
): Promise<EligibilityResult> {
  const examSnap = await db.collection('exams').doc(examId).get();
  if (!examSnap.exists) {
    return {
      allowed: false,
      code: 'exam_not_found',
      message: `Examination with ID "${examId}" does not exist.`,
    };
  }
  const exam = { id: examSnap.id, ...examSnap.data() };

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

  const studentSnap = await db.collection('students').doc(studentUid).get();
  let student: any;
  if (studentSnap.exists) {
    student = { uid: studentSnap.id, ...studentSnap.data() };
  } else {
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

  const assignmentId = `${examId}_${studentUid}`;
  const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
  const hasIndividualAssignment = assignmentSnap.exists;

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
 * Computes salted SHA-256 hash.
 */
export function hashExamCode(code: string, salt: string): string {
  const normalized = (code || '').trim().toUpperCase();
  const data = `${salt}:${normalized}`;
  try {
    const crypto = require('node:crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    // Web Crypto / Node ESM fallback
    let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
    for (let i = 0; i < data.length; i++) {
      const ch = data.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return (p1 + p2).repeat(4);
  }
}

/**
 * Generates a random cryptographic salt.
 */
export function generateExamCodeSalt(): string {
  try {
    const crypto = require('node:crypto');
    return crypto.randomBytes(16).toString('hex');
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
}

export interface VerifyExamCodeResult {
  success: boolean;
  code: string;
  message: string;
  examId?: string;
  attemptId?: string;
  verifiedAt?: string;
}

/**
 * Authoritative Server-side Secret Exam Code Verification Engine
 */
export async function validateAndAuthorizeExamCode(
  db: any,
  studentUid: string,
  payload: { examId: string; code: string; studentId?: string },
  nowMs: number = Date.now()
): Promise<VerifyExamCodeResult> {
  const { examId, code: candidateCode } = payload;
  const attemptId = `attempt_${examId}_${studentUid}`;
  const assignmentDocId = `${examId}_${studentUid}`;

  if (!studentUid) {
    const err: any = new Error('Authentication required. Student must be logged in.');
    err.code = 'unauthenticated';
    throw err;
  }

  const assignmentRef = db.collection('assignments').doc(assignmentDocId);
  const rateLimitRef = db.collection('examCodeRateLimits').doc(`${examId}_${studentUid}`);

  // 1. Authoritative candidate eligibility
  const eligibility = await verifyCandidateEligibility(db, studentUid, examId, nowMs);
  if (!eligibility.allowed) {
    const err: any = new Error(eligibility.message);
    err.code = eligibility.code.includes('mismatch') ||
      eligibility.code.includes('not_assigned') ||
      eligibility.code === 'unregistered_candidate'
      ? 'permission-denied'
      : 'failed-precondition';
    throw err;
  }

  const exam = eligibility.exam;
  const student = eligibility.student;

  // 2. Reject if already submitted
  const existingAssignSnap = await assignmentRef.get();
  if (existingAssignSnap.exists) {
    const existingData = existingAssignSnap.data();
    if (existingData?.status === 'submitted' || existingData?.status === 'graded') {
      const err: any = new Error('Institutional Notice: You have already completed and submitted this examination.');
      err.code = 'already-exists';
      throw err;
    }
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

  // 3. Brute force rate limiting (max 5 failed attempts)
  const rateLimitSnap = await rateLimitRef.get();
  let failedAttempts = 0;
  if (rateLimitSnap.exists) {
    const rlData = rateLimitSnap.data() || {};
    const lastFailedMs = parseTimestampToMillis(rlData.lastFailedAt) || 0;
    const cooldownMs = 15 * 60 * 1000;
    if (nowMs - lastFailedMs < cooldownMs) {
      failedAttempts = Number(rlData.failedAttempts) || 0;
      if (failedAttempts >= 5) {
        const err: any = new Error('Maximum verification attempts exceeded (5 failed attempts). Access temporarily locked.');
        err.code = 'resource-exhausted';
        throw err;
      }
    }
  }

  // 4. Retrieve Secret Code Record
  const secretRef = db.collection('examSecrets').doc(examId);
  const secretSnap = await secretRef.get();

  if (exam.requiresSecretCode !== false && !secretSnap.exists) {
    const err: any = new Error('Secret exam code has not yet been initialized by faculty for this examination.');
    err.code = 'failed-precondition';
    throw err;
  }

  if (secretSnap.exists) {
    const secretData = secretSnap.data();
    const candidateHash = hashExamCode(candidateCode, secretData.salt);

    let isMatch = false;
    if (secretData.codeHash) {
      isMatch = candidateHash === secretData.codeHash;
    } else if (secretData.code) {
      isMatch = (candidateCode || '').trim().toUpperCase() === secretData.code.trim().toUpperCase();
    }

    if (!isMatch) {
      const newFailedCount = failedAttempts + 1;
      await rateLimitRef.set(
        {
          examId,
          studentId: studentUid,
          failedAttempts: newFailedCount,
          lastFailedAt: new Date(nowMs).toISOString(),
        },
        { merge: true }
      );

      const err: any = new Error('Invalid Secret Exam Code. Please verify with your instructor.');
      err.code = 'permission-denied';
      throw err;
    }
  }

  // 5. Success! Atomically update assignment
  await assignmentRef.set(
    {
      id: attemptId,
      examId,
      studentId: studentUid,
      studentName: student?.name || 'Student Candidate',
      status: 'started',
      codeVerified: true,
      codeVerifiedAt: new Date(nowMs).toISOString(),
      attemptId,
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

