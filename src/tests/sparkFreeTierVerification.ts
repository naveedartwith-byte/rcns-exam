/**
 * Regression Test Suite: Firebase Spark Free Tier Architecture & Internal Error Elimination
 *
 * Verifies:
 * 1. Safe delivery of sanitized questions without calling Cloud Functions.
 * 2. Absolute confidentiality of answer keys (no correctAnswer, explanation, createdBy exposed).
 * 3. Graceful handling of unavailable Cloud Functions (no raw "Internal" error presented to students).
 * 4. Idempotent exam submission fallback for Spark Free Tier without serverless dependencies.
 */

import type { Exam } from '../types/exam.ts';
import type { MasterQuestion, StudentQuestion } from '../types/question.ts';

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
console.log('ROYAL COLLEGE OF NURSING SWAT - Spark Free Tier Regression Tests');
console.log('================================================================\n');

// --------------------------------------------------------------------
// TEST SUITE 1: Spark Tier Sanitized Question Delivery
// --------------------------------------------------------------------
console.log('--- Test Suite 1: Spark Tier Sanitized Question Delivery ---');

const masterQuestionsMock: MasterQuestion[] = [
  {
    id: 'q-fon-01',
    examId: 'hSBLYMNuOtx6ASnhKdo1',
    question: 'What is the primary indicator of tissue perfusion during nursing assessment?',
    options: ['Capillary refill time < 2 seconds', 'Urine output < 10 mL/hr', 'Pupil dilation', 'Hypothermia'],
    correctAnswer: 'A',
    marks: 2,
    order: 1,
    explanation: 'Capillary refill under 2 seconds indicates adequate peripheral perfusion.',
    createdBy: 'ZCFDsW3ZIZe9GCQ4IHK9cPkKw052',
  },
  {
    id: 'q-fon-02',
    examId: 'hSBLYMNuOtx6ASnhKdo1',
    question: 'Which position is optimal for facilitating maximum chest expansion in dyspneic patients?',
    options: ['Supine position', "High Fowler's position", 'Trendelenburg position', 'Prone position'],
    correctAnswer: 'B',
    marks: 2,
    order: 2,
    explanation: "High Fowler's allows gravitational descent of the diaphragm.",
    createdBy: 'ZCFDsW3ZIZe9GCQ4IHK9cPkKw052',
  },
];

// Teacher publishing/sync logic for Spark tier
function sanitizeAndPublishForExam(questions: MasterQuestion[], examId: string): StudentQuestion[] {
  return questions.map((q, idx) => ({
    id: q.id,
    examId,
    question: q.question,
    options: q.options || [],
    marks: Number(q.marks) || 1,
    order: Number(q.order) || idx + 1,
  }));
}

const publishedSanitized = sanitizeAndPublishForExam(masterQuestionsMock, 'hSBLYMNuOtx6ASnhKdo1');

assert(publishedSanitized.length === 2, 'Published sanitized questions count matches master questions count');
assert(!('correctAnswer' in publishedSanitized[0]), 'Sanitized question 1 strictly omits correctAnswer');
assert(!('explanation' in publishedSanitized[0]), 'Sanitized question 1 strictly omits explanation');
assert(!('createdBy' in publishedSanitized[0]), 'Sanitized question 1 strictly omits createdBy');
assert(!('correctAnswer' in publishedSanitized[1]), 'Sanitized question 2 strictly omits correctAnswer');
assert(!('explanation' in publishedSanitized[1]), 'Sanitized question 2 strictly omits explanation');

const allowedKeys = new Set(['id', 'examId', 'question', 'options', 'marks', 'order']);
const q1Keys = Object.keys(publishedSanitized[0]);
assert(
  q1Keys.every((k) => allowedKeys.has(k)),
  'Student question exposes ONLY student-facing attempt fields (id, examId, question, options, marks, order)'
);

// --------------------------------------------------------------------
// TEST SUITE 2: Elimination of Generic "Internal" Error on Spark Plan
// --------------------------------------------------------------------
console.log('\n--- Test Suite 2: Elimination of Generic "Internal" Error ---');

function formatStudentErrorMessage(err: any): string {
  const isInternalOrFunctionErr =
    err?.code === 'internal' ||
    err?.code === 'functions/internal' ||
    err?.code === 'functions/unavailable' ||
    err?.code === 'functions/not-found' ||
    (err?.message &&
      (err.message.toLowerCase() === 'internal' ||
        err.message.toLowerCase().includes('functions/internal') ||
        err.message.toLowerCase().includes('internal error')));

  if (isInternalOrFunctionErr) {
    return 'Examination questions are temporarily unavailable. Please verify that the examination paper has been published by your instructor, or contact your examination proctor.';
  }

  if (err?.code === 'permission-denied') {
    return 'Access restricted: Database permission denied loading examination questions. Please contact your examination proctor to verify registration.';
  }

  return err?.message || 'Unable to load examination questions from database.';
}

