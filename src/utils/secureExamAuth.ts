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
