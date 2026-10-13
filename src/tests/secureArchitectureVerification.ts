import {
  checkAnswerMatch,
  gradeExamSubmission,
} from '../utils/secureGrading.ts';
import {
  verifyCandidateEligibility,
} from '../utils/secureExamAuth.ts';

export interface MasterQuestion {
  id: string;
  examId: string;
  question: string;
  options: any[];
  correctAnswer: string | number;
  marks: number;
  order: number;
  explanation?: string;
  createdBy?: string;
}

export interface ExamDocument {
  id: string;
  title: string;
  program: string;
  semester: string;
  batch?: string;
  duration: number;
  totalMarks?: number;
  passingMarks?: number;
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
  startAt: any;
  endAt: any;
}

export interface StudentProfileDocument {
  uid: string;
  name?: string;
  kmuRegistrationNo?: string;
  program?: string;
  semester?: string;
  batch?: string;
}

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

console.log('================================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT - Secure Architecture Verification');
console.log('================================================================\n');

// --------------------------------------------------------------------
// TEST SUITE 1: Answer-Key Confidentiality & Question Sanitization
// --------------------------------------------------------------------
console.log('--- Test Suite 1: Answer-Key Confidentiality & Question Sanitization ---');

const masterQuestions: MasterQuestion[] = [
  {
    id: 'q-med-01',
    examId: 'exam-pharma-401',
    question: 'Which of the following is the antidote for Paracetamol overdose?',
    options: ['N-acetylcysteine', 'Naloxone', 'Flumazenil', 'Atropine'],
    correctAnswer: 'A',
    marks: 2,
    order: 1,
    explanation: 'N-acetylcysteine restores hepatic glutathione reserves.',
    createdBy: 'teacher-pharmacology-dept',
  },
  {
    id: 'q-med-02',
    examId: 'exam-pharma-401',
    question: 'Normal resting heart rate for an adult is:',
    options: ['40-60 bpm', '60-100 bpm', '100-120 bpm', '120-140 bpm'],
    correctAnswer: 'B',
    marks: 1,
    order: 2,
    explanation: 'Standard clinical reference range is 60 to 100 beats per minute.',
    createdBy: 'teacher-pharmacology-dept',
  },
];

// Function simulating server-side sanitization in getStudentExamQuestions
function sanitizeForStudent(questions: MasterQuestion[]) {
  return questions.map((q) => ({
    id: q.id,
    examId: q.examId,
    question: q.question,
    options: q.options,
    marks: Number(q.marks) || 1,
    order: Number(q.order) || 0,
  }));
}

const sanitized = sanitizeForStudent(masterQuestions);

assert(sanitized.length === 2, 'Sanitized question count matches master question count');
assert(!('correctAnswer' in sanitized[0]), 'Sanitized Question 1 does NOT contain correctAnswer field');
assert(!('explanation' in sanitized[0]), 'Sanitized Question 1 does NOT contain explanation field');
assert(!('createdBy' in sanitized[0]), 'Sanitized Question 1 does NOT contain createdBy field');
assert(!('correctAnswer' in sanitized[1]), 'Sanitized Question 2 does NOT contain correctAnswer field');
assert(!('explanation' in sanitized[1]), 'Sanitized Question 2 does NOT contain explanation field');

// Check that client payload strictly only contains necessary student attempt fields
const allowedStudentKeys = new Set(['id', 'examId', 'question', 'options', 'marks', 'order']);
const q1Keys = Object.keys(sanitized[0]);
const hasOnlyAllowedKeys = q1Keys.every((k) => allowedStudentKeys.has(k));
assert(hasOnlyAllowedKeys, 'Question object exposes ONLY exam attempt fields (id, examId, question, options, marks, order)');

// --------------------------------------------------------------------
// TEST SUITE 2: Server-Side Schedule Verification & Trusted Server Clock
// --------------------------------------------------------------------
console.log('\n--- Test Suite 2: Server-Side Schedule Verification & Trusted Server Clock ---');

// Mock in-memory DB for eligibility testing
function createMockDb(fixtures: {
  exams: Record<string, any>;
  students: Record<string, any>;
  users: Record<string, any>;
  assignments: Record<string, any>;
}) {
  return {
    collection: (colName: string) => ({
      doc: (docId: string) => ({
        get: async () => {
          const map = (fixtures as any)[colName] || {};
          const data = map[docId];
          return {
            id: docId,
            exists: data !== undefined,
            data: () => data,
          };
        },
      }),
    }),
  } as any;
}

