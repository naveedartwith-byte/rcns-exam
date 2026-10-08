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
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { Assignment, AssignmentStatus } from '../types/assignment';

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
   * Assigns an exam to a student.
   */
  async assignExamToStudent(assignmentData: {
    examId: string;
    studentId: string;
    assignedBy: string;
    status?: AssignmentStatus;
  }): Promise<string> {
    const assignmentsCol = collection(db, 'assignments');
    const assignmentRef = doc(assignmentsCol);

    await setDoc(assignmentRef, {
      id: assignmentRef.id,
      examId: assignmentData.examId,
      studentId: assignmentData.studentId,
      assignedBy: assignmentData.assignedBy,
      status: assignmentData.status || 'assigned',
      assignedAt: serverTimestamp(),
    });

    return assignmentRef.id;
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
