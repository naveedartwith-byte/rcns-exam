import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('royal-college-exam-system-firebase-adminsdk-fbsvc-d0043821f3.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);
const auth = getAuth(app);

const TARGET_EXAM_ID = 'beWVQBSYXl48NjrpmwTq';

async function runRepair() {
  console.log('=== Step 1: Repairing Results and Assignments for exam:', TARGET_EXAM_ID, '===');
  const resultsSnap = await db.collection('results').where('examId', '==', TARGET_EXAM_ID).get();
  console.log(`Found ${resultsSnap.size} total results for exam ${TARGET_EXAM_ID}`);

  let repairedResultsCount = 0;
  for (const docSnap of resultsSnap.docs) {
    const data = docSnap.data();
    const needsRepair = !data.studentName || data.studentName === 'Student Candidate' || !data.kmuRegistrationNo;

    if (needsRepair) {
      const studentId = data.studentId;
      const studentDoc = await db.collection('students').doc(studentId).get();
      if (studentDoc.exists) {
        const s = studentDoc.data();
        const updateData = {
          studentName: s.name || data.studentName,
          kmuRegistrationNo: s.kmuRegistrationNo || data.kmuRegistrationNo,
          fatherName: s.fatherName || data.fatherName || '',
        };

        await docSnap.ref.update(updateData);
        repairedResultsCount++;
        console.log(`[Result Repaired] doc: ${docSnap.id} -> Name: "${updateData.studentName}", KMU: "${updateData.kmuRegistrationNo}"`);

        // Also update corresponding assignment doc if needed
        const assignmentId = `${TARGET_EXAM_ID}_${studentId}`;
        const aDoc = await db.collection('assignments').doc(assignmentId).get();
        if (aDoc.exists) {
          await aDoc.ref.update(updateData);
          console.log(`[Assignment Repaired] ${assignmentId}`);
        }
      } else {
        console.warn(`[Student Profile Not Found] for studentId: ${studentId}`);
      }
    } else {
      console.log(`[Result Already Valid] doc: ${docSnap.id} -> Name: "${data.studentName}", KMU: "${data.kmuRegistrationNo}"`);
    }
  }

  console.log(`\nSuccessfully repaired ${repairedResultsCount} result document(s)!`);

  console.log('\n=== Step 2: Cleaning up orphaned KMU Registrations ===');
  const orphanedKeys = ['2023_KMU-RCNS_068', '2023_KMU-RCNS_68', '2023_KMU_RCNS_68', '2023_KMU_RCNS_068'];
  for (const key of orphanedKeys) {
    const kDoc = await db.collection('kmuRegistrations').doc(key).get();
    if (kDoc.exists) {
      await kDoc.ref.delete();
      console.log(`Deleted orphaned kmuRegistration: ${key}`);
    }
  }

  // Also query any other kmuRegistrations where uid == 'lY4WAIOQK4THpfDeObueV6ibOHP2'
  const orphanKmuSnap = await db.collection('kmuRegistrations').where('uid', '==', 'lY4WAIOQK4THpfDeObueV6ibOHP2').get();
  for (const d of orphanKmuSnap.docs) {
    await d.ref.delete();
    console.log(`Deleted orphaned doc by UID: ${d.id}`);
  }

  console.log('\n=== Step 3: Cleaning up orphaned Firebase Auth User ===');
  try {
    await auth.deleteUser('lY4WAIOQK4THpfDeObueV6ibOHP2');
    console.log('Successfully deleted orphaned Auth user: lY4WAIOQK4THpfDeObueV6ibOHP2');
  } catch (authErr) {
    if (authErr.code === 'auth/user-not-found') {
      console.log('Orphaned Auth user already deleted or not found.');
    } else {
      console.warn('Auth deletion notice:', authErr.code || authErr.message);
    }
  }

  console.log('\n=== Repair and Cleanup Finished Successfully! ===');
}

runRepair().catch(console.error);