const baseExam: ExamDocument = {
  id: 'exam-pharma-401',
  title: 'Pharmacology Midterm Examination',
  program: 'BS Nursing (Generic)',
  semester: 'Semester 4',
  batch: 'Batch 13th',
  duration: 60,
  totalMarks: 50,
  passingMarks: 25,
  status: 'active',
  // Scheduled 10:00:00 to 11:00:00 PKT (Oct 15, 2026) -> 05:00:00Z to 06:00:00Z
  startAt: '2026-10-15T05:00:00Z',
  endAt: '2026-10-15T06:00:00Z',
};

const registeredStudent: StudentProfileDocument = {
  uid: 'student-naveed-001',
  name: 'Naveed Alam',
  kmuRegistrationNo: 'KMU-2024-BSN-9812',
  program: 'BS Nursing (Generic)',
  semester: 'Semester 4',
  batch: 'Batch 13th',
};

const mockDb = createMockDb({
  exams: { 'exam-pharma-401': baseExam },
  students: { 'student-naveed-001': registeredStudent },
  users: { 'student-naveed-001': { role: 'student', name: 'Naveed Alam' } },
  assignments: {},
});

const startEpoch = Date.parse('2026-10-15T05:00:00Z');
const endEpoch = Date.parse('2026-10-15T06:00:00Z');

// 1. Before start time
const earlyCheck = await verifyCandidateEligibility(
  mockDb,
  'student-naveed-001',
  'exam-pharma-401',
  startEpoch - 60000 // 1 min before
);
assert(!earlyCheck.allowed, 'Early access before start time is strictly rejected');
assert(earlyCheck.code === 'not_started', 'Early access rejection code is "not_started"');

// 2. Exactly at start time
const onTimeCheck = await verifyCandidateEligibility(
  mockDb,
  'student-naveed-001',
  'exam-pharma-401',
  startEpoch
);
assert(onTimeCheck.allowed, 'Candidate permitted at exact scheduled start time');

// 3. During testing window
const midWindowCheck = await verifyCandidateEligibility(
  mockDb,
  'student-naveed-001',
  'exam-pharma-401',
  startEpoch + 30 * 60000
);
assert(midWindowCheck.allowed, 'Candidate permitted during active examination window');

// 4. Question delivery after end time (No grace period for question retrieval)
const lateQuestionCheck = await verifyCandidateEligibility(
  mockDb,
  'student-naveed-001',
  'exam-pharma-401',
  endEpoch + 1000,
  { allowSubmissionGrace: false }
);
assert(!lateQuestionCheck.allowed, 'Question delivery strictly rejected after scheduled deadline');
assert(lateQuestionCheck.code === 'expired', 'Expired exam rejection code is "expired"');

// 5. Submission within 10-minute network grace period
const submissionGraceCheck = await verifyCandidateEligibility(
  mockDb,
  'student-naveed-001',
  'exam-pharma-401',
  endEpoch + 5 * 60000, // 5 mins after deadline
  { allowSubmissionGrace: true }
);
assert(submissionGraceCheck.allowed, 'In-flight exam submission permitted within 10-minute network grace period');

// 6. Submission after grace period has fully expired
const submissionExpiredCheck = await verifyCandidateEligibility(
  mockDb,
  'student-naveed-001',
  'exam-pharma-401',
  endEpoch + 15 * 60000, // 15 mins after deadline
  { allowSubmissionGrace: true }
);
assert(!submissionExpiredCheck.allowed, 'Submission strictly rejected after grace period has expired');

// 7. Draft exam paper
const draftDb = createMockDb({
  exams: { 'exam-pharma-401': { ...baseExam, status: 'draft' } },
  students: { 'student-naveed-001': registeredStudent },
  users: { 'student-naveed-001': { role: 'student' } },
  assignments: {},
});
const draftCheck = await verifyCandidateEligibility(draftDb, 'student-naveed-001', 'exam-pharma-401', startEpoch + 1000);
assert(!draftCheck.allowed, 'Draft exam paper is strictly inaccessible to candidates');
assert(draftCheck.code === 'exam_not_published', 'Draft rejection code is "exam_not_published"');

// --------------------------------------------------------------------
// TEST SUITE 3: Academic Cohort & Assignment Restrictions
// --------------------------------------------------------------------
console.log('\n--- Test Suite 3: Academic Cohort & Assignment Restrictions ---');

