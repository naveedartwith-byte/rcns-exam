/**
 * KMU Registration Number Utilities
 * Format: YYYY/KMU-RCNS/NNN
 * Examples:
 *  - 2026/KMU-RCNS/001
 *  - 2026/KMU-RCNS/002
 *  - 2026/KMU-RCNS/1050 (supports growth beyond 999)
 */

// Matches YYYY (4 digits) / KMU-RCNS / 1 or more digits (at least 3 recommended, e.g. 001, 1000)
export const KMU_REGISTRATION_REGEX = /^(\d{4})\/KMU-RCNS\/(\d{3,})$/i;

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
 * Validates whether a given string matches the KMU registration pattern.
 */
export function isValidKmuRegistration(registrationNo: string): boolean {
  if (!registrationNo || typeof registrationNo !== 'string') return false;
  return KMU_REGISTRATION_REGEX.test(registrationNo.trim());
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
 * Formats year and sequence number into a valid KMU registration number.
 */
export function formatKmuRegistration(year: number, sequenceNumber: number): string {
  const paddedSeq = sequenceNumber.toString().padStart(3, '0');
  return `${year}/KMU-RCNS/${paddedSeq}`;
}
