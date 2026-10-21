import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { TeacherProfile } from '../types/teacher';

export const teacherService = {
  /**
   * Retrieves a teacher's profile by UID.
   */
  async getTeacherProfile(uid: string): Promise<TeacherProfile | null> {
    const docRef = doc(db, 'teachers', uid);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data() as TeacherProfile;
  },

  /**
   * Updates teacher profile details.
   */
  async updateTeacherProfile(
    uid: string,
    data: Partial<Omit<TeacherProfile, 'uid' | 'role' | 'createdAt'>>
  ): Promise<void> {
    const docRef = doc(db, 'teachers', uid);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Retrieves all teacher profiles.
   */
  async getAllTeachers(): Promise<TeacherProfile[]> {
    const teachersCol = collection(db, 'teachers');
    const snapshot = await getDocs(teachersCol);
    return snapshot.docs.map((docSnap) => docSnap.data() as TeacherProfile);
  },

  /**
   * Permanently deletes a faculty member record from teachers and users collections.
   * Safeguards against deleting Super Administrator accounts.
   */
  async deleteTeacherPermanently(teacherUid: string, email?: string): Promise<void> {
    if (!teacherUid) {
      throw new Error('Valid faculty UID is required for deletion.');
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    if (
      normalizedEmail === 'naveedartwith@gmail.com' ||
      normalizedEmail === 'admin@royalcollege.edu.pk' ||
      normalizedEmail.startsWith('admin@')
    ) {
      throw new Error('Security Notice: The institutional Super Administrator account is protected and cannot be deleted.');
    }

    const teacherRef = doc(db, 'teachers', teacherUid);
    const userRef = doc(db, 'users', teacherUid);

    const batch = writeBatch(db);
    batch.delete(teacherRef);
    batch.delete(userRef);
    await batch.commit();
  },
};

export default teacherService;