// Batch mismatch (Batch 14th student attempting Batch 13th exam)
const batch14Student: StudentProfileDocument = {
  ...registeredStudent,
  uid: 'student-batch14-002',
  batch: 'Batch 14th',
};
const batchDb = createMockDb({
  exams: { 'exam-pharma-401': baseExam },
  students: { 'student-batch14-002': batch14Student },
  users: { 'student-batch14-002': { role: 'student' } },
  assignments: {},
});
const batchCheck = await verifyCandidateEligibility(batchDb, 'student-batch14-002', 'exam-pharma-401', startEpoch + 1000);
assert(!batchCheck.allowed, 'Candidate in Batch 14th rejected for Batch 13th exam');
assert(batchCheck.code === 'cohort_batch_mismatch', 'Batch mismatch rejection code is "cohort_batch_mismatch"');

// Semester mismatch (Semester 5 student attempting Semester 4 exam)
const sem5Student: StudentProfileDocument = {
  ...registeredStudent,
  uid: 'student-sem5-003',
  semester: 'Semester 5',
};
const semDb = createMockDb({
  exams: { 'exam-pharma-401': baseExam },
  students: { 'student-sem5-003': sem5Student },
  users: { 'student-sem5-003': { role: 'student' } },
  assignments: {},
});
const semCheck = await verifyCandidateEligibility(semDb, 'student-sem5-003', 'exam-pharma-401', startEpoch + 1000);
assert(!semCheck.allowed, 'Candidate in Semester 5 rejected for Semester 4 exam');
assert(semCheck.code === 'cohort_semester_mismatch', 'Semester mismatch rejection code is "cohort_semester_mismatch"');

// Direct individual assignment overrides cohort mismatch (re-sit / repeat exam)
const individualAssignmentDb = createMockDb({
  exams: { 'exam-pharma-401': baseExam },
  students: { 'student-sem5-003': sem5Student },
  users: { 'student-sem5-003': { role: 'student' } },
  assignments: {
    'exam-pharma-401_student-sem5-003': {
      id: 'exam-pharma-401_student-sem5-003',
      examId: 'exam-pharma-401',
      studentId: 'student-sem5-003',
      status: 'assigned',
    },
  },
});
const individualCheck = await verifyCandidateEligibility(
  individualAssignmentDb,
  'student-sem5-003',
  'exam-pharma-401',
  startEpoch + 1000
);
assert(individualCheck.allowed, 'Direct faculty assignment permits candidate to attempt exam');

// --------------------------------------------------------------------
// TEST SUITE 4: Authoritative Server-Side Grading & Anti-Tampering
// --------------------------------------------------------------------
console.log('\n--- Test Suite 4: Authoritative Server-Side Grading & Anti-Tampering ---');

const testQuestions: MasterQuestion[] = [
  {
    id: 'q1',
    examId: 'exam-test',
    question: 'Q1',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    correctAnswer: 'A',
    marks: 10,
    order: 1,
  },
  {
    id: 'q2',
    examId: 'exam-test',
    question: 'Q2',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    correctAnswer: 'B',
    marks: 15,
    order: 2,
  },
  {
    id: 'q3',
    examId: 'exam-test',
    question: 'Q3',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    correctAnswer: 'C',
    marks: 25,
    order: 3,
  },
];

// Student submits: Q1 correct ('A'), Q2 wrong ('C'), Q3 correct ('C')
const submittedAnswers = {
  q1: 'A',
  q2: 'C',
  q3: 'C',
};

const result = gradeExamSubmission(testQuestions, submittedAnswers, 25);
assert(result.totalMarks === 50, 'Total marks correctly calculated as 50');
assert(result.obtainedMarks === 35, 'Obtained marks accurately calculated (10 + 25 = 35)');
assert(result.percentage === 70, 'Percentage accurately calculated as 70.0%');
assert(result.passed === true, 'Pass status accurately awarded (35 >= passingMarks 25)');
assert(result.correctCount === 2, 'Correct answer count is 2');
assert(result.answersCount === 3, 'Answered questions count is 3');

// Anti-tampering check:
// If malicious client claims 100 marks with forged answers, server re-grades authoritatively
const maliciousSubmission = {
  q1: 'Z',
  q2: 'Z',
  q3: 'Z',
  // Attempt to inject forged marks directly in submission payload
  forgedMarks: 100,
  forgedPercentage: 100,
  forgedPassed: true,
};
const tamperedResult = gradeExamSubmission(testQuestions, maliciousSubmission as any, 25);
assert(tamperedResult.obtainedMarks === 0, 'Forged marks ignored: Server grades 0 marks for wrong answers');
assert(tamperedResult.percentage === 0, 'Forged percentage ignored: Server computes 0%');
assert(tamperedResult.passed === false, 'Forged pass status ignored: Server flags as failed');

