import fs from 'node:fs';
import path from 'node:path';

export const TARGET_PROJECT_ID = 'royal-college-exam-system';
export const SUPER_ADMIN_EMAIL = 'naveedartwith@gmail.com';
export const BACKUP_ADMIN_EMAIL = 'admin@royalcollege.edu.pk';

export const COLLECTIONS_TO_CLEAN = [
  'students',
  'teachers',
  'exams',
  'questions',
  'writtenQuestions',
  'assignments',
  'results',
  'kmuRegistrations',
  'examSecrets',
  'examCodeHashes',
  'examCodeRateLimits',
] as const;

export const PRESERVED_COLLECTIONS = [
  'settings',
  'admins',
] as const;

export function ensureBackupsDir(backupsDir: string): void {
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
}

export function validateProjectId(projectId: string): boolean {
  if (projectId !== TARGET_PROJECT_ID) {
    throw new Error(
      `[SECURITY HALT] Active project "${projectId}" does not match target institutional project "${TARGET_PROJECT_ID}". Cleanup aborted.`
    );
  }
  return true;
}

export function isProtectedAdmin(uid?: string, email?: string, protectedAdminUids: Set<string> = new Set()): boolean {
  if (!uid && !email) return false;
  if (uid && protectedAdminUids.has(uid)) return true;
  const normalizedEmail = (email || '').trim().toLowerCase();
  return (
    normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase() ||
    normalizedEmail === BACKUP_ADMIN_EMAIL.toLowerCase()
  );
}

export function saveBackupPayload(data: {
  superAdminUid?: string;
  totalRecords?: number;
  authUsers?: any[];
  firestoreCollections?: Record<string, any>;
}, customBackupsDir?: string): {
  filePath: string;
  fileName: string;
  bytes: number;
  totalRecords: number;
} {
  const backupsDir = customBackupsDir || path.resolve(process.cwd(), 'backups');
  ensureBackupsDir(backupsDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `firebase-backup-${TARGET_PROJECT_ID}-${timestamp}.json`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  const payload = {
    metadata: {
      projectId: TARGET_PROJECT_ID,
      createdAt: new Date().toISOString(),
      generator: 'RCNS Firebase Cleanup & Recovery Tool v1.0',
      protectedAdminEmails: [SUPER_ADMIN_EMAIL, BACKUP_ADMIN_EMAIL],
      superAdminUid: data.superAdminUid || 'PENDING_DETECTION',
      totalRecordsBackedUp: data.totalRecords || 0,
    },
    authUsers: data.authUsers || [],
    firestoreCollections: data.firestoreCollections || {},
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  fs.writeFileSync(backupFilePath, jsonStr, 'utf-8');

  // Verify backup integrity immediately
  const verifiedContent = fs.readFileSync(backupFilePath, 'utf-8');
  const parsed = JSON.parse(verifiedContent);
  if (!parsed.metadata || !parsed.firestoreCollections) {
    throw new Error(`Backup file validation failed for ${backupFilePath}`);
  }

  return {
    filePath: backupFilePath,
    fileName: backupFileName,
    bytes: Buffer.byteLength(verifiedContent),
    totalRecords: payload.metadata.totalRecordsBackedUp,
  };
}
