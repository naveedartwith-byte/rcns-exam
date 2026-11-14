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
  console.log('--- UPDATING QUESTIONS AND EXAMS TO 1 MARK PER MCQ ---');
  const examsSnap = await db.collection('exams').get();
  console.log(`Found ${examsSnap.size} exams.`);

  for (const examDoc of examsSnap.docs) {
    const examId = examDoc.id;
    const examData = examDoc.data();
    console.log(`\nProcessing Exam: ${examId} (${examData.title || 'Untitled'})`);

    const qSnap = await db.collection('questions').where('examId', '==', examId).get();
    if (qSnap.empty) {
      console.log('  No questions found in questions collection.');
      continue;
    }

    const batch = db.batch();
    const updatedQuestions = [];

    qSnap.docs.forEach((docSnap) => {
      const qData = docSnap.data();
      const updatedQ = {
        ...qData,
        id: docSnap.id,
        marks: 1
      };
      updatedQuestions.push(updatedQ);
      batch.update(docSnap.ref, { marks: 1, updatedAt: FieldValue.serverTimestamp() });
    });

    await batch.commit();
    console.log(`  ✓ Updated ${qSnap.size} questions to marks: 1.`);

    updatedQuestions.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // Update exam document
    const sanitizedQuestions = updatedQuestions.map((q, idx) => ({
      id: q.id,
      examId,
      question: q.question,
      options: q.options || [],
      marks: 1,
      order: Number(q.order) || idx + 1
    }));

    const totalMarks = updatedQuestions.length;
    const passingMarks = Math.ceil(totalMarks * 0.5);

    await db.collection('exams').doc(examId).update({
      sanitizedQuestions,
      questionCount: totalMarks,
      totalMarks,
      passingMarks,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`  ✓ Updated exam doc: totalMarks = ${totalMarks}, passingMarks = ${passingMarks}.`);

    // Update examAnswerKeys
    await db.collection('examAnswerKeys').doc(examId).set({
      examId,
      questions: updatedQuestions.map((q, idx) => ({
        id: q.id,
        examId,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        marks: 1,
        order: Number(q.order) || idx + 1,
        explanation: q.explanation || ''
      })),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`  ✓ Updated examAnswerKeys/${examId} with 1 mark per question.`);

    // Update assignments totalMarks
    const assignSnap = await db.collection('assignments').where('examId', '==', examId).get();
    for (const aDoc of assignSnap.docs) {
      await aDoc.ref.update({
        totalMarks,
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    console.log(`  ✓ Updated ${assignSnap.size} assignments to totalMarks = ${totalMarks}.`);

    // Re-evaluate results for this exam
    const resultsSnap = await db.collection('results').where('examId', '==', examId).get();
    for (const resDoc of resultsSnap.docs) {
      const resData = resDoc.data();
      const studentId = resData.studentId;
      console.log(`  Re-evaluating result ${resDoc.id} for student ${resData.studentName}...`);

      const assignDoc = await db.collection('assignments').doc(`${examId}_${studentId}`).get();
      const studentAnswers = assignDoc.exists ? assignDoc.data().answers : resData.answers;

      let correctCount = 0;
      let answeredCount = 0;

      updatedQuestions.forEach((q, idx) => {
        const submitted = studentAnswers?.[q.id] ?? studentAnswers?.[idx] ?? studentAnswers?.[String(idx)];
        if (submitted !== undefined && submitted !== null && String(submitted).trim() !== '' && submitted !== -1 && submitted !== '-1') {
          answeredCount++;
          if (checkAnswerMatch(submitted, q.correctAnswer, q.options)) {
            correctCount++;
          }
        }
      });

      const obtainedMarks = correctCount * 1; // 1 mark per correct question!
      const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 1000) / 10 : 0;
      const passed = percentage >= 50;
      const grade = calculateKmuGrade(percentage);

      await resDoc.ref.update({
        marks: obtainedMarks,
        totalMarks,
        percentage,
        passed,
        grade,
        mcqMarks: obtainedMarks,
        mcqTotalMarks: totalMarks,
        correctCount,
        correctMCQs: correctCount,
        incorrectMCQs: Math.max(0, answeredCount - correctCount),
        totalObjectiveMarks: totalMarks,
        obtainedObjectiveMarks: obtainedMarks,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`    → New Result: ${obtainedMarks} / ${totalMarks} marks (${percentage}%), Grade: ${grade}, Correct: ${correctCount}/${totalMarks}`);
    }
  }

  console.log('\n--- ALL EXAMS, QUESTIONS, AND RESULTS UPDATED SUCCESSFULLY ---');
}

run();
