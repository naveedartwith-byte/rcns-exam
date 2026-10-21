import {
  collection,
  getDocs,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { auth } from '../firebase/auth';

export const TARGET_PROJECT_ID = 'royal-college-exam-system';
export const SUPER_ADMIN_EMAIL = 'naveedartwith@gmail.com';
export const BACKUP_ADMIN_EMAIL = 'admin@royalcollege.edu.pk';

export const CLEANABLE_COLLECTIONS = [
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

export interface CleanupSurveyResult {
  projectId: string;
  surveyedAt: string;
  adminUid: string;
  adminEmail: string;
  isSuperAdmin: boolean;
  totalDocumentsToClean: number;
  collectionBreakdown: Record<
    string,
    {
      total: number;
      toDelete: number;
      toPreserve: number;
      docs: Array<{ id: string; data: Record<string, any> }>;
    }
  >;
  preservedRecords: {
    adminProfile: Record<string, any> | null;
    adminUserDoc: Record<string, any> | null;
    settingsDocsCount: number;
  };
}

export const cleanupService = {
  /**
   * Surveys all Firestore collections and produces an exact inventory of test data vs protected data.
   */
  async surveyTestData(): Promise<CleanupSurveyResult> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentication Required: You must be logged in as an Administrator to survey test data.');
    }

    const adminEmail = (currentUser.email || '').trim().toLowerCase();
    const adminUid = currentUser.uid;
    const isSuperAdmin =
      adminEmail === SUPER_ADMIN_EMAIL.toLowerCase() ||
      adminEmail === BACKUP_ADMIN_EMAIL.toLowerCase();

    const collectionBreakdown: CleanupSurveyResult['collectionBreakdown'] = {};
    let totalDocumentsToClean = 0;

    // 1. Survey cleanable collections
    for (const colName of CLEANABLE_COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, colName));
        const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        collectionBreakdown[colName] = {
          total: snap.size,
          toDelete: snap.size,
          toPreserve: 0,
          docs,
        };
        totalDocumentsToClean += snap.size;
      } catch (colErr) {
        console.warn(`Could not survey collection "${colName}":`, colErr);
        collectionBreakdown[colName] = {
          total: 0,
          toDelete: 0,
          toPreserve: 0,
          docs: [],
        };
      }
    }

    // 2. Survey users collection (differentiating admin from test accounts)
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const testUserDocs: Array<{ id: string; data: Record<string, any> }> = [];
      let preservedCount = 0;

      for (const d of usersSnap.docs) {
        const uData = d.data();
        const uEmail = (uData.email || '').trim().toLowerCase();
        const isUserProtected =
          d.id === adminUid ||
          uEmail === SUPER_ADMIN_EMAIL.toLowerCase() ||
          uEmail === BACKUP_ADMIN_EMAIL.toLowerCase() ||
          uData.role === 'admin';

        if (isUserProtected) {
          preservedCount++;
        } else {
          testUserDocs.push({ id: d.id, data: uData });
          totalDocumentsToClean++;
        }
      }

      collectionBreakdown['users'] = {
        total: usersSnap.size,
        toDelete: testUserDocs.length,
        toPreserve: preservedCount,
        docs: testUserDocs,
      };
    } catch (usersErr) {
      console.warn('Could not survey users collection:', usersErr);
    }

    // 3. Survey preserved collections
    let settingsDocsCount = 0;
    try {
      const settingsSnap = await getDocs(collection(db, 'settings'));
      settingsDocsCount = settingsSnap.size;
    } catch (err) {
      console.warn('Settings collection survey note:', err);
    }

    return {
      projectId: TARGET_PROJECT_ID,
      surveyedAt: new Date().toISOString(),
      adminUid,
      adminEmail,
      isSuperAdmin,
      totalDocumentsToClean,
      collectionBreakdown,
      preservedRecords: {
        adminProfile: { uid: adminUid, email: adminEmail },
        adminUserDoc: { uid: adminUid, email: adminEmail, role: 'admin' },
        settingsDocsCount,
      },
    };
  },

  /**
   * Generates a downloadable JSON backup file of all surveyed test records and system state.
   */
  downloadBackupFile(survey: CleanupSurveyResult): string {
    const filename = `firebase-backup-${TARGET_PROJECT_ID}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const payload = JSON.stringify(
      {
        metadata: {
          projectId: survey.projectId,
          surveyedAt: survey.surveyedAt,
          backedUpAt: new Date().toISOString(),
          adminUid: survey.adminUid,
          adminEmail: survey.adminEmail,
          totalRecords: survey.totalDocumentsToClean,
        },
        collectionBreakdown: survey.collectionBreakdown,
        preservedRecords: survey.preservedRecords,
      },
      null,
      2
    );

    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return filename;
  },

  /**
   * Executes atomic cleanup of all test records while safeguarding the Super Administrator account.
   */
  async executeCleanup(
    survey: CleanupSurveyResult,
    onProgress?: (progress: { current: number; total: number; collection: string }) => void
  ): Promise<{ success: boolean; deletedCount: number }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentication required: Admin must be signed in.');
    }

    const adminUid = currentUser.uid;
    const adminEmail = (currentUser.email || '').trim().toLowerCase();

    // Absolute Safety Check: Ensure caller is the Super Administrator
    const isSuperAdmin =
      adminEmail === SUPER_ADMIN_EMAIL.toLowerCase() ||
      adminEmail === BACKUP_ADMIN_EMAIL.toLowerCase();

    if (!isSuperAdmin) {
      throw new Error(
        `Unauthorized: Only the designated Super Administrator (${SUPER_ADMIN_EMAIL}) is permitted to trigger database cleanup.`
      );
    }

    let deletedCount = 0;
    const totalToClean = survey.totalDocumentsToClean;

    // 1. Clean test documents collection by collection
    for (const [colName, info] of Object.entries(survey.collectionBreakdown)) {
      if (info.toDelete === 0 || info.docs.length === 0) continue;

      const BATCH_LIMIT = 250;
      for (let i = 0; i < info.docs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = info.docs.slice(i, i + BATCH_LIMIT);

        for (const item of chunk) {
          // Never delete the admin document
          if (item.id === adminUid) {
            console.warn(`[SAFETY FILTER] Skipped protected admin doc: ${colName}/${item.id}`);
            continue;
          }

          const docRef = doc(db, colName, item.id);
          batch.delete(docRef);
        }

        await batch.commit();
        deletedCount += chunk.length;

        if (onProgress) {
          onProgress({
            current: deletedCount,
            total: totalToClean,
            collection: colName,
          });
        }
      }
    }

    return {
      success: true,
      deletedCount,
    };
  },
};

export default cleanupService;
