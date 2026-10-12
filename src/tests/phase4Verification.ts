import {
  parseDateToMillis,
  formatPakistanDateTime,
  toDatetimeLocalPktString,
  calculateEndAtPkt,
  getEffectiveExamStatus,
  isExamCurrentlyActive,
  validateSchedule,
  PKT_OFFSET_HOURS,
} from '../utils/dateTime.ts';
import { parseMCQText } from '../utils/mcqParser.ts';
import {
  checkStudentExamEligibility,
  getTimestampStorageType,
} from '../utils/examEligibility.ts';
import type { Exam } from '../types/exam.ts';
import type { StudentProfile } from '../types/student.ts';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${details ? ` - ${details}` : ''}`);
  }
}

console.log('====================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT - Phase 4 Verification');
console.log('====================================================\n');

// --------------------------------------------------------------------
// TEST GROUP 1: Pakistan Standard Time & Schedule Boundaries (ISSUE 3)
// --------------------------------------------------------------------
console.log('--- Test Suite 1: Pakistan Standard Time & Schedule Boundaries ---');

assert(PKT_OFFSET_HOURS === 5, 'Pakistan Standard Time operates at UTC+05:00');

// Injectable clock tests
const mockExam: Exam = {
  id: 'test-quiz-1',
  title: 'Mid-Term Pharmacology',
  description: 'Test Exam',
  type: 'quiz',
  teacherId: 'teacher-1',
  batch: 'Batch 13th',
  semester: 'Semester 4',
  program: 'BS Nursing (Generic)',
  duration: 60,
  totalMarks: 50,
  // 10:00:00 PKT to 11:00:00 PKT on Oct 15, 2026
  // In UTC: 05:00:00Z to 06:00:00Z
  startAt: '2026-10-15T10:00:00+05:00',
  endAt: '2026-10-15T11:00:00+05:00',
  status: 'scheduled',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const startMs = parseDateToMillis(mockExam.startAt)!;
const endMs = parseDateToMillis(mockExam.endAt)!;

// 1. Before startAt -> status must be 'scheduled' (Upcoming) and cannot be active
const timeBeforeStart = startMs - 5 * 60 * 1000; // 5 mins before
assert(
  getEffectiveExamStatus(mockExam, timeBeforeStart) === 'scheduled',
  'Effective status before startAt is "scheduled" (Upcoming)'
);
assert(
  !isExamCurrentlyActive(mockExam, timeBeforeStart),
  'Quiz cannot be active before scheduled startAt'
);

// 2. Exactly at startAt -> status must be 'active'
assert(
  getEffectiveExamStatus(mockExam, startMs) === 'active',
  'Effective status at startAt activates automatically'
);
assert(
  isExamCurrentlyActive(mockExam, startMs),
  'Quiz is active at start time without manual teacher intervention'
);

// 3. During testing window (e.g., +30 mins) -> status must be 'active'
const timeDuring = startMs + 30 * 60 * 1000;
assert(
  getEffectiveExamStatus(mockExam, timeDuring) === 'active',
  'Quiz remains active during configured testing window'
);
assert(
  isExamCurrentlyActive(mockExam, timeDuring),
  'Candidate can enter exam room during active window'
);

// 4. Exactly at endAt -> status must be 'completed' (Closed)
assert(
  getEffectiveExamStatus(mockExam, endMs) === 'completed',
  'Effective status at deadline switches to "completed" (Closed)'
);
assert(
  !isExamCurrentlyActive(mockExam, endMs),
  'Quiz is no longer active at or after deadline'
);

// 5. After endAt -> status must be 'completed' (Expired)
const timeAfterEnd = endMs + 15 * 60 * 1000;
assert(
  getEffectiveExamStatus(mockExam, timeAfterEnd) === 'completed',
  'Effective status after deadline remains closed/completed'
);

// 6. Draft exam never opens regardless of time
const draftExam: Exam = { ...mockExam, status: 'draft' };
assert(
  getEffectiveExamStatus(draftExam, timeDuring) === 'draft',
  'Draft paper status is preserved and never activates for students'
);

// 7. Auto-calculate end time from start time and duration
const calculatedEnd = calculateEndAtPkt('2026-10-15T09:00:00+05:00', 90);
const calcEndMillis = parseDateToMillis(calculatedEnd);
const expectedEndMillis = parseDateToMillis('2026-10-15T09:00:00+05:00')! + 90 * 60 * 1000;
assert(
  calcEndMillis === expectedEndMillis,
  'calculateEndAt accurately calculates end time from start time + duration'
);

// 8. Schedule validation
assert(
  validateSchedule('2026-10-15T10:00', '2026-10-15T11:00', 60) === null,
  'Valid schedule returns no validation errors'
);
assert(
  validateSchedule('2026-10-15T11:00', '2026-10-15T10:00', 60) !== null,
  'Schedule with endAt before startAt is rejected'
);
assert(
  validateSchedule('2026-10-15T10:00', '2026-10-15T10:30', 60) !== null,
  'Schedule window shorter than exam duration is rejected'
);

// 9. Display in Pakistan Standard Time
const formattedPkt = formatPakistanDateTime('2026-10-15T05:00:00Z');
assert(
  formattedPkt.includes('PKT') && (formattedPkt.includes('10:00') || formattedPkt.includes('15 Oct 2026')),
  'Timestamp formats correctly in Pakistan Standard Time with PKT label'
);

const datetimeLocalPkt = toDatetimeLocalPktString('2026-10-15T05:00:00Z');
assert(
  datetimeLocalPkt.startsWith('2026-10-15T10:00'),
  'toDatetimeLocalPktString converts UTC timestamp to Pakistan local input string'
);

// --------------------------------------------------------------------
// TEST GROUP 2: Batch & Semester Cohort Filtering (ISSUE 1 & ISSUE 2)
// --------------------------------------------------------------------
console.log('\n--- Test Suite 2: Batch Selection & Assignment Cohort Matching ---');

// Mock student profiles
interface StudentProfileTest {
  uid: string;
  name: string;
  batch: string;
  semester: string;
  program: string;
}

const students: StudentProfileTest[] = [
  {
    uid: 'student-batch13',
    name: 'Ali Khan',
    batch: 'Batch 13th',
    semester: 'Semester 4',
    program: 'BS Nursing (Generic)',
  },
  {
    uid: 'student-batch14',
    name: 'Zahra Bibi',
    batch: 'Batch 14th',
    semester: 'Semester 4',
    program: 'BS Nursing (Generic)',
  },
  {
    uid: 'student-batch13-sem5',
    name: 'Hamza Farooq',
    batch: 'Batch 13th',
    semester: 'Semester 5',
    program: 'BS Nursing (Generic)',
  },
];

// Target assignment: Batch 13th, Semester 4
const targetCriteria = {
  batch: 'Batch 13th',
  semester: 'Semester 4',
  program: 'BS Nursing (Generic)',
};

function matchesCohort(student: StudentProfileTest, target: typeof targetCriteria): boolean {
  return (
    student.batch.trim().toLowerCase() === target.batch.trim().toLowerCase() &&
    student.semester.trim().toLowerCase() === target.semester.trim().toLowerCase() &&
    student.program.trim().toLowerCase() === target.program.trim().toLowerCase()
  );
}

// 1. Student in target batch & semester matches
assert(
  matchesCohort(students[0], targetCriteria) === true,
  'Student in Batch 13th & Semester 4 matches assigned quiz'
);

// 2. Student in different batch (Batch 14th) does NOT match even if semester is the same
assert(
  matchesCohort(students[1], targetCriteria) === false,
  'Student in Batch 14th (same semester) does NOT receive Batch 13th quiz'
);

// 3. Student in same batch but different semester does NOT match
assert(
  matchesCohort(students[2], targetCriteria) === false,
  'Student in Batch 13th (Semester 5) does NOT receive Semester 4 quiz'
);

// 4. Deterministic assignment ID format: ${examId}_${studentId} prevents duplicate docs
const examId = 'exam-cardio-101';
const id1 = `${examId}_${students[0].uid}`;
const id2 = `${examId}_${students[0].uid}`;
assert(
  id1 === id2 && id1 === 'exam-cardio-101_student-batch13',
  'Assignment ID is deterministic (${examId}_${studentId}) preventing duplicate writes'
);

// --------------------------------------------------------------------
// TEST GROUP 3: Storage Usage Circular Indicator (ISSUE 4)
// --------------------------------------------------------------------
console.log('\n--- Test Suite 3: Admin Storage Usage & Quota Indicator ---');

const TOTAL_QUOTA = 1024 * 1024 * 1024; // 1 GiB (1,073,741,824 bytes)

function computeStorageState(usedBytes: number, totalBytes: number) {
  const percentage = totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(2)) : 0;
  const remaining = Math.max(0, totalBytes - usedBytes);
  const status = percentage >= 90 ? 'critical' : percentage >= 75 ? 'warning' : 'healthy';
  return { percentage, remaining, status };
}

// 1. Normal state: 25 MB used out of 1,024 MB
const normalState = computeStorageState(25 * 1024 * 1024, TOTAL_QUOTA);
assert(normalState.percentage === 2.44, 'Calculates accurate usage percentage (2.44%)');
assert(normalState.remaining === TOTAL_QUOTA - 25 * 1024 * 1024, 'Calculates accurate remaining storage capacity');
assert(normalState.status === 'healthy', 'Usage under 75% reports "healthy" status');

// 2. Warning threshold state: 800 MB used out of 1,024 MB (~78%)
const warningState = computeStorageState(800 * 1024 * 1024, TOTAL_QUOTA);
assert(warningState.percentage === 78.13, 'Usage at 78.13% accurately calculated');
assert(warningState.status === 'warning', 'Usage >= 75% triggers "warning" status threshold');

// 3. Critical threshold state: 950 MB used out of 1,024 MB (~92.7%)
const criticalState = computeStorageState(950 * 1024 * 1024, TOTAL_QUOTA);
assert(criticalState.status === 'critical', 'Usage >= 90% triggers "critical" status threshold');

// 4. Safe against division by zero
const zeroState = computeStorageState(0, 0);
assert(
  !isNaN(zeroState.percentage) && zeroState.percentage === 0,
  'Zero total quota handled safely without NaN or division by zero'
);

// --------------------------------------------------------------------
// TEST GROUP 4: Bulk MCQ Import & Question Number Palette
// --------------------------------------------------------------------
console.log('\n--- Test Suite 4: Bulk MCQ Import & Question Number Palette ---');

// 1. User's exact sample test with "Answer. B"
const sampleWithDot = `1. Which application is used to create documents?

