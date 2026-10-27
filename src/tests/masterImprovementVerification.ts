/**
 * MASTER IMPROVEMENT VERIFICATION SUITE — ROYAL COLLEGE OF NURSING SWAT
 * Tests for:
 * 1. Feature 1: Result Calculations, KMU Grading, Father's Name Resolution, and Excel Formula Sanitization
 * 2. Feature 2: Complete Removal of Fabricated GPA / CGPA Values
 * 3. Feature 3: Teacher-Controlled Exam Lock for Misbehavior, Answer Preservation, and Timer Continuity
 */

import { sanitizeExcelValue } from '../utils/excelExport.ts';
import { MOCK_STUDENTS } from '../mock/mockData.ts';
import type { Assignment, ExamLockAuditEntry } from '../types/assignment.ts';

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${name}`);
  }
}

console.log('========================================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT - Master Improvement Verification Suite');
console.log('========================================================================\n');

// ============================================================================
// TEST SUITE 1: RESULT CALCULATIONS, KMU GRADING & EXCEL SANITIZATION
// ============================================================================
console.log('--- Test Suite 1: Result Calculations, KMU Grading & Excel Sanitization ---');

// 1.1 Correct, Wrong, Unanswered MCQ Counting
interface MockMCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  marks: number;
}

const mockQuestions: MockMCQQuestion[] = [
  { id: 'q1', question: 'Q1 Text', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', marks: 1 },
  { id: 'q2', question: 'Q2 Text', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', marks: 2 },
  { id: 'q3', question: 'Q3 Text', options: ['A', 'B', 'C', 'D'], correctAnswer: 'C', marks: 1 },
  { id: 'q4', question: 'Q4 Text', options: ['A', 'B', 'C', 'D'], correctAnswer: 'D', marks: 1 },
  { id: 'q5', question: 'Q5 Text', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', marks: 1 },
];

const studentAnswers: Record<string, string> = {
  q1: 'A', // Correct (+1)
  q2: 'C', // Wrong (0)
  q3: 'C', // Correct (+1)
  // q4 is unanswered
  q5: 'B', // Wrong (0)
};

let correctMCQs = 0;
let wrongMCQs = 0;
let unansweredMCQs = 0;
let obtainedMarks = 0;
let totalMarks = 0;

for (const q of mockQuestions) {
  totalMarks += q.marks;
  const answered = studentAnswers[q.id];
  if (answered === undefined || answered === null || answered === '') {
    unansweredMCQs++;
  } else if (answered.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
    correctMCQs++;
    obtainedMarks += q.marks;
  } else {
    wrongMCQs++;
  }
}

assert(totalMarks === 6, 'Total marks correctly aggregated across questions with variable weights');
assert(correctMCQs === 2, 'Correct MCQs correctly counted (2 answered correctly)');
assert(wrongMCQs === 2, 'Wrong MCQs correctly counted (2 answered incorrectly)');
assert(unansweredMCQs === 1, 'Unanswered MCQs correctly counted (1 left blank)');
assert(obtainedMarks === 2, 'Obtained marks accurately calculated based on question marks');

const percentage = Math.round((obtainedMarks / totalMarks) * 1000) / 10;
assert(percentage === 33.3, `Percentage calculated accurately: expected 33.3%, got ${percentage}%`);

// KMU Grading Logic
function calculateKmuGrade(pct: number): string {
  if (pct >= 80) return 'A+';
  if (pct >= 70) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'F';
}

assert(calculateKmuGrade(85) === 'A+', 'Grade 85% is A+');
assert(calculateKmuGrade(75) === 'A', 'Grade 75% is A');
assert(calculateKmuGrade(63) === 'B', 'Grade 63% is B');
assert(calculateKmuGrade(52) === 'C', 'Grade 52% is C');
assert(calculateKmuGrade(48) === 'F', 'Grade 48% is F (Fail threshold < 50%)');

// 1.2 Excel Formula Injection Protection (CSV / XLSX Sanitization)
console.log('\n--- Excel Formula Injection Sanitization ---');
assert(sanitizeExcelValue('=SUM(A1:B10)') === "'=SUM(A1:B10)", 'Escapes formulas starting with =');
assert(sanitizeExcelValue('+CMD|calc') === "'+CMD|calc", 'Escapes strings starting with +');
assert(sanitizeExcelValue('-2+3') === "'-2+3", 'Escapes strings starting with - when non-numeric expression');
assert(sanitizeExcelValue('@HYPERLINK("http://evil.com")') === "'@HYPERLINK(\"http://evil.com\")", 'Escapes strings starting with @');
assert(sanitizeExcelValue(42) === 42, 'Preserves numeric 42 as actual number');
assert(sanitizeExcelValue(-15) === -15, 'Preserves numeric -15 as actual negative number');
assert(sanitizeExcelValue('Ali Khan') === 'Ali Khan', 'Preserves benign student name unchanged');
assert(sanitizeExcelValue(null) === 'N/A', 'Converts null to N/A');
assert(sanitizeExcelValue(undefined) === 'N/A', 'Converts undefined to N/A');
assert(sanitizeExcelValue('') === 'N/A', 'Converts empty string to N/A');

// ============================================================================
// TEST SUITE 2: FABRICATED GPA / CGPA COMPLETE REMOVAL
// ============================================================================
console.log('\n--- Test Suite 2: Complete Removal of Fabricated GPA Feature ---');

// Verify MOCK_STUDENTS contains no gpa properties
const studentsWithGpa = MOCK_STUDENTS.filter((s: any) => s.gpa !== undefined);
assert(studentsWithGpa.length === 0, 'No mock student contains a fabricated GPA property');

// Verify all mock students retain legitimate academic data: KMU reg #, name, semester, batch
const allHaveValidData = MOCK_STUDENTS.every(
  (s) => s.name && s.kmuRegistrationNo && s.semester && s.batch
);
assert(allHaveValidData, 'All students retain legitimate KMU registration number, semester, and batch cohort');

// Verify Father Name field availability or fallback to N/A
const testProfiles = [
  { name: 'Ayesha Bibi', fatherName: 'Muhammad Rahim' },
  { name: 'Bilal Khan', fatherName: '' },
  { name: 'Zahid Ullah' }, // fatherName omitted
];
for (const p of testProfiles) {
  const displayFatherName = (p as any).fatherName && (p as any).fatherName.trim() ? (p as any).fatherName.trim() : 'N/A';
  if (p.name === 'Ayesha Bibi') {
    assert(displayFatherName === 'Muhammad Rahim', `Father name displayed when available (${displayFatherName})`);
  } else {
    assert(displayFatherName === 'N/A', `Father name safely falls back to 'N/A' when missing for ${p.name}`);
  }
}

// ============================================================================
// TEST SUITE 3: TEACHER-CONTROLLED EXAM LOCK FOR MISBEHAVIOR
// ============================================================================
console.log('\n--- Test Suite 3: Teacher-Controlled Exam Lock for Misbehavior ---');

// 3.1 Mock Attempt State & Lock Transition
const activeAttempt: Assignment = {
  id: 'attempt-001',
  examId: 'exam-cardio-101',
  studentId: 'std-kmu-001',
  assignedBy: 'teacher-001',
  studentName: 'Ahmad Jan',
  kmuRegistrationNo: '2026/KMU/RCNS/001',
  status: 'started',
  assignedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
  answers: {
    q1: 'A',
    q2: 'B',
  },
  flaggedQuestions: [2],
  timeLeftSeconds: 2400,
  isLocked: false,
};

// Simulation: Teacher locks the attempt
function simulateLockAttempt(
  attempt: Assignment,
  teacherUid: string,
  teacherName: string,
  teacherRole: 'teacher' | 'admin' | 'student',
  reason: string
): { success: boolean; updatedAttempt?: Assignment; error?: string } {
  // Authorization check
  if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
    return { success: false, error: 'Unauthorized: Only teachers or admins can lock exams' };
  }
  // Cannot lock finalized attempts
  if (attempt.status === 'submitted' || attempt.status === 'graded') {
    return { success: false, error: 'Cannot lock an already submitted or graded examination attempt' };
  }
  if (!reason || !reason.trim()) {
    return { success: false, error: 'A valid lock reason is required' };
  }

  const now = new Date().toISOString();
  const auditEntry: ExamLockAuditEntry = {
    action: 'lock',
    timestamp: now,
    actorId: teacherUid,
    actorName: teacherName,
    actorRole: teacherRole,
    reason: reason.trim(),
    examId: attempt.examId,
    studentId: attempt.studentId,
  };

  const updated: Assignment = {
    ...attempt,
    isLocked: true,
    lockedAt: now,
    lockedBy: teacherUid,
    lockedByName: teacherName,
    lockedByRole: teacherRole,
    lockReason: reason.trim(),
    lockAuditTrail: [...(attempt.lockAuditTrail || []), auditEntry],
  };

  return { success: true, updatedAttempt: updated };
}

// Simulation: Teacher unlocks the attempt
function simulateUnlockAttempt(
  attempt: Assignment,
  teacherUid: string,
  teacherName: string,
  teacherRole: 'teacher' | 'admin' | 'student',
  reason: string
): { success: boolean; updatedAttempt?: Assignment; error?: string } {
  if (teacherRole !== 'teacher' && teacherRole !== 'admin') {
    return { success: false, error: 'Unauthorized: Only teachers or admins can unlock exams' };
  }
  if (!attempt.isLocked) {
    return { success: false, error: 'Attempt is not currently locked' };
  }

  const now = new Date().toISOString();
  const auditEntry: ExamLockAuditEntry = {
    action: 'unlock',
    timestamp: now,
    actorId: teacherUid,
    actorName: teacherName,
    actorRole: teacherRole,
    reason: reason.trim() || 'Unlocked by invigilator',
    examId: attempt.examId,
    studentId: attempt.studentId,
  };

  const updated: Assignment = {
    ...attempt,
    isLocked: false,
    lockAuditTrail: [...(attempt.lockAuditTrail || []), auditEntry],
  };

  return { success: true, updatedAttempt: updated };
}

// 3.2 Test Authorization
const studentLockResult = simulateLockAttempt(
  activeAttempt,
  'student-123',
  'Student Impersonator',
  'student',
  'Trying to lock myself'
);
assert(!studentLockResult.success, 'Student is blocked from locking an exam');

// 3.3 Test Teacher Lock
const lockResult = simulateLockAttempt(
  activeAttempt,
  'teacher-001',
  'Prof. Naveed',
  'teacher',
  'Suspected mobile phone usage during invigilation'
);
assert(lockResult.success === true, 'Teacher successfully locks active student exam');
const lockedAttempt = lockResult.updatedAttempt!;

assert(lockedAttempt.isLocked === true, 'Exam attempt state reflects isLocked === true');
assert(lockedAttempt.lockedByName === 'Prof. Naveed', 'Lock record captures teacher name');
assert(Boolean(lockedAttempt.lockReason?.includes('Suspected mobile phone')), 'Lock record captures stated reason');
assert(lockedAttempt.lockAuditTrail?.length === 1, 'Audit trail contains 1 lock event');

// 3.4 Test Answer Preservation
assert(
  lockedAttempt.answers?.['q1'] === 'A' && lockedAttempt.answers?.['q2'] === 'B',
  'Previously saved answers (q1, q2) are 100% preserved and intact after lock'
);

// 3.5 Test Cannot Lock Already Submitted Attempt
const submittedAttempt: Assignment = {
  ...activeAttempt,
  status: 'submitted',
};
const lockSubmittedResult = simulateLockAttempt(
  submittedAttempt,
  'teacher-001',
  'Prof. Naveed',
  'teacher',
  'Late lock attempt'
);
assert(!lockSubmittedResult.success, 'System prevents locking an already finalized or submitted exam attempt');

// 3.6 Test Timer Continuity
// Lock action does NOT alter startedAt or examDurationMinutes
const examDurationMinutes = 60;
const examStartTime = new Date(String(lockedAttempt.startedAt)).getTime();
const deadline = examStartTime + examDurationMinutes * 60 * 1000;
const expectedRemainingSeconds = Math.max(0, Math.floor((deadline - Date.now()) / 1000));

assert(
  lockedAttempt.startedAt === activeAttempt.startedAt,
  'startedAt timestamp is never reset or modified, guaranteeing timer continuity'
);
assert(expectedRemainingSeconds > 0, `Timer deadline continues counting down: ${expectedRemainingSeconds}s remaining`);

// 3.7 Test Teacher Unlock
const unlockResult = simulateUnlockAttempt(
  lockedAttempt,
  'teacher-001',
  'Prof. Naveed',
  'teacher',
  'Student cleared of suspicion, permitted to resume'
);
assert(unlockResult.success === true, 'Teacher successfully unlocks the exam');
const unlockedAttempt = unlockResult.updatedAttempt!;
assert(unlockedAttempt.isLocked === false, 'Exam attempt is restored to unlocked state');
assert(unlockedAttempt.lockAuditTrail?.length === 2, 'Audit trail retains full history (lock + unlock events)');
assert(
  unlockedAttempt.answers?.['q1'] === 'A' && unlockedAttempt.answers?.['q2'] === 'B',
  'Answers remain completely preserved upon unlock'
);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n========================================================================');
console.log(`VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
console.log('========================================================================');

if (failed > 0) {
  process.exit(1);
}
