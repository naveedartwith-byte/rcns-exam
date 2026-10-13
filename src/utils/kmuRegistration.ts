/**
 * KMU Registration Number Utilities
 *
 * Official Institutional Format (Required):
 *   YYYY/KMU/RCNS/NN
 *   Examples:
 *    - 2026/KMU/RCNS/01
 *    - 2026/KMU/RCNS/02
 *    - 2026/KMU/RCNS/10
 *
 * Backward-compatible Legacy Format:
 *    - 2026/KMU-RCNS/001
 */

// Matches official format: YYYY / KMU / RCNS / NNN (e.g. 2026/KMU/RCNS/001, 2026/KMU/RCNS/01)
export const OFFICIAL_KMU_REGISTRATION_REGEX = /^(\d{4})\/KMU\/RCNS\/(\d+)$/i;

// Matches legacy format with hyphen: YYYY / KMU-RCNS / NNN
export const LEGACY_KMU_REGISTRATION_REGEX = /^(\d{4})\/KMU-RCNS\/(\d+)$/i;

// Universal regex matching either official or legacy format
export const KMU_REGISTRATION_REGEX = /^(\d{4})\/KMU[-/]RCNS\/(\d+)$/i;

/**
 * Trims unnecessary whitespace from KMU registration inputs,
 * collapses spaces around slashes, and converts to uppercase.
 * Example: " 2026 / kmu / rcns / 001 " -> "2026/KMU/RCNS/001"
 */
export function sanitizeKmuRegistration(rawRegistration: string): string {
  if (!rawRegistration || typeof rawRegistration !== 'string') return '';
  return rawRegistration
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '')
    .toUpperCase();
}

/**
 * Normalizes a KMU registration string for uniform storage and registry checks.
 * Strips extra whitespace, converts to uppercase, and removes any path separator hazards.
 */
export function normalizeKmuRegistration(rawRegistration: string): string {
  if (!rawRegistration) return '';
  const sanitized = sanitizeKmuRegistration(rawRegistration);
  // Safe normalization for Firestore document IDs (replace '/' with '_')
  return sanitized.replace(/\//g, '_');
}

/**
 * Validates whether a given string matches the KMU registration pattern (official or legacy).
 */
export function isValidKmuRegistration(registrationNo: string): boolean {
  if (!registrationNo || typeof registrationNo !== 'string') return false;
  const sanitized = sanitizeKmuRegistration(registrationNo);
  return KMU_REGISTRATION_REGEX.test(sanitized);
}

/**
 * Checks whether a given string strictly matches the new official format: YYYY/KMU/RCNS/NNN
 */
export function isOfficialKmuFormat(registrationNo: string): boolean {
  if (!registrationNo || typeof registrationNo !== 'string') return false;
  const sanitized = sanitizeKmuRegistration(registrationNo);
  const match = sanitized.match(OFFICIAL_KMU_REGISTRATION_REGEX);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  if (year < 1990 || year > 2099) return false;
  return true;
}

/**
 * Parses components of a KMU registration number.
 */
export function parseKmuRegistration(registrationNo: string): {
  year: number;
  sequenceNumber: number;
  raw: string;
} | null {
  if (!isValidKmuRegistration(registrationNo)) {
    return null;
  }
  const sanitized = sanitizeKmuRegistration(registrationNo);
  const match = sanitized.match(KMU_REGISTRATION_REGEX);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    sequenceNumber: parseInt(match[2], 10),
    raw: sanitized,
  };
}

/**
 * Formats year and sequence number into the official KMU registration number:
 * e.g. 2026/KMU/RCNS/01
 * Suffix starts at 01 and is padded with leading zeroes to at least 2 digits.
 */
export function formatKmuRegistration(year: number, sequenceNumber: number): string {
  const paddedSeq = sequenceNumber.toString().padStart(2, '0');
  return `${year}/KMU/RCNS/${paddedSeq}`;
}

/**
 * Formats year and sequence number into 3-digit official format:
 * e.g. 2026/KMU/RCNS/001
 */
export function formatKmuRegistration3Digit(year: number, sequenceNumber: number): string {
  const paddedSeq = sequenceNumber.toString().padStart(3, '0');
  return `${year}/KMU/RCNS/${paddedSeq}`;
}

/**
 * Legacy formatter maintained for backward-compatibility tests
 */
export function formatLegacyKmuRegistration(year: number, sequenceNumber: number): string {
  const paddedSeq = sequenceNumber.toString().padStart(3, '0');
  return `${year}/KMU-RCNS/${paddedSeq}`;
}

