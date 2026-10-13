/**
 * Regression Test Suite: Student Correct Answer Evaluation, Normalization & Spark Free Tier Architecture
 *
 * Verifies:
 * 1. Correct answer stored as "B" and selected by student (via index 1, letter 'B', lowercase 'b', option text).
 * 2. Wrong answer evaluated correctly (awarding 0 marks).
 * 3. Unanswered questions (undefined, null, empty string, -1) correctly handled without false positives.
 * 4. Numeric option-index mappings (0 -> A, 1 -> B, 2 -> C, 3 -> D).
 * 5. String and letter normalization (whitespace trimming, case-insensitivity, "Option B" prefixes).
 * 6. Questions with different marks (properly weighted totalMarks and obtainedMarks).
 * 7. All answers correct (100%, passed) and all answers wrong (0%, failed).
 * 8. Submission persistence on assignment document & result-screen field mapping (pending vs graded).
 * 9. Prevention of student-forged results & zero-trust security enforcement.
 * 10. Teacher/Admin authoritative grading workflow on Firebase Spark plan.
 */

import {
  checkAnswerMatch,
  gradeExamSubmission,
  calculateKmuGrade,
} from '../utils/secureGrading.ts';
import type { MasterQuestion, QuestionOption } from '../types/question.ts';
import type { Result } from '../types/result.ts';

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
console.log('ROYAL COLLEGE OF NURSING SWAT - Grading Regression Test Suite');
console.log('================================================================\n');

// --------------------------------------------------------------------
// TEST SUITE 1: Correct Answer Stored as "B" & Option Selection Formats
// --------------------------------------------------------------------
console.log('--- Test Suite 1: Correct Answer "B" & Student Selection Formats ---');

const realisticQuestionB: MasterQuestion = {
  id: 'q-nurs-101',
  examId: 'exam-fon-midterm',
  question: 'Which position is optimal for facilitating maximum chest expansion in dyspneic patients?',
  options: ['Supine position', "High Fowler's position", 'Trendelenburg position', 'Prone position'],
  correctAnswer: 'B',
  marks: 2,
  order: 1,
  explanation: "High Fowler's position permits gravitational descent of the diaphragm.",
};

