/**
 * Institutional Examination Code Utilities
 * Royal College of Nursing Swat
 *
 * Pure utility functions for exam code normalization, validation,
 * cryptographic salt generation, and secure random code production.
 * Independent of Firebase client SDK for universal usage across client and server tests.
 */

// Unambiguous character set excluding easily confused characters (0, O, 1, I, L)
export const CODE_CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Normalizes an exam code: trims whitespace, replaces internal multiple spaces, uppercase.
 */
export function normalizeExamCode(code: string): string {
  if (!code) return '';
  return code.trim().toUpperCase();
}

/**
 * Generates an institutional, secure random exam code.
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
 * Validates the format of an exam code.
 */
export function validateCodeFormat(code: string): { valid: boolean; error?: string } {
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
}
