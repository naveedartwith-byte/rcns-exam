import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { AdminProfile } from '../types/admin';
import type { TeacherProfile } from '../types/teacher';

export const adminService = {
  /**
   * Retrieves an admin's profile by UID.
   */
  async getAdminProfile(uid: string): Promise<AdminProfile | null> {
    const docRef = doc(db, 'admins', uid);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data() as AdminProfile;
  },

  /**
   * Provisions a teacher profile in Firestore.
   * Authentication account creation is performed via Firebase Auth.
   * Passwords are NEVER written to Firestore.
   */
  async provisionTeacher(teacherData: {
    uid: string;
    name: string;
    email: string;
    department: string;
  }): Promise<TeacherProfile> {
    const teacherProfile: TeacherProfile = {
      uid: teacherData.uid,
      role: 'teacher',
      name: teacherData.name.trim(),
      email: teacherData.email.trim(),
      department: teacherData.department.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const teacherRef = doc(db, 'teachers', teacherData.uid);
    const userRef = doc(db, 'users', teacherData.uid);

    await setDoc(teacherRef, {
      ...teacherProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(userRef, {
      uid: teacherData.uid,
      role: 'teacher',
      name: teacherData.name.trim(),
      email: teacherData.email.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return teacherProfile;
  },
};

export default adminService;
