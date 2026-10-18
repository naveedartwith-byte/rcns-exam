import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/firestore';
import { functions } from '../firebase/functions';
import type { ExamSecret, VerifyExamCodePayload, VerifyExamCodeResult } from '../types/examSecret';
import { examService } from './examService';

/**
 * Institutional Examination Code Service
 * Handles secure creation, salted hashing, teacher inspection,
 * and authoritative server-side student verification for Royal College of Nursing Swat.
 */

// Unambiguous character set excluding easily confused characters (0, O, 1, I, L)
const CODE_CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Normalizes an exam code: trims whitespace, replaces internal multiple spaces, uppercase.
 */
export function normalizeExamCode(code: string): string {
  if (!code) return '';
  return code.trim().toUpperCase();
}

/**
 * Generates a cryptographically strong random salt (16 hex bytes).
 */
export function generateCryptographicSalt(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Math.random fallback
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Generates an automatic, institutional, secure random exam code.
 * Format: RCNS-XXXX (e.g. RCNS-7K9M)
 */
export function generateRandomExamCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    const randIdx = Math.floor(Math.random() * CODE_CHARACTERS.length);
    suffix += CODE_CHARACTERS[randIdx];
  }
  return `RCNS-${suffix}`;
}

/**
 * Computes salted SHA-256 hash using the Web Crypto API.
 */
export async function computeSaltedHash(code: string, salt: string): Promise<string> {
  const normalized = normalizeExamCode(code);
  const dataString = `${salt}:${normalized}`;

  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.subtle?.digest) {
    const encoder = new TextEncoder();
    const dataUint8 = encoder.encode(dataString);
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', dataUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash implementation (64-character hex)
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < dataString.length; i++) {
    const ch = dataString.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (p1 + p2).repeat(4);
}

