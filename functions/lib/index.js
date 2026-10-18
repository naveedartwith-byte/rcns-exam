"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitExamAttempt = exports.getStudentExamQuestions = exports.verifyExamSecretCode = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const examAuth_1 = require("./examAuth");
const grading_1 = require("./grading");
// Initialize Firebase Admin SDK (Singleton)
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
// Regional configuration matching Cloud Firestore (Asia Mumbai / asia-south1)
const FUNCTION_REGION = 'asia-south1';
/**
 * Cloud Function: verifyExamSecretCode
 * Authenticates candidate, verifies eligibility, enforces rate limiting,
 * securely validates secret exam code against salted hash, and authorizes attempt.
 */
exports.verifyExamSecretCode = (0, https_1.onCall)({ region: FUNCTION_REGION }, async (request) => {
    // 1. Verify caller authentication
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to verify examination code.');
    }
    const studentUid = request.auth.uid;
    const { examId, code } = request.data;
    if (!examId || typeof examId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Valid examination ID is required.');
    }
    if (!code || typeof code !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Secret exam code is required.');
    }
    const result = await (0, examAuth_1.validateAndAuthorizeExamCode)(db, studentUid, examId, code, Date.now());
    if (!result.success) {
        const isRateLimited = result.code === 'rate_limited';
        const isInvalidCode = result.code === 'invalid_code';
        const errorCode = isRateLimited
            ? 'resource-exhausted'
            : isInvalidCode
                ? 'permission-denied'
                : 'failed-precondition';
        throw new https_1.HttpsError(errorCode, result.message);
    }
    return {
        success: true,
        examId: result.examId,
        verifiedAt: result.verifiedAt,
        attemptId: result.attemptId,
    };
});
/**
 * Cloud Function: getStudentExamQuestions
 * Authenticates candidate, verifies eligibility & schedule against trusted server time,
 * checks secret code verification if required, fetches master questions, strips answer keys & explanations,
 * and delivers sanitized paper.
 */
