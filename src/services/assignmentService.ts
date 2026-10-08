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
import type { Assignment, AssignmentStatus } from '../types/assignment';
import type { Exam } from '../types/exam';

export const assignmentService = {
  /**
   * Retrieves assignments assigned to a specific student.
   */
  async getAssignmentsByStudentId(studentId: string): Promise<Assignment[]> {
    const assignmentsCol = collection(db, 'assignments');
    const q = query(assignmentsCol, where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Assignment));
  },

  /**
   * Retrieves assignments for a specific exam.
   */
  async getAssignmentsByExamId(examId: string): Promise<Assignment[]> {
    const assignmentsCol = collection(db, 'assignments');
    const q = query(assignmentsCol, where('examId', '==', examId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Assignment));
  },

  /**
   * Assigns an exam to a student with deterministic duplicate prevention.
   */
  async assignExamToStudent(assignmentData: {
    examId: string;
    studentId: string;
    assignedBy: string;
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
        status: assignmentData.status || 'assigned',
        assignedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return assignmentId;
  },

  /**
   * Assigns an exam to all students matching a cohort (Program, Semester, optional Batch).
   */
  async assignExamToCohort(params: {
    examId: string;
    program: string;
    semester: string;
    batch?: string;
    assignedBy: string;
  }): Promise<number> {
    const studentsCol = collection(db, 'students');
    let q = query(
      studentsCol,
      where('program', '==', params.program),
      where('semester', '==', params.semester)
    );

    const snapshot = await getDocs(q);
    const matchingStudents = snapshot.docs
      .map((d) => d.data())
      .filter((s) => (!params.batch || s.batch === params.batch));

    if (matchingStudents.length === 0) {
      return 0;
    }

    const batch = writeBatch(db);
    for (const student of matchingStudents) {
      const assignmentId = `${params.examId}_${student.uid}`;
      const aRef = doc(db, 'assignments', assignmentId);
      batch.set(
        aRef,
        {
          id: assignmentId,
          examId: params.examId,
          studentId: student.uid,
          assignedBy: params.assignedBy,
          status: 'assigned',
          assignedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    return matchingStudents.length;
  },

  /**
   * Retrieves all exams authorized for a student:
   * Merges specific assignments and matching curriculum exams.
   */
  async getAuthorizedExamsForStudent(
    studentId: string,
    program: string,
    semester: string
  ): Promise<Array<Exam & { assignmentStatus?: AssignmentStatus; assignmentId?: string }>> {
    const examsCol = collection(db, 'exams');
    const qProgram = query(
      examsCol,
      where('program', '==', program),
      where('semester', '==', semester)
    );
    const examSnap = await getDocs(qProgram);
    const programExams = examSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Exam));

    const assignments = await this.getAssignmentsByStudentId(studentId);
    const assignmentMap = new Map(assignments.map((a) => [a.examId, a]));

    const resultExams: Array<Exam & { assignmentStatus?: AssignmentStatus; assignmentId?: string }> = [];

    // Add program matched exams
    for (const exam of programExams) {
      const assign = assignmentMap.get(exam.id);
      resultExams.push({
        ...exam,
        assignmentId: assign?.id,
        assignmentStatus: assign?.status || 'assigned',
      });
    }

    // Add individually assigned exams if not already included
    for (const assign of assignments) {
      if (!resultExams.some((e) => e.id === assign.examId)) {
        const examDoc = await getDoc(doc(db, 'exams', assign.examId));
        if (examDoc.exists()) {
          resultExams.push({
            id: examDoc.id,
            ...(examDoc.data() as Omit<Exam, 'id'>),
            assignmentId: assign.id,
            assignmentStatus: assign.status,
          });
        }
      }
    }

    return resultExams;
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
};

export default assignmentService;

