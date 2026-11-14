import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('royal-college-exam-system-firebase-adminsdk-fbsvc-d0043821f3.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

function extractOptionText(opt) {
  if (opt === undefined || opt === null) return '';
  if (typeof opt === 'string') return opt.trim();
  if (typeof opt === 'number') return String(opt).trim();
  return String(opt.text ?? opt.value ?? opt.label ?? opt.title ?? '').trim();
}

function checkAnswerMatch(submitted, correct, options = []) {
  if (submitted === undefined || submitted === null || correct === undefined || correct === null) return false;
  const rawSub = String(submitted).trim();
  const rawCor = String(correct).trim();
  if (rawSub === '' || rawCor === '' || rawSub === '-1' || rawCor === '-1') return false;
  if (rawSub.toLowerCase() === rawCor.toLowerCase()) return true;

  const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const subUpper = rawSub.toUpperCase().replace(/^OPTION\s+/i, '');
  const corUpper = rawCor.toUpperCase().replace(/^OPTION\s+/i, '');
  if (subUpper === corUpper) return true;

  const parseIndex = (val) => {
    if (letterMap[val] !== undefined) return letterMap[val];
    const num = Number(val);
    if (!isNaN(num) && Number.isInteger(num) && num >= 0 && num < 26) return num;
    return -1;
  };

  const subIndex = parseIndex(subUpper);
  const corIndex = parseIndex(corUpper);
  if (subIndex >= 0 && corIndex >= 0 && subIndex === corIndex) return true;

  const opts = Array.isArray(options) ? options : [];
  if (opts.length > 0) {
    if (subIndex >= 0 && subIndex < opts.length) {
      const optText = extractOptionText(opts[subIndex]);
      if (optText.toLowerCase() === rawCor.toLowerCase()) return true;
    }
    if (corIndex >= 0 && corIndex < opts.length) {
      const optText = extractOptionText(opts[corIndex]);
      if (optText.toLowerCase() === rawSub.toLowerCase()) return true;
    }
  }
  return false;
}

function calculateKmuGrade(percentage) {
  if (percentage >= 85) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 75) return 'B+';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

async function run() {
  console.log('--- STEP 1: Syncing examAnswerKeys for all exams ---');
  const examsSnap = await db.collection('exams').get();
  console.log(`Found ${examsSnap.size} exams in database.`);

  for (const examDoc of examsSnap.docs) {
    const examId = examDoc.id;
    const examData = examDoc.data();
    console.log(`Processing exam ${examId} (${examData.title || 'Untitled'})...`);

    const qSnap = await db.collection('questions').where('examId', '==', examId).get();
    if (qSnap.empty) {
      console.log(`  No questions in questions collection for ${examId}.`);
      continue;
    }

    const masterQuestions = qSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    console.log(`  Found ${masterQuestions.length} master questions.`);

    const keyDocRef = db.collection('examAnswerKeys').doc(examId);
    await keyDocRef.set({
      examId,
      questions: masterQuestions.map((q, idx) => ({
        id: q.id || `q-${idx + 1}`,
        examId,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        marks: Number(q.marks) || 1,
        order: Number(q.order) || idx + 1,
        explanation: q.explanation || ''
      })),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`  ✓ Synced examAnswerKeys/${examId} successfully!`);
  }

  console.log('\n--- STEP 2: Grading submitted candidate assignments ---');
  const submittedAssignSnap = await db.collection('assignments').where('status', '==', 'submitted').get();
  console.log(`Found ${submittedAssignSnap.size} submitted assignments.`);

  for (const assignDoc of submittedAssignSnap.docs) {
    const assignId = assignDoc.id;
    const assign = assignDoc.data();
    const { examId, studentId } = assign;

    console.log(`\nEvaluating Assignment ${assignId} (Student: ${studentId}, Exam: ${examId})...`);

    // Fetch master questions from examAnswerKeys or questions collection
    const keyDoc = await db.collection('examAnswerKeys').doc(examId).get();
    let questions = keyDoc.exists ? keyDoc.data().questions : [];

    if (!questions || questions.length === 0) {
      const qSnap = await db.collection('questions').where('examId', '==', examId).get();
      questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
    }

    if (!questions || questions.length === 0) {
      console.log(`  No questions found for exam ${examId}, skipping.`);
      continue;
    }

    let correctCount = 0;
    let totalMarks = 0;
    let obtainedMarks = 0;
    let answeredCount = 0;

    questions.forEach((q, idx) => {
      const qMarks = Number(q.marks) || 2;
      totalMarks += qMarks;

      const submitted = assign.answers?.[q.id] ?? assign.answers?.[idx] ?? assign.answers?.[String(idx)];
      if (submitted !== undefined && submitted !== null && String(submitted).trim() !== '' && submitted !== -1 && submitted !== '-1') {
        answeredCount++;
        const isMatch = checkAnswerMatch(submitted, q.correctAnswer, q.options);
        if (isMatch) {
          correctCount++;
          obtainedMarks += qMarks;
        }
      }
    });

    const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 1000) / 10 : 0;
    const passed = percentage >= 50;
    const grade = calculateKmuGrade(percentage);

    console.log(`  Result: ${obtainedMarks} / ${totalMarks} (${percentage}%), Grade: ${grade}, Passed: ${passed}, Correct: ${correctCount}/${questions.length}`);

    // Fetch student info for full transcript
    const userDoc = await db.collection('users').doc(studentId).get();
    const studentDoc = await db.collection('students').doc(studentId).get();
    const examDoc = await db.collection('exams').doc(examId).get();

    const userData = userDoc.exists ? userDoc.data() : {};
    const studentData = studentDoc.exists ? studentDoc.data() : {};
    const examData = examDoc.exists ? examDoc.data() : {};

    const studentName = studentData.name || userData.name || assign.studentName || 'Student Candidate';
    const kmuRegistrationNo = studentData.kmuRegistrationNo || userData.kmuRegistrationNo || assign.kmuRegistrationNo || '';
    const fatherName = studentData.fatherName || userData.fatherName || assign.fatherName || '';

    const resultId = `${studentId}_${examId}`;
    const resultPayload = {
      id: resultId,
      examId,
      studentId,
      studentName,
      kmuRegistrationNo,
      fatherName,
      examTitle: examData.title || assign.examTitle || 'Academic Examination',
      examType: examData.type || assign.examType || 'exam',
      subject: examData.subject || assign.subject || 'Clinical Assessment',
      program: studentData.program || examData.program || assign.program || '',
      semester: studentData.semester || examData.semester || assign.semester || '',
      batch: studentData.batch || examData.batch || assign.batch || '',
      marks: obtainedMarks,
      totalMarks,
      percentage,
      passed,
      grade,
      status: 'graded',
      mcqMarks: obtainedMarks,
      mcqTotalMarks: totalMarks,
      answersCount: answeredCount,
      correctCount,
      totalQuestions: questions.length,
      totalMCQs: questions.length,
      answeredMCQs: answeredCount,
      correctMCQs: correctCount,
      incorrectMCQs: Math.max(0, answeredCount - correctCount),
      unansweredMCQs: Math.max(0, questions.length - answeredCount),
      totalObjectiveMarks: totalMarks,
      obtainedObjectiveMarks: obtainedMarks,
      totalWrittenQuestions: 0,
      writtenAnsweredCount: 0,
      writtenUnansweredCount: 0,
      requiresWrittenGrading: false,
      answers: assign.answers || {},
      submittedAt: assign.submittedAt || new Date().toISOString()
    };

    // Save official result to results collection
    await db.collection('results').doc(resultId).set(resultPayload, { merge: true });
    console.log(`  ✓ Written official result document to results/${resultId}`);

    // Also update assignment status to graded if appropriate
    await db.collection('assignments').doc(assignId).set({
      studentName,
      kmuRegistrationNo,
      fatherName
    }, { merge: true });
  }

  console.log('\n--- ALL COMPLETE & VERIFIED! ---');
}

run();
