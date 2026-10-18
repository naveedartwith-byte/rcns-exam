/**
 * KMU Registration Number Utilities
 * Format: YYYY/KMU-RCNS/NNN
 * Examples:
 *  - 2026/KMU-RCNS/001
 *  - 2026/KMU-RCNS/002
 *  - 2026/KMU-RCNS/1050 (supports growth beyond 999)
 */

// Matches YYYY / KMU / RCNS / digits (e.g. 2026/KMU/RCNS/01, 2026/KMU/RCNS/001, 2026/KMU-RCNS/001)
export const KMU_REGISTRATION_REGEX = /^(\d{4})[/-]KMU[/-]RCNS[/-](\d{1,})$/i;

/**
 * Normalizes a KMU registration string for uniform storage and registry checks.
 * Strips extra whitespace, converts to uppercase, and replaces separators.
 */
export function normalizeKmuRegistration(rawRegistration: string): string {
  if (!rawRegistration) return '';
  const trimmed = rawRegistration.trim().toUpperCase();
  // Safe normalization for Firestore document IDs (replace '/' with '_')
  return trimmed.replace(/\//g, '_');
}

/**
 * Generates all possible normalized key candidates for Firestore kmuRegistrations lookup.
 * Handles both '/' and '-' separator conventions and 2-digit vs 3-digit padding.
 */
export function generateKmuLookupCandidates(rawRegistration: string): string[] {
  if (!rawRegistration) return [];
  const trimmed = rawRegistration.trim().toUpperCase();
  const directNorm = normalizeKmuRegistration(trimmed);
  const candidates = new Set<string>();
  candidates.add(directNorm);

  const match = trimmed.match(/^(\d{4})[/-]KMU[/-]RCNS[/-](\d{1,})$/i);
  if (match) {
    const year = match[1];
    const numStr = match[2];
    const numInt = parseInt(numStr, 10);
    const pad2 = numInt.toString().padStart(2, '0');
    const pad3 = numInt.toString().padStart(3, '0');
    const rawNum = numInt.toString();

    [pad2, pad3, rawNum, numStr].forEach((seq) => {
      candidates.add(`${year}_KMU_RCNS_${seq}`);
      candidates.add(`${year}_KMU-RCNS_${seq}`);
    });
  }

  return Array.from(candidates);
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
  const paddedSeq = sequenceNumber.toString().padStart(2, '0');
  return `${year}/KMU/RCNS/${paddedSeq}`;
}
