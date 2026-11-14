import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

// 1. Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync('royal-college-exam-system-firebase-adminsdk-fbsvc-d0043821f3.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

// Global Telemetry Tracker
const telemetry = {
  reads: 0,
  writes: 0,
  deletes: 0,
  logRead(count = 1) { this.reads += count; },
  logWrite(count = 1) { this.writes += count; },
  logDelete(count = 1) { this.deletes += count; },
  reset() { this.reads = 0; this.writes = 0; this.deletes = 0; }
};

const TOTAL_STUDENTS = 80;
const TOTAL_QUESTIONS = 100;
const TEST_EXAM_ID = `audit_exam_80s_100q_${Date.now()}`;
const TEST_TAG = `audit_test_${Date.now()}`;

console.log('================================================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT — REAL LIVE FIRESTORE QUOTA AUDIT');
console.log(`Simulation Target: ${TOTAL_STUDENTS} Students | ${TOTAL_QUESTIONS} MCQs Comprehensive Examination`);
console.log(`Live Project: royal-college-exam-system`);
console.log('================================================================================\n');

async function runLiveAudit() {
  const stageStats = {};

  // ---------------------------------------------------------------------------
  // STAGE 1: CREATE 100-MCQ EXAMINATION ON LIVE FIRESTORE
  // ---------------------------------------------------------------------------
  console.log('▶ [STAGE 1] Creating Examination with 100 MCQs in Firestore...');
  telemetry.reset();

  const mockQuestions = [];
  const optionsLetters = ['A', 'B', 'C', 'D'];
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) {
    mockQuestions.push({
      id: `q_audit_${i.toString().padStart(3, '0')}`,
      examId: TEST_EXAM_ID,
      question: `Clinical Assessment Question ${i}: What is the primary priority nursing intervention?`,
      options: [
        `Option A: Protocol ${i}`,
        `Option B: Protocol ${i} B`,
        `Option C: Protocol ${i} C`,
        `Option D: Protocol ${i} D`,
      ],
      correctAnswer: optionsLetters[(i - 1) % 4],
      marks: 1,
      order: i,
    });
  }

  // Sanitized questions (for student client)
  const sanitizedQuestions = mockQuestions.map((q) => ({
    id: q.id,
    examId: q.examId,
    question: q.question,
    options: q.options,
    marks: q.marks,
    order: q.order,
  }));

  const examDocRef = db.collection('exams').doc(TEST_EXAM_ID);
  await examDocRef.set({
    id: TEST_EXAM_ID,
    title: 'Comprehensive Final Audit Examination (100 MCQs)',
    subject: 'Fundamentals of Clinical Nursing',
    type: 'exam',
    batch: 'Batch 20th',
    semester: 'Semester 1',
    program: 'BS Nursing (Generic)',
    department: 'Nursing & Allied Health Sciences',
    duration: 120, // 2 Hours
    passingMarks: 50,
    totalMarks: 100,
    questionCount: 100,
    status: 'scheduled',
    startAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    endAt: new Date(Date.now() + 1000 * 60 * 180).toISOString(),
    sanitizedQuestions,
    questions: mockQuestions,
    teacherId: 'vT6Myav7NVSXBCzGSxg9a29Dbfe2', // Farhan
    teacherName: 'FARHAN',
    testTag: TEST_TAG,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  telemetry.logWrite(1);

  stageStats.stage1 = { ...telemetry };
  console.log(`  ✓ Exam created with 100 embedded questions. Writes: ${telemetry.writes}, Reads: ${telemetry.reads}\n`);

  // ---------------------------------------------------------------------------
  // STAGE 2: REGISTER / CREATE 80 TEST CANDIDATES
  // ---------------------------------------------------------------------------
  console.log(`▶ [STAGE 2] Provisioning ${TOTAL_STUDENTS} Candidate Profiles in Firestore...`);
  telemetry.reset();

  const studentUids = [];
  const BATCH_SIZE = 250;
  let batch = db.batch();
  let opCount = 0;

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    const num = i.toString().padStart(3, '0');
    const uid = `test_std_${TEST_TAG}_${num}`;
    studentUids.push(uid);
    const kmu = `2026/KMU/AUDIT/${num}`;
    const name = `Candidate ${num}`;
    const fatherName = `Father ${num}`;

    // 1. students/{uid}
    batch.set(db.collection('students').doc(uid), {
      uid,
      name,
      fatherName,
      kmuRegistrationNo: kmu,
      batch: 'Batch 20th',
      semester: 'Semester 1',
      program: 'BS Nursing (Generic)',
      department: 'Nursing & Allied Health Sciences',
      role: 'student',
      status: 'active',
      testTag: TEST_TAG,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    telemetry.logWrite(1);
    opCount++;

    // 2. users/{uid}
    batch.set(db.collection('users').doc(uid), {
      uid,
      name,
      kmuRegistrationNo: kmu,
      role: 'student',
      testTag: TEST_TAG,
      createdAt: FieldValue.serverTimestamp(),
    });
    telemetry.logWrite(1);
    opCount++;

    // 3. kmuRegistrations/{normalizedKmu}
    const normKmu = `2026-kmu-audit-${num}`;
    batch.set(db.collection('kmuRegistrations').doc(normKmu), {
      kmuRegistrationNo: kmu,
      normalizedRegistrationNo: normKmu,
      uid,
      testTag: TEST_TAG,
    });
    telemetry.logWrite(1);
    opCount++;

    if (opCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  stageStats.stage2 = { ...telemetry };
  console.log(`  ✓ ${TOTAL_STUDENTS} Student profiles provisioned in Firestore.`);
  console.log(`  Writes: ${telemetry.writes} (3 docs per student: students + users + kmuRegistrations), Reads: ${telemetry.reads}\n`);

  // ---------------------------------------------------------------------------
  // STAGE 3: 80 STUDENTS LOGGING IN & FETCHING EXAMINATION SCHEDULE
  // ---------------------------------------------------------------------------
  console.log(`▶ [STAGE 3] Simulating ${TOTAL_STUDENTS} Students Logging In & Fetching Schedule...`);
  telemetry.reset();

  for (let i = 0; i < TOTAL_STUDENTS; i++) {
    const uid = studentUids[i];
    const num = (i + 1).toString().padStart(3, '0');
    const normKmu = `2026-kmu-audit-${num}`;

    // 1. KMU Login: getDoc(kmuRegistrations) -> 1 read
    await db.collection('kmuRegistrations').doc(normKmu).get();
    telemetry.logRead(1);

    // 2. Auth Context: getDoc(users/{uid}) -> 1 read
    await db.collection('users').doc(uid).get();
    telemetry.logRead(1);

    // 3. Student Profile: getDoc(students/{uid}) -> 1 read
    const sSnap = await db.collection('students').doc(uid).get();
    telemetry.logRead(1);
    const sProfile = sSnap.data();

    // 4. Student Schedule Fetch: getAuthorizedExamsForStudent:
    // a) query(assignments, where studentId == uid) -> 0 assignments initially
    const aQuery = await db.collection('assignments').where('studentId', '==', uid).get();
    telemetry.logRead(aQuery.size); // In Firestore, reading an empty result is 0 or 1 index read, docs = count

    // b) query(exams, where program, semester, status in [...]) -> matches 1-2 exams
    const eQuery = await db.collection('exams')
      .where('program', '==', sProfile.program)
      .where('semester', '==', sProfile.semester)
      .where('status', 'in', ['scheduled', 'active', 'completed'])
      .get();
    telemetry.logRead(eQuery.size);
  }

  stageStats.stage3 = { ...telemetry };
  console.log(`  ✓ ${TOTAL_STUDENTS} Students authenticated & loaded schedule.`);
  console.log(`  Telemetry Stage 3: ${telemetry.reads} Reads (~4 reads per student) | ${telemetry.writes} Writes\n`);

  // ---------------------------------------------------------------------------
  // STAGE 4: 80 STUDENTS LAUNCHING, ANSWERING 100 MCQS & SUBMITTING
  // ---------------------------------------------------------------------------
  console.log(`▶ [STAGE 4] Simulating ${TOTAL_STUDENTS} Students Launching Exam, Answering 100 MCQs & Submitting...`);
  telemetry.reset();

  let submissionBatch = db.batch();
  let subCount = 0;

  for (let i = 0; i < TOTAL_STUDENTS; i++) {
    const uid = studentUids[i];
    const num = (i + 1).toString().padStart(3, '0');
    const assignmentId = `${TEST_EXAM_ID}_${uid}`;

    // Step A: Launch exam -> Ensure assignment created (1 write)
    submissionBatch.set(db.collection('assignments').doc(assignmentId), {
      id: assignmentId,
      examId: TEST_EXAM_ID,
      studentId: uid,
      studentName: `Candidate ${num}`,
      kmuRegistrationNo: `2026/KMU/AUDIT/${num}`,
      fatherName: `Father ${num}`,
      program: 'BS Nursing (Generic)',
      semester: 'Semester 1',
      batch: 'Batch 20th',
      status: 'started',
      startedAt: FieldValue.serverTimestamp(),
      testTag: TEST_TAG,
    });
    telemetry.logWrite(1);
    subCount++;

    // Step B: In-Exam Testing (2 Hours, 100 Questions)
    // - Local countdown timer runs in browser JavaScript memory: 0 Firestore writes!
    // - Local answer clicks stored in browser localStorage: 0 Firestore writes!
    // - Zero heartbeat ping loop: 0 Firestore writes!
    const candidateAnswers = {};
    for (let q = 1; q <= TOTAL_QUESTIONS; q++) {
      candidateAnswers[`q_audit_${q.toString().padStart(3, '0')}`] = (i + q) % 4;
    }

    // Step C: Student Submits Examination:
    // 1. Update assignment to 'submitted' (1 write)
    submissionBatch.update(db.collection('assignments').doc(assignmentId), {
      status: 'submitted',
      answers: candidateAnswers,
      answersCount: 100,
      submittedAt: FieldValue.serverTimestamp(),
    });
    telemetry.logWrite(1);
    subCount++;

    // 2. Instant Grading & Record in results collection (1 write)
    const resultId = `${TEST_EXAM_ID}_${uid}`;
    const obtainedScore = 75 + (i % 25); // Score 75 to 99 out of 100
    submissionBatch.set(db.collection('results').doc(resultId), {
      id: resultId,
      examId: TEST_EXAM_ID,
      studentId: uid,
      studentName: `Candidate ${num}`,
      fatherName: `Father ${num}`,
      kmuRegistrationNo: `2026/KMU/AUDIT/${num}`,
      examTitle: 'Comprehensive Final Audit Examination (100 MCQs)',
      examType: 'exam',
      subject: 'Fundamentals of Clinical Nursing',
      program: 'BS Nursing (Generic)',
      semester: 'Semester 1',
      batch: 'Batch 20th',
      marks: obtainedScore,
      totalMarks: 100,
      percentage: obtainedScore,
      passed: obtainedScore >= 50,
      grade: obtainedScore >= 80 ? 'A' : 'B',
      status: 'graded',
      answersCount: 100,
      correctCount: obtainedScore,
      totalQuestions: 100,
      totalMCQs: 100,
      submittedAt: FieldValue.serverTimestamp(),
      testTag: TEST_TAG,
    });
    telemetry.logWrite(1);
    subCount++;

    if (subCount >= BATCH_SIZE) {
      await submissionBatch.commit();
      submissionBatch = db.batch();
      subCount = 0;
    }
  }

  if (subCount > 0) {
    await submissionBatch.commit();
  }

  stageStats.stage4 = { ...telemetry };
  console.log(`  ✓ All ${TOTAL_STUDENTS} students completed and submitted 100 MCQs.`);
  console.log(`  Telemetry Stage 4: Reads: ${telemetry.reads} | Writes: ${telemetry.writes} (Exactly 3 writes per student: start + submit + result)\n`);

  // ---------------------------------------------------------------------------
  // STAGE 5: TEACHER PORTAL INSPECTION (TEACHER LOGIN & VIEW RESULTS)
  // ---------------------------------------------------------------------------
  console.log(`▶ [STAGE 5] Simulating Teacher Logging In & Viewing Submissions & Results...`);
  telemetry.reset();

  // 1. Teacher Dashboard:
  // - Reads exams created by this teacher
  const teacherExamsSnap = await db.collection('exams').where('teacherId', '==', 'vT6Myav7NVSXBCzGSxg9a29Dbfe2').get();
  telemetry.logRead(teacherExamsSnap.size);

  // 2. Teacher clicks "Submissions & Results" for this exam:
  // - resultService.getResultsByExamId:
  const tResultsSnap = await db.collection('results').where('examId', '==', TEST_EXAM_ID).get();
  telemetry.logRead(tResultsSnap.size); // Returns 80 result documents = 80 reads

  stageStats.stage5 = { ...telemetry, teacherExamsCount: teacherExamsSnap.size, resultsCount: tResultsSnap.size };
  console.log(`  ✓ Teacher loaded Dashboard and Exam Submissions.`);
  console.log(`  Telemetry Stage 5: Reads: ${telemetry.reads} (Exam query + ${tResultsSnap.size} submitted student results) | Writes: ${telemetry.writes}\n`);

  // ---------------------------------------------------------------------------
  // STAGE 6: ADMIN PORTAL INSPECTION (ADMIN LOGIN & VIEW ALL SECTIONS)
  // ---------------------------------------------------------------------------
  console.log(`▶ [STAGE 6] Simulating Admin Logging In & Navigating All Sections...`);
  telemetry.reset();

  // Section 1: Admin Dashboard:
  // - 5 count aggregations (getCountFromServer) = ~5 reads
  telemetry.logRead(5);
  // - getRecentExams(4) = 4 reads
  const recentExamsSnap = await db.collection('exams').limit(4).get();
  telemetry.logRead(recentExamsSnap.size);
  // - getAllResults() for overall analytics = reads results in database
  const allResultsSnap = await db.collection('results').get();
  telemetry.logRead(allResultsSnap.size);

  const adminDashboardReads = telemetry.reads;

  // Section 2: Admin Examinations:
  // - getAllExams()
  const allExamsSnap = await db.collection('exams').get();
  telemetry.logRead(allExamsSnap.size);

  // Section 3: Admin Results / Reports (ExamResultsReportsView):
  // - getAllStudents() to enrich names
  const allStudentsSnap = await db.collection('students').get();
  telemetry.logRead(allStudentsSnap.size);
  // - getResultsByExamId() for selected exam
  const examResultsSnap = await db.collection('results').where('examId', '==', TEST_EXAM_ID).get();
  telemetry.logRead(examResultsSnap.size);
  // - getExamCandidateRoster() for selected exam
  const examAssignSnap = await db.collection('assignments').where('examId', '==', TEST_EXAM_ID).get();
  telemetry.logRead(examAssignSnap.size);

  stageStats.stage6 = {
    ...telemetry,
    adminDashboardReads,
    totalResultsInDb: allResultsSnap.size,
    totalExamsInDb: allExamsSnap.size,
    totalStudentsInDb: allStudentsSnap.size,
  };
  console.log(`  ✓ Admin navigated Dashboard, Examinations, and Results/Reports.`);
  console.log(`  Telemetry Stage 6: Total Admin Reads: ${telemetry.reads} | Writes: ${telemetry.writes}\n`);

  // ---------------------------------------------------------------------------
  // STAGE 7: SAFE CLEANUP OF ALL 80 TEST STUDENTS & TEST EXAM
  // ---------------------------------------------------------------------------
  console.log(`▶ [STAGE 7] Cleaning Up All Test Records from Firestore...`);
  telemetry.reset();

  let delBatch = db.batch();
  let delCount = 0;

  // Delete test exam
  delBatch.delete(examDocRef);
  telemetry.logDelete(1);
  delCount++;

  // Delete test students, users, and kmuRegistrations
  for (let i = 0; i < TOTAL_STUDENTS; i++) {
    const uid = studentUids[i];
    const num = (i + 1).toString().padStart(3, '0');
    const normKmu = `2026-kmu-audit-${num}`;

    delBatch.delete(db.collection('students').doc(uid));
    telemetry.logDelete(1);
    delCount++;

    delBatch.delete(db.collection('users').doc(uid));
    telemetry.logDelete(1);
    delCount++;

    delBatch.delete(db.collection('kmuRegistrations').doc(normKmu));
    telemetry.logDelete(1);
    delCount++;

    delBatch.delete(db.collection('assignments').doc(`${TEST_EXAM_ID}_${uid}`));
    telemetry.logDelete(1);
    delCount++;

    delBatch.delete(db.collection('results').doc(`${TEST_EXAM_ID}_${uid}`));
    telemetry.logDelete(1);
    delCount++;

    if (delCount >= BATCH_SIZE) {
      await delBatch.commit();
      delBatch = db.batch();
      delCount = 0;
    }
  }

  if (delCount > 0) {
    await delBatch.commit();
  }

  stageStats.stage7 = { ...telemetry };
  console.log(`  ✓ All ${delCount} test records permanently cleaned up from Firestore.`);
  console.log(`  Deletes: ${telemetry.deletes}\n`);

  // ---------------------------------------------------------------------------
  // COMPREHENSIVE TELEMETRY AUDIT REPORT
  // ---------------------------------------------------------------------------
  console.log('================================================================================');
  console.log('COMPREHENSIVE TELEMETRY AUDIT REPORT (80 STUDENTS x 100 MCQS REAL FIRESTORE)');
  console.log('================================================================================');
  console.log(`1. Stage 1 (Create 100-MCQ Exam):    ${stageStats.stage1.reads} Reads  |  ${stageStats.stage1.writes} Writes`);
  console.log(`2. Stage 2 (Provision 80 Students):   ${stageStats.stage2.reads} Reads  |  ${stageStats.stage2.writes} Writes`);
  console.log(`3. Stage 3 (80 Students Login):       ${stageStats.stage3.reads} Reads  |  ${stageStats.stage3.writes} Writes`);
  console.log(`4. Stage 4 (80 Students x 100 MCQs):  ${stageStats.stage4.reads} Reads  |  ${stageStats.stage4.writes} Writes`);
  console.log(`5. Stage 5 (Teacher View Results):    ${stageStats.stage5.reads} Reads  |  ${stageStats.stage5.writes} Writes`);
  console.log(`6. Stage 6 (Admin Navigate All):      ${stageStats.stage6.reads} Reads  |  ${stageStats.stage6.writes} Writes`);
  console.log(`7. Stage 7 (Test Data Cleanup):       ${stageStats.stage7.reads} Reads  |  ${stageStats.stage7.deletes} Deletes`);
  console.log('--------------------------------------------------------------------------------');

  const grandTotalReads =
    stageStats.stage1.reads +
    stageStats.stage2.reads +
    stageStats.stage3.reads +
    stageStats.stage4.reads +
    stageStats.stage5.reads +
    stageStats.stage6.reads;

  const grandTotalExamWrites =
    stageStats.stage1.writes +
    stageStats.stage2.writes +
    stageStats.stage3.writes +
    stageStats.stage4.writes;

  console.log(`GRAND TOTAL FIRESTORE READS GENERATED:  ${grandTotalReads} reads`);
  console.log(`GRAND TOTAL FIRESTORE WRITES GENERATED: ${grandTotalExamWrites} writes`);
  console.log(`GRAND TOTAL FIRESTORE DELETES:          ${stageStats.stage7.deletes} deletes\n`);

  console.log('================================================================================');
  console.log('FIREBASE SPARK FREE TIER DAILY QUOTA UTILIZATION');
  console.log('================================================================================');
  console.log(`Daily Read Quota:   50,000 reads`);
  console.log(`Reads Consumed:     ${grandTotalReads} reads (${((grandTotalReads / 50000) * 100).toFixed(2)}% of daily quota)`);
  console.log(`Daily Reads Free:   ${50000 - grandTotalReads} reads remaining (SAFE)\n`);

  console.log(`Daily Write Quota:  20,000 writes`);
  console.log(`Writes Consumed:    ${grandTotalExamWrites} writes (${((grandTotalExamWrites / 20000) * 100).toFixed(2)}% of daily quota)`);
  console.log(`Daily Writes Free:  ${20000 - grandTotalExamWrites} writes remaining (SAFE)\n`);

  return stageStats;
}

runLiveAudit()
  .then(() => {
    console.log('AUDIT COMPLETED SUCCESSFULLY.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Audit failed:', err);
    process.exit(1);
  });

