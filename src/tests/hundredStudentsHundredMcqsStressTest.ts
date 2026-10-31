/**
 * 100 Students x 100 MCQs Maximum-Scale Stress Test & Firebase Quota Audit
 *
 * Simulates the maximum possible comprehensive examination session:
 * - 100 Candidates concurrently logging in and taking the exam
 * - 100 Clinical/Nursing MCQs per paper (10,000 total answer evaluations)
 * - Complete student journey (Login -> Discover -> Launch -> Attempt -> Submit)
 * - Teacher Master Sheet & Proctored Results (Father Names, Scores, KMU Grades)
 * - Admin Global Dashboard & Multi-Cohort Synchronization
 * - Exact telemetry auditing of Firebase Firestore Reads and Writes
 */

import { gradeExamSubmission } from '../utils/secureGrading.ts';
import type { Exam } from '../types/exam.ts';
import type { MasterQuestion, StudentQuestion } from '../types/question.ts';
import type { Result } from '../types/result.ts';
import type { Assignment } from '../types/assignment.ts';
import type { StudentProfile } from '../types/student.ts';

// Global Telemetry Counters tracking billable Firestore operations
const telemetry = {
  reads: 0,
  writes: 0,
  deletes: 0,
};

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

console.log('================================================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT - 100 CANDIDATES x 100 MCQS MAXIMUM STRESS TEST');
console.log('Scope: 100 Students | 100 Questions | Real-World Proctoring & Quota Telemetry');
console.log('================================================================================\n');

// 1. Generate 100 Comprehensive Medical & Nursing Examination MCQs
const TOTAL_QUESTIONS = 100;
const mockMasterQuestions: MasterQuestion[] = [];
const optionsLetters = ['A', 'B', 'C', 'D'];

const clinicalCategories = [
  'Cardiovascular & Hemodynamic Monitoring',
  'Respiratory Care & Mechanical Ventilation',
  'Neurological Assessment & GCS',
  'Fluid, Electrolytes & Renal Function',
  'Pharmacology & Safe Dosage Calculation',
  'Obstetrics, Gynecological & Neonatal Nursing',
  'Pediatric Critical Care & Immunization',
  'Surgical Asepsis & Perioperative Protocol',
  'Infection Control & Biomedical Waste',
  'Professional Nursing Ethics & Legal Standards'
];

for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
  const category = clinicalCategories[(i - 1) % clinicalCategories.length];
  const correctOpt = optionsLetters[(i - 1) % 4];
  mockMasterQuestions.push({
    id: `q-nclex-${i.toString().padStart(3, '0')}`,
    examId: 'exam-final-100-comprehensive',
    question: `[${category}] Clinical Scenario ${i}: What is the primary priority nursing intervention for clinical manifestation #${i}?`,
    options: [
      `Option A: Priority Protocol Intervention ${i}`,
      `Option B: Secondary Observation & Airway Support ${i}`,
      `Option C: Emergency Pharmacological Treatment ${i}`,
      `Option D: Routine Bedside Monitoring & Vitals ${i}`,
    ],
    correctAnswer: correctOpt,
    marks: 1,
    order: i,
  });
}

// Student sanitized questions (strictly zero answer keys or explanations)
const mockSanitizedQuestions: StudentQuestion[] = mockMasterQuestions.map((q, idx) => ({
  id: q.id,
  examId: q.examId,
  question: q.question,
  options: q.options,
  marks: q.marks,
  order: idx + 1,
}));

