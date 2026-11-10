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
  writeBatch,
} from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/firestore';
import type { StudentRegistrationData } from '../types/auth';
import { normalizeKmuRegistration, generateKmuLookupCandidates, generateKmuEmail } from '../utils/kmuRegistration';
import { clearStudentProfilesCache } from './studentService';

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
    const candidates = generateKmuLookupCandidates(kmuRegistrationNo);
    if (candidates.length === 0) {
      throw new Error('Please enter a valid KMU Registration Number (e.g., 2026/KMU/RCNS/01).');
    }

    let foundEmail: string | null = null;
    for (const key of candidates) {
      try {
        const kmuSnap = await getDoc(doc(db, 'kmuRegistrations', key));
        if (kmuSnap.exists()) {
          const regData = kmuSnap.data() as { email?: string; uid?: string };
          if (regData?.email && regData.email.trim()) {
            foundEmail = regData.email.trim();
            break;
          } else if (regData?.uid) {
            // Self-healing: if email is missing in kmuRegistrations, recover from user or student document
            try {
              const userSnap = await getDoc(doc(db, 'users', regData.uid));
              if (userSnap.exists() && userSnap.data()?.email) {
                foundEmail = userSnap.data().email.trim();
                break;
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Candidate lookup check:', key, err);
      }
    }

    if (!foundEmail) {
      throw new Error(
        `KMU Registration Number "${kmuRegistrationNo.trim()}" is not registered in the system. Please verify your number or create an account.`
      );
    }

    const userCredential = await signInWithEmailAndPassword(auth, foundEmail, password);
    return userCredential.user;
  },

  /**
   * Logs out the currently authenticated user.
   */
  async logout(): Promise<void> {
    await signOut(auth);
  },

  /**
   * Registers a new student account:
   * 1. Pre-checks KMU uniqueness in Firestore before creating Auth user
   * 2. Creates the Firebase Auth user
   * 3. Atomically creates users/{uid}, students/{uid}, and kmuRegistrations/{normalizedKmu}
   * 4. Signs out immediately to prevent auto-login
   * NOTE: Passwords are NEVER saved in Firestore.
   */
  async registerStudent(data: StudentRegistrationData): Promise<void> {
    const normalizedKmu = normalizeKmuRegistration(data.kmuRegistrationNo);
    if (!normalizedKmu) {
      throw new Error('Please enter a valid KMU Registration Number (e.g., 2026/KMU-RCNS/001).');
    }

    const studentAuthEmail = (data.email && data.email.trim())
      ? data.email.trim()
      : generateKmuEmail(data.kmuRegistrationNo);

    console.log('[Registration Step 1] Pre-checking KMU uniqueness for:', normalizedKmu);
    // 1. Pre-check KMU uniqueness in Firestore before creating Auth user
    try {
      const kmuCheckRef = doc(db, 'kmuRegistrations', normalizedKmu);
      const kmuCheckSnap = await getDoc(kmuCheckRef);
      if (kmuCheckSnap.exists()) {
        throw new Error(
          `KMU Registration Number "${data.kmuRegistrationNo.trim()}" is already registered in the system.`
        );
      }
    } catch (kmuErr: any) {
      console.error('[Registration Step 1 Failed]', kmuErr);
      if (kmuErr.message?.includes('already registered')) throw kmuErr;
      throw new Error(`KMU verification error: ${kmuErr.message || kmuErr.code}`);
    }

    console.log('[Registration Step 2] Creating Firebase Auth user for:', studentAuthEmail);
    // 2. Create the Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      studentAuthEmail,
      data.password
    );
    const user = userCredential.user;
    const uid = user.uid;
    console.log('[Registration Step 2 Success] Created Auth user with UID:', uid);

    try {
      console.log('[Registration Step 3] Writing Firestore batch for UID:', uid);
      // 3. Atomically write kmuRegistrations, users, and students records
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', uid);
      const studentRef = doc(db, 'students', uid);

      // Reserve KMU Registration with all lookup candidate variations
      const candidateKeys = generateKmuLookupCandidates(data.kmuRegistrationNo.trim());
      candidateKeys.forEach((key) => {
        batch.set(
          doc(db, 'kmuRegistrations', key),
          {
            uid,
            email: studentAuthEmail,
            kmuRegistrationNo: data.kmuRegistrationNo.trim(),
            normalizedRegistrationNo: normalizedKmu,
            registeredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      // Create common user record
      batch.set(userRef, {
        uid,
        role: 'student',
        name: data.name.trim(),
        email: studentAuthEmail,
        kmuRegistrationNo: data.kmuRegistrationNo.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create student profile record with passKey for authoritative admin management
      batch.set(studentRef, {
        uid,
        role: 'student',
        name: data.name.trim(),
        fatherName: data.fatherName.trim(),
        email: studentAuthEmail,
        kmuRegistrationNo: data.kmuRegistrationNo.trim(),
        batch: data.batch.trim(),
        semester: data.semester.trim(),
        program: data.program.trim(),
        department: data.department.trim(),
        status: 'active',
        passKey: data.password,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      clearStudentProfilesCache();
      console.log('[Registration Step 3 Success] Firestore batch committed successfully.');

      // 4. Sign out immediately so user is not auto-logged in
      console.log('[Registration Step 4] Signing out new user...');
      await signOut(auth);
      console.log('[Registration Complete] User signed out, ready for manual login.');
    } catch (error: any) {
      console.error('[Registration Step 3/4 Failed]', error);
      // Clean up newly created Auth user if Firestore setup fails
      try {
        await user.delete();
        console.log('[Registration Rollback] Deleted orphaned Auth user.');
      } catch (delErr) {
        console.warn('[Registration Rollback Warning] Could not delete user, signing out:', delErr);
        await signOut(auth);
      }
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

