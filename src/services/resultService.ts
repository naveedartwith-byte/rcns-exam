import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '../firebase/firestore';
import { functions } from '../firebase/functions';
import type { Result } from '../types/result';
import type { MasterQuestion } from '../types/question';
import {
  checkAnswerMatch,
  gradeExamSubmission,
  calculateKmuGrade,
} from '../utils/secureGrading';
import { MOCK_QUESTIONS } from '../mock/mockData';

export { checkAnswerMatch };

export async function getMasterQuestionsForExam(examId: string, examData?: any): Promise<MasterQuestion[]> {
  let masterQs: MasterQuestion[] = [];
  try {
    const qCol = collection(db, 'questions');
    const qQuery = query(qCol, where('examId', '==', examId));
    const qSnap = await getDocs(qQuery);
    if (!qSnap.empty) {
      masterQs = qSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MasterQuestion));
    }
  } catch (err) {
    console.warn('[getMasterQuestionsForExam] Could not query questions collection:', err);
  }

  if (masterQs.length === 0 && Array.isArray(examData?.questions) && examData.questions.length > 0) {
    masterQs = examData.questions;
  }

  if (masterQs.length === 0 && (MOCK_QUESTIONS as any)[examId]) {
    masterQs = (MOCK_QUESTIONS as any)[examId];
  }

  return masterQs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function sortResultsNewestFirst(results: Result[]): Result[] {
  return results.sort((a, b) => {
    const parseTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (typeof val?.toMillis === 'function') return val.toMillis();
      if (typeof val?.toDate === 'function') return val.toDate().getTime();
      const d = new Date(val).getTime();
      return isNaN(d) ? 0 : d;
    };
    const timeA = parseTime(a.submittedAt || a.evaluatedAt || (a as any).createdAt);
    const timeB = parseTime(b.submittedAt || b.evaluatedAt || (b as any).createdAt);
    return timeB - timeA;
  });
}

