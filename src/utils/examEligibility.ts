import type { Exam } from '../types/exam.ts';
import type { StudentProfile } from '../types/student.ts';
import type { UserProfile } from '../types/user.ts';
import {
  parseDateToMillis,
  formatPakistanDateTime,
  getEffectiveExamStatus,
} from './dateTime.ts';

export type EligibilityVerdictReason =
  | 'eligible'
  | 'unauthenticated'
  | 'profile_missing'
  | 'cohort_mismatch'
  | 'exam_not_published'
  | 'not_started'
  | 'expired'
  | 'invalid_schedule';

export interface ExamEligibilityResult {
  allowed: boolean;
  reason: EligibilityVerdictReason;
  message: string;
  diagnostics: {
    student: {
      uid: string;
      isAuthenticated: boolean;
      hasProfile: boolean;
      name: string;
      kmuRegistrationNo: string;
      program: string;
      batch: string;
      semester: string;
    };
    exam: {
      id: string;
      title: string;
      rawStatus: string;
      effectiveStatus: string;
      program: string;
      batch?: string;
      semester: string;
      startAtRaw: unknown;
      endAtRaw: unknown;
      startAtType: 'Firestore Timestamp' | 'Date instance' | 'ISO string' | 'epoch number' | 'null or undefined' | 'unknown';
      endAtType: 'Firestore Timestamp' | 'Date instance' | 'ISO string' | 'epoch number' | 'null or undefined' | 'unknown';
      startAtPkt: string;
      endAtPkt: string;
    };
    schedule: {
      currentTimePkt: string;
      nowMs: number;
      startAtMs: number | null;
      endAtMs: number | null;
    };
    checks: {
      isAuthenticated: boolean;
      hasProfile: boolean;
      isProgramMatch: boolean;
      isSemesterMatch: boolean;
      isBatchMatch: boolean;
      hasIndividualAssignment: boolean;
      isPublished: boolean;
      isScheduledTimeArrived: boolean;
      isWithinWindow: boolean;
    };
  };
}

/**
 * Detects whether a timestamp field is stored as a Firestore Timestamp, Date object, string, or number.
 */
export function getTimestampStorageType(
  value: unknown
): 'Firestore Timestamp' | 'Date instance' | 'ISO string' | 'epoch number' | 'null or undefined' | 'unknown' {
  if (value === null || value === undefined) return 'null or undefined';
  if (typeof value === 'object' && value !== null) {
    if ('toMillis' in value || 'toDate' in value || 'seconds' in value) {
      return 'Firestore Timestamp';
    }
    if (value instanceof Date) {
      return 'Date instance';
    }
  }
  if (typeof value === 'string') {
    return 'ISO string';
  }
  if (typeof value === 'number') {
    return 'epoch number';
  }
  return 'unknown';
}

/**
 * Evaluates whether a student candidate is authorized and eligible to attempt an examination.
 * Performs rigorous multi-point validation against:
 * 1. Authentication & student profile existence
 * 2. Academic cohort criteria (Program, Semester, and Batch) or individual assignment
 * 3. Lifecycle status (Draft/Archived exclusion)
 * 4. Pakistan Standard Time (PKT, UTC+05:00 / Asia/Karachi) schedule boundaries
 *
 * When isDev is true (or in development mode), outputs structured diagnostic logging
 * identifying which specific check passed or failed without leaking secrets.
 */