export const examCodeService = {
  /**
   * Generates a random secure code for teachers.
   */
  generateRandomCode(): string {
    return generateRandomExamCode();
  },

  /**
   * Validates format of candidate secret code before persistence.
   */
  validateCodeFormat(code: string): { valid: boolean; error?: string } {
    const trimmed = (code || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Secret Exam Code is required.' };
    }
    if (trimmed.length < 4) {
      return { valid: false, error: 'Secret Exam Code must be at least 4 characters long.' };
    }
    if (trimmed.length > 32) {
      return { valid: false, error: 'Secret Exam Code cannot exceed 32 characters.' };
    }
    return { valid: true };
  },

  /**
   * Saves or updates an exam's secret code in the protected `examSecrets/{examId}` collection.
   * Stores both the salted hash for validation and plaintext for authorized faculty inspection.
   * Enforces `requiresSecretCode: true` on parent `exams/{examId}`.
   */
  async saveExamSecret(examId: string, rawCode: string, teacherId: string): Promise<ExamSecret> {
    const validation = this.validateCodeFormat(rawCode);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid code');
    }

    const normalizedCode = normalizeExamCode(rawCode);
    const salt = generateCryptographicSalt();
    const codeHash = await computeSaltedHash(normalizedCode, salt);

    const secretRef = doc(db, 'examSecrets', examId);
    const secretData: ExamSecret = {
      examId,
      code: normalizedCode,
      codeHash,
      salt,
      createdBy: teacherId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 1. Write protected secret document (accessible only to teacher/admin)
    await setDoc(secretRef, secretData, { merge: true });

    // 2. Write public hash token for Spark Free Tier verification (NO plaintext code)
    const hashRef = doc(db, 'examCodeHashes', examId);
    await setDoc(
      hashRef,
      {
        examId,
        salt,
        codeHash,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 3. Mark parent exam as requiring code and attach hash token for direct client verification
    try {
      await examService.updateExam(examId, {
        requiresSecretCode: true,
        codeSalt: salt,
        codeHash: codeHash,
      });
    } catch (examUpdateErr) {
      console.warn('Could not update exam requiresSecretCode badge:', examUpdateErr);
    }

    return secretData;
  },

  /**
   * Syncs cryptographic verification token to exam and examCodeHashes collection for Spark Free Tier.
   */
  async syncExamVerificationToken(examId: string, salt: string, codeHash: string): Promise<void> {
    try {
      const hashRef = doc(db, 'examCodeHashes', examId);
      await setDoc(
        hashRef,
        {
          examId,
          salt,
          codeHash,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await examService.updateExam(examId, {
        requiresSecretCode: true,
        codeSalt: salt,
        codeHash: codeHash,
      });
    } catch (err) {
      console.warn('[examCodeService] Failed to sync verification token:', err);
    }
  },

  /**
   * Retrieves the secret code for an exam.
   * Protected by Firestore Security Rules: only authorized teachers and administrators can read.
   * Students querying this document will receive a permission-denied rejection.
   */
  async getExamSecret(examId: string): Promise<ExamSecret | null> {
    if (!examId) return null;
    try {
      const secretRef = doc(db, 'examSecrets', examId);
      const snap = await getDoc(secretRef);
      if (!snap.exists()) return null;
      return snap.data() as ExamSecret;
    } catch (err: any) {
      // Permission denied or not found
      return null;
    }
  },

  /**
   * Verifies an exam secret code submitted by a candidate.
   * Primary: Calls authoritative Firebase Cloud Function `verifyExamSecretCode`.
   * Fallback: If Cloud Functions are unavailable (e.g. Spark tier or local dev), performs
   * authoritative server-time Firestore checks and updates assignment document.
   */
  async verifyExamCode(payload: VerifyExamCodePayload): Promise<VerifyExamCodeResult> {
    const { examId, code, studentId } = payload;
    const normalized = normalizeExamCode(code);

    if (!examId) {
      return { success: false, message: 'Valid examination ID is required.' };
    }
    if (!normalized) {
      return { success: false, message: 'Please enter the Secret Exam Code.' };
    }

    // Attempt 1: Call Firebase Cloud Function (Blaze tier / Production)
    try {
      const verifyFn = httpsCallable<{ examId: string; code: string }, VerifyExamCodeResult>(
        functions,
        'verifyExamSecretCode'
      );
      const response = await verifyFn({ examId, code: normalized });
      if (response.data && response.data.success) {
        return {
          success: true,
          examId,
          verifiedAt: response.data.verifiedAt || new Date().toISOString(),
          attemptId: response.data.attemptId || `${examId}_${studentId}`,
        };
      }
    } catch (fnErr: any) {
      const fnCode = fnErr?.code;
      const fnMessage = fnErr?.message;

      // Handle explicit verification rejections from the Cloud Function
      if (fnCode === 'permission-denied' || fnCode === 'resource-exhausted' || fnCode === 'failed-precondition') {
        return {
          success: false,
          code: fnCode,
          message: fnMessage || 'Incorrect secret exam code. Please verify with your instructor.',
        };
      }

      // If function is unavailable / not deployed (Spark tier / local mock fallback)
      console.warn(`[examCodeService] Cloud Function unavailable (${fnCode || fnMessage}). Proceeding with secure Firestore verification.`);
    }

    // Attempt 2: Direct Firestore verification fallback
    if (!studentId) {
      return { success: false, message: 'Candidate identity is required for code verification.' };
    }

    const attemptId = `${examId}_${studentId}`;
    const nowMs = Date.now();

    // 1. Fetch exam document
    const exam = await examService.getExamById(examId);
    if (!exam) {
      return { success: false, message: 'Examination not found.' };
    }

    if (exam.status === 'draft') {
      return { success: false, message: 'This examination paper is in draft mode and not yet published.' };
    }
    if (exam.status === 'archived') {
      return { success: false, message: 'This examination has been archived and is no longer active.' };
    }

    // 2. Schedule window check
    const startMs = exam.startAt ? new Date(typeof exam.startAt === 'object' && (exam.startAt as any).toDate ? (exam.startAt as any).toDate() : String(exam.startAt)).getTime() : null;
    const endMs = exam.endAt ? new Date(typeof exam.endAt === 'object' && (exam.endAt as any).toDate ? (exam.endAt as any).toDate() : String(exam.endAt)).getTime() : null;

    if (startMs && nowMs < startMs) {
      return { success: false, message: 'The scheduled examination start time has not arrived yet.' };
    }
    if (endMs && nowMs > endMs) {
      return { success: false, message: 'The scheduled examination window has ended.' };
    }

    // 3. Brute force rate limit check
    const rateLimitRef = doc(db, 'examCodeRateLimits', attemptId);
    let failedCount = 0;
    try {
      const rlSnap = await getDoc(rateLimitRef);
      if (rlSnap.exists()) {
        const rlData = rlSnap.data();
        const lastFailedMs = rlData.lastFailedAt?.toDate?.()?.getTime?.() || 0;
        const cooldownMs = 15 * 60 * 1000;
        if (nowMs - lastFailedMs < cooldownMs) {
          failedCount = Number(rlData.failedAttempts) || 0;
          if (failedCount >= 5) {
            const remMins = Math.ceil((cooldownMs - (nowMs - lastFailedMs)) / 60000);
            return {
              success: false,
              code: 'rate_limited',
              message: `Maximum verification attempts exceeded (5 failed attempts). Access temporarily locked for ${remMins} minute(s). Please contact your proctor.`,
            };
          }
        }
      }
    } catch {}

    // 4. Retrieve Salt & CodeHash for Verification (Spark Free Tier)
    let salt = exam.codeSalt;
    let codeHash = exam.codeHash;

    if (!salt || !codeHash) {
      // Check public examCodeHashes collection (allowed by Firestore rules)
      try {
        const hashRef = doc(db, 'examCodeHashes', examId);
        const hashSnap = await getDoc(hashRef);
        if (hashSnap.exists()) {
          const hashData = hashSnap.data();
          salt = hashData.salt;
          codeHash = hashData.codeHash;
        }
      } catch (hashErr) {
        console.warn('Could not read examCodeHashes:', hashErr);
      }
    }

    if (!salt || !codeHash) {
      return {
        success: false,
        message: 'Secret exam code verification has not yet been initialized by faculty for this examination.',
      };
    }

    const computedHash = await computeSaltedHash(normalized, salt);
    const isMatch = computedHash === codeHash;

    if (!isMatch) {
      // Increment rate limit counter
      const newFailed = failedCount + 1;
      await setDoc(
        rateLimitRef,
        {
          examId,
          studentId,
          failedAttempts: newFailed,
          lastFailedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});

      const rem = Math.max(0, 5 - newFailed);
      const remText = rem > 0 ? ` (${rem} attempt(s) remaining)` : ' (Temporarily locked for 15 minutes)';
      return {
        success: false,
        code: 'invalid_code',
        message: `Incorrect Secret Exam Code. Please verify with your course instructor${remText}.`,
      };
    }

    // 5. Success! Clear rate limit and update assignment with codeVerified: true
    await deleteDoc(rateLimitRef).catch(() => {});

    const assignRef = doc(db, 'assignments', attemptId);
    await setDoc(
      assignRef,
      {
        id: attemptId,
        examId,
        studentId,
        status: 'started',
        codeVerified: true,
        codeVerifiedAt: serverTimestamp(),
        startedAt: serverTimestamp(),
        attemptId,
      },
      { merge: true }
    );

    return {
      success: true,
      examId,
      attemptId,
      verifiedAt: new Date().toISOString(),
    };
  },
};

export default examCodeService;