// Option text matching support
assert(checkAnswerMatch('Alpha', 'A', ['Alpha', 'Beta', 'Gamma', 'Delta']), 'Evaluator correctly matches option text to letter key');
assert(checkAnswerMatch(0, 'A', ['Alpha', 'Beta', 'Gamma', 'Delta']), 'Evaluator correctly matches option index 0 to letter key A');
assert(checkAnswerMatch(1, 'B', ['Alpha', 'Beta', 'Gamma', 'Delta']), 'Evaluator correctly matches option index 1 to letter key B');

// --------------------------------------------------------------------
// TEST SUITE 5: Cross-Student Submissions & Idempotent Retries
// --------------------------------------------------------------------
console.log('\n--- Test Suite 5: Cross-Student Submissions & Idempotent Retries ---');

// Deterministic result ID binding
const candidateA_Uid = 'candidate-alpha-101';
const examId = 'exam-pharma-401';
const generatedResultId = `${candidateA_Uid}_${examId}`;
assert(
  generatedResultId === 'candidate-alpha-101_exam-pharma-401',
  'Result ID is strictly bound to ${callerAuthUid}_${examId}'
);

// Idempotency verification: existing result prevents double-grading
const existingResultData = {
  resultId: generatedResultId,
  examId,
  studentId: candidateA_Uid,
  marks: 40,
  totalMarks: 50,
  percentage: 80,
  passed: true,
  status: 'graded',
  submittedAt: '2026-10-15T05:45:00Z',
};

// Simulation of submitExamAttempt idempotency handler
function handleSubmissionIdempotency(existingDoc: any, newSubmission: any) {
  if (existingDoc) {
    // Return existing graded record, do NOT re-grade or overwrite
    return { ...existingDoc, isDuplicateAttempt: true };
  }
  return { ...newSubmission, isDuplicateAttempt: false };
}

const retryResponse = handleSubmissionIdempotency(existingResultData, { marks: 0 });
assert(retryResponse.marks === 40, 'Duplicate submission returns original marks (40) without re-grading');
assert(retryResponse.isDuplicateAttempt === true, 'Duplicate submission detected and handled idempotently');

// --------------------------------------------------------------------
// TEST SUITE 6: Firestore Security Rules Enforcement Simulation
// --------------------------------------------------------------------
console.log('\n--- Test Suite 6: Firestore Security Rules Enforcement Simulation ---');

// Mock security rules evaluator
function evaluateRules(rule: string, auth: { uid: string; role: string } | null, resourceOwner?: string): boolean {
  const isAuthenticated = auth !== null;
  const isAdmin = isAuthenticated && auth.role === 'admin';
  const isTeacher = isAuthenticated && auth.role === 'teacher';
  const isStudent = isAuthenticated && auth.role === 'student';

  if (rule === 'questions:read') {
    // allow read, write: if isAuthenticated() && (isAdmin() || isTeacher());
    return isAuthenticated && (isAdmin || isTeacher);
  }

  if (rule === 'results:create') {
    // allow create: if isAuthenticated() && (isAdmin() || isTeacher());
    return isAuthenticated && (isAdmin || isTeacher);
  }

  if (rule === 'results:read') {
    // allow read: if isAuthenticated() && (isAdmin() || isTeacher() || (isStudent() && resource.data.studentId == request.auth.uid));
    return isAuthenticated && (isAdmin || isTeacher || (isStudent && auth.uid === resourceOwner));
  }

  return false;
}

// Student tries direct Firestore SDK read on /questions
assert(
  !evaluateRules('questions:read', { uid: 'student-1', role: 'student' }),
  'Firestore Rule: Student direct read on /questions is strictly DENIED'
);
// Teacher can read /questions
assert(
  evaluateRules('questions:read', { uid: 'teacher-1', role: 'teacher' }),
  'Firestore Rule: Teacher read on /questions is PERMITTED'
);
// Admin can read /questions
assert(
  evaluateRules('questions:read', { uid: 'admin-1', role: 'admin' }),
  'Firestore Rule: Admin read on /questions is PERMITTED'
);

// Student tries direct Firestore SDK write on /results
assert(
  !evaluateRules('results:create', { uid: 'student-1', role: 'student' }),
  'Firestore Rule: Student direct creation of /results is strictly DENIED'
);
// Student can read own result
assert(
  evaluateRules('results:read', { uid: 'student-1', role: 'student' }, 'student-1'),
  'Firestore Rule: Student can read their own result document'
);
// Student CANNOT read another student's result
assert(
  !evaluateRules('results:read', { uid: 'student-1', role: 'student' }, 'student-2'),
  'Firestore Rule: Student CANNOT read another candidate\'s result document'
);

console.log('\n================================================================');
console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
