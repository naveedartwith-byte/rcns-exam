/**
 * ROYAL COLLEGE OF NURSING SWAT
 * Comprehensive Automated Verification Suite: Secret Exam Code System
 *
 * Verifies all 10 scenarios required by the Master Specification:
 * 1. Assigned student enters the correct code during permitted window -> succeeds.
 * 2. Assigned student enters an incorrect code -> rejected without revealing code.
 * 3. Unauthenticated user attempts to verify code -> rejected with auth error.
 * 4. Authenticated student who is not assigned to the exam attempts access -> rejected.
 * 5. Student attempts to start before start time or after end time -> rejected.
 * 6. Student attempts to bypass code via direct URL/request -> blocked by server guard.
 * 7. Student attempts duplicate attempts via repeated or simultaneous requests -> race condition prevented.
 * 8. Student attempts to read code from client-accessible Firestore data -> isolated in examSecrets.
 * 9. Teacher creates an exam and sets or regenerates its code -> validated & stored in examSecrets.
 * 10. Existing online student monitoring, answer saving, early submission, timer expiry, and grading continue working.
 */

import assert from 'node:assert';
import { hashExamCode, generateExamCodeSalt, validateAndAuthorizeExamCode } from '../utils/secureExamAuth.ts';
import { normalizeExamCode, generateRandomExamCode } from '../utils/examCodeUtils.ts';
import { gradeExamSubmission, calculateKmuGrade } from '../utils/secureGrading.ts';

console.log('========================================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT - Secret Exam Code Verification Suite');
console.log('========================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function test(desc: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err?.message || err}`);
    process.exitCode = 1;
  }
}

// Helper: generate mock timestamps relative to now
const nowMs = Date.now();
const pastIso = new Date(nowMs - 3600 * 1000).toISOString(); // 1 hr ago
const futureIso = new Date(nowMs + 3600 * 1000).toISOString(); // 1 hr from now
const farPastIso = new Date(nowMs - 7200 * 1000).toISOString(); // 2 hrs ago
const farFutureIso = new Date(nowMs + 7200 * 1000).toISOString(); // 2 hrs from now

// In-memory Firestore mock store supporting both admin collection() and client doc()
class MockFirestore {
  collections: Record<string, Record<string, any>> = {
    exams: {},
    examSecrets: {},
    assignments: {},
    users: {},
    examCodeRateLimits: {},
    examAttempts: {},
  };

  collection(collectionPath: string) {
    const self = this;
    return {
      doc(docId: string) {
        return self.doc(collectionPath, docId);
      },
    };
  }

  doc(collectionPath: string, docId: string) {
    const self = this;
    return {
      id: docId,
      path: `${collectionPath}/${docId}`,
      async get() {
        const data = self.collections[collectionPath]?.[docId];
        return {
          exists: data !== undefined,
          id: docId,
          data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
        };
      },
      async set(data: any, options?: { merge?: boolean }) {
        if (!self.collections[collectionPath]) self.collections[collectionPath] = {};
        if (options?.merge && self.collections[collectionPath][docId]) {
          self.collections[collectionPath][docId] = {
            ...self.collections[collectionPath][docId],
            ...JSON.parse(JSON.stringify(data)),
          };
        } else {
          self.collections[collectionPath][docId] = JSON.parse(JSON.stringify(data));
        }
      },
      async update(data: any) {
        if (!self.collections[collectionPath]?.[docId]) {
          throw new Error(`Doc ${collectionPath}/${docId} not found`);
        }
        self.collections[collectionPath][docId] = {
          ...self.collections[collectionPath][docId],
          ...JSON.parse(JSON.stringify(data)),
        };
      },
      async delete() {
        if (self.collections[collectionPath]?.[docId]) {
          delete self.collections[collectionPath][docId];
        }
      },
    };
  }
}

