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
  Alert,
  LoadingSpinner,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { assignmentService } from '../../services/assignmentService';
import { questionService } from '../../services/questionService';
import { resultService } from '../../services/resultService';
import type { Exam } from '../../types/exam';
import type { Question } from '../../types/question';
import { formatPakistanDateTime } from '../../utils/dateTime';
import { checkStudentExamEligibility } from '../../utils/examEligibility';

export const StudentExamsPage: React.FC = () => {
  const { currentUser, userProfile, studentProfile } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Helper functions for stable question shuffling
  const reorderByCustomIds = <T extends { id?: string }>(questions: T[], orderIds: string[]): T[] => {
    const map = new Map<string, T>(questions.map((q) => [q.id || '', q]));
    const result: T[] = [];
    for (const id of orderIds) {
      if (map.has(id)) {
        result.push(map.get(id)!);
        map.delete(id);
      }
    }
    // Include any new or unmapped questions
    for (const rem of map.values()) {
      result.push(rem);
    }
    return result;
  };

  const stableShuffleQuestions = <T,>(questions: T[]): T[] => {
    const copy = [...questions];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Exam Attempt State (Interactive Testing Screen)
  const [takingExam, setTakingExam] = useState<Exam | null>(null);
  const [examQuestions, setExamQuestions] = useState<Omit<Question, 'correctAnswer' | 'explanation'>[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string | number, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(3600);
  const [examStartedAtMs, setExamStartedAtMs] = useState<number | null>(null);
  const [isExamPaused, setIsExamPaused] = useState(false);
  const [examPauseMessage, setExamPauseMessage] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examScoreSummary, setExamScoreSummary] = useState<{
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
    status?: string;
    answersCount?: number;
    totalQuestions?: number;
    correctCount?: number;
    incorrectCount?: number;
    unansweredCount?: number;
  } | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [examQuestionsError, setExamQuestionsError] = useState<string | null>(null);

  // Load authorized exams
  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      try {
        if (currentUser) {
          const authorized = await assignmentService.getAuthorizedExamsForStudent(
            currentUser.uid,
            studentProfile?.program || '',
            studentProfile?.semester || '',
            studentProfile?.batch || ''
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

  // Countdown timer: strictly runs continuously (even while paused) based on examStartedAtMs
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (takingExam && !examSubmitted && examStartedAtMs) {
      const totalDurationSec = (takingExam.duration || 60) * 60;
      const tick = () => {
        const elapsedSec = Math.floor((Date.now() - examStartedAtMs) / 1000);
        const remaining = Math.max(0, totalDurationSec - elapsedSec);
        setTimeLeftSeconds(remaining);
        if (remaining <= 0 && !examSubmitted) {
          handleFinalSubmit();
        }
      };
      tick();
      timer = setInterval(tick, 1000);
    }
    return () => clearInterval(timer);
  }, [takingExam, examSubmitted, examStartedAtMs]);

  // Real-time synchronization for remote pause & candidate heartbeat
  useEffect(() => {
    if (!takingExam || !currentUser || examSubmitted) return;

    // 1. Subscribe to assignment document for instant remote pause/resume synchronization
    const unsubscribe = assignmentService.subscribeToStudentAssignment(
      takingExam.id,
      currentUser.uid,
      (assignment) => {
        if (!assignment) return;
        const paused = Boolean(assignment.isPaused);
        setIsExamPaused(paused);
        if (paused) {
          const supervisor = assignment.pausedByName ? ` by ${assignment.pausedByName}` : '';
          setExamPauseMessage(`Your exam has been paused by the examination supervisor${supervisor}.`);
        } else {
          setExamPauseMessage(null);
        }
      }
    );

    // 2. Periodic candidate activity heartbeat (every 20 seconds)
    assignmentService.recordStudentHeartbeat(takingExam.id, currentUser.uid);
    const heartbeatInterval = setInterval(() => {
      assignmentService.recordStudentHeartbeat(takingExam.id, currentUser.uid);
    }, 20000);

    return () => {
      unsubscribe();
      clearInterval(heartbeatInterval);
    };
  }, [takingExam, currentUser, examSubmitted]);

  const handleStartExam = async (exam: Exam) => {
    // 1. Perform canonical student exam eligibility check & diagnostics
    const eligibility = checkStudentExamEligibility({
      exam,
      student: studentProfile,
      user: userProfile,
      nowMs: Date.now(),
      isDev: true,
    });

    // 2. If access check fails, show clear, distinct message without combined ambiguity
    if (!eligibility.allowed) {
      alert(eligibility.message);
      return;
    }

    if (!currentUser) return;

    // Lock check: Prevent students from entering a submitted exam attempt
    if (exam.assignmentStatus === 'submitted' || exam.assignmentStatus === 'graded') {
      alert('You have already submitted this exam.');
      return;
    }

    setTakingExam(exam);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setExamSubmitted(false);
    setExamScoreSummary(null);
    setIsLoadingQuestions(true);
    setExamQuestionsError(null);
    setIsExamPaused(false);
    setExamPauseMessage(null);

    try {
      // 3. Register or resume active attempt via assignmentService
      const attempt = await assignmentService.startStudentAttempt({
        examId: exam.id,
        studentId: currentUser.uid,
        studentName: userProfile?.name || 'Student Candidate',
        kmuRegistrationNo: studentProfile?.kmuRegistrationNo || '',
        batch: studentProfile?.batch || exam.batch || '',
        semester: studentProfile?.semester || exam.semester || '',
        program: studentProfile?.program || exam.program || '',
        examTitle: exam.title,
        durationMinutes: exam.duration || 60,
      });

      setExamStartedAtMs(attempt.startedAtMs);
      const elapsedSec = Math.floor((Date.now() - attempt.startedAtMs) / 1000);
      const totalSec = (exam.duration || 60) * 60;
      const initialRemaining = Math.max(0, totalSec - elapsedSec);
      setTimeLeftSeconds(initialRemaining);

      if (attempt.isPaused) {
        setIsExamPaused(true);
        setExamPauseMessage('Your exam has been paused by the examination supervisor.');
      }

      // 4. Fetch sanitized questions
      const rawQuestions = await questionService.getStudentQuestions(exam.id);
      if (rawQuestions.length === 0) {
        setExamQuestionsError('No examination questions were found for this paper. Please contact your course instructor.');
        return;
      }

      // 5. Question order management (Stable Shuffling vs Original Order)
      let finalQuestions = rawQuestions;
      if (exam.shuffleQuestions) {
        const assignmentId = `${exam.id}_${currentUser.uid}`;
        if (attempt.shuffledQuestionOrder && attempt.shuffledQuestionOrder.length > 0) {
          // Attempt already has a saved stable shuffle order: reconstruct it
          finalQuestions = reorderByCustomIds(rawQuestions, attempt.shuffledQuestionOrder);
        } else {
          // First start with shuffle enabled: generate stable shuffle and persist it
          finalQuestions = stableShuffleQuestions(rawQuestions);
          const orderIds = finalQuestions.map((q) => q.id || '');
          await assignmentService.saveShuffledQuestionOrder(assignmentId, orderIds);
        }
      }

      setExamQuestions(finalQuestions);
    } catch (err: any) {
      console.error('Error starting student sanitized questions:', err?.message || err);

      if (
        err?.message?.toLowerCase().includes('already submitted') ||
        err?.message?.includes('You have already submitted this exam')
      ) {
        alert('You have already submitted this exam.');
        setTakingExam(null);
        return;
      }
      const isPermissionErr =
        err?.code === 'permission-denied' ||
        (err?.message && err.message.toLowerCase().includes('permission'));

      const isInternalOrFunctionErr =
        err?.code === 'internal' ||
        err?.code === 'functions/internal' ||
        err?.code === 'functions/unavailable' ||
        err?.code === 'functions/not-found' ||
        (err?.message &&
          (err.message.toLowerCase() === 'internal' ||
            err.message.toLowerCase().includes('functions/internal') ||
            err.message.toLowerCase().includes('internal error')));

      let friendlyMsg = err?.message || 'Unable to load examination questions from database.';
      if (isInternalOrFunctionErr) {
        friendlyMsg =
          'Examination questions are temporarily unavailable. Please verify that the examination paper has been published by your instructor, or contact your examination proctor.';
      } else if (isPermissionErr) {
        const recheck = checkStudentExamEligibility({
          exam,
          student: studentProfile,
          user: userProfile,
          nowMs: Date.now(),
          isDev: true,
        });

        if (!recheck.allowed) {
          friendlyMsg = recheck.message;
        } else {
          friendlyMsg =
            'Access restricted: Database permission denied loading examination questions. Please contact your examination proctor to verify registration.';
        }
      }
      setExamQuestionsError(friendlyMsg);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleSelectOption = (optIndex: number) => {
    if (isExamPaused) return;
    const currentQ = examQuestions[currentQuestionIndex];
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optIndex,
      ...(currentQ?.id ? { [currentQ.id]: optIndex } : {}),
    }));
  };

  const handleToggleFlag = () => {
    if (isExamPaused) return;
    setFlaggedQuestions((prev) => ({
      ...prev,
      [currentQuestionIndex]: !prev[currentQuestionIndex],
    }));
  };

  const handleClearAnswer = () => {
    if (isExamPaused) return;
    const currentQ = examQuestions[currentQuestionIndex];
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestionIndex];
      if (currentQ?.id) delete copy[currentQ.id];
      return copy;
    });
  };

  const handleFinalSubmit = async () => {
    // If paused and timer has NOT expired, block manual submission
    if (isExamPaused && timeLeftSeconds > 0) return;
    setShowSubmitConfirm(false);
    if (!takingExam || !currentUser) return;

    try {
      // Calculate answered questions count
      const answeredCount = examQuestions.filter(
        (q, idx) => selectedAnswers[idx] !== undefined || (q.id && selectedAnswers[q.id] !== undefined)
      ).length;

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
      const totalQ = examQuestions.length;
      const ansCount = result.answersCount ?? answeredCount;
      const unansCount = result.unansweredCount ?? Math.max(0, totalQ - ansCount);
      const corrCount = result.correctCount ?? 0;
      const incorrCount = result.incorrectCount ?? Math.max(0, ansCount - corrCount);

      setExamScoreSummary({
        score: result.marks,
        total: result.totalMarks,
        percentage: result.percentage,
        passed: result.passed ?? result.percentage >= 50,
        status: result.status || 'submitted',
        answersCount: ansCount,
        totalQuestions: totalQ,
        correctCount: corrCount,
        incorrectCount: incorrCount,
        unansweredCount: unansCount,
      });

      // Update local exam status to completed and lock attempt permanently
      setExams((prev) =>
        prev.map((e) =>
          e.id === takingExam.id
            ? { ...e, status: 'completed', assignmentStatus: 'submitted' }
            : e
        )
      );
    } catch (err: any) {
      console.error('Error submitting exam:', err);
      if (
        err?.message?.toLowerCase().includes('already submitted') ||
        err?.message?.includes('You have already submitted this exam')
      ) {
        alert('You have already submitted this exam.');
        setTakingExam(null);
      } else {
        alert(err?.message || 'Unable to submit examination. Please notify your proctor.');
      }
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
  const answeredCount = currentExamQuestions.filter(
    (q, idx) => selectedAnswers[idx] !== undefined || (q.id && selectedAnswers[q.id] !== undefined)
  ).length;

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
            const isSubmitted = exam.assignmentStatus === 'submitted' || exam.assignmentStatus === 'graded';
            const isAvailable = exam.status === 'active' && !isSubmitted;
            const isCompleted = exam.status === 'completed' || isSubmitted;
            const isScheduled = exam.status === 'scheduled' && !isSubmitted;

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
                    <Badge variant={isSubmitted ? 'default' : statusBadgeConfig[exam.status].variant}>
                      {isSubmitted ? 'Submitted' : statusBadgeConfig[exam.status].label}
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
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', marginBottom: '0.65rem' }}>
                    <span>Schedule: </span>
                    <strong style={{ color: 'var(--color-slate-700)' }}>{formatPakistanDateTime(exam.startAt)}</strong>
                  </div>

                  {isSubmitted ? (
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => (window.location.href = '/student/results')}
                      style={{ backgroundColor: '#f1f5f9', color: '#0f2744', fontWeight: 700 }}
                    >
                      Exam Already Submitted • View Result →
                    </Button>
                  ) : isAvailable ? (
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => handleStartExam(exam)}
                      style={{ backgroundColor: '#0f2744' }}
                    >
                      Start Examination Now →
                    </Button>
                  ) : isScheduled ? (
                    <Button variant="outline" fullWidth disabled>
                      Upcoming • Opens at {formatPakistanDateTime(exam.startAt)}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => (window.location.href = '/student/results')}
                    >
                      Examination Closed • View Result
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
                  maxWidth: '560px',
                  margin: '1.75rem auto',
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-slate-50)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-slate-200)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                {/* Score & Outcome Primary KPI Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Marks Obtained</span>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.2rem' }}>
                      {examScoreSummary.score} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-slate-400)' }}>/ {examScoreSummary.total}</span>
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Percentage</span>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#047857', marginTop: '0.2rem' }}>
                      {examScoreSummary.percentage}%
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Outcome</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: examScoreSummary.passed ? '#059669' : '#dc2626', marginTop: '0.2rem' }}>
                      {examScoreSummary.passed ? 'PASSED' : 'FAILED'}
                    </div>
                  </div>
                </div>

                {/* Question Breakdown Row: Correct, Incorrect, Unanswered */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.75rem',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ padding: '0.75rem', backgroundColor: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0' }}>
                    <span style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600 }}>Correct Answers</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857', marginTop: '0.15rem' }}>
                      {examScoreSummary.correctCount ?? 0}
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: 'var(--radius-md)', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>Incorrect Answers</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: '0.15rem' }}>
                      {examScoreSummary.incorrectCount ?? 0}
                    </div>
                  </div>

                  <div style={{ padding: '0.75rem', backgroundColor: '#fffbeb', borderRadius: 'var(--radius-md)', border: '1px solid #fde68a' }}>
                    <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>Unanswered / Skipped</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: '0.15rem' }}>
                      {examScoreSummary.unansweredCount ?? 0}
                    </div>
                  </div>
                </div>

                {examScoreSummary.status === 'pending' && (
                  <div
                    style={{
                      backgroundColor: '#eff6ff',
                      border: '1px solid #dbeafe',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                      color: '#1e40af',
                      lineHeight: 1.45,
                      textAlign: 'center',
                    }}
                  >
                    Your responses have been recorded in your permanent academic record. Verified official KMU transcripts are finalized upon examiner review.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTakingExam(null);
                    window.location.href = '/student/results';
                  }}
                >
                  View Grade Transcript →
                </Button>
                <Button variant="primary" onClick={() => setTakingExam(null)} style={{ backgroundColor: '#0f2744' }}>
                  Return to Exams List
                </Button>
              </div>
            </div>
          ) : isLoadingQuestions ? (
            <Card style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <LoadingSpinner size="lg" />
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-slate-800)' }}>
                Preparing examination paper &amp; question palette...
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-slate-500)', maxWidth: '400px' }}>
                Loading questions securely from the examination bank.
              </p>
            </Card>
          ) : examQuestionsError ? (
            <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Alert type="warning">{examQuestionsError}</Alert>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Button variant="primary" onClick={() => setTakingExam(null)} style={{ backgroundColor: '#0f2744' }}>
                  Return to Exams List
                </Button>
              </div>
            </Card>
          ) : (
            /* Active Exam Layout: Timer, Question, Palette */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Remote Pause Alert Banner */}
              {isExamPaused && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '2px solid #ef4444',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    color: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)',
                  }}
                >
                  <div style={{ fontSize: '1.75rem', lineHeight: 1 }}>⏸️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>
                      EXAMINATION TEMPORARILY PAUSED
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#b91c1c', lineHeight: 1.4 }}>
                      {examPauseMessage || 'Your exam has been paused by the examination supervisor.'}{' '}
                      Question navigation, option changes, and submission are locked until resumed.
                      Your countdown timer continues to run per official examination guidelines.
                    </div>
                  </div>
                </div>
              )}

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
                          Marks: {currentQuestion.marks ?? 1}
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
                              onClick={() => {
                                if (!isExamPaused) handleSelectOption(idx);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.85rem',
                                padding: '0.85rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: `2px solid ${isSelected ? 'var(--color-primary-800)' : 'var(--color-slate-200)'}`,
                                backgroundColor: isSelected ? 'var(--color-primary-50)' : '#ffffff',
                                cursor: isExamPaused ? 'not-allowed' : 'pointer',
                                opacity: isExamPaused ? 0.6 : 1,
                                pointerEvents: isExamPaused ? 'none' : 'auto',
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
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                          disabled={isExamPaused || currentQuestionIndex === 0}
                        >
                          ← Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                          disabled={isExamPaused || currentQuestionIndex === totalQuestions - 1}
                        >
                          Next →
                        </Button>
                        {selectedAnswers[currentQuestionIndex] === undefined &&
                          (!currentQuestion?.id || selectedAnswers[currentQuestion?.id] === undefined) &&
                          currentQuestionIndex < totalQuestions - 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                              disabled={isExamPaused}
                              style={{ color: 'var(--color-slate-600)', border: '1px dashed var(--color-slate-300)' }}
                            >
                              ⏩ Skip Question
                            </Button>
                          )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button
                          variant={flaggedQuestions[currentQuestionIndex] ? 'warning' : 'ghost'}
                          size="sm"
                          onClick={handleToggleFlag}
                          disabled={isExamPaused}
                        >
                          {flaggedQuestions[currentQuestionIndex] ? '🚩 Flagged' : '🏳 Flag for Review'}
                        </Button>
                        {selectedAnswers[currentQuestionIndex] !== undefined && (
                          <Button variant="ghost" size="sm" onClick={handleClearAnswer} disabled={isExamPaused}>
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
                      {currentExamQuestions.length === 0 ? (
                        <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '1rem 0', fontSize: '0.8rem', color: 'var(--color-slate-500)' }}>
                          No questions available
                        </div>
                      ) : (
                        currentExamQuestions.map((q, qIdx) => {
                          const isAnswered =
                            selectedAnswers[qIdx] !== undefined ||
                            (q.id && selectedAnswers[q.id] !== undefined);
                          const isCurrent = currentQuestionIndex === qIdx;
                          const isFlagged = Boolean(flaggedQuestions[qIdx]);

                          let bg = '#ffffff';
                          let color = 'var(--color-slate-700)';
                          let border = '1px solid var(--color-slate-300)';

                          if (isAnswered) {
                            bg = '#059669';
                            color = '#ffffff';
                            border = '1px solid #059669';
                          } else {
                            // Unanswered / Skipped
                            bg = '#ffffff';
                            color = 'var(--color-slate-700)';
                            border = '1px solid var(--color-slate-300)';
                          }

                          if (isFlagged) {
                            if (isAnswered) {
                              bg = '#059669';
                              color = '#ffffff';
                              border = '2px solid #f59e0b';
                            } else {
                              bg = '#d97706';
                              color = '#ffffff';
                              border = '1px solid #d97706';
                            }
                          }

                          if (isCurrent) {
                            border = '2px solid #0f2744';
                          }

                          return (
                            <button
                              key={qIdx}
                              type="button"
                              disabled={isExamPaused}
                              onClick={() => {
                                if (!isExamPaused) setCurrentQuestionIndex(qIdx);
                              }}
                              title={`Question ${qIdx + 1}: ${
                                isAnswered
                                  ? isFlagged
                                    ? 'Answered & Flagged'
                                    : 'Answered'
                                  : isFlagged
                                  ? 'Skipped / Unanswered & Flagged'
                                  : 'Unanswered / Skipped'
                              }`}
                              style={{
                                position: 'relative',
                                height: '34px',
                                borderRadius: 'var(--radius-sm)',
                                border,
                                backgroundColor: bg,
                                color,
                                fontWeight: isCurrent ? 800 : 600,
                                fontSize: '0.8rem',
                                cursor: isExamPaused ? 'not-allowed' : 'pointer',
                                opacity: isExamPaused ? 0.6 : 1,
                                boxShadow: isCurrent ? '0 0 0 2px rgba(15, 39, 68, 0.25)' : 'none',
                              }}
                            >
                              {qIdx + 1}
                              {isFlagged && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-3px',
                                    fontSize: '9px',
                                    lineHeight: 1,
                                  }}
                                >
                                  🚩
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Legend */}
                    <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--color-slate-600)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', backgroundColor: '#059669', borderRadius: '2px', display: 'inline-block' }} />
                        <span>Answered ({answeredCount})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', backgroundColor: '#d97706', borderRadius: '2px', display: 'inline-block' }} />
                        <span>Flagged ({Object.values(flaggedQuestions).filter(Boolean).length})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', backgroundColor: '#ffffff', border: '1px solid #94a3b8', borderRadius: '2px', display: 'inline-block' }} />
                        <span>Unanswered / Skipped ({Math.max(0, totalQuestions - answeredCount)})</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Exam Button */}
                  <div style={{ marginTop: '1.5rem' }}>
                    <Button
                      variant="danger"
                      fullWidth
                      disabled={isExamPaused}
                      onClick={() => {
                        if (!isExamPaused) setShowSubmitConfirm(true);
                      }}
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

      {/* Submit Confirmation & Skipped Question Summary Modal */}
      {showSubmitConfirm && (
        <Modal
          isOpen={showSubmitConfirm}
          onClose={() => setShowSubmitConfirm(false)}
          title="Confirm Final Exam Submission"
          description="ROYAL COLLEGE OF NURSING SWAT • Examination Paper Review"
          maxWidth="md"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitConfirm(false)}
                >
                  Return to Exam
                </Button>
                {totalQuestions - answeredCount > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const firstSkipped = currentExamQuestions.findIndex(
                        (q, idx) =>
                          selectedAnswers[idx] === undefined &&
                          (!q.id || selectedAnswers[q.id] === undefined)
                      );
                      if (firstSkipped !== -1) {
                        setCurrentQuestionIndex(firstSkipped);
                      }
                      setShowSubmitConfirm(false);
                    }}
                    style={{ backgroundColor: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }}
                  >
                    Review Skipped Questions ({totalQuestions - answeredCount})
                  </Button>
                )}
              </div>

              <Button
                variant="danger"
                onClick={handleFinalSubmit}
                style={{ backgroundColor: '#dc2626' }}
              >
                Yes, Submit Examination
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-slate-600)', margin: 0, lineHeight: 1.5 }}>
              Please review your question completion summary below before submitting. Once submitted, your exam will be permanently locked and answers cannot be changed.
            </p>

            {/* Submission Counts Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                textAlign: 'center',
              }}
            >
              <div style={{ padding: '1rem', backgroundColor: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-slate-500)', fontWeight: 600 }}>Total Questions</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-slate-900)', marginTop: '0.25rem' }}>
                  {totalQuestions}
                </div>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#ecfdf5', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600 }}>Answered</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '0.25rem' }}>
                  {answeredCount}
                </div>
              </div>

              <div style={{ padding: '1rem', backgroundColor: totalQuestions - answeredCount > 0 ? '#fffbeb' : '#f8fafc', borderRadius: 'var(--radius-md)', border: `1px solid ${totalQuestions - answeredCount > 0 ? '#fde68a' : 'var(--color-slate-200)'}` }}>
                <span style={{ fontSize: '0.78rem', color: totalQuestions - answeredCount > 0 ? '#92400e' : 'var(--color-slate-500)', fontWeight: 600 }}>Unanswered / Skipped</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totalQuestions - answeredCount > 0 ? '#d97706' : 'var(--color-slate-600)', marginTop: '0.25rem' }}>
                  {Math.max(0, totalQuestions - answeredCount)}
                </div>
              </div>
            </div>

            {totalQuestions - answeredCount > 0 ? (
              <div
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.85rem',
                  color: '#92400e',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '1.25rem' }}>⚠️</div>
                <div>
                  <strong>Warning:</strong> You have <strong>{totalQuestions - answeredCount} unanswered/skipped</strong> question(s). Unanswered questions will receive zero marks upon submission. You may review them before submitting or proceed to submit now.
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.85rem',
                  color: '#065f46',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '1.25rem' }}>✓</div>
                <div>
                  All <strong>{totalQuestions} questions</strong> have been answered. You are ready to complete your official examination submission.
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default StudentExamsPage;
