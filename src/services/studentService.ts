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
   * Updates student profile fields (Only permitted by authorized Admin with audit logging).
   * Direct student self-updating is strictly rejected to preserve official KMU registration records.
   */
  async updateStudentProfile(
    _uid: string,
    _data: Partial<Omit<StudentProfile, 'uid' | 'role' | 'createdAt'>>
  ): Promise<void> {
    throw new Error(
      'Official student profile fields are locked to preserve institutional examination integrity. Please contact College Administration for amendments.'
    );
  },

  /**
   * Authorized Administrator method to update official student registration profile.
   * Performs collision checking for KMU registration numbers and records an administrative audit log.
   */
  async adminUpdateStudentProfile(
    studentUid: string,
    data: Partial<Omit<StudentProfile, 'uid' | 'role' | 'createdAt'>>,
    adminUid?: string
  ): Promise<void> {
    const studentRef = doc(db, 'students', studentUid);
    const userRef = doc(db, 'users', studentUid);

    // If KMU number is changing, check collision in kmuRegistrations
    if (data.kmuRegistrationNo) {
      const normalized = normalizeKmuRegistration(data.kmuRegistrationNo);
      const kmuRef = doc(db, 'kmuRegistrations', normalized);
      const kmuSnap = await getDoc(kmuRef);
      if (kmuSnap.exists() && kmuSnap.data().uid !== studentUid) {
        throw new Error(
          `KMU Registration Number "${data.kmuRegistrationNo}" is already allocated to another candidate.`
        );
      }
      // Update KMU reservation doc
      await setDoc(
        kmuRef,
        {
          uid: studentUid,
          email: data.email || '',
          kmuRegistrationNo: data.kmuRegistrationNo,
          normalizedRegistrationNo: normalized,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    await updateDoc(studentRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    // Synchronize common user record if name or email changed
    const userUpdates: Record<string, any> = { updatedAt: serverTimestamp() };
    if (data.name) userUpdates.name = data.name;
    if (data.email) userUpdates.email = data.email;
    await updateDoc(userRef, userUpdates).catch(() => null);

    // Record administrative audit trail
    try {
      const auditCol = collection(db, 'auditLogs');
      const auditRef = doc(auditCol);
      await setDoc(auditRef, {
        id: auditRef.id,
        action: 'ADMIN_UPDATE_STUDENT_PROFILE',
        studentUid,
        adminUid: adminUid || 'authorized-admin',
        updatedFields: Object.keys(data),
        timestamp: serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('Could not record administrative audit trail:', auditErr);
    }
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

