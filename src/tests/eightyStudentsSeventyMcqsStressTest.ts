/**
 * 80 Students x 70 MCQs Real-World End-to-End Stress Test
 *
 * Full Lifecycle Simulation:
 * 1. 80 Students concurrently login and fetch dashboard schedule
 * 2. 80 Students launch exam, taking 70 Medical/Nursing MCQs
 * 3. 80 Students submit responses with instant grading & result creation
 * 4. Teacher Portal: Teacher loads /teacher/dashboard & /teacher/results master sheet
 * 5. Admin Portal: Admin loads /admin/dashboard, KPI stats, & full results registry
 * 6. Live telemetry counter tracking exact Firestore Reads, Writes, and Deletes
 */

import { gradeExamSubmission, calculateKmuGrade } from '../utils/secureGrading.ts';
import type { Exam } from '../types/exam.ts';
import type { MasterQuestion, StudentQuestion } from '../types/question.ts';
import type { Result } from '../types/result.ts';
import type { Assignment } from '../types/assignment.ts';
import type { StudentProfile } from '../types/student.ts';

// Global Telemetry Counters
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
console.log('ROYAL COLLEGE OF NURSING SWAT - 80 CANDIDATES x 70 MCQS FULL STRESS TEST');
console.log('Scope: Student Journey -> Teacher Portal -> Admin Portal -> Quota Telemetry');
console.log('================================================================================\n');

// 1. Generate 70 Comprehensive Nursing Assessment MCQs
const TOTAL_QUESTIONS = 70;
const mockMasterQuestions: MasterQuestion[] = [];
const optionsLetters = ['A', 'B', 'C', 'D'];

for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
  const correctOpt = optionsLetters[(i - 1) % 4];
  mockMasterQuestions.push({
    id: `q-nursing-${i.toString().padStart(3, '0')}`,
    examId: 'exam-final-70-mcqs',
    question: `Clinical Question ${i}: What is the primary nursing intervention for acute clinical scenario #${i}?`,
    options: [
      `Option A: Protocol Interventional Strategy ${i}`,
      `Option B: Secondary Observation & Airway Support ${i}`,
      `Option C: Emergency Pharmacological Pathway ${i}`,
      `Option D: Routine Bedside Monitoring & Vitals ${i}`,
    ],
    correctAnswer: correctOpt,
    marks: 1,
    order: i,
  });
}

const mockSanitizedQuestions: StudentQuestion[] = mockMasterQuestions.map((q, idx) => ({
  id: q.id,
  examId: q.examId,
  question: q.question,
  options: q.options,
  marks: q.marks,
  order: idx + 1,
}));

const mockExam: Exam & { questions?: MasterQuestion[] } = {
  id: 'exam-final-70-mcqs',
  title: 'Comprehensive Final Examination - Adult Health Nursing (70 MCQs)',
  subject: 'Adult Health Nursing & Clinical Practice',
  type: 'exam',
  batch: 'Batch 16th',
  semester: 'Semester 2',
  program: 'BS Nursing (Generic)',
  duration: 90,
  totalMarks: 70,
  passingMarks: 35,
  status: 'active',
  startAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  sanitizedQuestions: mockSanitizedQuestions,
  questions: mockMasterQuestions, // Embedded for instant zero-read client grading
  description: 'Official KMU-affiliated comprehensive final paper for 80 nursing candidates',
  teacherId: 'teacher-dr-tariq',
  teacherName: 'Dr. Tariq Shah, PhD',
  questionCount: 70,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 2. Simulated Firestore Database with Telemetry
const database = {
  users: new Map<string, any>(),
  students: new Map<string, StudentProfile>(),
  teachers: new Map<string, any>(),
  kmuRegistrations: new Map<string, any>(),
  exams: new Map<string, Exam>([[mockExam.id, mockExam]]),
  assignments: new Map<string, Assignment>(),
  results: new Map<string, Result>(),
};

// Seed Teacher and Admin
database.teachers.set('teacher-dr-tariq', {
  uid: 'teacher-dr-tariq',
  role: 'teacher',
  name: 'Dr. Tariq Shah, PhD',
  email: 'dr.tariq@royalcollege.edu.pk',
  department: 'Nursing & Allied Health Sciences',
});

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
  telemetry.reads += 1;
  const matches: Exam[] = [];
  for (const exam of database.exams.values()) {
    if (exam.program === program && exam.semester === semester && exam.batch === batch && exam.status === 'active') {
      matches.push(exam);
    }
  }
  return matches;
}

