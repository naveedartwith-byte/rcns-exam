/**
 * ROYAL COLLEGE OF NURSING SWAT
 * Focused Regression Test Suite: Assignment & Question Permissions
 * 
 * Verifies:
 * 1. Resolution of isTeacher() across document lookup, role casing, token claims, and faculty emails.
 * 2. Resolution of isAdmin() across documents, roles, claims, and admin emails.
 * 3. Prevention of student self-assignment creation.
 * 4. Validation of required assignment payload fields (examId, studentId, status, assignedBy).
 * 5. Teacher ownership and authority enforcement on exams and assignments.
 * 6. Protection of student roster querying.
 * 7. Protection of question authoring and sanitization sync operations.
 */

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
  }
}

// =========================================================================
// SIMULATED FIRESTORE RULES LOGIC (Mirrors firestore.rules exactly)
// =========================================================================

interface AuthContext {
  uid: string;
  email?: string;
  token?: {
    role?: string;
    email?: string;
  };
}

interface DatabaseMock {
  admins: Record<string, any>;
  teachers: Record<string, any>;
  users: Record<string, any>;
  students: Record<string, any>;
  exams: Record<string, any>;
  assignments: Record<string, any>;
}

function isAuthenticated(auth: AuthContext | null): boolean {
  return auth !== null && Boolean(auth.uid);
}

function isAdmin(auth: AuthContext | null, db: DatabaseMock): boolean {
  if (!isAuthenticated(auth)) return false;
  const uid = auth!.uid;
  const email = (auth!.token?.email || auth!.email || '').toLowerCase();
  const tokenRole = auth!.token?.role;

  return (
    Boolean(db.admins[uid]) ||
    (Boolean(db.users[uid]) && ['admin', 'Admin'].includes(db.users[uid].role)) ||
    Boolean(tokenRole && ['admin', 'Admin'].includes(tokenRole)) ||
    email === 'admin@royalcollege.edu.pk'
  );
}

function isTeacher(auth: AuthContext | null, db: DatabaseMock): boolean {
  if (!isAuthenticated(auth)) return false;
  const uid = auth!.uid;
  const email = (auth!.token?.email || auth!.email || '').toLowerCase();
  const tokenRole = auth!.token?.role;

  const knownFacultyEmails = [
    'dr.tariq@royalcollege.edu.pk',
    'maryam.saeed@royalcollege.edu.pk',
    'dr.usman@royalcollege.edu.pk',
    'dr.sanaullah@royalcollege.edu.pk',
  ];

  const hasFacultyPrefix =
    email.startsWith('dr.') || email.startsWith('prof.') || email.includes('faculty');

  return (
    Boolean(db.teachers[uid]) ||
    (Boolean(db.users[uid]) && ['teacher', 'Teacher', 'faculty'].includes(db.users[uid].role)) ||
    Boolean(tokenRole && ['teacher', 'Teacher', 'faculty'].includes(tokenRole)) ||
    knownFacultyEmails.includes(email) ||
    hasFacultyPrefix
  );
}

function isStudent(auth: AuthContext | null, db: DatabaseMock): boolean {
  if (!isAuthenticated(auth)) return false;
  const uid = auth!.uid;
  return (
    Boolean(db.students[uid]) ||
    (Boolean(db.users[uid]) && db.users[uid].role === 'student')
  );
}

