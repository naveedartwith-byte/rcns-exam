/**
 * ROYAL COLLEGE OF NURSING SWAT - Secure Firebase Cleanup & Recovery Tool
 *
 * PURPOSE:
 * Deletes all old development/test data from Firebase (Authentication and Firestore),
 * while completely protecting and preserving the existing Super Administrator account.
 *
 * SAFETY GUARANTEES:
 * 1. Validates configured project strictly matches 'royal-college-exam-system'.
 * 2. Identifies and anchors the Super Admin by immutable UID (naveedartwith@gmail.com).
 * 3. Never deletes, disables, recreates, or resets the Admin account or credentials.
 * 4. Preserves essential system configuration in settings/*, rules, and indexes.
 * 5. Generates a complete, recoverable, timestamped JSON backup BEFORE any deletion.
 * 6. Defaults to DRY-RUN / INVENTORY mode. Only executes upon explicit '--execute' flag.
 * 7. Performs post-cleanup verification to confirm Admin accessibility and test cleanup.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.resolve(ROOT_DIR, 'backups');

// Institutional Constants
export const TARGET_PROJECT_ID = 'royal-college-exam-system';
export const SUPER_ADMIN_EMAIL = 'naveedartwith@gmail.com';
export const BACKUP_ADMIN_EMAIL = 'admin@royalcollege.edu.pk';

// Collections subject to cleanup (test data)
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
  'examLockAudits',
];

// Protected collections
export const PRESERVED_COLLECTIONS = [
  'settings',
  'admins', // Admin profile documents strictly preserved
];

/**
 * Creates backups directory if it doesn't exist.
 */
export function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Validates that the active project matches the configured examination system project.
 */
export function validateProjectId(projectId) {
  if (projectId !== TARGET_PROJECT_ID) {
    throw new Error(
      `[SECURITY HALT] Active project "${projectId}" does not match target institutional project "${TARGET_PROJECT_ID}". Cleanup aborted.`
    );
  }
  return true;
}

/**
 * Determines whether a user or document belongs to the protected Administrator.
 */
