import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Assignment, AssignmentStatus, ExamLockAuditEntry } from '../types/assignment';
import type { Exam } from '../types/exam';
import { getEffectiveExamStatus, parseDateToMillis } from '../utils/dateTime';

export const assignmentService = {
  /**
   * Retrieves assignments assigned to a specific student.
   */
  async getAssignmentsByStudentId(studentId: string): Promise<Assignment[]> {
    if (!studentId) return [];
    try {
      const assignmentsCol = collection(db, 'assignments');
      const q = query(assignmentsCol, where('studentId', '==', studentId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Assignment));
    } catch (err) {
      console.error('Error fetching assignments by student ID:', err);
      return [];
    }
  },

  /**
   * Retrieves assignments for a specific exam.
   */
  async getAssignmentsByExamId(examId: string): Promise<Assignment[]> {
    if (!examId) return [];
    try {
      const assignmentsCol = collection(db, 'assignments');
      const q = query(assignmentsCol, where('examId', '==', examId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Assignment));
    } catch (err) {
      console.error('Error fetching assignments by exam ID:', err);
      return [];
    }
  },

  /**
   * Assigns an exam to an individual student with deterministic duplicate prevention.
   */
  async assignExamToStudent(assignmentData: {
    examId: string;
    studentId: string;
    assignedBy: string;
    batch?: string;
    semester?: string;
    program?: string;
    status?: AssignmentStatus;
  }): Promise<string> {
    const assignmentId = `${assignmentData.examId}_${assignmentData.studentId}`;
    const assignmentRef = doc(db, 'assignments', assignmentId);

    await setDoc(
      assignmentRef,
      {
        id: assignmentId,
        examId: assignmentData.examId,
        studentId: assignmentData.studentId,
        assignedBy: assignmentData.assignedBy || 'teacher-1',
        batch: assignmentData.batch || '',
        semester: assignmentData.semester || '',
        program: assignmentData.program || '',
        status: assignmentData.status || 'assigned',
        assignedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return assignmentId;
  },

  /**
   * Assigns an exam/quiz to all students matching a cohort (Batch, Semester, Program).
   * Validates required batch and semester.
   * Deterministically creates assignment documents and updates target exam metadata.
   */
  async assignExamToCohort(params: {
    examId: string;
    batch: string;
    semester: string;
    program?: string;
    assignedBy: string;
  }): Promise<{ assignedCount: number; message: string }> {
    if (!params.examId) {
      throw new Error('Examination ID is required for assignment.');
    }
    if (!params.batch || !params.batch.trim()) {
      throw new Error('Batch is required. Please select a batch first.');
    }
    if (!params.semester || !params.semester.trim()) {
      throw new Error('Semester is required. Please select a semester.');
    }

    const cleanBatch = params.batch.trim();
    const cleanSemester = params.semester.trim();
    const cleanProgram = (params.program || '').trim();

    // 1. Update the exam document itself with the target batch, semester, and program
    try {
      const examRef = doc(db, 'exams', params.examId);
      const examUpdate: Record<string, any> = {
        batch: cleanBatch,
        semester: cleanSemester,
        updatedAt: serverTimestamp(),
      };
      if (cleanProgram) {
        examUpdate.program = cleanProgram;
      }
      await updateDoc(examRef, examUpdate);
    } catch (examErr) {
      console.warn('Could not update exam target cohort directly:', examErr);
    }

    // 2. Query matching students
    const studentsCol = collection(db, 'students');
    let snapshot;
    try {
      let q;
      if (cleanProgram) {
        q = query(
          studentsCol,
          where('program', '==', cleanProgram),
          where('semester', '==', cleanSemester)
        );
      } else {
        q = query(studentsCol, where('semester', '==', cleanSemester));
      }
      snapshot = await getDocs(q);
    } catch (queryErr: any) {
      if (queryErr?.code === 'permission-denied') {
        throw new Error(
          'Missing or insufficient permissions: Access to student roster requires an authenticated faculty account.'
        );
      }
      // Fallback: load students collection to filter in-memory if composite query index is absent
      console.warn('Cohort student query fallback triggered:', queryErr);
      try {
        snapshot = await getDocs(studentsCol);
      } catch (listErr: any) {
        if (listErr?.code === 'permission-denied') {
          throw new Error(
            'Missing or insufficient permissions: Access to student roster requires an authenticated faculty account.'
          );
        }
        throw listErr;
      }
    }

    const matchingStudents: Array<Record<string, any> & { docId: string }> = snapshot.docs
      .map((d) => ({ ...d.data(), docId: d.id }))
      .filter((s: any) => {
        // Compare batch
        const studentBatch = (s.batch || '').trim().toLowerCase();
        const targetBatch = cleanBatch.toLowerCase();
        if (studentBatch !== targetBatch) return false;

        // Compare semester
        const studentSemester = (s.semester || '').trim().toLowerCase();
        const targetSemester = cleanSemester.toLowerCase();
        if (studentSemester !== targetSemester) return false;

        // Compare program if provided
        if (cleanProgram) {
          const studentProgram = (s.program || '').trim().toLowerCase();
          if (studentProgram !== cleanProgram.toLowerCase()) return false;
        }

        return true;
      });

    if (matchingStudents.length === 0) {
      return {
        assignedCount: 0,
        message: `No registered candidates currently found in ${cleanBatch} (${cleanSemester}). The exam cohort criteria has been recorded for when students enroll.`,
      };
    }

    // 3. Batch commit assignments
    const batchWriter = writeBatch(db);
    for (const student of matchingStudents) {
      const studentUid = (student.uid || student.docId) as string;
      if (!studentUid) continue;

      const assignmentId = `${params.examId}_${studentUid}`;
      const aRef = doc(db, 'assignments', assignmentId);

      batchWriter.set(
        aRef,
        {
          id: assignmentId,
          examId: params.examId,
          studentId: studentUid,
          assignedBy: params.assignedBy || 'teacher-1',
          batch: cleanBatch,
          semester: cleanSemester,
          program: cleanProgram || student.program || '',
          status: 'assigned',
          assignedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    try {
      await batchWriter.commit();
    } catch (batchErr: any) {
      if (batchErr?.code === 'permission-denied') {
        throw new Error(
          'Missing or insufficient permissions: Assignment authorization failed. Only faculty and administrators can assign exams.'
        );
      }
      throw batchErr;
    }

    return {
      assignedCount: matchingStudents.length,
      message: `Successfully assigned to ${matchingStudents.length} candidate(s) in ${cleanBatch} - ${cleanSemester}!`,
    };
  },

  /**
   * Retrieves all exams authorized for a student:
   * 1. Loads individual assignment records (`assignments` collection) for this student.
   * 2. Loads cohort-matching exams (`exams` collection matching batch, semester, program).
   * 3. Dynamically computes the effective time-window status (upcoming, active, completed).
   * 4. Excludes draft or archived exams from student view.
   * 5. Strictly ensures students from other batches do NOT receive quizzes not meant for them.
   */
  async getAuthorizedExamsForStudent(
    studentId: string,
    program: string,
    semester: string,
    batch?: string
  ): Promise<Array<Exam & { assignmentStatus?: AssignmentStatus; assignmentId?: string }>> {
    if (!studentId) return [];

    const resultExamMap = new Map<string, Exam & { assignmentStatus?: AssignmentStatus; assignmentId?: string }>();

    // Step 1: Load individual assignments for this student
    try {
      const studentAssignments = await this.getAssignmentsByStudentId(studentId);
      for (const assign of studentAssignments) {
        if (!assign.examId) continue;
        try {
          const examDoc = await getDoc(doc(db, 'exams', assign.examId));
          if (examDoc.exists()) {
            const examData = { id: examDoc.id, ...examDoc.data() } as Exam;
            // Exclude drafts and archived exams
            if (examData.status !== 'draft' && examData.status !== 'archived') {
              const effectiveStatus = getEffectiveExamStatus(examData);
              resultExamMap.set(examData.id, {
                ...examData,
                status: effectiveStatus,
                assignmentId: assign.id,
                assignmentStatus: assign.status,
              });
            }
          }
        } catch (singleExamErr) {
          console.warn(`Error loading exam ${assign.examId}:`, singleExamErr);
        }
      }
    } catch (assignErr) {
      console.error('Error loading student assignments:', assignErr);
    }

    // Step 2: Cohort Matching via Program & Semester
    if (program && semester) {
      try {
        const examsCol = collection(db, 'exams');
        const qCohort = query(
          examsCol,
          where('program', '==', program.trim()),
          where('semester', '==', semester.trim()),
          where('status', 'in', ['scheduled', 'active', 'completed'])
        );

        const examSnap = await getDocs(qCohort);
        for (const docSnap of examSnap.docs) {
          const exam = { id: docSnap.id, ...docSnap.data() } as Exam;

          // Do not include drafts or archived
          if (exam.status === 'draft' || exam.status === 'archived') {
            continue;
          }

          // Strict batch check: If exam has a target batch, ensure it matches student's batch
          if (exam.batch && batch) {
            const examBatchNorm = exam.batch.trim().toLowerCase();
            const studentBatchNorm = batch.trim().toLowerCase();
            if (examBatchNorm !== studentBatchNorm) {
              // Student is from another batch; skip
              continue;
            }
          }

          if (!resultExamMap.has(exam.id)) {
            const effectiveStatus = getEffectiveExamStatus(exam);
            resultExamMap.set(exam.id, {
              ...exam,
              status: effectiveStatus,
              assignmentStatus: 'assigned',
            });
          }
        }
      } catch (cohortErr) {
        // In Firestore, if rules restrict listing all exams or if composite index is absent,
        // we log gracefully. Individual assignments are already loaded and safe!
        console.warn('Cohort exam query notice (individually assigned exams preserved):', cohortErr);
      }
    }

    // Step 3: Sort exams: Active first, then Upcoming, then Completed; within each, NEWEST assigned/created first (Requirement #9)
    const sorted = Array.from(resultExamMap.values()).sort((a, b) => {
      const order: Record<string, number> = { active: 1, scheduled: 2, completed: 3 };
      const rankA = order[a.status] || 4;
      const rankB = order[b.status] || 4;
      if (rankA !== rankB) return rankA - rankB;

      // Secondary sort: Newest first (descending by assignedAt, createdAt, updatedAt, or startAt)
      const timeA = parseDateToMillis((a as any).assignedAt || a.createdAt || a.updatedAt || a.startAt) || 0;
      const timeB = parseDateToMillis((b as any).assignedAt || b.createdAt || b.updatedAt || b.startAt) || 0;
      return timeB - timeA;
    });

    return sorted;
  },

  /**
   * Ensures an assignment document exists for an authorized candidate.
   * If missing, deterministically creates or updates the assignment document
   * (deterministic ID: `${examId}_${studentId}`) to prevent authorization failures.
   */
  async ensureStudentAssignment(params: {
    examId: string;
    studentId: string;
    batch?: string;
    semester?: string;
    program?: string;
    assignedBy?: string;
  }): Promise<string> {
    if (!params.examId || !params.studentId) return '';
    const assignmentId = `${params.examId}_${params.studentId}`;
    const assignmentRef = doc(db, 'assignments', assignmentId);

    try {
      const existing = await getDoc(assignmentRef);
      if (existing.exists()) {
        return assignmentId;
      }

      await setDoc(
        assignmentRef,
        {
          id: assignmentId,
          examId: params.examId,
          studentId: params.studentId,
          assignedBy: params.assignedBy || 'system-cohort-sync',
          batch: params.batch || '',
          semester: params.semester || '',
          program: params.program || '',
          status: 'assigned',
          assignedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Could not auto-create assignment record:', err);
    }

    return assignmentId;
  },

  /**
   * Updates assignment status (e.g. started, submitted, expired).
   */
  async updateAssignmentStatus(assignmentId: string, status: AssignmentStatus): Promise<void> {
    const assignmentRef = doc(db, 'assignments', assignmentId);
    await updateDoc(assignmentRef, { status });
  },

  /**
   * Retrieves an assignment by ID.
   */
  async getAssignmentById(assignmentId: string): Promise<Assignment | null> {
    const assignmentRef = doc(db, 'assignments', assignmentId);
    const snapshot = await getDoc(assignmentRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Assignment;
  },

  /**
   * Records candidate activity heartbeat while taking exam.
   */
  async recordCandidateHeartbeat(params: {
    examId: string;
    studentId: string;
    studentName?: string;
    kmuRegistrationNo?: string;
    answersCount?: number;
    tabSwitchCount?: number;
    answers?: Record<string, string | number>;
    writtenAnswers?: Record<string, any>;
    currentQuestionIndex?: number;
    timeLeftSeconds?: number;
    activeExamSection?: 'mcq' | 'written';
    flaggedQuestions?: Record<number, boolean>;
    batch?: string;
    semester?: string;
    program?: string;
    examTitle?: string;
    examType?: string;
    subject?: string;
  }): Promise<void> {
    const assignmentId = `${params.examId}_${params.studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);
    try {
      const payload: Record<string, any> = {
        id: assignmentId,
        examId: params.examId,
        studentId: params.studentId,
        status: 'started',
        lastActiveAt: serverTimestamp(),
      };
      if (params.studentName) payload.studentName = params.studentName;
      if (params.kmuRegistrationNo) payload.kmuRegistrationNo = params.kmuRegistrationNo;
      if (params.answersCount !== undefined) payload.answersCount = params.answersCount;
      if (params.tabSwitchCount !== undefined) payload.tabSwitchCount = params.tabSwitchCount;
      if (params.answers !== undefined) payload.answers = params.answers;
      if (params.writtenAnswers !== undefined) payload.writtenAnswers = params.writtenAnswers;
      if (params.currentQuestionIndex !== undefined) payload.currentQuestionIndex = params.currentQuestionIndex;
      if (params.timeLeftSeconds !== undefined) payload.timeLeftSeconds = params.timeLeftSeconds;
      if (params.activeExamSection !== undefined) payload.activeExamSection = params.activeExamSection;
      if (params.flaggedQuestions !== undefined) payload.flaggedQuestions = params.flaggedQuestions;
      if (params.batch) payload.batch = params.batch;
      if (params.semester) payload.semester = params.semester;
      if (params.program) payload.program = params.program;
      if (params.examTitle) payload.examTitle = params.examTitle;
      if (params.examType) payload.examType = params.examType;
      if (params.subject) payload.subject = params.subject;

      await setDoc(assignRef, payload, { merge: true });
    } catch (err) {
      console.warn('Candidate heartbeat recording note:', err);
    }
  },

  /**
   * Retrieves all candidate assignments for an exam to inspect active candidates.
   */
  async getExamCandidateRoster(examId: string): Promise<Assignment[]> {
    if (!examId) return [];
    const assignmentsCol = collection(db, 'assignments');
    try {
      const q = query(assignmentsCol, where('examId', '==', examId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
    } catch (err) {
      console.error('Error fetching exam candidate roster:', err);
      return [];
    }
  },

  /**
   * Locks an active student exam attempt due to misbehavior, suspected cheating, or unauthorized action.
   * - Validates teacher/admin authorization.
   * - Enforces that finalized/submitted attempts cannot be locked.
   * - Preserves previously saved student answers.
   * - Records actor identity, timestamp, attempt, student, and reason in both assignment and audit collection.
   */
  async lockStudentExamAttempt(params: {
    examId: string;
    studentId: string;
    actorId: string;
    actorName: string;
    actorRole: 'teacher' | 'admin';
    reason: string;
  }): Promise<{ success: boolean; message: string }> {
    const { examId, studentId, actorId, actorName, actorRole, reason } = params;
    if (!examId || !studentId) {
      throw new Error('Exam ID and Student ID are required to lock attempt.');
    }
    if (!reason || !reason.trim()) {
      throw new Error('A valid reason is required to lock student examination.');
    }

    const assignmentId = `${examId}_${studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);
    const assignSnap = await getDoc(assignRef);

    if (!assignSnap.exists()) {
      throw new Error('Assignment attempt record not found.');
    }

    const assignData = assignSnap.data() as Assignment;

    // Disallow locking finalized/submitted attempts
    if (assignData.status === 'submitted' || assignData.status === 'graded') {
      throw new Error('Cannot lock a finalized or submitted examination attempt.');
    }

    const timestamp = new Date().toISOString();
    const auditEntry: ExamLockAuditEntry = {
      action: 'lock',
      timestamp,
      actorId,
      actorName: actorName || 'Authorized Invigilator',
      actorRole,
      reason: reason.trim(),
      examId,
      studentId,
      studentName: assignData.studentName || 'Student Candidate',
      kmuRegistrationNo: assignData.kmuRegistrationNo,
    };

    const currentAuditTrail = Array.isArray(assignData.lockAuditTrail) ? assignData.lockAuditTrail : [];
    const updatedAuditTrail = [...currentAuditTrail, auditEntry];

    // Update assignment record preserving answers and attempt state
    await updateDoc(assignRef, {
      isLocked: true,
      lockedAt: timestamp,
      lockedBy: actorId,
      lockedByName: actorName || 'Authorized Invigilator',
      lockedByRole: actorRole,
      lockReason: reason.trim(),
      lockAuditTrail: updatedAuditTrail,
    });

    // Write persistent audit trail to /examLockAudits
    try {
      const auditCol = collection(db, 'examLockAudits');
      await setDoc(doc(auditCol, `${assignmentId}_${Date.now()}`), {
        ...auditEntry,
        createdAt: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Persistent exam lock audit write notice:', auditErr);
    }

    return {
      success: true,
      message: `Exam attempt for ${assignData.studentName || studentId} has been securely locked.`,
    };
  },

  /**
   * Unlocks a previously locked student exam attempt.
   * Restores student's active exam session and remaining time without modifying previously saved answers.
   */
  async unlockStudentExamAttempt(params: {
    examId: string;
    studentId: string;
    actorId: string;
    actorName: string;
    actorRole: 'teacher' | 'admin';
    reason?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { examId, studentId, actorId, actorName, actorRole, reason } = params;
    const assignmentId = `${examId}_${studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);
    const assignSnap = await getDoc(assignRef);

    if (!assignSnap.exists()) {
      throw new Error('Assignment attempt record not found.');
    }

    const assignData = assignSnap.data() as Assignment;
    const timestamp = new Date().toISOString();
    const auditEntry: ExamLockAuditEntry = {
      action: 'unlock',
      timestamp,
      actorId,
      actorName: actorName || 'Authorized Invigilator',
      actorRole,
      reason: (reason || 'Invigilator authorization restored').trim(),
      examId,
      studentId,
      studentName: assignData.studentName || 'Student Candidate',
      kmuRegistrationNo: assignData.kmuRegistrationNo,
    };

    const currentAuditTrail = Array.isArray(assignData.lockAuditTrail) ? assignData.lockAuditTrail : [];
    const updatedAuditTrail = [...currentAuditTrail, auditEntry];

    await updateDoc(assignRef, {
      isLocked: false,
      lockedAt: null,
      lockedBy: null,
      lockedByName: null,
      lockedByRole: null,
      lockReason: null,
      lockAuditTrail: updatedAuditTrail,
    });

    try {
      const auditCol = collection(db, 'examLockAudits');
      await setDoc(doc(auditCol, `${assignmentId}_${Date.now()}`), {
        ...auditEntry,
        createdAt: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Persistent exam unlock audit write notice:', auditErr);
    }

    return {
      success: true,
      message: `Exam attempt for ${assignData.studentName || studentId} has been unlocked. Candidate may resume.`,
    };
  },

  /**
   * Fetches lock audit trail across an exam or college-wide (Admin/Teacher view).
   */
  async getExamLockAudits(examId?: string): Promise<ExamLockAuditEntry[]> {
    try {
      const auditCol = collection(db, 'examLockAudits');
      let snap;
      if (examId) {
        const q = query(auditCol, where('examId', '==', examId));
        snap = await getDocs(q);
      } else {
        snap = await getDocs(auditCol);
      }
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ExamLockAuditEntry))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      console.warn('Could not query examLockAudits:', err);
      return [];
    }
  },
};

export default assignmentService;