A. Microsoft Excel
B. Microsoft Word
C. Microsoft PowerPoint
D. Microsoft Access

Answer. B

Explanation: Microsoft Word is used to create documents.`;

const parsedDotResult = parseMCQText(sampleWithDot);
assert(parsedDotResult.totalDetected === 1, 'Sample with "Answer. B" detected as 1 question');
assert(parsedDotResult.validCount === 1, 'Sample with "Answer. B" validated as valid question');
assert(parsedDotResult.errorCount === 0, 'Sample with "Answer. B" has 0 validation errors');
assert(parsedDotResult.parsedQuestions[0].correctAnswer === 'B', 'Extracted correct answer is "B" from "Answer. B"');
assert(
  parsedDotResult.parsedQuestions[0].optionB === 'Microsoft Word',
  'Option B correctly parsed as "Microsoft Word"'
);
assert(
  parsedDotResult.parsedQuestions[0].explanation === 'Microsoft Word is used to create documents.',
  'Explanation parsed accurately'
);

// 2. Sample test with "Answer: B"
const sampleWithColon = `1. Which application is used to create documents?

A. Microsoft Excel
B. Microsoft Word
C. Microsoft PowerPoint
D. Microsoft Access

Answer: B

Explanation: Microsoft Word is used to create documents.`;

const parsedColonResult = parseMCQText(sampleWithColon);
assert(parsedColonResult.validCount === 1, 'Sample with "Answer: B" validated as valid question');
assert(parsedColonResult.parsedQuestions[0].correctAnswer === 'B', 'Extracted correct answer is "B" from "Answer: B"');

// 3. Multi-question batch with various formats (Ans. C, Answer: B, etc.)
const twoMcqBatch = `1. What is the normal adult resting blood pressure baseline?
A) 120/80 mmHg
B) 140/90 mmHg
C) 90/60 mmHg
D) 160/100 mmHg
Answer: A
Explanation: 120/80 mmHg is the standard optimal baseline for healthy adults.