exports.getStudentExamQuestions = (0, https_1.onCall)({ region: FUNCTION_REGION }, async (request) => {
    // 1. Verify caller authentication
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to access examination questions.');
    }
    const studentUid = request.auth.uid;
    const { examId } = request.data;
    if (!examId || typeof examId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Valid examination ID is required.');
    }
    // 2. Authoritative Eligibility & Schedule Check
    const eligibility = await (0, examAuth_1.verifyCandidateEligibility)(db, studentUid, examId, Date.now(), { allowSubmissionGrace: false });
    if (!eligibility.allowed) {
        const errorCode = eligibility.code === 'not_started' || eligibility.code === 'expired'
            ? 'failed-precondition'
            : 'permission-denied';
        throw new https_1.HttpsError(errorCode, eligibility.message);
    }
    const exam = eligibility.exam;
    // 2b. If exam requires secret code, verify candidate assignment has codeVerified === true
    if (exam.requiresSecretCode === true) {
        const assignmentId = `${examId}_${studentUid}`;
        const assignmentSnap = await db.collection('assignments').doc(assignmentId).get();
        if (!assignmentSnap.exists || assignmentSnap.data()?.codeVerified !== true) {
            throw new https_1.HttpsError('permission-denied', 'Secret exam code verification required before examination questions can be accessed.');
        }
    }
    // 3. Fetch Master Questions from Firestore using privileged Admin SDK
    const questionsSnap = await db
        .collection('questions')
        .where('examId', '==', examId)
        .get();
    const masterQuestions = questionsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    }));
    // Sort by order ascending
    masterQuestions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    // 4. SANITIZE: Strictly omit correctAnswer, explanation, and createdBy
    const sanitizedQuestions = masterQuestions.map((q) => ({
        id: q.id,
        examId: q.examId,
        question: q.question,
        options: q.options || [],
        marks: Number(q.marks) || 1,
        order: Number(q.order) || 0,
    }));
    // 5. Ensure Assignment Status is recorded as 'started'
    try {
        const assignmentId = `${examId}_${studentUid}`;
        const assignmentRef = db.collection('assignments').doc(assignmentId);
        const assignSnap = await assignmentRef.get();
        if (assignSnap.exists) {
            if (assignSnap.data()?.status === 'assigned') {
                await assignmentRef.update({
                    status: 'started',
                    startedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
        else {
            await assignmentRef.set({
                id: assignmentId,
                examId,
                studentId: studentUid,
                status: 'started',
                program: eligibility.student?.program || exam.program || '',
                semester: eligibility.student?.semester || exam.semester || '',
                batch: eligibility.student?.batch || exam.batch || '',
                assignedBy: 'system-verified-entry',
                assignedAt: admin.firestore.FieldValue.serverTimestamp(),
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    catch (assignErr) {
        console.warn('Assignment tracking notice:', assignErr);
    }
    return {
        examId,
        examTitle: exam.title,
        duration: Number(exam.duration) || 60,
        totalMarks: Number(exam.totalMarks) || masterQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0),
        questions: sanitizedQuestions,
    };
});
/**
 * Cloud Function: submitExamAttempt
 * Evaluates student answers on the server against the master question bank,
 * calculates marks, pass/fail, and writes authoritative result record.
 */
exports.submitExamAttempt = (0, https_1.onCall)({ region: FUNCTION_REGION }, async (request) => {
    // 1. Verify caller authentication
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to submit examination answers.');
    }
    const studentUid = request.auth.uid;
    const { examId, answers, writtenAnswers } = request.data;
    if (!examId || typeof examId !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Valid examination ID is required.');
    }
    if (!answers || typeof answers !== 'object') {
        throw new https_1.HttpsError('invalid-argument', 'Answers object is required.');
    }
    // 2. Idempotency Check: Return existing result if already evaluated and submitted
    const resultId = `${studentUid}_${examId}`;
    const resultRef = db.collection('results').doc(resultId);
    const existingResultSnap = await resultRef.get();
    if (existingResultSnap.exists) {
        const data = existingResultSnap.data();
        return {
            resultId,
            examId,
            studentId: studentUid,
            studentName: data.studentName || '',
            kmuRegistrationNo: data.kmuRegistrationNo || '',
            marks: data.marks || 0,
            totalMarks: data.totalMarks || 0,
            percentage: data.percentage || 0,
            passed: Boolean(data.passed),
            grade: data.grade || '',
            status: data.status || 'graded',
            mcqMarks: data.mcqMarks ?? data.marks ?? 0,
            mcqTotalMarks: data.mcqTotalMarks ?? data.totalMarks ?? 0,
            totalQuestions: data.totalQuestions || 0,
            totalMCQs: data.totalMCQs || 0,
            answeredMCQs: data.answeredMCQs || 0,
            correctMCQs: data.correctMCQs || 0,
            incorrectMCQs: data.incorrectMCQs || 0,
            unansweredMCQs: data.unansweredMCQs || 0,
            totalObjectiveMarks: data.totalObjectiveMarks || data.mcqTotalMarks || 0,
            obtainedObjectiveMarks: data.obtainedObjectiveMarks || data.mcqMarks || 0,
            totalWrittenQuestions: data.totalWrittenQuestions || 0,
            writtenAnsweredCount: data.writtenAnsweredCount || 0,
            writtenUnansweredCount: data.writtenUnansweredCount || 0,
            requiresWrittenGrading: Boolean(data.requiresWrittenGrading),
            submittedAt: data.submittedAt ? String(data.submittedAt) : new Date().toISOString(),
        };
    }
    // 3. Authoritative Eligibility & Schedule Check (allowing 10 min network grace period)
    const eligibility = await (0, examAuth_1.verifyCandidateEligibility)(db, studentUid, examId, Date.now(), { allowSubmissionGrace: true });
    if (!eligibility.allowed) {
        throw new https_1.HttpsError('failed-precondition', eligibility.message);
    }
    const exam = eligibility.exam;
    const student = eligibility.student;
    // 4. Load Authoritative Master Questions with Answer Keys
    const questionsSnap = await db
        .collection('questions')
        .where('examId', '==', examId)
        .get();
    const masterQuestions = questionsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
    }));
    if (masterQuestions.length === 0) {
        throw new https_1.HttpsError('failed-precondition', 'No questions found for this examination.');
    }
    // Load Written Questions (if any)
    let masterWrittenQuestions = [];
    try {
        const writtenSnap = await db
            .collection('writtenQuestions')
            .where('examId', '==', examId)
            .get();
        masterWrittenQuestions = writtenSnap.docs.map((d) => ({
            id: d.id,
            maxMarks: Number(d.data().maxMarks) || 5,
        }));
    }
    catch {
        if (Array.isArray(exam.sanitizedWrittenQuestions)) {
            masterWrittenQuestions = exam.sanitizedWrittenQuestions.map((wq) => ({
                id: String(wq.id),
                maxMarks: Number(wq.maxMarks) || 5,
            }));
        }
    }
    // 5. Server-Side Authoritative Grading for MCQs
    const graded = (0, grading_1.gradeExamSubmission)(masterQuestions, answers, exam.passingMarks);
    // 6. Compute Comprehensive Answer Statistics
    const totalMCQs = masterQuestions.length;
    const answeredMCQs = graded.answersCount;
    const correctMCQs = graded.correctCount;
    const incorrectMCQs = Math.max(0, answeredMCQs - correctMCQs);
    const unansweredMCQs = Math.max(0, totalMCQs - answeredMCQs);
    const totalObjectiveMarks = graded.totalMarks;
    const obtainedObjectiveMarks = graded.obtainedMarks;
    const totalWrittenQuestions = masterWrittenQuestions.length;
    let writtenAnsweredCount = 0;
    const sanitizedWrittenAnswers = {};
    if (writtenAnswers && typeof writtenAnswers === 'object') {
        for (const [key, val] of Object.entries(writtenAnswers)) {
            if (val && typeof val === 'object') {
                const answerText = String(val.answerText || '').trim();
                sanitizedWrittenAnswers[key] = {
                    questionId: String(val.questionId || key),
                    type: val.type || 'short',
                    questionText: String(val.questionText || ''),
                    answerText,
                    wordCount: Number(val.wordCount) || (answerText ? answerText.split(/\s+/).length : 0),
                    submittedAt: val.submittedAt || new Date().toISOString(),
                };
                if (answerText.length > 0) {
                    writtenAnsweredCount++;
                }
            }
        }
    }
    const writtenUnansweredCount = Math.max(0, totalWrittenQuestions - writtenAnsweredCount);
    const totalQuestions = totalMCQs + totalWrittenQuestions;
    const writtenTotalMarks = masterWrittenQuestions.reduce((sum, wq) => sum + (Number(wq.maxMarks) || 5), 0);
    const combinedTotalMarks = Number(exam.totalMarks) || (totalObjectiveMarks + writtenTotalMarks);
    const requiresWrittenGrading = totalWrittenQuestions > 0;
    // Status & Grades
    const status = requiresWrittenGrading ? 'pending' : 'graded';
    const grade = requiresWrittenGrading ? 'Pending' : (graded.grade || (0, grading_1.calculateKmuGrade)(graded.percentage));
    const passed = requiresWrittenGrading ? false : graded.passed;
    const marks = obtainedObjectiveMarks;
    const percentage = requiresWrittenGrading
        ? Math.round((obtainedObjectiveMarks / combinedTotalMarks) * 1000) / 10
        : graded.percentage;
    // 7. Write Authoritative Result Document via Admin SDK
    const submittedTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const resultDocData = {
        id: resultId,
        examId,
        studentId: studentUid,
        studentName: student.name || 'Student Candidate',
        kmuRegistrationNo: student.kmuRegistrationNo || '',
        examTitle: exam.title,
        examType: exam.type || 'quiz',
        subject: exam.subject || 'Clinical Assessment',
        program: student.program || exam.program || '',
        semester: student.semester || exam.semester || '',
        batch: student.batch || exam.batch || '',
        marks,
        totalMarks: combinedTotalMarks,
        percentage,
        passed,
        grade,
        status,
        answersCount: answeredMCQs,
        correctCount: correctMCQs,
        mcqMarks: obtainedObjectiveMarks,
        mcqTotalMarks: totalObjectiveMarks,
        totalQuestions,
        totalMCQs,
        answeredMCQs,
        correctMCQs,
        incorrectMCQs,
        unansweredMCQs,
        totalObjectiveMarks,
        obtainedObjectiveMarks,
        totalWrittenQuestions,
        writtenAnsweredCount,
        writtenUnansweredCount,
        writtenMarks: 0,
        writtenTotalMarks,
        requiresWrittenGrading,
        answers,
        writtenAnswers: sanitizedWrittenAnswers,
        submittedAt: submittedTimestamp,
        evaluatedBy: requiresWrittenGrading ? 'pending-faculty-evaluation' : 'secure-backend-grading-engine',
    };
    await resultRef.set(resultDocData);
    // 8. Update Assignment Document status to 'submitted'
    try {
        const assignmentId = `${examId}_${studentUid}`;
        const assignmentRef = db.collection('assignments').doc(assignmentId);
        await assignmentRef.set({
            id: assignmentId,
            examId,
            studentId: studentUid,
            studentName: student.name || 'Student Candidate',
            kmuRegistrationNo: student.kmuRegistrationNo || '',
            examTitle: exam.title,
            examType: exam.type || 'quiz',
            subject: exam.subject || 'Clinical Assessment',
            program: student.program || exam.program || '',
            semester: student.semester || exam.semester || '',
            batch: student.batch || exam.batch || '',
            status: 'submitted',
            submittedAt: submittedTimestamp,
            answers,
            answersCount: answeredMCQs,
            writtenAnswers: sanitizedWrittenAnswers,
            writtenAnswersCount: writtenAnsweredCount,
            mcqMarks: obtainedObjectiveMarks,
            mcqTotalMarks: totalObjectiveMarks,
            totalQuestions,
            totalMCQs,
            answeredMCQs,
            correctMCQs,
            incorrectMCQs,
            unansweredMCQs,
            totalObjectiveMarks,
            obtainedObjectiveMarks,
            totalWrittenQuestions,
            writtenAnsweredCount,
            writtenUnansweredCount,
            totalMarks: combinedTotalMarks,
            requiresWrittenGrading,
        }, { merge: true });
    }
    catch (assignErr) {
        console.warn('Could not update assignment status to submitted:', assignErr);
    }
    return {
        resultId,
        examId,
        studentId: studentUid,
        studentName: resultDocData.studentName,
        kmuRegistrationNo: resultDocData.kmuRegistrationNo,
        marks,
        totalMarks: combinedTotalMarks,
        percentage,
        passed,
        grade,
        status,
        mcqMarks: obtainedObjectiveMarks,
        mcqTotalMarks: totalObjectiveMarks,
        totalQuestions,
        totalMCQs,
        answeredMCQs,
        correctMCQs,
        incorrectMCQs,
        unansweredMCQs,
        totalObjectiveMarks,
        obtainedObjectiveMarks,
        totalWrittenQuestions,
        writtenAnsweredCount,
        writtenUnansweredCount,
        requiresWrittenGrading,
        submittedAt: new Date().toISOString(),
    };
});
//# sourceMappingURL=index.js.map