// 1. Student selects Option B via numeric index 1 (standard UI index)
assert(
  checkAnswerMatch(1, realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Numeric index 1 matches correct answer "B"'
);

// 2. Student selects Option B via string numeric index "1"
assert(
  checkAnswerMatch('1', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'String index "1" matches correct answer "B"'
);

// 3. Student selects Option B via letter "B"
assert(
  checkAnswerMatch('B', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Letter "B" matches correct answer "B"'
);

// 4. Student selects Option B via lowercase "b"
assert(
  checkAnswerMatch('b', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Lowercase "b" matches correct answer "B"'
);

// 5. Student selects Option B with whitespace "  B  "
assert(
  checkAnswerMatch('  B  ', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Whitespace padded "  B  " matches correct answer "B"'
);

// 6. Student selects Option B via full option text
assert(
  checkAnswerMatch("High Fowler's position", realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Option text "High Fowler\'s position" matches letter "B"'
);

// 7. Student selects Option B with "Option B" label
assert(
  checkAnswerMatch('Option B', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Prefixed "Option B" matches correct answer "B"'
);

// --------------------------------------------------------------------
// TEST SUITE 2: Wrong Answers & Unanswered Questions
// --------------------------------------------------------------------
console.log('\n--- Test Suite 2: Wrong Answers & Unanswered Questions ---');

// 1. Wrong answer selected (Option A when correct is B)
assert(
  !checkAnswerMatch(0, realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Wrong numeric index 0 does NOT match correct answer "B"'
);
assert(
  !checkAnswerMatch('A', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Wrong letter "A" does NOT match correct answer "B"'
);
assert(
  !checkAnswerMatch('Supine position', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Wrong option text does NOT match correct answer "B"'
);

// 2. Unanswered / empty cases
assert(
  !checkAnswerMatch(undefined, realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'undefined answer does NOT match and is marked incorrect'
);
assert(
  !checkAnswerMatch(null, realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'null answer does NOT match and is marked incorrect'
);
assert(
  !checkAnswerMatch('', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Empty string "" does NOT match and is marked incorrect'
);
assert(
  !checkAnswerMatch('   ', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  'Whitespace string does NOT match and is marked incorrect'
);
assert(
  !checkAnswerMatch(-1, realisticQuestionB.correctAnswer, realisticQuestionB.options),
  '-1 (cleared answer) does NOT match and is marked incorrect'
);
assert(
  !checkAnswerMatch('-1', realisticQuestionB.correctAnswer, realisticQuestionB.options),
  '"-1" (cleared answer string) does NOT match and is marked incorrect'
);

// 3. Security: Both empty must NEVER match
assert(
  !checkAnswerMatch('', '', realisticQuestionB.options),
  'Both submitted and correct being empty string NEVER returns true'
);
assert(
  !checkAnswerMatch(-1, -1, realisticQuestionB.options),
  'Both submitted and correct being -1 NEVER returns true'
);

// --------------------------------------------------------------------
// TEST SUITE 3: Numeric Option-Index Mappings (Zero-Based Standard)
// --------------------------------------------------------------------
console.log('\n--- Test Suite 3: Numeric Option-Index Mappings ---');

const optionsList = ['First Option', 'Second Option', 'Third Option', 'Fourth Option'];

// 0 -> A
assert(checkAnswerMatch(0, 'A', optionsList), 'Index 0 matches letter A');
assert(checkAnswerMatch('A', 0, optionsList), 'Letter A matches index 0');
assert(checkAnswerMatch('0', 'A', optionsList), 'String "0" matches letter A');

// 1 -> B
assert(checkAnswerMatch(1, 'B', optionsList), 'Index 1 matches letter B');
assert(checkAnswerMatch('B', 1, optionsList), 'Letter B matches index 1');
assert(checkAnswerMatch('1', 'B', optionsList), 'String "1" matches letter B');

// 2 -> C
assert(checkAnswerMatch(2, 'C', optionsList), 'Index 2 matches letter C');
assert(checkAnswerMatch('C', 2, optionsList), 'Letter C matches index 2');
assert(checkAnswerMatch('2', 'C', optionsList), 'String "2" matches letter C');

// 3 -> D
assert(checkAnswerMatch(3, 'D', optionsList), 'Index 3 matches letter D');
assert(checkAnswerMatch('D', 3, optionsList), 'Letter D matches index 3');
assert(checkAnswerMatch('3', 'D', optionsList), 'String "3" matches letter D');

// Object options: { id, text }
const objectOptions: QuestionOption[] = [
  { id: 'opt-1', text: 'Normal Saline (0.9% NaCl)' },
  { id: 'opt-2', text: 'Dextrose 5% in Water (D5W)' },
  { id: 'opt-3', text: 'Lactated Ringer (LR)' },
  { id: 'opt-4', text: 'Hypertonic Saline (3% NaCl)' },
];

assert(checkAnswerMatch(0, 'A', objectOptions), 'Object options array: Index 0 matches letter A');
assert(
  checkAnswerMatch(0, 'Normal Saline (0.9% NaCl)', objectOptions),
  'Object options array: Index 0 matches option text'
);
assert(
  checkAnswerMatch('Normal Saline (0.9% NaCl)', 'A', objectOptions),
  'Object options array: Option text matches letter A'
);

// --------------------------------------------------------------------
// TEST SUITE 4: Questions with Different Marks & Varying Weights
// --------------------------------------------------------------------
console.log('\n--- Test Suite 4: Questions with Different Marks & Weighting ---');

const weightedExamQuestions: MasterQuestion[] = [
  {
    id: 'q-weight-1',
    examId: 'exam-weighted',
    question: 'Q1 (Quiz MCQ)',
    options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
    correctAnswer: 'A',
    marks: 2,
    order: 1,
  },
  {
    id: 'q-weight-2',
    examId: 'exam-weighted',
    question: 'Q2 (Clinical scenario)',
    options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
    correctAnswer: 'B',
    marks: 5,
    order: 2,
  },
  {
    id: 'q-weight-3',
    examId: 'exam-weighted',
    question: 'Q3 (Comprehensive case study)',
    options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
    correctAnswer: 'C',
    marks: 10,
    order: 3,
  },
];

// Student answers Q1 (2 marks) correct, Q2 (5 marks) correct, Q3 (10 marks) wrong
// Total Marks = 2 + 5 + 10 = 17
// Obtained Marks = 2 + 5 = 7
const subPartial = {
  'q-weight-1': 0, // 'A' correct -> +2
  'q-weight-2': 1, // 'B' correct -> +5
  'q-weight-3': 0, // 'A' wrong -> 0
};

const resultPartial = gradeExamSubmission(weightedExamQuestions, subPartial);
assert(resultPartial.totalMarks === 17, 'Weighted total marks correctly calculated as 17');
assert(resultPartial.obtainedMarks === 7, 'Weighted obtained marks correctly awarded (2 + 5 = 7)');
assert(resultPartial.percentage === 41.2, 'Percentage accurately calculated as 41.2%');
assert(resultPartial.passed === false, 'Pass status correctly evaluated as false (41.2% < 50%)');
assert(resultPartial.correctCount === 2, 'Correct answers count is 2');
assert(resultPartial.answersCount === 3, 'Answered questions count is 3');

// Student answers Q2 (5 marks) and Q3 (10 marks) correct, Q1 (2 marks) wrong
// Obtained = 15 / 17 = 88.2%
const subHigh = {
  'q-weight-1': 1, // wrong
  'q-weight-2': 1, // 'B' correct -> +5
  'q-weight-3': 2, // 'C' correct -> +10
};
const resultHigh = gradeExamSubmission(weightedExamQuestions, subHigh);
assert(resultHigh.obtainedMarks === 15, 'Obtained marks accurately awarded as 15');
assert(resultHigh.percentage === 88.2, 'Percentage accurately calculated as 88.2%');
assert(resultHigh.passed === true, 'Passed status awarded (88.2% >= 50%)');
assert(resultHigh.grade === 'A+', 'KMU Letter grade accurately awarded as A+ for 88.2%');

// --------------------------------------------------------------------
// TEST SUITE 5: All Answers Correct and All Answers Wrong
// --------------------------------------------------------------------
console.log('\n--- Test Suite 5: All Answers Correct & All Answers Wrong ---');

const standardQuestions: MasterQuestion[] = [
  { id: 'q1', examId: 'exam-1', question: 'Q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', marks: 10, order: 1 },
  { id: 'q2', examId: 'exam-1', question: 'Q2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B', marks: 10, order: 2 },
  { id: 'q3', examId: 'exam-1', question: 'Q3', options: ['A', 'B', 'C', 'D'], correctAnswer: 'C', marks: 10, order: 3 },
  { id: 'q4', examId: 'exam-1', question: 'Q4', options: ['A', 'B', 'C', 'D'], correctAnswer: 'D', marks: 10, order: 4 },
];

// All correct
const subAllCorrect = { q1: 0, q2: 1, q3: 2, q4: 3 };
const resAllCorrect = gradeExamSubmission(standardQuestions, subAllCorrect);
assert(resAllCorrect.obtainedMarks === 40, 'All correct: Obtained marks is 40 / 40');
assert(resAllCorrect.percentage === 100, 'All correct: Percentage is 100%');
assert(resAllCorrect.passed === true, 'All correct: Passed status is true');
assert(resAllCorrect.correctCount === 4, 'All correct: Correct count is 4');
assert(resAllCorrect.answersCount === 4, 'All correct: Answers count is 4');
assert(resAllCorrect.grade === 'A+', 'All correct: KMU Grade is A+');

// All wrong
const subAllWrong = { q1: 1, q2: 2, q3: 3, q4: 0 };
const resAllWrong = gradeExamSubmission(standardQuestions, subAllWrong);
assert(resAllWrong.obtainedMarks === 0, 'All wrong: Obtained marks is 0');
assert(resAllWrong.percentage === 0, 'All wrong: Percentage is 0%');
assert(resAllWrong.passed === false, 'All wrong: Passed status is false');
assert(resAllWrong.correctCount === 0, 'All wrong: Correct count is 0');
assert(resAllWrong.answersCount === 4, 'All wrong: Answers count is 4');
assert(resAllWrong.grade === 'F', 'All wrong: KMU Grade is F');

// All unanswered
const subAllUnanswered = {};
const resAllUnanswered = gradeExamSubmission(standardQuestions, subAllUnanswered);
assert(resAllUnanswered.obtainedMarks === 0, 'All unanswered: Obtained marks is 0');
assert(resAllUnanswered.percentage === 0, 'All unanswered: Percentage is 0%');
assert(resAllUnanswered.passed === false, 'All unanswered: Passed status is false');
assert(resAllUnanswered.answersCount === 0, 'All unanswered: Answers count is 0');

// Safe handling of empty question array (Division by zero protection)
const resEmptyQuestions = gradeExamSubmission([], {});
assert(resEmptyQuestions.totalMarks === 0, 'Empty question array: totalMarks is 0');
assert(resEmptyQuestions.percentage === 0, 'Empty question array: percentage is 0 without NaN');
assert(!isNaN(resEmptyQuestions.percentage), 'Empty question array: percentage is not NaN');

// --------------------------------------------------------------------
// TEST SUITE 6: Submission Persistence & Result-Screen Field Mapping
// --------------------------------------------------------------------
console.log('\n--- Test Suite 6: Submission Persistence & Result-Screen Field Mapping ---');

// Mock Firestore assignment storage simulating Spark tier workflow
interface AssignmentDoc {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, any>;
  answersCount: number;
  totalMarks: number;
  status: 'assigned' | 'submitted' | 'graded';
}

const mockAssignmentsStore: Record<string, AssignmentDoc> = {};

function simulateSparkSubmit(params: {
  examId: string;
  studentId: string;
  answers: Record<string, any>;
  totalMarks: number;
}): Result {
  const assignmentId = `${params.examId}_${params.studentId}`;
  const answeredCount = Object.keys(params.answers).filter(
    (k) => params.answers[k] !== undefined && params.answers[k] !== null && String(params.answers[k]).trim() !== ''
  ).length;

  // Persist submission answers onto candidate assignment document
  mockAssignmentsStore[assignmentId] = {
    id: assignmentId,
    examId: params.examId,
    studentId: params.studentId,
    answers: params.answers,
    answersCount: answeredCount,
    totalMarks: params.totalMarks,
    status: 'submitted',
  };

  // Return pending result (provisional 0s must not be displayed as authoritative FAILED)
  return {
    id: `${params.studentId}_${params.examId}`,
    examId: params.examId,
    studentId: params.studentId,
    marks: 0,
    totalMarks: params.totalMarks,
    percentage: 0,
    passed: false,
    answersCount: answeredCount,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };
}

const studentAnswers = {
  'q-nurs-101': 1, // Student selected option B
  'q-weight-1': 0, // Student selected option A
};

const submissionResult = simulateSparkSubmit({
  examId: 'exam-fon-midterm',
  studentId: 'student-naveed-001',
  answers: studentAnswers,
  totalMarks: 50,
});

const savedAssignment = mockAssignmentsStore['exam-fon-midterm_student-naveed-001'];
assert(Boolean(savedAssignment), 'Assignment document exists in store after submission');
assert(savedAssignment.status === 'submitted', 'Assignment status is updated to "submitted"');
assert(savedAssignment.answersCount === 2, 'Assignment preserves accurate answers count (2)');
assert(savedAssignment.answers['q-nurs-101'] === 1, 'Student answers are safely persisted on assignment doc');

// Result Screen Mapping: Pending submission must be identified as 'pending'
assert(submissionResult.status === 'pending', 'Submission result indicates status: "pending"');

// Ensure UI helper formats result preview card properly without displaying 0% FAILED
function formatResultScreenSummary(result: Result, totalQuestions: number) {
  if (result.status === 'pending') {
    return {
      displayTitle: 'Examination Submitted Successfully!',
      isPending: true,
      answeredCount: result.answersCount,
      totalQuestions,
      statusBadge: 'PENDING',
      showScore: false,
    };
  }

  return {
    displayTitle: 'Examination Graded',
    isPending: false,
    score: result.marks,
    totalMarks: result.totalMarks,
    percentage: result.percentage,
    outcome: result.passed ? 'PASSED' : 'FAILED',
    showScore: true,
  };
}

const pendingScreen = formatResultScreenSummary(submissionResult, 2);
assert(pendingScreen.isPending === true, 'Result screen accurately recognizes pending evaluation status');
assert(pendingScreen.showScore === false, 'Pending submission screen does NOT expose provisional 0 score');
assert(pendingScreen.statusBadge === 'PENDING', 'Pending submission screen displays PENDING badge');

// --------------------------------------------------------------------
// TEST SUITE 7: Prevention of Student-Forged Results & Zero-Trust Security
// --------------------------------------------------------------------
console.log('\n--- Test Suite 7: Prevention of Student-Forged Results ---');

// Malicious student attempts to forge score by passing marks: 50 in answer payload
const maliciousStudentAnswers = {
  'q-nurs-101': 0, // Wrong answer selected
  forgedMarks: 50,
  forgedPercentage: 100,
  forgedPassed: true,
};

// Teacher authoritative grading engine evaluates
const authoritativeGraded = gradeExamSubmission([realisticQuestionB], maliciousStudentAnswers as any);
assert(authoritativeGraded.obtainedMarks === 0, 'Forged marks ignored: Authoritative grade is 0 marks');
assert(authoritativeGraded.percentage === 0, 'Forged percentage ignored: Authoritative percentage is 0%');
assert(authoritativeGraded.passed === false, 'Forged pass flag ignored: Candidate is flagged failed');

// --------------------------------------------------------------------
// TEST SUITE 8: Teacher/Admin Authoritative Grading on Spark Tier
// --------------------------------------------------------------------
console.log('\n--- Test Suite 8: Teacher Authoritative Grading on Spark Tier ---');

function simulateTeacherGrading(
  examQuestions: MasterQuestion[],
  assignment: AssignmentDoc,
  passingMarks: number = 25
): Result {
  const graded = gradeExamSubmission(examQuestions, assignment.answers, passingMarks);
  assignment.status = 'graded';

  return {
    id: `${assignment.studentId}_${assignment.examId}`,
    examId: assignment.examId,
    studentId: assignment.studentId,
    marks: graded.obtainedMarks,
    totalMarks: graded.totalMarks,
    percentage: graded.percentage,
    passed: graded.passed,
    grade: calculateKmuGrade(graded.percentage),
    answersCount: graded.answersCount,
    correctCount: graded.correctCount,
    status: 'graded',
    submittedAt: new Date().toISOString(),
  };
}

// Student submitted correct answer for realisticQuestionB (marks = 2)
const assignmentToGrade: AssignmentDoc = {
  id: 'exam-fon-midterm_student-naveed-001',
  examId: 'exam-fon-midterm',
  studentId: 'student-naveed-001',
  answers: {
    'q-nurs-101': 1, // Correct answer Option B
  },
  answersCount: 1,
  totalMarks: 2,
  status: 'submitted',
};

const teacherGradedResult = simulateTeacherGrading([realisticQuestionB], assignmentToGrade, 1);
assert(teacherGradedResult.status === 'graded', 'Teacher grading updates status to "graded"');
assert(teacherGradedResult.marks === 2, 'Teacher grading calculates accurate marks awarded (2 / 2)');
assert(teacherGradedResult.percentage === 100, 'Teacher grading computes accurate percentage (100%)');
assert(teacherGradedResult.passed === true, 'Teacher grading awards accurate passed status');
assert(teacherGradedResult.correctCount === 1, 'Teacher grading records correctCount as 1');
assert(assignmentToGrade.status === 'graded', 'Assignment status is transitioned to "graded"');

const gradedScreen = formatResultScreenSummary(teacherGradedResult, 1);
assert(gradedScreen.isPending === false, 'Graded result is recognized as authoritative');
assert(gradedScreen.showScore === true, 'Authoritative result displays genuine obtained marks');
assert(gradedScreen.outcome === 'PASSED', 'Authoritative result displays PASSED outcome');

console.log('\n================================================================');
console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
