import React, { useState, useEffect } from 'react';
import {
  SearchBar,
  Select,
  Tabs,
  Badge,
  Button,
  Card,
  Modal,
  ConfirmDialog,
  EmptyState,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { assignmentService } from '../../services/assignmentService';
import { questionService } from '../../services/questionService';
import { resultService } from '../../services/resultService';
import type { Exam } from '../../types/exam';
import type { Question } from '../../types/question';

export const StudentExamsPage: React.FC = () => {
  const { currentUser, userProfile, studentProfile } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Exam Attempt State (Interactive Testing Screen)
  const [takingExam, setTakingExam] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Omit<Question, 'correctAnswer' | 'explanation'>[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScoreSummary, setExamScoreSummary] = useState<{
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
  } | null>(null);

  // Load authorized exams
  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      try {
        if (currentUser) {
          const authorized = await assignmentService.getAuthorizedExamsForStudent(
            currentUser.uid,
            studentProfile?.program || '',
            studentProfile?.semester || ''
          );
          if (isMounted) setExams(authorized);
        }
      } catch (err) {
        console.error('Error loading authorized student exams:', err);
      }
    };
    fetchExams();
    return () => {
      isMounted = false;
    };
  }, [currentUser, studentProfile]);

  // Filtered exams list
  const filteredExams = exams.filter((exam) => {
    // Tab filter
    if (activeTab === 'available' && exam.status !== 'active') return false;
    if (activeTab === 'scheduled' && exam.status !== 'scheduled') return false;
    if (activeTab === 'completed' && exam.status !== 'completed') return false;

    // Type filter
    if (typeFilter !== 'all' && exam.type !== typeFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = exam.title.toLowerCase().includes(q);
      const matchSubject = (exam.subject || '').toLowerCase().includes(q);
      const matchTeacher = (exam.teacherName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchSubject && !matchTeacher) return false;
    }

    return true;
  });

  // Countdown timer for taking exam
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (takingExam && !examSubmitted && timeLeftSeconds > 0) {
      timer = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            handleFinalSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [takingExam, examSubmitted, timeLeftSeconds]);

  const handleStartExam = async (exam: Exam) => {
    setTakingExam(exam);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setTimeLeftSeconds(exam.duration * 60);
    setExamSubmitted(false);
    setExamScoreSummary(null);

    try {
      const questions = await questionService.getStudentQuestions(exam.id);
      setExamQuestions(questions);
    } catch (err) {
      console.error('Error loading student sanitized questions:', err);
    }
  };

  const handleSelectOption = (optIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optIndex,
    }));
  };

  const handleToggleFlag = () => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [currentQuestionIndex]: !prev[currentQuestionIndex],
    }));
  };

  const handleClearAnswer = () => {
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestionIndex];
      return copy;
    });
  };

  const handleFinalSubmit = async () => {
    setShowSubmitConfirm(false);
    if (!takingExam || !currentUser) return;

    try {
      const result = await resultService.submitExamAttempt({
        studentId: currentUser.uid,
        studentName: userProfile?.name || 'Student Candidate',
        kmuRegistrationNo: studentProfile?.kmuRegistrationNo || '',
        examId: takingExam.id,
        examTitle: takingExam.title,
        examType: takingExam.type,
        subject: takingExam.subject || 'Clinical Assessment',
        program: studentProfile?.program || takingExam.program,
        semester: studentProfile?.semester || takingExam.semester,
        batch: studentProfile?.batch || '',
        answers: selectedAnswers,
      });

      setExamSubmitted(true);
      setExamScoreSummary({
        score: result.marks,
        total: result.totalMarks,
        percentage: result.percentage,
        passed: result.passed ?? result.percentage >= 50,
      });

      // Update local exam status to completed
      setExams((prev) =>
        prev.map((e) => (e.id === takingExam.id ? { ...e, status: 'completed' } : e))
      );
    } catch (err) {
      console.error('Error submitting exam:', err);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Questions for current exam
  const currentExamQuestions = examQuestions;
  const currentQuestion = currentExamQuestions[currentQuestionIndex];
  const totalQuestions = currentExamQuestions.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-slate-900)', margin: 0, fontFamily: 'var(--font-heading)' }}>
            Examination Portal
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-500)', marginTop: '0.25rem' }}>
            Official assessments, mid-terms, and quizzes for ROYAL COLLEGE OF NURSING SWAT.
          </p>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: '#ffffff',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-slate-200)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
          tabs={[
            { id: 'all', label: 'All Exams', badge: exams.length },
            { id: 'available', label: 'Available Now', badge: exams.filter((e) => e.status === 'active').length },
            { id: 'scheduled', label: 'Upcoming / Scheduled', badge: exams.filter((e) => e.status === 'scheduled').length },
            { id: 'completed', label: 'Completed', badge: exams.filter((e) => e.status === 'completed').length },
          ]}
        />

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search exam title or subject..."
          />

          <div style={{ width: '150px' }}>
            <Select
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'quiz', label: 'Quiz' },
                { value: 'midterm', label: 'Mid-Term' },
                { value: 'exam', label: 'Final Exam' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Exams Grid */}
      {filteredExams.length === 0 ? (
        <EmptyState
          title="No Examinations Found"
          description="No examination matches your current filter and search criteria."
          actionLabel="Clear Filters"
          onAction={() => {
            setActiveTab('all');
            setTypeFilter('all');
            setSearchQuery('');
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
          {filteredExams.map((exam) => {
            const isAvailable = exam.status === 'active';
            const isCompleted = exam.status === 'completed';
            const isScheduled = exam.status === 'scheduled';

            const statusBadgeConfig = {
              active: { variant: 'success' as const, label: 'Available Now' },
              scheduled: { variant: 'warning' as const, label: 'Scheduled' },
              completed: { variant: 'default' as const, label: 'Completed' },
              draft: { variant: 'outline' as const, label: 'Draft' },
              archived: { variant: 'outline' as const, label: 'Archived' },
            };

            const typeColor =
              exam.type === 'midterm' ? '#d97706' : exam.type === 'quiz' ? '#0d9488' : '#0e498b';

            return (
              <Card
                key={exam.id}
                hoverable
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${typeColor}`,
                }}
              >
                <div>
                  {/* Card Header Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Badge variant={statusBadgeConfig[exam.status].variant}>
                      {statusBadgeConfig[exam.status].label}
                    </Badge>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: typeColor,
                        backgroundColor: `${typeColor}15`,
                        padding: '0.15rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {exam.type}
                    </span>
                  </div>

                  {/* Title & Subject */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-slate-900)', lineHeight: 1.3 }}>
                    {exam.title}
                  </h3>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary-700)', marginTop: '0.25rem' }}>
                    {exam.subject}
                  </div>

                  <p style={{ fontSize: '0.825rem', color: 'var(--color-slate-500)', marginTop: '0.5rem', lineHeight: 1.45 }}>
                    {exam.description}
                  </p>

                  {/* Meta Information */}
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-slate-50)',
                      borderRadius: 'var(--radius-md)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Duration:</span>{' '}
                      <strong>{exam.duration} Mins</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Total Marks:</span>{' '}
                      <strong>{exam.totalMarks}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Passing Marks:</span>{' '}
                      <strong>{exam.passingMarks}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-slate-400)' }}>Questions:</span>{' '}
                      <strong>{exam.questionCount} MCQs</strong>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--color-slate-100)' }}>
                  {isAvailable && (
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => handleStartExam(exam)}
                      style={{ backgroundColor: '#0f2744' }}
                    >
                      Start Examination Now
                    </Button>
                  )}

                  {isScheduled && (
                    <Button variant="outline" fullWidth disabled>
                      Opens on Oct 10, 2026
                    </Button>
                  )}

                  {isCompleted && (
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => (window.location.href = '/student/results')}
                    >
                      View Submitted Result
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          LIVE EXAMINATION ATTEMPT MODAL / VIEW
          ========================================================================= */}
      {takingExam && (
        <Modal
          isOpen={Boolean(takingExam)}
          onClose={() => {
            if (!examSubmitted) {
              if (window.confirm('Are you sure you want to exit the exam screen? Your active time is still running.')) {
                setTakingExam(null);
              }
            } else {
              setTakingExam(null);
            }
          }}
          title={takingExam.title}
          description={`Subject: ${takingExam.subject} • Candidate KMU Verified Session`}
          maxWidth="xl"
        >
          {examSubmitted && examScoreSummary ? (
            /* Post-Submission Result Preview Card */
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.25rem',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                Examination Submitted Successfully!
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', marginTop: '0.35rem' }}>
                Your responses have been recorded and timestamped in the ROYAL COLLEGE OF NURSING SWAT academic repository.
              </p>

              <div
                style={{
                  maxWidth: '460px',
                  margin: '1.75rem auto',
                  padding: '1.25rem',
                  backgroundColor: 'var(--color-slate-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  textAlign: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>Raw Score</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                    {examScoreSummary.score} / {examScoreSummary.total}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>Percentage</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#047857' }}>
                    {examScoreSummary.percentage}%
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)' }}>Outcome</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: examScoreSummary.percentage >= 50 ? '#059669' : '#dc2626' }}>
                    {examScoreSummary.percentage >= 50 ? 'PASSED' : 'FAILED'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                <Button variant="primary" onClick={() => setTakingExam(null)} style={{ backgroundColor: '#0f2744' }}>
                  Return to Exams List
                </Button>
              </div>
            </div>
          ) : (
            /* Active Exam Layout: Timer, Question, Palette */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header Bar: Live Timer & Progress Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#0f2744',
                  color: '#ffffff',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Question:</span>
                  <strong style={{ fontSize: '1rem', color: '#ffffff' }}>
                    {currentQuestionIndex + 1} of {totalQuestions}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                    ({answeredCount} answered)
                  </span>
                </div>

                {/* Countdown Timer Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: timeLeftSeconds < 300 ? '#dc2626' : 'rgba(255, 255, 255, 0.15)',
                    padding: '0.35rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    fontSize: '1.05rem',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{formatTimer(timeLeftSeconds)}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-slate-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(answeredCount / (totalQuestions || 1)) * 100}%`,
                    height: '100%',
                    backgroundColor: '#10b981',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Question Screen Two-Column: Question Body (left) + Question Palette (right) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '1.5rem' }}>
                {/* Left: Active Question */}
                {currentQuestion && (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.5rem' }}>
                    <div>
                      {/* Question Top Metadata */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <Badge variant="primary">Question {currentQuestionIndex + 1}</Badge>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-600)' }}>
                          Marks: {currentQuestion.marks}
                        </span>
                      </div>

                      {/* Question Text */}
                      <div
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 600,
                          color: 'var(--color-slate-900)',
                          lineHeight: 1.5,
                          padding: '1rem',
                          backgroundColor: 'var(--color-slate-50)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-slate-200)',
                        }}
                      >
                        {currentQuestion.question}
                      </div>

                      {/* Multiple Choice Options */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
                        {currentQuestion.options.map((option, idx) => {
                          const optText = typeof option === 'string' ? option : option.text;
                          const isSelected = selectedAnswers[currentQuestionIndex] === idx;
                          const optionLetter = String.fromCharCode(65 + idx);

                          return (
                            <div
                              key={idx}
                              onClick={() => handleSelectOption(idx)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.85rem',
                                padding: '0.85rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: `2px solid ${isSelected ? 'var(--color-primary-800)' : 'var(--color-slate-200)'}`,
                                backgroundColor: isSelected ? 'var(--color-primary-50)' : '#ffffff',
                                cursor: 'pointer',
                                transition: 'all var(--transition-fast)',
                              }}
                            >
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: isSelected ? 'var(--color-primary-800)' : 'var(--color-slate-100)',
                                  color: isSelected ? '#ffffff' : 'var(--color-slate-700)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  flexShrink: 0,
                                }}
                              >
                                {optionLetter}
                              </div>

                              <span style={{ fontSize: '0.925rem', color: 'var(--color-slate-800)', fontWeight: isSelected ? 600 : 400 }}>
                                {optText}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Question Controls Bottom */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--color-slate-200)',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                          disabled={currentQuestionIndex === 0}
                        >
                          ← Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                          disabled={currentQuestionIndex === totalQuestions - 1}
                        >
                          Next →
                        </Button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant={flaggedQuestions[currentQuestionIndex] ? 'warning' : 'ghost'}
                          size="sm"
                          onClick={handleToggleFlag}
                        >
                          {flaggedQuestions[currentQuestionIndex] ? '🚩 Flagged' : '🏳 Flag for Review'}
                        </Button>
                        {selectedAnswers[currentQuestionIndex] !== undefined && (
                          <Button variant="ghost" size="sm" onClick={handleClearAnswer}>
                            Clear Answer
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Right: Question Navigator Palette */}
                <div
                  style={{
                    backgroundColor: 'var(--color-slate-50)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-slate-200)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-slate-700)', marginBottom: '0.75rem' }}>
                      Question Palette
                    </h4>

                    {/* Grid Palette */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                      {currentExamQuestions.map((_, qIdx) => {
                        const isAnswered = selectedAnswers[qIdx] !== undefined;
                        const isCurrent = currentQuestionIndex === qIdx;
                        const isFlagged = flaggedQuestions[qIdx];

                        let bg = '#ffffff';
                        let color = 'var(--color-slate-700)';
                        let border = '1px solid var(--color-slate-300)';

                        if (isAnswered) {
                          bg = '#059669';
                          color = '#ffffff';
                          border = '1px solid #059669';
                        }
                        if (isFlagged) {
                          bg = '#d97706';
                          color = '#ffffff';
                          border = '1px solid #d97706';
                        }
                        if (isCurrent) {
                          border = '2px solid #0f2744';
                        }

                        return (
                          <button
                            key={qIdx}
                            type="button"
                            onClick={() => setCurrentQuestionIndex(qIdx)}
                            style={{
                              height: '34px',
                              borderRadius: 'var(--radius-sm)',
                              border,
                              backgroundColor: bg,
                              color,
                              fontWeight: isCurrent ? 800 : 600,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                          >
                            {qIdx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--color-slate-600)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '10px', height: '10px', backgroundColor: '#059669', borderRadius: '2px' }} />
                        <span>Answered ({answeredCount})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '10px', height: '10px', backgroundColor: '#d97706', borderRadius: '2px' }} />
                        <span>Flagged ({Object.keys(flaggedQuestions).filter((k) => flaggedQuestions[Number(k)]).length})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '10px', height: '10px', backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '2px' }} />
                        <span>Unanswered ({totalQuestions - answeredCount})</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Exam Button */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <Button
                      variant="danger"
                      fullWidth
                      onClick={() => setShowSubmitConfirm(true)}
                    >
                      Finish &amp; Submit Exam
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleFinalSubmit}
        title="Confirm Final Exam Submission"
        message={`You have answered ${answeredCount} of ${totalQuestions} questions. ${
          totalQuestions - answeredCount > 0
            ? `Warning: ${totalQuestions - answeredCount} question(s) remain unanswered.`
            : 'All questions have been answered.'
        } Once submitted, you cannot change your answers.`}
        confirmText="Yes, Submit Examination"
        cancelText="Return to Questions"
        variant="danger"
      />
    </div>
  );
};

export default StudentExamsPage;