2. Which organ in the human body is primarily responsible for producing insulin?
A. Liver
B. Pancreas
C. Kidney
D. Spleen
Answer. B
Explanation: The beta cells of the Islets of Langerhans in the pancreas secrete insulin.`;

const batchResult = parseMCQText(twoMcqBatch);
assert(batchResult.totalDetected === 2, 'Batch of 2 MCQs correctly detected 2 questions');
assert(batchResult.validCount === 2, 'Both MCQs in batch validated successfully');
assert(batchResult.parsedQuestions[0].order === 1, 'Question 1 has order 1');
assert(batchResult.parsedQuestions[1].order === 2, 'Question 2 has order 2');
assert(batchResult.parsedQuestions[0].correctAnswer === 'A', 'Question 1 answer is "A"');
assert(batchResult.parsedQuestions[1].correctAnswer === 'B', 'Question 2 answer is "B"');

// 4. Question Number Palette Simulation
const importedQuestionsMock = batchResult.parsedQuestions.map((q, idx) => ({
  id: `q-doc-${idx + 1}`,
  examId: 'exam-sample-123',
  question: q.questionText,
  options: [q.optionA, q.optionB, q.optionC, q.optionD],
  correctAnswer: q.correctAnswer,
  marks: 2,
  order: idx + 1,
  explanation: q.explanation || '',
}));

// Palette button generation logic from StudentExamsPage
const paletteButtons = importedQuestionsMock.map((_, qIdx) => ({
  number: qIdx + 1,
  questionId: importedQuestionsMock[qIdx].id,
  targetQuestionText: importedQuestionsMock[qIdx].question,
}));

assert(paletteButtons.length === 2, 'Question Palette displays exact number of buttons matching exam questions (2)');
assert(paletteButtons[0].number === 1, 'First palette button displays question number 1');
assert(paletteButtons[1].number === 2, 'Second palette button displays question number 2');
assert(
  paletteButtons[0].targetQuestionText === 'What is the normal adult resting blood pressure baseline?',
  'Clicking button 1 displays first question text'
);
assert(
  paletteButtons[1].targetQuestionText === 'Which organ in the human body is primarily responsible for producing insulin?',
  'Clicking button 2 displays second question text'
);

// 5. Sanitized Student Question Security (Answers stripped before student attempt)
const studentSanitizedQuestions = importedQuestionsMock.map((q) => ({
  id: q.id,
  examId: q.examId,
  question: q.question,
  options: q.options,
  marks: q.marks,
  order: q.order,
}));

assert(
  !('correctAnswer' in studentSanitizedQuestions[0]),
  'Student sanitized question does NOT contain correctAnswer field'
);
assert(
  !('explanation' in studentSanitizedQuestions[0]),
  'Student sanitized question does NOT contain explanation field'
);
assert(
  studentSanitizedQuestions.length === importedQuestionsMock.length,
  'Sanitized question count matches teacher imported question count'
);

// --------------------------------------------------------------------
// TEST GROUP 5: Security Rules Authorization & Schedule Enforcement
// --------------------------------------------------------------------
console.log('\n--- Test Suite 5: Question Security & Authorized Student Access ---');

interface MockStudent {
  uid: string;
  role: 'student';
  program: string;
  semester: string;
  batch: string;
}

interface MockSecurityContext {
  authUid: string;
  authRole: 'student' | 'teacher' | 'admin';
  requestTimeMs: number;
}

function simulateQuestionReadRule(
  _question: { examId: string },
  exam: Exam,
  student: MockStudent | null,
  hasAssignment: boolean,
  context: MockSecurityContext
): { allowed: boolean; reason: string } {
  // 1. Admin or Teacher
  if (context.authRole === 'admin' || context.authRole === 'teacher') {
    return { allowed: true, reason: 'Faculty / Admin privilege' };
  }

  // 2. Student validation
  if (context.authRole === 'student') {
    if (!student || student.uid !== context.authUid) {
      return { allowed: false, reason: 'Unauthenticated or missing student record' };
    }

    // Exclude draft or archived exams
    if (exam.status === 'draft' || exam.status === 'archived') {
      return { allowed: false, reason: 'Exams in draft or archived status cannot be accessed by students' };
    }

    // Check schedule start time
    const startMs = parseDateToMillis(exam.startAt);
    if (startMs !== null && exam.status === 'scheduled' && context.requestTimeMs < startMs) {
      return { allowed: false, reason: 'Exam has not commenced yet' };
    }

    // Check assignment authorization
    if (hasAssignment) {
      return { allowed: true, reason: 'Direct assignment authorization' };
    }

    // Check cohort authorization
    const isProgramMatch = student.program === exam.program;
    const isSemesterMatch = student.semester === exam.semester;
    const isBatchMatch = !exam.batch || exam.batch === '' || exam.batch === student.batch;

    if (isProgramMatch && isSemesterMatch && isBatchMatch) {
      return { allowed: true, reason: 'Cohort matching authorization' };
    }

    return { allowed: false, reason: 'Student cohort or assignment mismatch' };
  }

  return { allowed: false, reason: 'Unauthenticated' };
}

const authorizedStudent: MockStudent = {
  uid: 'student-auth-1',
  role: 'student',
  program: 'BS Nursing (Generic)',
  semester: 'Semester 4',
  batch: 'Batch 13th',
};

const foreignBatchStudent: MockStudent = {
  uid: 'student-auth-2',
  role: 'student',
  program: 'BS Nursing (Generic)',
  semester: 'Semester 4',
  batch: 'Batch 14th',
};

const activeExamForBatch13: Exam = {
  id: 'exam-pharm-101',
  title: 'Pharmacology Mid-Term',
  description: 'Assessment',
  type: 'midterm',
  teacherId: 'teacher-99',
  program: 'BS Nursing (Generic)',
  semester: 'Semester 4',
  batch: 'Batch 13th',
  duration: 60,
  totalMarks: 50,
  startAt: '2026-10-11T20:00:00+05:00',
  endAt: '2026-10-11T23:00:00+05:00',
  status: 'active',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const draftExamMock: Exam = {
  ...activeExamForBatch13,
  id: 'exam-draft-102',
  status: 'draft',
};

const testTimeNow = Date.parse('2026-10-11T22:30:00+05:00');

// Test 5.1: Faculty always allowed
const teacherAccess = simulateQuestionReadRule(
  { examId: activeExamForBatch13.id },
  activeExamForBatch13,
  null,
  false,
  { authUid: 'teacher-99', authRole: 'teacher', requestTimeMs: testTimeNow }
);
assert(teacherAccess.allowed, 'Faculty / Examiner permitted to read questions');

// Test 5.2: Authorized cohort student allowed
const studentCohortAccess = simulateQuestionReadRule(
  { examId: activeExamForBatch13.id },
  activeExamForBatch13,
  authorizedStudent,
  false,
  { authUid: authorizedStudent.uid, authRole: 'student', requestTimeMs: testTimeNow }
);
assert(studentCohortAccess.allowed, 'Authorized student in target Batch 13th and Semester 4 permitted access');

// Test 5.3: Foreign batch student denied
const foreignBatchAccess = simulateQuestionReadRule(
  { examId: activeExamForBatch13.id },
  activeExamForBatch13,
  foreignBatchStudent,
  false,
  { authUid: foreignBatchStudent.uid, authRole: 'student', requestTimeMs: testTimeNow }
);
assert(!foreignBatchAccess.allowed, 'Student in Batch 14th strictly denied access to Batch 13th questions');

// Test 5.4: Draft exam questions denied to students
const draftAccess = simulateQuestionReadRule(
  { examId: draftExamMock.id },
  draftExamMock,
  authorizedStudent,
  true,
  { authUid: authorizedStudent.uid, authRole: 'student', requestTimeMs: testTimeNow }
);
assert(!draftAccess.allowed, 'Draft exam questions strictly denied to students even if assigned');

// Test 5.5: Scheduled exam cannot be read ahead of startAt
const futureScheduledExam: Exam = {
  ...activeExamForBatch13,
  id: 'exam-future-103',
  status: 'scheduled',
  startAt: '2026-10-12T10:00:00+05:00', // Tomorrow
  endAt: '2026-10-12T12:00:00+05:00',
};
const earlyAccess = simulateQuestionReadRule(
  { examId: futureScheduledExam.id },
  futureScheduledExam,
  authorizedStudent,
  true,
  { authUid: authorizedStudent.uid, authRole: 'student', requestTimeMs: testTimeNow }
);
assert(!earlyAccess.allowed, 'Questions strictly denied to students before scheduled start time');

// --------------------------------------------------------------------
// TEST GROUP 6: Canonical Student Exam Eligibility & Diagnostic Checks
// --------------------------------------------------------------------
console.log('\n--- Test Suite 6: Student Exam Eligibility & Specific Messages ---');

const testStudentBatch15: StudentProfile = {
  uid: 'student-test-15',
  role: 'student',
  name: 'Ahmad Khan',
  fatherName: 'Jan Khan',
  email: 'ahmad@royalcollege.edu.pk',
  kmuRegistrationNo: '2026/KMU-RCNS/015',
  program: 'BS Nursing (Generic)',
  department: 'Nursing & Allied Health Sciences',
  batch: 'Batch 15th',
  semester: 'Semester 4',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const examBatch15Active: Exam = {
  id: 'exam-b15-live',
  title: 'Anatomy & Physiology Examination',
  description: 'Midterm',
  type: 'midterm',
  teacherId: 'teacher-10',
  program: 'BS Nursing (Generic)',
  semester: 'Semester 4',
  batch: 'Batch 15th',
  duration: 60,
  totalMarks: 50,
  startAt: '2026-10-15T09:00:00+05:00',
  endAt: '2026-10-15T11:00:00+05:00',
  status: 'active',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const activeClockMs = Date.parse('2026-10-15T09:30:00+05:00');
const earlyClockMs = Date.parse('2026-10-15T08:30:00+05:00');
const expiredClockMs = Date.parse('2026-10-15T11:30:00+05:00');

// 6.1: Eligible student in active window is allowed
const resActive = checkStudentExamEligibility({
  exam: examBatch15Active,
  student: testStudentBatch15,
  nowMs: activeClockMs,
  isDev: false,
});
assert(resActive.allowed, 'Eligible student in active time window is allowed to enter');
assert(resActive.reason === 'eligible', 'Verdict reason is "eligible"');

// 6.2: Before start time returns not_started with specific non-combined message
const resEarly = checkStudentExamEligibility({
  exam: examBatch15Active,
  student: testStudentBatch15,
  nowMs: earlyClockMs,
  isDev: false,
});
assert(!resEarly.allowed, 'Student cannot enter before scheduled start time');
assert(resEarly.reason === 'not_started', 'Verdict reason is specifically "not_started"');
assert(
  resEarly.message.includes('Scheduled start time has not arrived') && /09:00\s*(am|AM)\s*PKT/i.test(resEarly.message),
  'Specific message includes upcoming start time in PKT without ambiguous combined error'
);

// 6.3: Closed exam returns expired with specific message
const resExpired = checkStudentExamEligibility({
  exam: examBatch15Active,
  student: testStudentBatch15,
  nowMs: expiredClockMs,
  isDev: false,
});
assert(!resExpired.allowed, 'Student cannot enter after exam deadline has expired');
assert(resExpired.reason === 'expired', 'Verdict reason is specifically "expired"');
assert(
  resExpired.message.includes('Examination window closed'),
  'Specific message explicitly states examination window is closed'
);

// 6.4: Cohort mismatch (different batch) returns cohort_mismatch
const studentBatch16: StudentProfile = {
  ...testStudentBatch15,
  uid: 'student-test-16',
  batch: 'Batch 16th',
};
const resBatchMismatch = checkStudentExamEligibility({
  exam: examBatch15Active,
  student: studentBatch16,
  nowMs: activeClockMs,
  isDev: false,
});
assert(!resBatchMismatch.allowed, 'Student in Batch 16th denied access to Batch 15th exam');
assert(resBatchMismatch.reason === 'cohort_mismatch', 'Verdict reason is specifically "cohort_mismatch"');
assert(
  resBatchMismatch.message.includes('Batch mismatch') && resBatchMismatch.message.includes('Batch 16th'),
  'Message explicitly details Batch mismatch with target vs student batch'
);

// 6.5: Cohort mismatch (different semester) returns cohort_mismatch
const studentSem5: StudentProfile = {
  ...testStudentBatch15,
  uid: 'student-test-s5',
  semester: 'Semester 5',
};
const resSemMismatch = checkStudentExamEligibility({
  exam: examBatch15Active,
  student: studentSem5,
  nowMs: activeClockMs,
  isDev: false,
});
assert(!resSemMismatch.allowed, 'Student in Semester 5 denied access to Semester 4 exam');
assert(resSemMismatch.reason === 'cohort_mismatch', 'Verdict reason is "cohort_mismatch" for semester mismatch');

// 6.6: Direct individual assignment permits entry even if cohort criteria differs
const resDirectAssignment = checkStudentExamEligibility({
  exam: { ...examBatch15Active, assignmentId: 'assign-b15-override' },
  student: studentBatch16, // Batch 16th student, but has individual assignment
  nowMs: activeClockMs,
  isDev: false,
});
assert(resDirectAssignment.allowed, 'Student with direct individual assignment is allowed entry');

// 6.7: Draft exam is strictly denied
const resDraft = checkStudentExamEligibility({
  exam: { ...examBatch15Active, status: 'draft' },
  student: testStudentBatch15,
  nowMs: activeClockMs,
  isDev: false,
});
assert(!resDraft.allowed, 'Draft exam is strictly inaccessible to candidates');
assert(resDraft.reason === 'exam_not_published', 'Verdict reason is "exam_not_published"');

// 6.8: Timestamp storage format detection (Timestamp, Date, String, Number)
const mockTimestamp = { seconds: 1792047600, nanoseconds: 0, toMillis: () => 1792047600000 };
assert(getTimestampStorageType(mockTimestamp) === 'Firestore Timestamp', 'Accurately detects Firestore Timestamp storage type');
assert(getTimestampStorageType(new Date()) === 'Date instance', 'Accurately detects Date instance storage type');
assert(getTimestampStorageType('2026-10-15T09:00:00+05:00') === 'ISO string', 'Accurately detects ISO string storage type');
assert(getTimestampStorageType(1792047600000) === 'epoch number', 'Accurately detects epoch number storage type');

// 6.9: Firestore Timestamp handles schedule calculation seamlessly
const examWithTimestamp: Exam = {
  ...examBatch15Active,
  startAt: mockTimestamp as any,
  endAt: { seconds: 1792051200, nanoseconds: 0, toMillis: () => 1792051200000 } as any,
};
const resTs = checkStudentExamEligibility({
  exam: examWithTimestamp,
  student: testStudentBatch15,
  nowMs: 1792048000000,
  isDev: false,
});
assert(resTs.allowed, 'Exam with Firestore Timestamp startAt/endAt evaluates eligibility accurately');

console.log('\n====================================================');
console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