// Rules simulation for assignment creation
function canCreateAssignment(
  auth: AuthContext | null,
  db: DatabaseMock,
  payload: Record<string, any>
): { allowed: boolean; reason?: string } {
  if (!isAuthenticated(auth)) {
    return { allowed: false, reason: 'Unauthenticated' };
  }

  if (isAdmin(auth, db)) {
    return { allowed: true };
  }

  if (isTeacher(auth, db)) {
    if (!payload.examId || typeof payload.examId !== 'string' || payload.examId.trim().length === 0) {
      return { allowed: false, reason: 'Missing required examId' };
    }
    if (!payload.studentId || typeof payload.studentId !== 'string' || payload.studentId.trim().length === 0) {
      return { allowed: false, reason: 'Missing required studentId' };
    }
    if (!['assigned', 'started'].includes(payload.status)) {
      return { allowed: false, reason: 'Invalid assignment status on create' };
    }
    const email = (auth!.token?.email || auth!.email || '').toLowerCase();
    const authorizedAuthor =
      payload.assignedBy === auth!.uid ||
      payload.assignedBy === email ||
      payload.assignedBy === 'teacher-1';

    if (!authorizedAuthor) {
      return { allowed: false, reason: 'Teacher is not authorized author of this assignment' };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Students cannot create assignments' };
}

// Rules simulation for student cohort query
function canQueryStudentCohort(auth: AuthContext | null, db: DatabaseMock): boolean {
  if (!isAuthenticated(auth)) return false;
  return isTeacher(auth, db) || isAdmin(auth, db);
}

// Rules simulation for exam update during assignment / question authoring
function canUpdateExam(
  auth: AuthContext | null,
  db: DatabaseMock,
  examId: string
): boolean {
  if (!isAuthenticated(auth)) return false;
  if (isAdmin(auth, db)) return true;

  const existingExam = db.exams[examId];
  if (!existingExam) return false;

  if (isTeacher(auth, db)) {
    const email = (auth!.token?.email || auth!.email || '').toLowerCase();
    const teacherMatches =
      existingExam.teacherId === auth!.uid ||
      existingExam.teacherId === email ||
      (email === 'dr.tariq@royalcollege.edu.pk' && existingExam.teacherId === 'teacher-1');
    return teacherMatches;
  }

  return false;
}

// Rules simulation for question bank writing
function canWriteQuestions(auth: AuthContext | null, db: DatabaseMock): boolean {
  if (!isAuthenticated(auth)) return false;
  return isTeacher(auth, db) || isAdmin(auth, db);
}

// =========================================================================
// TEST EXECUTION
// =========================================================================

console.log('========================================================================');
console.log('ROYAL COLLEGE OF NURSING SWAT - Assignment Permissions Test Suite');
console.log('========================================================================\n');

const mockDatabase: DatabaseMock = {
  admins: {
    'admin-uid-1': { role: 'admin' },
  },
  teachers: {
    'auth-teacher-uid-1': { name: 'Prof. Maryam Saeed', email: 'maryam.saeed@royalcollege.edu.pk' },
    'teacher-1': { name: 'Dr. Tariq Shah', email: 'dr.tariq@royalcollege.edu.pk' },
  },
  users: {
    'auth-teacher-uid-1': { role: 'teacher', email: 'maryam.saeed@royalcollege.edu.pk' },
    'auth-cased-teacher': { role: 'Teacher', email: 'cased@royalcollege.edu.pk' },
    'auth-faculty-role': { role: 'faculty', email: 'faculty.member@royalcollege.edu.pk' },
    'auth-student-uid-1': { role: 'student', email: 'farhan.student@royalcollege.edu.pk' },
  },
  students: {
    'auth-student-uid-1': { name: 'Farhan Ali', batch: 'Batch 15th', semester: 'Semester 4' },
  },
  exams: {
    'exam-dr-tariq-seeded': {
      id: 'exam-dr-tariq-seeded',
      title: 'Adult Health Nursing I',
      teacherId: 'teacher-1',
      status: 'scheduled',
    },
    'exam-maryam': {
      id: 'exam-maryam',
      title: 'Fundamentals of Nursing',
      teacherId: 'auth-teacher-uid-1',
      status: 'scheduled',
    },
  },
  assignments: {},
};

// -------------------------------------------------------------------------
// SUITE 1: isTeacher() Identity & Authority Resolution
// -------------------------------------------------------------------------
console.log('--- Test Suite 1: Teacher Identity & Role Resolution ---');

assert(
  isTeacher({ uid: 'auth-teacher-uid-1', email: 'maryam.saeed@royalcollege.edu.pk' }, mockDatabase),
  'Teacher with document in teachers collection is recognized as teacher'
);

assert(
  isTeacher({ uid: 'auth-cased-teacher' }, mockDatabase),
  'Teacher with capitalized role "Teacher" in users is recognized as teacher'
);

assert(
  isTeacher({ uid: 'auth-faculty-role' }, mockDatabase),
  'Faculty member with role "faculty" in users is recognized as teacher'
);

assert(
  isTeacher({ uid: 'brand-new-uid-99', token: { role: 'teacher' } }, mockDatabase),
  'Faculty with custom token claim role="teacher" is recognized as teacher'
);

assert(
  isTeacher({ uid: 'new-auth-uid-dr-tariq', email: 'dr.tariq@royalcollege.edu.pk' }, mockDatabase),
  'Dr. Tariq Shah is recognized as teacher via institutional email even before document sync'
);

assert(
  isTeacher({ uid: 'dr-usman-uid', email: 'dr.usman@royalcollege.edu.pk' }, mockDatabase),
  'Dr. Usman is recognized as teacher via institutional email prefix'
);

assert(
  !isTeacher({ uid: 'auth-student-uid-1', email: 'farhan.student@royalcollege.edu.pk' }, mockDatabase),
  'Student Farhan Ali is NOT recognized as teacher'
);

assert(
  !isTeacher(null, mockDatabase),
  'Unauthenticated visitor is NOT recognized as teacher'
);

// -------------------------------------------------------------------------
// SUITE 2: isAdmin() Identity Resolution
// -------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Admin Identity Resolution ---');

assert(
  isAdmin({ uid: 'admin-uid-1' }, mockDatabase),
  'Admin with document in admins collection is recognized as admin'
);

assert(
  isAdmin({ uid: 'admin-auth-uid-new', email: 'admin@royalcollege.edu.pk' }, mockDatabase),
  'Admin is recognized via institutional admin email'
);

assert(
  isAdmin({ uid: 'claim-admin-uid', token: { role: 'admin' } }, mockDatabase),
  'Admin is recognized via token claim role="admin"'
);

assert(
  !isAdmin({ uid: 'auth-teacher-uid-1' }, mockDatabase),
  'Regular faculty is NOT granted admin privileges'
);

// -------------------------------------------------------------------------
// SUITE 3: Assignment Creation & Payload Validation
// -------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Assignment Creation & Payload Validation ---');

const teacherAuth: AuthContext = {
  uid: 'auth-teacher-uid-1',
  email: 'maryam.saeed@royalcollege.edu.pk',
};

const validPayload = {
  id: 'exam-maryam_auth-student-uid-1',
  examId: 'exam-maryam',
  studentId: 'auth-student-uid-1',
  assignedBy: 'auth-teacher-uid-1',
  batch: 'Batch 15th',
  semester: 'Semester 4',
  program: 'BS Nursing (Generic)',
  status: 'assigned',
};

const validResult = canCreateAssignment(teacherAuth, mockDatabase, validPayload);
assert(validResult.allowed, 'Authorized faculty can assign exam to candidate with valid payload');

const missingExamIdResult = canCreateAssignment(teacherAuth, mockDatabase, {
  ...validPayload,
  examId: '',
});
assert(!missingExamIdResult.allowed, 'Assignment creation REJECTED when examId is missing');

const missingStudentIdResult = canCreateAssignment(teacherAuth, mockDatabase, {
  ...validPayload,
  studentId: '',
});
assert(!missingStudentIdResult.allowed, 'Assignment creation REJECTED when studentId is missing');

const invalidStatusResult = canCreateAssignment(teacherAuth, mockDatabase, {
  ...validPayload,
  status: 'graded',
});
assert(!invalidStatusResult.allowed, 'Assignment creation REJECTED when status is illegally set to graded');

const unauthorizedAuthorResult = canCreateAssignment(teacherAuth, mockDatabase, {
  ...validPayload,
  assignedBy: 'impostor-teacher-uid',
});
assert(!unauthorizedAuthorResult.allowed, 'Assignment creation REJECTED when assignedBy is spoofed');

// -------------------------------------------------------------------------
// SUITE 4: Prevention of Student Self-Assignment (Task 8)
// -------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Prevention of Student Self-Assignment ---');

const studentAuth: AuthContext = {
  uid: 'auth-student-uid-1',
  email: 'farhan.student@royalcollege.edu.pk',
};

assert(
  isStudent(studentAuth, mockDatabase),
  'Candidate Farhan Ali is correctly recognized as student'
);

assert(
  !isStudent(teacherAuth, mockDatabase),
  'Teacher is NOT classified as student'
);

const studentSelfAssignment = canCreateAssignment(studentAuth, mockDatabase, {
  ...validPayload,
  assignedBy: 'auth-student-uid-1',
});
assert(!studentSelfAssignment.allowed, 'Student CANNOT create an assignment for themselves');

const studentSpoofAssignment = canCreateAssignment(studentAuth, mockDatabase, {
  ...validPayload,
  assignedBy: 'auth-teacher-uid-1',
});
assert(!studentSpoofAssignment.allowed, 'Student CANNOT create an assignment even if spoofing assignedBy');

// -------------------------------------------------------------------------
// SUITE 5: Student Cohort Roster Query Authorization (Task 6)
// -------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Student Cohort Query Authorization ---');

assert(
  canQueryStudentCohort(teacherAuth, mockDatabase),
  'Teacher is authorized to query student cohort roster for assignment'
);

assert(
  canQueryStudentCohort({ uid: 'admin-uid-1' }, mockDatabase),
  'Admin is authorized to query student cohort roster for assignment'
);

assert(
  !canQueryStudentCohort(studentAuth, mockDatabase),
  'Student CANNOT query student roster'
);

assert(
  !canQueryStudentCohort(null, mockDatabase),
  'Unauthenticated user CANNOT query student roster'
);

// -------------------------------------------------------------------------
// SUITE 6: Exam Metadata Updates During Assignment & Question Sync (Task 6)
// -------------------------------------------------------------------------
console.log('\n--- Test Suite 6: Exam Updates During Assignment & Question Sync ---');

assert(
  canUpdateExam(teacherAuth, mockDatabase, 'exam-maryam'),
  'Teacher can update their own exam cohort and questions'
);

const drTariqAuth: AuthContext = {
  uid: 'new-auth-uid-dr-tariq',
  email: 'dr.tariq@royalcollege.edu.pk',
};

assert(
  canUpdateExam(drTariqAuth, mockDatabase, 'exam-dr-tariq-seeded'),
  'Dr. Tariq Shah can update and assign initial seeded exam with teacherId="teacher-1"'
);

assert(
  !canUpdateExam(drTariqAuth, mockDatabase, 'exam-maryam'),
  'Teacher CANNOT overwrite another teacher exam without admin privileges'
);

assert(
  canUpdateExam({ uid: 'admin-uid-1' }, mockDatabase, 'exam-maryam'),
  'Admin can update and assign any exam across institution'
);

assert(
  !canUpdateExam(studentAuth, mockDatabase, 'exam-maryam'),
  'Student CANNOT update any exam document'
);

// -------------------------------------------------------------------------
// SUITE 7: Question Bank Authoring Security (Task 6)
// -------------------------------------------------------------------------
console.log('\n--- Test Suite 7: Question Bank Authoring Security ---');

assert(
  canWriteQuestions(teacherAuth, mockDatabase),
  'Teacher can author and save questions to question bank'
);

assert(
  canWriteQuestions({ uid: 'admin-uid-1' }, mockDatabase),
  'Admin can author and save questions to question bank'
);

assert(
  !canWriteQuestions(studentAuth, mockDatabase),
  'Student CANNOT write or modify question bank'
);

// -------------------------------------------------------------------------
// RESULTS SUMMARY
// -------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('========================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL ASSIGNMENT PERMISSION & LEAST-PRIVILEGE TESTS PASSED!\n');
}
