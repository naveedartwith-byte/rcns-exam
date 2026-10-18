import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Badge,
  Alert,
  LoadingSpinner,
} from '../ui';
import type { Exam } from '../../types/exam';
import type { StudentWrittenQuestion, WrittenQuestionEvaluation } from '../../types/writtenQuestion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firestore';
import { writtenQuestionService } from '../../services/writtenQuestionService';
import { writtenGradingService } from '../../services/writtenGradingService';
import { resultService } from '../../services/resultService';
import { questionService } from '../../services/questionService';
import { gradeExamSubmission } from '../../utils/secureGrading';
import { useAuth } from '../../hooks/useAuth';
import { formatPakistanDateTime } from '../../utils/dateTime';

interface WrittenAnswerEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  submission: any | null; // Student assignment or result doc data
  onEvaluationFinalized?: () => void;
}

export const WrittenAnswerEvaluationModal: React.FC<WrittenAnswerEvaluationModalProps> = ({
  isOpen,
  onClose,
  exam,
  submission,
  onEvaluationFinalized,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [writtenQuestions, setWrittenQuestions] = useState<StudentWrittenQuestion[]>([]);
  const [candidateWrittenAnswers, setCandidateWrittenAnswers] = useState<Record<string, any>>({});
  const [evaluations, setEvaluations] = useState<Record<string, WrittenQuestionEvaluation>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [autoAdvanceNotice, setAutoAdvanceNotice] = useState<string | null>(null);

  // Authoritative MCQ Scoring State
  const [evaluatedMcqMarks, setEvaluatedMcqMarks] = useState<number>(0);
  const [evaluatedMcqTotal, setEvaluatedMcqTotal] = useState<number>(0);
  const [mcqCorrectCount, setMcqCorrectCount] = useState<number>(0);
  const [mcqTotalCount, setMcqTotalCount] = useState<number>(0);

  // Load questions and candidate answers when modal opens
  useEffect(() => {
    let isMounted = true;
    const loadQuestionsAndAnswers = async () => {
      if (!isOpen || !exam || !submission) return;
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setAutoAdvanceNotice(null);
      setCurrentQuestionIdx(0);

      try {
        // 1. Load written questions: try exam sanitized list, fallback to master collection
        let qs = await writtenQuestionService.getStudentWrittenQuestions(exam.id);
        if (!qs || qs.length === 0) {
          const masterQs = await writtenQuestionService.getWrittenQuestionsByExamId(exam.id);
          qs = masterQs.map((q, idx) => ({
            id: q.id,
            examId: q.examId,
            type: q.type,
            question: q.question,
            maxMarks: Number(q.maxMarks) || 5,
            order: Number(q.order) || idx + 1,
            minWords: q.minWords,
            maxWords: q.maxWords,
          }));
        }

        // Sort ascending by question order strictly
        qs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

        if (!isMounted) return;
        setWrittenQuestions(qs);

        // 1b. Load Master MCQs to authoritatively evaluate candidate's MCQ score
        try {
          const masterMCQs = await questionService.getQuestionsByExamId(exam.id);
          if (masterMCQs && masterMCQs.length > 0) {
            let candidateMcqAnswers = submission.answers || {};
            const studentId = submission.studentId;
            if (Object.keys(candidateMcqAnswers).length === 0 && studentId) {
              const assignDoc = await getDoc(doc(db, 'assignments', `${exam.id}_${studentId}`));
              if (assignDoc.exists()) {
                candidateMcqAnswers = assignDoc.data().answers || {};
              }
            }
            if (Object.keys(candidateMcqAnswers).length === 0 && studentId) {
              const resDoc = await getDoc(doc(db, 'results', `${studentId}_${exam.id}`));
              if (resDoc.exists()) {
                candidateMcqAnswers = resDoc.data().answers || {};
              }
            }
            const mcqGraded = gradeExamSubmission(masterMCQs, candidateMcqAnswers, exam.passingMarks);
            if (isMounted) {
              setEvaluatedMcqMarks(mcqGraded.obtainedMarks);
              setEvaluatedMcqTotal(mcqGraded.totalMarks);
              setMcqCorrectCount(mcqGraded.correctCount);
              setMcqTotalCount(masterMCQs.length);
            }
          }
        } catch (mcqErr) {
          console.warn('Could not auto-evaluate MCQs for evaluation modal:', mcqErr);
        }

        // 2. Load candidate written answers from submission, assignment doc, or result doc
        let answersObj: Record<string, any> = submission.writtenAnswers || {};
        const studentId = submission.studentId;

        if (Object.keys(answersObj).length === 0 && studentId) {
          // Fetch from assignment document directly
          try {
            const assignmentId = `${exam.id}_${studentId}`;
            const assignSnap = await getDoc(doc(db, 'assignments', assignmentId));
            if (assignSnap.exists()) {
              const assignData = assignSnap.data();
              if (assignData && assignData.writtenAnswers) {
                answersObj = { ...assignData.writtenAnswers };
              }
            }
          } catch (e) {
            console.warn('Could not read assignment doc:', e);
          }

          // If still empty, check if result doc has answers
          if (Object.keys(answersObj).length === 0) {
            try {
              const resDoc = await resultService.getResultById(`${studentId}_${exam.id}`);
              if (resDoc && (resDoc as any).writtenAnswers) {
                answersObj = { ...(resDoc as any).writtenAnswers };
              }
            } catch (e) {
              console.warn('Could not read result doc:', e);
            }
          }
        }

        if (!isMounted) return;
        setCandidateWrittenAnswers(answersObj);

        // 3. Pre-populate evaluations (preserve any already evaluated marks)
        const initialEvals: Record<string, WrittenQuestionEvaluation> = {};
        const existingEvals = submission.writtenEvaluations || {};

        for (const q of qs) {
          const existing = existingEvals[q.id];
          initialEvals[q.id] = {
            questionId: q.id,
            type: q.type,
            questionText: q.question,
            maxMarks: q.maxMarks,
            awardedMarks: existing?.awardedMarks !== undefined ? Number(existing.awardedMarks) : 0,
            teacherComment: existing?.teacherComment || '',
          };
        }
        setEvaluations(initialEvals);
      } catch (err: any) {
        console.error('Error loading written questions for evaluation:', err);
        if (isMounted) setErrorMessage('Failed to load written questions for evaluation.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadQuestionsAndAnswers();
    return () => {
      isMounted = false;
    };
  }, [isOpen, exam?.id, submission?.id, submission?.studentId]);

  if (!exam || !submission) return null;

  // Student details
  const studentName = submission.studentName || 'Student Candidate';
  const kmuId = submission.kmuRegistrationNo || '—';
  const submittedAt = submission.submittedAt ? formatPakistanDateTime(submission.submittedAt) : 'Recorded';

  // MCQ Section Auto-Score: combine evaluated score from master questions
  const mcqQuestions = exam.sanitizedQuestions || [];
  const mcqFallbackTotal = mcqQuestions.reduce((s: number, q: any) => s + (Number(q.marks) || 1), 0);
  const rawMcqMarks = Number(submission.mcqMarks) || 0;

  const effectiveMcqMarks = evaluatedMcqTotal > 0 ? evaluatedMcqMarks : (rawMcqMarks > 0 ? rawMcqMarks : 0);
  const effectiveMcqTotal = evaluatedMcqTotal > 0
    ? evaluatedMcqTotal
    : (mcqFallbackTotal > 0 ? mcqFallbackTotal : (submission.totalMarks ? Math.max(0, submission.totalMarks - (exam.writtenTotalMarks || 0)) : 0));

  // Real-time calculation using pure writtenGradingService (MCQs + Short Qs + Long Qs)
  const liveOutcome = writtenGradingService.calculateCombinedMarks({
    mcqMarks: effectiveMcqMarks,
    mcqTotalMarks: effectiveMcqTotal,
    writtenEvaluations: evaluations,
    writtenQuestions,
    passingMarks: exam.passingMarks,
  });

  /**
   * Helper to resolve candidate's answer text across multiple indexing formats:
   * 1. Direct question ID match (`q.id`)
   * 2. Ordinal key match (`wq-${idx+1}`)
   * 3. Numeric index match (`${idx}`)
   * 4. Text match in candidate answers
   */
  const resolveCandidateAnswer = (q: StudentWrittenQuestion, idx: number): string => {
    if (!candidateWrittenAnswers) return '';

    // Match by direct ID
    if (candidateWrittenAnswers[q.id]) {
      const val = candidateWrittenAnswers[q.id];
      return typeof val === 'string' ? val : val.answerText || '';
    }

    // Match by wq-${idx+1}
    const wqKey = `wq-${idx + 1}`;
    if (candidateWrittenAnswers[wqKey]) {
      const val = candidateWrittenAnswers[wqKey];
      return typeof val === 'string' ? val : val.answerText || '';
    }

    // Match by numeric index
    if (candidateWrittenAnswers[idx] !== undefined) {
      const val = candidateWrittenAnswers[idx];
      return typeof val === 'string' ? val : val.answerText || '';
    }

    // Match by searching question text
    const entries = Object.values(candidateWrittenAnswers);
    for (const item of entries) {
      if (item && typeof item === 'object') {
        if (item.questionId === q.id || (item.questionText && item.questionText === q.question)) {
          return item.answerText || '';
        }
      }
    }

    return '';
  };

  /**
   * Award marks and auto-advance to the next question in ascending order
   */
  const handleSelectMarks = (
    questionId: string,
    qType: 'short' | 'long',
    maxMarks: number,
    marks: number,
    autoAdvance = true
  ) => {
    setEvaluations((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        type: qType,
        maxMarks,
        awardedMarks: marks,
        teacherComment: prev[questionId]?.teacherComment || '',
      },
    }));

    // Auto-advance to the next question in ascending order
    if (autoAdvance && currentQuestionIdx < writtenQuestions.length - 1) {
      const nextIdx = currentQuestionIdx + 1;
      setAutoAdvanceNotice(`✓ Marks saved! Moving to Question ${nextIdx + 1}...`);
      setTimeout(() => {
        setCurrentQuestionIdx(nextIdx);
        setAutoAdvanceNotice(null);
      }, 350);
    }
  };

  const handleUpdateComment = (questionId: string, comment: string) => {
    setEvaluations((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {
          questionId,
          type: 'short',
          maxMarks: 5,
          awardedMarks: 0,
        }),
        teacherComment: comment,
      },
    }));
  };

  const handleFinalize = async () => {
    if (!currentUser) return;
    setIsFinalizing(true);
    setErrorMessage(null);

    try {
      await writtenGradingService.finalizeCandidateResult({
        examId: exam.id,
        studentId: submission.studentId,
        evaluatorUid: currentUser.uid,
        evaluatorName: userProfile?.name || 'Faculty Examiner',
        mcqMarks: liveOutcome.mcqMarks,
        mcqTotalMarks: liveOutcome.mcqTotalMarks,
        writtenEvaluations: evaluations,
        writtenQuestions,
        passingMarks: exam.passingMarks,
      });

      setSuccessMessage('Result successfully finalized and published in the academic repository!');
      if (onEvaluationFinalized) {
        onEvaluationFinalized();
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error finalizing written evaluation:', err);
      setErrorMessage(err?.message || 'Failed to finalize candidate result.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const currentQ = writtenQuestions[currentQuestionIdx];
  const totalCount = writtenQuestions.length;
  const currentAnswer = currentQ ? resolveCandidateAnswer(currentQ, currentQuestionIdx) : '';
  const wordCount = currentAnswer.trim() ? currentAnswer.trim().split(/\s+/).length : 0;
  const currentAwarded = currentQ ? evaluations[currentQ.id]?.awardedMarks ?? 0 : 0;
  const markOptions = currentQ ? writtenGradingService.generateMarksDropdownOptions(currentQ.maxMarks) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Evaluate Written Answers: ${studentName}`}
      description={`KMU ID: ${kmuId} • Exam: ${exam.title} • Submitted: ${submittedAt}`}
      maxWidth="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-700)' }}>
            Total Score: <strong>{liveOutcome.finalMarks} / {liveOutcome.totalPossibleMarks}</strong> ({liveOutcome.percentage}%) •{' '}
            Grade: <Badge variant={liveOutcome.grade.startsWith('A') ? 'success' : 'primary'}>{liveOutcome.grade}</Badge> •{' '}
            <strong style={{ color: liveOutcome.passed ? '#059669' : '#dc2626' }}>
              {liveOutcome.passed ? 'PASSED' : 'FAILED'}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={isFinalizing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleFinalize}
              disabled={isFinalizing || isLoading || writtenQuestions.length === 0}
              style={{ backgroundColor: '#059669', borderColor: '#059669', fontWeight: 700 }}
            >
              {isFinalizing ? 'Finalizing Result...' : '✓ Save & Finalize Result'}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {errorMessage && (
          <Alert type="danger" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}
        {successMessage && (
          <Alert type="success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}
        {autoAdvanceNotice && (
          <div
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #10b981',
              borderRadius: 'var(--radius-md)',
              color: '#065f46',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {autoAdvanceNotice}
          </div>
        )}

        {/* Candidate Banner & Summary */}
        <div
          style={{
            backgroundColor: '#0f2744',
            color: '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8' }}>Candidate</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>{studentName}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8' }}>KMU Registration</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>{kmuId}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8' }}>MCQ Score</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
              {liveOutcome.mcqMarks} / {liveOutcome.mcqTotalMarks}
              {mcqTotalCount > 0 && (
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#cbd5e1', marginLeft: '4px' }}>
                  ({mcqCorrectCount}/{mcqTotalCount})
                </span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8' }}>Short Q Marks</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
              {liveOutcome.shortQuestionsMarks} / {liveOutcome.shortQuestionsTotalMarks}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8' }}>Long Q Marks</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fbbf24' }}>
              {liveOutcome.longQuestionsMarks} / {liveOutcome.longQuestionsTotalMarks}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem' }}>
            <LoadingSpinner size="lg" />
            <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', marginTop: '0.5rem' }}>
              Loading candidate responses and questions...
            </div>
          </div>
        ) : writtenQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            No written questions are configured for this examination paper.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Ascending Order Sequential Stepper / Question Navigator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                overflowX: 'auto',
                padding: '0.5rem',
                backgroundColor: '#f1f5f9',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'nowrap',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginRight: '0.25rem', whiteSpace: 'nowrap' }}>
                Questions:
              </span>
              {writtenQuestions.map((q, idx) => {
                const isSelected = currentQuestionIdx === idx;
                const evalItem = evaluations[q.id];
                const isGraded = evalItem && evalItem.awardedMarks !== undefined && evalItem.awardedMarks > 0;
                const ans = resolveCandidateAnswer(q, idx);
                const hasAnswer = Boolean(ans && ans.trim().length > 0);

                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => setCurrentQuestionIdx(idx)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '2px solid #0f2744' : '1px solid #cbd5e1',
                      backgroundColor: isSelected
                        ? '#0f2744'
                        : isGraded
                        ? '#ecfdf5'
                        : hasAnswer
                        ? '#eff6ff'
                        : '#ffffff',
                      color: isSelected ? '#ffffff' : isGraded ? '#047857' : '#1e293b',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span>
                      {q.type === 'short' ? 'Short' : 'Long'} #{idx + 1}
                    </span>
                    {isGraded ? (
                      <span style={{ fontSize: '0.7rem', color: isSelected ? '#34d399' : '#059669', fontWeight: 800 }}>
                        ({evalItem.awardedMarks}/{q.maxMarks})
                      </span>
                    ) : hasAnswer ? (
                      <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>📝</span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>✕</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Currently Active Question Evaluation Card */}
            {currentQ && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--color-slate-200)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Active Question Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Badge variant={currentQ.type === 'short' ? 'primary' : 'warning'}>
                        {currentQ.type === 'short' ? 'Short Question' : 'Long Question'} #{currentQuestionIdx + 1} of {totalCount}
                      </Badge>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>
                        Ascending Order #{currentQ.order || currentQuestionIdx + 1}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: '0.2rem 0 0' }}>
                      {currentQ.question}
                    </h3>
                  </div>
                  <Badge variant="outline" style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.35rem 0.65rem' }}>
                    Max Marks: {currentQ.maxMarks}
                  </Badge>
                </div>

                {/* Candidate's Submitted Response Box */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-slate-700)' }}>
                      Student's Answer:
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                      Word Count: {wordCount} words
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '1rem 1.15rem',
                      backgroundColor: currentAnswer ? '#f8fafc' : '#fef2f2',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${currentAnswer ? 'var(--color-slate-300)' : '#fca5a5'}`,
                      fontSize: '0.925rem',
                      color: currentAnswer ? 'var(--color-slate-900)' : '#991b1b',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      minHeight: currentQ.type === 'long' ? '120px' : '70px',
                      maxHeight: '260px',
                      overflowY: 'auto',
                    }}
                  >
                    {currentAnswer || '⚠️ Candidate did not provide a written response for this question.'}
                  </div>
                </div>

                {/* Fast-Click Marks Award Buttons with Auto-Advance */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--color-slate-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                      Award Marks (Clicking automatically advances to next question):
                    </label>
                    <span style={{ fontSize: '0.8rem', color: '#047857', fontWeight: 700 }}>
                      Awarded: {currentAwarded} / {currentQ.maxMarks}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {markOptions.map((opt) => {
                      const isSelected = currentAwarded === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSelectMarks(currentQ.id, currentQ.type, currentQ.maxMarks, opt, true)}
                          style={{
                            minWidth: '40px',
                            height: '38px',
                            padding: '0 0.65rem',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? '2px solid #0f2744' : '1px solid #cbd5e1',
                            backgroundColor: isSelected ? '#0f2744' : '#ffffff',
                            color: isSelected ? '#ffffff' : '#0f2744',
                            fontWeight: isSelected ? 800 : 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback comment input */}
                  <div style={{ marginTop: '0.25rem' }}>
                    <input
                      type="text"
                      placeholder="Optional feedback / examiner note for candidate..."
                      value={evaluations[currentQ.id]?.teacherComment || ''}
                      onChange={(e) => handleUpdateComment(currentQ.id, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-slate-300)',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Sequential Navigation Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                    disabled={currentQuestionIdx === 0}
                  >
                    ← Previous Question
                  </Button>

                  <span style={{ fontSize: '0.8rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>
                    Question {currentQuestionIdx + 1} of {totalCount}
                  </span>

                  {currentQuestionIdx < totalCount - 1 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setCurrentQuestionIdx((prev) => Math.min(totalCount - 1, prev + 1))}
                      style={{ backgroundColor: '#0f2744' }}
                    >
                      Next Question →
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleFinalize}
                      disabled={isFinalizing}
                      style={{ backgroundColor: '#059669', borderColor: '#059669', fontWeight: 700 }}
                    >
                      {isFinalizing ? 'Finalizing...' : '✓ Complete & Finalize Result'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default WrittenAnswerEvaluationModal;
