import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  type User as FirebaseUser,
  type Unsubscribe,
} from 'firebase/auth';
import {
  doc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/firestore';
import type { StudentRegistrationData } from '../types/auth';
import { normalizeKmuRegistration } from '../utils/kmuRegistration';

/**
 * Authentication Service Module
 * Handles Firebase Auth operations with Email/Password and linked Firestore identity creation.
 */

export const authService = {
  /**
   * Logs in an existing user using Email and Password.
   */
  async login(email: string, password: string): Promise<FirebaseUser> {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  },

  /**
   * Logs out the currently authenticated user.
   */
  async logout(): Promise<void> {
    await signOut(auth);
  },

  /**
   * Registers a new student account, verifies KMU uniqueness via atomic transaction,
   * creates the auth user, common user doc, student profile doc, and KMU registry claim.
   * NOTE: Passwords are NEVER saved in Firestore.
   */
  async registerStudent(data: StudentRegistrationData): Promise<FirebaseUser> {
    const normalizedKmu = normalizeKmuRegistration(data.kmuRegistrationNo);

    // 1. Create the Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email.trim(),
      data.password
    );
    const user = userCredential.user;
    const uid = user.uid;

    try {
      // 2. Perform atomic uniqueness verification and document creation
      await runTransaction(db, async (transaction) => {
        const kmuRef = doc(db, 'kmuRegistrations', normalizedKmu);
        const kmuDoc = await transaction.get(kmuRef);

        if (kmuDoc.exists()) {
          throw new Error(`KMU Registration Number ${data.kmuRegistrationNo} is already registered.`);
        }

        const userRef = doc(db, 'users', uid);
        const studentRef = doc(db, 'students', uid);

        // Reserve KMU Registration
        transaction.set(kmuRef, {
          uid,
          kmuRegistrationNo: data.kmuRegistrationNo.trim(),
          normalizedRegistrationNo: normalizedKmu,
          registeredAt: serverTimestamp(),
        });

        // Create common user record
        transaction.set(userRef, {
          uid,
          role: 'student',
          name: data.name.trim(),
          email: data.email.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Create student profile record
        transaction.set(studentRef, {
          uid,
          role: 'student',
          name: data.name.trim(),
          fatherName: data.fatherName.trim(),
          email: data.email.trim(),
          kmuRegistrationNo: data.kmuRegistrationNo.trim(),
          semester: data.semester.trim(),
          program: data.program.trim(),
          department: data.department.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      return user;
    } catch (error) {
      // If Firestore transaction fails, clean up or surface error
      throw error;
    }
  },

  /**
   * Sends password reset email.
   */
  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
  },

  /**
   * Listens for Firebase Auth state changes.
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): Unsubscribe {
    return onAuthStateChanged(auth, callback);
  },

  /**
   * Returns current authenticated user instance or null.
   */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },
};

export default authService;
