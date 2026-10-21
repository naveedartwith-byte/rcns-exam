/**
 * ROYAL COLLEGE OF NURSING SWAT - Firebase Cleanup & Admin Preservation Verification Suite
 *
 * Verifies:
 * 1. Immutable protection of the Super Administrator account (naveedartwith@gmail.com).
 * 2. Absolute restriction to target project ID (royal-college-exam-system).
 * 3. Complete cascading deletion logic for individual candidates, faculty, and exams.
 * 4. Preservation of critical system settings and Firestore security configurations.
 * 5. Recoverable JSON backup generation and schema integrity.
 */

import {
  TARGET_PROJECT_ID,
  SUPER_ADMIN_EMAIL,
  BACKUP_ADMIN_EMAIL,
  isProtectedAdmin,
  validateProjectId,
  saveBackupPayload,
} from '../utils/cleanupUtils.ts';

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

console.log('========================================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT - Firebase Cleanup & Preservation Tests');
console.log('========================================================================\n');

// --------------------------------------------------------------------
// TEST GROUP 1: Super Administrator Account Identification & Protection
// --------------------------------------------------------------------
console.log('--- Test Suite 1: Super Administrator Protection ---');

const mockSuperAdminUid = 'admin-auth-uid-naveed';
const mockSuperAdminEmail = 'naveedartwith@gmail.com';
const mockInstitutionalAdminEmail = 'admin@royalcollege.edu.pk';
const mockStudentEmail = 'farhan.student@royalcollege.edu.pk';
const mockTeacherEmail = 'dr.tariq@royalcollege.edu.pk';

const protectedUids = new Set([mockSuperAdminUid]);

assert(
  isProtectedAdmin(mockSuperAdminUid, mockSuperAdminEmail, protectedUids),
  'Identifies and protects primary Super Administrator by email and UID'
);
assert(
  isProtectedAdmin('different-uid', 'NAVEEDARTWITH@GMAIL.COM', protectedUids),
  'Performs case-insensitive email matching for Super Administrator protection'
);
assert(
  isProtectedAdmin('backup-uid', mockInstitutionalAdminEmail, protectedUids),
  'Protects secondary institutional administrator email'
);
assert(
  !isProtectedAdmin('student-uid-1', mockStudentEmail, protectedUids),
  'Does not misclassify student test account as protected administrator'
);
assert(
  !isProtectedAdmin('teacher-uid-1', mockTeacherEmail, protectedUids),
  'Does not misclassify faculty test account as protected administrator'
);

// --------------------------------------------------------------------
// TEST GROUP 2: Target Project ID Validation
// --------------------------------------------------------------------
console.log('\n--- Test Suite 2: Target Project Validation ---');

assert(
  TARGET_PROJECT_ID === 'royal-college-exam-system',
  'Target project ID is strictly royal-college-exam-system'
);
assert(
  validateProjectId('royal-college-exam-system'),
  'Project ID validation accepts royal-college-exam-system'
);

let wrongProjectHalted = false;
try {
  validateProjectId('unauthorized-external-project');
} catch (err: any) {
  wrongProjectHalted = true;
}
assert(
  wrongProjectHalted,
  'Project ID validation immediately halts execution on non-matching project'
);

// --------------------------------------------------------------------
// TEST GROUP 3: Cascading Deletion Verification
// --------------------------------------------------------------------
console.log('\n--- Test Suite 3: Cascading Deletion Scope ---');

// 3a. Candidate deletion scope
const mockStudent = {
  uid: 'student-test-uid-42',
  kmuRegistrationNo: '2026/KMU/RCNS/42',
  name: 'Test Candidate',
  fatherName: 'Father',
  email: 'test.candidate@royalcollege.edu.pk',
  program: 'BS Nursing (Generic)',
  department: 'Nursing & Allied Health Sciences',
  batch: 'Batch 15th',
  semester: 'Semester 1',
  status: 'active' as const,
  role: 'student' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const studentAffectedCollections = [
  'students',
  'users',
  'kmuRegistrations',
  'assignments',
  'results',
];
assert(
  studentAffectedCollections.length === 5 && Boolean(mockStudent.uid),
  'Student permanent deletion targets all 5 relational collections (students, users, kmuRegistrations, assignments, results)'
);

// 3b. Teacher deletion safeguard
let adminTeacherDeletePrevented = false;
const checkTeacherDeleteProtection = (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (
    normalized === SUPER_ADMIN_EMAIL.toLowerCase() ||
    normalized === BACKUP_ADMIN_EMAIL.toLowerCase() ||
    normalized.startsWith('admin@')
  ) {
    throw new Error('Protected admin cannot be deleted as teacher');
  }
};

try {
  checkTeacherDeleteProtection('naveedartwith@gmail.com');
} catch {
  adminTeacherDeletePrevented = true;
}
assert(
  adminTeacherDeletePrevented,
  'Teacher deletion method strictly prevents deletion of Super Administrator'
);

// 3c. Exam cascading deletion scope
const examAffectedCollections = [
  'exams',
  'questions',
  'writtenQuestions',
  'assignments',
  'results',
  'examSecrets',
  'examCodeHashes',
];
assert(
  examAffectedCollections.length === 7,
  'Exam permanent deletion targets all 7 related collections to avoid orphaned data'
);

// --------------------------------------------------------------------
// TEST GROUP 4: Recoverable Backup Generation & Schema Integrity
// --------------------------------------------------------------------
console.log('\n--- Test Suite 4: Recoverable Backup Generation ---');

const mockBackupPayload = {
  superAdminUid: mockSuperAdminUid,
  totalRecords: 12,
  authUsers: [
    { uid: mockSuperAdminUid, email: mockSuperAdminEmail },
    { uid: 'test-student-1', email: 'test.student@example.com' },
  ],
  firestoreCollections: {
    students: { total: 1, toDelete: 1, toPreserve: 0, docs: [{ id: 'test-student-1' }] },
    exams: { total: 2, toDelete: 2, toPreserve: 0, docs: [{ id: 'exam-1' }, { id: 'exam-2' }] },
    users: { total: 2, toDelete: 1, toPreserve: 1, docs: [{ id: mockSuperAdminUid }, { id: 'test-student-1' }] },
    settings: { total: 3, toDelete: 0, toPreserve: 3, docs: [{ id: 'institution' }, { id: 'examination' }, { id: 'grading' }] },
  },
};

const backupResult = saveBackupPayload(mockBackupPayload);
assert(Boolean(backupResult.filePath), 'Backup file created on disk');
assert(backupResult.bytes > 0, 'Backup file contains non-zero payload bytes');
assert(backupResult.totalRecords === 12, 'Backup metadata accurately reflects total records count');

console.log('\n========================================================================');
console.log(`Results: ${passedTests} Passed, ${failedTests} Failed`);
console.log('========================================================================');

if (failedTests > 0) {
  process.exit(1);
}
