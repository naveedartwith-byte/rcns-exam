import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
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
};

export default teacherService;
