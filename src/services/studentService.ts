import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
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

  /**
   * Permanently deletes a student record across all institutional collections:
   * 1. students/{uid}
   * 2. users/{uid}
   * 3. kmuRegistrations/{normalizedKmu}
   * 4. Cascade deletes candidate assignments (assignments where studentId == uid)
   * 5. Cascade deletes candidate results (results where studentId == uid)
   */
  async deleteStudentPermanently(student: StudentProfile): Promise<void> {
    if (!student || !student.uid) {
      throw new Error('Valid student profile is required for permanent deletion.');
    }

    const { uid, kmuRegistrationNo } = student;

    // 1. References for direct profile and identity documents
    const studentRef = doc(db, 'students', uid);
    const userRef = doc(db, 'users', uid);

    // 2. Reference for KMU registry claim
    let kmuRef = null;
    if (kmuRegistrationNo) {
      const normalizedKmu = normalizeKmuRegistration(kmuRegistrationNo);
      if (normalizedKmu) {
        kmuRef = doc(db, 'kmuRegistrations', normalizedKmu);
      }
    }

    // 3. Query candidate assignments and results
    const [assignSnap, resultsSnap] = await Promise.all([
      getDocs(query(collection(db, 'assignments'), where('studentId', '==', uid))),
      getDocs(query(collection(db, 'results'), where('studentId', '==', uid))),
    ]);

    const allDocRefs = [
      studentRef,
      userRef,
      ...(kmuRef ? [kmuRef] : []),
      ...assignSnap.docs.map((d) => d.ref),
      ...resultsSnap.docs.map((d) => d.ref),
    ];

    // Delete in atomic chunks of 250
    const BATCH_LIMIT = 250;
    for (let i = 0; i < allDocRefs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = allDocRefs.slice(i, i + BATCH_LIMIT);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  },
};

export default studentService;