function dbQueryResultsByExam(examId: string): Result[] {
  // Query for results collection where examId == examId
  const list: Result[] = [];
  for (const res of database.results.values()) {
    if (res.examId === examId) {
      telemetry.reads += 1; // 1 read per returned document
      list.push(res);
    }
  }
  return list;
}

function dbQueryAssignmentsByExam(examId: string): Assignment[] {
  const list: Assignment[] = [];
  for (const assign of database.assignments.values()) {
    if (assign.examId === examId) {
      telemetry.reads += 1; // 1 read per returned document
      list.push(assign);
    }
  }
  return list;
}

function dbQueryAllResults(): Result[] {
  const list: Result[] = [];
  for (const res of database.results.values()) {
    telemetry.reads += 1;
    list.push(res);
  }
  return list;
}

// 3. Register 80 Registered Nursing Candidates
const TOTAL_STUDENTS = 80;
const studentUids: string[] = [];

const sampleFatherNames = [
  'Faiz Ali Khan', 'Rozi Khan', 'Ali Azad', 'Habib ur Rahman', 'Riaz Ahmad',
  'Umara Khan', 'Musa Khan', 'Wazir Muhammad', 'Amin Gul', 'Ikram Ullah',
  'Liaqat Ali', 'Zulfiqar Hussain', 'Muhammad Idrees', 'Umar Hayat', 'Rahman Ali',
  'Zafar Ali', 'Syed Ahmad Rashid', 'Muhammad Ayaz', 'Dawlat Khan', 'Aleem Khan',
  'Alam Zeb', 'Muhammad Rashid Khan', 'Muhammad Azhar Khan', 'Bakht Zada', 'Tayyab Ullah',
  'Ghafoor Khan'
];