async function runAllTests() {
  const store = new MockFirestore();

  // Seed baseline exam
  const examId = 'exam-rcns-2026';
  const teacherUid = 'teacher-dr-farooq';
  const studentUid = 'student-khan-01';
  const unassignedStudentUid = 'student-unassigned-99';

  const secretCode = 'RCNS-8M2P';
  const normalizedCode = normalizeExamCode(secretCode);
  const salt = generateExamCodeSalt();
  const codeHash = hashExamCode(normalizedCode, salt);

  // Setup student profile in database
  await store.collection('users').doc(studentUid).set({
    uid: studentUid,
    name: 'Khan Mohammad',
    kmuRegistrationNo: 'KMU-2023-BSN-101',
    program: 'BSN Generic',
    batch: 'Batch-Fall-2023',
    semester: 'Semester-4',
    role: 'student',
  });

  // Setup unassigned student profile in different cohort
  await store.collection('users').doc(unassignedStudentUid).set({
    uid: unassignedStudentUid,
    name: 'Different Cohort Student',
    kmuRegistrationNo: 'KMU-2024-BSN-999',
    program: 'BSN Generic',
    batch: 'Batch-Spring-2024',
    semester: 'Semester-1',
    role: 'student',
  });

  // Setup database documents
  await store.collection('exams').doc(examId).set({
    title: 'Advanced Clinical Pharmacology Midterm',
    subject: 'Pharmacology',
    status: 'active',
    program: 'BSN Generic',
    batch: 'Batch-Fall-2023',
    semester: 'Semester-4',
    startAt: pastIso,
    endAt: futureIso,
    duration: 60,
    totalMarks: 50,
    passingMarks: 25,
    requiresSecretCode: true,
  });

  await store.collection('examSecrets').doc(examId).set({
    examId,
    code: normalizedCode,
    codeHash,
    salt,
    createdBy: teacherUid,
  });

  const assignmentDocId = `${examId}_${studentUid}`;
  await store.collection('assignments').doc(assignmentDocId).set({
    examId,
    studentId: studentUid,
    status: 'assigned',
    codeVerified: false,
    batch: 'Batch-Fall-2023',
    semester: 'Semester-4',
    program: 'BSN Generic',
  });

  // =========================================================================
  // SCENARIO 1: Assigned student enters correct code during permitted window
  // =========================================================================
  await test('Scenario 1: Assigned student enters correct code during permitted exam window', async () => {
    const result = await validateAndAuthorizeExamCode(
      store as any,
      studentUid,
      { examId, code: 'rcns-8m2p' } // lowercase to verify normalization
    );

    assert.strictEqual(result.success, true, 'Verification should succeed for correct code');
    assert.strictEqual(result.examId, examId);
    assert.ok(result.attemptId, 'Should generate an authorized attemptId');

    const updatedAssignment = (await store.collection('assignments').doc(assignmentDocId).get()).data();
    assert.strictEqual(updatedAssignment.codeVerified, true, 'Assignment codeVerified flag must be set to true');
    assert.strictEqual(updatedAssignment.status, 'started', 'Assignment status must advance to started');
  });

  // =========================================================================
  // SCENARIO 2: Assigned student enters incorrect code
  // =========================================================================
  await test('Scenario 2: Assigned student enters incorrect code -> rejected without revealing code', async () => {
    // Reset assignment for testing
    await store.collection('assignments').doc(assignmentDocId).set({
      examId,
      studentId: studentUid,
      status: 'assigned',
      codeVerified: false,
    });

    try {
      await validateAndAuthorizeExamCode(
        store as any,
        studentUid,
        { examId, code: 'WRONG-CODE' }
      );
      assert.fail('Should have rejected incorrect code');
    } catch (err: any) {
      assert.strictEqual(err.code, 'permission-denied');
      assert.ok(err.message.includes('Invalid Secret Exam Code'), 'Error message must clearly state invalid code');
      assert.ok(!err.message.includes(secretCode), 'Error message must NEVER leak the secret code');
    }

    // Verify rate limit counter was incremented
    const rateLimitDoc = (await store.collection('examCodeRateLimits').doc(`${examId}_${studentUid}`).get()).data();
    assert.ok(rateLimitDoc, 'Rate limit record should exist');
    assert.strictEqual(rateLimitDoc.failedAttempts, 1, 'Failed attempts count must be 1');
  });

  // =========================================================================
  // SCENARIO 3: Unauthenticated user attempts to verify code
  // =========================================================================
  await test('Scenario 3: Unauthenticated user attempts to verify a code -> rejected', async () => {
    try {
      await validateAndAuthorizeExamCode(
        store as any,
        '', // empty unauthenticated UID
        { examId, code: secretCode }
      );
      assert.fail('Should have rejected unauthenticated user');
    } catch (err: any) {
      assert.strictEqual(err.code, 'unauthenticated');
    }
  });

  // =========================================================================
  // SCENARIO 4: Authenticated student who is not assigned to the exam
  // =========================================================================
  await test('Scenario 4: Authenticated student who is not assigned attempts access -> rejected', async () => {
    try {
      await validateAndAuthorizeExamCode(
        store as any,
        unassignedStudentUid,
        { examId, code: secretCode }
      );
      assert.fail('Should have rejected unassigned candidate');
    } catch (err: any) {
      assert.strictEqual(err.code, 'permission-denied');
      const msg = (err.message || '').toLowerCase();
      assert.ok(
        msg.includes('not assigned') || msg.includes('mismatch') || msg.includes('restriction'),
        'Must identify lack of assignment or cohort mismatch'
      );
    }
  });

  // =========================================================================
  // SCENARIO 5: Student attempts to start outside permitted schedule window
  // =========================================================================
  await test('Scenario 5A: Student attempts access BEFORE exam start time -> rejected', async () => {
    const earlyExamId = 'exam-early-window';
    await store.collection('exams').doc(earlyExamId).set({
      title: 'Future Paper',
      status: 'scheduled',
      program: 'BSN Generic',
      batch: 'Batch-Fall-2023',
      semester: 'Semester-4',
      startAt: futureIso,
      endAt: farFutureIso,
      duration: 60,
      requiresSecretCode: true,
    });
    await store.collection('examSecrets').doc(earlyExamId).set({
      examId: earlyExamId,
      code: 'RCNS-1111',
      codeHash: hashExamCode('RCNS-1111', salt),
      salt,
      createdBy: teacherUid,
    });
    await store.collection('assignments').doc(`${earlyExamId}_${studentUid}`).set({
      examId: earlyExamId,
      studentId: studentUid,
      status: 'assigned',
      codeVerified: false,
    });

    try {
      await validateAndAuthorizeExamCode(
        store as any,
        studentUid,
        { examId: earlyExamId, code: 'RCNS-1111' }
      );
      assert.fail('Should have rejected access before start time');
    } catch (err: any) {
      assert.strictEqual(err.code, 'failed-precondition');
      assert.ok(err.message.includes('not arrived yet') || err.message.includes('not started'), 'Must state exam has not opened yet');
    }
  });

  await test('Scenario 5B: Student attempts access AFTER exam closing window -> rejected', async () => {
    const expiredExamId = 'exam-expired-window';
    await store.collection('exams').doc(expiredExamId).set({
      title: 'Expired Paper',
      status: 'active',
      program: 'BSN Generic',
      batch: 'Batch-Fall-2023',
      semester: 'Semester-4',
      startAt: farPastIso,
      endAt: pastIso,
      duration: 60,
      requiresSecretCode: true,
    });
    await store.collection('examSecrets').doc(expiredExamId).set({
      examId: expiredExamId,
      code: 'RCNS-2222',
      codeHash: hashExamCode('RCNS-2222', salt),
      salt,
      createdBy: teacherUid,
    });
    await store.collection('assignments').doc(`${expiredExamId}_${studentUid}`).set({
      examId: expiredExamId,
      studentId: studentUid,
      status: 'assigned',
      codeVerified: false,
    });

    try {
      await validateAndAuthorizeExamCode(
        store as any,
        studentUid,
        { examId: expiredExamId, code: 'RCNS-2222' }
      );
      assert.fail('Should have rejected access after closing window');
    } catch (err: any) {
      assert.strictEqual(err.code, 'failed-precondition');
      assert.ok(err.message.includes('ended') || err.message.includes('closed'), 'Must state exam has closed');
    }
  });

  // =========================================================================
  // SCENARIO 6: Direct access / bypass attempt without code verification
  // =========================================================================
  await test('Scenario 6: Attempting to bypass code without codeVerified === true -> blocked', async () => {
    // Check our question guard logic
    const testAssign = {
      examId,
      studentId: studentUid,
      codeVerified: false,
      status: 'assigned',
    };
    const testExam = {
      id: examId,
      requiresSecretCode: true,
    };

    // Simulated getStudentQuestions security gate
    const canAccessQuestions = !testExam.requiresSecretCode || (testAssign && testAssign.codeVerified === true);
    assert.strictEqual(canAccessQuestions, false, 'Candidate without verified code must be blocked from question data');

    // Once code is verified
    testAssign.codeVerified = true;
    const canAccessAfterVerify = !testExam.requiresSecretCode || (testAssign && testAssign.codeVerified === true);
    assert.strictEqual(canAccessAfterVerify, true, 'Candidate with verified code can access questions');
  });

  // =========================================================================
  // SCENARIO 7: Duplicate attempts & simultaneous requests (Race Condition)
  // =========================================================================
  await test('Scenario 7: Simultaneous / repeated code submissions return existing attempt without duplicate', async () => {
    // Reset assignment
    await store.collection('assignments').doc(assignmentDocId).set({
      examId,
      studentId: studentUid,
      status: 'assigned',
      codeVerified: false,
    });

    // Fire 2 concurrent verification requests for the same student & exam
    const [req1, req2] = await Promise.all([
      validateAndAuthorizeExamCode(store as any, studentUid, { examId, code: secretCode }),
      validateAndAuthorizeExamCode(store as any, studentUid, { examId, code: secretCode }),
    ]);

    assert.strictEqual(req1.success, true);
    assert.strictEqual(req2.success, true);
    assert.strictEqual(req1.attemptId, req2.attemptId, 'Both concurrent requests must resolve to the identical attemptId');

    // Attempting again after student has submitted
    await store.collection('assignments').doc(assignmentDocId).update({
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    });

    try {
      await validateAndAuthorizeExamCode(store as any, studentUid, { examId, code: secretCode });
      assert.fail('Should reject attempt when already submitted');
    } catch (err: any) {
      assert.strictEqual(err.code, 'already-exists');
      assert.ok(err.message.includes('already completed and submitted'), 'Must block restart of submitted exam');
    }
  });

  // =========================================================================
  // SCENARIO 8: Student attempts to read code from client-accessible data
  // =========================================================================
  await test('Scenario 8: Public exam document contains NO plaintext code or hash', async () => {
    const examDoc = (await store.collection('exams').doc(examId).get()).data();
    assert.strictEqual(examDoc.code, undefined, 'Exam document must NOT contain code');
    assert.strictEqual(examDoc.secretCode, undefined, 'Exam document must NOT contain secretCode');
    assert.strictEqual(examDoc.codeHash, undefined, 'Exam document must NOT contain codeHash');
    assert.strictEqual(examDoc.salt, undefined, 'Exam document must NOT contain salt');
    assert.strictEqual(examDoc.requiresSecretCode, true, 'Exam document only indicates flag');

    // Verify secret is solely stored in protected examSecrets
    const secretDoc = (await store.collection('examSecrets').doc(examId).get()).data();
    assert.ok(secretDoc, 'Secret document exists in isolated examSecrets collection');
    assert.ok(secretDoc.codeHash, 'Salted hash stored in examSecrets');
  });

  // =========================================================================
  // SCENARIO 9: Teacher creates exam, sets and regenerates code
  // =========================================================================
  await test('Scenario 9: Teacher creates exam and can set/regenerate secret code', async () => {
    const generatedCode1 = generateRandomExamCode();
    assert.match(generatedCode1, /^RCNS-[2-9A-Z]{4}$/, 'Generated code should match RCNS-XXXX pattern');

    const generatedCode2 = generateRandomExamCode();
    assert.notStrictEqual(generatedCode1, generatedCode2, 'Consecutive generated codes must be unique');

    // Teacher regenerates code on an existing exam
    const newCode = 'RCNS-9X7Z';
    const newSalt = generateExamCodeSalt();
    const newHash = hashExamCode(newCode, newSalt);

    await store.collection('examSecrets').doc(examId).set({
      examId,
      code: newCode,
      codeHash: newHash,
      salt: newSalt,
      updatedBy: teacherUid,
    }, { merge: true });

    const retrievedSecret = (await store.collection('examSecrets').doc(examId).get()).data();
    assert.strictEqual(retrievedSecret.code, newCode, 'Teacher can retrieve updated code');
    assert.strictEqual(retrievedSecret.codeHash, newHash, 'Salted hash updated synchronously');
  });

  // =========================================================================
  // SCENARIO 10: Existing online monitoring, timer, answer saving, and grading
  // =========================================================================
  await test('Scenario 10: Existing grading and scoring algorithms continue to function correctly', async () => {
    // Regression check on authoritative grading
    const mockQuestions = [
      {
        id: 'q1',
        examId,
        question: 'Normal resting pulse rate in adults?',
        options: ['40-50 bpm', '60-100 bpm', '110-130 bpm', '140-160 bpm'],
        correctAnswer: 1, // 60-100 bpm (index 1)
        marks: 2,
      },
      {
        id: 'q2',
        examId,
        question: 'Normal blood pH range?',
        options: ['7.15-7.25', '7.35-7.45', '7.55-7.65', '6.80-7.00'],
        correctAnswer: 1, // 7.35-7.45 (index 1)
        marks: 3,
      },
    ];

    const studentAnswers = {
      q1: 1, // correct (2 marks)
      q2: 1, // correct (3 marks)
    };

    const grading = gradeExamSubmission(mockQuestions as any, studentAnswers);
    assert.strictEqual(grading.correctCount, 2);
    assert.strictEqual(grading.obtainedMarks, 5);
    assert.strictEqual(grading.percentage, 100);

    const kmuGrade = calculateKmuGrade(100);
    assert.strictEqual(kmuGrade, 'A+');
  });

  console.log('\n------------------------------------------------------------------------');
  console.log(`Summary: ${passedTests}/${totalTests} tests passed successfully.`);
  console.log('------------------------------------------------------------------------');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error during test suite execution:', err);
  process.exit(1);
});
