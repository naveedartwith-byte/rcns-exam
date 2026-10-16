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
import { writtenQuestionService } from '../../services/writtenQuestionService';
import { writtenGradingService } from '../../services/writtenGradingService';
import { useAuth } from '../../hooks/useAuth';
import { formatPakistanDateTime } from '../../utils/dateTime';

interface WrittenAnswerEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  submission: any | null; // Student assignment doc data
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
  const [evaluations, setEvaluations] = useState<Record<string, WrittenQuestionEvaluation>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load questions and existing marks when opened
  useEffect(() => {
    let isMounted = true;
    const loadQuestions = async () => {
      if (!isOpen || !exam || !submission) return;
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const qs = await writtenQuestionService.getStudentWrittenQuestions(exam.id);
        if (!isMounted) return;
        setWrittenQuestions(qs);

        // Pre-populate evaluations from existing result or submission
        const initialEvals: Record<string, WrittenQuestionEvaluation> = {};
        for (const q of qs) {
          initialEvals[q.id] = {
            questionId: q.id,
            type: q.type,
            questionText: q.question,
            maxMarks: q.maxMarks,
            awardedMarks: 0,
            teacherComment: '',
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

    loadQuestions();
    return () => {
      isMounted = false;
    };
  }, [isOpen, exam?.id, submission?.id]);

  if (!exam || !submission) return null;

  // Student details
  const studentName = submission.studentName || 'Student Candidate';
  const kmuId = submission.kmuRegistrationNo || '—';
  const submittedAt = submission.submittedAt ? formatPakistanDateTime(submission.submittedAt) : 'Recorded';

  // MCQ Section Auto-Score
  // Submission has MCQ answers: answersCount, or pre-computed mcqMarks
  const mcqQuestions = exam.sanitizedQuestions || [];
  const mcqTotalMarks = mcqQuestions.reduce((s: number, q: any) => s + (Number(q.marks) || 1), 0);
  const rawMcqMarks = Number(submission.mcqMarks) || 0;
  const safeMcqMarks = Math.min(rawMcqMarks, mcqTotalMarks);

  // Real-time calculation using pure writtenGradingService
  const liveOutcome = writtenGradingService.calculateCombinedMarks({
    mcqMarks: safeMcqMarks,
    mcqTotalMarks: mcqTotalMarks || (submission.totalMarks ? submission.totalMarks - exam.writtenTotalMarks! : 40),
    writtenEvaluations: evaluations,
    writtenQuestions,
    passingMarks: exam.passingMarks,
  });

  const handleSelectMarks = (questionId: string, qType: 'short' | 'long', maxMarks: number, marks: number) => {
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

  const studentWrittenAnswers = submission.writtenAnswers || {};
  const shortQuestions = writtenQuestions.filter((q) => q.type === 'short');
  const longQuestions = writtenQuestions.filter((q) => q.type === 'long');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Evaluate Written Answers: ${studentName}`}
      description={`KMU ID: ${kmuId} • Exam: ${exam.title} • Submitted: ${submittedAt}`}
      maxWidth="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-slate-700)' }}>
            Final Result: <strong>{liveOutcome.finalMarks} / {liveOutcome.totalPossibleMarks}</strong> ({liveOutcome.percentage}%) •{' '}
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
              style={{ backgroundColor: '#059669', borderColor: '#059669' }}
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

        {/* Candidate Banner & Summary */}
        <div
          style={{
            backgroundColor: '#0f2744',
            color: '#ffffff',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8' }}>MCQ Auto-Score</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
              {liveOutcome.mcqMarks} / {liveOutcome.mcqTotalMarks}
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
              Loading candidate responses...
            </div>
          </div>
        ) : writtenQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)' }}>
            No written questions are configured for this examination paper.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Short Questions Section */}
            {shortQuestions.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                    Short Questions Evaluation ({shortQuestions.length})
                  </h3>
                  <Badge variant="primary">Max {shortQuestions.reduce((s, q) => s + q.maxMarks, 0)} Marks</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {shortQuestions.map((q, idx) => {
                    const studentAns = studentWrittenAnswers[q.id]?.answerText || '';
                    const wordCount = studentAns.trim() ? studentAns.trim().split(/\s+/).length : 0;
                    const awarded = evaluations[q.id]?.awardedMarks ?? 0;
                    const options = writtenGradingService.generateMarksDropdownOptions(q.maxMarks);

                    return (
                      <div
                        key={q.id}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--color-slate-200)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          boxShadow: 'var(--shadow-xs)',
                        }}
                      >
                        {/* Question Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>
                              Short Question #{idx + 1}
                            </span>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: '0.2rem 0 0' }}>
                              {q.question}
                            </h4>
                          </div>
                          <Badge variant="outline">Max Marks: {q.maxMarks}</Badge>
                        </div>

                        {/* Student Answer Text */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
                              Candidate's Response:
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                              Word Count: {wordCount} words
                            </span>
                          </div>

                          <div
                            style={{
                              padding: '0.85rem 1rem',
                              backgroundColor: studentAns ? 'var(--color-slate-50)' : '#fef2f2',
                              borderRadius: 'var(--radius-md)',
                              border: `1px solid ${studentAns ? 'var(--color-slate-300)' : '#fca5a5'}`,
                              fontSize: '0.9rem',
                              color: studentAns ? 'var(--color-slate-800)' : '#991b1b',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'inherit',
                              minHeight: '60px',
                            }}
                          >
                            {studentAns || '⚠️ No response was submitted by candidate for this question.'}
                          </div>
                        </div>

                        {/* Award Marks Dropdown Selector */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '1px solid var(--color-slate-100)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                              Award Marks:
                            </label>
                            <select
                              value={awarded}
                              onChange={(e) => handleSelectMarks(q.id, 'short', q.maxMarks, parseInt(e.target.value, 10))}
                              style={{
                                padding: '0.45rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: '2px solid #0f2744',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                color: '#0f2744',
                                backgroundColor: '#f0fdf4',
                                cursor: 'pointer',
                              }}
                            >
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt} / {q.maxMarks} Marks
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ flex: 1, minWidth: '220px' }}>
                            <input
                              type="text"
                              placeholder="Optional examiner feedback / notes for this answer..."
                              value={evaluations[q.id]?.teacherComment || ''}
                              onChange={(e) => handleUpdateComment(q.id, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.75rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-slate-300)',
                                fontSize: '0.825rem',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Long Questions Section */}
            {longQuestions.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0 }}>
                    Long Questions Evaluation ({longQuestions.length})
                  </h3>
                  <Badge variant="warning">Max {longQuestions.reduce((s, q) => s + q.maxMarks, 0)} Marks</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {longQuestions.map((q, idx) => {
                    const studentAns = studentWrittenAnswers[q.id]?.answerText || '';
                    const wordCount = studentAns.trim() ? studentAns.trim().split(/\s+/).length : 0;
                    const awarded = evaluations[q.id]?.awardedMarks ?? 0;
                    const options = writtenGradingService.generateMarksDropdownOptions(q.maxMarks);

                    return (
                      <div
                        key={q.id}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--color-slate-200)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          boxShadow: 'var(--shadow-xs)',
                        }}
                      >
                        {/* Question Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
                              Long Question #{idx + 1}
                            </span>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-slate-900)', margin: '0.2rem 0 0' }}>
                              {q.question}
                            </h4>
                          </div>
                          <Badge variant="outline">Max Marks: {q.maxMarks}</Badge>
                        </div>

                        {/* Student Answer Text */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
                              Candidate's Detailed Response:
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                              Word Count: {wordCount} words
                            </span>
                          </div>

                          <div
                            style={{
                              padding: '0.85rem 1rem',
                              backgroundColor: studentAns ? 'var(--color-slate-50)' : '#fef2f2',
                              borderRadius: 'var(--radius-md)',
                              border: `1px solid ${studentAns ? 'var(--color-slate-300)' : '#fca5a5'}`,
                              fontSize: '0.9rem',
                              color: studentAns ? 'var(--color-slate-800)' : '#991b1b',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'inherit',
                              minHeight: '80px',
                            }}
                          >
                            {studentAns || '⚠️ No response was submitted by candidate for this question.'}
                          </div>
                        </div>

                        {/* Award Marks Dropdown Selector */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.75rem',
                            paddingTop: '0.75rem',
                            borderTop: '1px solid var(--color-slate-100)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                              Award Marks:
                            </label>
                            <select
                              value={awarded}
                              onChange={(e) => handleSelectMarks(q.id, 'long', q.maxMarks, parseInt(e.target.value, 10))}
                              style={{
                                padding: '0.45rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: '2px solid #0f2744',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                color: '#0f2744',
                                backgroundColor: '#fffbeb',
                                cursor: 'pointer',
                              }}
                            >
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt} / {q.maxMarks} Marks
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ flex: 1, minWidth: '220px' }}>
                            <input
                              type="text"
                              placeholder="Optional examiner feedback / notes for this answer..."
                              value={evaluations[q.id]?.teacherComment || ''}
                              onChange={(e) => handleUpdateComment(q.id, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.75rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-slate-300)',
                                fontSize: '0.825rem',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
