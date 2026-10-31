import { clearAdminDashboardStatsCache, clearStorageMetricsCache } from './adminService';

// In-memory cache for student profiles to drastically reduce repeated Firestore reads
let cachedAllStudents: { list: StudentProfile[]; cachedAt: number } | null = null;

export function clearStudentProfilesCache() {
  cachedAllStudents = null;
  clearAdminDashboardStatsCache();
  clearStorageMetricsCache();
}

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firestore';
import type { StudentProfile } from '../types/student';
import { normalizeKmuRegistration, generateKmuLookupCandidates } from '../utils/kmuRegistration';

export const studentService = {
  /**
   * Retrieves a student's profile by UID.
   */
  async getStudentProfile(uid: string): Promise<StudentProfile | null> {
    const docRef = doc(db, 'students', uid);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data() as StudentProfile;
  },

  /**
   * Checks if a KMU registration number is already registered.
   */
  async isKmuNumberAvailable(kmuRegistrationNo: string): Promise<boolean> {
    const normalized = normalizeKmuRegistration(kmuRegistrationNo);
    const docRef = doc(db, 'kmuRegistrations', normalized);
    const snapshot = await getDoc(docRef);
    return !snapshot.exists();
  },

  /**
   * Updates student profile fields (excluding immutable keys like uid/role).
   */
  async updateStudentProfile(
    uid: string,
    data: Partial<Omit<StudentProfile, 'uid' | 'role' | 'createdAt'>>
  ): Promise<void> {
    const studentRef = doc(db, 'students', uid);
    await updateDoc(studentRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    clearStudentProfilesCache();
  },

  /**
   * Authoritative admin update for student record across all relational collections:
   * 1. students/{uid} (name, fatherName, kmuRegistrationNo, program, department, batch, semester, phone, address)
   * 2. users/{uid} (name, updatedAt)
   * 3. kmuRegistrations (if kmuRegistrationNo changed: delete old doc and create new doc)
   * 4. Cascade updates studentName and kmuRegistrationNo in assignments & results
   */
  async updateStudentByAdmin(
    uid: string,
    previousStudent: StudentProfile,
    updatedData: {
      name: string;
      fatherName?: string;
      email?: string;
      kmuRegistrationNo: string;
      program?: string;
      department?: string;
      batch?: string;
      semester?: string;
      phone?: string;
      address?: string;
    }
  ): Promise<void> {
    const studentRef = doc(db, 'students', uid);
    const userRef = doc(db, 'users', uid);

    // 1. Resolve student email reliably from data, previous profile, or Firestore
    let studentEmail = (updatedData.email || previousStudent.email || '').trim();
    if (!studentEmail) {
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data()?.email) {
          studentEmail = userSnap.data().email.trim();
        }
      } catch (err) {
        console.warn('User email recovery warning:', err);
      }
    }
    if (!studentEmail) {
      try {
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists() && studentSnap.data()?.email) {
          studentEmail = studentSnap.data().email.trim();
        }
      } catch (err) {
        console.warn('Student email recovery warning:', err);
      }
    }

    const oldKmu = previousStudent.kmuRegistrationNo?.trim() || '';
    const newKmu = updatedData.kmuRegistrationNo?.trim() || '';
    const oldNorm = oldKmu ? normalizeKmuRegistration(oldKmu) : '';
    const newNorm = newKmu ? normalizeKmuRegistration(newKmu) : '';
    const isKmuChanged = Boolean(newNorm && oldNorm !== newNorm);
    const isNameChanged = updatedData.name.trim() !== (previousStudent.name || '').trim();

    // 2. If KMU changed, check availability of new KMU number
    if (newNorm && isKmuChanged) {
      const checkSnap = await getDoc(doc(db, 'kmuRegistrations', newNorm));
      if (checkSnap.exists()) {
        const ownerUid = checkSnap.data()?.uid;
        if (ownerUid && ownerUid !== uid) {
          throw new Error(`KMU Registration Number "${newKmu}" is already assigned to another candidate.`);
        }
      }
    }

    // 3. Prepare batch write with safe merge so missing documents never cause rejection
    const batch = writeBatch(db);

    batch.set(
      studentRef,
      {
        name: updatedData.name.trim(),
        fatherName: (updatedData.fatherName || '').trim(),
        kmuRegistrationNo: newKmu,
        ...(studentEmail ? { email: studentEmail } : {}),
        ...(updatedData.program ? { program: updatedData.program } : {}),
        ...(updatedData.department ? { department: updatedData.department } : {}),
        ...(updatedData.batch ? { batch: updatedData.batch } : {}),
        ...(updatedData.semester ? { semester: updatedData.semester } : {}),
        phone: (updatedData.phone || '').trim(),
        address: (updatedData.address || '').trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      userRef,
      {
        uid,
        role: 'student',
        name: updatedData.name.trim(),
        kmuRegistrationNo: newKmu,
        ...(studentEmail ? { email: studentEmail } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 4. Update kmuRegistrations collection with all lookup candidates
    if (oldKmu && isKmuChanged) {
      const oldKeys = generateKmuLookupCandidates(oldKmu);
      oldKeys.forEach((key) => {
        batch.delete(doc(db, 'kmuRegistrations', key));
      });
    }

    if (newKmu) {
      const newKeys = generateKmuLookupCandidates(newKmu);
      newKeys.forEach((key) => {
        batch.set(
          doc(db, 'kmuRegistrations', key),
          {
            uid,
            email: studentEmail,
            kmuRegistrationNo: newKmu,
            normalizedRegistrationNo: newNorm,
            registeredAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });
    }

    await batch.commit();

    // 4. Cascade updates to candidate's existing assignments and results if name or KMU changed
    if (isNameChanged || isKmuChanged) {
      try {
        const [assignSnap, resultsSnap] = await Promise.all([
          getDocs(query(collection(db, 'assignments'), where('studentId', '==', uid))),
          getDocs(query(collection(db, 'results'), where('studentId', '==', uid))),
        ]);

        const cascadeDocs = [
          ...assignSnap.docs.map((d) => d.ref),
          ...resultsSnap.docs.map((d) => d.ref),
        ];

        const BATCH_LIMIT = 250;
        for (let i = 0; i < cascadeDocs.length; i += BATCH_LIMIT) {
          const cascadeBatch = writeBatch(db);
          const chunk = cascadeDocs.slice(i, i + BATCH_LIMIT);
          chunk.forEach((ref) => {
            cascadeBatch.update(ref, {
              ...(isNameChanged ? { studentName: updatedData.name.trim() } : {}),
              ...(isKmuChanged ? { kmuRegistrationNo: newKmu } : {}),
              updatedAt: serverTimestamp(),
            });
          });
          await cascadeBatch.commit();
        }
      } catch (cascadeErr) {
        console.warn('Non-critical cascade update warning:', cascadeErr);
      }
    }

    clearStudentProfilesCache();
  },

  /**
   * Retrieves all student profiles in the institution.
   */
  async getAllStudents(forceRefresh: boolean = false): Promise<StudentProfile[]> {
    if (!forceRefresh && cachedAllStudents && Date.now() - cachedAllStudents.cachedAt < 5 * 60 * 1000) {
      return cachedAllStudents.list;
    }
    const studentsCol = collection(db, 'students');
    const snapshot = await getDocs(studentsCol);
    const list = snapshot.docs.map((docSnap) => docSnap.data() as StudentProfile);
    cachedAllStudents = { list, cachedAt: Date.now() };
    return list;
  },

  /**
   * Retrieves students belonging to a specific program and semester.
   */
  async getStudentsByProgramAndSemester(program: string, semester: string): Promise<StudentProfile[]> {
    const studentsCol = collection(db, 'students');
    const q = query(
      studentsCol,
      where('program', '==', program),
      where('semester', '==', semester)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as StudentProfile);
  },

  /**
   * Permanently deletes a student record across all institutional collections:
   * 1. students/{uid}
   * 2. users/{uid}
   * 3. kmuRegistrations/{normalizedKmu}
   * 4. Cascade deletes candidate assignments (assignments where studentId == uid)
   * 5. Cascade deletes candidate results (results where studentId == uid)
   */
  async deleteStudentPermanently(student: StudentProfile): Promise<void> {
    if (!student || !student.uid) {
      throw new Error('Valid student profile is required for permanent deletion.');
    }

    const { uid, kmuRegistrationNo } = student;

    // 1. References for direct profile and identity documents
    const studentRef = doc(db, 'students', uid);
    const userRef = doc(db, 'users', uid);

    // 2. Reference for KMU registry claim
    let kmuRef = null;
    if (kmuRegistrationNo) {
      const normalizedKmu = normalizeKmuRegistration(kmuRegistrationNo);
      if (normalizedKmu) {
        kmuRef = doc(db, 'kmuRegistrations', normalizedKmu);
      }
    }

    // 3. Query candidate assignments and results
    const [assignSnap, resultsSnap] = await Promise.all([
      getDocs(query(collection(db, 'assignments'), where('studentId', '==', uid))),
      getDocs(query(collection(db, 'results'), where('studentId', '==', uid))),
    ]);

    const allDocRefs = [
      studentRef,
      userRef,
      ...(kmuRef ? [kmuRef] : []),
      ...assignSnap.docs.map((d) => d.ref),
      ...resultsSnap.docs.map((d) => d.ref),
    ];

    // Delete in atomic chunks of 250
    const BATCH_LIMIT = 250;
    for (let i = 0; i < allDocRefs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      const chunk = allDocRefs.slice(i, i + BATCH_LIMIT);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    clearStudentProfilesCache();
  },
};

export default studentService;
