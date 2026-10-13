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

// Matches official format: YYYY / KMU / RCNS / NN (at least 2 digits, e.g. 01, 02, 10, 105)
export const OFFICIAL_KMU_REGISTRATION_REGEX = /^(\d{4})\/KMU\/RCNS\/(\d{2,})$/i;

// Matches legacy format with hyphen: YYYY / KMU-RCNS / NNN
export const LEGACY_KMU_REGISTRATION_REGEX = /^(\d{4})\/KMU-RCNS\/(\d{2,})$/i;

// Universal regex matching either official or legacy format
export const KMU_REGISTRATION_REGEX = /^(\d{4})\/KMU[-/]RCNS\/(\d{2,})$/i;

/**
 * Normalizes a KMU registration string for uniform storage and registry checks.
 * Strips extra whitespace, converts to uppercase, and removes any path separator hazards.
 */
export function normalizeKmuRegistration(rawRegistration: string): string {
  if (!rawRegistration) return '';
  const trimmed = rawRegistration.trim().toUpperCase();
  // Safe normalization for Firestore document IDs (replace '/' with '_')
  return trimmed.replace(/\//g, '_');
}

/**
 * Validates whether a given string matches the KMU registration pattern (official or legacy).
 */
export function isValidKmuRegistration(registrationNo: string): boolean {
  if (!registrationNo || typeof registrationNo !== 'string') return false;
  return KMU_REGISTRATION_REGEX.test(registrationNo.trim());
}

/**
 * Checks whether a given string strictly matches the new official format: YYYY/KMU/RCNS/NN
 */
export function isOfficialKmuFormat(registrationNo: string): boolean {
  if (!registrationNo || typeof registrationNo !== 'string') return false;
  return OFFICIAL_KMU_REGISTRATION_REGEX.test(registrationNo.trim());
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
  const match = registrationNo.trim().match(KMU_REGISTRATION_REGEX);
  if (!match) return null;

  return {
    year: parseInt(match[1], 10),
    sequenceNumber: parseInt(match[2], 10),
    raw: registrationNo.trim().toUpperCase(),
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
 * Legacy formatter maintained for backward-compatibility tests
 */
export function formatLegacyKmuRegistration(year: number, sequenceNumber: number): string {
  const paddedSeq = sequenceNumber.toString().padStart(3, '0');
  return `${year}/KMU-RCNS/${paddedSeq}`;
}

