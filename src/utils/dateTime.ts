import type { Exam, ExamStatus } from '../types/exam';

/**
 * Royal College of Nursing Swat operates strictly in Pakistan Standard Time (PKT).
 * PKT is UTC+05:00 (Asia/Karachi).
 */
export const PKT_OFFSET_HOURS = 5;
export const PKT_OFFSET_MS = PKT_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Safely converts various timestamp/date representations into epoch milliseconds.
 * Supports Firestore Timestamp (.toMillis(), .toDate(), or .seconds), Date instances, ISO strings, and numbers.
 */
export function parseDateToMillis(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Check for Firestore Timestamp instance or duck-typed Timestamp
  if (typeof value === 'object' && value !== null) {
    if ('toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
      return (value as { toMillis: () => number }).toMillis();
    }
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    if ('seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
      const s = (value as { seconds: number; nanoseconds?: number });
      return s.seconds * 1000 + Math.floor((s.nanoseconds || 0) / 1000000);
    }
    if (value instanceof Date) {
      return value.getTime();
    }
  }

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  if (typeof value === 'string') {
    // If it's a date-time string without timezone, like "2026-10-15T09:00", interpret as Pakistan Time (+05:00)
    let normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
      normalized = `${normalized}+05:00`;
    }
    const parsed = Date.parse(normalized);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Formats a date/timestamp into a readable string in Pakistan Standard Time (PKT, UTC+05:00).
 * e.g., "15 Oct 2026, 09:00 AM PKT"
 */
export function formatPakistanDateTime(
  value: unknown,
  includeSeconds = false
): string {
  const millis = parseDateToMillis(value);
  if (millis === null) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    });
    return `${formatter.format(new Date(millis))} PKT`;
  } catch {
    // Fallback if Intl timezone is not available
    const d = new Date(millis + PKT_OFFSET_MS);
    return `${d.toUTCString().replace('GMT', 'PKT')}`;
  }
}

/**
 * Formats just the date portion in Pakistan Standard Time.
 * e.g., "15 Oct 2026"
 */
export function formatPakistanDate(value: unknown): string {
  const millis = parseDateToMillis(value);
  if (millis === null) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return formatter.format(new Date(millis));
  } catch {
    const d = new Date(millis);
    return d.toLocaleDateString();
  }
}

/**
 * Formats just the time portion in Pakistan Standard Time.
 * e.g., "09:00 AM"
 */
export function formatPakistanTime(value: unknown): string {
  const millis = parseDateToMillis(value);
  if (millis === null) return 'N/A';

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return formatter.format(new Date(millis));
  } catch {
    const d = new Date(millis);
    return d.toLocaleTimeString();
  }
}

/**
 * Converts any timestamp or date into the YYYY-MM-DDTHH:mm format expected by HTML
 * <input type="datetime-local" /> in Pakistan Standard Time.
 */
export function toDatetimeLocalPktString(value: unknown): string {
  const millis = parseDateToMillis(value);
  if (millis === null) {
    const nowPkt = new Date(Date.now() + PKT_OFFSET_MS);
    return nowPkt.toISOString().slice(0, 16);
  }

  // To extract PKT year, month, date, hours, minutes:
  // Using Intl formatToParts or epoch shift to UTC
  const pktDate = new Date(millis + PKT_OFFSET_MS);
  return pktDate.toISOString().slice(0, 16);
}

/**
 * Converts a datetime-local string (YYYY-MM-DDTHH:mm) into an explicit PKT ISO-8601 string (+05:00).
 */
export function fromDatetimeLocalToPktIso(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  const trimmed = datetimeLocal.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00+05:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}+05:00`;
  }
  return trimmed;
}

/**
 * Calculates end time ISO string (+05:00) given start time and duration in minutes.
 */
export function calculateEndAtPkt(startAt: unknown, durationMinutes: number): string {
  const startMillis = parseDateToMillis(startAt);
  if (startMillis === null || !durationMinutes || durationMinutes <= 0) {
    return '';
  }
  const endMillis = startMillis + durationMinutes * 60 * 1000;
  const pktDate = new Date(endMillis + PKT_OFFSET_MS);
  return `${pktDate.toISOString().slice(0, 19)}+05:00`;
}

/**
 * Evaluates the effective exam status based on:
 * 1. Base status (draft / archived remain as is).
 * 2. Time-window rule against current time (injectable nowMs for testing):
 *    - now < startAt: 'scheduled' (Upcoming)
 *    - now >= startAt && now < endAt: 'active' (Active / Open for submission)
 *    - now >= endAt: 'completed' (Closed / Expired)
 */
export function getEffectiveExamStatus(
  exam: Pick<Exam, 'status' | 'startAt' | 'endAt'>,
  nowMs: number = Date.now()
): ExamStatus {
  // Draft and archived are manual states that take precedence
  if (exam.status === 'draft') return 'draft';
  if (exam.status === 'archived') return 'archived';

  const startMillis = parseDateToMillis(exam.startAt);
  const endMillis = parseDateToMillis(exam.endAt);

  // If no valid time boundaries, return the saved status
  if (startMillis === null || endMillis === null) {
    return exam.status;
  }

  if (nowMs < startMillis) {
    return 'scheduled'; // Upcoming
  }

  if (nowMs >= startMillis && nowMs < endMillis) {
    return 'active'; // Currently Active
  }

  return 'completed'; // Closed / Expired
}

/**
 * Checks if an exam is currently within its active time window for candidate testing.
 */
export function isExamCurrentlyActive(
  exam: Pick<Exam, 'status' | 'startAt' | 'endAt'>,
  nowMs: number = Date.now()
): boolean {
  return getEffectiveExamStatus(exam, nowMs) === 'active';
}

/**
 * Validates a schedule form.
 * Returns null if valid, or an error string describing the issue.
 */
export function validateSchedule(
  startAt: unknown,
  endAt: unknown,
  durationMinutes: number
): string | null {
  const startMillis = parseDateToMillis(startAt);
  const endMillis = parseDateToMillis(endAt);

  if (startMillis === null) {
    return 'Scheduled Start Date & Time is required.';
  }

  if (!durationMinutes || durationMinutes <= 0) {
    return 'Examination duration must be at least 1 minute.';
  }

  if (endMillis === null) {
    return 'Scheduled End Date & Time is required.';
  }

  if (endMillis <= startMillis) {
    return 'Scheduled End Time must be strictly after the Scheduled Start Time.';
  }

  const durationMs = durationMinutes * 60 * 1000;
  if (endMillis - startMillis < durationMs) {
    return `Scheduled window (${Math.round((endMillis - startMillis) / 60000)} mins) cannot be shorter than the exam duration (${durationMinutes} mins).`;
  }

  return null;
}
