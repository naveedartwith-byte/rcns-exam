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
  getDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/firestore';
import type { StudentRegistrationData } from '../types/auth';
import { normalizeKmuRegistration } from '../utils/kmuRegistration';

/**
 * Authentication Service Module
 * Handles Firebase Auth operations with Email/Password, KMU login resolution,
 * and linked Firestore identity creation.
 */

export const authService = {
  /**
   * Logs in a teacher or admin user using Email and Password.
   */
  async login(email: string, password: string): Promise<FirebaseUser> {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return userCredential.user;
  },

  /**
   * Logs in a student using KMU Registration Number + Password.
   * Resolves the student's KMU Registration Number to their Firebase Auth account.
   */
  async loginWithKmu(kmuRegistrationNo: string, password: string): Promise<FirebaseUser> {
    const normalizedKmu = normalizeKmuRegistration(kmuRegistrationNo);
    if (!normalizedKmu) {
      throw new Error('Please enter a valid KMU Registration Number (e.g., 2026/KMU-RCNS/001).');
    }

    const kmuRef = doc(db, 'kmuRegistrations', normalizedKmu);
    const kmuDoc = await getDoc(kmuRef);

    if (!kmuDoc.exists()) {
      throw new Error(
        `KMU Registration Number "${kmuRegistrationNo.trim()}" is not registered in the system. Please verify your number or create an account.`
      );
    }

    const regData = kmuDoc.data() as { email?: string };
    if (!regData?.email) {
      throw new Error('Unable to resolve account credentials for this KMU Registration Number.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, regData.email.trim(), password);
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
   * Does NOT auto-login the user after registration.
   */
  async registerStudent(data: StudentRegistrationData): Promise<void> {
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

        // Reserve KMU Registration with email mapping
        transaction.set(kmuRef, {
          uid,
          email: data.email.trim(),
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
          batch: data.batch.trim(),
          semester: data.semester.trim(),
          program: data.program.trim(),
          department: data.department.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // Sign out immediately so user is not auto-logged in
      await signOut(auth);
    } catch (error) {
      // If Firestore setup failed after Auth user creation, sign out and bubble error
      await signOut(auth);
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