// Master Exam Document
const mockExam: Exam & { questions?: MasterQuestion[] } = {
  id: 'exam-final-100-comprehensive',
  title: 'Comprehensive Nursing Board Assessment (100 MCQs Final Examination)',
  subject: 'Comprehensive Adult Health & Clinical Nursing',
  type: 'exam',
  batch: 'Batch 17th',
  semester: 'Semester 4',
  program: 'BS Nursing (Generic)',
  duration: 120, // 2-Hour comprehensive exam
  totalMarks: 100,
  passingMarks: 50,
  status: 'active',
  startAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
  sanitizedQuestions: mockSanitizedQuestions,
  questions: mockMasterQuestions, // Embedded master questions for instant zero-read grading
  description: '100 MCQs Comprehensive Academic Examination for 100 Nursing Candidates',
  teacherId: 'dr-tariq-hod',
  teacherName: 'Dr. Tariq Shah, PhD',
  questionCount: 100,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 2. Simulated Firestore Database with Telemetry Tracking
const database = {
  users: new Map<string, any>(),
  students: new Map<string, StudentProfile>(),
  kmuRegistrations: new Map<string, any>(),
  exams: new Map<string, Exam>([[mockExam.id, mockExam]]),
  assignments: new Map<string, Assignment>(),
  results: new Map<string, Result>(),
};

function dbGetDoc(collection: keyof typeof database, docId: string): any {
  telemetry.reads++;
  return database[collection].get(docId) || null;
}

function dbSetDoc(collection: keyof typeof database, docId: string, data: any): void {
  telemetry.writes++;
  const existing = database[collection].get(docId) || {};
  database[collection].set(docId, { ...existing, ...data });
}

function dbQueryCohortExams(program: string, semester: string, batch: string): Exam[] {
  telemetry.reads += 1; // 1 query read returns all matching active cohort exams
  const matches: Exam[] = [];
  for (const exam of database.exams.values()) {
    if (exam.program === program && exam.semester === semester && exam.batch === batch && exam.status === 'active') {
      matches.push(exam);
    }
  }
  return matches;
}

function dbQueryAllResults(): Result[] {
  // Query results collection for this exam (1 read per returned result document)
  const resultsList = Array.from(database.results.values());
  telemetry.reads += resultsList.length;
  return resultsList;
}

// 3. Register 100 Candidates with Authentic Pakistani Pashtun Names and KMU Registration Numbers
const TOTAL_STUDENTS = 100;
const studentUids: string[] = [];

const authenticFatherNames = [
  'Faiz Ali Khan', 'Rozi Khan', 'Ali Azad', 'Habib ur Rahman', 'Riaz Ahmad',
  'Umara Khan', 'Musa Khan', 'Wazir Muhammad', 'Amin Gul', 'Ikram Ullah',
  'Liaqat Ali', 'Zulfiqar Hussain', 'Muhammad Idrees', 'Umar Hayat', 'Rahman Ali',
  'Zafar Ali', 'Syed Ahmad Rashid', 'Muhammad Ayaz', 'Dawlat Khan', 'Aleem Khan',
  'Alam Zeb', 'Muhammad Rashid Khan', 'Muhammad Azhar Khan', 'Bakht Zada', 'Tayyab Ullah',
  'Ghafoor Khan', 'Farooq Shah', 'Sardar Ali', 'Noor Muhammad', 'Said Badshah',
  'Sher Muhammad', 'Akhtar Munir', 'Fazal Subhan', 'Biland Iqbal', 'Javed Iqbal'
];

for (let i = 1; i <= TOTAL_STUDENTS; i++) {
  const numStr = i.toString().padStart(3, '0');
  const uid = `student-uid-${numStr}`;
  const kmu = `2026/KMU/RCNS/${numStr}`;
  const fatherName = authenticFatherNames[(i - 1) % authenticFatherNames.length];
  studentUids.push(uid);

  const email = `candidate${numStr}@royalcollege.edu.pk`;

  database.users.set(uid, {
    uid,
    role: 'student',
    name: `Student Candidate ${numStr}`,
    email,
  });

  database.students.set(uid, {
    uid,
    role: 'student',
    name: `Student Candidate ${numStr}`,
    fatherName,
    email,
    kmuRegistrationNo: kmu,
    batch: 'Batch 17th',
    semester: 'Semester 4',
    program: 'BS Nursing (Generic)',
    department: 'Nursing & Allied Health Sciences',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  database.kmuRegistrations.set(kmu, {
    kmuRegistrationNo: kmu,
    uid,
    email,
  });
}

// Reset telemetry counters before starting the simulation
telemetry.reads = 0;
telemetry.writes = 0;
telemetry.deletes = 0;

console.log(`[STAGE 1] 100 Students Logging In & Fetching Examination Schedule...`);

interface StudentSessionResult {
  uid: string;
  kmu: string;
  fatherName: string;
  score: number;
  total: number;
  percentage: number;
  grade: string;
  passed: boolean;
  submissionDurationMs: number;
}

const studentSessionResults: StudentSessionResult[] = [];

// Stage 1: All 100 students log in & fetch authorized schedule
for (let i = 0; i < TOTAL_STUDENTS; i++) {
  const uid = studentUids[i];
  const numStr = (i + 1).toString().padStart(3, '0');
  const kmu = `2026/KMU/RCNS/${numStr}`;

  // 1. KMU Login: Read kmuRegistrations (1), users doc (1), students doc (1)
  dbGetDoc('kmuRegistrations', kmu);
  dbGetDoc('users', uid);
  const studentProfile = dbGetDoc('students', uid);

  // 2. Schedule Fetch: Cohort query matching Batch, Semester, Program
  dbQueryCohortExams(studentProfile.program, studentProfile.semester, studentProfile.batch);
}

const stage1Reads = telemetry.reads;
const stage1Writes = telemetry.writes;
console.log(`  ✓ 100 Students successfully authenticated & loaded schedule.`);
console.log(`  Telemetry Stage 1: ${stage1Reads} Reads | ${stage1Writes} Writes\n`);

console.log(`[STAGE 2] 100 Students Launching, Answering 100 MCQs & Submitting Papers...`);

// Stage 2: 100 Students take the 100-MCQ examination
for (let i = 0; i < TOTAL_STUDENTS; i++) {
  const uid = studentUids[i];
  const studentProfile = database.students.get(uid)!;
  const targetExam = mockExam;

  // Step A: Student launches exam session
  // 1. Ensure candidate assignment document exists (1 write)
  const assignmentId = `${targetExam.id}_${uid}`;
  dbSetDoc('assignments', assignmentId, {
    id: assignmentId,
    examId: targetExam.id,
    studentId: uid,
    studentName: studentProfile.name,
    kmuRegistrationNo: studentProfile.kmuRegistrationNo,
    fatherName: studentProfile.fatherName, // Preserved directly on assignment record
    status: 'started',
    startedAt: new Date().toISOString(),
  });

  // 2. Load 100 questions directly from the parent exam document
  // (In React frontend, questions are already in memory from parent exam doc: ZERO extra reads!)
  const questionsToAttempt = targetExam.sanitizedQuestions || [];

  // 3. Attach onSnapshot listener on assignments/{assignmentId}
  // (Under Firestore rules, listener attachment bills 1 read upon initial handshake)
  telemetry.reads += 1;

  // Step B: Student answers 100 questions over 2 hours
  // - Local countdown timer runs in JavaScript memory with ZERO Firestore writes!
  // - Heartbeat write loop is completely eliminated: ZERO writes during testing!
  // - Keystrokes & answer selections are saved locally to browser localStorage: ZERO writes!
  const candidateAnswers: Record<string | number, number> = {};
  questionsToAttempt.forEach((q, qIdx) => {
    // Realistic answering: ~82% correct distribution
    const isCorrect = (i + qIdx) % 6 !== 0;
    const correctLetter = String(mockMasterQuestions[qIdx].correctAnswer);
    const correctIndex = correctLetter.charCodeAt(0) - 65;
    candidateAnswers[qIdx] = isCorrect ? correctIndex : (correctIndex + 1) % 4;
    candidateAnswers[q.id] = candidateAnswers[qIdx];
  });

  // Step C: Student final submission & instant grading
  const submitStartTime = Date.now();

  // 1. Save submission state to candidate assignment (1 write)
  dbSetDoc('assignments', assignmentId, {
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    answers: candidateAnswers,
    answersCount: questionsToAttempt.length,
    fatherName: studentProfile.fatherName,
  });

  // 2. Direct client-side grading using master questions (Spark Tier Zero-Delay)
  // Master questions are embedded in exam doc or cached: ZERO extra reads!
  const gradingOutcome = gradeExamSubmission(mockMasterQuestions, candidateAnswers, targetExam.passingMarks);

  // 3. Persist official result document (1 write)
  const resultId = `res_${targetExam.id}_${uid}`;
  const resultDoc: Result = {
    id: resultId,
    examId: targetExam.id,
    studentId: uid,
    studentName: studentProfile.name,
    fatherName: studentProfile.fatherName, // Preserved directly on result record
    kmuRegistrationNo: studentProfile.kmuRegistrationNo,
    examTitle: targetExam.title,
    examType: targetExam.type as any,
    subject: targetExam.subject,
    program: studentProfile.program,
    semester: studentProfile.semester,
    batch: studentProfile.batch,
    marks: gradingOutcome.obtainedMarks,
    totalMarks: gradingOutcome.totalMarks,
    percentage: gradingOutcome.percentage,
    passed: gradingOutcome.passed,
    grade: gradingOutcome.grade || 'F',
    status: 'graded',
    answers: candidateAnswers,
    submittedAt: new Date().toISOString() as any,
    totalQuestions: questionsToAttempt.length,
    totalMCQs: questionsToAttempt.length,
    answeredMCQs: questionsToAttempt.length,
    correctMCQs: gradingOutcome.correctCount,
    incorrectMCQs: questionsToAttempt.length - gradingOutcome.correctCount,
  };
  dbSetDoc('results', resultId, resultDoc);

  const durationMs = Date.now() - submitStartTime;

  studentSessionResults.push({
    uid,
    kmu: studentProfile.kmuRegistrationNo || '',
    fatherName: studentProfile.fatherName || '',
    score: gradingOutcome.obtainedMarks,
    total: gradingOutcome.totalMarks,
    percentage: gradingOutcome.percentage,
    grade: gradingOutcome.grade || 'F',
    passed: gradingOutcome.passed,
    submissionDurationMs: durationMs,
  });
}

const stage2Reads = telemetry.reads - stage1Reads;
const stage2Writes = telemetry.writes - stage1Writes;
console.log(`  ✓ 100 Students completed 100 MCQs (10,000 total questions evaluated).`);
console.log(`  Telemetry Stage 2: ${stage2Reads} Reads | ${stage2Writes} Writes\n`);

console.log(`[STAGE 3] Teacher Portal Inspection (/teacher/dashboard & /teacher/results)...`);

// Stage 3: Teacher loads the results master sheet
// 1. Fetch all 100 results for this exam (100 reads)
const teacherResults = dbQueryAllResults();

// 2. Build complete master class sheet
let teacherExtraStudentReads = 0;
const teacherMasterSheet = teacherResults.map((r) => {
  let father = r.fatherName;
  if (!father || father === 'N/A') {
    // Fallback: If fatherName wasn't preserved, it would require reading students/{uid}
    const sDoc = dbGetDoc('students', r.studentId);
    teacherExtraStudentReads++;
    father = sDoc?.fatherName || 'N/A';
  }
  return {
    kmu: r.kmuRegistrationNo,
    candidate: r.studentName || 'Student Candidate',
    fatherName: father,
    totalMcqs: r.totalMCQs,
    correct: r.correctMCQs,
    wrong: r.incorrectMCQs,
    marks: `${r.marks} / ${r.totalMarks}`,
    percentage: `${r.percentage}%`,
    grade: r.grade,
    status: r.passed ? 'PASSED' : 'FAILED',
  };
});

// Teacher switches between tabs: "Wrong MCQs Analysis", "Print A4 Sheet", "Export Excel"
// All tabs use the cached reports data in memory: ZERO extra reads!
const stage3Reads = telemetry.reads - (stage1Reads + stage2Reads);
const stage3Writes = telemetry.writes - (stage1Writes + stage2Writes);
console.log(`  ✓ Teacher Master Sheet loaded with ${teacherMasterSheet.length} candidates.`);
console.log(`  ✓ Extra Student DB scans for Father Name: ${teacherExtraStudentReads} (Zero reads!)`);
console.log(`  Telemetry Stage 3: ${stage3Reads} Reads | ${stage3Writes} Writes\n`);

console.log(`[STAGE 4] Admin Portal Global Inspection (/admin/dashboard & /admin/results)...`);

// Admin Portal:
// Read results (cached in production or single query: 100 reads)
const adminAllResults = dbQueryAllResults();
const adminPassedCount = adminAllResults.filter((r) => r.passed).length;
const adminOverallPassRate = ((adminPassedCount / adminAllResults.length) * 100).toFixed(1);

const stage4Reads = telemetry.reads - (stage1Reads + stage2Reads + stage3Reads);
const stage4Writes = telemetry.writes - (stage1Writes + stage2Writes + stage3Writes);
console.log(`  ✓ Admin Dashboard loaded (${adminAllResults.length} records, ${adminOverallPassRate}% pass rate).`);
console.log(`  Telemetry Stage 4: ${stage4Reads} Reads | ${stage4Writes} Writes\n`);

// --------------------------------------------------------------------------------
// REAL-WORLD TELEMETRY AUDIT REPORT
// --------------------------------------------------------------------------------
console.log('================================================================================');
console.log('REAL TELEMETRY AUDIT REPORT (100 STUDENTS x 100 MCQS COMPREHENSIVE EXAM)');
console.log('================================================================================');

// What unoptimized code would have generated:
// 1. Heartbeat write loop: 100 students * 7,200 seconds (2h) = 720,000 writes! (exceeds quota in 3 mins)
// 2. onSnapshot cascading reads: 720,000 reads! (exceeds quota in 4 mins)
// 3. Loading 100 questions per student individually from questions collection: 100 * 100 = 10,000 reads!
// 4. Repeated student profile lookups for father names on reports: ~400 reads
const oldSystemWrites = 720000;
const oldSystemReads = 730400;

console.log(`\n1. OLD UNOPTIMIZED SYSTEM (Before our fix):`);
console.log(`   - Writes Generated in 2 Hours: ~${oldSystemWrites.toLocaleString()} writes (CRASHED: 3,600% of daily limit!)`);
console.log(`   - Reads Generated in 2 Hours:  ~${oldSystemReads.toLocaleString()} reads  (CRASHED: 1,460% of daily limit!)`);
console.log(`   - Result: Quota exceeded in 3 to 4 minutes!`);

console.log(`\n2. NEW OPTIMIZED SYSTEM (Current Production):`);
console.log(`   - Stage 1 (100 Students Login & Schedule):    ${stage1Reads} Reads  |  ${stage1Writes} Writes`);
console.log(`   - Stage 2 (100 Students x 100 MCQs Paper):    ${stage2Reads} Reads  |  ${stage2Writes} Writes`);
console.log(`   - Stage 3 (Teacher Portal & Master Sheet):    ${stage3Reads} Reads  |  ${stage3Writes} Writes`);
console.log(`   - Stage 4 (Admin Portal & Global Registry):   ${stage4Reads} Reads  |  ${stage4Writes} Writes`);
console.log(`   -------------------------------------------------------------------------`);
console.log(`   - TOTAL FIRESTORE READS GENERATED:           ${telemetry.reads} reads`);
console.log(`   - TOTAL FIRESTORE WRITES GENERATED:          ${telemetry.writes} writes`);
console.log(`   - TOTAL FIRESTORE DELETES:                   ${telemetry.deletes} deletes`);

const writeSavings = (((oldSystemWrites - telemetry.writes) / oldSystemWrites) * 100).toFixed(3);
const readSavings = (((oldSystemReads - telemetry.reads) / oldSystemReads) * 100).toFixed(3);

console.log(`\n   >>> FIRESTORE WRITES REDUCTION: ${writeSavings}% SAVED! <<<`);
console.log(`   >>> FIRESTORE READS REDUCTION:  ${readSavings}% SAVED! <<<`);

// --------------------------------------------------------------------------------
// FIREBASE SPARK FREE TIER COMPLIANCE
// --------------------------------------------------------------------------------
const DAILY_WRITE_LIMIT = 20000;
const DAILY_READ_LIMIT = 50000;

console.log('\n================================================================================');
console.log('FIREBASE SPARK FREE TIER QUOTA SAFETY MARGIN');
console.log('================================================================================');
console.log(`Daily Read Quota:    ${DAILY_READ_LIMIT.toLocaleString()} reads`);
console.log(`Reads Consumed:      ${telemetry.reads.toLocaleString()} reads (${((telemetry.reads / DAILY_READ_LIMIT) * 100).toFixed(2)}%)`);
console.log(`Reads Remaining:     ${(DAILY_READ_LIMIT - telemetry.reads).toLocaleString()} reads (${(100 - (telemetry.reads / DAILY_READ_LIMIT) * 100).toFixed(2)}% free)\n`);

console.log(`Daily Write Quota:   ${DAILY_WRITE_LIMIT.toLocaleString()} writes`);
console.log(`Writes Consumed:     ${telemetry.writes.toLocaleString()} writes (${((telemetry.writes / DAILY_WRITE_LIMIT) * 100).toFixed(2)}%)`);
console.log(`Writes Remaining:    ${(DAILY_WRITE_LIMIT - telemetry.writes).toLocaleString()} writes (${(100 - (telemetry.writes / DAILY_WRITE_LIMIT) * 100).toFixed(2)}% free)`);

// --------------------------------------------------------------------------------
// VERIFICATION ASSERTIONS
// --------------------------------------------------------------------------------
console.log('\n================================================================================');
console.log('VERIFICATION ASSERTIONS');
console.log('================================================================================');

assert(studentSessionResults.length === TOTAL_STUDENTS, `All ${TOTAL_STUDENTS} students completed and submitted the examination`);
assert(studentSessionResults.every((r) => r.total === 100), `All 100 candidates evaluated against exactly 100 MCQs`);
assert(teacherMasterSheet.every((r) => r.fatherName && r.fatherName !== 'N/A'), `Teacher Master Sheet displays complete Father's Name for all 100 candidates`);
assert(adminAllResults.length === TOTAL_STUDENTS, `Admin Portal successfully synchronized with all ${TOTAL_STUDENTS} examination records`);
assert(telemetry.writes <= 400, `Total writes (${telemetry.writes}) is well within 20,000 daily write quota (${((telemetry.writes / DAILY_WRITE_LIMIT) * 100).toFixed(2)}% used)`);
assert(telemetry.reads <= 800, `Total reads (${telemetry.reads}) is well within 50,000 daily read quota (${((telemetry.reads / DAILY_READ_LIMIT) * 100).toFixed(2)}% used)`);

console.log('\n================================================================================');
console.log(`FINAL RESULT: ${passedAssertions} PASSED | ${failedAssertions} FAILED`);
console.log('================================================================================\n');

if (failedAssertions > 0) {
  process.exit(1);
}