export function checkStudentExamEligibility(params: {
  exam: Exam & { assignmentId?: string };
  student: StudentProfile | null;
  user?: UserProfile | null;
  nowMs?: number;
  isDev?: boolean;
}): ExamEligibilityResult {
  const { exam, student, user, nowMs = Date.now(), isDev } = params;

  // Canonical Current Time in Asia/Karachi (PKT)
  const currentTimePkt = formatPakistanDateTime(nowMs, true);

  // Parse exam schedule timestamps canonically
  const startAtMs = parseDateToMillis(exam.startAt);
  const endAtMs = parseDateToMillis(exam.endAt);
  const startAtPkt = formatPakistanDateTime(exam.startAt);
  const endAtPkt = formatPakistanDateTime(exam.endAt);

  const startAtType = getTimestampStorageType(exam.startAt);
  const endAtType = getTimestampStorageType(exam.endAt);

  // Student credentials & academic cohort
  const studentUid = student?.uid || user?.uid || '';
  const isAuthenticated = Boolean(studentUid);
  const hasProfile = Boolean(student);

  const studentProgram = (student?.program || '').trim();
  const studentBatch = (student?.batch || '').trim();
  const studentSemester = (student?.semester || '').trim();

  // Target exam cohort
  const examProgram = (exam.program || '').trim();
  const examBatch = (exam.batch || '').trim();
  const examSemester = (exam.semester || '').trim();

  // Cohort comparisons (canonical case-insensitive matching)
  const isProgramMatch =
    Boolean(studentProgram) &&
    Boolean(examProgram) &&
    studentProgram.toLowerCase() === examProgram.toLowerCase();

  const isSemesterMatch =
    Boolean(studentSemester) &&
    Boolean(examSemester) &&
    studentSemester.toLowerCase() === examSemester.toLowerCase();

  // If exam has a target batch, student must match that batch. If exam has no batch, open to all batches.
  const isBatchMatch =
    !examBatch ||
    (Boolean(studentBatch) && studentBatch.toLowerCase() === examBatch.toLowerCase());

  // Individual direct assignment check
  const hasIndividualAssignment = Boolean(exam.assignmentId);

  // Cohort authorization is valid if program, semester, and batch match
  const isCohortAuthorized = isProgramMatch && isSemesterMatch && isBatchMatch;
  const isAssignedOrCohortEligible = hasIndividualAssignment || isCohortAuthorized;

  // Lifecycle status
  const isPublished = exam.status !== 'draft' && exam.status !== 'archived';

  // Schedule evaluation
  const isScheduledTimeArrived = startAtMs !== null && nowMs >= startAtMs;
  const isWindowOpen = isScheduledTimeArrived && (endAtMs === null || nowMs < endAtMs);
  const isWindowExpired = endAtMs !== null && nowMs >= endAtMs;

  const effectiveStatus = getEffectiveExamStatus(exam, nowMs);

  // Build diagnostics
  const diagnostics: ExamEligibilityResult['diagnostics'] = {
    student: {
      uid: studentUid,
      isAuthenticated,
      hasProfile,
      name: student?.name || user?.name || 'Anonymous',
      kmuRegistrationNo: student?.kmuRegistrationNo || 'N/A',
      program: studentProgram,
      batch: studentBatch,
      semester: studentSemester,
    },
    exam: {
      id: exam.id,
      title: exam.title,
      rawStatus: exam.status,
      effectiveStatus,
      program: examProgram,
      batch: examBatch || undefined,
      semester: examSemester,
      startAtRaw: exam.startAt,
      endAtRaw: exam.endAt,
      startAtType,
      endAtType,
      startAtPkt,
      endAtPkt,
    },
    schedule: {
      currentTimePkt,
      nowMs,
      startAtMs,
      endAtMs,
    },
    checks: {
      isAuthenticated,
      hasProfile,
      isProgramMatch,
      isSemesterMatch,
      isBatchMatch,
      hasIndividualAssignment,
      isPublished,
      isScheduledTimeArrived,
      isWithinWindow: isWindowOpen,
    },
  };

  // Determine specific verdict
  let verdict: { allowed: boolean; reason: EligibilityVerdictReason; message: string };

  if (!isAuthenticated) {
    verdict = {
      allowed: false,
      reason: 'unauthenticated',
      message: 'Authentication required: Please sign in with your institutional credentials to access examinations.',
    };
  } else if (!hasProfile) {
    verdict = {
      allowed: false,
      reason: 'profile_missing',
      message: 'Student record unavailable: Your candidate profile is still loading or has not been configured.',
    };
  } else if (!isPublished) {
    verdict = {
      allowed: false,
      reason: 'exam_not_published',
      message: 'Access restricted: This examination paper is currently in draft or archived status and is not open for candidates.',
    };
  } else if (!isAssignedOrCohortEligible) {
    // Distinct, clear cohort mismatch error explaining which criteria did not match
    const reasons: string[] = [];
    if (!isProgramMatch) reasons.push(`Program mismatch (Target: ${examProgram || 'N/A'}, Yours: ${studentProgram || 'N/A'})`);
    if (!isSemesterMatch) reasons.push(`Semester mismatch (Target: ${examSemester || 'N/A'}, Yours: ${studentSemester || 'N/A'})`);
    if (!isBatchMatch) reasons.push(`Batch mismatch (Target: ${examBatch || 'N/A'}, Yours: ${studentBatch || 'N/A'})`);

    verdict = {
      allowed: false,
      reason: 'cohort_mismatch',
      message: `Access restricted: You are not authorized to attempt this examination paper. This paper is reserved for ${examProgram} - ${examBatch ? examBatch + ' - ' : ''}${examSemester}. (${reasons.join(', ')})`,
    };
  } else if (startAtMs === null) {
    verdict = {
      allowed: false,
      reason: 'invalid_schedule',
      message: 'Examination schedule error: Scheduled examination start date & time is missing or invalid.',
    };
  } else if (!isScheduledTimeArrived) {
    // Distinct, clear schedule time error indicating the exact future start time
    verdict = {
      allowed: false,
      reason: 'not_started',
      message: `Scheduled start time has not arrived: This examination is scheduled for ${startAtPkt} and cannot be started ahead of time. (Current Pakistan Time: ${currentTimePkt}).`,
    };
  } else if (isWindowExpired) {
    // Distinct, clear deadline expired error
    verdict = {
      allowed: false,
      reason: 'expired',
      message: `Examination window closed: The submission deadline was ${endAtPkt}. New attempts are no longer permitted.`,
    };
  } else {
    // Fully eligible & within active window!
    verdict = {
      allowed: true,
      reason: 'eligible',
      message: `Authorized: Candidate is verified for ${exam.title}. Examination window is active until ${endAtPkt}.`,
    };
  }

  // Development-only diagnostic logging
  const shouldLog = isDev !== undefined ? isDev : (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');
  if (shouldLog) {
    console.group(`[Exam Diagnostic] Eligibility Check: "${exam.title}" (ID: ${exam.id})`);
    console.log('1. Student Authentication & Profile:', {
      uid: diagnostics.student.uid,
      isAuthenticated: diagnostics.student.isAuthenticated,
      hasProfile: diagnostics.student.hasProfile,
      name: diagnostics.student.name,
      kmuRegistrationNo: diagnostics.student.kmuRegistrationNo,
    });
    console.log('2. Student Academic Cohort:', {
      program: diagnostics.student.program,
      batch: diagnostics.student.batch,
      semester: diagnostics.student.semester,
    });
    console.log('3. Exam Cohort & Target Criteria:', {
      examId: diagnostics.exam.id,
      program: diagnostics.exam.program,
      batch: diagnostics.exam.batch || '(All Batches)',
      semester: diagnostics.exam.semester,
      hasIndividualAssignment: diagnostics.checks.hasIndividualAssignment,
    });
    console.log('4. Schedule & Status (Canonical Asia/Karachi):', {
      rawStatus: diagnostics.exam.rawStatus,
      effectiveStatus: diagnostics.exam.effectiveStatus,
      currentTimePkt: diagnostics.schedule.currentTimePkt,
      startAtPkt: diagnostics.exam.startAtPkt,
      endAtPkt: diagnostics.exam.endAtPkt,
      nowEpochMs: diagnostics.schedule.nowMs,
      startEpochMs: diagnostics.schedule.startAtMs,
      endEpochMs: diagnostics.schedule.endAtMs,
    });
    console.log('5. Timestamp Storage Types:', {
      startAtType: diagnostics.exam.startAtType,
      endAtType: diagnostics.exam.endAtType,
    });
    console.log('6. Eligibility Verdict:', {
      allowed: verdict.allowed,
      reason: verdict.reason,
      message: verdict.message,
    });
    console.groupEnd();
  }

  return {
    ...verdict,
    diagnostics,
  };
}
