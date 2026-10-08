import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { StudentProfile } from '../types/student';
import { normalizeKmuRegistration } from '../utils/kmuRegistration';

export const studentService = {
  /**
   * Retrieves a student's profile by UID.
   */
  async getStudentProfile(uid: string): Promise<StudentProfile | null> {
    const docRef = doc(db, 'students', uid);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data() as StudentProfile;
  },

  /**
   * Checks if a KMU registration number is already registered.
   */
  async isKmuNumberAvailable(kmuRegistrationNo: string): Promise<boolean> {
    const normalized = normalizeKmuRegistration(kmuRegistrationNo);
    const docRef = doc(db, 'kmuRegistrations', normalized);
    const snapshot = await getDoc(docRef);
    return !snapshot.exists();
  },

  /**
   * Updates student profile fields (excluding immutable keys like uid/role).
   */
  async updateStudentProfile(
    uid: string,
    data: Partial<Omit<StudentProfile, 'uid' | 'role' | 'createdAt'>>
  ): Promise<void> {
    const studentRef = doc(db, 'students', uid);
    await updateDoc(studentRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Retrieves all student profiles in the institution.
   */
  async getAllStudents(): Promise<StudentProfile[]> {
    const studentsCol = collection(db, 'students');
    const snapshot = await getDocs(studentsCol);
    return snapshot.docs.map((docSnap) => docSnap.data() as StudentProfile);
  },

  /**
   * Queries students by program and semester.
   */
  async getStudentsByProgramAndSemester(program: string, semester: string): Promise<StudentProfile[]> {
    const studentsCol = collection(db, 'students');
    const q = query(
      studentsCol,
      where('program', '==', program),
      where('semester', '==', semester)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as StudentProfile);
  },
};

export default studentService;