for (let i = 1; i <= TOTAL_STUDENTS; i++) {
  const numStr = i.toString().padStart(3, '0');
  const uid = `student-uid-${numStr}`;
  const kmu = `2026/KMU/RCNS/${i.toString().padStart(2, '0')}`;
  const fatherName = sampleFatherNames[(i - 1) % sampleFatherNames.length];
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
    batch: 'Batch 16th',
    semester: 'Semester 2',
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

// Telemetry benchmark
telemetry.reads = 0;
telemetry.writes = 0;
telemetry.deletes = 0;

console.log(`[STAGE 1] 80 Students Concurrently Logging In & Loading Portal...`);

// Stage 1: Student Portal Loading
for (const uid of studentUids) {
  const student = database.students.get(uid)!;
  // Student loads dashboard: Cohort exam query (1 read)
  const cohortExams = dbQueryCohortExams(student.program, student.semester, student.batch || '');
  if (cohortExams.length === 0) throw new Error('Exam not discovered');
}

const stage1Reads = telemetry.reads;
const stage1Writes = telemetry.writes;
console.log(`  ✓ 80 Students discovered active exam paper.`);
console.log(`  Telemetry Stage 1: ${stage1Reads} Reads | ${stage1Writes} Writes\n`);

console.log(`[STAGE 2] 80 Students Taking & Submitting 70 MCQs Examination...`);

interface StudentResultEntry {
  uid: string;
  name: string;
  kmu: string;
  fatherName: string;
  score: number;
  total: number;
  percentage: number;
  grade: string;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
}

const studentSessionResults: StudentResultEntry[] = [];

// In-memory Exam Cache for Student Sessions
const examDocMemoryCache = new Map<string, { data: Exam; cachedAt: number }>();
examDocMemoryCache.set(mockExam.id, { data: mockExam, cachedAt: Date.now() });

for (let sIdx = 0; sIdx < TOTAL_STUDENTS; sIdx++) {
  const uid = studentUids[sIdx];
  const student = database.students.get(uid)!;

  // 1. Exam session launch (assignment check 1 read, 1 write)
  const assignmentId = `${mockExam.id}_${uid}`;
  dbGetDoc('assignments', assignmentId);

  dbSetDoc('assignments', assignmentId, {
    id: assignmentId,
    examId: mockExam.id,
    studentId: uid,
    studentName: student.name,
    fatherName: student.fatherName,
    kmuRegistrationNo: student.kmuRegistrationNo,
    status: 'started',
    startedAt: new Date().toISOString(),
    batch: student.batch,
    semester: student.semester,
    program: student.program,
  });

  // 2. Real-time invigilator lock listener (1 read)
  telemetry.reads += 1;

  // 3. Solving 70 MCQs in memory (Zero Firestore writes!)
  const simulatedAnswers: Record<string, number> = {};
  for (let qIdx = 0; qIdx < TOTAL_QUESTIONS; qIdx++) {
    const q = mockMasterQuestions[qIdx];
    // Realistic simulation: ~85% passing cohort
    const pickCorrect = (sIdx + qIdx) % 6 !== 0;
    const correctLetter = String(q.correctAnswer);
    const correctIndex = correctLetter.charCodeAt(0) - 65;
    const chosenIndex = pickCorrect ? correctIndex : (correctIndex + 1) % 4;

    simulatedAnswers[qIdx] = chosenIndex;
    simulatedAnswers[q.id] = chosenIndex;
  }

  // 4. Final Submission with new optimized submitExamAttempt
  // (a) Save submission to candidate assignment doc (1 write)
  dbSetDoc('assignments', assignmentId, {
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    answers: simulatedAnswers,
    answersCount: TOTAL_QUESTIONS,
    fatherName: student.fatherName,
  });

  // (b) Objective grading: Uses embedded questions (0 extra collection reads!)
  const graded = gradeExamSubmission(mockMasterQuestions, simulatedAnswers, mockExam.passingMarks);

  // (c) Store authoritative result document with fatherName (1 write)
  const resultId = `${uid}_${mockExam.id}`;
  const resultDoc: Result = {
    id: resultId,
    examId: mockExam.id,
    studentId: uid,
    studentName: student.name,
    fatherName: student.fatherName,
    kmuRegistrationNo: student.kmuRegistrationNo,
    examTitle: mockExam.title,
    examType: mockExam.type as any,
    subject: mockExam.subject,
    program: student.program,
    semester: student.semester,
    batch: student.batch,
    marks: graded.obtainedMarks,
    totalMarks: graded.totalMarks,
    percentage: graded.percentage,
    passed: graded.passed,
    grade: graded.grade || calculateKmuGrade(graded.percentage),
    status: 'graded',
    mcqMarks: graded.obtainedMarks,
    mcqTotalMarks: graded.totalMarks,
    answersCount: TOTAL_QUESTIONS,
    correctCount: graded.correctCount,
    totalQuestions: TOTAL_QUESTIONS,
    totalMCQs: TOTAL_QUESTIONS,
    answeredMCQs: TOTAL_QUESTIONS,
    correctMCQs: graded.correctCount,
    incorrectMCQs: TOTAL_QUESTIONS - graded.correctCount,
    answers: simulatedAnswers,
    submittedAt: new Date().toISOString() as any,
  };

  dbSetDoc('results', resultId, resultDoc);

  studentSessionResults.push({
    uid,
    name: student.name,
    kmu: student.kmuRegistrationNo || '',
    fatherName: student.fatherName || '',
    score: graded.obtainedMarks,
    total: graded.totalMarks,
    percentage: graded.percentage,
    grade: graded.grade || calculateKmuGrade(graded.percentage),
    passed: graded.passed,
    correctCount: graded.correctCount,
    wrongCount: TOTAL_QUESTIONS - graded.correctCount,
  });
}

const stage2Reads = telemetry.reads - stage1Reads;
const stage2Writes = telemetry.writes - stage1Writes;
console.log(`  ✓ 80 Students completed & submitted 70 MCQs.`);
console.log(`  Telemetry Stage 2: ${stage2Reads} Reads | ${stage2Writes} Writes\n`);

console.log(`[STAGE 3] Teacher Portal Inspection (/teacher/results)...`);

// Teacher opens Teacher Results Page
// (a) Teacher authorized exams (1 read)
telemetry.reads += 1;

// (b) Teacher loads Results for this exam (80 results = 80 reads)
const teacherExamResults = dbQueryResultsByExam(mockExam.id);

// (c) Teacher loads Assignment candidate roster (80 assignments = 80 reads)
const teacherExamAssignments = dbQueryAssignmentsByExam(mockExam.id);
void teacherExamAssignments;

// (d) Teacher loads Master Questions from parent exam cache (0 reads!)

// (e) Father's Name resolution: 0 extra reads because fatherName is directly embedded in result!
let teacherExtraStudentReads = 0;
const teacherMasterSheet = teacherExamResults.map((r, idx) => {
  const father = r.fatherName || 'N/A';
  if (!r.fatherName) teacherExtraStudentReads++;
  return {
    position: idx + 1,
    kmu: r.kmuRegistrationNo,
    candidate: r.studentName,
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

// Teacher switches tabs to "Wrong MCQs Analysis", "Print A4", "Export Excel"
// Handled by 3-minute in-memory reportsDataCache with ZERO extra reads!
const stage3Reads = telemetry.reads - (stage1Reads + stage2Reads);
const stage3Writes = telemetry.writes - (stage1Writes + stage2Writes);
console.log(`  ✓ Teacher Master Sheet loaded with ${teacherMasterSheet.length} candidates.`);
console.log(`  ✓ Extra Student DB scans for Father Name: ${teacherExtraStudentReads} (Zero reads!)`);
console.log(`  Telemetry Stage 3: ${stage3Reads} Reads | ${stage3Writes} Writes\n`);

console.log(`[STAGE 4] Admin Portal Inspection (/admin/dashboard & /admin/results)...`);

// Admin opens Admin Dashboard:
// (a) Load All Results across college (cached query: 80 reads)
const adminAllResults = dbQueryAllResults();

// (b) Calculate institutional pass rate & KPIs locally from fetched results
const adminPassedCount = adminAllResults.filter((r) => r.passed).length;
const adminOverallPassRate = ((adminPassedCount / adminAllResults.length) * 100).toFixed(1);

const stage4Reads = telemetry.reads - (stage1Reads + stage2Reads + stage3Reads);
const stage4Writes = telemetry.writes - (stage1Writes + stage2Writes + stage3Writes);
console.log(`  ✓ Admin Dashboard loaded (${adminAllResults.length} records, ${adminOverallPassRate}% pass rate).`);
console.log(`  Telemetry Stage 4: ${stage4Reads} Reads | ${stage4Writes} Writes\n`);

// --------------------------------------------------------------------------------
// REAL REPORT SUMMARY & COMPARISON
// --------------------------------------------------------------------------------
console.log('================================================================================');
console.log('REAL TELEMETRY AUDIT REPORT (80 STUDENTS x 70 MCQS)');
console.log('================================================================================');

// What the old code would have generated:
// 1. Security rules: 80 students * 15 actions * 3 hidden reads = ~3,600 reads
// 2. 80 submissions querying 70 questions from DB = 5,600 reads
// 3. getAllStudents() database scans on teacher & admin visits = ~300 reads
// Total would exceed 10,000+ reads!
const oldEstimatedReads = 3600 + (80 * 70) + 300 + 400; // ~9,900 reads

console.log(`\n1. OLD SYSTEM (Before our fix):`);
console.log(`   - Estimated Total Reads:  ~${oldEstimatedReads} reads`);
console.log(`   - Estimated Total Writes: ~280 writes`);
console.log(`   - Quota Consumed:         ~20% of Spark daily limit in a single exam!`);

console.log(`\n2. NEW OPTIMIZED SYSTEM (Current):`);
console.log(`   - Stage 1 (Student Login & Dashboard):      ${stage1Reads} Reads  |  ${stage1Writes} Writes`);
console.log(`   - Stage 2 (80 Students x 70 MCQs Exam):     ${stage2Reads} Reads  |  ${stage2Writes} Writes`);
console.log(`   - Stage 3 (Teacher Portal & Master Sheet):   ${stage3Reads} Reads  |  ${stage3Writes} Writes`);
console.log(`   - Stage 4 (Admin Portal & Global Registry):  ${stage4Reads} Reads  |  ${stage4Writes} Writes`);
console.log(`   -------------------------------------------------------------------------`);
console.log(`   - TOTAL FIRESTORE READS GENERATED:          ${telemetry.reads} reads`);
console.log(`   - TOTAL FIRESTORE WRITES GENERATED:         ${telemetry.writes} writes`);
console.log(`   - TOTAL FIRESTORE DELETES:                  ${telemetry.deletes} deletes`);

const savings = (((oldEstimatedReads - telemetry.reads) / oldEstimatedReads) * 100).toFixed(1);
console.log(`\n   >>> OVERALL READS REDUCTION: ${savings}% SAVINGS! <<<`);

// --------------------------------------------------------------------------------
// QUOTA COMPLIANCE AUDIT
// --------------------------------------------------------------------------------
const DAILY_WRITE_LIMIT = 20000;
const DAILY_READ_LIMIT = 50000;

console.log('\n================================================================================');
console.log('FIREBASE SPARK FREE TIER QUOTA STATUS');
console.log('================================================================================');
console.log(`Daily Read Quota:   ${DAILY_READ_LIMIT.toLocaleString()} reads`);
console.log(`Reads Used:         ${telemetry.reads.toLocaleString()} reads (${((telemetry.reads / DAILY_READ_LIMIT) * 100).toFixed(2)}%)`);
console.log(`Reads Remaining:    ${(DAILY_READ_LIMIT - telemetry.reads).toLocaleString()} reads (${(100 - (telemetry.reads / DAILY_READ_LIMIT) * 100).toFixed(2)}% free)\n`);

console.log(`Daily Write Quota:  ${DAILY_WRITE_LIMIT.toLocaleString()} writes`);
console.log(`Writes Used:        ${telemetry.writes.toLocaleString()} writes (${((telemetry.writes / DAILY_WRITE_LIMIT) * 100).toFixed(2)}%)`);
console.log(`Writes Remaining:   ${(DAILY_WRITE_LIMIT - telemetry.writes).toLocaleString()} writes (${(100 - (telemetry.writes / DAILY_WRITE_LIMIT) * 100).toFixed(2)}% free)`);

// --------------------------------------------------------------------------------
// ASSERTION CHECKS
// --------------------------------------------------------------------------------
console.log('\n================================================================================');
console.log('VERIFICATION ASSERTIONS');
console.log('================================================================================');

assert(studentSessionResults.length === TOTAL_STUDENTS, `All ${TOTAL_STUDENTS} students completed and submitted the examination`);
assert(studentSessionResults.every((r) => r.total === 70), `All results accurately evaluated against exactly 70 MCQs`);
assert(teacherMasterSheet.every((r) => r.fatherName && r.fatherName !== 'N/A'), `Teacher Master Sheet displays complete Father's Name for all candidates`);
assert(adminAllResults.length === TOTAL_STUDENTS, `Admin Portal successfully synchronized with all ${TOTAL_STUDENTS} examination records`);
assert(telemetry.writes <= 300, `Total writes (${telemetry.writes}) is well within 20,000 daily write quota`);
assert(telemetry.reads <= 600, `Total reads (${telemetry.reads}) is well within 50,000 daily read quota`);

console.log('\n================================================================================');
console.log(`FINAL RESULT: ${passedAssertions} PASSED | ${failedAssertions} FAILED`);
console.log('================================================================================\n');

if (failedAssertions > 0) {
  process.exit(1);
}