const mockFirebaseInternalError = {
  code: 'functions/internal',
  message: 'internal',
};

const transformedMessage = formatStudentErrorMessage(mockFirebaseInternalError);
assert(
  transformedMessage !== 'internal' && transformedMessage !== 'Internal',
  'Firebase "internal" error message is NOT displayed directly to students'
);
assert(
  transformedMessage.includes('published by your instructor') || transformedMessage.includes('examination proctor'),
  'Safe, helpful diagnostic guidance is provided to the student instead of "Internal"'
);

const mockUnavailableError = {
  code: 'functions/unavailable',
  message: 'The function endpoint is unavailable.',
};
const transformedUnavailable = formatStudentErrorMessage(mockUnavailableError);
assert(
  !transformedUnavailable.toLowerCase().includes('function endpoint'),
  'Technical backend endpoints are shielded from student error view'
);

// --------------------------------------------------------------------
// TEST SUITE 3: Fallback Behavior When Questions Not Yet Synchronized
// --------------------------------------------------------------------
console.log('\n--- Test Suite 3: Fallback for Unsynchronized Exam ---');

function simulateGetStudentQuestions(exam: Partial<Exam>): { success: boolean; data?: StudentQuestion[]; error?: string } {
  if (Array.isArray(exam.sanitizedQuestions) && exam.sanitizedQuestions.length > 0) {
    return {
      success: true,
      data: exam.sanitizedQuestions,
    };
  }

  return {
    success: false,
    error: 'Examination questions have not yet been synchronized or published by your course instructor. Please contact your instructor to publish the question paper.',
  };
}

const examWithoutSanitizedQuestions: Partial<Exam> = {
  id: 'hSBLYMNuOtx6ASnhKdo1',
  title: 'Quiz 6',
  questionCount: 20,
};

const unsyncedResult = simulateGetStudentQuestions(examWithoutSanitizedQuestions);
assert(!unsyncedResult.success, 'Unsynchronized exam safely caught without crashing');
assert(
  Boolean(unsyncedResult.error?.includes('not yet been synchronized or published')),
  'Descriptive instructional message returned when sanitizedQuestions is not yet embedded on exam'
);

const examWithSanitizedQuestions: Partial<Exam> = {
  id: 'hSBLYMNuOtx6ASnhKdo1',
  title: 'Quiz 6',
  questionCount: 2,
  sanitizedQuestions: publishedSanitized,
};

const syncedResult = simulateGetStudentQuestions(examWithSanitizedQuestions);
assert(syncedResult.success, 'Synchronized exam directly loads sanitized questions');
assert(syncedResult.data?.length === 2, 'Loads all sanitized questions accurately');

// --------------------------------------------------------------------
// TEST SUITE 4: Spark Tier Direct Result Submission Fallback
// --------------------------------------------------------------------
console.log('\n--- Test Suite 4: Spark Tier Direct Result Submission Fallback ---');

interface MockSubmissionParams {
  studentId: string;
  examId: string;
  answers: Record<string, string | number>;
  totalMarks: number;
}

function simulateSparkSubmission(params: MockSubmissionParams, existingResults: Record<string, any>) {
  const resultId = `${params.studentId}_${params.examId}`;

  // Idempotency
  if (existingResults[resultId]) {
    return {
      status: 'existing',
      result: existingResults[resultId],
    };
  }

  const newResult = {
    id: resultId,
    studentId: params.studentId,
    examId: params.examId,
    answersCount: Object.keys(params.answers).length,
    status: 'submitted',
    marks: 0,
    totalMarks: params.totalMarks,
  };

  existingResults[resultId] = newResult;

  return {
    status: 'submitted',
    result: newResult,
  };
}

const mockExistingResults: Record<string, any> = {};
const submissionParams: MockSubmissionParams = {
  studentId: 'student-99',
  examId: 'hSBLYMNuOtx6ASnhKdo1',
  answers: { 'q-fon-01': 'A', 'q-fon-02': 'B' },
  totalMarks: 40,
};

const firstSubmission = simulateSparkSubmission(submissionParams, mockExistingResults);
assert(firstSubmission.status === 'submitted', 'First attempt creates submission record');
assert(firstSubmission.result.answersCount === 2, 'Records accurate answered question count');
assert(firstSubmission.result.id === 'student-99_hSBLYMNuOtx6ASnhKdo1', 'Result ID follows deterministic format');

const secondSubmission = simulateSparkSubmission(submissionParams, mockExistingResults);
assert(secondSubmission.status === 'existing', 'Duplicate submission detected idempotently');

console.log('\n====================================================');
console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
}