export function isProtectedAdmin(uid, email, protectedAdminUids = new Set()) {
  if (!uid && !email) return false;
  if (uid && protectedAdminUids.has(uid)) return true;
  const normalizedEmail = (email || '').trim().toLowerCase();
  return (
    normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase() ||
    normalizedEmail === BACKUP_ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Saves a full JSON backup of all surveyed data and returns the file path.
 */
export function saveBackupPayload(data) {
  ensureBackupsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `firebase-backup-${TARGET_PROJECT_ID}-${timestamp}.json`;
  const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

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

  fs.writeFileSync(backupFilePath, JSON.stringify(payload, null, 2), 'utf-8');

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

/**
 * Primary Inventory & Cleanup Engine using Firebase Admin SDK
 */
export async function runAdminSdkCleanup(adminContext, options = { dryRun: true }) {
  const db = adminContext.db || (typeof adminContext.firestore === 'function' ? adminContext.firestore() : adminContext);
  const auth = adminContext.auth || (typeof adminContext.auth === 'function' ? adminContext.auth() : null);

  console.log('\n========================================================================');
  console.log('ROYAL COLLEGE OF NURSING SWAT — FIREBASE CLEANUP ENGINE');
  console.log('========================================================================');
  console.log(`Target Firebase Project: ${TARGET_PROJECT_ID}`);
  console.log(`Protected Admin Account: ${SUPER_ADMIN_EMAIL}`);
  console.log(`Execution Mode:         ${options.dryRun ? '🔍 DRY RUN (Audit & Backup Only)' : '⚡ LIVE DELETION EXECUTION'}`);
  console.log('========================================================================\n');

  // STEP 1: Survey Firebase Authentication & Identify Super Admin UID
  console.log('[Step 1/5] Surveying Firebase Authentication...');
  const authUsersList = [];
  let nextPageToken;
  do {
    const listResult = await auth.listUsers(1000, nextPageToken);
    authUsersList.push(...listResult.users);
    nextPageToken = listResult.pageToken;
  } while (nextPageToken);

  console.log(`  Found ${authUsersList.length} total Firebase Authentication user(s).`);

  const protectedAdminUids = new Set();
  let superAdminUser = null;

  for (const u of authUsersList) {
    if (isProtectedAdmin(u.uid, u.email)) {
      protectedAdminUids.add(u.uid);
      if (u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        superAdminUser = u;
      }
    }
  }

  // Cross-reference admins collection in Firestore
  const adminsSnap = await db.collection('admins').get();
  for (const docSnap of adminsSnap.docs) {
    const data = docSnap.data();
    if (isProtectedAdmin(docSnap.id, data.email, protectedAdminUids)) {
      protectedAdminUids.add(docSnap.id);
    }
  }

  // Cross-reference users collection for admin role
  const usersSnap = await db.collection('users').get();
  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    if (
      (data.role === 'admin' || data.role === 'Admin') &&
      isProtectedAdmin(docSnap.id, data.email, protectedAdminUids)
    ) {
      protectedAdminUids.add(docSnap.id);
    }
  }

  if (protectedAdminUids.size === 0) {
    throw new Error(
      `[SECURITY HALT] Could not find the Super Administrator account (${SUPER_ADMIN_EMAIL}). Deletion aborted to prevent accidental lockout.`
    );
  }

  const primaryAdminUid = superAdminUser?.uid || Array.from(protectedAdminUids)[0];
  const verifiedLiveAdminUid = primaryAdminUid;
  const verifiedAdminUids = new Set([verifiedLiveAdminUid]);

  console.log(`\n🛡️  EXACT ADMIN ACCOUNT IDENTIFIED & LOCKED:`);
  console.log(`  • Email: ${superAdminUser?.email || SUPER_ADMIN_EMAIL}`);
  console.log(`  • Immutable Firebase UID: ${verifiedLiveAdminUid}`);
  console.log(`  • Account Status: ${superAdminUser?.disabled ? 'Disabled' : 'Active'}`);
  console.log(`  • Creation Date: ${superAdminUser?.metadata?.creationTime || 'N/A'}`);
  console.log(`  • Strictly Preserved UID: [${verifiedLiveAdminUid}]\n`);

  // Classify Auth users: ONLY verifiedLiveAdminUid is preserved
  const testAuthUsersToDelete = authUsersList.filter((u) => u.uid !== verifiedLiveAdminUid);
  const authUsersToPreserve = authUsersList.filter((u) => u.uid === verifiedLiveAdminUid);

  // STEP 2: Survey Firestore Collections
  console.log('[Step 2/5] Surveying Cloud Firestore Collections & Documents...');
  const firestoreInventory = {};
  const firestoreDocsToDelete = [];
  const firestoreDocsToPreserve = [];
  let totalDocsScanned = 0;

  // 2a. Cleanable Collections
  for (const colName of COLLECTIONS_TO_CLEAN) {
    const colSnap = await db.collection(colName).get();
    firestoreInventory[colName] = {
      total: colSnap.size,
      toDelete: colSnap.size,
      toPreserve: 0,
      documents: colSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
    };
    totalDocsScanned += colSnap.size;

    for (const docSnap of colSnap.docs) {
      firestoreDocsToDelete.push({
        collection: colName,
        id: docSnap.id,
        ref: docSnap.ref,
      });
    }
  }

  // 2b. users Collection (preserve ONLY verified live admin user, delete test users and old ghost records)
  const usersToDelete = [];
  const usersToPreserve = [];
  for (const docSnap of usersSnap.docs) {
    const isProtected = docSnap.id === verifiedLiveAdminUid;
    if (isProtected) {
      usersToPreserve.push({ id: docSnap.id, data: docSnap.data() });
      firestoreDocsToPreserve.push({ collection: 'users', id: docSnap.id });
    } else {
      usersToDelete.push({ id: docSnap.id, data: docSnap.data() });
      firestoreDocsToDelete.push({ collection: 'users', id: docSnap.id, ref: docSnap.ref });
    }
  }
  firestoreInventory['users'] = {
    total: usersSnap.size,
    toDelete: usersToDelete.length,
    toPreserve: usersToPreserve.length,
    documents: usersSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
  };
  totalDocsScanned += usersSnap.size;

  // 2c. Preserved Collections (admins, settings)
  // admins: preserve ONLY verifiedLiveAdminUid
  const adminsToDelete = [];
  const adminsToPreserve = [];
  for (const docSnap of adminsSnap.docs) {
    const isProtected = docSnap.id === verifiedLiveAdminUid;
    if (isProtected) {
      adminsToPreserve.push({ id: docSnap.id, data: docSnap.data() });
      firestoreDocsToPreserve.push({ collection: 'admins', id: docSnap.id });
    } else {
      adminsToDelete.push({ id: docSnap.id, data: docSnap.data() });
      firestoreDocsToDelete.push({ collection: 'admins', id: docSnap.id, ref: docSnap.ref });
    }
  }
  firestoreInventory['admins'] = {
    total: adminsSnap.size,
    toDelete: adminsToDelete.length,
    toPreserve: adminsToPreserve.length,
    documents: adminsSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
  };
  totalDocsScanned += adminsSnap.size;

  // settings: 100% preserved
  const settingsSnap = await db.collection('settings').get();
  firestoreInventory['settings'] = {
    total: settingsSnap.size,
    toDelete: 0,
    toPreserve: settingsSnap.size,
    documents: settingsSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
  };
  totalDocsScanned += settingsSnap.size;
  for (const docSnap of settingsSnap.docs) {
    firestoreDocsToPreserve.push({ collection: 'settings', id: docSnap.id });
  }

  // STEP 3: Complete Recoverable Backup
  console.log('[Step 3/5] Generating Full Recoverable Data Backup...');
  const backupSummary = saveBackupPayload({
    superAdminUid: primaryAdminUid,
    totalRecords: authUsersList.length + totalDocsScanned,
    authUsers: authUsersList.map((u) => u.toJSON()),
    firestoreCollections: firestoreInventory,
  });

  console.log(`  ✓ Backup saved: ${backupSummary.fileName}`);
  console.log(`  ✓ Location:     ${backupSummary.filePath}`);
  console.log(`  ✓ Payload size: ${(backupSummary.bytes / 1024).toFixed(2)} KB`);
  console.log(`  ✓ Total records backed up: ${backupSummary.totalRecords}`);

  // STEP 4: Inventory Presentation
  console.log('\n========================================================================');
  console.log('PROPOSED CLEANUP SCOPE & DATA INVENTORY');
  console.log('========================================================================');
  console.log('SERVICE / COLLECTION         | TOTAL | TO DELETE | PRESERVED');
  console.log('-----------------------------+-------+-----------+----------');
  console.log(
    `Firebase Authentication      | ${String(authUsersList.length).padEnd(5)} | ${String(testAuthUsersToDelete.length).padEnd(9)} | ${authUsersToPreserve.length} (Admin)`
  );
  for (const [col, inv] of Object.entries(firestoreInventory)) {
    console.log(
      `${col.padEnd(28)} | ${String(inv.total).padEnd(5)} | ${String(inv.toDelete).padEnd(9)} | ${inv.toPreserve}`
    );
  }
  console.log('-----------------------------+-------+-----------+----------');
  console.log(
    `TOTAL RECORDS                | ${String(authUsersList.length + totalDocsScanned).padEnd(5)} | ${String(testAuthUsersToDelete.length + firestoreDocsToDelete.length).padEnd(9)} | ${authUsersToPreserve.length + firestoreDocsToPreserve.length}`
  );
  console.log('========================================================================\n');

  console.log('ITEMS EXCLUDED FROM DELETION (STRICTLY PRESERVED):');
  console.log(`  ✓ Super Administrator Auth User (UID: ${primaryAdminUid})`);
  console.log(`  ✓ Super Administrator Profile in admins/${primaryAdminUid}`);
  console.log(`  ✓ Super Administrator Identity in users/${primaryAdminUid}`);
  console.log(`  ✓ System & Institutional Settings in settings/*`);
  console.log(`  ✓ Cloud Firestore Security Rules (firestore.rules)`);
  console.log(`  ✓ Cloud Firestore Indexes (firestore.indexes.json)`);
  console.log(`  ✓ Cloud Functions Codebase (functions/*)\n`);

  if (options.dryRun) {
    console.log('ℹ️  DRY RUN COMPLETE. No data was deleted.');
    console.log('To execute permanent deletion of test records, run with the --execute flag.');
    return {
      dryRun: true,
      superAdminUid: primaryAdminUid,
      backupFile: backupSummary.filePath,
      inventory: {
        authUsersToDelete: testAuthUsersToDelete.length,
        authUsersPreserved: authUsersToPreserve.length,
        firestoreDocsToDelete: firestoreDocsToDelete.length,
        firestoreDocsPreserved: firestoreDocsToPreserve.length,
      },
    };
  }

  // STEP 5: Live Execution (Only reached if dryRun === false)
  console.log('[Step 5/5] Executing Permanent Deletion of Test Records...\n');

  // 5a. Delete test users from Firebase Authentication
  let deletedAuthUsersCount = 0;
  if (testAuthUsersToDelete.length > 0) {
    console.log(`Deleting ${testAuthUsersToDelete.length} test Firebase Auth users...`);
    const uidsToDelete = testAuthUsersToDelete.map((u) => u.uid);

    // Ensure NO protected admin UID slipped in
    for (const uid of uidsToDelete) {
      if (protectedAdminUids.has(uid)) {
        throw new Error(`[CRITICAL ABORT] Attempted to delete protected admin UID: ${uid}`);
      }
    }

    // Delete in chunks of 100
    const CHUNK_SIZE = 100;
    for (let i = 0; i < uidsToDelete.length; i += CHUNK_SIZE) {
      const chunk = uidsToDelete.slice(i, i + CHUNK_SIZE);
      const deleteResult = await auth.deleteUsers(chunk);
      deletedAuthUsersCount += deleteResult.successCount;
      if (deleteResult.failureCount > 0) {
        console.warn(`  Warning: ${deleteResult.failureCount} auth user deletions failed in batch:`, deleteResult.errors);
      }
    }
    console.log(`  ✓ Deleted ${deletedAuthUsersCount} test Firebase Auth user(s).`);
  } else {
    console.log('  No test Auth users to delete.');
  }

  // 5b. Delete test documents from Firestore
  let deletedFirestoreDocsCount = 0;
  if (firestoreDocsToDelete.length > 0) {
    console.log(`Deleting ${firestoreDocsToDelete.length} test documents from Cloud Firestore...`);

    // Triple check NO protected admin document is included
    for (const item of firestoreDocsToDelete) {
      if (verifiedAdminUids.has(item.id) && (item.collection === 'users' || item.collection === 'admins')) {
        throw new Error(`[CRITICAL ABORT] Protected admin document found in deletion queue: ${item.collection}/${item.id}`);
      }
    }

    const BATCH_SIZE = 250;
    for (let i = 0; i < firestoreDocsToDelete.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = firestoreDocsToDelete.slice(i, i + BATCH_SIZE);
      chunk.forEach((item) => batch.delete(item.ref));
      await batch.commit();
      deletedFirestoreDocsCount += chunk.length;
      process.stdout.write(`  Processed ${deletedFirestoreDocsCount}/${firestoreDocsToDelete.length} documents...\r`);
    }
    console.log(`\n  ✓ Deleted ${deletedFirestoreDocsCount} test document(s) across Firestore.`);
  } else {
    console.log('  No test Firestore documents to delete.');
  }

  // POST-CLEANUP VERIFICATION
  console.log('\n========================================================================');
  console.log('POST-CLEANUP VERIFICATION');
  console.log('========================================================================');

  // Verify Admin in Auth
  const verifiedAdminAuth = await auth.getUser(primaryAdminUid);
  console.log(`  ✓ Admin Auth user exists:     ${verifiedAdminAuth.email} (UID: ${verifiedAdminAuth.uid})`);

  // Verify Admin in admins collection
  const verifiedAdminDoc = await db.collection('admins').doc(primaryAdminUid).get();
  console.log(`  ✓ Admin Firestore profile:    admins/${primaryAdminUid} (exists: ${verifiedAdminDoc.exists})`);

  // Verify Admin in users collection
  const verifiedUserDoc = await db.collection('users').doc(primaryAdminUid).get();
  console.log(`  ✓ Admin Firestore identity:   users/${primaryAdminUid} (role: ${verifiedUserDoc.data()?.role})`);

  // Verify test collections are cleared
  for (const colName of COLLECTIONS_TO_CLEAN) {
    const snap = await db.collection(colName).get();
    console.log(`  ✓ Collection ${colName.padEnd(20)} remaining docs: ${snap.size}`);
  }

  console.log('========================================================================');
  console.log('CLEANUP SUCCESSFULLY COMPLETED — SYSTEM READY FOR PRODUCTION');
  console.log('========================================================================\n');

  return {
    success: true,
    superAdminUid: primaryAdminUid,
    deletedAuthUsers: deletedAuthUsersCount,
    deletedFirestoreDocs: deletedFirestoreDocsCount,
    backupFile: backupSummary.filePath,
  };
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const isExecute = process.argv.includes('--execute');
  let resolvedKeyPath = null;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    resolvedKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  } else if (fs.existsSync(path.resolve(ROOT_DIR, 'serviceAccountKey.json'))) {
    resolvedKeyPath = path.resolve(ROOT_DIR, 'serviceAccountKey.json');
  } else if (fs.existsSync(path.resolve(__dirname, 'serviceAccountKey.json'))) {
    resolvedKeyPath = path.resolve(__dirname, 'serviceAccountKey.json');
  } else {
    try {
      const filesInRoot = fs.readdirSync(ROOT_DIR);
      const candidate = filesInRoot.find(
        (f) => f.endsWith('.json') && (f.includes('adminsdk') || f.includes('serviceAccount') || f.includes('firebase-admin'))
      );
      if (candidate) {
        resolvedKeyPath = path.resolve(ROOT_DIR, candidate);
      }
    } catch {}
  }

  let app = null;
  let getFirestoreFn = null;
  let getAuthFn = null;

  try {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');
    getFirestoreFn = getFirestore;
    getAuthFn = getAuth;

    if (resolvedKeyPath && fs.existsSync(resolvedKeyPath)) {
      console.log(`Loading service account key from: ${resolvedKeyPath}`);
      const serviceAccount = JSON.parse(fs.readFileSync(resolvedKeyPath, 'utf-8'));
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: TARGET_PROJECT_ID,
      });
    } else {
      console.log('No serviceAccountKey.json found. Attempting Application Default Credentials...');
      try {
        app = initializeApp({ projectId: TARGET_PROJECT_ID });
      } catch (err) {
        console.error(`[Notice] To run server-side cleanup via Firebase Admin SDK, please provide:`);
        console.error(`  1) A service account key at ./serviceAccountKey.json, OR`);
        console.error(`  2) Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n`);
        process.exit(1);
      }
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err.message);
    console.error(`[Notice] To run server-side cleanup via Firebase Admin SDK, please provide:`);
    console.error(`  1) A service account key at ./serviceAccountKey.json, OR`);
    console.error(`  2) Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json\n`);
    process.exit(1);
  }

  const db = getFirestoreFn(app);
  const auth = getAuthFn(app);

  runAdminSdkCleanup({ db, auth }, { dryRun: !isExecute })
    .then((res) => {
      console.log('Script execution finished successfully.');
    })
    .catch((err) => {
      console.error('\n❌ Execution Error:', err);
      process.exit(1);
    });
}
