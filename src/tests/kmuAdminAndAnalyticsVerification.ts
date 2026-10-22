import { isValidKmuRegistration, parseKmuRegistration, normalizeKmuRegistration } from '../utils/kmuRegistration.ts';
import { calculateCategoryPerformance, isQuizResult, isMidtermResult } from '../utils/academicAnalytics.ts';
import type { Result } from '../types/result.ts';

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
console.log('ROYAL COLLEGE OF NURSING SWAT - New Requirements Verification Suite');
console.log('========================================================================\n');

// 1. KMU Registration Validation & Pre-written Separator Format
console.log('--- Test Suite 1: KMU Registration Format & Input Parsing ---');
assert(isValidKmuRegistration('2026/KMU/RCNS/001'), 'Accepts standard 2026/KMU/RCNS/001');
assert(isValidKmuRegistration('2025/KMU/RCNS/15'), 'Accepts 2025/KMU/RCNS/15');
assert(isValidKmuRegistration('2024-KMU-RCNS-002'), 'Accepts hyphenated 2024-KMU-RCNS-002');
assert(!isValidKmuRegistration('2026/KMU/RCNS/'), 'Rejects empty sequence number');
assert(!isValidKmuRegistration('/KMU/RCNS/001'), 'Rejects missing year');

const parsed = parseKmuRegistration('2026/KMU/RCNS/042');
assert(parsed !== null && parsed.year === 2026 && parsed.sequenceNumber === 42, 'Correctly parses year 2026 and roll 42');

const norm = normalizeKmuRegistration('2026/KMU/RCNS/001');
assert(norm === '2026_KMU_RCNS_001', 'Normalizes slash to underscore for document keys');

import { generateKmuLookupCandidates } from '../utils/kmuRegistration.ts';
const lookupKeys = generateKmuLookupCandidates('2026/KMU/RCNS/001');
assert(lookupKeys.includes('2026_KMU_RCNS_001'), 'Includes 3-digit padded key 2026_KMU_RCNS_001');
assert(lookupKeys.includes('2026_KMU_RCNS_01'), 'Includes 2-digit padded key 2026_KMU_RCNS_01');
assert(lookupKeys.includes('2026_KMU-RCNS_001'), 'Includes hyphenated key 2026_KMU-RCNS_001');
assert(lookupKeys.includes('2026_KMU-RCNS_01'), 'Includes hyphenated 2-digit key 2026_KMU-RCNS_01');

// Verify that user entering 2-digit 2026/KMU/RCNS/01 generates candidate matching 3-digit doc
const altKeys = generateKmuLookupCandidates('2026/KMU/RCNS/01');
assert(altKeys.includes('2026_KMU_RCNS_001'), 'Candidate entering 2-digit sequence matches 3-digit stored doc');

// 2. Academic Analytics: Class Quiz vs Mid-Term Separate Percentages
console.log('\n--- Test Suite 2: Separate Class Quiz & Mid-Term Overall Percentages ---');
const mockResults: Result[] = [
  {
    id: 'res-quiz-1',
    examId: 'exam-q1',
    studentId: 'student-1',
    examTitle: 'Cardiology Fundamentals Quiz 1',
    examType: 'quiz',
    subject: 'Cardiology',
    marks: 18,
    totalMarks: 20, // 90%
    percentage: 90,
    status: 'graded',
    passed: true,
    submittedAt: new Date().toISOString(),
  },
  {
    id: 'res-quiz-2',
    examId: 'exam-q2',
    studentId: 'student-1',
    examTitle: 'Pediatrics Assessment Quiz 2',
    examType: 'quiz',
    subject: 'Pediatrics',
    marks: 16,
    totalMarks: 20, // 80%
    percentage: 80,
    status: 'graded',
    passed: true,
    submittedAt: new Date().toISOString(),
  },
  {
    id: 'res-midterm-1',
    examId: 'exam-m1',
    studentId: 'student-1',
    examTitle: 'Nursing Mid-Term Examination 2026',
    examType: 'midterm',
    subject: 'Adult Health Nursing',
    marks: 70,
    totalMarks: 100, // 70%
    percentage: 70,
    status: 'graded',
    passed: true,
    submittedAt: new Date().toISOString(),
  },
];

assert(isQuizResult(mockResults[0]), 'Identifies Quiz 1 as quiz');
assert(isQuizResult(mockResults[1]), 'Identifies Quiz 2 as quiz');
assert(!isQuizResult(mockResults[2]), 'Mid-term is NOT identified as quiz');

assert(isMidtermResult(mockResults[2]), 'Identifies Mid-Term paper as midterm');
assert(!isMidtermResult(mockResults[0]), 'Quiz 1 is NOT identified as midterm');

const stats = calculateCategoryPerformance(mockResults);
// Quiz: (18 + 16) / (20 + 20) = 34 / 40 = 85.0%
assert(stats.quizCount === 2, 'Quiz count is 2');
assert(stats.quizPercentage === '85.0', `Quiz percentage is 85.0% (got ${stats.quizPercentage})`);

// Mid-Term: 70 / 100 = 70.0%
assert(stats.midtermCount === 1, 'Mid-term count is 1');
assert(stats.midtermPercentage === '70.0', `Mid-term percentage is 70.0% (got ${stats.midtermPercentage})`);

// Overall: (18 + 16 + 70) / (20 + 20 + 100) = 104 / 140 = 74.3%
assert(stats.totalCount === 3, 'Total evaluated count is 3');
assert(stats.overallPercentage === '74.3', `Overall percentage is 74.3% (got ${stats.overallPercentage})`);
assert(stats.overallPassRate === '100.0', 'Pass rate is 100.0%');

console.log('\n========================================================================');
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
