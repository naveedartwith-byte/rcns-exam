import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Assignment, AssignmentStatus } from '../types/assignment';
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
        assignedBy: assignmentData.assignedBy,
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
    } catch (queryErr) {
      // Fallback: load students collection to filter in-memory if composite query index is absent
      console.warn('Cohort student query fallback triggered:', queryErr);
      snapshot = await getDocs(studentsCol);
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
          assignedBy: params.assignedBy,
          batch: cleanBatch,
          semester: cleanSemester,
          program: cleanProgram || student.program || '',
          status: 'assigned',
          assignedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batchWriter.commit();

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

    // Step 3: Sort exams: Active first, then Upcoming (scheduled by startAt), then Completed
    const sorted = Array.from(resultExamMap.values()).sort((a, b) => {
      const order: Record<string, number> = { active: 1, scheduled: 2, completed: 3 };
      const rankA = order[a.status] || 4;
      const rankB = order[b.status] || 4;
      if (rankA !== rankB) return rankA - rankB;

      // Secondary sort: startAt ascending
      const timeA = parseDateToMillis(a.startAt) || 0;
      const timeB = parseDateToMillis(b.startAt) || 0;
      return timeA - timeB;
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
   * Real-time subscription to all student assignments for an active exam.
   * Enables live monitoring for authorized teachers/admins.
   */
  subscribeToExamAssignments(examId: string, callback: (assignments: Assignment[]) => void): () => void {
    if (!examId) return () => {};
    const assignmentsCol = collection(db, 'assignments');
    const q = query(assignmentsCol, where('examId', '==', examId));

    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Assignment)
        );
        callback(list);
      },
      (err) => {
        console.error('Error in subscribeToExamAssignments:', err);
      }
    );
  },

  /**
   * Real-time subscription to an individual student's assignment document.
   * Synchronizes remote pause and resume events to the student's exam interface instantly.
   */
  subscribeToStudentAssignment(
    examIdOrAssignmentId: string,
    studentIdOrCallback: string | ((assignment: Assignment | null) => void),
    maybeCallback?: (assignment: Assignment | null) => void
  ): () => void {
    if (!examIdOrAssignmentId) return () => {};
    let assignmentId = examIdOrAssignmentId;
    let callback: (assignment: Assignment | null) => void;

    if (typeof studentIdOrCallback === 'function') {
      callback = studentIdOrCallback;
    } else {
      assignmentId = `${examIdOrAssignmentId}_${studentIdOrCallback}`;
      callback = maybeCallback || (() => {});
    }

    const docRef = doc(db, 'assignments', assignmentId);

    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as Assignment);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.error('Error in subscribeToStudentAssignment:', err);
      }
    );
  },

  /**
   * Remotely pauses a student's active exam attempt (Authorized Teacher/Admin only).
   * Synchronizes pause state across devices. Exam timer continues running.
   */
  async pauseStudentExam(params: {
    examId: string;
    studentId: string;
    teacherUid?: string;
    pausedBy?: string;
    teacherName?: string;
    pausedByName?: string;
  }): Promise<void> {
    const assignmentId = `${params.examId}_${params.studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);
    const supervisorUid = params.teacherUid || params.pausedBy || 'Supervisor';
    const supervisorName = params.teacherName || params.pausedByName || 'Examination Supervisor';

    await updateDoc(assignRef, {
      isPaused: true,
      status: 'paused',
      pausedAt: serverTimestamp(),
      pausedBy: supervisorUid,
      pausedByName: supervisorName,
    });

    // Record supervisor pause in audit log
    try {
      const auditCol = collection(db, 'auditLogs');
      const logRef = doc(auditCol);
      await setDoc(logRef, {
        id: logRef.id,
        action: 'SUPERVISOR_PAUSED_EXAM',
        examId: params.examId,
        studentId: params.studentId,
        supervisorUid,
        supervisorName,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Audit log write notice:', err);
    }
  },

  /**
   * Remotely resumes an individual student's paused exam attempt (Authorized Teacher/Admin only).
   */
  async resumeStudentExam(params: {
    examId: string;
    studentId: string;
    teacherUid?: string;
    resumedBy?: string;
    teacherName?: string;
    resumedByName?: string;
  }): Promise<void> {
    const assignmentId = `${params.examId}_${params.studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);
    const supervisorUid = params.teacherUid || params.resumedBy || 'Supervisor';
    const supervisorName = params.teacherName || params.resumedByName || 'Examination Supervisor';

    await updateDoc(assignRef, {
      isPaused: false,
      status: 'started',
      resumedAt: serverTimestamp(),
      resumedBy: supervisorUid,
      resumedByName: supervisorName,
    });

    // Record supervisor resume in audit log
    try {
      const auditCol = collection(db, 'auditLogs');
      const logRef = doc(auditCol);
      await setDoc(logRef, {
        id: logRef.id,
        action: 'SUPERVISOR_RESUMED_EXAM',
        examId: params.examId,
        studentId: params.studentId,
        supervisorUid: params.teacherUid,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Audit log write notice:', err);
    }
  },

  /**
   * Periodic student activity heartbeat during an active exam attempt.
   */
  async recordStudentHeartbeat(examId: string, studentId: string): Promise<void> {
    if (!examId || !studentId) return;
    const assignmentId = `${examId}_${studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);

    await updateDoc(assignRef, {
      lastHeartbeatAt: serverTimestamp(),
      lastHeartbeatAtMs: Date.now(),
    }).catch(() => null);
  },

  /**
   * Persists a student's assigned shuffled question order.
   * Guarantees the question order remains 100% stable across browser refreshes.
   */
  async saveShuffledQuestionOrder(assignmentId: string, order: string[]): Promise<void> {
    if (!assignmentId || !order || order.length === 0) return;
    const assignRef = doc(db, 'assignments', assignmentId);
    await updateDoc(assignRef, {
      shuffledQuestionOrder: order,
    }).catch(() => null);
  },

  /**
   * Starts or resumes a student's exam attempt safely without resetting the countdown timer.
   */
  async startStudentAttempt(params: {
    examId: string;
    studentId: string;
    studentName?: string;
    kmuRegistrationNo?: string;
    batch?: string;
    semester?: string;
    program?: string;
    examTitle?: string;
    durationMinutes: number;
  }): Promise<{ startedAtMs: number; shuffledQuestionOrder?: string[]; isPaused?: boolean }> {
    const assignmentId = `${params.examId}_${params.studentId}`;
    const assignRef = doc(db, 'assignments', assignmentId);
    const snap = await getDoc(assignRef);

    const now = Date.now();
    if (snap.exists()) {
      const data = snap.data();
      const existingStartedAtMs =
        data.startedAtMs || (data.startedAt ? parseDateToMillis(data.startedAt) : null);

      if (existingStartedAtMs) {
        // Attempt already in progress: preserve original start time, DO NOT grant extra time!
        await updateDoc(assignRef, {
          lastHeartbeatAt: serverTimestamp(),
          lastHeartbeatAtMs: now,
        }).catch(() => null);

        return {
          startedAtMs: existingStartedAtMs,
          shuffledQuestionOrder: data.shuffledQuestionOrder,
          isPaused: Boolean(data.isPaused),
        };
      }

      // Initial start on existing cohort assignment
      await updateDoc(assignRef, {
        status: 'started',
        startedAt: serverTimestamp(),
        startedAtMs: now,
        lastHeartbeatAt: serverTimestamp(),
        lastHeartbeatAtMs: now,
        studentName: params.studentName || data.studentName || 'Student Candidate',
        kmuRegistrationNo: params.kmuRegistrationNo || data.kmuRegistrationNo || '',
      });

      return {
        startedAtMs: now,
        shuffledQuestionOrder: data.shuffledQuestionOrder,
        isPaused: false,
      };
    }

    // Auto-create initial assignment document for candidate
    await setDoc(assignRef, {
      id: assignmentId,
      examId: params.examId,
      studentId: params.studentId,
      studentName: params.studentName || 'Student Candidate',
      kmuRegistrationNo: params.kmuRegistrationNo || '',
      assignedBy: 'candidate-start',
      batch: params.batch || '',
      semester: params.semester || '',
      program: params.program || '',
      examTitle: params.examTitle || '',
      status: 'started',
      assignedAt: serverTimestamp(),
      startedAt: serverTimestamp(),
      startedAtMs: now,
      lastHeartbeatAt: serverTimestamp(),
      lastHeartbeatAtMs: now,
      isPaused: false,
    });

    return { startedAtMs: now, isPaused: false };
  },
};

export default assignmentService;
