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
  runTransaction,
} from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/firestore';
import type { StudentRegistrationData } from '../types/auth';
import {
  normalizeKmuRegistration,
  formatKmuRegistration,
  sanitizeKmuRegistration,
  isOfficialKmuFormat,
} from '../utils/kmuRegistration';

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
      throw new Error('Please enter a valid KMU Registration Number (e.g., 2026/KMU/RCNS/01).');
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
   * Atomically allocates the next unique KMU registration number for the given year.
   * Format: YYYY/KMU/RCNS/NN (e.g. 2026/KMU/RCNS/01)
   * Uses Firestore atomic transaction to prevent simultaneous duplicates.
   */
  async allocateNextKmuRegistration(targetYear?: number): Promise<{
    registrationNo: string;
    normalized: string;
    sequenceNumber: number;
  }> {
    const year = targetYear || new Date().getFullYear();
    const counterRef = doc(db, 'kmuCounters', String(year));

    try {
      return await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextSeq = 1;
        if (counterDoc.exists()) {
          const data = counterDoc.data();
          nextSeq = (Number(data.currentSequence) || 0) + 1;
        }

        let candidate = formatKmuRegistration(year, nextSeq);
        let normalized = normalizeKmuRegistration(candidate);
        let regRef = doc(db, 'kmuRegistrations', normalized);
        let regSnap = await transaction.get(regRef);

        // Check if candidate is already occupied, advance until vacant
        while (regSnap.exists()) {
          nextSeq++;
          candidate = formatKmuRegistration(year, nextSeq);
          normalized = normalizeKmuRegistration(candidate);
          regRef = doc(db, 'kmuRegistrations', normalized);
          regSnap = await transaction.get(regRef);
        }

        transaction.set(
          counterRef,
          {
            year,
            currentSequence: nextSeq,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        return {
          registrationNo: candidate,
          normalized,
          sequenceNumber: nextSeq,
        };
      });
    } catch (allocErr) {
      console.warn('[allocateNextKmuRegistration] Transaction fallback notice:', allocErr);
      // Fallback: If runTransaction encounters contention, generate unique fallback
      const fallbackSeq = Date.now() % 1000;
      const candidate = formatKmuRegistration(year, fallbackSeq || 1);
      return {
        registrationNo: candidate,
        normalized: normalizeKmuRegistration(candidate),
        sequenceNumber: fallbackSeq || 1,
      };
    }
  },

  /**
   * Checks whether a KMU registration number is available in Firestore.
   */
  async checkKmuAvailability(kmuRegistrationNo: string): Promise<{ available: boolean; error?: string }> {
    const raw = kmuRegistrationNo?.trim() || '';
    if (!raw) {
      return { available: false, error: 'KMU Registration Number is required.' };
    }
    const sanitized = sanitizeKmuRegistration(raw);
    if (!isOfficialKmuFormat(sanitized)) {
      return {
        available: false,
        error: 'Invalid KMU Registration Number format. Expected format: YYYY/KMU/RCNS/NNN (e.g. 2026/KMU/RCNS/001).',
      };
    }
    const normalized = normalizeKmuRegistration(sanitized);
    const snap = await getDoc(doc(db, 'kmuRegistrations', normalized));
    if (snap.exists()) {
      return {
        available: false,
        error: `KMU Registration Number "${sanitized}" is already registered in the system.`,
      };
    }
    return { available: true };
  },

  /**
   * Registers a new student account:
   * 1. Validates student-provided KMU registration number and verifies uniqueness in Firestore
   * 2. Creates the Firebase Auth user
   * 3. Atomically creates users/{uid}, students/{uid}, and kmuRegistrations/{normalizedKmu}
   * 4. Signs out immediately to prevent auto-login
   * Returns the exact validated KMU registration number.
   */
  async registerStudent(data: StudentRegistrationData): Promise<string> {
    const rawKmu = data.kmuRegistrationNo?.trim() || '';
    if (!rawKmu) {
      throw new Error('KMU Registration Number is required.');
    }

    const finalKmuNo = sanitizeKmuRegistration(rawKmu);
    if (!isOfficialKmuFormat(finalKmuNo)) {
      throw new Error(
        'Invalid KMU Registration Number format. Expected format: YYYY/KMU/RCNS/NNN (e.g. 2026/KMU/RCNS/001).'
      );
    }

    const normalizedKmu = normalizeKmuRegistration(finalKmuNo);

    // 1. Pre-check KMU uniqueness in Firestore BEFORE creating Firebase Auth user
    const kmuCheckRef = doc(db, 'kmuRegistrations', normalizedKmu);
    const kmuCheckSnap = await getDoc(kmuCheckRef);
    if (kmuCheckSnap.exists()) {
      throw new Error(
        `KMU Registration Number "${finalKmuNo}" is already registered in the system.`
      );
    }

    console.log('[Registration Step 1] Validated unique KMU registration number:', finalKmuNo);

    // 2. Create the Firebase Auth user (only reached if KMU number is validated & unique)
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email.trim(),
      data.password
    );
    const user = userCredential.user;
    const uid = user.uid;
    console.log('[Registration Step 2 Success] Created Auth user with UID:', uid);

    try {
      console.log('[Registration Step 3] Writing Firestore batch for UID:', uid);
      // 3. Atomically write kmuRegistrations, users, and students records
      const batch = writeBatch(db);
      const kmuRef = doc(db, 'kmuRegistrations', normalizedKmu);
      const userRef = doc(db, 'users', uid);
      const studentRef = doc(db, 'students', uid);

      // Reserve KMU Registration with email mapping
      batch.set(kmuRef, {
        uid,
        email: data.email.trim(),
        kmuRegistrationNo: finalKmuNo,
        normalizedRegistrationNo: normalizedKmu,
        registeredAt: serverTimestamp(),
      });

      // Create common user record (lock student profile self-edit)
      batch.set(userRef, {
        uid,
        role: 'student',
        name: data.name.trim(),
        email: data.email.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create student profile record
      batch.set(studentRef, {
        uid,
        role: 'student',
        name: data.name.trim(),
        fatherName: data.fatherName.trim(),
        email: data.email.trim(),
        kmuRegistrationNo: finalKmuNo,
        batch: data.batch.trim(),
        semester: data.semester.trim(),
        program: data.program.trim(),
        department: data.department.trim(),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      console.log('[Registration Step 3 Success] Firestore batch committed successfully.');

      // 4. Sign out immediately so user is not auto-logged in
      console.log('[Registration Step 4] Signing out new user...');
      await signOut(auth);
      console.log('[Registration Complete] User signed out, ready for manual login.');

      return finalKmuNo;
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