export const resultService = {
  /**
   * Retrieves results for a specific student.
   * Also checks assignment records for any pending submitted exams without a finalized result.
   */
  async getResultsByStudentId(studentId: string): Promise<Result[]> {
    if (!studentId) return [];

    const resultsCol = collection(db, 'results');
    const q = query(resultsCol, where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    const finalizedResults = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Result));

    // Re-evaluate and repair any previously stored results that have 0 marks or 0% due to legacy key mismatches
    for (const r of finalizedResults) {
      if (Number(r.marks) === 0 || Number(r.percentage) === 0 || !r.correctCount) {
        let studentAnswers = r.answers;
        if (!studentAnswers || Object.keys(studentAnswers).length === 0) {
          const aSnap = await getDoc(doc(db, 'assignments', `${r.examId}_${studentId}`)).catch(() => null);
          if (aSnap?.exists()) {
            studentAnswers = aSnap.data()?.answers;
          }
        }
        if (studentAnswers && Object.keys(studentAnswers).length > 0) {
          const examSnap = await getDoc(doc(db, 'exams', r.examId)).catch(() => null);
          const examData = examSnap?.exists() ? examSnap.data() : null;
          const masterQs = await getMasterQuestionsForExam(r.examId, examData);
          if (masterQs.length > 0) {
            const scored = gradeExamSubmission(masterQs, studentAnswers, examData?.passingMarks);
            if (scored.obtainedMarks > 0 || scored.answersCount > 0) {
              r.marks = scored.obtainedMarks;
              r.totalMarks = scored.totalMarks || r.totalMarks;
              r.percentage = scored.percentage;
              r.passed = scored.passed;
              r.grade = scored.grade || calculateKmuGrade(scored.percentage);
              r.status = 'graded';
              r.mcqMarks = scored.obtainedMarks;
              r.mcqTotalMarks = scored.totalMarks;
              r.correctCount = scored.correctCount;
              r.correctMCQs = scored.correctCount;
              r.answeredMCQs = scored.answersCount;
              r.incorrectMCQs = Math.max(0, scored.answersCount - scored.correctCount);
              r.totalMCQs = masterQs.length;
              r.totalQuestions = masterQs.length;
              if (!r.answers) r.answers = studentAnswers;
              setDoc(doc(db, 'results', r.id), r, { merge: true }).catch(() => {});
            }
          }
        }
      }
    }

    // Also look for pending submitted assignments
    try {
      const assignmentsCol = collection(db, 'assignments');
      const qAssign = query(
        assignmentsCol,
        where('studentId', '==', studentId),
        where('status', '==', 'submitted')
      );
      const assignSnap = await getDocs(qAssign);

      const finalizedExamIds = new Set(finalizedResults.map((r) => r.examId));

      for (const assignDoc of assignSnap.docs) {
        const assignData = assignDoc.data();
        if (!finalizedExamIds.has(assignData.examId)) {
          // Attempt automatic grading with master questions lookup
          let autoGradedResult: Result | null = null;
          try {
            if (assignData.answers && Object.keys(assignData.answers).length > 0) {
              const examSnap = await getDoc(doc(db, 'exams', assignData.examId)).catch(() => null);
              const examData = examSnap?.exists() ? examSnap.data() : null;
              const masterQs = await getMasterQuestionsForExam(assignData.examId, examData);
              if (masterQs.length > 0) {
                const mcqScored = gradeExamSubmission(masterQs, assignData.answers, examData?.passingMarks);
                const rId = `${studentId}_${assignData.examId}`;
                autoGradedResult = {
                  id: rId,
                  examId: assignData.examId,
                  studentId,
                  studentName: assignData.studentName || 'Student Candidate',
                  kmuRegistrationNo: assignData.kmuRegistrationNo,
                  examTitle: assignData.examTitle || examData?.title || 'Academic Examination',
                  examType: assignData.examType || examData?.type || 'exam',
                  subject: assignData.subject || examData?.subject || 'Clinical Assessment',
                  program: assignData.program || examData?.program,
                  semester: assignData.semester || examData?.semester,
                  batch: assignData.batch || examData?.batch,
                  marks: mcqScored.obtainedMarks,
                  totalMarks: mcqScored.totalMarks || Number(assignData.totalMarks) || 100,
                  percentage: mcqScored.percentage,
                  passed: mcqScored.passed,
                  grade: mcqScored.grade,
                  status: 'graded',
                  answersCount: mcqScored.answersCount,
                  correctCount: mcqScored.correctCount,
                  mcqMarks: mcqScored.obtainedMarks,
                  mcqTotalMarks: mcqScored.totalMarks,
                  totalQuestions: masterQs.length,
                  totalMCQs: masterQs.length,
                  answeredMCQs: mcqScored.answersCount,
                  correctMCQs: mcqScored.correctCount,
                  incorrectMCQs: Math.max(0, mcqScored.answersCount - mcqScored.correctCount),
                  unansweredMCQs: Math.max(0, masterQs.length - mcqScored.answersCount),
                  answers: assignData.answers,
                  submittedAt: assignData.submittedAt || new Date().toISOString(),
                };

                // Persist directly to results collection so future queries load immediately
                setDoc(doc(db, 'results', rId), autoGradedResult, { merge: true }).catch((writeErr) => {
                  console.warn('Could not persist auto-graded result to results collection:', writeErr);
                });
              }
            }
          } catch (autoErr) {
            console.warn('Auto-grade evaluation notice:', autoErr);
          }

          if (autoGradedResult) {
            finalizedResults.push(autoGradedResult);
          } else {
            finalizedResults.push({
              id: `pending_${assignData.examId}_${studentId}`,
              examId: assignData.examId,
              studentId,
              studentName: assignData.studentName || 'Student Candidate',
              kmuRegistrationNo: assignData.kmuRegistrationNo,
              examTitle: assignData.examTitle || 'Academic Examination',
              examType: assignData.examType || 'exam',
              subject: assignData.subject || 'Clinical Assessment',
              program: assignData.program,
              semester: assignData.semester,
              batch: assignData.batch,
              marks: 0,
              totalMarks: Number(assignData.totalMarks) || 100,
              percentage: 0,
              passed: false,
              answersCount: assignData.answersCount || (assignData.answers ? Object.keys(assignData.answers).length : 0),
              submittedAt: assignData.submittedAt || new Date().toISOString(),
              status: 'pending',
            });
          }
        }
      }
    } catch (assignErr) {
      console.warn('Could not check pending assignment submissions:', assignErr);
    }

    // Sort results newest first (submittedAt / gradedAt descending) - Requirement #9
    return sortResultsNewestFirst(finalizedResults);
  },

  /**
   * Retrieves results for a specific exam, sorted newest first.
   */
  async getResultsByExamId(examId: string): Promise<Result[]> {
    if (!examId) return [];
    const resultsCol = collection(db, 'results');
    const q = query(resultsCol, where('examId', '==', examId));
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Result));
    return sortResultsNewestFirst(results);
  },

  /**
   * Retrieves all results across the institution (Admin view), sorted newest first.
   */
  async getAllResults(): Promise<Result[]> {
    const resultsCol = collection(db, 'results');
    const snapshot = await getDocs(resultsCol);
    const results = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Result));
    return sortResultsNewestFirst(results);
  },

  /**
   * Submits student exam answers.
   * If Cloud Functions are available (Blaze tier), server-side authoritative grading is used.
   * On Firebase Spark free tier (Cloud Functions unavailable), safely persists submission
   * answers and metadata to the candidate's assignment document in Firestore.
   */
  async submitExamAttempt(params: {
    examId: string;
    studentId: string;
    studentName?: string;
    kmuRegistrationNo?: string;
    examTitle?: string;
    examType?: string;
    subject?: string;
    program?: string;
    semester?: string;
    batch?: string;
    answers: Record<string, string | number>;
    writtenAnswers?: Record<string, any>;
  }): Promise<Result> {
    const resultId = `${params.studentId}_${params.examId}`;
    const resultRef = doc(db, 'results', resultId);

    // 1. Idempotency Check: Return existing result if already recorded
    try {
      const existingSnap = await getDoc(resultRef);
      if (existingSnap.exists()) {
        const data = existingSnap.data()!;
        return { id: existingSnap.id, ...data } as Result;
      }
    } catch (checkErr) {
      console.warn('Idempotency pre-check notice:', checkErr);
    }

    // Clean answers to remove any undefined or empty values so Firestore never rejects
    const cleanAnswers: Record<string, any> = {};
    if (params.answers && typeof params.answers === 'object') {
      for (const [k, v] of Object.entries(params.answers)) {
        if (v !== undefined && v !== null && String(v).trim() !== '' && v !== -1 && v !== '-1') {
          cleanAnswers[k] = v;
        }
      }
    }

    const cleanWrittenAnswers: Record<string, any> = {};
    if (params.writtenAnswers && typeof params.writtenAnswers === 'object') {
      for (const [k, v] of Object.entries(params.writtenAnswers)) {
        if (valHasText(v)) {
          cleanWrittenAnswers[k] = {
            questionId: String((v as any).questionId || k),
            type: (v as any).type || 'short',
            questionText: String((v as any).questionText || ''),
            answerText: String((v as any).answerText || '').trim(),
            wordCount: Number((v as any).wordCount) || 0,
            submittedAt: (v as any).submittedAt || new Date().toISOString(),
          };
        }
      }
    }

    function valHasText(v: any): boolean {
      if (!v || typeof v !== 'object') return false;
      return typeof v.answerText === 'string' && v.answerText.trim().length > 0;
    }

    const examDoc = await getDoc(doc(db, 'exams', params.examId)).catch(() => null);
    const examData = examDoc?.exists() ? examDoc.data() : null;

    const totalMarks = Number(examData?.totalMarks) || 100;
    const sanitizedWrittenQs = examData?.sanitizedWrittenQuestions || [];
    const hasWrittenSection = Boolean(
      (Array.isArray(sanitizedWrittenQs) && sanitizedWrittenQs.length > 0) ||
      Object.keys(cleanWrittenAnswers).length > 0
    );

    // Accurate answeredCount: Count unique question entries without double-counting index + ID keys
    let answeredCount = 0;
    if (examData?.sanitizedQuestions && Array.isArray(examData.sanitizedQuestions) && examData.sanitizedQuestions.length > 0) {
      answeredCount = examData.sanitizedQuestions.filter((q: any, idx: number) => {
        return cleanAnswers[idx] !== undefined || (q.id && cleanAnswers[q.id] !== undefined);
      }).length;
    } else {
      answeredCount = Object.keys(cleanAnswers).length;
    }

    const writtenAnswersCount = Object.keys(cleanWrittenAnswers).length;

    // 2. Safely Persist Submission to Candidate's Assignment Document FIRST
    // (Students are authorized to update their own assignment under Firestore security rules)
    const assignmentId = `${params.examId}_${params.studentId}`;
    try {
      const assignRef = doc(db, 'assignments', assignmentId);
      const assignmentPayload: Record<string, any> = {
        id: assignmentId,
        examId: params.examId,
        studentId: params.studentId,
        studentName: params.studentName || 'Student Candidate',
        kmuRegistrationNo: params.kmuRegistrationNo || '',
        examTitle: params.examTitle || examData?.title || 'Academic Examination',
        examType: (params.examType as any) || examData?.type || 'exam',
        subject: params.subject || examData?.subject || 'Clinical Assessment',
        program: params.program || examData?.program || '',
        semester: params.semester || examData?.semester || '',
        batch: params.batch || examData?.batch || '',
        status: 'submitted',
        submittedAt: serverTimestamp(),
        answers: cleanAnswers,
        answersCount: answeredCount,
        totalMarks,
      };

      if (Object.keys(cleanWrittenAnswers).length > 0) {
        assignmentPayload.writtenAnswers = cleanWrittenAnswers;
        assignmentPayload.writtenAnswersCount = writtenAnswersCount;
      }

      await setDoc(assignRef, assignmentPayload, { merge: true });
    } catch (assignErr) {
      console.warn('Assignment setDoc submission record notice, attempting fallback update:', assignErr);
      try {
        const assignRef = doc(db, 'assignments', assignmentId);
        const updatePayload: Record<string, any> = {
          status: 'submitted',
          submittedAt: serverTimestamp(),
          answers: cleanAnswers,
          answersCount: answeredCount,
        };
        if (Object.keys(cleanWrittenAnswers).length > 0) {
          updatePayload.writtenAnswers = cleanWrittenAnswers;
          updatePayload.writtenAnswersCount = writtenAnswersCount;
        }
        await updateDoc(assignRef, updatePayload);
      } catch (updateErr) {
        console.error('Assignment fallback update error:', updateErr);
        throw new Error('Failed to record examination submission. Please verify your connection and retry.');
      }
    }

    // 3. Authoritative Cloud Function Evaluation (Server-side grading against master question bank)
    try {
      const submitFn = httpsCallable<
        { examId: string; answers: Record<string, string | number>; writtenAnswers?: Record<string, any> },
        any
      >(functions, 'submitExamAttempt');

      // 30s timeout allows sufficient time for Cloud Function cold starts without early abandonment
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Cloud Function invocation timed out after 30s')), 30000)
      );

      const response = await Promise.race([
        submitFn({
          examId: params.examId,
          answers: cleanAnswers,
          writtenAnswers: cleanWrittenAnswers,
        }),
        timeoutPromise,
      ]);

      const data = response?.data;
      if (data) {
        return {
          id: data.resultId || resultId,
          examId: params.examId,
          studentId: params.studentId,
          studentName: data.studentName || params.studentName || 'Student Candidate',
          kmuRegistrationNo: data.kmuRegistrationNo || params.kmuRegistrationNo,
          examTitle: params.examTitle || examData?.title || 'Academic Examination',
          examType: (params.examType as any) || examData?.type || 'exam',
          subject: params.subject || examData?.subject || 'Clinical Assessment',
          program: params.program || examData?.program,
          semester: params.semester || examData?.semester,
          batch: params.batch || examData?.batch,
          marks: Number(data.marks) || 0,
          totalMarks: Number(data.totalMarks) || totalMarks,
          percentage: Number(data.percentage) || 0,
          passed: Boolean(data.passed),
          grade: data.grade || '',
          status: data.status || (hasWrittenSection ? 'pending' : 'graded'),
          mcqMarks: Number(data.mcqMarks) || Number(data.marks) || 0,
          mcqTotalMarks: Number(data.mcqTotalMarks) || totalMarks,
          answersCount: data.answersCount || answeredCount,
          correctCount: data.correctCount,
          totalQuestions: data.totalQuestions,
          totalMCQs: data.totalMCQs,
          answeredMCQs: data.answeredMCQs,
          correctMCQs: data.correctMCQs,
          incorrectMCQs: data.incorrectMCQs,
          unansweredMCQs: data.unansweredMCQs,
          totalObjectiveMarks: data.totalObjectiveMarks,
          obtainedObjectiveMarks: data.obtainedObjectiveMarks,
          totalWrittenQuestions: data.totalWrittenQuestions,
          writtenAnsweredCount: data.writtenAnsweredCount,
          writtenUnansweredCount: data.writtenUnansweredCount,
          requiresWrittenGrading: data.requiresWrittenGrading,
          submittedAt: data.submittedAt || new Date().toISOString(),
        };
      }
    } catch (fnErr: any) {
      console.warn(
        `[resultService] Cloud Function call notice (${fnErr?.code || fnErr?.message}). Checking if result document was already written.`
      );
      // Double check if result document was created on server
      try {
        const afterSnap = await getDoc(resultRef);
        if (afterSnap.exists()) {
          return { id: afterSnap.id, ...afterSnap.data() } as Result;
        }
      } catch (readErr) {
        console.warn('Could not read existing result document:', readErr);
      }
    }

    // 4. Safe Fallback View: Construct authoritative-compatible pending result
    // When Cloud Functions are not active or in local dev, the assignment is already saved.
    // Calculate objective MCQ marks if questions collection is accessible to authorized user
    let mcqScored: any = null;
    try {
      const masterQs = await getMasterQuestionsForExam(params.examId, examData);
      if (masterQs.length > 0) {
        mcqScored = gradeExamSubmission(masterQs, cleanAnswers, examData?.passingMarks);
      }
    } catch (fallbackErr) {
      console.warn('[resultService] Fallback grading notice:', fallbackErr);
    }

    const marks = mcqScored ? mcqScored.obtainedMarks : 0;
    const percentage = mcqScored ? mcqScored.percentage : 0;
    const passed = mcqScored ? mcqScored.passed : false;
    const correctCount = mcqScored ? mcqScored.correctCount : 0;
    const status: 'pending' | 'graded' = hasWrittenSection ? 'pending' : (mcqScored ? 'graded' : 'pending');

    const totalMCQs = mcqScored ? mcqScored.totalQuestions : (examData?.questionsCount || answeredCount);
    const correctMCQs = correctCount;
    const answeredMCQs = answeredCount;
    const incorrectMCQs = Math.max(0, answeredMCQs - correctMCQs);
    const unansweredMCQs = Math.max(0, totalMCQs - answeredMCQs);
    const totalWrittenQuestions = Array.isArray(sanitizedWrittenQs) ? sanitizedWrittenQs.length : 0;
    const writtenUnansweredCount = Math.max(0, totalWrittenQuestions - writtenAnswersCount);

    const resultData: Result = {
      id: resultId,
      examId: params.examId,
      studentId: params.studentId,
      studentName: params.studentName || 'Student Candidate',
      kmuRegistrationNo: params.kmuRegistrationNo,
      examTitle: params.examTitle || examData?.title || 'Academic Examination',
      examType: (params.examType as any) || examData?.type || 'exam',
      subject: params.subject || examData?.subject || 'Clinical Assessment',
      program: params.program || examData?.program,
      semester: params.semester || examData?.semester,
      batch: params.batch || examData?.batch,
      marks,
      totalMarks,
      percentage,
      passed,
      grade: mcqScored ? mcqScored.grade : calculateKmuGrade(percentage),
      mcqMarks: marks,
      mcqTotalMarks: mcqScored ? mcqScored.totalMarks : totalMarks,
      answersCount: answeredCount,
      correctCount,
      totalQuestions: totalMCQs + totalWrittenQuestions,
      totalMCQs,
      answeredMCQs,
      correctMCQs,
      incorrectMCQs,
      unansweredMCQs,
      totalObjectiveMarks: mcqScored ? mcqScored.totalMarks : totalMarks,
      obtainedObjectiveMarks: marks,
      totalWrittenQuestions,
      writtenAnsweredCount: writtenAnswersCount,
      writtenUnansweredCount,
      requiresWrittenGrading: hasWrittenSection,
      answers: cleanAnswers,
      writtenAnswers: cleanWrittenAnswers,
      submittedAt: new Date().toISOString() as any,
      status,
    };

    // Directly persist authoritative result record to Firestore results collection
    // so students can view their grades immediately without requiring teacher submission
    try {
      await setDoc(resultRef, resultData, { merge: true });
      console.log('[resultService] Successfully recorded result document in Firestore:', resultId);
    } catch (saveErr) {
      console.warn('[resultService] Direct result document save notice:', saveErr);
    }

    return resultData;
  },

  /**
   * Authoritative grading of a candidate's submission by Teacher or Admin.
   * Loads protected master questions with answer keys, computes grades, and writes
   * authoritative result document to /results.
   */
  async gradeSubmission(params: {
    examId: string;
    studentId: string;
    evaluatorUid?: string;
  }): Promise<Result> {
    const { examId, studentId, evaluatorUid } = params;

    // 1. Fetch Master Questions using authoritative fallback helper
    const examDoc = await getDoc(doc(db, 'exams', examId));
    const examData = examDoc.exists() ? examDoc.data() : null;
    const masterQuestions = await getMasterQuestionsForExam(examId, examData);

    if (masterQuestions.length === 0) {
      throw new Error('No master questions found for this examination.');
    }

    // 3. Fetch Student Assignment containing submitted answers
    const assignmentId = `${examId}_${studentId}`;
    const assignDoc = await getDoc(doc(db, 'assignments', assignmentId));
    if (!assignDoc.exists()) {
      throw new Error('Assignment record for this candidate was not found.');
    }
    const assignData = assignDoc.data();
    const answers = assignData.answers || {};

    // 4. Grade authoritative submission
    const passingMarks = examData?.passingMarks;
    const graded = gradeExamSubmission(masterQuestions, answers, passingMarks);

    // 5. Construct Authoritative Result Record
    const resultId = `${studentId}_${examId}`;
    const resultRef = doc(db, 'results', resultId);

    const hasWrittenSection = Boolean(
      examData?.sanitizedWrittenQuestions &&
      Array.isArray(examData.sanitizedWrittenQuestions) &&
      examData.sanitizedWrittenQuestions.length > 0
    );

    // Check existing result to preserve written evaluations if already recorded
    const existingSnap = await getDoc(resultRef).catch(() => null);
    const existingResult = existingSnap?.exists() ? existingSnap.data() : null;

    let totalMarks = graded.totalMarks;
    let marks = graded.obtainedMarks;
    let percentage = graded.percentage;
    let status: 'pending' | 'graded' = 'graded';
    let passed = graded.passed;
    let grade = calculateKmuGrade(graded.percentage);

    if (hasWrittenSection) {
      if (existingResult && existingResult.writtenMarks !== undefined) {
        // Preserve already evaluated written marks
        const writtenMarks = Number(existingResult.writtenMarks) || 0;
        const writtenTotal = Number(existingResult.writtenTotalMarks) || 0;
        marks = graded.obtainedMarks + writtenMarks;
        totalMarks = graded.totalMarks + writtenTotal;
        percentage = totalMarks > 0 ? Math.round((marks / totalMarks) * 1000) / 10 : 0;
        passed = passingMarks !== undefined && Number(passingMarks) > 0 ? marks >= Number(passingMarks) : percentage >= 50;
        grade = calculateKmuGrade(percentage);
        status = 'graded';
      } else {
        // Pending written evaluation by teacher
        status = 'pending';
        totalMarks = Number(examData?.totalMarks) || (graded.totalMarks + (Number(examData?.writtenTotalMarks) || 0));
        percentage = totalMarks > 0 ? Math.round((marks / totalMarks) * 1000) / 10 : 0;
      }
    }

    const resultRecord: Result = {
      id: resultId,
      examId,
      studentId,
      studentName: assignData.studentName || 'Student Candidate',
      kmuRegistrationNo: assignData.kmuRegistrationNo || '',
      examTitle: examData?.title || assignData.examTitle || 'Academic Examination',
      examType: (examData?.type || assignData.examType || 'exam') as any,
      subject: examData?.subject || assignData.subject || 'Clinical Assessment',
      program: examData?.program || assignData.program || '',
      semester: examData?.semester || assignData.semester || '',
      batch: examData?.batch || assignData.batch || '',
      marks,
      totalMarks,
      percentage,
      passed,
      grade,
      mcqMarks: graded.obtainedMarks,
      mcqTotalMarks: graded.totalMarks,
      totalMCQs: masterQuestions.length,
      answeredMCQs: graded.answersCount,
      correctMCQs: graded.correctCount,
      incorrectMCQs: Math.max(0, graded.answersCount - graded.correctCount),
      unansweredMCQs: Math.max(0, masterQuestions.length - graded.answersCount),
      totalObjectiveMarks: graded.totalMarks,
      obtainedObjectiveMarks: graded.obtainedMarks,
      totalWrittenQuestions: Array.isArray(examData?.sanitizedWrittenQuestions) ? examData.sanitizedWrittenQuestions.length : 0,
      writtenAnsweredCount: assignData.writtenAnswersCount || (assignData.writtenAnswers ? Object.keys(assignData.writtenAnswers).length : 0),
      writtenUnansweredCount: Math.max(0, (Array.isArray(examData?.sanitizedWrittenQuestions) ? examData.sanitizedWrittenQuestions.length : 0) - (assignData.writtenAnswersCount || 0)),
      totalQuestions: masterQuestions.length + (Array.isArray(examData?.sanitizedWrittenQuestions) ? examData.sanitizedWrittenQuestions.length : 0),
      requiresWrittenGrading: hasWrittenSection,
      answersCount: graded.answersCount,
      correctCount: graded.correctCount,
      answers: answers || {},
      writtenAnswers: assignData.writtenAnswers || {},
      submittedAt: assignData.submittedAt || serverTimestamp(),
      status,
      ...(existingResult?.writtenMarks !== undefined ? {
        writtenMarks: existingResult.writtenMarks,
        writtenTotalMarks: existingResult.writtenTotalMarks,
        shortQuestionsMarks: existingResult.shortQuestionsMarks,
        shortQuestionsTotalMarks: existingResult.shortQuestionsTotalMarks,
        longQuestionsMarks: existingResult.longQuestionsMarks,
        longQuestionsTotalMarks: existingResult.longQuestionsTotalMarks,
        writtenEvaluations: existingResult.writtenEvaluations,
      } : {}),
    };

    // Save to results collection (Teacher/Admin is authorized under Firestore rules)
    await setDoc(resultRef, {
      ...resultRecord,
      evaluatedBy: evaluatorUid || 'faculty-examiner',
      evaluatedAt: serverTimestamp(),
    });

    // Update assignment status to graded only if fully graded
    if (status === 'graded') {
      try {
        await updateDoc(doc(db, 'assignments', assignmentId), {
          status: 'graded',
          gradedAt: serverTimestamp(),
        });
      } catch (uErr) {
        console.warn('Assignment status update notice:', uErr);
      }
    }

    return resultRecord;
  },

  /**
   * Grades all submitted assignments for an exam (Batch Teacher/Admin action).
   */
  async gradeAllPendingSubmissionsForExam(
    examId: string,
    evaluatorUid?: string
  ): Promise<{ gradedCount: number; results: Result[] }> {
    const pendingDocs = await this.getPendingSubmissionsForExam(examId);

    const results: Result[] = [];
    for (const docData of pendingDocs) {
      const studentId = docData.studentId;
      if (studentId) {
        try {
          const res = await this.gradeSubmission({ examId, studentId, evaluatorUid });
          results.push(res);
        } catch (err) {
          console.error(`Error grading submission for student ${studentId}:`, err);
        }
      }
    }

    return {
      gradedCount: results.length,
      results,
    };
  },

  /**
   * Retrieves pending submissions for an exam.
   */
  async getPendingSubmissionsForExam(examId: string): Promise<any[]> {
    if (!examId) return [];
    const assignmentsCol = collection(db, 'assignments');
    try {
      const q = query(
        assignmentsCol,
        where('examId', '==', examId),
        where('status', '==', 'submitted')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (queryErr) {
      // In-memory fallback if composite index for examId + status is pending on Firebase
      console.warn('getPendingSubmissionsForExam fallback query:', queryErr);
      try {
        const qSimple = query(assignmentsCol, where('examId', '==', examId));
        const snap = await getDocs(qSimple);
        return snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter(
            (a: any) =>
              a.status === 'submitted' ||
              (a.answers && Object.keys(a.answers).length > 0 && a.status !== 'graded')
          );
      } catch (fallbackErr) {
        console.error('Failed to load pending submissions:', fallbackErr);
        return [];
      }
    }
  },

  /**
   * Retrieves a result by ID.
   */
  async getResultById(resultId: string): Promise<Result | null> {
    const resultRef = doc(db, 'results', resultId);
    const snapshot = await getDoc(resultRef);
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as Result;
  },
};

export default resultService;
