import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { UserProfile } from '../types/user';

export const userService = {
  /**
   * Retrieves common identity profile for a user.
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'users', uid);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data() as UserProfile;
  },

  /**
   * Updates common user profile fields.
   */
  async updateUserProfile(uid: string, data: Partial<Omit<UserProfile, 'uid' | 'role' | 'createdAt'>>): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },
};

export default userService;
